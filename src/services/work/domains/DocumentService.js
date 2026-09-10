/**
 * DocumentService.js
 * ═══════════════════════════════════════════════════════════════════════
 * JIN Professional Work System — Document Domain Service
 *
 * Handles document processing:
 *   - Text extraction and parsing
*   - Document summarization via LLM
 *   - Format conversion (plain text ↔ markdown)
 *   - Document metadata extraction
 *
 * Task Types:
 *   PARSE    → Extract/parse document content
 *   PROCESS  → Process and transform document
 *   OUTPUT   → Generate output document
 * ═══════════════════════════════════════════════════════════════════════
 */

class DocumentService {
  constructor(options = {}) {
    this.llmClient = options.llmClient || null;
    this.llmModel = options.llmModel || 'qwen3:8b';
    this.maxContentLength = options.maxContentLength || 50000;
  }

  /**
   * Generate artifact for a document task
   */
  async generate(task, context) {
    const taskType = (task.type || '').toUpperCase();

    switch (taskType) {
      case 'PARSE':
        return await this._parse(task, context);
      case 'PROCESS':
        return await this._process(task, context);
      case 'OUTPUT':
        return await this._output(task, context);
      default:
        return await this._parse(task, context);
    }
  }

  /**
   * Verify artifact
   */
  async verify(artifact, context) {
    if (!artifact || !artifact.content) {
      return { valid: false, reason: 'Empty artifact' };
    }
    return { valid: true };
  }

  /**
   * Display artifact
   */
  async display(artifact, context) {
    // Document artifacts are displayed via ConversationCanvas
  }

