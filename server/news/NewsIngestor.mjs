/**
 * NewsIngestor.mjs
 * PHASE 3 — WordPress -> normalized articles -> NewsIndex.
 *
 * ARCHITECTURAL RULE:
 *  - Read-only against WordPress. It never writes to the CMS.
 *  - Only `status=publish` articles are ingested: drafts must never leak into
 *    public grounded answers (a draft may be unreleased/unverified).
 *  - Normalization is deterministic: the same post always yields the same
 *    content hash, so re-running the sync is idempotent.
 *  - Deduplication works on two levels:
 *      1. same post id      -> upsert (updates in place)
 *      2. same content hash -> cross-post duplicate (syndicated article)
 *
 * Incremental sync uses the WordPress `modified_after` parameter, which this
 * site supports (verified: WordPress >= 5.7).
 */
import crypto from 'crypto';
import { wpGet, htmlToText, neutralizeUntrusted, isWordPressConfigured } from './WordPressIngestClient.mjs';

const DEFAULT_PER_PAGE = 100;
const MAX_PAGES = 500;

/** Post fields we need. Kept minimal to keep responses small. */
const POST_FIELDS = [
  'id', 'date', 'date_gmt', 'modified_gmt', 'slug', 'status', 'link',
  'title', 'excerpt', 'content', 'categories', 'tags', 'author'
].join(',');

/**
 * Normalizes a raw WordPress post into the internal article shape.
 * Pure function: same input always produces the same output + hash.
 */
export function normalizePost(post, context = {}) {
  if (!post || !post.id) return null;

  const title = htmlToText(post.title?.rendered || post.title || '').trim();
  const excerpt = htmlToText(post.excerpt?.rendered || post.excerpt || '').trim();
  const rawBody = htmlToText(post.content?.rendered || post.content || '').trim();
  const body = neutralizeUntrusted(rawBody);

  if (!title && !body) return null;

  // Content hash ignores volatile fields (dates, links) so that an edited or
  // re-slugged copy of the same article is still detected as a duplicate.
  const hashBasis = [title.toLowerCase(), excerpt.toLowerCase(), body.toLowerCase()].join('|');
  const contentHash = crypto.createHash('sha256').update(hashBasis).digest('hex').slice(0, 32);

  // Category labels come from the shared id -> name map (categoryNamesById).
  const categoryIds = Array.isArray(post.categories) ? post.categories : [];
  const categoryMap = context.categoryNamesById || {};
  const categoryNames = categoryIds
    .map(id => categoryMap[id])
    .filter(name => typeof name === 'string' && name.trim().length > 0);

  return {
    postId: post.id,
    title,
    slug: post.slug || '',
    link: post.link || '',
    status: post.status || 'publish',
    date: post.date || '',
    dateGmt: post.date_gmt || '',
    modifiedGmt: post.modified_gmt || '',
    authorName: context.authorName || '',
    categories: categoryIds,
    categoryNames,
    tags: Array.isArray(post.tags) ? post.tags : [],
    tagNames: (Array.isArray(post.tags) ? post.tags : [])
      .map(id => (context.tagNamesById || {})[id])
      .filter(name => typeof name === 'string' && name.trim().length > 0),
    excerpt,
    body,
    contentHash
  };
}


/**
 * Builds the id -> name map for categories, so articles can be labeled with
 * human readable sections (Daerah, Hukum, Ekonomi, ...).
 */
export async function fetchCategoryNames(ids = []) {
  const map = {};
  const unique = [...new Set(ids.map(Number).filter(Number.isFinite))];
  if (unique.length === 0) return map;

  const CHUNK = 100;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    // WordPress expects a COMMA-SEPARATED id list. Repeating `include=` (e.g.
    // `include=1&include=2`) silently returns an empty list.
    const res = await wpGet(`categories?include=${chunk.join(',')}&per_page=${CHUNK}&_fields=id,name`);
    for (const cat of (res.data || [])) {
      map[cat.id] = cat.name;
    }
  }
  return map;
}

/**
 * Builds the id -> name map for tags. The site has a small tag set, so a
 * single page is enough; anything missing is simply not labeled.
 */
export async function fetchTagNames(ids = []) {
  const map = {};
  const unique = [...new Set(ids.map(Number).filter(Number.isFinite))];
  if (unique.length === 0) return map;

  const CHUNK = 100;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    // WordPress expects a COMMA-SEPARATED id list.
    try {
      const res = await wpGet(`tags?include=${chunk.join(',')}&per_page=${CHUNK}&_fields=id,name`);
      for (const tag of (res.data || [])) {
        map[tag.id] = tag.name;
      }
    } catch (_) {
      // Tag labels are optional metadata — never fail the ingest over them.
    }
  }
  return map;
}

/**
 * Fetches the list of articles modified after a cursor.
 * @param {object} opts - { modifiedAfter, perPage, page, signal }
 */
