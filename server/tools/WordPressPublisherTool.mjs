/**
 * WordPressPublisherTool.mjs
 * WordPress REST API adapter used by LocalRouterServer.
 * Credentials are read from environment variables; never hard-code secrets.
 */
const cleanBaseUrl = (value = '') => String(value).trim().replace(/\/+$/, '');

export class WordPressPublisherTool {
  constructor() {
    this.name = 'wordpress.publisher';
    this.version = '1.0.0';
    this.description = 'Connects to a WordPress site through its REST API to test access, list posts/categories/tags, upload media, and create draft or published posts.';
  }

  getConfig() {
    const baseUrl = cleanBaseUrl(process.env.WORDPRESS_URL || process.env.WP_URL || '');
    const username = String(process.env.WORDPRESS_USERNAME || process.env.WP_USERNAME || '');
    const appPassword = String(process.env.WORDPRESS_APP_PASSWORD || process.env.WP_APP_PASSWORD || '').replace(/\s+/g, '');
    return { baseUrl, username, appPassword };
  }

  async request(endpoint, { method = 'GET', body, headers = {} } = {}) {
    const { baseUrl, username, appPassword } = this.getConfig();
    if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
      return { success: false, error: { code: 'WORDPRESS_CONFIG_MISSING', message: 'Konfigurasi WordPress belum lengkap. Atur WORDPRESS_URL, WORDPRESS_USERNAME, dan WORDPRESS_APP_PASSWORD.' } };
    }
    if (!username || !appPassword) {
      return { success: false, error: { code: 'WORDPRESS_CREDENTIALS_MISSING', message: 'Kredensial WordPress belum diatur. Gunakan Application Password WordPress; jangan gunakan password akun biasa.' } };
    }
    const auth = Buffer.from(username + ':' + appPassword).toString('base64');
    let response;
    try {
      response = await fetch(baseUrl + '/wp-json/wp/v2/' + endpoint.replace(/^\/+/, ''), {
        method,
        headers: { Authorization: 'Basic ' + auth, Accept: 'application/json', ...headers },
        body,
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      return { success: false, error: { code: 'WORDPRESS_NETWORK_ERROR', message: err.message } };
    }
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text.slice(0, 500) }; }
    if (!response.ok) {
      return { success: false, error: { code: data.code || 'WORDPRESS_HTTP_ERROR', message: data.message || ('WordPress HTTP ' + response.status), status: response.status } };
    }
    return { success: true, data };
  }

  async execute(params = {}) {
    const operation = String(params.operation || 'test').toLowerCase();
    if (operation === 'test') {
      const result = await this.request('users/me?context=edit');
      if (!result.success) return result;
      return { success: true, message: 'Koneksi WordPress berhasil.', user: { id: result.data.id, name: result.data.name, slug: result.data.slug } };
    }
    if (operation === 'list_posts') {
      const result = await this.request('posts?per_page=20&status=any&orderby=date&order=desc');
      return result.success ? { success: true, posts: result.data.map(p => ({ id: p.id, title: p.title?.rendered || '', status: p.status, link: p.link, date: p.date })) } : result;
    }
    if (operation === 'list_categories') {
      const result = await this.request('categories?per_page=100&hide_empty=false');
      return result.success ? { success: true, categories: result.data.map(x => ({ id: x.id, name: x.name, slug: x.slug })) } : result;
    }
    if (operation === 'list_tags') {
      const result = await this.request('tags?per_page=100&hide_empty=false');
      return result.success ? { success: true, tags: result.data.map(x => ({ id: x.id, name: x.name, slug: x.slug })) } : result;
    }
    if (operation === 'upload_media') {
      const fileName = String(params.fileName || params.filename || 'upload.bin').replace(/[\r\n"]/g, '');
      const mimeType = String(params.mimeType || params.contentType || 'application/octet-stream');
      if (!params.filePath && !params.bufferBase64) {
        return { success: false, error: { code: 'WORDPRESS_MEDIA_INPUT_REQUIRED', message: 'filePath atau bufferBase64 wajib diisi.' } };
      }
      let bytes;
      try {
        if (params.bufferBase64) bytes = Buffer.from(params.bufferBase64, 'base64');
        else {
          const fs = await import('node:fs/promises');
          bytes = await fs.readFile(String(params.filePath));
        }
      } catch (err) {
        return { success: false, error: { code: 'WORDPRESS_MEDIA_READ_FAILED', message: err.message } };
      }
      const result = await this.request('media', { method: 'POST', headers: { 'Content-Disposition': 'attachment; filename="' + fileName + '"', 'Content-Type': mimeType }, body: bytes });
      return result.success ? { success: true, media: { id: result.data.id, url: result.data.source_url, title: result.data.title?.rendered || fileName } } : result;
    }
    if (operation === 'create_post') {
      const title = String(params.title || '').trim();
      const content = String(params.content || '').trim();
      if (!title || !content) return { success: false, error: { code: 'WORDPRESS_POST_FIELDS_REQUIRED', message: 'title dan content wajib diisi.' } };
      const status = params.status === 'publish' ? 'publish' : 'draft';
      const post = { title, content, status };
      if (Array.isArray(params.categories)) post.categories = params.categories.map(Number).filter(Number.isFinite);
      if (Array.isArray(params.tags)) post.tags = params.tags.map(Number).filter(Number.isFinite);
      if (params.excerpt) post.excerpt = String(params.excerpt);
      const result = await this.request('posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(post) });
      return result.success ? { success: true, post: { id: result.data.id, title: result.data.title?.rendered || title, status: result.data.status, link: result.data.link } } : result;
    }
    return { success: false, error: { code: 'WORDPRESS_OPERATION_UNSUPPORTED', message: 'Operasi tidak didukung: ' + operation } };
  }
}

export const wordpressPublisherToolInstance = new WordPressPublisherTool();
export default wordpressPublisherToolInstance;
