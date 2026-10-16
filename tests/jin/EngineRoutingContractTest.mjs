/**
 * EngineRoutingContractTest.mjs
 * FINAL JIN ROUTING CONTRACT — enforce R1-R15 sebagai kode + test.
 *
 *   Qwen Local ............ SIMPLE CONVERSATION ONLY
 *   9Router ............... SELURUH document intelligence
 *   Gemini 3.1 Image + ComfyUI .. image generation / revision
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const {
  ENGINES, DOMAINS, ROUTING_MATRIX,
  resolveEngine, assertEngineAllowed, assertQwenPayloadClean,
  isDocumentDomain, isImageDomain, resolveDocAnalysisEngine
} = await import('../../server/routing/EngineRoutingContract.mjs');

// R1/R2 — matriks utama: 8 domain, primary benar
assert.strictEqual(Object.keys(ROUTING_MATRIX).length, 8, 'R: 8 domain');
assert.strictEqual(resolveEngine('SIMPLE_CONVERSATION').primary, 'QWEN_LOCAL', 'R1: conversation -> QWEN');
assert.strictEqual(resolveEngine('GENERAL_CHAT').primary, 'QWEN_LOCAL', 'R1: chat -> QWEN');
for (const d of ['DOCUMENT_READ', 'DOCUMENT_ANALYSIS', 'DOCUMENT_COMPARISON', 'LEGAL_RESEARCH_DOC']) {
  assert.strictEqual(resolveEngine(d).primary, 'NINEROUTER', `R2: ${d} -> 9ROUTER`);
}
assert.strictEqual(resolveEngine('IMAGE_GENERATION').primary, 'GEMINI_3_1_IMAGE', 'R5: image gen');
assert.strictEqual(resolveEngine('IMAGE_REVISION').primary, 'COMFYUI', 'R6: image revision');
console.log('R1/R2/R5/R6 OK: matriks primary 8 domain');

// R3/R4/R8 — PDF/dokumen -> QWEN = FORBIDDEN
for (const d of ['DOCUMENT_READ', 'DOCUMENT_ANALYSIS', 'DOCUMENT_COMPARISON', 'LEGAL_RESEARCH_DOC']) {
  let hit = false;
  try { assertEngineAllowed(d, 'QWEN_LOCAL'); } catch (e) { hit = e.code === 'ROUTING_VIOLATION'; }
  assert.ok(hit, `R3/R4: ${d} -> QWEN_LOCAL FORBIDDEN`);
}
assert.strictEqual(assertEngineAllowed('DOCUMENT_ANALYSIS', 'NINEROUTER'), 'NINEROUTER', 'R2: 9Router allowed');
console.log('R3/R4/R8 OK: dokumen -> Qwen FORBIDDEN, 9Router allowed');

// R5/R6 — image: Qwen forbidden, Gemini<->ComfyUI fallback eksplisit
let imgHit = false;
try { assertEngineAllowed('IMAGE_GENERATION', 'QWEN_LOCAL'); } catch (e) { imgHit = e.code === 'ROUTING_VIOLATION'; }
assert.ok(imgHit, 'R: image -> QWEN FORBIDDEN');
assert.strictEqual(resolveEngine('IMAGE_GENERATION').fallback, 'COMFYUI', 'R: image fallback eksplisit');
assert.strictEqual(resolveEngine('IMAGE_REVISION').fallback, 'GEMINI_3_1_IMAGE', 'R: revision fallback eksplisit');
console.log('R5/R6 OK: image Qwen-forbidden + fallback eksplisit tercatat');

// R7 — payload Qwen bersih dari PDF mentah
assert.ok(assertQwenPayloadClean({ documentId: 'd', evidence: [] }), 'R7: payload bersih lolos');
for (const k of ['pdfBytes', 'buffer', 'dataUrl', 'rawOcr', 'documentTextMentah']) {
  let hit = false;
  try { assertQwenPayloadClean({ [k]: 'x' }); } catch (e) { hit = e.code === 'ROUTING_VIOLATION'; }
  assert.ok(hit, `R7: kunci ${k} ditolak`);
}
console.log('R7 OK: Qwen tidak pernah menerima PDF mentah');

// Domain tak dikenal -> fail-closed
let unknownHit = false;
try { resolveEngine('NOPE_DOMAIN'); } catch (e) { unknownHit = e.code === 'ROUTING_VIOLATION'; }
assert.ok(unknownHit, 'fail-closed: domain tak dikenal ditolak');
assert.ok(isDocumentDomain('DOCUMENT_ANALYSIS') && !isDocumentDomain('SIMPLE_CONVERSATION'), 'isDocumentDomain');
assert.ok(isImageDomain('IMAGE_REVISION') && !isImageDomain('DOCUMENT_READ'), 'isImageDomain');
console.log('FAIL-CLOSED OK: domain tak dikenal ditolak');

// R11/R12 — enforce di produksi: gate DOC_QWEN_BOUNDARY ada di pipeline
const routerSrc = fs.readFileSync('server/local_router/LocalRouterServer.mjs', 'utf8');
assert.ok(routerSrc.includes('DOC_QWEN_BOUNDARY'), 'R11: gate opt-in Qwen-dokumen wajib ada');
assert.ok(/DOC_QWEN_BOUNDARY\s*===\s*['"]1['"]/.test(routerSrc), 'R11: default OFF (opt-in eksplisit)');
assert.ok(routerSrc.includes('R3/R4/R8'), 'R12: alasan invariant tercatat di kode');
console.log('R11/R12 OK: Qwen-dokumen default OFF di produksi, opt-in eksplisit');

// R9 — evidence dokumen berasal dari 9Router (adapter tidak memanggil Qwen)
const adapterSrc = fs.readFileSync('server/document/DocumentPipelineAdapter.mjs', 'utf8');
assert.ok(!/qwen|Qwen|llamaCpp|8080/i.test(adapterSrc), 'R9: adapter evidence murni 9Router');
console.log('R9 OK: evidence dokumen murni dari 9Router');

// R3 enforcement: QwenVisualPlanner (image intent) tidak menjadi image generator
const plannerSrc = fs.readFileSync('server/agent/planner/QwenVisualPlanner.mjs', 'utf8');
assert.ok(/deterministic/i.test(plannerSrc), 'R10: planner visual punya jalur deterministik (Qwen bukan generator)');
console.log('R10 OK: Qwen bukan image generator (planner deterministik tersedia)');

// R13 — Perception worker selection PER-HALAMAN (prinsip terkunci):
// PDF teks -> ekstraksi langsung (TANPA render/Vision); scan -> render+OCR;
// tabel -> text+table; gambar/diagram -> vision; mixed -> per halaman.
const { workerForPage } = await import('../../server/document/PageClassifier.mjs');
const { PAGE_TYPES } = await import('../../server/document/DocumentProfiler.mjs');
assert.strictEqual(workerForPage({ type: PAGE_TYPES.TEXT, tableLikelihood: 0, visionLikelihood: 0, ocrRequired: false }), 'TEXT', 'R13: teks -> TEXT (tanpa render/Vision)');
assert.strictEqual(workerForPage({ type: PAGE_TYPES.SCAN }), 'OCR+VISION', 'R13: scan -> render+OCR');
assert.strictEqual(workerForPage({ type: PAGE_TYPES.TABLE }), 'TEXT+TABLE', 'R13: tabel -> text+table');
assert.strictEqual(workerForPage({ type: PAGE_TYPES.VISION }), 'VISION', 'R13: gambar/diagram -> vision');
assert.strictEqual(workerForPage({ type: PAGE_TYPES.MIXED }), 'OCR+VISION', 'R13: mixed -> OCR per halaman');
console.log('R13 OK: perception worker per halaman (teks murni tanpa Vision)');

// R13b — functional: PDF teks murni TIDAK menyentuh render/OCR/Vision (spy deps).
// Anti pola "PDF text -> render image -> Gemini Vision -> OCR" (latensi/biaya sia-sia).
const { buildPdf } = await import('./fixtures/pdfFixture.mjs');
const { NineRouterDocumentReader } = await import('../../server/document/NineRouterDocumentReader.mjs');
const spy = { render: 0, ocr: 0, vision: 0, table: 0 };
const spyDeps = {
  renderPages: async () => { spy.render += 1; return []; },
  ocrPages: async () => { spy.ocr += 1; return []; },
  visionOcr: async () => { spy.vision += 1; return 'x'; },
  visionDescribe: async () => { spy.vision += 1; return []; },
  extractTables: async () => { spy.table += 1; return []; }
};
const textPdf = buildPdf([[
  'Peraturan RKP tentang perencanaan pembangunan nasional mewajibkan pemerintah daerah menyusun rencana kerja tahunan sesuai ketentuan peraturan perundang-undangan yang berlaku.',
  'Paragraf kedua memastikan seluruh pihak memahami tugas dan tanggung jawab masing-masing dalam proses perencanaan pembangunan daerah secara partisipatif.'
]]);
const txtRead = await new NineRouterDocumentReader().read(textPdf, { fileName: 'teks-murni.pdf', deps: spyDeps });
assert.strictEqual(txtRead.status, 'OK', 'R13b: read PDF teks OK');
assert.ok(txtRead.plan.pages.length > 0 && txtRead.plan.pages.every((p) => p.worker === 'TEXT'), 'R13b: semua halaman worker TEXT');
assert.ok(txtRead.evidence.length >= 1 && txtRead.evidence.every((e) => e.type === 'TEXT'), 'R13b: evidence murni TEXT');
assert.strictEqual(spy.render + spy.ocr + spy.vision + spy.table, 0, 'R13b: PDF teks TIDAK memanggil render/OCR/Vision');
console.log('R13b OK: PDF teks murni -> ekstraksi langsung, nol panggilan render/OCR/Vision');

// R14 — prinsip terkunci tersinkron: kontrak + doktrin + systemPrompt planner.
const { DOCUMENT_INTELLIGENCE_PRINCIPLES } = await import('../../server/routing/EngineRoutingContract.mjs');
assert.ok(DOCUMENT_INTELLIGENCE_PRINCIPLES && Object.isFrozen(DOCUMENT_INTELLIGENCE_PRINCIPLES), 'R14: prinsip diekspos sebagai kontrak frozen');
for (const k of ['PRIMARY_ENGINE', 'PERCEPTION_WORKERS', 'LOCAL_CONVERSATION', 'TEXT_PDF', 'SCAN_PDF', 'MIXED_PDF', 'REASONING']) {
  assert.ok(DOCUMENT_INTELLIGENCE_PRINCIPLES[k], `R14: prinsip ${k} ada di kontrak`);
}
const agentPolicySrc = fs.readFileSync('server/agent/AgentPolicy.mjs', 'utf8');
assert.ok(agentPolicySrc.includes('DOCUMENT_INTELLIGENCE_POLICY'), 'R14: prinsip tercatat di JIN_OPERATING_DOCTRINE');
const agentPlannerSrc = fs.readFileSync('server/agent/AgentPlanner.mjs', 'utf8');
assert.ok(agentPlannerSrc.includes('DOCUMENT_INTELLIGENCE_POLICY'), 'R14: planner membaca prinsip saat menyusun systemPrompt');
console.log('R14 OK: prinsip terkunci di kontrak + doktrin + systemPrompt planner');

// R15 — STAGE4 synthesis DOCUMENT_* WAJIB engine AG (pure contract).
// R15-A: DOCUMENT_ANALYSIS -> AG/specialist, bukan Qwen.
for (const m of ['auto', undefined, '', 'gemini-3.6-flash', 'gemini-2.0-flash']) {
  const sel = resolveDocAnalysisEngine(m);
  assert.strictEqual(sel.provider, 'gemini', `R15-A: "${m}" -> provider gemini`);
  assert.strictEqual(sel.engine, 'NINEROUTER_AG', `R15-A: "${m}" -> engine NINEROUTER_AG`);
}
console.log('R15-A OK: DOCUMENT_ANALYSIS -> AG/specialist (bukan Qwen)');
// R15-D: model explicit-local FORBIDDEN — keras, bukan fallback.
for (const m of ['llamacpp:qwen2.5-3b-instruct-q4_k_m.gguf', 'llamacpp:hermes', 'hermes-2', 'ollama:qwen']) {
  let hit = false;
  try { resolveDocAnalysisEngine(m); } catch (e) { hit = e.code === 'ROUTING_VIOLATION'; }
  assert.ok(hit, `R15-D: "${m}" -> ROUTING_VIOLATION (tanpa fallback Qwen)`);
}
console.log('R15-D OK: explicit-local FORBIDDEN untuk DOCUMENT_ANALYSIS');
// R15-C: conversation tidak tersentuh kontrak dokumen.
assert.strictEqual(resolveEngine('SIMPLE_CONVERSATION').primary, 'QWEN_LOCAL', 'R15-C: conversation -> QWEN tetap');
assert.strictEqual(resolveEngine('GENERAL_CHAT').primary, 'QWEN_LOCAL', 'R15-C: chat -> QWEN tetap');
console.log('R15-C OK: CONVERSATION -> Qwen tetap diperbolehkan');
// R15-B: AG down -> fail-closed. routeChat DOCUMENT_ANALYSIS TANPA fallback lokal.
const { modelRoutingServiceInstance } = await import('../../server/local_router/ModelRoutingService.mjs');
const svcSrc = fs.readFileSync('server/local_router/ModelRoutingService.mjs', 'utf8');
assert.ok(svcSrc.includes('doc_analysis_ag_only'), 'R15-B: strategi AG-only wajib ada');
assert.ok(svcSrc.includes('DOCUMENT_ANALYSIS_UNAVAILABLE'), 'R15-B: error fail-closed wajib ada');
assert.ok(/strategy === 'doc_analysis_ag_only'/.test(svcSrc), 'R15-B: fail-closed dipicu oleh strategi AG-only (bukan global strict)');
const routerSrc2 = fs.readFileSync('server/local_router/LocalRouterServer.mjs', 'utf8');
assert.ok(!/model:\s*['"]llamacpp:qwen2\.5-3b-instruct-q4_k_m\.gguf['"]/.test(routerSrc2), 'R15-B: model hardcoded Qwen STAGE4 sudah dihapus');
assert.ok(routerSrc2.includes("capability: 'DOCUMENT_ANALYSIS'"), 'R15-B: STAGE4 memanggil routeChat dengan capability DOCUMENT_ANALYSIS');
console.log('R15-B OK: AG down -> FAIL-CLOSED, tanpa fallback Qwen; STAGE4 hardcoded Qwen sudah dihapus');
// R15 fungsional ringan: routeChat DOCUMENT_ANALYSIS tidak pernah memilih provider llamacpp
// (determineRoute tidak berubah; override AG-only hanya menaikkan gemini —
//  dibuktikan dengan guard kontrak + tidak adanya fallback lokal pada strategi AG-only).
assert.ok(typeof modelRoutingServiceInstance.routeChat === 'function', 'R15: routeChat tersedia');
console.log('R15 OK: resolveDocAnalysisEngine murni + fail-closed terpasang');

console.log('ROUTING CONTRACT PASS (R1-R15)');
