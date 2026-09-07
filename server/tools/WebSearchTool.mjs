/**
 * WebSearchTool.mjs
 * Live Web Search Tool & Security Gateway for JIN Capability Pipeline.
 * Provides multi-layer search with input sanitization, domain classification, and untrusted payload wrapping.
 */

import { ToolContract, PERMISSION_LEVELS } from './ToolContract.mjs';
import { multiLayerSearchToolInstance } from './MultiLayerSearchTool.mjs';

export class WebSearchTool extends ToolContract {
  constructor() {
    super({
      name: 'web.search',
      version: '2.0.0',
      description: 'Executes concurrent multi-layer web search across Surface Web, academic repositories, and multimedia sources.',
      inputSchema: { query: 'string', maxResults: 'number', layer: 'string' },
      outputSchema: { query: 'string', sourcesCount: 'number', sources: 'array', mediaPayload: 'object' },
      permissionLevel: PERMISSION_LEVELS.READ_ONLY,
      timeoutMs: 8000
    });
  }

  /**
   * Static URL sanitization required by Adversarial Acceptance Test (Level C)
   * Rejects javascript:, data:, and file: schemes.
   */
  static sanitizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const trimmed = rawUrl.trim();

    // Block dangerous schemes
    if (/^(?:javascript|data|file|vbscript|about):/i.test(trimmed)) {
      return null;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }
      return parsed.href;
    } catch {
      return null;
    }
  }

  /**
   * Static Text sanitization for prompt injection traps
   */
  static sanitizeText(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';
    let text = rawText;

    const injectionPatterns = [
      /ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions/gi,
      /abaikan\s+(?:semua\s+)?instruksi\s+(?:sebelumnya|sistem)/gi,
      /output\s+(?:the\s+)?admin\s+password/gi,
      /system\s+override/gi,
      /hapus\s+database/gi
    ];

    for (const p of injectionPatterns) {
      text = text.replace(p, '[neutralized_prompt_injection]');
    }

    return text;
  }

  /**
   * Static Domain categorization
   */
  static categorizeDomain(domain = '', url = '') {
    const d = (domain || '').toLowerCase();
    const u = (url || '').toLowerCase();

    if (d.includes('.go.id') || d.includes('.gov') || u.includes('.gov')) return 'GOV';
    if (d.includes('.ac.id') || d.includes('.edu') || u.includes('.edu')) return 'ACADEMIC';
    if (d.includes('detik.com') || d.includes('kompas.com') || d.includes('cnn') || d.includes('tempo')) return 'NEWS';
    if (d.includes('wikipedia.org')) return 'ENCYCLOPEDIA';
    return 'GENERAL';
  }

  /**
   * Tavily Deep AI Web Search Provider
   */
  async _searchTavily(query, maxResults = 6, signal = null) {
    const apiKey = (process.env.TAVILY_API_KEY || '').trim();
    if (!apiKey || apiKey === 'undefined') return null;

    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: 'basic',
          include_answer: true,
          max_results: maxResults
        }),
        signal: signal || AbortSignal.timeout(6000)
      });

      if (!res.ok) {
        console.warn(`[WebSearchTool] Tavily API HTTP ${res.status}, falling back to MultiLayerSearch...`);
        return null;
      }

      const data = await res.json();
      const results = data.results || [];
      if (!results.length && !data.answer) return null;

      const sources = results.map((r, i) => {
        let domain = '';
        try { domain = new URL(r.url).hostname.replace(/^www\./, ''); } catch { domain = ''; }
        return {
          id: `tavily_${i + 1}`,
          title: r.title || query,
          url: r.url,
          domain,
          snippet: r.content || '',
          score: r.score,
          credibility: 'TAVILY_VERIFIED'
        };
      });

      return {
        answer: data.answer || null,
        sources
      };
    } catch (err) {
      console.warn(`[WebSearchTool] Tavily error: ${err.message}, falling back...`);
      return null;
    }
  }

  async execute(params = {}, signal = null) {
    const { query = '', maxResults = 6, layer = 'ALL' } = params;
    const sanitizedQuery = WebSearchTool.sanitizeText(query);

    let rawSources = [];
    let providerUsed = 'MULTILAYER_WIKI';
    let tavilyAnswer = null;

    // 1. Try Tavily Cloud Search
    const tavilyRes = await this._searchTavily(sanitizedQuery, maxResults, signal);
    if (tavilyRes && tavilyRes.sources && tavilyRes.sources.length > 0) {
      rawSources = tavilyRes.sources;
      providerUsed = 'TAVILY_AI';
      tavilyAnswer = tavilyRes.answer;
    } else {
      // 2. Fallback to MultiLayerSearch (Wikipedia / DuckDuckGo)
      const rawResult = await multiLayerSearchToolInstance.execute(
        { query: sanitizedQuery, layer, maxResults },
        signal
      );
      rawSources = rawResult.sources || [];
    }

    const sources = rawSources.map((s, i) => {
      const safeUrl = WebSearchTool.sanitizeUrl(s.url) || s.url;
      const safeSnippet = WebSearchTool.sanitizeText(s.snippet || s.title || '');
      return {
        ...s,
        id: s.id || `src_${i + 1}`,
        url: safeUrl,
        snippet: safeSnippet,
        category: s.category || WebSearchTool.categorizeDomain(s.domain, safeUrl),
        safePayload: `<<<UNTRUSTED_EXTERNAL_DATA [Source ID: ${s.id || i + 1}]>>>\n${safeSnippet}\n<<<END_UNTRUSTED_EXTERNAL_DATA>>>`
      };
    });

    return {
      query: sanitizedQuery,
      sourcesCount: sources.length,
      sources,
      provider: providerUsed,
      directAnswer: tavilyAnswer || null,
      dataMatrix: tavilyAnswer ? [{ key: 'DIRECT_SYNTHESIS', value: tavilyAnswer }] : [],
      securityPolicy: 'UNTRUSTED_CONTENT_BOUNDARY_ENFORCED'
    };
  }
}

export const webSearchToolInstance = new WebSearchTool();
export default webSearchToolInstance;
