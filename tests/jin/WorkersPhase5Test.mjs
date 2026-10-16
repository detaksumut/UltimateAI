/**
 * WorkersPhase5Test.mjs
 * PHASE 5 — TEXT + OCR + VISION + TABLE E2E menghasilkan evidence BER-TIPE
 * yang meet di EvidenceStore, bukan dipaksa jadi documentText.
 *   5A TEXT PDF     -> TEXT evidence (E2E pdf-parse)
 *   5B OCR worker   -> OCR typed + confidence
 *   5C OCR lemah    -> vision setuju -> dinaikkan; beda -> CONFLICT
 *   5E TABLE        -> structure columns/rows + numeric consistency
 *   5F VISION       -> deskripsi visual + confidence
 *   5G mixed PDF    -> per-page routing -> 4 tipe di 1 store
 *   5H verifier     -> klaim atas OCR/TABLE/VISION; CONFLICT -> CONTRADICTED
 *   5I no bypass    -> workers tidak panggil Qwen; output hanya via store
 *   5J legacy       -> typed evidence tetap menghasilkan documentText lama
 * Semua worker menerima deps DI (deterministik, tanpa jaringan).
 */
import assert from 'assert';
import fs from 'fs';
import { buildPdf } from './fixtures/pdfFixture.mjs';

const { runOCRWorker, runVisionWorker, runTableWorker, estimateOcrConfidence } =
  await import('../../server/document/PageWorkers.mjs');
const { NineRouterDocumentReader } = await import('../../server/document/NineRouterDocumentReader.mjs');
const { ClaimEvidenceVerifier } = await import('../../server/document/ClaimEvidenceVerifier.mjs');
const { DocumentEvidenceStore, createConflictEvidence, EVIDENCE_TYPES } =
  await import('../../server/document/DocumentEvidence.mjs');
const { toLegacyDocumentInput } = await import('../../server/document/DocumentPipelineAdapter.mjs');

const TEXT_PAGE = [
  'Peraturan Presiden tentang perencanaan pembangunan nasional menjelaskan bahwa pemerintah daerah wajib menyusun rencana kerja setiap tahun sesuai ketentuan yang berlaku.',
  'Paragraf kedua memastikan seluruh pihak memahami tugas dan tanggung jawab masing masing dalam proses perencanaan tersebut.'
];
const TABLE_PAGE = [
  'TABEL 1 REKAP ANGGARAN 2024',
  'Tahun   Anggaran   Realisasi',
  '2022    1200       1150',
  '2023    1400       1390',
  '2024    1600       1520',
  '2025    1800       1710',
  '2026    2000       1980',
  '2027    2200       2150',
  'Catatan sumber data dari Kementerian Keuangan Republik Indonesia untuk periode berjalan.'
];
const VISION_PAGE = [
  'GRAFIK 1 menunjukkan tren pertumbuhan ekonomi regional dari tahun 2018 sampai 2024 dengan kenaikan signifikan pada akhir periode.',
  'Sumbu horizontal menunjukkan tahun dan sumbu vertical menunjukkan persentase pertumbuhan terhadap produk domestik bruto nasional.'
];
const SCAN_PAGE = ['Hal']; // contentChars < 100 -> SCAN

const OCR_TEXT = 'Dokumen scan ini berisi teks peraturan daerah yang cukup panjang untuk memperoleh confidence tinggi dari heuristic karena terdiri dari banyak kata yang terbaca dengan baik oleh mesin optik karakter.';
const OCR_LOW = 'Anggaran naik menjadi 1200';

const deps = {
  renderPages: async (buffer, pages) => pages.map((p) => ({ pageNumber: p, buffer: Buffer.from('png') })),
  ocrPages: async (rendered) => rendered.map((r) => `### HALAMAN ${r.pageNumber} ###\n${OCR_TEXT}`).join('\n'),
  visionOcr: async () => OCR_TEXT,
  visionDescribe: async (rendered) => rendered.map((r) => ({
    pageNumber: r.pageNumber, text: 'Grafik menunjukkan tren pertumbuhan ekonomi regional yang meningkat.', confidence: 0.85
  })),
  extractTables: async (buffer, pages) => pages.map((p) => ({
    page: p,
    tables: [[['Tahun', 'Anggaran', 'Realisasi'], ['2022', '1200', '1150'], ['2023', '1400', '1390'], ['2024', '1600', '1520']]]
  }))
};

// 5A — TEXT PDF E2E via pdf-parse asli
const reader = new NineRouterDocumentReader();
const outText = await reader.read(buildPdf([TEXT_PAGE]), { fileName: 'uu.pdf', query: 'apa kewajiban?' });
assert.strictEqual(outText.status, 'OK', '5A: read OK');
assert.strictEqual(outText.evidence.length, 1, '5A: 1 evidence');
assert.strictEqual(outText.evidence[0].type, 'TEXT', '5A: type TEXT');
assert(outText.evidence[0].confidence >= 0.9, '5A: confidence >= 0.9');
assert.strictEqual(outText.evidence[0].page, 1, '5A: page 1');
assert.strictEqual(outText.evidence[0].documentId, outText.documentId, '5A: provenance documentId');
assert.strictEqual(outText.contract.evidence[0].type, 'TEXT', '5A: contract membawa type');
console.log('5A OK: TEXT PDF -> TEXT evidence typed');

