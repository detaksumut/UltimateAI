/**
 * PPTService.js
 * ═══════════════════════════════════════════════════════════════════════
 * JIN Professional Work System — PowerPoint Domain Service
 *
 * Handles presentation creation:
 *   - PowerPoint generation (requires pptxgenjs)
 *   - Fallback to markdown outline when pptxgenjs unavailable
 *   - LLM-powered slide content
 *
 * Task Types:
 *   OUTLINE  → Create presentation outline
 *   BUILD    → Build PowerPoint file
 *   REVIEW   → Review and polish slides
 *
 * Dependencies:
 *   - pptxgenjs (optional) for actual .pptx generation
 * ═══════════════════════════════════════════════════════════════════════
 */

let pptxgenjs = null;
try {
  pptxgenjs = (await import('pptxgenjs')).default;
} catch {
  // pptxgenjs not available, will use fallback
}

class PPTService {
  constructor(options = {}) {
    this.llmClient = options.llmClient || null;
    this.llmModel = options.llmModel || 'qwen3:8b';
    this.hasPptxGen = !!pptxgenjs;
    this.outputDir = options.outputDir || null;
  }

  /**
   * Generate artifact for a PPT task
   */
  async generate(task, context) {
    const taskType = (task.type || '').toUpperCase();

    switch (taskType) {
      case 'OUTLINE':
        return await this._outline(task, context);
      case 'BUILD':
        return await this._build(task, context);
      case 'REVIEW':
        return await this._review(task, context);
      default:
        return await this._outline(task, context);
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
  async display(artifact, context) {}

  /**
   * Commit artifact
   */
  async commit(artifact, context) {}

  // ═══════════════════════════════════════════════════════════════════════
  // TASK IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * OUTLINE: Create presentation outline
   */
  async _outline(task, context) {
    const topic = this._getTopic(task, context);

    if (this.llmClient) {
      return await this._outlineWithLLM(topic, task);
    }

    return this._outlineWithoutLLM(topic, task);
  }

  /**
   * BUILD: Build PowerPoint file
   */
  async _build(task, context) {
    const outline = this._getPreviousContent(task, context, 'OUTLINE') || this._getTopic(task, context);

    if (this.hasPptxGen) {
      return await this._buildWithPptxGen(outline, task);
    }

    return await this._buildFallback(outline, task);
  }

  /**
   * REVIEW: Review and polish slides
   */
  async _review(task, context) {
    const slides = this._getPreviousContent(task, context, 'BUILD') || this._getPreviousContent(task, context);

    if (this.llmClient) {
      return await this._reviewWithLLM(slides, task);
    }

    return {
      type: 'MARKDOWN',
      content: `## Review Presentasi\n\n${slides}\n\n**Status:** Review selesai (mode basic)`,
      metadata: { taskId: task.id, phase: 'REVIEW', mode: 'BASIC' },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LLM-POWERED GENERATION
  // ═══════════════════════════════════════════════════════════════════════

  async _outlineWithLLM(topic, task) {
    const prompt = `Buat outline presentasi tentang: "${topic}"\n\nFormat per slide:\nSlide 1: Judul\nSlide 2: Pendahuluan\nSlide 3-N: Isi utama\nSlide Terakhir: Kesimpulan\n\nUntuk setiap slide, berikan:\n- Judul slide\n- 3-5 poin utama\n- Catatan pembicara (opsional)`;

    const response = await this.llmClient.sendChat({
      messages: [
        { role: 'system', content: 'Kamu adalah desainer presentasi profesional. Buat outline yang terstruktur dan efektif.' },
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

  async _reviewWithLLM(slides, task) {
    const prompt = `Review dan perbaiki presentasi berikut:\n\n${slides}\n\nBerikan saran perbaikan untuk:\n1. Alur konten\n2. Kejelasan pesan\n3. Konsistensi format`;

    const response = await this.llmClient.sendChat({
      messages: [
        { role: 'system', content: 'Kamu adalah reviewer presentasi senior. Berikan feedback yang konstruktif.' },
        { role: 'user', content: prompt },
      ],
      model: this.llmModel,
      temperature: 0.3,
      stream: false,
    });

    const text = typeof response === 'string' ? response : response?.content || response?.text || '';

    return {
      type: 'MARKDOWN',
      content: `## Review Presentasi\n\n### Hasil Review:\n${text}\n\n### Asli:\n${slides}`,
      metadata: { taskId: task.id, phase: 'REVIEW', model: this.llmModel },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BASIC GENERATION (NO LLM)
  // ═══════════════════════════════════════════════════════════════════════

  _outlineWithoutLLM(topic, task) {
    return {
      type: 'MARKDOWN',
      content: `# ${topic}\n\n## Slide 1: Judul\n- ${topic}\n- Subjudul\n\n## Slide 2: Pendahuluan\n- Latar belakang\n- Tujuan\n\n## Slide 3: Isi Utama\n- Poin pertama\n- Poin kedua\n- Poin ketiga\n\n## Slide 4: Kesimpulan\n- Ringkasan\n- Q&A`,
      metadata: { taskId: task.id, phase: 'OUTLINE', mode: 'TEMPLATE' },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // POWERPOINT GENERATION
  // ═══════════════════════════════════════════════════════════════════════

  async _buildWithPptxGen(outline, task) {
    const pptx = new pptxgenjs();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'JIN Professional Work System';
    pptx.title = this._extractTitle(outline);

    // Parse outline into slides
    const slides = this._parseOutlineToSlides(outline);

    for (const slide of slides) {
      const pptSlide = pptx.addSlide();

      // Title
      pptSlide.addText(slide.title, {
        x: 0.5,
        y: 0.3,
        w: '90%',
        fontSize: 24,
        bold: true,
        color: '1a1a2e',
      });

      // Content bullets
      if (slide.bullets.length > 0) {
        pptSlide.addText(
          slide.bullets.map(b => ({ text: b, options: { bullet: true, breakType: 'none' } })),
          {
            x: 0.7,
            y: 1.2,
            w: '85%',
            fontSize: 16,
            color: '333333',
            lineSpacing: 24,
          }
        );
      }
    }

    // Generate base64
    const base64 = await pptx.write({ outputType: 'base64' });

    return {
      type: 'PPTX_BASE64',
      content: base64,
      metadata: {
        taskId: task.id,
        phase: 'BUILD',
        slideCount: slides.length,
        format: 'pptx',
        generator: 'pptxgenjs',
      },
    };
  }

  async _buildFallback(outline, task) {
    const slides = this._parseOutlineToSlides(outline);
    const svgSlides = slides.map((slide, idx) => this._renderSlideSVG(slide, idx + 1, slides.length));

    return {
      type: 'PPT_SLIDES',
      content: svgSlides.map(s => s.svg).join('\n'),
      metadata: {
        taskId: task.id,
        phase: 'BUILD',
        slideCount: slides.length,
        format: 'svg_slides',
        generator: 'svg_renderer',
        slides: svgSlides.map(s => ({ title: s.title, svg: s.svg })),
      },
    };
  }

  _renderSlideSVG(slide, slideNum, totalSlides) {
    const bullets = slide.bullets.slice(0, 6).map((b, i) => {
      const y = 120 + i * 45;
      const truncated = b.length > 80 ? b.slice(0, 77) + '...' : b;
      return `<text x="60" y="${y}" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#e0e0e0">• ${this._escapeXML(truncated)}</text>`;
    }).join('\n    ');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="bg${slideNum}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a1a"/>
      <stop offset="100%" style="stop-color:#1a1a3e"/>
    </linearGradient>
    <linearGradient id="accent${slideNum}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#00d4ff"/>
      <stop offset="100%" style="stop-color:#7b2ff7"/>
    </linearGradient>
  </defs>
  <rect width="960" height="540" fill="url(#bg${slideNum})" rx="8"/>
  <rect x="0" y="0" width="960" height="4" fill="url(#accent${slideNum})"/>
  <rect x="40" y="30" width="4" height="60" fill="#00d4ff" rx="2"/>
  <text x="56" y="72" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="bold" fill="#ffffff">${this._escapeXML(slide.title)}</text>
  <line x1="40" y1="100" x2="920" y2="100" stroke="#333" stroke-width="1"/>
  ${bullets}
  <text x="480" y="510" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#666" text-anchor="middle">${slideNum} / ${totalSlides}</text>
  <text x="40" y="510" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="#00d4ff">JIN Professional Work System</text>
</svg>`;

    return { title: slide.title, svg };
  }

  _escapeXML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  _getTopic(task, context) {
    if (task.input) return task.input;
    if (task.description) return task.description;
    return context?.session?.objective || 'Presentasi Umum';
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

  _extractTitle(outline) {
    const firstLine = outline.split('\n').find(l => l.trim().length > 0) || '';
    return firstLine.replace(/^#+\s*/, '').trim() || 'Presentasi';
  }

  _parseOutlineToSlides(outline) {
    const slides = [];
    let currentSlide = null;

    for (const line of outline.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // New slide header (## or Slide N:)
      if (/^#{2,}\s/.test(trimmed) || /^Slide\s+\d+/i.test(trimmed)) {
        if (currentSlide) slides.push(currentSlide);
        currentSlide = {
          title: trimmed.replace(/^#+\s*/, '').replace(/^Slide\s+\d+:\s*/i, ''),
          bullets: [],
        };
      }
      // Bullet point
      else if (/^[-*•]\s/.test(trimmed)) {
        if (currentSlide) {
          currentSlide.bullets.push(trimmed.replace(/^[-*•]\s/, ''));
        }
      }
      // Numbered item
      else if (/^\d+\.\s/.test(trimmed)) {
        if (currentSlide) {
          currentSlide.bullets.push(trimmed.replace(/^\d+\.\s/, ''));
        }
      }
      // First line becomes title if no slide yet
      else if (!currentSlide) {
        currentSlide = { title: trimmed, bullets: [] };
      }
    }

    if (currentSlide) slides.push(currentSlide);

    // Ensure at least one slide
    if (slides.length === 0) {
      slides.push({ title: this._extractTitle(outline), bullets: [] });
    }

    return slides;
  }
}

export { PPTService };
export default PPTService;
