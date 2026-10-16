/**
 * NineRouterDocumentReader.mjs
 * PHASE 1 — 9Router PRIMARY PDF READER controller.
 *
 * Pipeline: Intake -> Profile -> Page Classification -> Reader Selection
 * -> Normalize -> Evidence
 *
 * Workers reused (NOT reimplemented):
 *   - TEXT : pdf-parse per-halaman
 *   - OCR  : PageWorkers.runOCRWorker (render via DocumentParser + GeminiOCR,
 *            confidence + vision cross-check -> CONFLICT bila mismatch)
 *   - VISION: PageWorkers.runVisionWorker (Gemini vision deskripsi visual)
 *   - TABLE : PageWorkers.runTableWorker (pdf-parse getTable + consistency)
 *
 * Semua worker menghasilkan evidence BER-TIPE yang MEET AT DocumentEvidenceStore
 * (bukan dipaksa menjadi documentText). deps DI untuk test deterministik.
 */
import crypto from 'crypto';
import { profileDocument } from './DocumentProfiler.mjs';
import { buildExecutionPlan } from './PageClassifier.mjs';
import {
  EVIDENCE_TYPES,
  DocumentEvidenceStore,
  createEvidence,
  createConflictEvidence,
  buildQwenContract
} from './DocumentEvidence.mjs';
import { runOCRWorker, runVisionWorker, runTableWorker } from './PageWorkers.mjs';

export const READER_VERSION = '9router-reader-v1-phase1';

function checksum(buffer) {
  try {
    return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  } catch {
    return 'unknown';
  }
}

export class NineRouterDocumentReader {
  constructor() {
    this.version = READER_VERSION;
  }

