/**
 * WordPressPublisherTool.mjs
 * WordPress REST API Publisher for JINI AI - Berita Indonesia Integration.
 * Provides secure server-side integration with WordPress beritaindonesia.news
 * using Application Password authentication. No credentials exposed to frontend.
 */
import { ToolContract, PERMISSION_LEVELS } from './ToolContract.mjs';

const WORDPRESS_URL = (process.env.WORDPRESS_URL || '').trim().replace(/\/$/, '');
const WORDPRESS_USERNAME = (process.env.WORDPRESS_USERNAME || '').trim();
const WORDPRESS_APP_PASSWORD = (process.env.WORDPRESS_APP_PASSWORD || '').trim();

function _basicAuthHeader() {
  if (!WORDPRESS_USERNAME || !WORDPRESS_APP_PASSWORD) return null;
  const token = Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_APP_PASSWORD}`).toString('base64');
  return `Basic ${token}`;
}

function _wpApiPath(path) {
  return `${WORDPRESS_URL}/wp-json/wp/v2/${path.replace(/^\//, '')}`;
}

async function _wpRequest(method, path, body = null, signal = null) {
  const auth = _basicAuthHeader();
  if (!auth) {
    throw new Error('WORDPRESS_NOT_CONFIGURED: WORDPRESS_USERNAME and WORDPRESS_APP_PASSWORD must be set in .env');
  }
  const headers = {
    Authorization: auth,
    'User-Agent': 'UltimateAI-JINI-WordPress-Publisher/1.0'
  };
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }
  try {
    const response = await fetch(_wpApiPath(path), {
      method, headers,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : null,
      signal: controller.signal
    });
    clearTimeout(timer);
    const responseText = await response.text();
    let data = null;
    if (responseText && responseText.trim()) {
      try { data = JSON.parse(responseText); } catch { data = { raw: responseText }; }
    }
    if (!response.ok) {
      const errorMsg = data && data.message ? data.message : `HTTP ${response.status}`;
      throw new Error(`WORDPRESS_API_ERROR: ${errorMsg}`);
    }
    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('WORDPRESS_REQUEST_TIMEOUT: Request to WordPress timed out.');
    }
    throw err;
  }
}