export async function fetchPosts(opts = {}) {
  const perPage = Math.min(Math.max(parseInt(opts.perPage || DEFAULT_PER_PAGE, 10), 1), 100);
  const page = Math.max(parseInt(opts.page || 1, 10), 1);

  const params = [
    `per_page=${perPage}`,
    `page=${page}`,
    'status=publish',
    'orderby=modified',
    'order=desc',
    `_fields=${POST_FIELDS}`
  ];
  if (opts.modifiedAfter) {
    // WordPress expects an ISO-8601 datetime without timezone suffix.
    params.push(`modified_after=${encodeURIComponent(String(opts.modifiedAfter).replace(/Z$/, ''))}`);
  }

  return wpGet(`posts?${params.join('&')}`, { signal: opts.signal });
}


export class NewsIngestor {
  constructor(index) {
    this.index = index;
  }

  /**
   * Runs a full or incremental sync.
   * @param {object} opts - { modifiedAfter, maxPages, perPage, onProgress }
   */
  async sync(opts = {}) {
    if (!isWordPressConfigured()) {
      throw new Error('WORDPRESS_NOT_CONFIGURED: WordPress credentials are not set in .env');
    }
    if (!this.index || !this.index.db) {
      throw new Error('NEWS_INDEX_UNAVAILABLE: NewsIndex is not initialised.');
    }

    const perPage = opts.perPage || DEFAULT_PER_PAGE;
    const maxPages = Math.min(opts.maxPages || MAX_PAGES, MAX_PAGES);
    const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : () => {};

    const stats = {
      pagesFetched: 0,
      seen: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      duplicates: 0,
      skipped: 0,
      errors: []
    };

    let page = 1;
    let categoryMap = {};
    let tagMap = {};
    let newestModified = null;

    while (page <= maxPages) {
      let res;
      try {
        res = await fetchPosts({
          modifiedAfter: opts.modifiedAfter,
          perPage,
          page,
          signal: opts.signal
        });
      } catch (err) {
        // A page beyond the last one returns HTTP 400 -> treat as end of data.
        if (err.status === 400) break;
        stats.errors.push({ page, message: err.message, code: err.code || 'UNKNOWN' });
        break;
      }

      const posts = Array.isArray(res.data) ? res.data : [];
      if (posts.length === 0) break;

      stats.pagesFetched += 1;
      stats.seen += posts.length;

      // Refresh the category label map only when we meet new category ids.
      const allCategoryIds = posts.flatMap(p => (Array.isArray(p.categories) ? p.categories : []));
      const missing = allCategoryIds.filter(id => !(id in categoryMap));
      if (missing.length > 0) {
        try {
          const fetched = await fetchCategoryNames(missing);
          categoryMap = { ...categoryMap, ...fetched };
        } catch (err) {
          stats.errors.push({ page, message: `category map: ${err.message}`, code: err.code || 'UNKNOWN' });
        }
      }

      // Same for tag labels.
      const allTagIds = posts.flatMap(p => (Array.isArray(p.tags) ? p.tags : []));
      const missingTags = allTagIds.filter(id => !(id in tagMap));
      if (missingTags.length > 0) {
        const fetched = await fetchTagNames(missingTags);
        tagMap = { ...tagMap, ...fetched };
      }

      for (const post of posts) {
        const article = normalizePost(post, { categoryNamesById: categoryMap, tagNamesById: tagMap });
        if (!article) {
          stats.skipped += 1;
          continue;
        }

        // Cross-post duplicate detection (syndicated article).
        const duplicateOf = this.index.findByContentHash(article.contentHash);
        if (duplicateOf && duplicateOf.postId !== article.postId) {
          stats.duplicates += 1;
          continue;
        }

        const changed = this.index.upsertArticle(article);
        if (changed === 'inserted') stats.inserted += 1;
        else if (changed === 'updated') stats.updated += 1;
        else stats.unchanged += 1;

        if (article.modifiedGmt && (!newestModified || article.modifiedGmt > newestModified)) {
          newestModified = article.modifiedGmt;
        }
      }

      onProgress({ ...stats, page });

      if (res.totalPages && page >= res.totalPages) break;
      page += 1;
    }

    // Persist the sync cursor for the next incremental run.
    const cursor = newestModified || this.index.getMeta('last_sync_cursor') || '';
    if (cursor) this.index.setMeta('last_sync_cursor', cursor);
    this.index.setMeta('last_sync_at', new Date().toISOString());
    this.index.setMeta('last_sync_stats', JSON.stringify(stats));
    this.index.setMeta('total_articles', this.index.countArticles());

    return { ...stats, cursor, totalArticles: this.index.countArticles() };
  }
}

export default { NewsIngestor, normalizePost, fetchPosts, fetchCategoryNames };
