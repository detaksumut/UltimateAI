/**
 * DocumentEvidence.mjs
 * PHASE 1 — Evidence schema: the HARD BOUNDARY between reader (9Router)
 * and reasoning (Qwen / specialist).
 *
 * Minimal evidence:
 *   { evidenceId, documentId, page, blockId, type, source, content, bbox, confidence }
 * type ∈ TEXT | OCR | VISION | TABLE | TABLE_CELL | CONFLICT
 * source ∈ text-layer | gemini-ocr | gemini-vision | table-detector | ...
 *
 * Invariants enforced here:
 *   - every claim must carry evidenceIds that resolve in the store (TEST 4)
 *   - OCR/vision disagreement is stored as CONFLICT, never silently chosen
 */
import crypto from 'crypto';

export const EVIDENCE_TYPES = Object.freeze({
  TEXT: 'TEXT',
  OCR: 'OCR',
  VISION: 'VISION',
  TABLE: 'TABLE',
  TABLE_CELL: 'TABLE_CELL',
  CONFLICT: 'CONFLICT'
});

export const CLAIM_STATES = Object.freeze({
  VERIFIED: 'VERIFIED',
  CONTRADICTED: 'CONTRADICTED',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
  UNVERIFIED: 'UNVERIFIED'
});

let evidenceSeq = 0;

export function createEvidence({
  documentId,
  page,
  blockId = null,
  type = EVIDENCE_TYPES.TEXT,
  source = 'text-layer',
  content = '',
  bbox = null,
  confidence = 1.0,
  structure = null
} = {}) {
  if (!documentId) throw new Error('[DocumentEvidence] documentId required');
  if (!Number.isFinite(Number(page))) throw new Error('[DocumentEvidence] page required');
  if (!Object.values(EVIDENCE_TYPES).includes(type)) {
    throw new Error(`[DocumentEvidence] invalid type "${type}"`);
  }
  evidenceSeq += 1;
  const evidenceId = `EV-${String(Date.now().toString(36)).toUpperCase()}${String(evidenceSeq).padStart(4, '0')}`;
  return {
    evidenceId,
    documentId,
    page: Number(page),
    blockId: blockId || `p${page}-b${evidenceSeq}`,
    type,
    source,
    content,
    bbox,
    structure,
    confidence: Math.max(0, Math.min(1, Number(confidence) || 0)),
    createdAt: new Date().toISOString()
  };
}

export function createConflictEvidence({ documentId, page, blockId, candidates = [] } = {}) {
  return createEvidence({
    documentId,
    page,
    blockId,
    type: EVIDENCE_TYPES.CONFLICT,
    source: 'ocr-vision-conflict',
    content: { conflict: true, candidates },
    confidence: 0
  });
}

export class DocumentEvidenceStore {
  constructor() {
    this.byId = new Map();
  }

  add(evidence) {
    if (!evidence || !evidence.evidenceId) throw new Error('[EvidenceStore] evidence.evidenceId required');
    this.byId.set(evidence.evidenceId, evidence);
    return evidence;
  }

  addMany(list = []) {
    return (list || []).map((e) => this.add(e));
  }

  get(evidenceId) {
    return this.byId.get(evidenceId) || null;
  }

  has(evidenceId) {
    return this.byId.has(evidenceId);
  }

  byPage(page) {
    return [...this.byId.values()].filter((e) => e.page === Number(page));
  }

  all() {
    return [...this.byId.values()];
  }

  size() {
    return this.byId.size;
  }

  clear() {
    this.byId.clear();
  }

  /**
   * TEST 4 gate: every claim must reference resolvable evidenceIds.
   * Returns { state, missing[] } — never throws for caller convenience.
   */
  checkClaim({ text = '', evidenceIds = [] } = {}) {
    const ids = Array.isArray(evidenceIds) ? evidenceIds : [];
    if (ids.length === 0) {
      return { state: CLAIM_STATES.UNVERIFIED, missing: [], reason: 'Claim tanpa evidenceId -> REJECT' };
    }
    const missing = ids.filter((id) => !this.byId.has(id));
    if (missing.length > 0) {
      return { state: CLAIM_STATES.UNVERIFIED, missing, reason: `evidenceId tidak dikenal: ${missing.join(',')}` };
    }
    const linked = ids.map((id) => this.byId.get(id));
    if (linked.some((e) => e.type === EVIDENCE_TYPES.CONFLICT)) {
      return { state: CLAIM_STATES.CONTRADICTED, missing: [], reason: 'Evidence konflik OCR/Vision' };
    }
    const minConf = Math.min(...linked.map((e) => Number(e.confidence) || 0));
    if (minConf < 0.5) {
      return { state: CLAIM_STATES.INSUFFICIENT_EVIDENCE, missing: [], reason: `confidence terendah ${minConf}` };
    }
    return { state: CLAIM_STATES.VERIFIED, missing: [], reason: 'claim->evidence MATCH' };
  }
}

export function buildQwenContract({ documentId, query = '', evidence = [] } = {}) {
  return {
    documentId,
    query,
    evidence: (evidence || []).map((e) => ({
      evidenceId: e.evidenceId,
      page: e.page,
      type: e.type,
      content: e.content,
      confidence: e.confidence
    }))
  };
}

export default {
  EVIDENCE_TYPES,
  CLAIM_STATES,
  createEvidence,
  createConflictEvidence,
  DocumentEvidenceStore,
  buildQwenContract
};