  /**
   * @param {Buffer} buffer - raw file bytes
   * @param {Object} opts - { fileName, mimeType, query }
   */
  async read(buffer, opts = {}) {
    const fileName = opts.fileName || 'document.pdf';
    const mimeType = opts.mimeType || 'application/pdf';
    const query = opts.query || '';
    const store = new DocumentEvidenceStore();

    if (!buffer || buffer.length === 0) {
      return {
        status: 'EMPTY', documentId: null, fileName, pageCount: 0,
        plan: { pages: [], ranges: [] }, evidence: [], contract: null, store,
        error: 'Buffer dokumen kosong.'
      };
    }

    const intake = {
      fileName, mimeType, sizeBytes: buffer.length, checksum: checksum(buffer)
    };

    const head = buffer.slice(0, 5).toString('utf8');
    // Deteksi PDF berdasarkan BYTES, bukan nama file. Production DOCUMENT_PIPELINE
    // mengirim teks hasil ekstrak dengan nama lampiran ".pdf" — itu jalur teks,
    // bukan PDF biner (kalau nama saja yang menentukan, profil gagal & evidence kosong).
    const isPdf = head.indexOf('%PDF-') === 0;
    if (!isPdf) {
      const text = buffer.toString('utf-8');
      if (!text.trim()) {
        return {
          status: 'EMPTY', documentId: null, fileName, pageCount: 0,
          plan: { pages: [], ranges: [] }, evidence: [], contract: null, store,
          error: 'Berkas teks kosong.'
        };
      }
      const documentId = 'doc-' + Date.now().toString(36) + '-' + intake.checksum.slice(0, 6);
      store.add(createEvidence({
        documentId, page: 1, blockId: 'p1-b1',
        type: EVIDENCE_TYPES.TEXT, source: 'utf-8',
        content: text.slice(0, 20000), confidence: 1.0
      }));
      const evidence = store.all();
      return {
        status: 'OK', documentId, fileName, pageCount: 1, intake,
        plan: { pages: [{ page: 1, type: 'TEXT', worker: 'TEXT' }], ranges: [{ worker: 'TEXT', start: 1, end: 1, pages: [1] }] },
        evidence, contract: buildQwenContract({ documentId, query, evidence }),
        store, reader: this.version
      };
    }

    const profile = await profileDocument(buffer, fileName);
    if (profile.status !== 'OK') {
      return {
        status: profile.status === 'EMPTY' ? 'EMPTY' : 'FAILED',
        documentId: profile.documentId, fileName, pageCount: 0,
        plan: { pages: [], ranges: [] }, evidence: [], contract: null, store,
        error: profile.error || 'Profiling PDF gagal.'
      };
    }
    const plan = buildExecutionPlan(profile.pages);
    const textByPage = await this._extractTextByPage(buffer, plan);
    const workerDeps = opts.deps || {};

    // Group halaman per worker (FASE 5: worker dieksekusi, bukan placeholder).
    const byWorker = { TEXT: [], 'TEXT+TABLE': [], 'OCR+VISION': [], VISION: [] };
    for (const pg of plan.pages) {
      (byWorker[pg.worker] = byWorker[pg.worker] || []).push(pg.page);
    }

    let blockSeq = 0;
    const addPayloads = (payloads = []) => {
      for (const pl of payloads) {
        blockSeq += 1;
        if (pl.type === EVIDENCE_TYPES.CONFLICT) {
          store.add(createConflictEvidence({
            documentId: profile.documentId, page: pl.page,
            blockId: 'p' + pl.page + '-b' + blockSeq,
            candidates: (pl.structure && pl.structure.candidates) || []
          }));
          continue;
        }
        store.add(createEvidence({
          documentId: profile.documentId, page: pl.page, blockId: 'p' + pl.page + '-b' + blockSeq,
          type: pl.type, source: pl.source, content: pl.content || '',
          bbox: pl.bbox || null, confidence: pl.confidence,
          structure: pl.structure || null
        }));
      }
    };

    // TEXT: text layer langsung (worker teks pdf-parse).
    for (const pg of plan.pages) {
      if (pg.worker !== 'TEXT') continue;
      const content = String(textByPage.get(pg.page) || '').trim();
      if (!content) continue;
      addPayloads([{ page: pg.page, type: EVIDENCE_TYPES.TEXT, source: 'text-layer', content: content.slice(0, 20000), confidence: 0.98 }]);
    }

    // TABLE: worker tabel (columns/rows/cells) — fallback TEXT bila tak ada tabel.
    if (byWorker['TEXT+TABLE'].length) {
      let tablePayloads = [];
      try {
        tablePayloads = await runTableWorker({ buffer, pageNumbers: byWorker['TEXT+TABLE'], deps: workerDeps });
      } catch (err) {
        console.warn('[9Router] table worker error:', err.message);
      }
      const gotPages = new Set(tablePayloads.filter((p) => p.confidence > 0).map((p) => p.page));
      addPayloads(tablePayloads);
      for (const pgNum of byWorker['TEXT+TABLE']) {
        if (gotPages.has(pgNum)) continue;
        const content = String(textByPage.get(pgNum) || '').trim();
        if (content) addPayloads([{ page: pgNum, type: EVIDENCE_TYPES.TEXT, source: 'text-layer(table-fallback)', content: content.slice(0, 20000), confidence: 0.85 }]);
      }
    }

    // OCR (+vision cross-check untuk confidence rendah).
    if (byWorker['OCR+VISION'].length) {
      try {
        addPayloads(await runOCRWorker({ buffer, pageNumbers: byWorker['OCR+VISION'], deps: workerDeps }));
      } catch (err) {
        console.warn('[9Router] ocr worker error:', err.message);
        addPayloads(byWorker['OCR+VISION'].map((p) => ({ page: p, type: EVIDENCE_TYPES.OCR, source: 'ocr-failed', content: '', confidence: 0, structure: { error: err.message } })));
      }
    }

    // VISION: deskripsi visual per halaman (grafik/diagram/stempel/layout).
    if (byWorker.VISION.length) {
      try {
        addPayloads(await runVisionWorker({ buffer, pageNumbers: byWorker.VISION, deps: workerDeps }));
      } catch (err) {
        console.warn('[9Router] vision worker error:', err.message);
        addPayloads(byWorker.VISION.map((p) => ({ page: p, type: EVIDENCE_TYPES.VISION, source: 'vision-failed', content: '', confidence: 0, structure: { error: err.message } })));
      }
    }

    const evidence = store.all();
    return {
      status: 'OK', documentId: profile.documentId, fileName,
      pageCount: profile.pageCount, intake, profile: profile.pages, plan, evidence,
      contract: buildQwenContract({ documentId: profile.documentId, query, evidence }),
      store, reader: this.version
    };
  }

  async _extractTextByPage(buffer, plan) {
    const textByPage = new Map();
    const needPages = plan.pages
      .filter((p) => p.worker === 'TEXT' || p.worker === 'TEXT+TABLE')
      .map((p) => p.page);
    if (needPages.length === 0) return textByPage;
    try {
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const pdfModule = require('pdf-parse');
      const PDFClass = pdfModule.PDFParse || pdfModule;
      const parser = new PDFClass({ data: buffer });
      try {
        const res = await parser.getText();
        const pages = (res && res.pages) ? res.pages : [];
        for (const p of pages) {
          if (needPages.includes(Number(p && p.num))) textByPage.set(Number(p.num), String(p.text || ''));
        }
      } finally {
        if (typeof parser.destroy === 'function') await parser.destroy().catch(() => {});
      }
    } catch (err) {
      console.warn('[NineRouterDocumentReader] text re-extract failed:', err.message);
    }
    return textByPage;
  }
}

export const nineRouterDocumentReaderInstance = new NineRouterDocumentReader();
export default nineRouterDocumentReaderInstance;