// 5B — OCR worker typed + confidence (tanpa cross-check bila yakin)
const ocrHigh = await runOCRWorker({ buffer: Buffer.from('pdf'), pageNumbers: [4], deps });
assert.strictEqual(ocrHigh.length, 1, '5B: 1 payload');
assert.strictEqual(ocrHigh[0].type, 'OCR', '5B: type OCR');
assert(ocrHigh[0].confidence >= 0.75, `5B: confidence >= 0.75 (dapat ${ocrHigh[0].confidence})`);
assert.strictEqual(ocrHigh[0].structure.crosschecked, false, '5B: belum cross-check');
assert(ocrHigh[0].content.includes('peraturan daerah'), '5B: content teks OCR');
assert(estimateOcrConfidence(OCR_TEXT) >= 0.75, '5B: heuristik OCR panjang >= threshold');
console.log('5B OK: OCR worker -> OCR evidence typed conf=', ocrHigh[0].confidence);

// 5C — OCR lemah + vision setuju -> cross-check, confidence dinaikkan
const lowDeps = { ...deps, ocrPages: async () => OCR_LOW, visionOcr: async () => 'Anggaran naik menjadi 1300 tahun' };
const ocrAgree = await runOCRWorker({ buffer: Buffer.from('pdf'), pageNumbers: [4], deps: lowDeps });
assert.strictEqual(ocrAgree[0].type, 'OCR', '5C: tetap OCR');
assert.strictEqual(ocrAgree[0].structure.crosschecked, true, '5C: cross-checked');
assert(ocrAgree[0].confidence >= 0.75, `5C: confidence dinaikkan (dapat ${ocrAgree[0].confidence})`);
assert(ocrAgree[0].source.includes('vision-crosscheck'), '5C: source ditandai');
console.log('5C OK: OCR lemah + vision setuju -> conf', ocrAgree[0].confidence);

// 5D — OCR lemah + vision beda -> CONFLICT (tidak dipilih diam-diam)
const conflictDeps = { ...deps, ocrPages: async () => OCR_LOW, visionOcr: async () => 'Stempel dinas terlihat pada halaman arsip' };
const ocrConflict = await runOCRWorker({ buffer: Buffer.from('pdf'), pageNumbers: [4], deps: conflictDeps });
assert.strictEqual(ocrConflict[0].type, 'CONFLICT', '5D: mismatch -> CONFLICT');
assert.strictEqual(ocrConflict[0].structure.candidates.length, 2, '5D: dua kandidat tersimpan');
console.log('5D OK: OCR vs Vision mismatch -> EVIDENCE_CONFLICT');

// 5E — TABLE worker: structure + numeric consistency
const tableOut = await runTableWorker({ buffer: Buffer.from('pdf'), pageNumbers: [2], deps });
assert.strictEqual(tableOut[0].type, 'TABLE', '5E: type TABLE');
assert.deepStrictEqual(tableOut[0].structure.columns, ['Tahun', 'Anggaran', 'Realisasi'], '5E: columns');
assert.strictEqual(tableOut[0].structure.rows.length, 3, '5E: 3 baris data');
assert(tableOut[0].confidence >= 0.9, `5E: consistency tinggi (dapat ${tableOut[0].confidence})`);
assert(tableOut[0].content.startsWith('Kolom:'), '5E: content ter-serialize');
console.log('5E OK: TABLE structure+consistency conf=', tableOut[0].confidence);

// 5F — VISION worker: deskripsi + confidence
const visionOut = await runVisionWorker({ buffer: Buffer.from('pdf'), pageNumbers: [3], deps });
assert.strictEqual(visionOut[0].type, 'VISION', '5F: type VISION');
assert(visionOut[0].content.includes('Grafik'), '5F: deskripsi visual');
assert(visionOut[0].confidence >= 0.8, '5F: confidence >= 0.8');
console.log('5F OK: VISION deskripsi conf=', visionOut[0].confidence);

// 5G — mixed PDF: per-page routing -> 4 tipe evidence di 1 store
const mixed = buildPdf([TEXT_PAGE, TABLE_PAGE, VISION_PAGE, SCAN_PAGE]);
const outMix = await reader.read(mixed, { fileName: 'campuran.pdf', query: 'apa isinya?', deps });
assert.strictEqual(outMix.status, 'OK', '5G: read OK');
const workerSeq = outMix.plan.pages.map((p) => p.worker);
assert.deepStrictEqual(workerSeq, ['TEXT', 'TEXT+TABLE', 'VISION', 'OCR+VISION'], `5G: routing per halaman (dapat ${JSON.stringify(workerSeq)})`);
const types = [...new Set(outMix.evidence.map((e) => e.type))].sort();
assert.deepStrictEqual(types, ['OCR', 'TABLE', 'TEXT', 'VISION'], `5G: 4 tipe evidence berbeda (dapat ${JSON.stringify(types)})`);
assert.strictEqual(outMix.store.size(), outMix.evidence.length, '5G: semua evidence meet di store');
for (const e of outMix.evidence) {
  assert.strictEqual(e.documentId, outMix.documentId, '5G: provenance documentId');
  assert(Number.isFinite(e.page) && e.page >= 1, '5G: provenance page');
  assert(e.blockId, '5G: provenance blockId');
}
// Tipe TIDAK dipaksa jadi documentText: struktur tabel tetap ada di store.
const tableEv = outMix.evidence.find((e) => e.type === 'TABLE');
assert(Array.isArray(tableEv.structure.columns), '5G: structure tabel tersimpan di store');
const contractTypes = [...new Set(outMix.contract.evidence.map((e) => e.type))].sort();
assert.deepStrictEqual(contractTypes, ['OCR', 'TABLE', 'TEXT', 'VISION'], '5G: contract Qwen membawa keempat tipe');
console.log('5G OK: mixed PDF -> 4 tipe evidence di 1 store:', JSON.stringify(types));

