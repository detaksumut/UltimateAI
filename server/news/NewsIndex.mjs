/**
 * NewsIndex.mjs
 * PHASE 3 — Persistent Article Index for the News Intelligence Engine.
 *
 * ARCHITECTURAL RULE:
 *  - SQLite (better-sqlite3) is the index, exactly like server/memory/MemoryIndexSQLite.mjs.
 *  - Full-text search uses FTS5 with the unicode61 tokenizer + remove_diacritics 2,
 *    which is REQUIRED for Indonesian ("hukum" ~ "hukum", "café" ~ "cafe").
 *  - The canonical article body stays in WordPress; this DB is a rebuildable index.
 *    It stores the text needed for grounded answers plus provenance (post id, url).
 *
 * Schema:
 *   news_articles       — one row per WordPress post (metadata + plain text body)
 *   news_articles_fts   — FTS5 virtual table (title, excerpt, body, categories)
 *   news_index_meta     — ingestion bookkeeping (sync cursor, last run, totals)
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'server', 'data', 'news_index.sqlite');

export class NewsIndex {
  constructor(dbPath = null) {
    this.dbPath = dbPath || process.env.NEWS_INDEX_DB_PATH || DEFAULT_DB_PATH;
    this.db = null;
    this.init();
  }

  init() {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this._migrateFtsSchema();
      this._createSchema();
    } catch (err) {
      console.error('[NewsIndex] Failed to initialize SQLite index:', err.message);
      this.db = null;
    }
  }

  /**
   * The FTS table must be an EXTERNAL CONTENT table driven by triggers.
   * The previous build used `content=''` (contentless), which is broken:
   *   - UPDATE could not remove stale terms (old body still matched),
   *   - `DELETE FROM news_articles_fts` throws "cannot DELETE from contentless
   *     fts5 table", so removeArticle() failed.
   * When an outdated contentless table is found it is dropped and rebuilt
   * from the base table (the base table always keeps the source of truth).
   */
  _migrateFtsSchema() {
    if (!this.db) return;
    try {
      const row = this.db.prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='news_articles_fts'"
      ).get();
      if (!row || !row.sql) return;
      const sql = String(row.sql);
      // Desired: external content bound to news_articles/postId.
      if (sql.includes("content='news_articles'") && sql.includes("content_rowid='postId'")) return;

      const hasBase = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='news_articles'"
      ).get();
      this.db.exec('DROP TABLE IF EXISTS news_articles_fts;');
      if (hasBase) {
        // Rebuild the FTS index from the base table.
        this.db.exec(`
          CREATE VIRTUAL TABLE news_articles_fts USING fts5(
            title, excerpt, body, categoryNames,
            content='news_articles', content_rowid='postId',
            tokenize="unicode61 remove_diacritics 2"
          );
          INSERT INTO news_articles_fts(news_articles_fts) VALUES('rebuild');
        `);
        console.log('[NewsIndex] Migrated FTS table to external-content schema (rebuilt).');
      }
    } catch (err) {
      console.warn('[NewsIndex] FTS schema migration skipped:', err.message);
    }
  }

  _createSchema() {
    if (!this.db) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS news_articles (
        postId INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT,
        link TEXT,
        status TEXT,
        date TEXT,
        dateGmt TEXT,
        modifiedGmt TEXT,
        authorName TEXT,
        categories TEXT NOT NULL DEFAULT '[]',
        categoryNames TEXT NOT NULL DEFAULT '[]',
        tags TEXT NOT NULL DEFAULT '[]',
        tagNames TEXT NOT NULL DEFAULT '[]',
        excerpt TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        wordCount INTEGER DEFAULT 0,
        contentHash TEXT,
        ingestedAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_news_date ON news_articles(date);
      CREATE INDEX IF NOT EXISTS idx_news_status ON news_articles(status);

      CREATE VIRTUAL TABLE IF NOT EXISTS news_articles_fts USING fts5(
        title,
        excerpt,
        body,
        categoryNames,
        content='news_articles',
        content_rowid='postId',
        tokenize="unicode61 remove_diacritics 2"
      );

      -- External-content FTS5 needs triggers to stay in sync with the base table.
      -- (A contentless table cannot be updated or deleted at all.)
      CREATE TRIGGER IF NOT EXISTS news_articles_ai AFTER INSERT ON news_articles BEGIN
        INSERT INTO news_articles_fts(rowid, title, excerpt, body, categoryNames)
        VALUES (new.postId, new.title, new.excerpt, new.body, new.categoryNames);
      END;

      CREATE TRIGGER IF NOT EXISTS news_articles_ad AFTER DELETE ON news_articles BEGIN
        INSERT INTO news_articles_fts(news_articles_fts, rowid, title, excerpt, body, categoryNames)
        VALUES ('delete', old.postId, old.title, old.excerpt, old.body, old.categoryNames);
      END;

      CREATE TRIGGER IF NOT EXISTS news_articles_au AFTER UPDATE ON news_articles BEGIN
        INSERT INTO news_articles_fts(news_articles_fts, rowid, title, excerpt, body, categoryNames)
        VALUES ('delete', old.postId, old.title, old.excerpt, old.body, old.categoryNames);
        INSERT INTO news_articles_fts(rowid, title, excerpt, body, categoryNames)
        VALUES (new.postId, new.title, new.excerpt, new.body, new.categoryNames);
      END;

      CREATE TABLE IF NOT EXISTS news_index_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  }


  /**
   * Inserts or updates one article.
   * Returns 'inserted' | 'updated' | 'unchanged' so callers can report
   * accurate ingestion statistics.
   * `categories`/`categoryNames`/`tags`/`tagNames` are JSON-encoded arrays.
   */
  upsertArticle(article) {
    if (!this.db || !article || !article.postId) return 'unchanged';
    const now = new Date().toISOString();

    const existing = this.db.prepare('SELECT contentHash FROM news_articles WHERE postId = ?').get(article.postId);
    const isNew = !existing;
    const contentChanged = isNew || (existing.contentHash || '') !== (article.contentHash || '');

    const payload = {
      postId: article.postId,
      title: article.title || '',
      slug: article.slug || '',
      link: article.link || '',
      status: article.status || 'publish',
      date: article.date || '',
      dateGmt: article.dateGmt || '',
      modifiedGmt: article.modifiedGmt || '',
      authorName: article.authorName || '',
      categories: JSON.stringify(article.categories || []),
      categoryNames: JSON.stringify(article.categoryNames || []),
      tags: JSON.stringify(article.tags || []),
      tagNames: JSON.stringify(article.tagNames || []),
      excerpt: article.excerpt || '',
      body: article.body || '',
      wordCount: (article.body || '').split(/\s+/).filter(Boolean).length,
      contentHash: article.contentHash || '',
      ingestedAt: now
    };

    const tx = this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO news_articles (
          postId, title, slug, link, status, date, dateGmt, modifiedGmt, authorName,
          categories, categoryNames, tags, tagNames, excerpt, body, wordCount, contentHash, ingestedAt
        ) VALUES (
          @postId, @title, @slug, @link, @status, @date, @dateGmt, @modifiedGmt, @authorName,
          @categories, @categoryNames, @tags, @tagNames, @excerpt, @body, @wordCount, @contentHash, @ingestedAt
        )
        ON CONFLICT(postId) DO UPDATE SET
          title = excluded.title,
          slug = excluded.slug,
          link = excluded.link,
          status = excluded.status,
          date = excluded.date,
          dateGmt = excluded.dateGmt,
          modifiedGmt = excluded.modifiedGmt,
          authorName = excluded.authorName,
          categories = excluded.categories,
          categoryNames = excluded.categoryNames,
          tags = excluded.tags,
          tagNames = excluded.tagNames,
          excerpt = excluded.excerpt,
          body = excluded.body,
          wordCount = excluded.wordCount,
          contentHash = excluded.contentHash,
          ingestedAt = excluded.ingestedAt
      `).run(payload);
    });

    tx();
    return isNew ? 'inserted' : (contentChanged ? 'updated' : 'unchanged');
  }

  /**
   * Removes an article (and its FTS row) from the index.
   * The FTS row is removed by the news_articles_ad trigger.
   */
  removeArticle(postId) {
    if (!this.db) return false;
    const info = this.db.prepare('DELETE FROM news_articles WHERE postId = ?').run(postId);
    return info.changes > 0;
  }

  /**
   * Finds a previously ingested article with the same content hash.
   * Used for cross-post deduplication (syndicated/reposted articles).
   */
  findByContentHash(contentHash) {
    if (!this.db || !contentHash) return null;
    const row = this.db.prepare(
      'SELECT postId, title, link FROM news_articles WHERE contentHash = ? LIMIT 1'
    ).get(contentHash);
    return row || null;
  }

  /**
   * Full-text search over the FTS5 index.
   * Returns rows ordered by BM25 relevance (bm25() returns a negative score; lower is better).
   */
  search(ftsQuery, limit = 10) {
    if (!this.db) return [];
    const rows = this.db.prepare(`
      SELECT
        a.postId, a.title, a.slug, a.link, a.status, a.date, a.dateGmt, a.modifiedGmt,
        a.authorName, a.categoryNames, a.tags, a.excerpt, a.wordCount,
        bm25(news_articles_fts, 10.0, 4.0, 1.0, 2.0) AS bm25Score
      FROM news_articles_fts
      JOIN news_articles a ON a.postId = news_articles_fts.rowid
      WHERE news_articles_fts MATCH ?
      ORDER BY bm25Score
      LIMIT ?
    `).all(ftsQuery, limit);
    return rows;
  }

  getArticle(postId) {
    if (!this.db) return null;
    const row = this.db.prepare('SELECT * FROM news_articles WHERE postId = ?').get(postId);
    if (!row) return null;
    return {
      ...row,
      categories: safeJson(row.categories),
      categoryNames: safeJson(row.categoryNames),
      tags: safeJson(row.tags),
      tagNames: safeJson(row.tagNames)
    };
  }

  getRecentArticles(limit = 10) {
    if (!this.db) return [];
    return this.db.prepare(`
      SELECT postId, title, link, status, date, categoryNames, excerpt, wordCount
      FROM news_articles
      WHERE status = 'publish'
      ORDER BY date DESC
      LIMIT ?
    `).all(limit).map(r => ({ ...r, categoryNames: safeJson(r.categoryNames) }));
  }

  countArticles() {
    if (!this.db) return 0;
    const row = this.db.prepare('SELECT COUNT(*) AS c FROM news_articles').get();
    return row ? row.c : 0;
  }

  /**
   * Stores ingestion bookkeeping (last sync cursor, last run, totals).
   */
  setMeta(key, value) {
    if (!this.db) return;
    this.db.prepare('INSERT INTO news_index_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, String(value));
  }

  getMeta(key) {
    if (!this.db) return null;
    const row = this.db.prepare('SELECT value FROM news_index_meta WHERE key = ?').get(key);
    return row ? row.value : null;
  }

  close() {
    if (this.db) {
      try { this.db.close(); } catch (_) { /* already closed */ }
      this.db = null;
    }
  }
}

function safeJson(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

export const newsIndexInstance = new NewsIndex();

export default { NewsIndex, newsIndexInstance };

