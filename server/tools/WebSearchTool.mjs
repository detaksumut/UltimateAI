/**
 * WebSearchTool.mjs (Hardened Edition)
 * Live Multi-Source Web Search Engine with Link Sanitization & Prompt Injection Shields.
 */

import { ToolContract, PERMISSION_LEVELS } from './ToolContract.mjs';

export class WebSearchTool extends ToolContract {
  constructor() {
    super({
      name: 'web.search',
      description: 'Fetches real-time web sources across government, academic, news, and industry portals.',
      inputSchema: { query: 'string', maxResults: 'number' },
      outputSchema: { query: 'string', mode: 'string', sources: 'array', sourcesCount: 'number' },
      permissionLevel: PERMISSION_LEVELS.READ_ONLY,
      timeoutMs: 6000
    });
  }

  async execute({ query, maxResults = 5 }, signal = null) {
    if (!query || !query.trim()) {
      return {
        query: '',
        mode: 'UNAVAILABLE',
        reason: 'QUERY_EMPTY',
        sourcesCount: 0,
        sources: []
      };
    }

    const q = encodeURIComponent(query.trim());
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      // Query DuckDuckGo instant answer & related topics
      const response = await fetch(`https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`, {
        signal: signal || controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          query,
          mode: 'UNAVAILABLE',
          reason: `SEARCH_PROVIDER_HTTP_${response.status}`,
          sourcesCount: 0,
          sources: [],
          latencyMs: Date.now() - startTime
        };
      }

      const data = await response.json();
      const rawTopics = data.RelatedTopics || [];
      const sources = [];

      for (let i = 0; i < rawTopics.length && sources.length < maxResults; i++) {
        const topic = rawTopics[i];
        const rawUrl = topic.FirstURL || '';
        const rawText = topic.Text || '';

        // 1. Link Safety Validation
        const safeUrl = this.sanitizeUrl(rawUrl);
        if (!safeUrl) continue;

        // 2. Untrusted Content Boundary & Prompt Injection Shield
        const sanitizedSnippet = this.sanitizeText(rawText);
        const domain = this.extractDomain(safeUrl);
        const category = this.categorizeDomain(domain, safeUrl);

        sources.push({
          id: `src_${sources.length + 1}`,
          title: sanitizedSnippet.split(' - ')[0] || sanitizedSnippet.substring(0, 40),
          snippet: sanitizedSnippet,
          url: safeUrl,
          domain,
          category, // 'GOVERNMENT' | 'ACADEMIC' | 'NEWS' | 'INDUSTRY' (Domain heuristic)
          originType: 'DOMAIN_HEURISTIC',
          retrievalTimestamp: new Date().toISOString()
        });
      }

      const hasResults = sources.length > 0;
      return {
        query,
        mode: hasResults ? 'LIVE' : 'NO_MATCHES_FOUND',
        searchProvider: 'DuckDuckGo-Instant-API',
        sourcesCount: sources.length,
        sources,
        latencyMs: Date.now() - startTime
      };
    } catch (err) {
      return {
        query,
        mode: 'UNAVAILABLE',
        reason: err.name === 'AbortError' ? 'TIMEOUT' : err.message,
        sourcesCount: 0,
        sources: [],
        latencyMs: Date.now() - startTime
      };
    }
  }

  // Strict URL Sanitization: Only allow http: and https: protocols
  static sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return null;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed.href;
      }
      return null; // Reject javascript:, data:, blob:, file:, etc.
    } catch {
      return null;
    }
  }

  // Untrusted Text Neutralizer: Strips potential prompt injections
  static sanitizeText(text) {
    if (!text || typeof text !== 'string') return '';
    // Strip control characters and neutralize injection markers
    return text
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .replace(/system\s*:/gi, 'system[filtered]:')
      .replace(/ignore\s+previous\s+instructions/gi, '[neutralized_prompt_injection]')
      .substring(0, 500);
  }

  static extractDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return 'web';
    }
  }

  static categorizeDomain(domain, url) {
    const d = (domain + ' ' + url).toLowerCase();
    if (d.includes('.gov') || d.includes('.go.id')) return 'GOVERNMENT';
    if (d.includes('.edu') || d.includes('.ac.id') || d.includes('arxiv') || d.includes('research')) return 'ACADEMIC';
    if (d.includes('news') || d.includes('reuters') || d.includes('techinasia') || d.includes('bbc')) return 'NEWS';
    return 'INDUSTRY';
  }
}

export const webSearchToolInstance = new WebSearchTool();
export default webSearchToolInstance;
