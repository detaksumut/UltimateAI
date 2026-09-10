/**
 * ResearchService.js
 * ═══════════════════════════════════════════════════════════════════════
 * JIN Professional Work System — Research Domain Service
 *
 * Real implementation using:
 *   - Tavily API for web search
 *   - Ollama (qwen3:8b) for analysis & synthesis
 *
 * Task Types:
 *   SEARCH   → Tavily web search
 *   ANALYZE  → LLM analysis of search results
 *   SYNTHESIZE → LLM synthesis into final response
 * ═══════════════════════════════════════════════════════════════════════
 */

class ResearchService {
  constructor(options = {}) {
    this.tavilyApiKey = options.tavilyApiKey || process.env.TAVILY_API_KEY || '';
    this.llmClient = options.llmClient || null;
    this.llmModel = options.llmModel || 'qwen3:8b';
    this.maxSearchResults = options.maxSearchResults || 6;
  }

  /**
   * Generate artifact for a research task
   */
  async generate(task, context) {
    const taskType = (task.type || '').toUpperCase();

    switch (taskType) {
      case 'SEARCH':
        return await this._search(task, context);
      case 'ANALYZE':
        return await this._analyze(task, context);
      case 'SYNTHESIZE':
        return await this._synthesize(task, context);
      default:
        return await this._search(task, context);
    }
  }

  /**
   * Verify artifact
   */
  async verify(artifact, context) {
    if (!artifact || !artifact.content) {
      return { valid: false, reason: 'Empty artifact' };
    }
    if (artifact.content.length < 10) {
      return { valid: false, reason: 'Artifact too short' };
    }
    return { valid: true };
  }

  /**
   * Display artifact (no-op for research)
   */
  async display(artifact, context) {
    // Research artifacts are text, displayed via ConversationCanvas
  }

