/**
 * AnalyticalReasoningPhase6Test.mjs
 * FASE 6 — JIN Document Analytical Reasoning (tanpa menyentuh FASE 1-5).
 * Audit trail berlapis meniru ZakatTax1.pdf: FACT / ANALYSIS / INFERENCE.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const {
  DocumentEvidenceStore, createEvidence, createConflictEvidence
} = await import('../../server/document/DocumentEvidence.mjs');
const { ClaimEvidenceVerifier } = await import('../../server/document/ClaimEvidenceVerifier.mjs');
const { QwenEvidenceReasoner } = await import('../../server/document/QwenEvidenceReasoner.mjs');

function zakatStore() {
  const store = new DocumentEvidenceStore('ZakatTax1.pdf');
  const ev = {};
  ev.metode = createEvidence({
    documentId: 'ZakatTax1.pdf', page: 3, type: 'TEXT', source: 'pdf-text',
    content: 'Penelitian ini menggunakan pendekatan kualitatif dengan desain studi kasus pada MSME di Kampung Felda Hutan Percha.',
    confidence: 0.95
  });
  ev.angka = createEvidence({
    documentId: 'ZakatTax1.pdf', page: 5, type: 'TABLE', source: 'pdf-table-detector',
    content: 'Kolom: Tahun | Memahami | Tidak | 2023 | 42% | 58%',
    confidence: 0.93, structure: { columns: ['Tahun', 'Memahami', 'Tidak'], rows: [['2023', '42%', '58%']] }
  });
  ev.dilema = createEvidence({
    documentId: 'ZakatTax1.pdf', page: 6, type: 'TEXT', source: 'pdf-text',
    content: 'Pelaku usaha menghadapi dilema antara zakat sebagai beban pajak atau dua beban berbeda.',
    confidence: 0.9
  });
  ev.akuntansi = createEvidence({
    documentId: 'ZakatTax1.pdf', page: 7, type: 'TEXT', source: 'pdf-text',
    content: 'Belum terdapat sistem akuntansi terintegrasi antara pencatatan zakat perniagaan dan kewajiban pajak.',
    confidence: 0.88
  });
  for (const e of Object.values(ev)) store.add(e);
  return { store, ev };
}

const { store, ev } = zakatStore();
const verifier = new ClaimEvidenceVerifier(store);

// 6A — FACT kuat -> VERIFIED + provenance penuh
const f1 = verifier.verifyClaim({
  kind: 'FACT', text: 'Penelitian menggunakan pendekatan kualitatif dengan desain studi kasus.',
  evidenceIds: [ev.metode.evidenceId]
});
assert.strictEqual(f1.code, 'VERIFIED', '6A: FACT kuat VERIFIED');
assert.strictEqual(f1.kind, 'FACT', '6A: kind FACT');
assert.strictEqual(f1.provenance[0].page, 3, '6A: provenance page 3');
assert.strictEqual(f1.provenance[0].documentId, 'ZakatTax1.pdf', '6A: provenance document');
assert.ok(f1.provenance[0].blockId, '6A: provenance blockId');
console.log('6A OK: FACT -> VERIFIED + provenance CLAIM->EV->block->page->doc');

// 6B — ANALYSIS ber-evidence -> VERIFIED
const a1 = verifier.verifyClaim({
  kind: 'ANALYSIS',
  text: 'Rendahnya literasi diperparah administrasi lemah sehingga tidak ada akuntansi terintegrasi dan muncul dilema zakat-pajak.',
  evidenceIds: [ev.angka.evidenceId, ev.dilema.evidenceId, ev.akuntansi.evidenceId]
});
assert.strictEqual(a1.code, 'VERIFIED', '6B: ANALYSIS ber-evidence VERIFIED');
assert.strictEqual(a1.kind, 'ANALYSIS', '6B: kind ANALYSIS');
console.log('6B OK: ANALYSIS ber-evidence -> VERIFIED');

// 6C — ANALYSIS tanpa evidence -> REJECT
const aGhost = verifier.verifyClaim({ kind: 'ANALYSIS', text: 'Pola tersembunyi tanpa bukti.', evidenceIds: [] });
assert.strictEqual(aGhost.code, 'REJECT', '6C: ANALYSIS tanpa evidence REJECT');
console.log('6C OK: ANALYSIS tanpa evidence -> REJECT');

// 6D — INFERENCE tanpa evidence -> INSUFFICIENT berlabel, bukan VERIFIED
const i1 = verifier.verifyClaim({
  kind: 'INFERENCE',
  text: 'Persoalan zakat-pajak MSME bersifat struktural dan sistemik, bukan sekadar pengetahuan individual.',
  evidenceIds: []
});
assert.strictEqual(i1.code, 'INSUFFICIENT_EVIDENCE', '6D: INFERENCE -> INSUFFICIENT');
assert.notStrictEqual(i1.code, 'VERIFIED', '6D: INFERENCE TIDAK PERNAH VERIFIED');
assert.ok(/^Inferensi JIN:/i.test(i1.claim), '6D: klaim dilabel Inferensi JIN');
assert.strictEqual(i1.kind, 'INFERENCE', '6D: kind INFERENCE');
console.log('6D OK: INFERENCE -> INSUFFICIENT berlabel, tidak pernah VERIFIED');

// 6E — INFERENCE atas evidence konflik -> CONTRADICTED
const { store: cStore } = zakatStore();
const cfl = createConflictEvidence({ documentId: 'ZakatTax1.pdf', page: 5, candidates: [] });
cStore.add(cfl);
const cVerifier = new ClaimEvidenceVerifier(cStore);
const iCon = cVerifier.verifyClaim({
  kind: 'INFERENCE', text: 'Inferensi atas data bertentangan.', evidenceIds: [cfl.evidenceId]
});
assert.strictEqual(iCon.code, 'CONTRADICTED', '6E: INFERENCE konflik -> CONTRADICTED');
console.log('6E OK: INFERENCE konflik -> CONTRADICTED');

// 6F — composer: FACT+ANALYSIS disampaikan; INFERENCE di bawah label bukan-fakta
const v = verifier.verifyClaims([
  { kind: 'FACT', text: 'Kurang dari 50% MSME memahami zakat perniagaan dan pajak.', evidenceIds: [ev.angka.evidenceId] },
  {
    kind: 'ANALYSIS', text: 'Intervensi sosialisasi saja tidak cukup; perlu integrasi edukasi-administrasi-pencatatan.',
    evidenceIds: [ev.dilema.evidenceId, ev.akuntansi.evidenceId]
  },
  { kind: 'INFERENCE', text: 'Keterputusan normatif-administratif adalah akar struktural.', evidenceIds: [] }
]);
const composed = verifier.composeVerifiedAnswer('Jawaban Qwen.', v);
assert.ok(composed.text.includes('Kurang dari 50%'), '6F: FACT disampaikan');
assert.ok(composed.text.includes('ANALISIS JIN'), '6F: ANALYSIS dipisah berlabel');
assert.ok(/Inferensi JIN/i.test(composed.text) && /bukan fakta/i.test(composed.text), '6F: INFERENCE di bawah label bukan-fakta');
console.log('6F OK: composer berlapis FACT+ANALYSIS+INFERENCE');

// 6G — report permanen membawa kind
const report = verifier.buildReport(v);
assert.strictEqual(report.claims.length, 3, '6G: 3 klaim di report');
assert.deepStrictEqual(report.claims.map((c) => c.kind), ['FACT', 'ANALYSIS', 'INFERENCE'], '6G: kind per klaim');
assert.ok(report.claims.every((c) => Array.isArray(c.provenance)), '6G: provenance per klaim');
console.log('6G OK: report permanen {text,kind,status,evidenceIds,provenance}');

// 6H — backward compatible: klaim lama tanpa kind = FACT
const legacyClaim = verifier.verifyClaim({ text: 'Klaim lama.', evidenceIds: [ev.metode.evidenceId] });
assert.strictEqual(legacyClaim.kind, 'FACT', '6H: default kind FACT');
assert.strictEqual(legacyClaim.code, 'VERIFIED', '6H: klaim lama tetap VERIFIED');
const reasoner = new QwenEvidenceReasoner();
const envelope = { document: { documentId: 'ZakatTax1.pdf' }, evidence: [ev.metode] };
const contract = reasoner.contractFromEnvelope(envelope, 'apa metode?');
assert.ok(contract.documentId && contract.evidence.length === 1 && !('pdfBytes' in contract), '6H: kontrak boundary utuh');
console.log('6H OK: backward compatible FASE 3/4');

// 6I — prompt analitis memuat 3 lapisan + aturan kutip
const qwenSrc = fs.readFileSync('server/document/QwenEvidenceReasoner.mjs', 'utf8');
assert.ok(/ANALISIS JIN/.test(qwenSrc), '6I: prompt memuat ANALISIS JIN');
assert.ok(/INFERENSI JIN/.test(qwenSrc), '6I: prompt memuat INFERENSI JIN');
assert.ok(/Inferensi JIN:/.test(qwenSrc), '6I: label inferensi diwajibkan');
assert.ok(/FORBIDDEN/.test(qwenSrc) && /pdfBytes/.test(qwenSrc), '6I: boundary FASE 3 utuh');
console.log('6I OK: kontrak reasoning analitis FAKTA/ANALISIS/INFERENSI');

// 6J — matriks klaim-evidence ala ZakatTax
const matrix = verifier.verifyClaims([
  { kind: 'FACT', text: 'Penelitian menggunakan pendekatan kualitatif dengan desain studi kasus.', evidenceIds: [ev.metode.evidenceId] },
  { kind: 'FACT', text: 'Kurang dari 50% MSME memahami zakat perniagaan dan kewajiban pajak.', evidenceIds: [ev.angka.evidenceId] },
  { kind: 'FACT', text: 'MSME menghadapi dilema antara zakat sebagai beban pajak atau dua beban berbeda.', evidenceIds: [ev.dilema.evidenceId] },
  { kind: 'FACT', text: 'Tidak terdapat sistem akuntansi terintegrasi.', evidenceIds: [ev.akuntansi.evidenceId] },
  {
    kind: 'ANALYSIS', text: 'Literasi rendah -> administrasi lemah -> tanpa akuntansi terintegrasi -> dilema zakat-pajak.',
    evidenceIds: [ev.angka.evidenceId, ev.akuntansi.evidenceId, ev.dilema.evidenceId]
  },
  {
    kind: 'ANALYSIS', text: 'Sosialisasi saja tidak cukup; diperlukan integrasi edukasi, administrasi, pencatatan.',
    evidenceIds: [ev.akuntansi.evidenceId, ev.dilema.evidenceId]
  },
  { kind: 'INFERENCE', text: 'Masalah bersifat struktural-sistemik, bukan individual.', evidenceIds: [] }
]);
const mrep = verifier.buildReport(matrix);
console.log('MATRIKS KLAIM-EVIDENCE (ZakatTax1.pdf sintetis):');
for (const c of mrep.claims) {
  const pg = c.provenance.map((p) => p.page).filter((p) => p != null).join(',');
  console.log(` - [${c.kind} | ${c.status}] "${c.text.slice(0, 70)}..." ev=${c.evidenceIds.join(',') || '-'} hal=${pg || '-'}`);
}
assert.strictEqual(matrix.summary.verified, 6, '6J: 4 FACT + 2 ANALYSIS VERIFIED');
assert.strictEqual(matrix.summary.insufficient, 1, '6J: 1 INFERENCE INSUFFICIENT');
assert.strictEqual(matrix.summary.rejected, 0, '6J: tidak ada REJECT');
console.log('6J OK: matriks 4 FACT + 2 ANALYSIS VERIFIED, 1 INFERENCE berlabel');

console.log('PHASE6 ANALYTICAL REASONING PASS');

