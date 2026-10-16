/**
 * PageWorkers.mjs
 * PHASE 5 — OCR / VISION / TABLE execution workers for 9Router.
 *
 * Invariant: workers emit TYPED evidence payloads — NEVER flattened documentText.
 *   OCR    -> { page, type:'OCR',    source, content:string, confidence }
 *   VISION -> { page, type:'VISION', source, content:string, confidence, bbox? }
 *   TABLE  -> { page, type:'TABLE',  source, content:string, confidence,
 *               structure:{ columns, rows, ... } }
 *   OCR/Vision mismatch -> { page, type:'CONFLICT', candidates:[...] }
 *
 * OCR cross-check rule: confidence < OCR_CROSSCHECK_THRESHOLD
 *   -> vision re-read -> similarity < CONFLICT_FLOOR => EVIDENCE_CONFLICT
 *      (tidak dipilih diam-diam)
 *
 * deps DI untuk test deterministik: { renderPages, ocrPages, visionOcr,
 * visionDescribe, extractTables }. Default = worker lama (DocumentParser,
 * GeminiOCRProvider, pdf-parse getTable). Semua payload MEET AT
 * DocumentEvidenceStore (oleh reader), bukan langsung ke Qwen.
 */
import { EVIDENCE_TYPES } from './DocumentEvidence.mjs';

export const OCR_CROSSCHECK_THRESHOLD = Number(process.env.DOC_OCR_CROSSCHECK_THRESHOLD || 0.75);
export const CONFLICT_FLOOR = Number(process.env.DOC_OCR_CONFLICT_FLOOR || 0.45);

/** Heuristik confidence OCR (provider tidak mengekspos skor halaman). */
export function estimateOcrConfidence(text = '') {
  const t = String(text || '');
  if (t.trim().length < 20) return 0;
  const good = (t.match(/[\p{L}\p{N}\p{P}\s]/gu) || []).length;
  const printableRatio = good / t.length;
  const tokens = t.trim().split(/\s+/).filter(Boolean);
  const tokenScore = Math.min(1, tokens.length / 30);
  const avgLen = t.trim().replace(/\s+/g, ' ').length / Math.max(1, tokens.length);
  const structural = tokens.length >= 5 && avgLen >= 3 ? 0.2 : 0;
  const score = 0.45 * printableRatio + 0.35 * tokenScore + structural;
  return Math.round(Math.max(0, Math.min(0.99, score)) * 100) / 100;
}

/** Similarity 0..1 antara dua teks (intersection/min token >2 chars). */
export function textSimilarity(a = '', b = '') {
  const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const A = new Set(norm(a).split(' ').filter((w) => w.length > 2));
  const B = new Set(norm(b).split(' ').filter((w) => w.length > 2));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return Math.round((hit / Math.min(A.size, B.size)) * 100) / 100;
}