  /**
   * Commit artifact (no-op for research, already in stream)
   */
  async commit(artifact, context) {
    // Research artifacts are committed by WorkExecutor
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TASK IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * SEARCH: Tavily web search
   */
  async _search(task, context) {
    const query = this._buildSearchQuery(task, context);
    const searchResults = await this._tavilySearch(query);

    const content = this._formatSearchResults(searchResults, query);

    return {
      type: 'MARKDOWN',
      content,
      metadata: {
        taskId: task.id,
        query,
        sourcesCount: searchResults.sources?.length || 0,
        hasAnswer: !!searchResults.answer,
        provider: searchResults.answer ? 'TAVILY_AI' : 'FALLBACK',
      },
    };
  }

  /**
   * ANALYZE: LLM analysis of search results
   */
  async _analyze(task, context) {
    // Get search results from previous task artifact
    const searchArtifact = this._getPreviousArtifact(task, context, 'SEARCH');
    const searchData = searchArtifact?.content || task.description;

    if (!this.llmClient) {
      return {
        type: 'MARKDOWN',
        content: `## Analisis\n\n${searchData}`,
        metadata: { taskId: task.id, mode: 'NO_LLM' },
      };
    }

    const prompt = `Analisis data berikut dan berikan insight penting:\n\n${searchData}\n\nAnalisis:`;

    const response = await this.llmClient.sendChat({
      messages: [
        { role: 'system', content: 'Kamu adalah analis riset. Berikan analisis yang objektif dan berbasis data.' },
        { role: 'user', content: prompt },
      ],
      model: this.llmModel,
      temperature: 0.3,
      stream: false,
    });

    const text = typeof response === 'string' ? response : response?.content || response?.text || '';

    return {
      type: 'MARKDOWN',
      content: `## Analisis\n\n${text}`,
      metadata: { taskId: task.id, model: this.llmModel },
    };
  }

  /**
   * SYNTHESIZE: LLM synthesis into final response
   */
  async _synthesize(task, context) {
    // Get all previous artifacts
    const allArtifacts = this._getAllPreviousArtifacts(task, context);
    const combinedData = allArtifacts.map(a => a.content).join('\n\n---\n\n');

    if (!this.llmClient) {
      return {
        type: 'MARKDOWN',
        content: `## Ringkasan\n\n${combinedData}`,
        metadata: { taskId: task.id, mode: 'NO_LLM' },
      };
    }

    const prompt = `Sintesis data berikut menjadi ringkasan yang komprehensif:\n\n${combinedData}\n\nRingkasan:`;

    const response = await this.llmClient.sendChat({
      messages: [
        { role: 'system', content: 'Kamu adalah penulis ringkasan riset. Buat ringkasan yang jelas, padat, dan akurat.' },
        { role: 'user', content: prompt },
      ],
      model: this.llmModel,
      temperature: 0.3,
      stream: false,
    });

    const text = typeof response === 'string' ? response : response?.content || response?.text || '';

    return {
      type: 'MARKDOWN',
      content: `## Ringkasan\n\n${text}`,
      metadata: { taskId: task.id, model: this.llmModel },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Build search query from task and context
   */
  _buildSearchQuery(task, context) {
    const objective = context?.session?.objective || '';
    const description = task.description || '';

    // Use task description if it's specific, otherwise use objective
    if (description && description !== objective) {
      return description;
    }

    // Extract search terms from objective
    return objective
      .replace(/^(telusuri|cari|riset|research|search|find|lookup|investigate|study)\s*/i, '')
      .trim() || objective;
  }

  /**
   * Call Tavily API
   */
  async _tavilySearch(query) {
    if (!this.tavilyApiKey || this.tavilyApiKey === 'undefined') {
      return { answer: null, sources: [] };
    }

    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.tavilyApiKey,
          query,
          search_depth: 'basic',
          include_answer: true,
          max_results: this.maxSearchResults,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        console.warn(`[ResearchService] Tavily HTTP ${res.status}`);
        return { answer: null, sources: [] };
      }

      const data = await res.json();
      const results = data.results || [];

      const sources = results.map((r, i) => {
        let domain = '';
        try { domain = new URL(r.url).hostname.replace(/^www\./, ''); } catch { domain = ''; }
        return {
          id: `src_${i + 1}`,
          title: r.title || query,
          url: r.url,
          domain,
          snippet: (r.content || '').slice(0, 300),
          score: r.score,
        };
      });

      return {
        answer: data.answer || null,
        sources,
      };
    } catch (err) {
      console.warn(`[ResearchService] Tavily error: ${err.message}`);
      return { answer: null, sources: [] };
    }
  }

  /**
   * Format search results as markdown
   */
  _formatSearchResults(results, query) {
    const lines = [`## Hasil Pencarian: ${query}\n`];

    if (results.answer) {
      lines.push(`**Jawaban Langsung:**\n${results.answer}\n`);
    }

    if (results.sources?.length > 0) {
      lines.push(`**Sumber (${results.sources.length}):**\n`);
      for (const src of results.sources) {
        lines.push(`### ${src.title}`);
        lines.push(`- **Sumber:** [${src.domain}](${src.url})`);
        lines.push(`- **Snippet:** ${src.snippet}`);
        lines.push('');
      }
    } else {
      lines.push('*Tidak ditemukan hasil pencarian.*');
    }

    return lines.join('\n');
  }

  /**
   * Get artifact from previous task
   */
  _getPreviousArtifact(task, context, expectedType) {
    if (!context?.session?.artifacts) return null;

    const taskIdx = context.session.tasks.findIndex(t => t.id === task.id);
    for (let i = taskIdx - 1; i >= 0; i--) {
      const prevTask = context.session.tasks[i];
      const artifact = context.session.artifacts.find(a => a.taskId === prevTask.id);
      if (artifact && (!expectedType || artifact.type === expectedType)) {
        return artifact;
      }
    }

    return null;
  }

  /**
   * Get all artifacts from previous tasks
   */
  _getAllPreviousArtifacts(task, context) {
    if (!context?.session?.artifacts) return [];

    const taskIdx = context.session.tasks.findIndex(t => t.id === task.id);
    const artifacts = [];

    for (let i = 0; i < taskIdx; i++) {
      const prevTask = context.session.tasks[i];
      const artifact = context.session.artifacts.find(a => a.taskId === prevTask.id);
      if (artifact) artifacts.push(artifact);
    }

    return artifacts;
  }
}

export { ResearchService };
export default ResearchService;
