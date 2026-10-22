import { IProvider } from '../IProvider';
import { ProviderRequest } from '../types/ProviderRequest';
import { ProviderResponse } from '../types/ProviderResponse';
import { ProviderContext } from '../types/ProviderContext';

const WORDPRESS_URL = (process.env.WORDPRESS_URL || '').trim().replace(/\/$/, '');
const WORDPRESS_USERNAME = (process.env.WORDPRESS_USERNAME || '').trim();
const WORDPRESS_APP_PASSWORD = (process.env.WORDPRESS_APP_PASSWORD || '').trim();

function _basicAuthHeader(): string | null {
  if (!WORDPRESS_USERNAME || !WORDPRESS_APP_PASSWORD) return null;
  const token = Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_APP_PASSWORD}`).toString('base64');
  return `Basic ${token}`;
}

function _wpApiPath(path: string): string {
  return `${WORDPRESS_URL}/wp-json/wp/v2/${path.replace(/^\//, '')}`;
}

async function _wpRequest(method: string, path: string, body: any = null, signal?: AbortSignal): Promise<any> {
  const auth = _basicAuthHeader();
  if (!auth) {
    throw new Error('WORDPRESS_NOT_CONFIGURED: Set WORDPRESS_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD in .env');
  }

  const headers: Record<string, string> = {
    Authorization: auth,
    'User-Agent': 'UltimateAI-JINI-WordPress-Provider/1.0'
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
      method,
      headers,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : null,
      signal: controller.signal
    });

    clearTimeout(timer);

    const responseText = await response.text();
    let data: any = null;
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

export class WordPressProvider implements IProvider {
  readonly id = 'wordpress-provider';
  readonly name = 'WordPress Publisher';
  readonly type = 'cms';

  constructor(private readonly config: Record<string, any> = {}) {}

  async execute(
    request: ProviderRequest,
    context?: ProviderContext
  ): Promise<ProviderResponse> {
    if (context?.cancellationSignal?.aborted) {
      return {
        success: false,
        error: { code: 'CANCELLED', message: 'Operation cancelled' }
      };
    }

    if (!WORDPRESS_URL) {
      return {
        success: false,
        error: {
          code: 'WORDPRESS_NOT_CONFIGURED',
          message: 'WORDPRESS_URL belum diatur di environment.'
        }
      };
    }

    try {
      const { operation, params } = request;

      switch (operation.toLowerCase()) {
        case 'test': {
          await _wpRequest('GET', 'posts?per_page=1', null, context?.cancellationSignal);
          return {
            success: true,
            data: { message: 'Koneksi ke WordPress Berita Indonesia berhasil.', url: WORDPRESS_URL },
            metadata: { provider: 'wordpress', operation: 'test' }
          };
        }

        case 'list_posts': {
          const per_page = params?.per_page || 10;
          const page = params?.page || 1;
          const posts = await _wpRequest('GET', `posts?per_page=${per_page}&page=${page}&_fields=id,title,link,date,status`, null, context?.cancellationSignal);
          return {
            success: true,
            data: { posts, count: posts.length },
            metadata: { provider: 'wordpress', operation: 'list_posts' }
          };
        }

        case 'list_categories': {
          const categories = await _wpRequest('GET', 'categories?per_page=100&_fields=id,name,slug,count', null, context?.cancellationSignal);
          return {
            success: true,
            data: { categories, count: categories.length },
            metadata: { provider: 'wordpress', operation: 'list_categories' }
          };
        }

        case 'list_tags': {
          const tags = await _wpRequest('GET', 'tags?per_page=100&_fields=id,name,slug,count', null, context?.cancellationSignal);
          return {
            success: true,
            data: { tags, count: tags.length },
            metadata: { provider: 'wordpress', operation: 'list_tags' }
          };
        }

        case 'upload_media': {
          const imageUrl = params?.featured_image_url || params?.image_url;
          if (!imageUrl) {
            return {
              success: false,
              error: { code: 'MISSING_IMAGE_URL', message: 'featured_image_url diperlukan untuk upload media.' }
            };
          }

          const imageRes = await fetch(imageUrl, { signal: context?.cancellationSignal });
          if (!imageRes.ok) {
            return {
              success: false,
              error: { code: 'IMAGE_FETCH_FAILED', message: `Tidak dapat mengambil gambar: HTTP ${imageRes.status}` }
            };
          }

          const imageBuffer = await imageRes.arrayBuffer();
          const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
          const fileName = imageUrl.split('/').pop() || 'image.jpg';

          const formData = new FormData();
          formData.append('file', new Blob([imageBuffer], { type: contentType }), fileName);
          if (params?.title) formData.append('title', params.title);
          if (params?.content) formData.append('caption', params.content);

          const media = await _wpRequest('POST', 'media', formData, context?.cancellationSignal);
          return {
            success: true,
            data: {
              mediaId: media.id,
              mediaUrl: media.source_url || media.guid?.rendered,
              altText: media.alt_text
            },
            metadata: { provider: 'wordpress', operation: 'upload_media' }
          };
        }

        case 'create_post': {
          const title = params?.title;
          const content = params?.content;
          if (!title || !content) {
            return {
              success: false,
              error: { code: 'MISSING_REQUIRED_FIELDS', message: 'Judul (title) dan isi (content) wajib diisi.' }
            };
          }

          let featuredImageId = 0;
          if (params?.featured_image_url) {
            try {
              const mediaResult = await this.execute({
                operation: 'upload_media',
                params: { featured_image_url: params.featured_image_url, title, content: params?.excerpt }
              }, context);
              if (mediaResult.success && mediaResult.data) {
                featuredImageId = mediaResult.data.mediaId || 0;
              }
            } catch (mediaErr) {
              console.warn('[WordPressProvider] Featured image upload failed:', mediaErr.message);
            }
          }

          const postData: any = {
            title,
            content,
            status: params?.status || 'draft',
            categories: Array.isArray(params?.categories) ? params.categories : [],
            tags: Array.isArray(params?.tags) ? params.tags : []
          };

          if (params?.excerpt) postData.excerpt = params.excerpt;
          if (params?.slug) postData.slug = params.slug;
          if (featuredImageId) postData.featured_media = featuredImageId;

          const post = await _wpRequest('POST', 'posts', postData, context?.cancellationSignal);

          return {
            success: true,
            data: {
              postId: post.id,
              postUrl: post.link || `${WORDPRESS_URL}/?p=${post.id}`,
              status: post.status,
              title: post.title?.rendered || title
            },
            metadata: { provider: 'wordpress', operation: 'create_post' }
          };
        }

        default: {
          return {
            success: false,
            error: {
              code: 'UNSUPPORTED_OPERATION',
              message: `Operasi "${operation}" tidak didukung. Gunakan: test, list_posts, list_categories, list_tags, upload_media, create_post.`
            }
          };
        }
      }
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'WORDPRESS_OPERATION_FAILED',
          message: err.message || 'Terjadi kesalahan saat berkomunikasi dengan WordPress.'
        }
      };
    }
  }
}