/** Split teks OCR batch "### HALAMAN N ###" menjadi per-halaman. */
export function splitOcrByPage(text = '', pages = []) {
  const map = new Map();
  const src = String(text || '');
  const re = /###\s*HALAMAN\s*(\d+)\s*###/gi;
  const matches = [...src.matchAll(re)];
  if (matches.length) {
    for (let i = 0; i < matches.length; i++) {
      const pg = Number(matches[i][1]);
      const start = matches[i].index + matches[i][0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : src.length;
      map.set(pg, src.slice(start, end).trim());
    }
  } else if (pages.length === 1) {
    map.set(pages[0], src.trim());
  }
  return map;
}

export function normalizeTable(raw) {
  const rows = Array.isArray(raw) ? raw : (raw && raw.rows) || [];
  const cells = rows
    .filter(Array.isArray)
    .map((r) => r.map((c) => (c && typeof c === 'object' ? String(c.text ?? c.content ?? '') : String(c ?? ''))));
  if (!cells.length) return null;
  const columnCount = Math.max(...cells.map((r) => r.length));
  return { columns: cells[0], rows: cells.slice(1), columnCount, rowCount: cells.length - 1 };
}

export function renderTableText(t = {}) {
  const head = `Kolom: ${(t.columns || []).join(' | ')}`;
  const body = (t.rows || []).map((r) => r.join(' | ')).join('\n');
  return `${head}\n${body}`.trim();
}

// ─── Production defaults (reuse worker lama, tidak diimplementasi ulang) ───

async function defaultRenderPages(buffer, pages) {
  const { renderPdfPages } = await import('../tools/DocumentParser.mjs');
  return renderPdfPages(buffer, pages, 1400);
}

async function defaultOcrPages(rendered) {
  const { ocrPageImages } = await import('../tools/GeminiOCRProvider.mjs');
  return ocrPageImages(rendered);
}

async function defaultVisionOcr(rendered) {
  const { ocrFromBuffer } = await import('../tools/GeminiOCRProvider.mjs');
  const out = [];
  for (const r of rendered) {
    const res = await ocrFromBuffer(r.buffer, `page-${r.pageNumber}.png`, 'image/png');
    out.push({ pageNumber: r.pageNumber, text: (res && res.text) || '' });
  }
  return out;
}

async function defaultVisionDescribe(rendered) {
  const { geminiProviderInstance } = await import('../providers/GeminiProvider.mjs');
  const out = [];
  for (const r of rendered) {
    const desc = await geminiProviderInstance.sendChat({
      messages: [{
        role: 'user',
        content: [
          { inlineData: { mimeType: 'image/png', data: r.buffer.toString('base64') } },
          { text: 'Deskripsikan HANYA elemen visual halaman ini (grafik/diagram/tabel/gambar/stempel/tanda tangan/layout) dalam Bahasa Indonesia, 2-4 kalimat. Kembalikan deskripsi saja.' }
        ]
      }],
      stream: false, model: 'auto', temperature: 0.1
    });
    out.push({ pageNumber: r.pageNumber, text: String(desc || '').trim(), confidence: desc ? 0.8 : 0 });
  }
  return out;
}

async function defaultExtractTables(buffer, pages) {
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const pdfModule = require('pdf-parse');
  const PDFClass = pdfModule.PDFParse || pdfModule;
  const parser = new PDFClass({ data: buffer });
  try {
    const res = await parser.getTable({ partial: pages });
    return (res && res.pages ? res.pages : []).map((p) => ({
      page: Number(p.num),
      tables: (p.tables || []).map(normalizeTable).filter(Boolean)
    }));
  } finally {
    if (typeof parser.destroy === 'function') await parser.destroy().catch(() => {});
  }
}

// ─── Worker eksekusi (payload BER-TIPE, meet di DocumentEvidenceStore) ───

/**
 * OCR worker: render -> OCR per halaman -> confidence -> vision cross-check
 * bila lemah. Mismatch => payload CONFLICT (bukan pilih diam-diam).
 */
export async function runOCRWorker({ buffer, pageNumbers = [], deps = {} } = {}) {
  const renderPages = deps.renderPages || defaultRenderPages;
  const ocrPages = deps.ocrPages || defaultOcrPages;
  const visionOcr = deps.visionOcr || defaultVisionOcr;
  const out = [];
  if (!pageNumbers.length) return out;

  let rendered = [];
  try {
    rendered = await renderPages(buffer, pageNumbers);
  } catch (err) {
    return pageNumbers.map((p) => ({ page: p, type: EVIDENCE_TYPES.OCR, source: 'render-failed', content: '', confidence: 0, structure: { error: err.message } }));
  }

  let ocrText = '';
  try {
    const res = await ocrPages(rendered);
    ocrText = typeof res === 'string' ? res : (res && res.text) || '';
    if (res && res.status && res.status !== 'OK') {
      return pageNumbers.map((p) => ({ page: p, type: EVIDENCE_TYPES.OCR, source: `ocr-${String(res.status).toLowerCase()}`, content: '', confidence: 0, structure: { error: res.error || res.status } }));
    }
  } catch (err) {
    return pageNumbers.map((p) => ({ page: p, type: EVIDENCE_TYPES.OCR, source: 'ocr-failed', content: '', confidence: 0, structure: { error: err.message } }));
  }

  const byPage = splitOcrByPage(ocrText, pageNumbers);
  const lowConf = [];
  for (const pg of pageNumbers) {
    const text = (byPage.get(pg) || '').trim();
    const conf = estimateOcrConfidence(text);
    const payload = { page: pg, type: EVIDENCE_TYPES.OCR, source: 'gemini-ocr', content: text, confidence: conf, structure: { crosschecked: false } };
    if (text && conf < OCR_CROSSCHECK_THRESHOLD) lowConf.push(payload);
    else out.push(payload);
  }

  // Vision cross-check untuk OCR lemah (threshold 0.75).
  for (const payload of lowConf) {
    try {
      const vres = await visionOcr(rendered.filter((r) => Number(r.pageNumber) === payload.page));
      const vtext = typeof vres === 'string' ? vres : (vres && vres.text) || '';
      const vByPage = splitOcrByPage(vtext, [payload.page]);
      const alt = (vByPage.get(payload.page) || vtext).trim();
      const sim = alt ? textSimilarity(payload.content, alt) : 0;
      if (alt && sim >= CONFLICT_FLOOR) {
        payload.source = 'gemini-ocr+vision-crosscheck';
        payload.confidence = Math.max(payload.confidence, Math.round(Math.min(0.85, sim) * 100) / 100);
        payload.structure = { crosschecked: true, similarity: sim };
        out.push(payload);
      } else if (alt) {
        out.push({
          page: payload.page, type: EVIDENCE_TYPES.CONFLICT, source: 'ocr-vision-conflict',
          content: '', confidence: 0,
          structure: { conflict: true, similarity: sim, candidates: [
            { source: 'ocr', text: payload.content, confidence: payload.confidence },
            { source: 'vision', text: alt, confidence: 0 }
          ] }
        });
      } else {
        out.push(payload); // vision tidak hasilkan apa-apa: tetap OCR rendah, jangan dinaikkan
      }
    } catch (err) {
      payload.structure = { crosschecked: false, crosscheckError: err.message };
      out.push(payload);
    }
  }
  return out;
}

/** Vision worker: render -> deskripsi visual per halaman -> VISION payload. */
export async function runVisionWorker({ buffer, pageNumbers = [], deps = {} } = {}) {
  const renderPages = deps.renderPages || defaultRenderPages;
  const visionDescribe = deps.visionDescribe || defaultVisionDescribe;
  if (!pageNumbers.length) return [];
  let rendered = [];
  try {
    rendered = await renderPages(buffer, pageNumbers);
  } catch (err) {
    return pageNumbers.map((p) => ({ page: p, type: EVIDENCE_TYPES.VISION, source: 'render-failed', content: '', confidence: 0, structure: { error: err.message } }));
  }
  try {
    const descs = await visionDescribe(rendered);
    const byPage = new Map((descs || []).map((d) => [Number(d.pageNumber), d]));
    return pageNumbers.map((pg) => {
      const d = byPage.get(pg);
      const text = String((d && d.text) || '').trim();
      return {
        page: pg, type: EVIDENCE_TYPES.VISION, source: 'gemini-vision',
        content: text, confidence: text ? Number((d && d.confidence) || 0.8) : 0,
        bbox: (d && d.bbox) || null, structure: { crosschecked: false }
      };
    });
  } catch (err) {
    return pageNumbers.map((p) => ({ page: p, type: EVIDENCE_TYPES.VISION, source: 'vision-failed', content: '', confidence: 0, structure: { error: err.message } }));
  }
}

/**
 * Table worker: pdf-parse getTable -> columns/rows -> TABLE payload dengan
 * numeric consistency. Tanpa tabel terdeteksi -> [] (caller fallback TEXT).
 */
export async function runTableWorker({ buffer, pageNumbers = [], deps = {} } = {}) {
  const extractTables = deps.extractTables || defaultExtractTables;
  if (!pageNumbers.length) return [];
  let extracted;
  try {
    extracted = await extractTables(buffer, pageNumbers);
  } catch (err) {
    return pageNumbers.map((p) => ({ page: p, type: EVIDENCE_TYPES.TABLE, source: 'table-extract-failed', content: '', confidence: 0, structure: { error: err.message } }));
  }
  const out = [];
  for (const pg of pageNumbers) {
    const rec = (extracted || []).find((r) => Number(r.page) === pg);
    const rawTables = (rec && rec.tables) || [];
    const tables = rawTables.map((t) => (t && Array.isArray(t.rows) ? t : normalizeTable(t))).filter(Boolean);
    if (!tables.length) continue; // tidak ada tabel -> caller fallback ke TEXT
    // Numeric consistency: seluruh baris harus punya kolom seragam + angka parseable.
    let totalRows = 0, wellFormed = 0, numericOk = 0;
    for (const t of tables) {
      for (const row of (t.rows || [])) {
        totalRows += 1;
        if (row.length === t.columnCount) wellFormed += 1;
        const nums = row.filter((c) => /-?\d+([.,]\d+)?/.test(c));
        if (nums.length > 0) numericOk += 1;
      }
    }
    const shapeScore = totalRows ? wellFormed / totalRows : 0;
    const numericScore = totalRows ? numericOk / totalRows : 0;
    const confidence = Math.round(Math.min(0.98, 0.5 + 0.35 * shapeScore + 0.15 * numericScore) * 100) / 100;
    const structure = tables.length === 1
      ? { ...tables[0], tables: 1, shapeScore, numericScore }
      : { tables: tables.length, shapeScore, numericScore, detail: tables };
    out.push({
      page: pg, type: EVIDENCE_TYPES.TABLE, source: 'pdf-table-detector',
      content: tables.map(renderTableText).join('\n\n'),
      confidence, structure
    });
  }
  return out;
}

