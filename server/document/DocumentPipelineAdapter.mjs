/**
 * DocumentPipelineAdapter.mjs
 * PHASE 2A/2B — adapter 9Router normalized output -> legacy
 * document-analysis contract (doc.analyze downstream unchanged).
 *
 * Boundary:
 *   NineRouterDocumentReader.read() (Evidence)
 *     -> toLegacyDocumentInput() ({ documentText, fileName, meta })
 *     -> existing DocumentIntelligenceTool.execute() + LLM synthesis
 *
 * Also exposes evidence envelope for _agent.docMeta so production responses
 * carry { document, pages, blocks, evidence, executionPlan } (PHASE 2C).
 */
import { nineRouterDocumentReaderInstance } from './NineRouterDocumentReader.mjs';

export function evidenceToDocumentText(evidence = []) {
  const parts = [];
  for (const ev of (evidence || [])) {
    if (!ev) continue;
    if (typeof ev.content === 'string' && ev.content.trim()) {
      parts.push(`[HALAMAN ${ev.page} | ${ev.type} | ${ev.evidenceId}]\n${ev.content.trim()}`);
    }
  }
  return parts.join('\n\n');
}

export function toLegacyDocumentInput(readerOutput, fallback = {}) {
  const evidence = readerOutput?.evidence || [];
  const textEvidence = evidence.filter((e) => typeof e?.content === 'string' && e.content.trim());
  const needsOcr = evidence.filter((e) => e && typeof e.content !== 'string');
  const documentText = evidenceToDocumentText(textEvidence) || fallback.documentText || '';
  return {
    documentText,
    fileName: readerOutput?.fileName || fallback.fileName || 'Dokumen',
    meta: {
      reader: readerOutput?.reader || '9router-reader-v1',
      documentId: readerOutput?.documentId || null,
      pageCount: readerOutput?.pageCount || 0,
      evidenceCount: evidence.length,
      textEvidenceCount: textEvidence.length,
      needWorkerCount: needsOcr.length,
      needsWorkers: [...new Set(needsOcr.map((e) => (e.content && e.content.need) || e.type))],
      plan: readerOutput?.plan || null
    }
  };
}

export function buildEvidenceEnvelope(readerOutput) {
  if (!readerOutput) return null;
  return {
    document: {
      documentId: readerOutput.documentId,
      fileName: readerOutput.fileName,
      pageCount: readerOutput.pageCount,
      reader: readerOutput.reader
    },
    pages: (readerOutput.plan?.pages || []).map((p) => ({ page: p.page, type: p.type, worker: p.worker })),
    blocks: (readerOutput.evidence || []).map((e) => ({
      evidenceId: e.evidenceId, page: e.page, blockId: e.blockId,
      type: e.type, source: e.source, confidence: e.confidence
    })),
    evidence: readerOutput.evidence || [],
    executionPlan: readerOutput.plan?.ranges || [],
    contract: readerOutput.contract || null
  };
}

/**
 * PHASE 2A entry: read through 9Router, return legacy input + envelope.
 * Never throws for missing text — caller keeps honest NEED_OCR path.
 */
export async function readViaNineRouter({ buffer, text, fileName, mimeType, query } = {}) {
  const bytes = buffer || Buffer.from(String(text || ''), 'utf-8');
  const output = await nineRouterDocumentReaderInstance.read(bytes, { fileName, mimeType, query });
  const legacy = toLegacyDocumentInput(output, { documentText: text, fileName });
  return { output, legacy, envelope: buildEvidenceEnvelope(output) };
}

export default { readViaNineRouter, toLegacyDocumentInput, buildEvidenceEnvelope, evidenceToDocumentText };
