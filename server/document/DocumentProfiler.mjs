/**
 * DocumentProfiler.mjs
 * PHASE 1 — 9Router PRIMARY PDF READER: per-page profiler.
 *
 * Contract:
 *   profileDocument(buffer, fileName) -> { documentId, fileName, pageCount, pages:[PageProfile] }
 *   PageProfile = { page, type, textChars, contentChars, tableLikelihood, ocrRequired, visionRequired }
 *   type ∈ TEXT | SCAN | MIXED | TABLE | VISION
 *
 * Rule: decision is per-PAGE, never per-file. Uses pdf-parse v2 getText pages
 * (contentChars strips "-- N of M --" markers, same anti false-OK as DocumentParser).
 * Table/vision signals are heuristic likelihoods, not final truth.
 */
import { createRequire } from 'module';
import crypto from 'crypto';

const require = createRequire(import.meta.url);

let PDFParseClass = null;
function getPDFParse() {
  if (!PDFParseClass) {
    try {
      const pdfModule = require('pdf-parse');
      PDFParseClass = pdfModule.PDFParse || pdfModule;
    } catch (err) {
      console.warn('[DocumentProfiler] pdf-parse load error:', err.message);
    }
  }
  return PDFParseClass;
}

const TABLE_HINT_RE = /(\t|\s{2,}\S|\|)|^(?:No\.?|Nomor)\s|^\d+\s+[A-Z0-9]{1,}|\b(TABEL|TABLE)\b/i;
const FIGURE_HINT_RE = /\b(GAMBAR|FIGURE|FIG\.?|GRAFIK|CHART|DIAGRAM|BAGAN)\b/i;
const MARKER_STRIP_RE = /--\s*\d+\s+of\s+\d+\s*--/gi;

export const PAGE_TYPES = Object.freeze({
  TEXT: 'TEXT',
  SCAN: 'SCAN',
  MIXED: 'MIXED',
  TABLE: 'TABLE',
  VISION: 'VISION'
});

export function stripPageMarkers(text = '') {
  return String(text || '').replace(MARKER_STRIP_RE, '').trim();
}

function tableLikelihood(text = '') {
  const t = String(text || '');
  if (!t.trim()) return 0;
  let score = 0;
  if (/\b(TABEL|TABLE)\b/i.test(t)) score += 0.35;
  const lines = t.split('\n');
  let rowHits = 0;
  for (const ln of lines.slice(0, 60)) {
    if (TABLE_HINT_RE.test(ln)) rowHits++;
  }
  if (rowHits >= 6) score += 0.4;
  else if (rowHits >= 3) score += 0.25;
  else if (rowHits >= 1) score += 0.1;
  if (/\d+\s+\d+[\.,]\d+/.test(t)) score += 0.1;
  return Math.min(1, Math.round(score * 100) / 100);
}

function visionLikelihood(text = '', contentChars = 0) {
  if (FIGURE_HINT_RE.test(text)) return 0.7;
  if (contentChars === 0) return 0.5;
  return 0.05;
}

export async function profileDocument(buffer, fileName = 'document.pdf') {
  const documentId = `doc-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  if (!buffer || buffer.length === 0) {
    return { documentId, fileName, pageCount: 0, pages: [], status: 'EMPTY' };
  }
  const PDFClass = getPDFParse();
  if (!PDFClass) {
    return { documentId, fileName, pageCount: 0, pages: [], status: 'NO_PARSER' };
  }
  const parser = new PDFClass({ data: buffer });
  try {
    const res = await parser.getText();
    const rawPages = Array.isArray(res?.pages) ? res.pages : [];
    const total = Number(res?.total) || rawPages.length || 0;
    const pages = rawPages.map((p) => {
      const page = Number(p?.num) || 0;
      const rawText = String(p?.text || '');
      const content = stripPageMarkers(rawText);
      const textChars = rawText.length;
      const contentChars = content.length;
      const tl = tableLikelihood(content);
      const vl = visionLikelihood(content, contentChars);
      let type = PAGE_TYPES.TEXT;
      if (contentChars < 100) type = PAGE_TYPES.SCAN;
      else if (tl >= 0.6) type = PAGE_TYPES.TABLE;
      else if (vl >= 0.7) type = PAGE_TYPES.VISION;
      return {
        page,
        type,
        textChars,
        contentChars,
        tableLikelihood: tl,
        visionLikelihood: vl,
        ocrRequired: type === PAGE_TYPES.SCAN,
        visionRequired: type === PAGE_TYPES.VISION,
        textPreview: content.slice(0, 400)
      };
    });
    return { documentId, fileName, pageCount: total, pages, status: 'OK' };
  } catch (err) {
    return { documentId, fileName, pageCount: 0, pages: [], status: 'FAILED', error: err.message };
  } finally {
    if (typeof parser.destroy === 'function') {
      await parser.destroy().catch(() => {});
    }
  }
}

export default { profileDocument, stripPageMarkers, PAGE_TYPES };
