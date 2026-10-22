/**
 * WordPressIngestClient.mjs
 * PHASE 3 — Authenticated WordPress REST client for the News Intelligence Engine.
 *
 * ARCHITECTURAL RULE:
 *  - Reuses the EXACT Application Password auth pattern proven by
 *    server/tools/WordPressPublisherTool.mjs (Basic auth, /wp-json/wp/v2/).
 *  - Read-only by design: this client never creates, updates or deletes posts.
 *    Publishing remains exclusively owned by WordPressPublisherTool.mjs.
 *  - All WordPress payloads are UNTRUSTED EXTERNAL DATA: they are stripped of
 *    markup and neutralized before they can ever reach an LLM prompt.
 */

const DEFAULT_TIMEOUT_MS = parseInt(process.env.WORDPRESS_TIMEOUT_MS || '30000', 10);

export class WordPressIngestError extends Error {
  constructor(code, message, status = null) {
    super(message);
    this.name = 'WordPressIngestError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Reads configuration lazily so import order can never leave the client
 * unconfigured (dotenv may populate .env after this module is imported).
 */
function _config() {
  return {
    url: (process.env.WORDPRESS_URL || '').trim().replace(/\/$/, ''),
    username: (process.env.WORDPRESS_USERNAME || '').trim(),
    appPassword: (process.env.WORDPRESS_APP_PASSWORD || '').trim()
  };
}

export function isWordPressConfigured() {
  const cfg = _config();
  return Boolean(cfg.url && cfg.username && cfg.appPassword);
}

function _basicAuthHeader(cfg) {
  if (!cfg.username || !cfg.appPassword) return null;
  return `Basic ${Buffer.from(`${cfg.username}:${cfg.appPassword}`).toString('base64')}`;
}

/**
 * Performs an authenticated GET against the WordPress REST API.
 * @param {string} path - path relative to /wp-json/wp/v2/ (e.g. "posts?per_page=10")
 * @param {object} opts - { signal, timeoutMs }
 */
export async function wpGet(path, opts = {}) {
  const cfg = _config();
  if (!cfg.url || !cfg.username || !cfg.appPassword) {
    throw new WordPressIngestError(
      'WORDPRESS_NOT_CONFIGURED',
      'WORDPRESS_URL / WORDPRESS_USERNAME / WORDPRESS_APP_PASSWORD must be set in .env'
    );
  }

  const url = `${cfg.url}/wp-json/wp/v2/${String(path).replace(/^\//, '')}`;
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (opts.signal) {
    opts.signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: _basicAuthHeader(cfg),
        'User-Agent': 'UltimateAI-JINI-News-Ingest/1.0'
      },
      signal: controller.signal
    });

    const text = await response.text();
    let data = null;
    if (text && text.trim()) {
      try { data = JSON.parse(text); } catch { data = null; }
    }

    if (!response.ok) {
      const message = (data && data.message) || `HTTP ${response.status}`;
      throw new WordPressIngestError('WORDPRESS_API_ERROR', `WordPress API error: ${message}`, response.status);
    }

    return {
      data,
      total: parseInt(response.headers.get('X-WP-Total') || '0', 10),
      totalPages: parseInt(response.headers.get('X-WP-TotalPages') || '0', 10)
    };
  } catch (err) {
    if (err instanceof WordPressIngestError) throw err;
    if (err.name === 'AbortError') {
      throw new WordPressIngestError('WORDPRESS_REQUEST_TIMEOUT', 'Request to WordPress timed out.');
    }
    throw new WordPressIngestError('WORDPRESS_REQUEST_FAILED', err.message);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Strips HTML markup from WordPress rendered fields into plain text.
 * Mirrors the sanitization approach of server/tools/WebFetchTool.mjs.
 */
export function htmlToText(html = '') {
  if (!html) return '';
  return String(html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#8217;|&rsquo;/gi, "'")
    .replace(/&#8220;|&ldquo;/gi, '"')
    .replace(/&#8221;|&rdquo;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Neutralizes prompt-injection style content inside ingested articles.
 * The result is still flagged as untrusted when placed into a prompt.
 */
export function neutralizeUntrusted(text = '') {
  return String(text)
    .replace(/ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi, '[neutralized_prompt_injection]')
    .replace(/disregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?)/gi, '[neutralized_prompt_injection]')
    .replace(/you\s+are\s+now\s+/gi, '[neutralized_prompt_injection] ');
}

export default { wpGet, htmlToText, neutralizeUntrusted, isWordPressConfigured, WordPressIngestError };
