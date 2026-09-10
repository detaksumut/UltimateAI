/**
 * ContentService.js
 * ═══════════════════════════════════════════════════════════════════════
 * JIN Professional Work System — Content Domain Service
 *
 * Handles content creation:
 *   - Articles, blog posts, social media content
 *   - Outlines, drafts, refinements
 *   - LLM-powered content generation
 *
 * Task Types:
 *   OUTLINE  → Create content outline
 *   DRAFT    → Draft content
 *   REFINE   → Refine and finalize
 * ═══════════════════════════════════════════════════════════════════════
 */

class ContentService {
  constructor(options = {}) {
    this.llmClient = options.llmClient || null;
    this.llmModel = options.llmModel || 'qwen3:8b';
    this.tone = options.tone || 'professional';
  }

  /**
   * Generate artifact for a content task
   */
  async generate(task, context) {
    const taskType = (task.type || '').toUpperCase();

    switch (taskType) {
      case 'OUTLINE':
        return await this._outline(task, context);
      case 'DRAFT':
        return await this._draft(task, context);
      case 'REFINE':
        return await this._refine(task, context);
      default:
        return await this._draft(task, context);
    }
  }

  /**
   * Verify artifact
   */
  async verify(artifact, context) {
    if (!artifact || !artifact.content) {
      return { valid: false, reason: 'Empty artifact' };
    }
    if (artifact.content.length < 20) {
      return { valid: false, reason: 'Content too short for meaningful output' };
    }
    return { valid: true };
  }

  /**
   * Display artifact
   */
  async display(artifact, context) {}

  /**
   * Commit artifact
   */
  async commit(artifact, context) {}

  // ═══════════════════════════════════════════════════════════════════════
  // TASK IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * OUTLINE: Create content outline
   */
  async _outline(task, context) {
    const topic = this._getTopic(task, context);

    if (this.llmClient) {
      return await this._outlineWithLLM(topic, task);
    }

    return this._outlineWithoutLLM(topic, task);
  }

  /**
   * DRAFT: Draft content
   */
  async _draft(task, context) {
    const topic = this._getTopic(task, context);
    const outline = this._getPreviousContent(task, context, 'OUTLINE');

    if (this.llmClient) {
      return await this._draftWithLLM(topic, outline, task);
    }

    return this._draftWithoutLLM(topic, task);
  }

  /**
   * REFINE: Refine and finalize
   */
  async _refine(task, context) {
    const draft = this._getPreviousContent(task, context, 'DRAFT') || this._getPreviousContent(task, context);

    if (this.llmClient) {
      return await this._refineWithLLM(draft, task);
    }

    return this._refineWithoutLLM(draft, task);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LLM-POWERED GENERATION
  // ═══════════════════════════════════════════════════════════════════════

  async _outlineWithLLM(topic, task) {
    const prompt = `Buat outline untuk artikel tentang: "${topic}"\n\nFormat:\n# Judul\n## Sub Judul 1\n- Poin 1\n- Poin 2\n## Sub Judul 2\n...`;

    const response = await this.llmClient.sendChat({
      messages: [
        { role: 'system', content: `Kamu adalah penulis konten ${this.tone}. Buat outline yang terstruktur dan menarik.` },
        { role: 'user', content: prompt },
      ],
      model: this.llmModel,
      temperature: 0.4,
      stream: false,
    });

    const text = typeof response === 'string' ? response : response?.content || response?.text || '';

    return {
      type: 'MARKDOWN',
      content: text,
      metadata: { taskId: task.id, phase: 'OUTLINE', model: this.llmModel },
    };
  }

  async _draftWithLLM(topic, outline, task) {
    let prompt = `Buat artikel tentang: "${topic}"`;
    if (outline) {
      prompt += `\n\nGunakan outline berikut:\n${outline}`;
    }
    prompt += `\n\nTulis artikel yang lengkap, informatif, dan ${this.tone}.`;

    const response = await this.llmClient.sendChat({
      messages: [
        { role: 'system', content: `Kamu adalah penulis konten ${this.tone} dan berpengalaman.` },
        { role: 'user', content: prompt },
      ],
      model: this.llmModel,
      temperature: 0.5,
      stream: false,
    });

    const text = typeof response === 'string' ? response : response?.content || response?.text || '';

    return {
      type: 'MARKDOWN',
      content: text,
      metadata: { taskId: task.id, phase: 'DRAFT', model: this.llmModel },
    };
  }

  async _refineWithLLM(draft, task) {
    const prompt = `Perbaiki dan sempurnakan artikel berikut:\n\n${draft}\n\nArtikel yang sudah diperbaiki:`;

    const response = await this.llmClient.sendChat({
      messages: [
        { role: 'system', content: `Kamu adalah editor konten ${this.tone}. Perbaiki tata bahasa, struktur, dan alur konten.` },
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
      metadata: { taskId: task.id, phase: 'REFINE', model: this.llmModel },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BASIC GENERATION (NO LLM)
  // ═══════════════════════════════════════════════════════════════════════

  _outlineWithoutLLM(topic, task) {
    return {
      type: 'MARKDOWN',
      content: `# Outline: ${topic}\n\n## Pendahuluan\n- Pengenalan topik\n- Pentingnya topik\n\n## Isi Utama\n- Poin pertama\n- Poin kedua\n- Poin ketiga\n\n## Kesimpulan\n- Ringkasan\n- Rekomendasi`,
      metadata: { taskId: task.id, phase: 'OUTLINE', mode: 'TEMPLATE' },
    };
  }

  _draftWithoutLLM(topic, task) {
    return {
      type: 'MARKDOWN',
      content: `# ${topic}\n\n## Pendahuluan\n\n[Draft konten untuk topik: ${topic}]\n\n## Isi Utama\n\n[Bagian ini akan diisi dengan konten detail.]\n\n## Kesimpulan\n\n[Ringkasan dan penutup.]`,
      metadata: { taskId: task.id, phase: 'DRAFT', mode: 'TEMPLATE' },
    };
  }

  _refineWithoutLLM(draft, task) {
    const refined = draft
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+|\s+$/gm, '')
      .trim();

    return {
      type: 'MARKDOWN',
      content: refined,
      metadata: { taskId: task.id, phase: 'REFINE', mode: 'BASIC_CLEANUP' },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  _getTopic(task, context) {
    if (task.input) return task.input;
    if (task.description) return task.description;
    return context?.session?.objective || 'Topik Umum';
  }

  _getPreviousContent(task, context, expectedPhase) {
    if (!context?.session?.artifacts || !context?.session?.tasks) return null;

    const taskIdx = context.session.tasks.findIndex(t => t.id === task.id);
    for (let i = taskIdx - 1; i >= 0; i--) {
      const prevTask = context.session.tasks[i];
      const artifact = context.session.artifacts.find(a => a.taskId === prevTask.id);
      if (artifact && (!expectedPhase || artifact.metadata?.phase === expectedPhase)) {
        return artifact.content;
      }
    }
    return null;
  }
}

export { ContentService };
export default ContentService;