  /**
   * Commit artifact
   */
  async commit(artifact, context) {
    // Document artifacts are committed by WorkExecutor
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TASK IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * PARSE: Extract and parse document content
   */
  async _parse(task, context) {
    const input = this._getInputContent(task, context);

    if (!input) {
      return {
        type: 'MARKDOWN',
        content: `## Dokumen\n\nTidak ada konten dokumen yang ditemukan.`,
        metadata: { taskId: task.id, parsed: false },
      };
    }

    // Extract metadata
    const metadata = this._extractMetadata(input, task);

    // Parse content based on format
    const parsed = this._parseContent(input, metadata.format);

    return {
      type: 'MARKDOWN',
      content: parsed,
      metadata: {
        taskId: task.id,
        parsed: true,
        format: metadata.format,
        wordCount: metadata.wordCount,
        charCount: metadata.charCount,
      },
    };
  }

  /**
   * PROCESS: Process and transform document
   */
  async _process(task, context) {
    const input = this._getInputContent(task, context);

    if (!input) {
      return {
        type: 'MARKDOWN',
        content: `## Proses Dokumen\n\nTidak ada dokumen untuk diproses.`,
        metadata: { taskId: task.id, processed: false },
      };
    }

    if (this.llmClient) {
      return await this._processWithLLM(input, task, context);
    }

    return await this._processWithoutLLM(input, task, context);
  }

  /**
   * OUTPUT: Generate output document
   */
  async _output(task, context) {
    const allArtifacts = this._getAllPreviousArtifacts(task, context);
    const combined = allArtifacts.map(a => a.content).join('\n\n---\n\n');

    if (!combined) {
      return {
        type: 'MARKDOWN',
        content: `## Output Dokumen\n\nTidak ada data untuk dokumen output.`,
        metadata: { taskId: task.id, generated: false },
      };
    }

    if (this.llmClient) {
      return await this._outputWithLLM(combined, task, context);
    }

    return await this._outputWithoutLLM(combined, task, context);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LLM-POWERED PROCESSING
  // ═══════════════════════════════════════════════════════════════════════

  async _processWithLLM(input, task, context) {
    const prompt = `Proses dokumen berikut. Bersihkan, format, dan struktur dengan baik:\n\n${input.slice(0, 8000)}\n\nDokumen yang sudah diproses:`;

    const response = await this.llmClient.sendChat({
      messages: [
        { role: 'system', content: 'Kamu adalah asisten pemrosesan dokumen. Bersihkan dan struktur dokumen dengan baik.' },
        { role: 'user', content: prompt },
      ],
      model: this.llmModel,
      temperature: 0.2,
      stream: false,
    });

    const text = typeof response === 'string' ? response : response?.content || response?.text || '';

    return {
      type: 'MARKDOWN',
      content: `## Dokumen Diproses\n\n${text}`,
      metadata: { taskId: task.id, processed: true, model: this.llmModel },
    };
  }

  async _processWithoutLLM(input, task, context) {
    // Basic processing: clean up whitespace, add structure
    const cleaned = input
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+|\s+$/gm, '')
      .trim();

    const lines = cleaned.split('\n');
    const processed = lines
      .map(line => {
        // Detect headings
        if (/^#{1,6}\s/.test(line)) return line;
        // Detect list items
        if (/^[-*+]\s/.test(line)) return line;
        // Detect numbered lists
        if (/^\d+\.\s/.test(line)) return line;
        // Regular text
        return line;
      })
      .join('\n');

    return {
      type: 'MARKDOWN',
      content: `## Dokumen Diproses\n\n${processed}`,
      metadata: { taskId: task.id, processed: true, mode: 'BASIC' },
    };
  }

  async _outputWithLLM(combined, task, context) {
    const prompt = `Buat dokumen output yang rapi dan terstruktur dari data berikut:\n\n${combined.slice(0, 8000)}\n\nDokumen output:`;

    const response = await this.llmClient.sendChat({
      messages: [
        { role: 'system', content: 'Kamu adalah penulis dokumen profesional. Buat dokumen yang rapi, terstruktur, dan mudah dibaca.' },
        { role: 'user', content: prompt },
      ],
      model: this.llmModel,
      temperature: 0.3,
      stream: false,
    });

    const text = typeof response === 'string' ? response : response?.content || response?.text || '';

    return {
      type: 'MARKDOWN',
      content: text,
      metadata: { taskId: task.id, generated: true, model: this.llmModel },
    };
  }

  async _outputWithoutLLM(combined, task, context) {
    return {
      type: 'MARKDOWN',
      content: `## Dokumen Output\n\n${combined}`,
      metadata: { taskId: task.id, generated: true, mode: 'BASIC' },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get input content from task or previous artifacts
   */
  _getInputContent(task, context) {
    // Check if task has input content
    if (task.input) return task.input;

    // Check previous artifacts
    const prevArtifact = this._getPreviousArtifact(task, context);
    if (prevArtifact) return prevArtifact.content;

    // Check session objective
    if (context?.session?.objective) return context.session.objective;

    return null;
  }

  /**
   * Extract metadata from content
   */
  _extractMetadata(content, task) {
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
    const charCount = content.length;

    // Detect format
    let format = 'PLAIN_TEXT';
    if (/^#{1,6}\s/.test(content) || /\*\*.*\*\*/.test(content) || /\[.*\]\(.*\)/.test(content)) {
      format = 'MARKDOWN';
    }
    if (/<[a-z][\s\S]*>/i.test(content)) {
      format = 'HTML';
    }
    if (content.startsWith('{') || content.startsWith('[')) {
      try {
        JSON.parse(content);
        format = 'JSON';
      } catch {}
    }

    return { format, wordCount, charCount };
  }

  /**
   * Parse content based on format
   */
  _parseContent(content, format) {
    const lines = content.split('\n');
    const parsed = [`**Format:** ${format}`, `**Baris:** ${lines.length}`, ''];

    // Add content with basic formatting
    parsed.push(content);

    return parsed.join('\n');
  }

  /**
   * Get artifact from previous task
   */
  _getPreviousArtifact(task, context) {
    if (!context?.session?.artifacts || !context?.session?.tasks) return null;

    const taskIdx = context.session.tasks.findIndex(t => t.id === task.id);
    for (let i = taskIdx - 1; i >= 0; i--) {
      const prevTask = context.session.tasks[i];
      const artifact = context.session.artifacts.find(a => a.taskId === prevTask.id);
      if (artifact) return artifact;
    }

    return null;
  }

  /**
   * Get all artifacts from previous tasks
   */
  _getAllPreviousArtifacts(task, context) {
    if (!context?.session?.artifacts || !context?.session?.tasks) return [];

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

export { DocumentService };
export default DocumentService;
