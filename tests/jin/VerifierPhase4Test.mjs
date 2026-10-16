/**
 * VerifierPhase4Test.mjs
 * PHASE 4 — Evidence/Claim Verifier gate proof.
 *   4A valid evidence -> VERIFIED
 *   4B evidence bertentangan -> CONTRADICTED (bukan insufficient)
 *   4C evidence lemah -> INSUFFICIENT_EVIDENCE
 *   4D claim tanpa evidenceId -> REJECT
 *   4E evidenceId tidak dikenal -> REJECT
 *   4F multiple claims -> verifikasi independen per claim
 *   4G provenance -> documentId/page/blockId terlacak
 *   4H no bypass -> jawaban Qwen tidak jadi final tanpa verifier
 */
import assert from 'assert';
import fs from 'fs';

const {
  DocumentEvidenceStore, createEvidence, createConflictEvidence, CLAIM_STATES
} = await import('../../server/document/DocumentEvidence.mjs');
const { ClaimEvidenceVerifier } = await import('../../server/document/ClaimEvidenceVerifier.mjs');

const store = new DocumentEvidenceStore();
const evStrong = store.add(createEvidence({
  documentId: 'doc-XYZ', page: 17, blockId: 'p17-b12',
  type: 'TEXT', source: 'text-layer',
  content: 'Pasal 23 mewajibkan pemerintah daerah melaksanakan perencanaan.', confidence: 0.98
}));
const evWeak = store.add(createEvidence({
  documentId: 'doc-XYZ', page: 9, blockId: 'p9-b3',
  type: 'OCR', source: 'gemini-ocr', content: 'anggaran naik ...', confidence: 0.42
}));
const evConflict = store.add(createConflictEvidence({
  documentId: 'doc-XYZ', page: 37, blockId: 'p37-b1',
  candidates: [{ source: 'ocr', text: 'Nomor 1' }, { source: 'vision', text: 'Nomor 7' }]
}));
const verifier = new ClaimEvidenceVerifier(store);

// 4A — valid evidence -> VERIFIED
const a = verifier.verifyClaim({ text: 'Pasal 23 mewajibkan pemerintah daerah...', evidenceIds: [evStrong.evidenceId] });
assert.strictEqual(a.code, 'VERIFIED', '4A: claim ber-evidence kuat harus VERIFIED');
assert.strictEqual(a.state, CLAIM_STATES.VERIFIED, '4A: state VERIFIED');
console.log('4A OK: valid evidence -> VERIFIED');

// 4B — evidence bertentangan -> CONTRADICTED (bukan insufficient)
const b = verifier.verifyClaim({ text: 'Perda Nomor 1/7', evidenceIds: [evConflict.evidenceId] });
assert.strictEqual(b.code, 'CONTRADICTED', '4B: konflik harus CONTRADICTED');
assert.notStrictEqual(b.state, CLAIM_STATES.INSUFFICIENT_EVIDENCE, '4B: CONFLICT jangan digabung ke INSUFFICIENT');
console.log('4B OK: evidence bertentangan -> CONTRADICTED (terpisah dari insufficient)');

// 4C — evidence lemah -> INSUFFICIENT_EVIDENCE
const c = verifier.verifyClaim({ text: 'anggaran naik', evidenceIds: [evWeak.evidenceId] });
assert.strictEqual(c.code, 'INSUFFICIENT_EVIDENCE', '4C: confidence 0.42 harus INSUFFICIENT');
console.log('4C OK: evidence lemah -> INSUFFICIENT_EVIDENCE');

// 4D — claim tanpa evidenceId -> REJECT
const d = verifier.verifyClaim({ text: 'klaim bebas' });
assert.strictEqual(d.code, 'REJECT', '4D: tanpa evidenceId harus REJECT');
console.log('4D OK: claim tanpa evidenceId -> REJECT');

// 4E — evidenceId tidak dikenal -> REJECT
const e = verifier.verifyClaim({ text: 'klaim ghost', evidenceIds: ['EV-999999'] });
assert.strictEqual(e.code, 'REJECT', '4E: id asing harus REJECT');
assert(/EV-999999/.test(e.reason), '4E: alasan memuat id yang hilang');
console.log('4E OK: evidenceId tidak dikenal -> REJECT');

// 4F — multiple claims -> independen
const v = verifier.verifyClaims([
  { text: 'A (didukung)', evidenceIds: [evStrong.evidenceId] },
  { text: 'B (bertentangan)', evidenceIds: [evConflict.evidenceId] },
  { text: 'C (lemah)', evidenceIds: [evWeak.evidenceId] },
  { text: 'D (tanpa evidence)' }
]);
assert.strictEqual(v.summary.verified, 1, '4F: 1 VERIFIED');
assert.strictEqual(v.summary.contradicted, 1, '4F: 1 CONTRADICTED');
assert.strictEqual(v.summary.insufficient, 1, '4F: 1 INSUFFICIENT');
assert.strictEqual(v.summary.rejected, 1, '4F: 1 REJECT');
assert.strictEqual(v.decisions.length, 4, '4F: 4 keputusan independen');
console.log('4F OK: multiple claims -> 1V/1C/1I/1R per claim');

