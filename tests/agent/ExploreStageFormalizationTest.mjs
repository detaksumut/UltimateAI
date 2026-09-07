/**
 * ExploreStageFormalizationTest.mjs
 * TAHAP 3B-2B-2 — Formal EXPLORE pipeline stage test suite.
 *
 * Verifies the 5 canonical scenarios without live network/Ollama dependence
 * (skipLiveProbe isolates the deterministic EXPLORE stage):
 *
 *  1. Local device (RAM)          → LOCAL_ONLY / OLLAMA / VERIFIED, no external
 *  2. Internet research           → EXTERNAL_ONLY / ANTIGRAVITY / EXPLORE stage
 *  3. Local doc vs world standard → HYBRID (Ollama local + Antigravity internet)
 *  4. Code synthesis              → LOCAL_ONLY, no fabricated external
 *  5. External unavailable        → no fabricated sources; INSUFFICIENT_EVIDENCE / PARTIALLY_VERIFIED
 *
 * Style: plain assert .mjs script (repo backend convention).
 * Run: node tests/agent/ExploreStageFormalizationTest.mjs
 */

import assert from 'assert';

import { providerIntelligenceRouterInstance, SCOPE, PROVIDER } from '../../server/routing/ProviderIntelligenceRouter.mjs';
import { exploreAgentInstance } from '../../server/agent/ExploreAgent.mjs';
import { evidenceChainBuilderInstance, VERIFICATION_STATUS } from '../../server/agent/EvidenceChain.mjs';
import { AgentVerifier } from '../../server/agent/AgentVerifier.mjs';

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL: ${name}`);
    console.error(`       ${err.message}`);
  }
}

function makePlan(goal, steps, extra = {}) {
  return {
    goalId: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    goal,
    category: extra.category || 'MULTI_STEP_TASK',
    selectedEngine: extra.engine || 'llama3.2:3b',
    selectedPool: extra.pool || 'POOL_1',
    sourceScope: extra.scope || SCOPE.LOCAL_ONLY,
    hierarchicalObjectives: [goal],
    steps,
    ...extra
  };
}

function makeDecision(intent, scope, toolsNeeded = []) {
  return {
    intent,
    sourceScope: scope,
    toolsNeeded,
    semanticModel: 'gemini-3.6-flash-high',
    transportUsed: 'LOCAL_ROUTER_PROXY',
    fallbackUsed: false
  };
}

function hasAnyProvider(exploration, provider) {
  return (exploration.providerUsed || []).includes(provider)
    || (exploration.discoveryPaths || []).some(p => p.provider === provider)
    || (exploration.sources || []).some(s => s.provider === provider)
    || (exploration.findings || []).some(f => f.provider === provider)
    || (exploration.evidence || []).some(e => e.provider === provider);
}

const LOCAL_EXPLORE = { skipLiveProbe: true, explorationMode: 'LIGHT' };

console.log('=== TEST: ExploreStageFormalizationTest ===');

// ── Scenario 1: Local device → LOCAL_ONLY / OLLAMA / VERIFIED, no external ──
{
  const phrase = 'Cek penggunaan RAM komputer ini';
  const routing = providerIntelligenceRouterInstance.classifyScope(phrase);
  check('S1: "Cek RAM komputer" classified LOCAL_ONLY/OLLAMA', () => {
    assert.strictEqual(routing.scope, SCOPE.LOCAL_ONLY);
    assert.strictEqual(routing.preferredProvider, PROVIDER.OLLAMA);
  });

  const plan = makePlan(phrase, [{
    id: 'S1', subgoal: phrase, action: 'execute_local', tool: 'device.inspect',
    providerDomain: PROVIDER.OLLAMA, dependsOn: []
  }], { scope: SCOPE.LOCAL_ONLY, category: 'DEVICE_INSPECTION' });
  const decision = makeDecision('DEVICE_INSPECTION', SCOPE.LOCAL_ONLY, ['device.inspect']);

  const exploration = await exploreAgentInstance.explore(plan, decision, LOCAL_EXPLORE);
  check('S1: EXPLORE stage runs (explored=true), OLLAMA only, no external anywhere', () => {
    assert.strictEqual(exploration.explored, true);
    assert.strictEqual(exploration.scope, SCOPE.LOCAL_ONLY);
    assert.ok(exploration.providerUsed.includes(PROVIDER.OLLAMA), 'providerUsed should include OLLAMA');
    assert.ok(!hasAnyProvider(exploration, PROVIDER.ANTIGRAVITY), 'no ANTIGRAVITY should leak into LOCAL exploration');
    assert.deepStrictEqual(exploration.discoveryPaths, [], 'LOCAL_ONLY must not declare web discovery paths');
    for (const s of exploration.sources) {
      assert.strictEqual(s.provider !== PROVIDER.ANTIGRAVITY, true);
    }
  });

  const chain = evidenceChainBuilderInstance.buildChain({
    claim: phrase,
    goal: phrase,
    scope: SCOPE.LOCAL_ONLY,
    explorationResult: exploration,
    executionHistory: [{
      step: plan.steps[0],
      stepResult: { success: true, result: { text: 'RAM: 73% terpakai. CPU: 12%.', source: 'DEVICE_INTELLIGENCE_RUNTIME' } },
      observation: { valid: true, status: 'COMPLETED' },
      timestamp: new Date().toISOString()
    }],
    verification: { isSatisfied: true, confidence: 0.99, verificationStatus: VERIFICATION_STATUS.VERIFIED },
    decision
  });
  check('S1: Evidence chain VERIFIED with local-only findings (no ANTIGRAVITY)', () => {
    assert.strictEqual(chain.verificationStatus, VERIFICATION_STATUS.VERIFIED);
    assert.ok(chain.findings.length >= 1);
    assert.ok(!chain.findings.some(f => f.provider === 'ANTIGRAVITY'), 'chain must stay local-only');
    assert.ok(chain.findings.every(f => Array.isArray(f.evidenceRefs) && f.evidenceRefs.length > 0));
  });
}

// ── Scenario 2: Internet research → EXTERNAL_ONLY / ANTIGRAVITY / EXPLORE ──
{
  const phrase = 'Riset harga saham teknologi dunia hari ini';
  const routing = providerIntelligenceRouterInstance.classifyScope(phrase);
  check('S2: "Riset harga saham teknologi dunia hari ini" → EXTERNAL_REQUIRED/ANTIGRAVITY', () => {
    assert.strictEqual(routing.scope, SCOPE.EXTERNAL_REQUIRED);
    assert.strictEqual(routing.preferredProvider, PROVIDER.ANTIGRAVITY);
    assert.ok(routing.requiresRealTimeData, 'real-time indicator must be recognized');
  });

  const query = 'harga saham teknologi dunia hari ini';
  const plan = makePlan(phrase, [{
    id: 'S1', subgoal: query, action: 'WEB_RESEARCH', tool: 'web.search',
    params: { query }, providerDomain: PROVIDER.ANTIGRAVITY, dependsOn: []
  }], { scope: SCOPE.EXTERNAL_REQUIRED, category: 'WEB_SEARCH' });
  const decision = makeDecision('EXTERNAL_DATA', SCOPE.EXTERNAL_REQUIRED, ['web.search']);

  const exploration = await exploreAgentInstance.explore(plan, decision, { skipLiveProbe: true });
  check('S2: EXPLORE stage declares ANTIGRAVITY discovery path without fabricating a URL', () => {
    assert.strictEqual(exploration.explored, true);
    assert.strictEqual(exploration.scope, SCOPE.EXTERNAL_REQUIRED);
    assert.ok(exploration.providerUsed.includes(PROVIDER.ANTIGRAVITY));
    assert.strictEqual(exploration.discoveryPaths.length, 1);
    const dp = exploration.discoveryPaths[0];
    assert.strictEqual(dp.provider, PROVIDER.ANTIGRAVITY);
    assert.strictEqual(dp.type, 'SPECIALIZED_WEB_SEARCH');
    assert.strictEqual(dp.url, null, 'query-only discovery must not invent a URL');
    assert.strictEqual(dp.status, 'PENDING_LIVE_UNAVAILABLE');
    assert.strictEqual(dp.retrievedAt, null);
    // No claimed external source: every source must be un-retrieved / url-less
    for (const s of exploration.sources) {
      assert.ok(!(s.provider === PROVIDER.ANTIGRAVITY && s.url && s.retrievedAt),
        'no fabricated, retrieved ANTIGRAVITY source at EXPLORE time');
    }
    assert.ok(exploration.knowledgeGaps.some(g => /External verification unavailable/.test(g.gap)));
    assert.ok(exploration.limitations.some(l => /External verification unavailable/.test(l)));
  });

  const chain = evidenceChainBuilderInstance.buildChain({
    claim: phrase,
    goal: phrase,
    scope: SCOPE.EXTERNAL_REQUIRED,
    explorationResult: exploration,
    executionHistory: [{
      step: plan.steps[0],
      stepResult: {
        success: true,
        result: {
          text: 'Indeks saham teknologi global ditutup menguat 1,8% didorong kinerja produsen chip terbesar.',
          query,
          title: 'Ringkasan Pasar Saham Teknologi',
          sourcesCount: 3,
          artifact: { id: 'A1', type: 'RESEARCH_BRIEF' }
        }
      },
      observation: { valid: true, status: 'COMPLETED' },
      timestamp: new Date().toISOString()
    }],
    verification: { isSatisfied: true, confidence: 0.99, verificationStatus: VERIFICATION_STATUS.VERIFIED },
    decision
  });
  check('S2: After real BUILD web result → chain verified with external validation', () => {
    // Antigravity was forced unavailable (skipLiveProbe) in this test so the
    // canonical status is PARTIALLY_VERIFIED; with a live probe it becomes VERIFIED.
    assert.ok([VERIFICATION_STATUS.VERIFIED, VERIFICATION_STATUS.PARTIALLY_VERIFIED]
      .includes(chain.verificationStatus));
    assert.ok(chain.findings.some(f => f.provider === 'ANTIGRAVITY' && f.type === 'TOOL_RESULT'));
    assert.strictEqual(chain.conclusion.hasExternalValidation, true);
    assert.ok(chain.sources.some(s => s.type === 'INTERNET'));
  });

  // Canonical findings must be used (not duplicated with legacy evidence)
  check('S2: canonical findings mapped w/ evidenceRefs (no double-count)', () => {
    assert.strictEqual(exploration.findings.length, exploration.evidence.length);
    assert.ok(exploration.findings.every(f => Array.isArray(f.evidenceRefs) && f.findingId));
  });
}

// ── Scenario 3: Local doc vs world standard → HYBRID ──────────────────────
{
  const phrase = 'bandingkan dengan standar pasar di internet';
  const routing = providerIntelligenceRouterInstance.classifyScope(phrase);
  check('S3: "Bandingkan dengan standar pasar di internet" → HYBRID', () => {
    assert.strictEqual(routing.scope, SCOPE.HYBRID);
  });

  const plan = makePlan(phrase, [
    { id: 'S1', subgoal: 'Analisis dokumen lokal', action: 'DOCUMENT_ANALYSIS', tool: 'doc.analyze', providerDomain: PROVIDER.OLLAMA, dependsOn: [] },
    { id: 'S2', subgoal: 'Cari standar industri', action: 'WEB_RESEARCH', tool: 'web.search', params: { query: 'standar industri pasar' }, providerDomain: PROVIDER.ANTIGRAVITY, dependsOn: ['S1'] }
  ], { scope: SCOPE.HYBRID });
  const decision = makeDecision('MULTI_STEP_TASK', SCOPE.HYBRID, ['doc.analyze', 'web.search']);

  const exploration = await exploreAgentInstance.explore(plan, decision, { skipLiveProbe: true });
  check('S3: HYBRID EXPLORE uses both OLLAMA (internal) and ANTIGRAVITY (external planned)', () => {
    assert.strictEqual(exploration.explored, true);
    assert.strictEqual(exploration.scope, SCOPE.HYBRID);
    assert.ok(exploration.providerUsed.includes(PROVIDER.OLLAMA), 'internal provider needed');
    assert.ok(exploration.providerUsed.includes(PROVIDER.ANTIGRAVITY), 'external provider needed');
    const webDiscovery = exploration.discoveryPaths.filter(p => p.sourceStepId === 'S2');
    assert.strictEqual(webDiscovery.length, 1);
    assert.strictEqual(webDiscovery[0].provider, PROVIDER.ANTIGRAVITY);
  });
}

// ── Scenario 4: Code synthesis → LOCAL_ONLY, no fake external ─────────────
{
  const phrase = 'Buatkan function JavaScript untuk menghitung diskon';
  const routing = providerIntelligenceRouterInstance.classifyScope(phrase);
  check('S4: "Buatkan function JavaScript..." → LOCAL_ONLY', () => {
    assert.strictEqual(routing.scope, SCOPE.LOCAL_ONLY);
    assert.strictEqual(routing.preferredProvider, PROVIDER.OLLAMA);
  });

  const plan = makePlan(phrase, [{
    id: 'S1', subgoal: phrase, action: 'CODE_SYNTHESIS', tool: 'code.synthesizer',
    providerDomain: PROVIDER.OLLAMA, dependsOn: []
  }], { scope: SCOPE.LOCAL_ONLY, category: 'APP_SYNTHESIS' });
  const decision = makeDecision('APP_SYNTHESIS', SCOPE.LOCAL_ONLY, ['sandbox.execute']);

  const exploration = await exploreAgentInstance.explore(plan, decision, LOCAL_EXPLORE);
  check('S4: Code synthesis EXPLORE is local-only, zero fabricated external', () => {
    assert.strictEqual(exploration.explored, true);
    assert.ok(!hasAnyProvider(exploration, PROVIDER.ANTIGRAVITY));
    assert.deepStrictEqual(exploration.discoveryPaths, []);
    for (const s of exploration.sources) assert.ok(s.provider !== PROVIDER.ANTIGRAVITY);
  });

  const noArtifactVerification = AgentVerifier.verifyGoalCompletion(plan, [{
    step: plan.steps[0],
    stepResult: { success: true, result: { status: 'COMPLETED' } },
    observation: { valid: true, status: 'COMPLETED' },
    timestamp: new Date().toISOString()
  }]);
  check('S4: Verifier marks APP_SYNTHESIS without CODE artifact UNVERIFIED', () => {
    assert.strictEqual(noArtifactVerification.isSatisfied, false);
    assert.strictEqual(noArtifactVerification.verificationStatus, VERIFICATION_STATUS.UNVERIFIED);
  });

  const emptyStepPlan = makePlan(phrase, [
    { id: 'P1', subgoal: 'a', tool: null, providerDomain: PROVIDER.OLLAMA, dependsOn: [] },
    { id: 'P2', subgoal: 'b', tool: null, providerDomain: PROVIDER.OLLAMA, dependsOn: ['P1'] }
  ], { scope: SCOPE.LOCAL_ONLY, category: 'MULTI_STEP_TASK' });
  const emptyResultVerification = AgentVerifier.verifyGoalCompletion(emptyStepPlan, []);
  check('S4: Verifier with zero produced results → INSUFFICIENT_EVIDENCE', () => {
    assert.strictEqual(emptyResultVerification.isSatisfied, true);
    assert.strictEqual(emptyResultVerification.verificationStatus, VERIFICATION_STATUS.INSUFFICIENT_EVIDENCE);
  });
}

// ── Scenario 5: External unavailable → no fabrication, INSUFFICIENT/PARTIAL ─
{
  const phrase = 'Berapa harga emas hari ini di dunia';
  const query = 'harga emas hari ini';
  const plan = makePlan(phrase, [{
    id: 'S1', subgoal: query, action: 'WEB_RESEARCH', tool: 'web.search',
    params: { query }, providerDomain: PROVIDER.ANTIGRAVITY, dependsOn: []
  }], { scope: SCOPE.EXTERNAL_REQUIRED, category: 'WEB_SEARCH' });
  const decision = makeDecision('EXTERNAL_DATA', SCOPE.EXTERNAL_REQUIRED, ['web.search']);

  const exploration = await exploreAgentInstance.explore(plan, decision, { skipLiveProbe: true });
  check('S5: external unavailable ⇒ limitation recorded, no fabricated sources', () => {
    assert.ok(exploration.limitations.some(l => /External verification unavailable/.test(l)));
    assert.ok(exploration.knowledgeGaps.some(g => g.reason === 'ANTIGRAVITY_UNAVAILABLE'));
    const fabricated = exploration.sources.filter(s => s.provider === PROVIDER.ANTIGRAVITY && s.url && s.retrievedAt);
    assert.strictEqual(fabricated.length, 0, 'no retrieved external source may exist when unavailable');
  });

  const emptyChain = evidenceChainBuilderInstance.buildChain({
    claim: phrase,
    goal: phrase,
    scope: SCOPE.EXTERNAL_REQUIRED,
    explorationResult: {
      explored: true,
      exploredAt: new Date().toISOString(),
      discoveryPaths: exploration.discoveryPaths,
      findings: [],
      evidence: [],
      sources: [],
      knowledgeGaps: [{ gap: 'External verification unavailable.', reason: 'ANTIGRAVITY_UNAVAILABLE', severity: 'HIGH' }],
      limitations: ['External verification unavailable.'],
      alternativeViews: [],
      providerUsed: [PROVIDER.ANTIGRAVITY]
    },
    executionHistory: [],
    verification: { isSatisfied: false, confidence: 0, verificationStatus: VERIFICATION_STATUS.INSUFFICIENT_EVIDENCE },
    decision
  });
  check('S5: empty evidence ⇒ chain INSUFFICIENT_EVIDENCE and surfaces the gap', () => {
    assert.strictEqual(emptyChain.verificationStatus, VERIFICATION_STATUS.INSUFFICIENT_EVIDENCE);
    assert.strictEqual(emptyChain.conclusion.canConclude, false);
    assert.ok(emptyChain.limitations.some(l => /External verification unavailable/.test(l)));
    assert.ok(emptyChain.limitations.some(l => /\[GAP HIGH\]/.test(l)));
  });

  check('S5: findings with low-conf external unavailable ⇒ PARTIALLY_VERIFIED', () => {
    const partialChain = evidenceChainBuilderInstance.buildChain({
      claim: phrase,
      goal: phrase,
      scope: SCOPE.EXTERNAL_REQUIRED,
      explorationResult: exploration,
      executionHistory: [],
      verification: { isSatisfied: false, confidence: 0.15 },
      decision
    });
    assert.ok([VERIFICATION_STATUS.PARTIALLY_VERIFIED, VERIFICATION_STATUS.UNVERIFIED]
      .includes(partialChain.verificationStatus),
      'mixed planned(0.7) + unavailable(0) findings must not read as fully VERIFIED');
  });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('=== ExploreStageFormalizationTest FAILED ===');
  process.exit(1);
}
console.log('=== ExploreStageFormalizationTest PASSED ===\n');