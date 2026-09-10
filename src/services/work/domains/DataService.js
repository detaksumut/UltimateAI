/**
 * DataService.js
 * ═══════════════════════════════════════════════════════════════════════
 * JIN Professional Work System — Data Domain Service
 *
 * Handles data processing and analysis:
 *   - Data collection and aggregation
 *   - Data transformation and cleaning
 *   - SVG chart generation (bar, line, pie)
 *   - Statistical analysis via LLM
 *
 * Task Types:
 *   COLLECT     → Collect and aggregate data
 *   TRANSFORM   → Clean and transform data
 *   VISUALIZE   → Generate visualizations
 * ═══════════════════════════════════════════════════════════════════════
 */

class DataService {
  constructor(options = {}) {
    this.llmClient = options.llmClient || null;
    this.llmModel = options.llmModel || 'qwen3:8b';
    this.chartWidth = options.chartWidth || 600;
    this.chartHeight = options.chartHeight || 400;
  }

  /**
   * Generate artifact for a data task
   */
  async generate(task, context) {
    const taskType = (task.type || '').toUpperCase();

    switch (taskType) {
      case 'COLLECT':
        return await this._collect(task, context);
      case 'TRANSFORM':
        return await this._transform(task, context);
      case 'VISUALIZE':
        return await this._visualize(task, context);
      default:
        return await this._collect(task, context);
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
   * COLLECT: Collect and aggregate data
   */
  async _collect(task, context) {
    const topic = this._getTopic(task, context);

    if (this.llmClient) {
      return await this._collectWithLLM(topic, task);
    }

    return this._collectWithoutLLM(topic, task);
  }

  /**
   * TRANSFORM: Clean and transform data
   */
  async _transform(task, context) {
    const prevContent = this._getPreviousContent(task, context);

    if (this.llmClient) {
      return await this._transformWithLLM(prevContent, task);
    }

    return this._transformWithoutLLM(prevContent, task);
  }

  /**
   * VISUALIZE: Generate visualizations
   */
  async _visualize(task, context) {
    const prevContent = this._getPreviousContent(task, context);
    const chartType = this._detectChartType(task, context);

    if (this.llmClient) {
      return await this._visualizeWithLLM(prevContent, chartType, task);
    }

    return this._visualizeWithoutLLM(prevContent, chartType, task);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LLM-POWERED PROCESSING
  // ═══════════════════════════════════════════════════════════════════════

  async _collectWithLLM(topic, task) {
    const prompt = `Kumpulkan dan struktur data tentang: "${topic}"\n\nFormat dalam JSON:\n{\n  "topic": "...",\n  "dataPoints": [\n    { "label": "...", "value": number, "category": "..." }\n  ],\n  "summary": "..." \n}`;

    const response = await this.llmClient.sendChat({
      messages: [
        { role: 'system', content: 'Kamu adalah analis data. Kumpulkan data dalam format terstruktur.' },
        { role: 'user', content: prompt },
      ],
      model: this.llmModel,
      temperature: 0.3,
      stream: false,
    });

    const text = typeof response === 'string' ? response : response?.content || response?.text || '';

    return {
      type: 'JSON',
      content: text,
      metadata: { taskId: task.id, phase: 'COLLECT', model: this.llmModel },
    };
  }

  async _transformWithLLM(content, task) {
    const prompt = `Transform dan bersihkan data berikut:\n\n${content?.slice(0, 5000) || 'Tidak ada data'}\n\nData yang sudah dibersihkan:`;

    const response = await this.llmClient.sendChat({
      messages: [
        { role: 'system', content: 'Kamu adalah engineer data. Bersihkan dan struktur data dengan baik.' },
        { role: 'user', content: prompt },
      ],
      model: this.llmModel,
      temperature: 0.2,
      stream: false,
    });

    const text = typeof response === 'string' ? response : response?.content || response?.text || '';

    return {
      type: 'JSON',
      content: text,
      metadata: { taskId: task.id, phase: 'TRANSFORM', model: this.llmModel },
    };
  }

  async _visualizeWithLLM(content, chartType, task) {
    const prompt = `Buat visualisasi data dalam format SVG ${chartType} chart dari data berikut:\n\n${content?.slice(0, 3000) || 'Tidak ada data'}\n\nBuat SVG yang valid dengan warna yang menarik.`;

    const response = await this.llmClient.sendChat({
      messages: [
        { role: 'system', content: 'Kamu adalah visualisasi data. Buat SVG chart yang valid dan menarik.' },
        { role: 'user', content: prompt },
      ],
      model: this.llmModel,
      temperature: 0.4,
      stream: false,
    });

    const text = typeof response === 'string' ? response : response?.content || response?.text || '';

    return {
      type: 'SVG_VECTOR',
      content: text,
      metadata: { taskId: task.id, phase: 'VISUALIZE', chartType, model: this.llmModel },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BASIC GENERATION (NO LLM)
  // ═══════════════════════════════════════════════════════════════════════

  _collectWithoutLLM(topic, task) {
    return {
      type: 'JSON',
      content: JSON.stringify({
        topic,
        dataPoints: [
          { label: 'Sample 1', value: 10, category: 'A' },
          { label: 'Sample 2', value: 20, category: 'B' },
          { label: 'Sample 3', value: 15, category: 'A' },
        ],
        summary: `Data sample untuk topik: ${topic}`,
      }, null, 2),
      metadata: { taskId: task.id, phase: 'COLLECT', mode: 'SAMPLE' },
    };
  }

  _transformWithoutLLM(content, task) {
    let data;
    try {
      data = JSON.parse(content);
    } catch {
      data = { raw: content, transformed: true };
    }

    return {
      type: 'JSON',
      content: JSON.stringify(data, null, 2),
      metadata: { taskId: task.id, phase: 'TRANSFORM', mode: 'BASIC' },
    };
  }

  _visualizeWithoutLLM(content, chartType, task) {
    let data;
    try {
      data = JSON.parse(content);
    } catch {
      data = { dataPoints: [{ label: 'A', value: 10 }, { label: 'B', value: 20 }] };
    }

    const svg = this._generateSVGChart(data, chartType);

    return {
      type: 'SVG_VECTOR',
      content: svg,
      metadata: { taskId: task.id, phase: 'VISUALIZE', chartType, mode: 'BASIC_SVG' },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SVG CHART GENERATION
  // ═══════════════════════════════════════════════════════════════════════

  _generateSVGChart(data, chartType) {
    const points = data.dataPoints || [];
    if (points.length === 0) {
      return this._emptyChart();
    }

    switch (chartType) {
      case 'bar':
        return this._barChart(points, data.topic);
      case 'line':
        return this._lineChart(points, data.topic);
      case 'pie':
        return this._pieChart(points, data.topic);
      default:
        return this._barChart(points, data.topic);
    }
  }

  _barChart(points, title = '') {
    const w = this.chartWidth;
    const h = this.chartHeight;
    const padding = 50;
    const barWidth = Math.max(20, (w - padding * 2) / points.length - 10);
    const maxVal = Math.max(...points.map(p => p.value), 1);

    const colors = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948'];

    let bars = '';
    points.forEach((p, i) => {
      const barH = (p.value / maxVal) * (h - padding * 2);
      const x = padding + i * (barWidth + 10);
      const y = h - padding - barH;
      const color = colors[i % colors.length];

      bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="${color}" rx="3"/>`;
      bars += `<text x="${x + barWidth / 2}" y="${h - padding + 15}" text-anchor="middle" font-size="11" fill="#666">${p.label}</text>`;
      bars += `<text x="${x + barWidth / 2}" y="${y - 5}" text-anchor="middle" font-size="11" fill="#333">${p.value}</text>`;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#fafafa" rx="8"/>
  <text x="${w / 2}" y="25" text-anchor="middle" font-size="14" font-weight="bold" fill="#333">${title || 'Bar Chart'}</text>
  <line x1="${padding}" y1="${h - padding}" x2="${w - padding}" y2="${h - padding}" stroke="#ccc" stroke-width="1"/>
  ${bars}
</svg>`;
  }

  _lineChart(points, title = '') {
    const w = this.chartWidth;
    const h = this.chartHeight;
    const padding = 50;
    const maxVal = Math.max(...points.map(p => p.value), 1);
    const stepX = (w - padding * 2) / Math.max(points.length - 1, 1);

    let pathD = '';
    let dots = '';
    points.forEach((p, i) => {
      const x = padding + i * stepX;
      const y = h - padding - (p.value / maxVal) * (h - padding * 2);
      pathD += (i === 0 ? 'M' : 'L') + ` ${x} ${y}`;
      dots += `<circle cx="${x}" cy="${y}" r="4" fill="#4e79a7"/>`;
      dots += `<text x="${x}" y="${h - padding + 15}" text-anchor="middle" font-size="11" fill="#666">${p.label}</text>`;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#fafafa" rx="8"/>
  <text x="${w / 2}" y="25" text-anchor="middle" font-size="14" font-weight="bold" fill="#333">${title || 'Line Chart'}</text>
  <line x1="${padding}" y1="${h - padding}" x2="${w - padding}" y2="${h - padding}" stroke="#ccc" stroke-width="1"/>
  <path d="${pathD}" fill="none" stroke="#4e79a7" stroke-width="2"/>
  ${dots}
</svg>`;
  }

  _pieChart(points, title = '') {
    const w = this.chartWidth;
    const h = this.chartHeight;
    const cx = w / 2;
    const cy = h / 2 + 10;
    const r = Math.min(w, h) / 2 - 60;
    const total = points.reduce((s, p) => s + p.value, 0) || 1;

    const colors = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948'];
    let startAngle = -Math.PI / 2;
    let slices = '';

    points.forEach((p, i) => {
      const sliceAngle = (p.value / total) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;
      const largeArc = sliceAngle > Math.PI ? 1 : 0;

      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);

      slices += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${colors[i % colors.length]}" stroke="#fff" stroke-width="2"/>`;

      const midAngle = startAngle + sliceAngle / 2;
      const labelR = r * 0.65;
      const lx = cx + labelR * Math.cos(midAngle);
      const ly = cy + labelR * Math.sin(midAngle);
      const pct = Math.round((p.value / total) * 100);

      slices += `<text x="${lx}" y="${ly}" text-anchor="middle" font-size="11" fill="#fff" font-weight="bold">${pct}%</text>`;

      startAngle = endAngle;
    });

    // Legend
    let legend = '';
    points.forEach((p, i) => {
      const ly = 30 + i * 18;
      legend += `<rect x="${w - 130}" y="${ly}" width="12" height="12" fill="${colors[i % colors.length]}" rx="2"/>`;
      legend += `<text x="${w - 112}" y="${ly + 10}" font-size="11" fill="#333">${p.label}</text>`;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#fafafa" rx="8"/>
  <text x="${cx}" y="20" text-anchor="middle" font-size="14" font-weight="bold" fill="#333">${title || 'Pie Chart'}</text>
  ${slices}
  ${legend}
</svg>`;
  }

  _emptyChart() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.chartWidth} ${this.chartHeight}">
  <rect width="${this.chartWidth}" height="${this.chartHeight}" fill="#fafafa" rx="8"/>
  <text x="${this.chartWidth / 2}" y="${this.chartHeight / 2}" text-anchor="middle" font-size="14" fill="#999">Tidak ada data</text>
</svg>`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  _getTopic(task, context) {
    if (task.input) return task.input;
    if (task.description) return task.description;
    return context?.session?.objective || 'Data Umum';
  }

  _getPreviousContent(task, context) {
    if (!context?.session?.artifacts || !context?.session?.tasks) return null;

    const taskIdx = context.session.tasks.findIndex(t => t.id === task.id);
    for (let i = taskIdx - 1; i >= 0; i--) {
      const prevTask = context.session.tasks[i];
      const artifact = context.session.artifacts.find(a => a.taskId === prevTask.id);
      if (artifact) return artifact.content;
    }
    return null;
  }

  _detectChartType(task, context) {
    const desc = (task.description || '').toLowerCase();
    const obj = (context?.session?.objective || '').toLowerCase();

    if (desc.includes('pie') || desc.includes('lingkaran') || obj.includes('pie')) return 'pie';
    if (desc.includes('line') || desc.includes('garis') || obj.includes('line')) return 'line';
    return 'bar';
  }
}

export { DataService };
export default DataService;
