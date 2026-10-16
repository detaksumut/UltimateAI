/**
 * NineRouterReaderPhase1Test.mjs
 * PHASE 1 automated architectural tests — 4 invariants:
 *   TEST 1: DOCUMENT_ANALYSIS wajib melewati 9Router (DOCUMENT_PIPELINE wiring target).
 *   TEST 2: PDF mixed -> reader berbeda per halaman (classifier per-page).
 *   TEST 3: Qwen contract hanya tersedia SETELAH Evidence ada (boundary).
 *   TEST 4: Claim tanpa evidenceId -> REJECT (UNVERIFIED).
 */
import assert from 'assert';
import fs from 'fs';

const readerSrc = fs.readFileSync('server/document/NineRouterDocumentReader.mjs', 'utf8');
const classifierSrc = fs.readFileSync('server/document/PageClassifier.mjs', 'utf8');
const evidenceSrc = fs.readFileSync('server/document/DocumentEvidence.mjs', 'utf8');

// TEST 1: controller adalah satu-satunya pintu DOCUMENT_ANALYSIS (phase 1: file ada + kontrak read).
assert(/class NineRouterDocumentReader/.test(readerSrc), 'TEST1: controller NineRouterDocumentReader wajib ada');
assert(/async read\(buffer/.test(readerSrc), 'TEST1: read(buffer, opts) wajib jadi pintu masuk');
console.log('TEST 1 OK: DOCUMENT_ANALYSIS -> NineRouterDocumentReader.read()');

// TEST 2: keputusan per-halaman, bukan per-file.
assert(/workerForPage/.test(classifierSrc), 'TEST2: workerForPage wajib ada');
assert(/buildExecutionPlan/.test(classifierSrc), 'TEST2: buildExecutionPlan wajib ada');
const { workerForPage } = await import('../../server/document/PageClassifier.mjs');
assert.strictEqual(workerForPage({ type: 'TEXT', tableLikelihood: 0, visionLikelihood: 0, ocrRequired: false }), 'TEXT');
assert.strictEqual(workerForPage({ type: 'SCAN', tableLikelihood: 0, visionLikelihood: 0.5, ocrRequired: true }), 'OCR+VISION');
assert.strictEqual(workerForPage({ type: 'TABLE', tableLikelihood: 0.8, visionLikelihood: 0, ocrRequired: false }), 'TEXT+TABLE');
assert.strictEqual(workerForPage({ type: 'VISION', tableLikelihood: 0, visionLikelihood: 0.9, ocrRequired: false }), 'VISION');
console.log('TEST 2 OK: TEXT/SCAN/TABLE/VISION -> worker berbeda per halaman');

// TEST 3: boundary — contract Qwen lahir dari evidence, bukan dari PDF mentah.
assert(/EVIDENCE BOUNDARY|buildQwenContract/.test(readerSrc), 'TEST3: reader wajib membangun Qwen contract dari evidence');
assert(/buildQwenContract/.test(evidenceSrc), 'TEST3: buildQwenContract wajib ada di evidence schema');
const { nineRouterDocumentReaderInstance } = await import('../../server/document/NineRouterDocumentReader.mjs');
const sampleText = 'BAB I Pasal 1 Pemerintah mengatur perencanaan. '.repeat(30);
const out = await nineRouterDocumentReaderInstance.read(Buffer.from(sampleText, 'utf-8'), { fileName: 'uu.txt', query: 'apa kewajiban?' });
assert.strictEqual(out.status, 'OK', 'reader teks harus OK');
assert(out.evidence.length > 0, 'evidence wajib ada sebelum contract');
assert(out.contract && out.contract.documentId && Array.isArray(out.contract.evidence), 'contract Qwen wajib {documentId,query,evidence}');
assert(!('pdfBytes' in (out.contract || {})), 'contract Qwen TIDAK BOLEH membawa PDF mentah');
console.log('TEST 3 OK: contract Qwen = {documentId,query,evidence}, tanpa PDF mentah');

// TEST 4: claim tanpa evidenceId -> REJECT.
const { DocumentEvidenceStore, createEvidence } = await import('../../server/document/DocumentEvidence.mjs');
const store = new DocumentEvidenceStore();
const ev = createEvidence({ documentId: 'd-test', page: 1, type: 'TEXT', content: 'Pasal 1' });
store.add(ev);
const okClaim = store.checkClaim({ text: 'pemerintah mengatur', evidenceIds: [ev.evidenceId] });
assert.strictEqual(okClaim.state, 'VERIFIED', 'claim ber-evidence harus VERIFIED');
const naked = store.checkClaim({ text: 'pemerintah mengatur', evidenceIds: [] });
assert.strictEqual(naked.state, 'UNVERIFIED', 'claim tanpa evidenceId harus REJECT/UNVERIFIED');
const ghost = store.checkClaim({ text: 'x', evidenceIds: ['EV-GHOST'] });
assert.strictEqual(ghost.state, 'UNVERIFIED', 'claim evidenceId asing harus REJECT');
assert(evidenceSrc.includes('CONFLICT'), 'schema wajib mengenal EVIDENCE_CONFLICT OCR/Vision');
console.log('TEST 4 OK: claim tanpa evidenceId -> REJECT');

console.log('PHASE1 4-INVARIANT PASS');
