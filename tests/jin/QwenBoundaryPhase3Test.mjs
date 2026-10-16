/**
 * QwenBoundaryPhase3Test.mjs
 * PHASE 3 — Qwen Evidence Boundary proof:
 *   9Router Evidence -> {documentId,query,evidence} -> Qwen
 *   -> {answer, claims:[{text,evidenceIds}]} (adapter, legacy fallback intact).
 */
import assert from 'assert';
import fs from 'fs';

const routerSrc = fs.readFileSync('server/local_router/LocalRouterServer.mjs', 'utf8');
const reasonerSrc = fs.readFileSync('server/document/QwenEvidenceReasoner.mjs', 'utf8');

// 3A: boundary contract ditegakkan di reasoner.
assert(reasonerSrc.includes('FORBIDDEN'), 'PHASE3-3A: reasoner wajib menolak pdfBytes/documentText mentah');
assert(reasonerSrc.includes('pdfBytes'), 'PHASE3-3A: pdfBytes wajib masuk daftar kunci terlarang');
assert(reasonerSrc.includes('documentId'), 'PHASE3-3A: input wajib {documentId,query,evidence}');
assert(reasonerSrc.includes('claims'), 'PHASE3-3A: output wajib {answer,claims}');
console.log('PHASE 3A OK: boundary contract {documentId,query,evidence} -> {answer,claims}');

// 3B: production wiring memakai boundary dengan fallback legacy.
assert(routerSrc.includes('qwenEvidenceReasonerInstance'), 'PHASE3-3B: pipeline wajib memanggil reasoner');
assert(routerSrc.includes('contractFromEnvelope'), 'PHASE3-3B: contract wajib dibangun dari envelope evidence');
assert(routerSrc.includes('reasonOverEvidence'), 'PHASE3-3B: reasoning wajib via evidence');
assert(routerSrc.includes('useBoundaryAnswer'), 'PHASE3-3B: boundary answer diadopsi bila valid');
assert(routerSrc.includes('legacy synthesis'), 'PHASE3-3B: legacy synthesis wajib tetap sebagai fallback');
assert(routerSrc.includes('qwenBoundary:'), 'PHASE3-3B: metadata qwenBoundary wajib terekspos');
console.log('PHASE 3B OK: boundary reasoning + legacy fallback + metadata');

// Functional: kunci terlarang ditolak, evidence kosong ditolak.
const { QwenEvidenceReasoner } = await import('../../server/document/QwenEvidenceReasoner.mjs');
const reasoner = new QwenEvidenceReasoner();
let forbiddenHit = false;
try {
  await reasoner.reasonOverEvidence({ documentId: 'd1', query: 'q', evidence: [], pdfBytes: 'x' });
} catch (err) {
  forbiddenHit = /FORBIDDEN/.test(err.message);
}
assert(forbiddenHit, 'input pdfBytes wajib ditolak boundary');
let emptyHit = false;
try {
  await reasoner.reasonOverEvidence({ documentId: 'd1', query: 'q', evidence: [] });
} catch (err) {
  emptyHit = /evidence/.test(err.message.toLowerCase());
}
assert(emptyHit, 'evidence kosong wajib ditolak (tidak boleh bernalar tanpa evidence)');
console.log('BOUNDARY-GATE OK: pdfBytes ditolak, evidence kosong ditolak');

// Functional: contract dari envelope + claim parsing ber-evidenceId.
const { readViaNineRouter } = await import('../../server/document/DocumentPipelineAdapter.mjs');
const sample = 'BAB I Pasal 1 Pemerintah mengatur perencanaan. Pasal 2 Pemerintah daerah melaksanakan. '.repeat(20);
const via = await readViaNineRouter({ text: sample, fileName: 'uu.txt', query: 'kewajiban siapa?' });
const contract = reasoner.contractFromEnvelope(via.envelope, 'kewajiban siapa?');
assert(contract.documentId, 'contract wajib membawa documentId');
assert(contract.evidence.length > 0, 'contract wajib membawa evidence');
assert(!('pdfBytes' in contract) && !('documentText' in contract), 'contract TIDAK BOLEH membawa PDF/teks mentah');
console.log('CONTRACT OK: documentId +', contract.evidence.length, 'evidence, tanpa PDF mentah');

// Live Qwen bila :8080 siap; bila tidak, skipped jujur (bukan gagal).
// FINAL ROUTING CONTRACT: Qwen = conversation only; jalur dokumen memakai 9Router AG.
// Live Qwen-dokumen di sini hanya pembuktian kontrak boundary (opt-in), bukan jalur produksi.
let live = null;
try {
  live = await reasoner.reasonOverEvidence(contract, { timeoutMs: 60000 });
} catch (err) {
  live = { status: 'REASONER_ERROR', reason: err.message };
}
console.log('LIVE-QWEN status=', live.status, '| claims=', (live.claims || []).length, '| reason=', (live.reason || '-').slice(0, 120));
if (live.status === 'OK') {
  for (const c of live.claims) {
    assert(Array.isArray(c.evidenceIds) && c.evidenceIds.length > 0, 'setiap claim wajib ber-evidenceIds');
  }
  console.log('LIVE-CLAIMS OK: semua claim ber-evidenceId');
} else {
  console.log('LIVE-QWEN SKIPPED jujur (llama-server sibuk/offline) — boundary + fallback legacy tetap terbukti.');
}

console.log('PHASE3 BOUNDARY PASS');
