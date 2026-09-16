/**
 * DocumentIntelligenceTool.mjs
 * Phase 6 - Enterprise Document Intelligence & Structure-Aware Semantic Chunking.
 * Structure-preserving semantic units: paragraph, heading, section, table,
 * table-grouped, figure, chart, caption, formula. Never splits a unit
 * mid-structure; never discards content. Batching = processing waves,
 * it is not ranking-based filtering (full_document keeps 100% coverage).
 */

import { ToolContract, PERMISSION_LEVELS } from './ToolContract.mjs';

export const MAX_TABLE_CHARS = 8000;
export const WAVE_SIZE = 320;
export const MAX_WAVES = 200;

const HEADING_RE = /^\s*(?:(?:BAGIAN|SECTION|SUBSECTION|BAB|SUBBAGIAN|LAMPIRAN|ABSTRAK|ABSTRACT|RINGKASAN|SUMMARY|PENDAHULUAN|DESKRIPSI|DESCRIPTION|KLAIM|CLAIM|GAMBAR|DAFTAR GAMBAR|DAFTAR TABEL)\b.*|(?:\d+(?:\.\d+){0,2}[\s.):-]+\s*[A-Z][A-Z0-9 _/&(),.-]{2,}))\s*$/i;
const FIGURE_CAPTION_RE = /^\s*(?:GAMBAR|FIG\.?|FIGURE|Gbr\.?|Gambar|FIG)\s*[-.:\s]*\d+\b[^\n]*$/i;
const TABLE_CAPTION_RE = /^\s*(?:TABEL|TABLE|Tabel|Table)\s*[-.:\s]*\d+\b[^\n]*$/i;
const CHART_CAPTION_RE = /^\s*(?:DIAGRAM|GRAFIK|CHART|DIAGRAM BLOK|BAGAN|GRAFIK BLOK)\s*[-.:\s]*\d+\b[^\n]*$/i;
const TABLE_ROW_RE = /(\t|\s{2,}|\|)\S|^(?:No\.?|Nomor)\s|^\d+\s+[A-Z0-9]{1,}/;
const FORMULA_RE = /[=÷×*^_±≈]|(?:sqrt|exp|ln|log|sum|integral)/;
const PAGE_BREAK_RE = /^\s*(?:Halaman|Page|Hal\.?)\s*\d+\s*$|^\s*---+\s*$/i;
const PAGE_MARKER_RE = /(?:Halaman|Page|Hal\.?)\s*[:#\s]*(\d+)/i;
const TABLE_MARKER_RE = /^\s*\[\[TABLE(?::|\])/;
const FIGURE_MARKER_RE = /^\s*\[\[FIGURE(?::|\])/;
const CHART_MARKER_RE = /^\s*\[\[CHART(?::|\])/;
const FORMULA_MARKER_RE = /^\s*\[\[FORMULA(?::|\])/;
const SECTION_MARKER_RE = /^\s*\[\[SECTION(?::|\])/;

export class DocumentIntelligenceTool extends ToolContract {
  constructor() {
    super({
      name: 'doc.analyze',
      version: '3.0.0',
      description: 'Structure-aware semantic chunking with full-document coverage (no content discarded; tables by row-groups; figures/charts/formulas/captions/sections preserved as units).',
      inputSchema: {
        documentText: 'string',
        query: 'string',
        fileName: 'string',
        mode: 'string',
        maxChunks: 'number',
        pageCountHint: 'number'
      },
      outputSchema: {
        fileName: 'string',
        totalChunks: 'number',
        processedChunks: 'number',
        skippedChunks: 'number',
        failedChunks: 'number',
        coveragePercent: 'number',
        relevantChunks: 'array',
        summary: 'string',
        telemetry: 'object'
      },
      permissionLevel: PERMISSION_LEVELS.READ_ONLY,
      timeoutMs: 14000
    });
  }