// 5H — verifier atas typed evidence: OCR/TABLE/VISION -> VERIFIED; CONFLICT -> CONTRADICTED
const verifier = new ClaimEvidenceVerifier(outMix.store);
const ocrEv = outMix.evidence.find((e) => e.type === 'OCR');
const visionEv = outMix.evidence.find((e) => e.type === 'VISION');
const vOcr = verifier.verifyClaim({ text: 'Teks scan peraturan daerah terbaca.', evidenceIds: [ocrEv.evidenceId] });
const vTbl = verifier.verifyClaim({ text: 'Anggaran 2023 = 1400.', evidenceIds: [tableEv.evidenceId] });
const vVis = verifier.verifyClaim({ text: 'Grafik menunjukkan tren pertumbuhan.', evidenceIds: [visionEv.evidenceId] });
assert.strictEqual(vOcr.code, 'VERIFIED', '5H: klaim OCR -> VERIFIED');
assert.strictEqual(vTbl.code, 'VERIFIED', '5H: klaim TABLE -> VERIFIED');
assert.strictEqual(vVis.code, 'VERIFIED', '5H: klaim VISION -> VERIFIED');
// CONFLICT dari store -> CONTRADICTED (skenario 5D lewat store)
const conflictStore = new DocumentEvidenceStore();
const cEv = conflictStore.add(createConflictEvidence({
  documentId: 'doc-X', page: 4, blockId: 'p4-b1',
  candidates: ocrConflict[0].structure.candidates
}));
const vCon = new ClaimEvidenceVerifier(conflictStore).verifyClaim({ text: 'Anggaran 1200.', evidenceIds: [cEv.evidenceId] });
assert.strictEqual(vCon.code, 'CONTRADICTED', '5H: CONFLICT evidence -> CONTRADICTED');
const rep = new ClaimEvidenceVerifier(outMix.store).buildReport(verifier.verifyClaims([
  { text: 'A', evidenceIds: [ocrEv.evidenceId] }, { text: 'B', evidenceIds: ['EV-GHOST'] }
]));
assert.strictEqual(rep.claims[0].status, 'VERIFIED', '5H: report VERIFIED');
assert.strictEqual(rep.claims[1].status, 'REJECT', '5H: report REJECT');
console.log('5H OK: verifier gate atas OCR/TABLE/VISION + CONFLICT->CONTRADICTED');

// 5I — no bypass: worker/reader tidak memanggil Qwen; hanya via store
const workerSrc = fs.readFileSync('server/document/PageWorkers.mjs', 'utf8');
const readerSrc = fs.readFileSync('server/document/NineRouterDocumentReader.mjs', 'utf8');
assert(!/llamaCpp|QwenEvidenceReasoner|\/v1\/chat\/completions/i.test(workerSrc), '5I: workers tidak memanggil Qwen/LLM');
assert(!/llamaCpp|QwenEvidenceReasoner|\/v1\/chat\/completions/i.test(readerSrc), '5I: reader tidak memanggil Qwen/LLM');
assert(readerSrc.includes('runOCRWorker') && readerSrc.includes('runVisionWorker') && readerSrc.includes('runTableWorker'), '5I: reader mengeksekusi ketiga worker');
assert(readerSrc.includes('store.add'), '5I: semua payload meet di store');
console.log('5I OK: workers -> store only; tanpa panggilan Qwen');

// 5J — legacy adapter tetap menghasilkan documentText dari typed evidence
const legacy = toLegacyDocumentInput(outMix, { documentText: '', fileName: 'campuran.pdf' });
assert(legacy.documentText.includes('Peraturan Presiden'), '5J: teks TEXT ikut');
assert(legacy.documentText.includes('Kolom:'), '5J: teks TABLE ikut (serialize)');
assert(legacy.documentText.includes('Dokumen scan ini'), '5J: teks OCR ikut');
assert(legacy.documentText.includes('Grafik menunjukkan'), '5J: deskripsi VISION ikut');
assert.strictEqual(legacy.meta.evidenceCount, 4, '5J: meta evidence 4');
console.log('5J OK: legacy downstream tetap menerima documentText dari 4 tipe');

console.log('PHASE5 WORKERS E2E PASS');

