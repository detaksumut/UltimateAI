/**
 * LegalAuditCapabilityTest.mjs
 * LEGAL_AUDIT capability contract for JIN (Audit Justice + Audit Kebijakan Publik).
 *
 * Guarantees:
 *  - legal.audit is a REGISTERED capability (not router-only).
 *  - Intent gate classifies legal/policy document audit as LEGAL_AUDIT with the
 *    correct audit focus, and never downgrades it to DOCUMENT_ANALYSIS.
 *  - Planner produces a deterministic LEGAL_AUDIT plan bound to legal.audit.
 *  - Verifier refuses to certify an empty/short audit report (honest verification).
 *  - Router fast-path and SemanticIntentEngine share one lexicon (no divergence).
 *
 * Run: node tests/legal/LegalAuditCapabilityTest.mjs
 */
import assert from 'assert';
import fs from 'fs';

import { capabilityRegistryInstance, CAPABILITY_REGISTRY, getCapabilityPromptContext } from '../../server/grounding/CapabilityRegistry.mjs';
import { semanticIntentEngineInstance } from '../../server/agent/SemanticIntentEngine.mjs';
import { AgentPlanner } from '../../server/agent/AgentPlanner.mjs';
import { AgentVerifier } from '../../server/agent/AgentVerifier.mjs';
import { detectLegalAuditIntent } from '../../server/tools/LegalAuditTool.mjs';
import { extractEmbeddedDocumentBlocks } from '../../server/tools/DocumentParser.mjs';

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ [FAIL] ${name} — ${err.message}`);
  }
}

const HUKUM_TURN = [
  'Tolong audit dokumen hukum ini dan cari kelemahan hukumnya.',
  '',
  '--- [BERKAS DOKUMEN TERLAMPIR: Putusan_123_Pid_B_2026.pdf] ---',
  'PUTUSAN Nomor 123/Pid.B/2026/PN.Mdn atas equiparama Clarity Skill.',
  '--- [AKHIR DOKUMEN: Putusan_123_Pid_B_2026.pdf] ---'
].join('\n');

const KEBIJAKAN_TURN = [
  'Lakukan audit kebijakan publik atas peraturan pemerintah ini.',
  '',
  '--- [BERKAS DOKUMEN TERLAMPIR: PP_12_2026.pdf] ---',
  'PERATURAN PEMERINTAH NOMOR 12 TAHUN 2026 tentang pengelolaan APBD.',
  '--- [AKHIR DOKUMEN: PP_12_2026.pdf] ---'
].join('\n');

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: LegalAuditCapabilityTest — Audit Justice & Audit Kebijakan');
console.log('═══════════════════════════════════════════════════════════════════════\n');

console.log('[1] Capability registration');
check('legal.audit is registered in CAPABILITY_REGISTRY', () => {
  assert.ok(CAPABILITY_REGISTRY['legal.audit'], 'legal.audit missing from registry');
  assert.strictEqual(CAPABILITY_REGISTRY['legal.audit'].namespace, 'legal');
});
check('legal.audit is bound to an executable tool instance', () => {
  assert.ok(capabilityRegistryInstance.hasCapability('legal.audit'), 'tool not bound');
  const tool = capabilityRegistryInstance.get('legal.audit');
  assert.ok(tool, 'tool instance not resolvable');
  assert.strictEqual(tool.name, 'legal.audit');
  assert.strictEqual(typeof tool.execute, 'function');
});
check('aliases resolve to the canonical legal.audit capability', () => {
  for (const alias of ['legal_audit', 'audit.legal', 'audit.policy', 'legal_audit_policy']) {
    assert.strictEqual(capabilityRegistryInstance.resolveCapabilityName(alias), 'legal.audit', `alias ${alias} misrouted`);
  }
console.log('\n[2] Deterministic intent gate');
check('legal document audit → LEGAL_AUDIT with hukum focus', () => {
  const d = semanticIntentEngineInstance._deterministicTaskClassifier(HUKUM_TURN, []);
  assert.ok(d, 'no decision produced');
  assert.strictEqual(d.intent, 'LEGAL_AUDIT', `got ${d.intent}`);
  assert.strictEqual(d.actionRequired, true);
  assert.deepStrictEqual(d.toolsNeeded, ['legal.audit']);
  assert.strictEqual(d.auditFocus, 'hukum');
});
check('public policy document audit → LEGAL_AUDIT with kebijakan focus', () => {
  const d = semanticIntentEngineInstance._deterministicTaskClassifier(KEBIJAKAN_TURN, []);
  assert.ok(d, 'no decision produced');
  assert.strictEqual(d.intent, 'LEGAL_AUDIT', `got ${d.intent}`);
  assert.strictEqual(d.auditFocus, 'kebijakan publik');
});
check('legal audit is NOT downgraded to DOCUMENT_ANALYSIS', () => {
  const d = semanticIntentEngineInstance._deterministicTaskClassifier(KEBIJAKAN_TURN, []);
  assert.notStrictEqual(d.intent, 'DOCUMENT_ANALYSIS');
});
check('ordinary document reading stays DOCUMENT_ANALYSIS (no regression)', () => {
  const turn = [
    'Rangkum dokumen ini.',
    '',
    '--- [BERKAS DOKUMEN TERLAMPIR: Nota_Rapat.pdf] ---',
    'Isi notulensi rapat.',
    '--- [AKHIR DOKUMEN: Nota_Rapat.pdf] ---'
  ].join('\n');
  const d = semanticIntentEngineInstance._deterministicTaskClassifier(turn, []);
  assert.ok(d, 'no decision produced');
  assert.strictEqual(d.intent, 'DOCUMENT_ANALYSIS', `got ${d.intent}`);
});
check('audit verb without document context does NOT trigger LEGAL_AUDIT', () => {
  assert.strictEqual(detectLegalAuditIntent('Tolong audit algoritma ini dong').isLegalAudit, false);
});
// __CONTINUE__
console.log('\n[3] Planner + Executor contract');
check('planner emits a deterministic LEGAL_AUDIT plan (no LLM planning)', async () => {
  const plan = await AgentPlanner.planGoal('audit dokumen', {
    semanticDecision: {
      intent: 'LEGAL_AUDIT',
      goal: 'audit dokumen',
      toolsNeeded: ['legal.audit'],
      auditFocus: 'hukum',
      constraints: []
    }
  });
  assert.strictEqual(plan.category, 'LEGAL_AUDIT');
  assert.strictEqual(plan.steps.length, 1);
  assert.strictEqual(plan.steps[0].tool, 'legal.audit');
  assert.strictEqual(plan.steps[0].action, 'LEGAL_AUDIT');
  assert.strictEqual(plan.evidenceContract.requiredArtifactType, 'VALIDATION_REPORT');
});
check('planner resolves the attached document into step params', async () => {
  const goal = [
    'audit dokumen ini',
    '',
    '--- [BERKAS DOKUMEN TERLAMPIR: Putusan.pdf] ---',
    'Isi putusan yang perlu diaudit.',
    '--- [AKHIR DOKUMEN: Putusan.pdf] ---'
  ].join('\n');
  const p = await AgentPlanner.planGoal(goal, {
    semanticDecision: { intent: 'LEGAL_AUDIT', goal: 'audit dokumen ini', toolsNeeded: ['legal.audit'], constraints: [] }
  });
  assert.ok(p.steps[0].params.documentText.includes('Isi putusan'), 'document text not injected into params');
  assert.strictEqual(p.steps[0].params.fileName, 'Putusan.pdf');
});
check('shared document-block extractor parses canonical markers', () => {
  const blocks = extractEmbeddedDocumentBlocks(HUKUM_TURN);
  assert.strictEqual(blocks.length, 1);
  assert.strictEqual(blocks[0].fileName, 'Putusan_123_Pid_B_2026.pdf');
  assert.ok(blocks[0].content.length > 0);
});
// __CONTINUE__
});
check('capability prompt context advertises legal audit to the LLM', () => {
console.log('\n[4] Honest verification (no fabricated "VERIFIED")');
function verifyLegalAudit(content) {
  return AgentVerifier.verifyGoalCompletion(
    { category: 'LEGAL_AUDIT', steps: [{ id: 'S1', name: 'audit' }] },
    [{
      step: { id: 'S1', tool: 'legal.audit' },
      observation: { valid: true },
      stepResult: { result: { artifact: { type: 'VALIDATION_REPORT', content } } }
    }]
  );
}
check('empty audit report is NOT certified as satisfied', () => {
  const v = verifyLegalAudit({ mode: 'hukum', report: '' });
  assert.strictEqual(v.isSatisfied, false, 'empty report was wrongly certified');
});
check('short audit report is NOT certified as satisfied', () => {
  const v = verifyLegalAudit({ mode: 'hukum', report: 'laporan sangat pendek' });
  assert.strictEqual(v.isSatisfied, false, 'short report was wrongly certified');
});
check('report without resolved mode is NOT certified as satisfied', () => {
  const v = verifyLegalAudit({ report: 'y'.repeat(500) });
  assert.strictEqual(v.isSatisfied, false, 'report without mode was wrongly certified');
});
check('real audit report IS certified with a synthesis message', () => {
  const v = verifyLegalAudit({ mode: 'kebijakan', label: 'Audit Kebijakan', fileName: 'PP.pdf', report: 'y'.repeat(5000) });
  assert.strictEqual(v.isSatisfied, true, `rejected valid audit: ${v.failureReason}`);
  assert.ok(v.synthesisMessage && v.synthesisMessage.includes('Audit Kebijakan Publik'));
});

console.log('\n[5] Router integration (no hardcoded VERIFIED, shared lexicon)');
check('router no longer hardcodes verificationStatus VERIFIED for legal audit', () => {
  const src = fs.readFileSync('server/local_router/LocalRouterServer.mjs', 'utf8');
  assert.ok(!/toolsUsed: \['legal_audit'\],\s*\r?\n\s*verificationStatus: 'VERIFIED'/.test(src),
    'router still hardcodes VERIFIED for legal audit');
  assert.ok(src.includes('auditVerificationStatus'), 'router missing honest verification status');
});
check('router uses the shared legal audit lexicon', () => {
  const src = fs.readFileSync('server/local_router/LocalRouterServer.mjs', 'utf8');
  assert.ok(src.includes('detectLegalAuditIntent'), 'router does not use the shared lexicon');
  assert.ok(!src.includes('const LEGAL_VERB_RE ='), 'router still owns a duplicated verb lexicon');
});

console.log(`\n  RESULT: ${passed}/${passed + failed} Tests Passed.\n`);
if (failed > 0) process.exit(1);
  const ctx = getCapabilityPromptContext();
  assert.ok(ctx.includes('legal.audit'), 'prompt context does not mention legal.audit');
  assert.ok(/UUD 1945/.test(ctx), 'prompt context does not mention UUD 1945 constitutional analysis');
});
// __CONTINUE__