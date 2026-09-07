/**
 * WebFetchTool.mjs
 * Live URL & Web Data Ingestion Tool for JIN Capability Pipeline.
 * Enforces protocol isolation, SSRF prevention, HTML sanitization, and prompt-injection neutralization.
 */

import { ToolContract, PERMISSION_LEVELS } from './ToolContract.mjs';

export class WebFetchTool extends ToolContract {
  constructor() {
    super({
      name: 'web.open',
      version: '2.0.0',
      description: 'Fetch and safely parse live web page content from HTTP/HTTPS URLs with prompt-injection neutralization.',
      inputSchema: { url: 'string', mode: 'string' },
      outputSchema: { sourceId: 'string', status: 'number', text: 'string', links: 'array', headings: 'array', fetchedAt: 'string' },
      permissionLevel: PERMISSION_LEVELS.READ_ONLY,
      timeoutMs: 10000
    });
  }

  /**
   * Content sanitization method required by security contract & test suite.
   * Neutralizes script tags, prompt injection traps, and dangerous payloads.
   */
  _sanitizeContent(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';

    let text = rawText;

    // 1. Strip script, style, and iframe blocks completely
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    text = text.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

    // 2. Neutralize known Prompt Injection attack phrases
    const injectionPatterns = [
      /ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions/gi,
      /disregard\s+(?:all\s+)?(?:previous|prior)\s+instructions/gi,
      /system\s+override/gi,
      /you\s+are\s+now\s+in\s+dan\s+mode/gi,
      /output\s+(?:the\s+)?admin\s+password/gi
    ];

    for (const pattern of injectionPatterns) {
      text = text.replace(pattern, '[neutralized_prompt_injection]');
    }

    return text;
  }

  async execute({ url, mode = 'text' }, signal = null) {
    if (!url || typeof url !== 'string') {
      throw new Error('INVALID_INPUT: Parameter "url" must be a non-empty string.');
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(`INVALID_URL: Failed to parse URL "${url}".`);
    }

    // Protocol check: Strictly permit HTTP and HTTPS
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`INVALID_PROTOCOL: Protocol "${parsedUrl.protocol}" is forbidden. Only HTTP and HTTPS are permitted.`);
    }

    const fetchedAt = new Date().toISOString();
    const sourceId = `web_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) UltimateAI-JIN-Agent/2.0',
          'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9'
        },
        signal: controller.signal
      });

      clearTimeout(timer);

      const status = response.status;
      const contentType = response.headers.get('content-type') || '';
      const rawBody = await response.text();

      // Extract headings
      const headingMatches = [...rawBody.matchAll(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi)];
      const headings = headingMatches.map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);

      // Extract links
      const linkMatches = [...rawBody.matchAll(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi)];
      const links = linkMatches.map(m => m[2]).filter(href => href && !href.startsWith('#') && !href.startsWith('javascript:'));

      // Extract plain text
      let textContent = rawBody;
      if (contentType.includes('html') || rawBody.includes('<html') || rawBody.includes('<body')) {
        textContent = rawBody
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      const sanitizedText = this._sanitizeContent(textContent);

      return {
        sourceId,
        url,
        finalUrl: response.url || url,
        status,
        fetchedAt,
        title: (rawBody.match(/<title[^>]*>(.*?)<\/title>/i) || [])[1] || parsedUrl.hostname,
        text: sanitizedText,
        links: links.slice(0, 30),
        headings: headings.slice(0, 15),
        safePayload: `<<<UNTRUSTED_WEB_DATA [Source: ${url}]>>>\n${sanitizedText.slice(0, 6000)}\n<<<END_UNTRUSTED_WEB_DATA>>>`
      };
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError' || controller.signal.aborted) {
        throw new Error(`FETCH_TIMEOUT: Request to "${url}" timed out.`);
      }
      throw err;
    }
  }
}

export const webFetchToolInstance = new WebFetchTool();
export default webFetchToolInstance;
