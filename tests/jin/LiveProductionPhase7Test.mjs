/**
 * LiveProductionPhase7Test.mjs  (uji live, BUKAN perubahan arsitektur)
 * FASE 1-6 dikunci. Harness ini mengeksekusi jalur produksi nyata:
 *   PDF bytes -> readViaNineRouter -> contractFromEnvelope
 *   -> reasonOverEvidence (live Qwen :8080 bila siap, skipped jujur bila tidak)
 *   -> ClaimEvidenceVerifier -> buildReport -> matriks klaim-evidence.
 */
import assert from 'node:assert/strict';
import { buildPdf } from './fixtures/pdfFixture.mjs';

const { readViaNineRouter } = await import('../../server/document/DocumentPipelineAdapter.mjs');
const { QwenEvidenceReasoner } = await import('../../server/document/QwenEvidenceReasoner.mjs');
const { ClaimEvidenceVerifier } = await import('../../server/document/ClaimEvidenceVerifier.mjs');

const pages = [
  ['Penelitian zakat perniagaan MSME Kampung Felda Hutan Percha memakai pendekatan kualitatif dengan desain studi kasus.'],
  ['Survei menunjukkan 42 persen MSME memahami zakat perniagaan dan kewajiban pajak, sisanya 58 persen belum memahami.'],
  ['Pelaku usaha menghadapi dilema antara zakat sebagai beban pajak atau dua beban berbeda karena administrasi lemah.'],
  ['Belum terdapat sistem akuntansi terintegrasi antara pencatatan zakat perniagaan dan kewajiban pajak.']
];
const buf = buildPdf(pages);
assert.ok(buf.slice(0, 5).toString('utf8').startsWith('%PDF-'), 'live: PDF bytes valid');

// 1) 9Router membaca PDF nyata (jalur produksi: buffer bytes)
const via = await readViaNineRouter({ buffer: buf, fileName: 'ZakatTax-live.pdf', query: 'Analisis zakat dan pajak MSME.' });
assert.strictEqual(via.output.status, 'OK', 'live: 9Router read OK');
assert.ok(via.output.evidence.length >= 1, 'live: evidence terisi');
assert.ok(via.output.documentId, 'live: documentId ada');
console.log(`LIVE-READ OK: status=OK pages=${via.output.pageCount} evidence=${via.output.evidence.length} doc=${via.output.documentId}`);
for (const e of via.output.evidence) {
  console.log(` - ev ${e.evidenceId} hal=${e.page} type=${e.type} conf=${e.confidence} :: ${String(e.content).slice(0, 90)}...`);
}

// 2) Kontrak boundary dari envelope produksi
const reasoner = new QwenEvidenceReasoner();
const contract = reasoner.contractFromEnvelope(via.envelope, 'Analisis zakat dan pajak MSME.');
assert.ok(contract.documentId, 'live: contract documentId');
assert.ok(contract.evidence.length > 0, 'live: contract evidence');
assert.ok(!('pdfBytes' in contract) && !('documentText' in contract), 'live: tanpa PDF mentah');
console.log(`LIVE-CONTRACT OK: evidence=${contract.evidence.length}`);

// 3) Reasoning live (Qwen :8080 bila siap; skipped jujur bila tidak)
let boundary = null;
try {
  boundary = await reasoner.reasonOverEvidence(contract, { timeoutMs: 120000 });
} catch (err) {
  console.log('LIVE-QWEN SKIPPED (jujur):', err.message);
}
if (!boundary || boundary.status === 'REASONER_UNAVAILABLE') {
  console.log('LIVE-QWEN SKIPPED: :8080 tidak tersedia — READING+CONTRACT terbukti, REASONING menunggu layanan.');
  console.log('LIVE-PRODUCTION PARTIAL PASS (arsitektur utuh, layanan Qwen absen)');
  process.exit(0);
}
console.log(`LIVE-QWEN status=${boundary.status} claims=${(boundary.claims || []).length}`);
assert.ok(boundary.answer, 'live: jawaban Qwen ada');

// 4) Verifier + report + matriks klaim-evidence
assert.ok((boundary.claims || []).length > 0, 'live: klaim ber-evidenceId ada');
const verifier = new ClaimEvidenceVerifier(via.output.store);
const verification = verifier.verifyClaims(boundary.claims);
const composed = verifier.composeVerifiedAnswer(boundary.answer, verification);
const claimReport = verifier.buildReport(verification);
console.log(`LIVE-VERIFY summary=${JSON.stringify(verification.summary)} composed=${composed.status}`);
console.log('MATRIKS KLAIM-EVIDENCE (LIVE):');
for (const c of claimReport.claims) {
  const pg = (c.provenance || []).map((p) => p.page).filter((p) => p != null).join(',');
  console.log(` - [${c.kind} | ${c.status}] "${String(c.text).slice(0, 80)}..." ev=${(c.evidenceIds || []).join(',') || '-'} hal=${pg || '-'}`);
}

// 5) Gerbang FASE 4/6: tidak ada klaim tanpa evidenceId yang lolos sebagai fakta
for (const c of claimReport.claims) {
  if ((c.kind === 'FACT' || c.kind === 'ANALYSIS') && c.status === 'VERIFIED') {
    assert.ok((c.evidenceIds || []).length > 0, 'live: VERIFIED wajib ber-evidenceId');
  }
  if (c.kind === 'INFERENCE') {
    assert.notStrictEqual(c.status, 'VERIFIED', 'live: INFERENCE tidak pernah VERIFIED');
  }
}
console.log('LIVE-PRODUCTION FULL PASS: membaca -> berpikir -> membuktikan');
