/**
 * AnalyticalDepthPhase6bTest.mjs
 * FASE 6b — KEDALAMAN analitis: kontrak reasoning dipaksa melewati
 * READ -> FACT -> RELATIONSHIP -> CONCEPTUAL CONSISTENCY -> METHODOLOGY
 *        -> ANOMALY -> INFERENCE -> VERIFIED (bukan ringkasan berjudul ANALISIS).
 *
 * Kasus uji: gaya "The Influence.pdf" — 3 variabel semuanya (+) signifikan,
 * metode "kualitatif" tapi terminologi hasil "efek signifikan".
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const {
  DocumentEvidenceStore, createEvidence
} = await import('../../server/document/DocumentEvidence.mjs');
const { ClaimEvidenceVerifier } = await import('../../server/document/ClaimEvidenceVerifier.mjs');
const { QwenEvidenceReasoner, parseClaims } = await import('../../server/document/QwenEvidenceReasoner.mjs');

// ---- 6b-A: kontrak prompt memuat 4 tahap analitis ----
const qwenSrc = fs.readFileSync('server/document/QwenEvidenceReasoner.mjs', 'utf8');
assert.ok(/A\. HUBUNGAN/.test(qwenSrc), '6b-A: tahap A HUBUNGAN wajib');
assert.ok(/B\. KONSISTENSI KONSEP/.test(qwenSrc), '6b-A: tahap B KONSISTENSI KONSEP wajib');
assert.ok(/C\. METODOLOGI/.test(qwenSrc), '6b-A: tahap C METODOLOGI wajib');
assert.ok(/D\. ANOMALI/.test(qwenSrc), '6b-A: tahap D ANOMALI wajib');
assert.ok(/tidak otomatis berarti/i.test(qwenSrc), '6b-A: guard positif != baik wajib');
assert.ok(/Perlu verifikasi metodologis/.test(qwenSrc), '6b-A: penanda verifikasi metodologis wajib');
assert.ok(/BUKAN analisis/.test(qwenSrc), '6b-A: anti-repeat (ringkasan ulang bukan analisis)');
assert.ok(/jangan dibalik/.test(qwenSrc), '6b-A: anomali dilarang dibalik/dipaksa selaras');
console.log('6b-A OK: prompt memaksa 4 tahap analitis + guard normatif + anti-repeat');

// ---- evidence Influence-like ----
function influenceStore() {
  const store = new DocumentEvidenceStore('The-Influence.pdf');
  const mk = (page, content) => createEvidence({
    documentId: 'The-Influence.pdf', page, type: 'TEXT', source: 'pdf-text', content, confidence: 0.92
  });
  const ev = {
    lit: mk(1, 'Literasi finansial mempunyai efek positif dan signifikan terhadap perilaku finansial mahasiswa pengguna PayLater.'),
    imp: mk(2, 'Perilaku belanja impulsif mempunyai efek positif dan signifikan terhadap perilaku finansial mahasiswa.'),
    lif: mk(3, 'Gaya hidup mempunyai efek positif dan signifikan terhadap perilaku finansial mahasiswa.'),
    met: mk(4, 'Penelitian ini menggunakan pendekatan kualitatif dengan teknik sampel purposif pada mahasiswa Program Studi Bisnis.'),
    res: mk(5, 'Bagian hasil melaporkan pengaruh positif dan signifikan dengan taraf signifikan 0,05 terhadap perilaku finansial.')
  };
  for (const e of Object.values(ev)) store.add(e);
  return { store, ev };
}
const { store, ev } = influenceStore();
const knownIds = Object.values(ev).map((e) => e.evidenceId);


// ---- 6b-B: parseClaims deterministik pada jawaban berstruktur ----
const canned = [
  '1) RINGKASAN EKSEKUTIF',
  `Penelitian menguji tiga faktor terhadap perilaku finansial mahasiswa pengguna PayLater [${ev.lit.evidenceId}].`,
  '2) FAKTA KUNCI',
  `- Literasi finansial dilaporkan berpengaruh positif dan signifikan [${ev.lit.evidenceId}].`,
  `- Perilaku belanja impulsif dilaporkan berpengaruh positif dan signifikan [${ev.imp.evidenceId}].`,
  `- Gaya hidup dilaporkan berpengaruh positif dan signifikan [${ev.lif.evidenceId}].`,
  `- Penelitian menggunakan pendekatan kualitatif dengan teknik sampel purposif [${ev.met.evidenceId}].`,
  '3) ANALISIS JIN',
  `- Hubungan: literasi finansial, belanja impulsif, dan gaya hidup semuanya diarahkan ke satu variabel akhir, perilaku finansial [${ev.lit.evidenceId}][${ev.imp.evidenceId}][${ev.lif.evidenceId}].`,
  `- Konsistensi konsep: arah positif pada belanja impulsif tidak boleh dibaca sebagai "baik" sebelum definisi operasional dan instrumen perilaku finansial diperiksa [${ev.imp.evidenceId}][${ev.res.evidenceId}].`,
  `- Perlu verifikasi metodologis: pendekatan kualitatif memakai istilah "efek signifikan" — periksa jumlah responden, instrumen, dan pengujian statistik yang digunakan [${ev.met.evidenceId}][${ev.res.evidenceId}].`,
  `- Anomali: ketiga variabel dilaporkan semuanya positif dan signifikan — konsistensi arah ini perlu dibaca bersama konstruk pengukuran perilaku finansial [${ev.lit.evidenceId}][${ev.imp.evidenceId}][${ev.lif.evidenceId}][${ev.res.evidenceId}].`,
  '4) INFERENSI JIN',
  'Inferensi JIN: PayLater kemungkinan menciptakan lingkungan tempat pengetahuan finansial, kecenderungan konsumsi, dan gaya hidup saling berinteraksi pada keputusan keuangan mahasiswa.',
  '5) KESIMPULAN',
  `Kesimpulan: makna substantif dari arah positif bergantung pada definisi instrumen perilaku finansial [${ev.res.evidenceId}].`,
  `- Penelitian menggunakan pendekatan kualitatif dengan teknik sampel purposif [${ev.met.evidenceId}].` // duplikat FAKTA -> dedupe
].join('\n');

const claims = parseClaims(canned, knownIds);
const kindOf = (t) => claims.filter((c) => c.kind === t);
assert.strictEqual(kindOf('FACT').length, 6, `6b-B: 6 FACT (ringkasan+4fakta+kesimpulan), dapat ${kindOf('FACT').length}`);
assert.strictEqual(kindOf('ANALYSIS').length, 4, `6b-B: 4 ANALYSIS (hubungan/konsistensi/metodologi/anomali), dapat ${kindOf('ANALYSIS').length}`);
assert.strictEqual(kindOf('INFERENCE').length, 1, '6b-B: 1 INFERENCE');
const dupCount = claims.filter((c) => /sampel purposif/.test(c.text)).length;
assert.strictEqual(dupCount, 1, `6b-B: dedupe (purposif muncul 1x, dapat ${dupCount})`);
const meth = kindOf('ANALYSIS').find((c) => /metodologis/.test(c.text));
assert.ok(meth && meth.evidenceIds.length === 2, '6b-B: klaim metodologi ber-kutipan 2 evidence');
const anom = kindOf('ANALYSIS').find((c) => /Anomali/.test(c.text));
assert.ok(anom && anom.evidenceIds.length === 4, '6b-B: klaim anomali ber-kutipan 4 evidence');
console.log('6b-B OK: parse -> 6F + 4A (hubungan/konsistensi/metodologi/anomali) + 1I, dedupe aktif');

// ---- 6b-C: verifier atas klaim berstruktur ----
const verifier = new ClaimEvidenceVerifier(store);
const v = verifier.verifyClaims(claims);
assert.strictEqual(v.summary.rejected, 0, '6b-C: tidak ada REJECT (semua FACT/ANALYSIS berkutipan)');
assert.strictEqual(v.summary.insufficient, 1, '6b-C: 1 INFERENCE -> INSUFFICIENT');
assert.strictEqual(v.summary.verified, 10, `6b-C: 10 VERIFIED (6F+4A), dapat ${v.summary.verified}`);
const report = verifier.buildReport(v);
const methClaim = report.claims.find((c) => /metodologis/.test(c.text));
assert.ok(methClaim && methClaim.kind === 'ANALYSIS' && methClaim.status === 'VERIFIED', '6b-C: klaim metodologi VERIFIED');
assert.deepStrictEqual(methClaim.provenance.map((p) => p.page), [4, 5], '6b-C: provenance metodologi hal 4+5');
const infClaim = report.claims.find((c) => c.kind === 'INFERENCE');
assert.ok(infClaim && infClaim.status !== 'VERIFIED' && /^Inferensi JIN/i.test(infClaim.text), '6b-C: INFERENCE berlabel, tidak VERIFIED');
const composed = verifier.composeVerifiedAnswer('jawaban', v);
assert.ok(composed.text.includes('ANALISIS JIN'), '6b-C: composer memuat blok ANALISIS');
assert.ok(/bukan fakta/i.test(composed.text), '6b-C: inferensi di bawah label bukan-fakta');
console.log('6b-C OK: verifier -> 10V/1I/0R; metodologi VERIFIED hal 4+5; INFERENCE berlabel');

// ---- 6b-D: live Qwen — apakah benar-benar beranalisis, bukan ringkasan? ----
const reasoner = new QwenEvidenceReasoner();
let live = null;
try {
  live = await reasoner.reasonOverEvidence({
    documentId: 'The-Influence.pdf',
    query: 'Analisis hubungan antarvariabel, konsistensi konsep, dan metodologi penelitian ini.',
    evidence: store.all()
  }, { timeoutMs: 150000 });
} catch (err) {
  console.log('6b-D LIVE SKIPPED (exception):', err.message);
}
if (!live || live.status === 'REASONER_UNAVAILABLE') {
  console.log('6b-D LIVE SKIPPED (jujur): Qwen :8080 absen — unit tetap membuktikan kontrak.');
} else {
  console.log(`6b-D LIVE status=${live.status} claims=${live.claims.length}`);
  const lv = new ClaimEvidenceVerifier(store).verifyClaims(live.claims);
  const lvReport = new ClaimEvidenceVerifier(store).buildReport(lv);
  for (const c of lvReport.claims) {
    const pg = (c.provenance || []).map((p) => p.page).filter((x) => x != null).join(',');
    console.log(` - [${c.kind} | ${c.status}] "${String(c.text).slice(0, 90)}..." ev=${(c.evidenceIds || []).join(',') || '-'} hal=${pg || '-'}`);
  }
  assert.ok(live.claims.some((c) => c.kind === 'ANALYSIS'), '6b-D: live menghasilkan klaim ANALYSIS');
  const hasMethodLens = /metodolog|instrumen|responden|pengujian/i.test(live.answer);
  const hasConceptGuard = /definisi|instrumen|konstruk|operasional/i.test(live.answer);
  console.log(`6b-D LIVE lens: metodologi=${hasMethodLens} konsistensi-konsep=${hasConceptGuard}`);
  assert.ok(hasMethodLens || hasConceptGuard, '6b-D: jawaban live membawa lensa metodologi/konsistensi');
  console.log('6b-D OK: live Qwen beranalisis (hubungan + lensa metodologi/konsep)');
}

console.log('PHASE6b ANALYTICAL DEPTH PASS');

