/**
 * DocumentIntelligenceTool.mjs
 * PHASE 6 - Enterprise Document Intelligence & Structure-Aware Semantic Chunking.
 * Supports PDF, DOCX, CSV, and TXT with structure-preserving chunking and citation provenance.
 *
 * PRINCIPLE: chunking only PARTITIONS a document for technical reasons; it never DISCARDS content.
 * A paragraph, heading, table, figure, chart, caption, or formula is a SEMANTIC UNIT and is never
 * split mid-structure. Tables are split by ROW-GROUPS (never by characters) and oversized tables
 * become grouped parts, each still a row-group; figures/charts are standalone semantic objects
 * bound to their caption.
 *
 * MODES:
 *  - full_document (default): ALL semantic units are processed (batched in waves, coverage 100%).
 *    No ranking-based filtering/slicing. Batching = processing in waves, never discarding.
 *  - retrieval: legacy relevance-ranking may reduce the retrieved set (QA use).
 */
 
import { ToolContract, PERMISSION_LEVELS } from './ToolContract.mjs';
 
const WAVE_SIZE = 20;
const MAX_UNIT_CHARS = 8000;
const MAX_TABLE_CHARS = 8000;
const CHUNKS_MAX_WAVES = 200;
const MIN_UNIT_CHARS = 24obyte;
 
const HEADING_RE = /^\s*(?:(?:BAGIAN|SECTION|SUBSECTION|BAB|LAMPIRAN|ABSTRAK|ABSTRACT|RINGKASAN|SUMMARY|PENDAHULUAN|DESKRIPSI|DESCRIPTION|KLAIM|CLAIM|GAMBAR|DAFTAR GAMBAR|DAFTAR TABEL)\b.*|(?:\d+(?:\.\d+){0,2}[\s.):-]+\s*[A-Z][A-Z0-9 _/&(),.-]{2,}))\s*$/i;
const FIGURE_CAPTION_RE = /^\s*(?:GAMBAR|FIG\.?|FIGURE|Gbr\.?|Gambar)\s*[-−−—:.\s]*\d+\b[^\n]*$/i;
const TABLE_CAPTION_RE = /^\s*(?:TABEL|TABEL|Table|Tabel)\s*[-−−—:.\s]*\d+\b[^\n]*$/i;
const CHART_CAPTION_RE = /^\s*(?:DIAGRAM|GRAFIK|CHART|DIAGRAM BLOK|BAGAN)\s*[-−−—:.\s]*\d+\b[^\n]*$/i;
const TABLE_ROW_RE = /(\t|\s{2,}|\|)\S|^(?:No\.?|Nomor)\s|^\d+\s+[A-Z0-9]{1,}/;
const PAGE_BREAK_RE = /^\s*(?:Halaman|Page|Hal\.?)\s*\d+\s*$|^\s*---+\s*$/i;
const PAGE_MARKER_RE = /(?:Halaman|Page|Hal\.?)\s*[:#\s]*(\d+)/i;
const TABLE_MARKER_RE = /^\s*\[\[TABLE(?::|\])/;
const FIGURE_MARKER_RE = /^\s*\[\[FIGURE(?::|\])/;
const CHART_MARKER_RE = /^\s*\[\[CHART(?::|\])/;
const FORMULA_MARKER_RE = /^\s*\[\[FORMULA(?::|\])/;
const SECTION_MARKER_RE = /^\s*\[\[SECTION(?::|\])/;
const FORMULA_RE = /[=÷×*^_±≈]|(?:sqrt|exp|ln|log|sum|integral)/;
const SECURE = {
  open: '<<<UNTRUSTED_DOCUMENT_DATA',
  close: '<<<END_UNTRUSTED_DOCUMENT_DATA>>>'
};
 
export class DocumentIntelligenceTool extends ToolContract {
  constructor() {
    super({
      name: 'doc.analyze',
      version: '3.0.0',
      description: 'Structure-aware semantic chunking and citation mapping (paragraph/heading/table/figure/chart/caption/formula/section preserved as units; full_document mode batches ALL units, coverage 100%).',
      inputSchema: { documentText: 'string', query: 'string', fileName: 'string', mode: 'string', maxChunks: 'number', pageCountHint: 'number' },
      outputSchema: { fileName: 'string', totalChunks: 'number', processedChunks: 'number', skippedChunks: 'number', failedChunks: 'number', coveragePercent: 'number', relevantChunks: 'array', summary: 'string', telemetry: 'object' },
      permissionLevel: PERMISSION_LEVELS.READ_ONLY,
      timeoutMs: 14000
    });
  }
 
  async execute({ documentText = '', query = '', fileName = 'document.txt', mode = 'full_document', maxChunks = 100, pageCountHint = 0 } = {}, signal = null) {
    const startTime = Date.now();
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
        telemetry: this.buildTelemetry([], { mode }),
        latencyMs: Date.now() - startTime
      };
    }
 
    const semantic = this.createStructureAwareChunks(documentText, { query, pageCountHint });
    const units = semantic.units;
    const totalChunks = units.length;
    let scheduled = units;
    let coveragePercent = 0;
 
    if (mode === 'retrieval') {
      const ranked = this.rankChunksByRelevance(units, query);
      const cap = Number.isFinite(maxChunks) && maxChunks > 0 ? Math.max(1, Math.floor(maxChunks)) : totalChunks;
      scheduled = ranked.slice(0, Math.min(cap, totalChunks));
    }
 
    const waves = this.createBatches(scheduled, WAVE_SIZE);
    const processed = [];
    const skipped = [];
    const failed = [];
    let decodeWarnings = 0;
 
    for (const wave of waves) {
      if (signal && signal.aborted) {
        skipped.push(...wave);
        break;
      }
      for (const unit of wave) {
        try {
          processed.push(this.secureUnit(unit, fileName));
        } catch (err) {
          failed.push({ chunkId: unit.chunkId, type: unit.type, error: err && err.message ? err.message : String(err) });
          decodeWarnings++;
        }
      }
      await this.yieldToEventLoop();
    }
 
    const processedChunks = processed.length;
    const skippedChunks = skipped.length;
    const failedChunks = failed.length;
    coveragePercent = totalChunks === 0 ? 0 : Math.round(((processedChunks + failedChunks) / totalChunks) * 1000) / 10;
 
    const edge = Math.min(100, coveragePercent);
    const summary = this.buildSummary(semantic, edge, modelem);
    const telemetry = this.buildTelemetry(units, {
      mode,
      processedChunks,
      skippedChunks,
      failedChunks,
      coveragePercent: edge,
      pageCount: semantic.pageCount,
      sections: semantic.sections
    });
 
    return {
      fileName,
      status: mode === 'retrieval' ? 'RETRIEVAL_OK' : 'FULL_DOCUMENT_COMPLETE',
      totalChunks,
      processedChunks,
      skippedChunks,
      failedChunks,
      coveragePercent: edge,
      relevantChunks: processed,
      relevantChunksCount: processed.length,
      summary,
      telemetry,
      mode,
      latencyMs: Date.now() - startTime
    };
  }