export class WordPressPublisherTool extends ToolContract {
  constructor() {
    super({
      name: 'wordpress.publish',
      version: '1.0.0',
      description: 'Terbitkan dan kelola artikel ke WordPress Berita Indonesia via REST API.',
      inputSchema: {
        operation: 'string',
        title: 'string',
        content: 'string',
        excerpt: 'string',
        status: 'string',
        categories: 'array',
        tags: 'array',
        featured_image_url: 'string',
        slug: 'string'
      },
      outputSchema: {
        success: 'boolean',
        postId: 'number',
        postUrl: 'string',
        status: 'string',
        message: 'string',
        data: 'object'
      },
      permissionLevel: PERMISSION_LEVELS.CONFIRMATION_REQUIRED,
      requiresConfirmation: true,
      timeoutMs: 30000,
      maxRetries: 2,
      allowedDomains: ['*']
    });
  }
  async execute(params = {}, signal = null) {
    const {
      operation = 'test',
      title = '',
      content = '',
      excerpt = '',
      status = 'draft',
      categories = [],
      tags = [],
      featured_image_url = '',
      slug = ''
    } = params;

    if (!WORDPRESS_URL) {
      return {
        success: false,
        error: { code: 'WORDPRESS_NOT_CONFIGURED', message: 'WORDPRESS_URL belum diatur di environment.' },
        data: null
      };
    }

    try {
      switch (operation.toLowerCase()) {
        case 'test': {
          await _wpRequest('GET', 'posts?per_page=1', null, signal);
          return {
            success: true,
            message: 'Koneksi ke WordPress Berita Indonesia berhasil.',
            data: { url: WORDPRESS_URL }
          };
        }
        case 'list_posts': {
          const per_page = params.per_page || 10;
          const page = params.page || 1;
          const posts = await _wpRequest('GET', `posts?per_page=${per_page}&page=${page}&_fields=id,title,link,date,status`, null, signal);
          return {
            success: true,
            message: `Berhasil mengambil ${posts.length} artikel.`,
            data: { posts }
          };
        }
        case 'list_categories': {
          const categories = await _wpRequest('GET', 'categories?per_page=100&_fields=id,name,slug,count', null, signal);
          return {
            success: true,
            message: `Berhasil mengambil ${categories.length} kategori.`,
            data: { categories }
          };
        }
        case 'list_tags': {
          const tags = await _wpRequest('GET', 'tags?per_page=100&_fields=id,name,slug,count', null, signal);
          return {
            success: true,
            message: `Berhasil mengambil ${tags.length} tag.`,
            data: { tags }
          };
        }
        case 'upload_media': {
          if (!featured_image_url) {
            return {
              success: false,
              error: { code: 'MISSING_IMAGE_URL', message: 'featured_image_url diperlukan untuk upload media.' },
              data: null
            };
          }
          const imageRes = await fetch(featured_image_url, { signal });
          if (!imageRes.ok) {
            return {
              success: false,
              error: { code: 'IMAGE_FETCH_FAILED', message: `Tidak dapat mengambil gambar: HTTP ${imageRes.status}` },
              data: null
            };
          }
          const imageBuffer = await imageRes.arrayBuffer();
          const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
          const fileName = featured_image_url.split('/').pop() || 'image.jpg';
          const formData = new FormData();
          formData.append('file', new Blob([imageBuffer], { type: contentType }), fileName);
          if (title) formData.append('title', title);
          if (content) formData.append('caption', content);
          const media = await _wpRequest('POST', 'media', formData, signal);
          return {
            success: true,
            message: 'Gambar berhasil diunggah ke Media Library.',
            data: {
              mediaId: media.id,
              mediaUrl: media.source_url || media.guid?.rendered,
              altText: media.alt_text
            }
          };
        }
        case 'create_post': {
          if (!title || !content) {
            return {
              success: false,
              error: { code: 'MISSING_REQUIRED_FIELDS', message: 'Judul (title) dan isi (content) wajib diisi.' },
              data: null
            };
          }
          let featuredImageId = 0;
          if (featured_image_url) {
            try {
              const mediaResult = await this.execute({
                operation: 'upload_media',
                featured_image_url,
                title,
                content: excerpt
              }, signal);
              if (mediaResult.success && mediaResult.data) {
                featuredImageId = mediaResult.data.mediaId || 0;
              }
            } catch (mediaErr) {
              console.warn('[WordPressPublisher] Featured image upload failed, continuing without image:', mediaErr.message);
            }
          }
          const postData = {
            title,
            content,
            status: status || 'draft',
            categories: Array.isArray(categories) ? categories : [],
            tags: Array.isArray(tags) ? tags : []
          };
          if (excerpt) postData.excerpt = excerpt;
          if (slug) postData.slug = slug;
          if (featuredImageId) postData.featured_media = featuredImageId;
          const post = await _wpRequest('POST', 'posts', postData, signal);
          return {
            success: true,
            message: `Artikel berhasil dibuat (status: ${post.status || status}).`,
            data: {
              postId: post.id,
              postUrl: post.link || `${WORDPRESS_URL}/?p=${post.id}`,
              status: post.status,
              title: post.title?.rendered || title
            }
          };
        }
        default: {
          return {
            success: false,
            error: {
              code: 'UNSUPPORTED_OPERATION',
              message: `Operasi "${operation}" tidak didukung. Gunakan: test, list_posts, list_categories, list_tags, upload_media, create_post.`
            },
            data: null
          };
        }
      }
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'WORDPRESS_OPERATION_FAILED',
          message: err.message || 'Terjadi kesalahan saat berkomunikasi dengan WordPress.'
        },
        data: null
      };
    }
  }
}

export const wordpressPublisherToolInstance = new WordPressPublisherTool();
export default wordpressPublisherToolInstance;