// 4G — provenance terlacak documentId/page/blockId
const g = v.verified[0].provenance[0];
assert.strictEqual(g.documentId, 'doc-XYZ', '4G: documentId terlacak');
assert.strictEqual(g.page, 17, '4G: page terlacak');
assert.strictEqual(g.blockId, 'p17-b12', '4G: blockId terlacak');
assert.strictEqual(g.evidenceId, evStrong.evidenceId, '4G: evidenceId terlacak');
console.log('4G OK: provenance CLAIM->EV->block->page->document');

// composer — output akhir tidak menyampaikan klaim terblokir sebagai fakta
const composed = verifier.composeVerifiedAnswer('Dokumen menetapkan A, B, C dan D.', v);
assert(composed.text.includes('A (didukung)'), 'composer: hanya klaim VERIFIED disampaikan');
assert(!composed.text.includes('D (tanpa evidence) tanpa') && !/^D \(tanpa/.test(composed.text), 'composer: klaim REJECT tidak disajikan sebagai fakta');
assert(composed.status === 'PARTIAL', 'composer: status PARTIAL karena ada yang terblokir');
console.log('COMPOSER OK: A disampaikan, B/C/D ditandai jujur');

// 4B' — kontradiksi TIDAK dihapus diam-diam: disebut + halaman buktinya.
assert(composed.text.includes('bertentangan dengan evidence'), 'composer: CONTRADICTED tetap disebut');
assert(/bertentangan dengan evidence pada halaman 37/.test(composed.text), 'composer: CONTRADICTED membawa halaman bukti (37)');
assert(composed.text.includes('evidence yang tersedia belum cukup'), 'composer: INSUFFICIENT tetap disebut');
assert(composed.text.includes('halaman 9'), 'composer: INSUFFICIENT membawa halaman bukti (9)');
console.log('ANNOTATED OK: klaim terblokir dipertahankan dengan status + halaman');

// 4G' — verification report permanen (bukan hanya log internal).
const report = verifier.buildReport(v);
assert.strictEqual(report.claims.length, 4, 'report: 4 klaim dengan status per klaim');
const statuses = report.claims.map((c) => c.status);
assert.deepStrictEqual(statuses.sort(), ['CONTRADICTED', 'INSUFFICIENT_EVIDENCE', 'REJECT', 'VERIFIED'], 'report: keempat status ada');
const repVerified = report.claims.find((c) => c.status === 'VERIFIED');
assert.deepStrictEqual(repVerified.evidenceIds, [evStrong.evidenceId], 'report: evidenceIds ikut');
assert.strictEqual(repVerified.provenance[0].page, 17, 'report: provenance page');
assert.strictEqual(repVerified.provenance[0].blockId, 'p17-b12', 'report: provenance blockId');
assert.strictEqual(repVerified.provenance[0].documentId, 'doc-XYZ', 'report: provenance documentId');
const repReject = report.claims.find((c) => c.status === 'REJECT');
assert(Array.isArray(repReject.evidenceIds) && repReject.evidenceIds.length === 0, 'report: REJECT tetap tercatat dengan evidenceIds kosong');
console.log('REPORT OK: claims[] permanen dengan status+evidenceIds+provenance');

// 4H — no bypass: prod wiring wajib melewati verifier
const routerSrc = fs.readFileSync('server/local_router/LocalRouterServer.mjs', 'utf8');
assert(routerSrc.includes('ClaimEvidenceVerifier'), '4H: pipeline wajib memanggil ClaimEvidenceVerifier');
assert(routerSrc.includes('claimVerification && verifiedAnswer'), '4H: adopsi jawaban wajib bergantung pada hasil verifier');
assert(routerSrc.includes('claim-verification FAILED'), '4H: verifier gagal => boundary tidak boleh diadopsi (fail-closed)');
assert(routerSrc.includes('claimVerification: claimVerification ? claimVerification.summary : null'), '4H: metadata claimVerification wajib terekspos');
assert((routerSrc.match(/claimReport/g) || []).length >= 4, '4H: claimReport dibangun + diekspos di stream & non-stream');
console.log('4H OK: Qwen -> claims -> VERIFIER -> final (tanpa bypass) + report permanen');

// Negative: verifier menolak store non-9Router
let badStore = false;
try { new ClaimEvidenceVerifier({}); } catch (err) { badStore = /DocumentEvidenceStore/.test(err.message); }
assert(badStore, 'verifier wajib menerima DocumentEvidenceStore 9Router');
console.log('BOUNDARY OK: verifier hanya di atas evidence store 9Router');

console.log('PHASE4 VERIFIER GATE PASS');
