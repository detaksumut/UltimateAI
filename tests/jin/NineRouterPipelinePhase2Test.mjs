/**
 * NineRouterPipelinePhase2Test.mjs
 * PHASE 2D — production path proof:
 *   PDF TEXT -> DOCUMENT_ANALYSIS -> LocalRouterServer -> 9Router
 *   -> Evidence -> existing analysis (doc.analyze downstream unchanged).
 */
import assert from 'assert';
import fs from 'fs';

const routerSrc = fs.readFileSync('server/local_router/LocalRouterServer.mjs', 'utf8');

// 2A: pintu production wajib 9Router, bukan doc.analyze langsung.
assert(routerSrc.includes('readViaNineRouter'), 'PHASE2-2A: DOCUMENT_PIPELINE wajib memanggil readViaNineRouter');
assert(routerSrc.includes('DocumentPipelineAdapter.mjs'), 'PHASE2-2A: adapter 9Router wajib di-import');
assert(routerSrc.includes('reading via 9Router'), 'PHASE2-2A: log production wajib menandai jalur 9Router');
assert(routerSrc.includes('9Router read status='), 'PHASE2-2A: log wajib memuat status/documentId/pages/evidence/plan');
console.log('PHASE 2A OK: DOCUMENT_PIPELINE -> NineRouterDocumentReader.read()');

// 2B: downstream lama dipertahankan (no regresi).
assert(routerSrc.includes('nineRouterLegacy.documentText'), 'PHASE2-2B: doc.analyze wajib menerima teks via adapter');
assert(routerSrc.includes('documentIntelligenceToolInstance.execute'), 'PHASE2-2B: DocumentIntelligenceTool tetap downstream');
console.log('PHASE 2B OK: 9Router normalized -> legacy contract -> existing downstream');

// 2C: evidence menjadi output resmi.
assert(routerSrc.includes('evidenceEnvelope'), 'PHASE2-2C: envelope evidence wajib dibangun');
assert(routerSrc.includes('nineRouter:'), 'PHASE2-2C: _agent.docMeta.nineRouter wajib ada');
assert(routerSrc.includes('executionPlan'), 'PHASE2-2C: executionPlan wajib terekspos');
console.log('PHASE 2C OK: output resmi = document/pages/blocks/evidence/executionPlan');

// Functional: adapter end-to-end (teks -> evidence -> legacy input).
const { readViaNineRouter } = await import('../../server/document/DocumentPipelineAdapter.mjs');
const sample = 'BAB I Pasal 1 Pemerintah mengatur perencanaan. Pasal 2 Pemerintah daerah melaksanakan. '.repeat(20);
const via = await readViaNineRouter({ text: sample, fileName: 'uu.txt', query: 'kewajiban siapa?' });
assert.strictEqual(via.output.status, 'OK', 'adapter read harus OK');
assert(via.legacy.documentText.length > 100, 'legacy documentText wajib terisi dari evidence');
assert(via.envelope && Array.isArray(via.envelope.evidence) && via.envelope.evidence.length > 0, 'envelope evidence wajib ada');
assert(Array.isArray(via.envelope.executionPlan), 'envelope executionPlan wajib ada');
assert(via.envelope.contract && via.envelope.contract.documentId, 'envelope contract Qwen wajib ada');
console.log('ADAPTER OK: evidence -> legacy input:', via.legacy.documentText.length, 'chars,', via.envelope.evidence.length, 'evidence');

// Downstream lama tetap bekerja di atas output adapter (no regresi).
const { documentIntelligenceToolInstance } = await import('../../server/tools/DocumentIntelligenceTool.mjs');
const docResult = await documentIntelligenceToolInstance.execute({
  documentText: via.legacy.documentText,
  query: 'kewajiban siapa?',
  fileName: via.legacy.fileName,
  mode: 'full_document'
});
assert(docResult.totalChunks > 0, 'doc.analyze downstream wajib tetap menghasilkan chunks');
assert(docResult.coveragePercent > 0, 'coverage wajib > 0');
console.log('DOWNSTREAM OK: chunks=', docResult.totalChunks, 'coverage=', docResult.coveragePercent + '%');

// Tidak ada jalur langsung yang melewati 9Router di DOCUMENT_ANALYSIS.
const directCalls = (routerSrc.match(/documentIntelligenceToolInstance\.execute/g) || []).length;
assert(directCalls >= 1, 'downstream doc.analyze tetap dipanggil (via adapter)');
assert(!/DOCUMENT_ANALYSIS[\s\S]{0,2000}documentIntelligenceToolInstance\.execute\(\{\s*documentText,/.test(routerSrc),
  'tidak boleh ada pemanggilan doc.analyze({documentText}) mentah di jalur DOCUMENT_ANALYSIS');
console.log('NO-BYPASS OK: tidak ada jalur langsung melewati 9Router');

console.log('PHASE2 PRODUCTION-PATH PASS');
