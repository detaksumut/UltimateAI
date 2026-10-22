/**
 * WebFetchTool.mjs
 * Live URL & Web Data Ingestion Tool for JIN Capability Pipeline.
 * Enforces protocol isolation, SSRF prevention, HTML sanitization, and prompt-injection neutralization.
 */

import { ToolContract, PERMISSION_LEVELS } from './ToolContract.mjs';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';


const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);
const REDIRECT_LIMIT = 5;

function ipv4ToNumber(address) {
  const parts = address.split('.');
  if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return null;
  return parts.reduce((value, part) => ((value * 256) + Number(part)) >>> 0, 0) >>> 0;
}

function isPublicIPv4(address) {
  const value = ipv4ToNumber(address);
  if (value === null) return false;
  const inRange = (base, prefix) => {
    const start = ipv4ToNumber(base);
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return ((value & mask) >>> 0) === ((start & mask) >>> 0);
  };
  const forbidden = [
    ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
    ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
    ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
    ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
  ];
  return !forbidden.some(([base, prefix]) => inRange(base, prefix));
}

function isPublicIPv6(address) {
  const normalized = address.toLowerCase().split('%')[0];
  // IPv4-mapped IPv6 forms are not accepted here; use a public IPv4 URL instead.
  if (normalized.startsWith('::ffff:')) return false;
  const first = Number.parseInt(normalized.split(':')[0] || '0', 16);
  // Global unicast allocation is within 2000::/3. Exclude documentation space.
  if (!Number.isFinite(first) || first < 0x2000 || first > 0x3fff) return false;
  if (normalized.startsWith('2001:db8:') || normalized === '2001:db8::') return false;
  return true;
}

function isPublicAddress(address) {
  const version = isIP(address);
  if (version === 4) return isPublicIPv4(address);
  if (version === 6) return isPublicIPv6(address);
  return false;
}

async function validatePublicHttpUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('INVALID_URL: URL tidak dapat diparsing.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('INVALID_PROTOCOL: Hanya HTTP dan HTTPS yang diperbolehkan.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('INVALID_URL_CREDENTIALS: URL dengan kredensial tertanam ditolak.');
  }
  if (parsed.port && !['80', '443'].includes(parsed.port)) {
    throw new Error('INVALID_PORT: Hanya port web standar 80/443 yang diperbolehkan.');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal' ||
    hostname === 'metadata' ||
    hostname === 'host.docker.internal'
  ) {
    throw new Error('SSRF_BLOCKED: Host lokal, internal, atau metadata tidak boleh diakses.');
  }

  const literalVersion = isIP(hostname);
  if (literalVersion) {
    if (!isPublicAddress(hostname)) {
      throw new Error('SSRF_BLOCKED: IP privat, lokal, atau reserved ditolak.');
    }
  } else {
    let addresses;
    try {
      addresses = await Promise.race([
        lookup(hostname, { all: true, verbatim: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DNS_LOOKUP_TIMEOUT')), 1800))
      ]);
    } catch {
      throw new Error('DNS_VALIDATION_FAILED: Host tidak dapat divalidasi dengan aman.');
    }
    if (!Array.isArray(addresses) || addresses.length === 0 || addresses.some(entry => !isPublicAddress(entry.address))) {
      throw new Error('SSRF_BLOCKED: Host mengarah ke IP privat, lokal, atau reserved.');
    }
  }

  parsed.hash = '';
  return parsed;
}

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

    const fetchedAt = new Date().toISOString();
    const sourceId = 'web_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('FETCH_TIMEOUT')), 8000);
    const onAbort = () => controller.abort(signal?.reason || new Error('FETCH_ABORTED'));
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      let currentUrl = await validatePublicHttpUrl(url);
      let response = null;

      // Validate every redirect target independently. Automatic redirects are
      // disabled so a public URL cannot redirect into localhost/private services.
      for (let hop = 0; hop <= REDIRECT_LIMIT; hop++) {
        response = await fetch(currentUrl.href, {
          redirect: 'manual',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) UltimateAI-JIN-Agent/2.0',
            'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9'
          },
          signal: controller.signal
        });

        const location = response.headers.get('location');
        if (!REDIRECT_CODES.has(response.status) || !location) break;
        if (hop === REDIRECT_LIMIT) {
          await response.body?.cancel().catch(() => {});
          throw new Error('REDIRECT_LIMIT_EXCEEDED: Terlalu banyak pengalihan URL.');
        }

        const redirectUrl = new URL(location, currentUrl);
        await response.body?.cancel().catch(() => {});
        currentUrl = await validatePublicHttpUrl(redirectUrl.href);
      }

      if (!response) throw new Error('FETCH_FAILED: Server tidak mengembalikan respons.');
      const status = response.status;
      const contentType = response.headers.get('content-type') || '';
      const rawBody = await response.text();

      const headingMatches = [...rawBody.matchAll(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi)];
      const headings = headingMatches.map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);

      const linkMatches = [...rawBody.matchAll(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi)];
      const links = linkMatches
        .map(m => m[2])
        .filter(href => href && !href.startsWith('#') && !/^(?:javascript|data|file|vbscript):/i.test(href));

      let textContent = rawBody;
      if (contentType.includes('html') || rawBody.includes('<html') || rawBody.includes('<body')) {
        textContent = rawBody
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      const sanitizedText = this._sanitizeContent(textContent);
      const finalUrl = currentUrl.href;

      return {
        sourceId,
        url: (await validatePublicHttpUrl(url)).href,
        finalUrl,
        status,
        fetchedAt,
        title: (rawBody.match(/<title[^>]*>(.*?)<\/title>/i) || [])[1] || currentUrl.hostname,
        text: sanitizedText,
        links: links.slice(0, 30),
        headings: headings.slice(0, 15),
        safePayload: '<<<UNTRUSTED_WEB_DATA [Source: ' + finalUrl + ']>>>\n' +
          sanitizedText.slice(0, 6000) + '\n<<<END_UNTRUSTED_WEB_DATA>>>'
      };
    } catch (err) {
      if (err?.name === 'AbortError' || controller.signal.aborted || err?.message === 'FETCH_TIMEOUT') {
        throw new Error('FETCH_TIMEOUT: Request to "' + url + '" timed out or was aborted.');
      }
      throw err;
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  }
}

export const webFetchToolInstance = new WebFetchTool();
export default webFetchToolInstance;
