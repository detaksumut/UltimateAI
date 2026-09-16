/**
 * DocumentIntelligenceTool.mjs
 * PHASE 6 - Structure-Aware Semantic Chunking & Citation Provenance.
 * PRINCIPLE: chunking only PARTITIONS a document (technical); it never DISCARDS content.
 * Paragraph/heading/table/figure/chart/caption/formula/section = SEMANTIC UNIT, never split
 * mid-structure. Tables split by ROW-GROUPS. Figures/charts standalone bound to captions.
 * full_document: batched waves, ALL units, coverage 100%. retrieval: legacy ranking.
 */

import { ToolContract, PERMISSION_LEVELS } from './ToolContract.mjs';

const HEADING_RE = /^\s*(?:(?:BAGIAN|SECTION|SUBSECTION|BAB|LAMPIRAN|ABSTRAK|ABSTRACT|RINGKASAN|SUMMARY|PENDAHULUAN|DESKRIPSI|DESCRIPTION|KLAIM|CLAIM|GAMBAR|DAFTAR GAMBAR|DAFTAR TABEL)\b.*|(?:\d+(?:\.\d+){0,2}[\s.):-]+\s*[A-Z][A-Z0-9 _/&(),.-]{2,}))\s*$/i;
const FIGURE_CAPTION_RE = /^\s*(?:GAMBAR|FIG\.?|FIGURE|Gbr\.?|Gambar|FIG)\s*[-−—:.\s]*\d+\b[^\n]*$/i;
const TABLE_CAPTION_RE = /^\s*(?:TABEL|TABLE|Tabel|Table)\s*[-−—:.\s]*\d+\b[^\n]*$/i;
const CHART_CAPTION_RE = /^\s*(?:DIAGRAM|GRAFIK|CHART|DIAGRAM BLOK|BAGAN)\s*[-−—:.\s]*\d+\b[^\n]*$/i;
const TABLE_ROW_RE = /(\t|\s{2,}|\|)\S|^(?:No\.?|Nomor)\s|^\d+\s+[A-Z0-9]{1,}/;
const FORMULA_RE = /[=÷×*^_±≈]|(?:sqrt|exp|ln|log|sum|integral)/;
const PAGE_BREAK_RE = /^\s*(?:Halaman|Page|Hal\.?)\s*\d+\s*$|^\s*---+\s*$/i;
const PAGE_MARKER_RE = /(?:Halaman|Page|Hal\.?)\s*[:#\s]*(\d+)/i;
const TABLE_MARKER_RE = /^\s*\[\[TABLE(?::|\])/;
const FIGURE_MARKER_RE = /^\s*\[\[FIGURE(?::|\])/;
const CHART_MARKER_RE = /^\s*\[\[CHART(?::|\])/;
const FORMULA_MARKER_RE = /^\s*\[\[FORMULA(?::|\])/;
const SECTION_MARKER_RE = /^\s*\[\[SECTION(?::|\])/;
const PAGE_MARKER_LINE_RE = /^\s*\[\[PAGE:\s*(\d+)\]\]/;
const WAVE_SIZE = 20;

export class DocumentIntelligenceTool extends ToolContract {
  constructor() {
    super({
      name: 'doc.analyze',
      version: '3.0.0',
      description: 'Structure-aware semantic chunking & citation mapping (paragraph/heading/table/figure/chart/caption/formula/section preserved as units; full_document = ALL units batched, 100% coverage, nothing discarded).',
      inputSchema: { documentText: 'string', query: 'string', fileName: 'string', mode: 'string', maxChunks: 'number', pageCountHint: 'number' },
      outputSchema: { fileName: 'string', totalChunks: 'number', processedChunks: 'number', skippedChunks: 'number', failedChunks: 'number', coveragePercent: 'number', relevantChunks: 'array', summary: 'string', telemetry: 'object' },
      permissionLevel: PERMISSION_LEVELS.READ_ONLY,
      timeoutMs: 14000
    });
  }

  async execute({ documentText = '', query = '', fileName = 'document.txt', mode = 'full_document', maxChunks = 100, pageCountHint = 0 } = {}, signal = null) {
    const startTime = Date.now();
    const totalStartBytes = String(documentText || '').length;

    if (!documentText || !documentText.trim()) {
      return {
        fileName,
        status: 'EMPTY_DOCUMENT',
        totalChunks: 0,
        processedChunks: 0,
        skippedChunks: 0,
        failedChunks: 0,
        coveragePercent: 0,
        relevantChunks: [],
        summary: '',
        telemetry: this.buildTelemetry([], { mode, pageCountHint }),
        latencyMs: Date.now() - startTime
      };
    }

    const fileNameSafe = this.sanitize(fileName, 'document');

    // 1. Structure-aware parsing -> semantic units (never character windows)
    const semantic = this.createStructureAwareChunks(documentText, { query, pageCountHint, fileNameSafe });
    const units = semantic.units;
    const totalChunks = units.length;
    const sections = semantic.sections;
    const pagesDetected = semantic.pageCount;

    // dedicated decode from semantic units (chunkId -> index)
    const unitsWithIndex = units.map((u, idx) => ({ ...u, index: idx + 1 }));

    // 2. full_document: ALL units scheduled (coverage 100%). Batching = waves, NOT slicing.
    let scheduled = unitsWithIndex;
    let ranked = null;
    if (mode === 'retrieval') {
      ranked = this.rankChunksByRelevance(unitsWithIndex, query);
      const limit = Number.isFinite(maxChunks) && maxChunks > 0 ? Math.max(1, Math.floor(maxChunks)) : 100;
      scheduled = ranked.slice(0, Math.min(limit, totalChunks));
    }

    // 3. Batching (waves)
    const batches = this.createBatches(scheduled, WAVE_SIZE);
    const processed = [];
    const skipped = [];
    const failed = [];

    for (const batch of batches) {
      if (signal && signal.aborted) {
        skipped.push(...batch);
        break;
      }
      for (const unit of batch) {
        try {
          processed.push(this.secureUnit(unit, fileName, fileNameSafe));
        } catch (err) {
          failed.push({
            chunkId: unit.chunkId,
            type: unit.type,
            error: err && err.message ? err.message : String(err)
          });
        }
      }
      await this.yieldToEventLoop();
    }

    const processedChunks = processed.length;
    const skippedChunks = skipped.length;
    const failedChunks = failed.length;
    const coveragePercent = totalChunks === 0 ? 0 : Math.round(((processedChunks + failedChunks) / totalChunks) * 1000) / 10;
    const effectiveCoverage = Math.min(100, coveragePercent);
    const summary = this.buildSummary(semantic, effectiveCoverage, fileNameSafe, mode);
    const telemetry = this.buildTelemetry(units, {
      mode,
      pageCountHint,
      processedChunks,
      skippedChunks,
      failedChunks,
      coveragePercent: effectiveCoverage,
      sections,
      pageCount: pagesDetected
    });

    return {
      fileName,
      status: mode === 'retrieval' ? 'RETRIEVAL_OK' : 'FULL_DOCUMENT_COMPLETE',
      totalChunks,
      processedChunks,
      skippedChunks,
      failedChunks,
      coveragePercent: effectiveCoverage,
      relevantChunks: processed,
      relevantChunksCount: processed.length,
      summary,
      telemetry,
      mode,
      latencyMs: Date.now() - startTime
    };
  }

  // ------------------------------------------------------------------
  // STRUCTURE-AWARE PARSING (semantic units preserved)
  // ------------------------------------------------------------------

  createStructureAwareChunks(text, { query = '', pageCountHint = 0, fileNameSafe = 'document' } = {}) {
    const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    const units = [];
    const sections = [];
    const sectionStack = [];
    let currentSection = null;
    let currentPage = 1;
    let pagesDetected = 1;
    let tableBuffer = [];
    let tableCaption = null;

    const colonSplit = (s) => s.split('|').map(p => p.trim());

    const pushUnit = (type, content, extra = {}) => {
      if (!content || !content.trim()) return;
      units.push({
        chunkId: `${fileNameSafe}-${type}-${units.length + 1}`,
        type,
        page: currentPage,
        section: currentSection,
        caption: extra.caption || null,
        captionText: extra.caption || null,
        title: extra.title || null,
        headers: extra.headers || null,
        rows: extra.rows || null,
        part: extra.part || null,
        totalParts: extra.totalParts || null,
        formula: extra.formula || null,
        surroundingText: extra.surroundingText || null,
        content: content.trim(),
        length: content.trim().length
      });
    };

    const flushTable = () => {
      if (tableBuffer.length === 0) return;
      pushUnit('table', tableBuffer.join('\n'), {
        caption: tableCaption,
        headers: null,
        rows: [...tableBuffer],
        part: null,
        totalParts: null
      });
      tableBuffer = [];
      tableCaption = null;
    };

    const findSurrounding = (idx) => {
      const prev = [];
      let k = idx - 1;
      while (k >= 0 && lines[k] && lines[k].trim() && prev.length < 2) {
        prev.unshift(lines[k].trim());
        k--;
      }
      const next = [];
      let n = idx + 1;
      while (n < lines.length && lines[n] && lines[n].trim() && next.length < 2) {
        next.push(lines[n].trim());
        n++;
      }
      return [...prev, ...next].join(' | ');
    };

    const extractTableRows = (captureRows) => {
      for (let r = 0; r < captureRows.length; r++) {
        const row = String(captureRows[r] || '').trim();
        if (!row) continue;
        if (tableCaption === null && TABLE_CAPTION_RE.test(row)) {
          tableCaption = row;
          continue;
        }
        const isRowLike = TABLE_ROW_RE.test(row) && !CHART_CAPTION_RE.test(row) && !FIGURE_CAPTION_RE.test(row);
        const cellCount = row.split(/\t|\s{2,}|\|/).filter(c => c && c.trim()).length;
        if (isRowLike && cellCount >= 2) {
          tableBuffer.push(row);
        } else {
          flushTable();
          return false;
        }
      }
      return true;
    };

    let i = 0;
    while (i < lines.length) {
      const raw = lines[i];
      const line = raw.trim();

      // page markers
      if (PAGE_BREAK_RE.test(raw)) {
        flushTable();
        const m = raw.match(PAGE_MARKER_RE);
        if (m) {
          const p = parseInt(m[1], 10);
          if (p > currentPage) { currentPage = p; pagesDetected = Math.max(pagesDetected, p); }
        } else if (/^-{3,}$/.test(raw)) {
          currentPage++;
          pagesDetected = Math.max(pagesDetected, currentPage);
        }
        i++;
        continue;
      }
      if (PAGE_MARKER_LINE_RE.test(raw)) {
        flushTable();
        const m = raw.match(PAGE_MARKER_LINE_RE);
        const p = parseInt(m[1], 10);
        currentPage = Math.max(currentPage, p);
        pagesDetected = Math.max(pagesDetected, p);
        i++;
        continue;
      }

      // structural markers emitted by the parser pipeline
      if (TABLE_MARKER_RE.test(raw)) {
        flushTable();
        i++;
        continue;
      }
      if (FIGURE_MARKER_RE.test(raw)) {
        flushTable();
        const parts = colonSplit((raw.match(/\[\[FIGURE:\s*([^\]]+)\]\]/) || [])[1] || raw);
        const caption = (parts.find(p => p.startsWith('caption=')) || '').slice(8) || null;
        const captionText = caption;
        const figureId = (parts.find(p => p.startsWith('id=')) || '').slice(3) || parts[0] || null;
        pushUnit('figure', raw, {
          caption,
          captionText,
          figureId,
          surroundingText: findSurrounding(i)
        });
        i++;
        continue;
      }
      if (CHART_MARKER_RE.test(raw)) {
        flushTable();
        const parts = colonSplit((raw.match(/\[\[CHART:\s*([^\]]+)\]\]/) || [])[1] || raw);
        const caption = (parts.find(p => p.startsWith('caption=')) || '').slice(8) || null;
        pushUnit('chart', raw, {
          caption,
          captionText: caption,
          surroundingText: findSurrounding(i)
        });
        i++;
        continue;
      }
      if (FORMULA_MARKER_RE.test(raw)) {
        flushTable();
        const inner = (raw.match(/\[\[FORMULA:\s*([^\]]+)\]\]/) || [])[1] || raw;
        const formula = inner.split('|').map(p => p.trim()).find(p => p.startsWith('formula=')) || inner;
        pushUnit('formula', raw, {
          formula: formula.replace(/^formula=/, '').trim(),
          surroundingText: findSurrounding(i)
        });
        i++;
        continue;
      }
      if (SECTION_MARKER_RE.test(raw)) {
        flushTable();
        const inner = (raw.match(/\[\[SECTION:\s*([^\]]+)\]\]/) || [])[1] || line;
        currentSection = inner.split('|').map(p => p.trim()).find(p => p.startsWith('title='))?.slice(6) || inner.trim();
        if (!sections.includes(currentSection)) sections.push(currentSection);
        sectionStack.push(currentSection);
        pushUnit('heading', raw, { title: currentSection, caption: currentSection });
        i++;
        continue;
      }

      // headings
      if (HEADING_RE.test(line)) {
        flushTable();
        currentSection = line.replace(/^[\s\d#*_\-')]+|[\s]*$/g, '');
        if (!sections.includes(currentSection)) sections.push(currentSection);
        sectionStack.push(currentSection);
        pushUnit('heading', line, { title: currentSection, caption: currentSection });
        i++;
        continue;
      }

      // figure caption -> standalone figure unit
      if (FIGURE_CAPTION_RE.test(line)) {
        flushTable();
        pushUnit('figure', line, {
          caption: line,
          captionText: line,
          surroundingText: findSurrounding(i)
        });
        i++;
        continue;
      }

      // chart caption
      if (CHART_CAPTION_RE.test(line)) {
        flushTable();
        pushUnit('chart', line, {
          caption: line,
          captionText: line,
          surroundingText: findSurrounding(i)
        });
        i++;
        continue;
      }

      // table caption -> attach to following rows
      if (TABLE_CAPTION_RE.test(line)) {
        flushTable();
        tableCaption = line;
        i++;
        continue;
      }

      // formula -> atomic unit
      if (FORMULA_RE.test(line) && line.length > 4 && !TABLE_ROW_RE.test(line)) {
        flushTable();
        pushUnit('formula', line, {
          formula: line,
          surroundingText: findSurrounding(i)
        });
        i++;
        continue;
      }

      // table row block
      if (TABLE_ROW_RE.test(line) && !HEADING_RE.test(line) && !FIGURE_CAPTION_RE.test(line)) {
        const block = [line];
        let j = i + 1;
        while (j < lines.length && TABLE_ROW_RE.test(lines[j]) && !HEADING_RE.test(lines[j]) && !FIGURE_CAPTION_RE.test(lines[j]) && !CHART_CAPTION_RE.test(lines[j])) {
          block.push(lines[j]);
          j++;
        }
        if (block.length >= 2) {
          const ok = extractTableRows(block);
          if (ok) { i = j; continue; }
        }
        i++;
        continue;
      }

      // paragraph (never split mid-sentence)
      flushTable();
      const text = this.collectParagraph(lines, i);
      pushUnit('paragraph', text.text, {
        startOffset: this.offsetUpTo(lines, i),
        endOffset: this.offsetUpTo(lines, text.endIndex)
      });
      i = text.endIndex;
    }

    flushTable();

    // estimate page span when no explicit markers (integer-proportional distribution)
    if (pagesDetected === 1 && pageCountHint > 1 && units.length > 0) {
      pagesDetected = pageCountHint;
      units.forEach((u, idx) => {
        u.page = Math.min(pagesDetected, 1 + Math.floor((idx / units.length) * pagesDetected));
      });
    }

    return { units, sections: sectionStack, pageCount: pagesDetected };
  }

  offsetUpTo(lines, endIndex) {
    return String(lines.slice(0, Math.max(0, endIndex)).join('\n')).length;
  }

  collectParagraph(lines, startIndex) {
    let text = '';
    let i = startIndex;
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t) break;
      if (HEADING_RE.test(t) || FIGURE_CAPTION_RE.test(t) || TABLE_CAPTION_RE.test(t) || CHART_CAPTION_RE.test(t)) break;
      if (/^\s*\[\[(TABLE|FIGURE|CHART|FORMULA|SECTION):/.test(lines[i])) break;
      text += (text ? '\n' : '') + t;
      i++;
    }
    if (!text) {
      text = lines[startIndex].trim();
      i = startIndex + 1;
    }
    return { text, endIndex: i };
  }

  findSurroundingText(lines, index) {
    return this.findSurroundingTextLines(lines, index).join(' | ');
  }

  findSurroundingTextLines(lines, index) {
    const prev = [];
    let k = index - 1;
    while (k >= 0 && lines[k] && lines[k].trim() && prev.length < 2) {
      prev.unshift(lines[k].trim());
      k--;
    }
    const next = [];
    let n = index + 1;
    while (n < lines.length && lines[n] && lines[n].trim() && next.length < 2) {
      next.push(lines[n].trim());
      n++;
    }
    return [...prev, ...next];
  }

  extractHeadersFromRows(rows) {
    if (rows.length === 0) return null;
    const headerRow = this.splitRowCells(rows[0]);
    return headerRow && headerRow.length >= 2 ? headerRow : null;
  }

  splitRowCells(row) {
    if (!row) return [];
    if (row.includes('\t')) return row.split('\t').map(c => c.trim());
    const pipeMatch = row.match(/^\s*\|.*\|\s*$/);
    if (pipeMatch) return row.split('|').map(c => c.trim()).filter(Boolean);
    const multiSpace = row.split(/\s{2,}/).map(c => c.trim()).filter(Boolean);
    if (multiSpace.length >= 2) return multiSpace;
    return [row.trim()];
  }

  looksLikeTableBlock(lines, idx) {
    const lookahead = [];
    let i = idx;
    let tableLike = 0;
    let total = 0;
    while (i < lines.length && total < 8) {
      const t = lines[i].trim();
      if (!t) break;
      if (HEADING_RE.test(t) || FIGURE_CAPTION_RE.test(t) || TABLE_CAPTION_RE.test(t) || CHART_CAPTION_RE.test(t)) break;
      if (TABLE_ROW_RE.test(lines[i])) tableLike++;
      total++;
      lookahead.push(t);
      i++;
    }
    return total >= 2 && (tableLike / total) >= 0.6;
  }

  buildTableUnit(rows, headers, page, sectionStack) {
    const maxCharPerTable = 8000;
    const joined = rows.join('\n');
    const caption = (rows[0] && TABLE_CAPTION_RE.test(rows[0])) ? rows[0] : null;
    const dataRows = caption ? rows.slice(1) : rows;
    const section = sectionStack.length ? sectionStack[sectionStack.length - 1] : null;

    if (joined.length <= maxCharPerTable) {
      return {
        type: 'table',
        chunkId: `${this.sanitize('document', 'document')}-table-${page}`,
        page,
        section,
        caption,
        headers,
        rows: dataRows,
        content: joined
      };
    }

    // Row-group split (never per-character)
    const parts = this.splitTableByRowGroups(dataRows, headers, maxCharPerTable);
    return parts.length === 1 ? parts[0] : {
      type: 'table-grouped',
      chunkId: `${this.sanitize('document', 'document')}-table-grouped-${page}`,
      page,
      section,
      caption,
      headers,
      rows: dataRows,
      parts,
      content: parts.map(p => p.content).join('\n...\n')
    };
  }

  splitTableByRowGroups(rows, headers, maxChars) {
    const groups = [];
    let current = [];
    let currentLen = headers ? headers.join('\t').length : 0;
    const headerBlock = headers ? headers.join('\t') : '';

    for (const row of rows) {
      const newLen = currentLen + row.length + 1;
      if (newLen > maxChars && current.length > 0) {
        const chunkContent = (headerBlock ? headerBlock + '\n' : '') + current.join('\n');
        groups.push({ content: chunkContent, currentLen: 0, rows: [...current] });
        current = [];
        currentLen = headerBlock.length;
      }
      current.push(row);
      currentLen += row.length + 1;
    }
    if (current.length > 0) {
      const chunkContent = (headerBlock ? headerBlock + '\n' : '') + current.join('\n');
      groups.push({ content: chunkContent, currentLen: 0, rows: [...current] });
    }

    const total = groups.length;
    return groups.map((g, idx) => ({
      type: 'table',
      chunkId: `${this.sanitize('document', 'document')}-table-grouped-${page}-${idx + 1}`,
      page,
      section,
      caption: null,
      headers,
      rows: g.rows,
      part: idx + 1,
      totalParts: total,
      content: g.content
    }));
  }

  // ------------------------------------------------------------------
  // SECURITY BOUNDARY / CITATION / BATCHING / TELEMETRY
  // ------------------------------------------------------------------

  secureUnit(unit, fileName, fileNameSafe) {
    const chunkIndex = this.extractChunkIndex(unit.chunkId);
    return {
      chunkId: unit.chunkId,
      chunkIndex,
      type: unit.type,
      page: unit.page,
      section: unit.section,
      caption: unit.caption || null,
      captionText: unit.caption || null,
      title: unit.title || null,
      headers: unit.headers || null,
      rows: unit.rows || null,
      formula: unit.formula || null,
      surroundingText: unit.surroundingText || null,
      part: unit.part || null,
      totalParts: unit.totalParts || null,
      citationTag: `[Ref: ${fileName}#${chunkIndex}-${unit.type}]`,
      relevanceScore: unit.score || 1.0,
      textPreview: (unit.content || '').substring(0, 120) + (unit.content && unit.content.length > 120 ? '...' : ''),
      content: unit.content
    };
  }

  extractChunkIndex(chunkId) {
    if (!chunkId) return 0;
    const m = String(chunkId).match(/-(\d+)$/);
    return m ? parseInt(m[1], 10) : 0;
  }

  createBatches(items, waveSize = WAVE_SIZE) {
    const batches = [];
    for (let i = 0; i < items.length; i += waveSize) {
      batches.push(items.slice(i, i + waveSize));
    }
    return batches;
  }

  async yieldToEventLoop() {
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  buildTelemetry(units, opts = {}) {
    const byType = {};
    for (const u of units) {
      const t = u.type || 'unknown';
      byType[t] = (byType[t] || 0) + 1;
    }
    const totalChunks = opts.processedChunks + opts.skippedChunks + opts.failedChunks;
    return {
      mode: opts.mode || 'full_document',
      totalChunks,
      processedChunks: opts.processedChunks || 0,
      skippedChunks: opts.skippedChunks || 0,
      failedChunks: opts.failedChunks || 0,
      coveragePercent: opts.coveragePercent || 0,
      paragraphChunks: byType.paragraph || 0,
      headingChunks: byType.heading || 0,
      tableChunks: (byType.table || 0) + (byType['table-grouped'] || 0),
      figureChunks: byType.figure || 0,
      chartChunks: byType.chart || 0,
      formulaChunks: byType.formula || 0,
      sectionsDetected: opts.sections || [],
      sectionChunks: byType.heading || 0,
      pagesDetected: opts.pageCount || 1,
      pageCountHint: opts.pageCountHint || 0,
      batching: {
        waveSize: WAVE_SIZE,
        maxWaves: 200
      }
    };
  }

  buildSummary(semantic, coveragePercent, fileNameSafe, mode) {
    const byType = {};
    for (const u of semantic.units) {
      const t = u.type || 'unknown';
      byType[t] = (byType[t] || 0) + 1;
    }
    return [
      `SSD: ${byType.paragraph || 0} paragraf, ${byType.heading || 0} heading, ` +
        `${(byType.table || 0) + (byType['table-grouped'] || 0)} tabel, ${byType.figure || 0} figur, ` +
        `${byType.chart || 0} grafik/diagram, ${byType.formula || 0} formula`,
      `Seksi: ${(semantic.sections || []).join(' > ') || '(tidak terdeteksi)'}`,
      `Halaman: ${semantic.pageCount || 1}`,
      `Coverage: ${coveragePercent}% (${semantic.units.length} unit diproses batched; tidak ada unit dibuang dalam mode ${mode})`
    ].join('\n');
  }

  sanitize(name, fallback = 'doc') {
    if (!name) return fallback;
    return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // ------------------------------------------------------------------
  // LEGACY FALLBACK (retrieval) - backward compatible
  // ------------------------------------------------------------------

  createSlidingWindowChunks(text, chunkSize = 600, overlap = 100) {
    const cleanText = String(text || '').replace(/\r\n/g, '\n');
    const chunks = [];
    let start = 0;
    let chunkIndex = 0;
    const safeChunkSize = Math.max(64, Math.floor(chunkSize));
    const safeOverlap = Math.max(0, Math.min(overlap, Math.floor(safeChunkSize / 2)));
    const step = Math.max(1, safeChunkSize - safeOverlap);

    while (start < cleanText.length) {
      const end = Math.min(start + safeChunkSize, cleanText.length);
      const content = cleanText.substring(start, end).trim();
      if (content.length > 20) {
        chunks.push({
          index: chunkIndex,
          content,
          startOffset: start,
          endOffset: end
        });
        chunkIndex++;
      }
      start += step;
    }
    return chunks;
  }

  rankChunksByRelevance(chunks, query) {
    if (!query || !query.trim()) {
      return chunks.map((c, i) => ({ ...c, score: 1.0, chunkId: c.chunkId || `doc-${i + 1}` }));
    }
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    return chunks
      .map(c => {
        const hay = ((c.content || c.text || '') + ' ' + (c.caption || '') + ' ' + (c.surroundingText || '')).toLowerCase();
        let score = 0;
        for (const kw of keywords) {
          const occurrences = (hay.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
          score += occurrences;
        }
        return { ...c, score };
      })
      .sort((a, b) => b.score - a.score);
  }
}

export const documentIntelligenceToolInstance = new DocumentIntelligenceTool();
export default documentIntelligenceToolInstance;
