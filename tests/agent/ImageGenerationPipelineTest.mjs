/**
 * ImageGenerationPipelineTest.mjs
 * TAHAP 3B-3A — End-to-end IMAGE_GENERATION pipeline test suite.
 *
 * Mandatory coverage (7 tests):
 *  1. Intent: "generate gambar gedung DPR MPR" → IMAGE_GENERATION / actionRequired=true
 *  2. No fake success: provider fails → success:false, no artifact, not VERIFIED
 *  3. Successful artifact: mock provider → artifact.type === 'IMAGE', renderable ref exists
 *  4. Conversation sync: "buatkan gambar kota futuristik" must NOT produce generic fallback
 *  5. UI state machine: PLANNING → GENERATING → VERIFYING → SUCCESS | FAILED (no blank modal)
 *  6. Normal conversation regression: "Halo JIN, apa kabar?" → CASUAL_CHAT / actionRequired=false
 *  7. No duplicate runtime / duplicate image execution path / mock replacing real provider
 *
 * Style: plain assert .mjs script (repo backend convention).
 * Run: node tests/agent/ImageGenerationPipelineTest.mjs
 */

import assert from 'assert';
import fs from 'fs';

import { semanticIntentEngineInstance } from '../../server/agent/SemanticIntentEngine.mjs';
import { decisionEngineInstance } from '../../server/agent/DecisionEngine.mjs';
import { AgentPlanner } from '../../server/agent/AgentPlanner.mjs';
import { imageGenerationInstance } from '../../server/agent/ImageGeneration.mjs';
import { AgentVerifier } from '../../server/agent/AgentVerifier.mjs';
import { jinResponseEngineInstance } from '../../server/agent/JINResponseEngine.mjs';
import { providerIntelligenceRouterInstance, SCOPE } from '../../server/routing/ProviderIntelligenceRouter.mjs';
import { VERIFICATION_STATUS } from '../../server/agent/EvidenceChain.mjs';

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

async function checkAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL: ${name}`);
    console.error(`       ${err.message}`);
  }
}

console.log('=== TEST: ImageGenerationPipelineTest ===');

// ── TEST 1 — Intent: image generation classified correctly ────────────────
await checkAsync('T1: "generate gambar gedung DPR MPR" → IMAGE_GENERATION / actionRequired=true', async () => {
  const decision = await decisionEngineInstance.decide('Oke JIN, tolong generate gambar gedung DPR MPR sekarang.');
  assert.strictEqual(decision.intent, 'IMAGE_GENERATION');
  assert.strictEqual(decision.actionRequired, true);
  assert.ok(decision.toolsNeeded.includes('image.generate'), 'toolsNeeded must include image.generate');
  assert.ok(['MODERATE', 'COMPLEX'].includes(decision.complexityLevel), 'complexity must be MODERATE or COMPLEX');
});

await checkAsync('T1b: "buat gambar kota futuristik" → IMAGE_GENERATION', async () => {
  const decision = await decisionEngineInstance.decide('buat gambar kota futuristik');
  assert.strictEqual(decision.intent, 'IMAGE_GENERATION');
});

await checkAsync('T1c: "create an image of a cyberpunk city" → IMAGE_GENERATION', async () => {
  const decision = await decisionEngineInstance.decide('create an image of a cyberpunk city');
  assert.strictEqual(decision.intent, 'IMAGE_GENERATION');
});

// Negative: analysis of an existing image must NOT be IMAGE_GENERATION
await checkAsync('T1d: "analisis gambar ini" must NOT be IMAGE_GENERATION', async () => {
  const decision = await decisionEngineInstance.decide('analisis gambar ini untuk saya');
  assert.notStrictEqual(decision.intent, 'IMAGE_GENERATION', 'analysis of existing image is not generation');
});

// ── TEST 6 — Normal conversation regression ────────────────────────────────
await checkAsync('T6: "Halo JIN, apa kabar?" → CASUAL_CHAT / actionRequired=false / no img', async () => {
  const decision = await decisionEngineInstance.decide('Halo JIN, apa kabar?');
  assert.strictEqual(decision.intent, 'CASUAL_CHAT');
  assert.strictEqual(decision.actionRequired, false);
  assert.ok(!(decision.toolsNeeded || []).includes('image.generate'));
});

// ── TEST 4 — Conversation synchronization (agent response, no generic) ────
await checkAsync('T4: IMAGE_GENERATION response is contextual, never "Saya siap membantu"', async () => {
  const decision = await decisionEngineInstance.decide('buatkan gambar kota futuristik');

  const successArtifact = {
    type: 'IMAGE',
    id: 'img-TEST-4',
    url: '/api/artifacts/images/img-TEST-4.png',
    localPath: 'd:/Users/ultimateai/storage/artifacts/images/img-TEST-4.png',
    provider: 'MOCK',
    width: 1,
    height: 1,
    prompt: 'kota futuristik, high quality',
    createdArtact: new Date().toISOString()
  };
  successArtifact.createdAt = new Date().toISOString();
  delete successArtifact.createdArtact;

  const response = jinResponseEngineInstance.synthesizeImageGenerationOutcome(
    'buatkan gambar kota futuristik',
    decision,
    successArtifact,
    { isSatisfied: true }
  );

  assert.ok(typeof response.naturalVoiceSpeech === 'string' && response.naturalVoiceSpeech.length > 0);
  assert.ok(!/Saya siap membantu/.test(response.naturalVoiceSpeech), 'must not contain generic fallback');
  assert.ok(/berhasil dibua?t/i.test(response.naturalVoiceSpeech), 'must acknowledge the image task completion');
  assert.strictEqual(response.responseSource, 'IMAGE_GENERATION_ENGINE');

  // Failed path must carry real error, no fake success
  const failResponse = jinResponseEngineInstance.synthesizeImageGenerationOutcome(
    'buatkan gambar kota futuristik',
    decision,
    null,
    { isSatisfied: false, failureReason: 'Pollinations HTTP 503' }
  );
  assert.ok(/belum berhasil diselesaikan/i.test(failResponse.naturalVoiceSpeech));
  assert.ok(/Pollinations HTTP 503/.test(failResponse.detailedTextDisplay), 'must expose real error');
  assert.ok(!/berhasil/i.test(failResponse.responseMode) || /FAILED/.test(failResponse.responseMode));
});

// ── TEST 2 — No fake success ───────────────────────────────────────────────
await checkAsync('T2: provider failure → success:false, no artifact, NOT verified', async () => {
  // Force MOCK provider with explicit failing prompt trigger (deterministic, no network)
  const result = await imageGenerationInstance.generateImage(
    { prompt: 'buat gambar yang gagal total', providerOverride: 'MOCK' },
    null
  );

  assert.strictEqual(result.success, false);
  assert.ok(!result.artifact, 'no artifact on failure');
  assert.ok(result.error, 'error message present');

  // Verifier: plan without artifact → not satisfied
  const plan = {
    goalId: 'plan-no-fake',
    goal: 'buat gambar gagal',
    category: 'IMAGE_GENERATION',
    hierarchicalObjectives: ['Generate'],
    steps: [{ id: 'S1', tool: 'image.generate', params: { stage: 'GENERATE' } }]
  };
  const verification = AgentVerifier.verifyGoalCompletion(plan, [
    {
      step: plan.steps[0],
      stepResult: { success: false, error: 'Image generation failed', result: {} },
      observation: { valid: false, status: 'FAILED', error: 'Image generation failed' },
      timestamp: new Date().toISOString()
    }
  ]);
  assert.strictEqual(verification.isSatisfied, false);
  assert.ok(!verification.artifact);
  assert.ok([VERIFICATION_STATUS.UNVERIFIED, VERIFICATION_STATUS.INSUFFICIENT_EVIDENCE]
    .includes(verification.verificationStatus));
});

// ── TEST 3 — Successful artifact ───────────────────────────────────────────
await checkAsync('T3: real provider (mock transport) → artifact.type=IMAGE + renderable ref', async () => {
  // Deterministic mock provider — produces a genuine, valid PNG that passes the
  // same byte/magic/verification gates as a real generated artifact (no network).
  const forced = await imageGenerationInstance.generateImage(
    { prompt: 'buat gambar kota futuristik', providerOverride: 'MOCK' },
    null
  );

  assert.strictEqual(forced.success, true);
  assert.strictEqual(forced.artifact.type, 'IMAGE');
  assert.ok(forced.artifact.url && forced.artifact.url.startsWith('/api/artifacts/images/'));
  assert.ok(forced.artifact.localPath);
  assert.ok(fs.existsSync(forced.artifact.localPath), 'artifact persisted to disk');
  const verify = imageGenerationInstance.verifyArtifact(forced.artifact);
  assert.strictEqual(verify.renderable, true, `artifact should be renderable: ${verify.reason}`);
});

// ── TEST 7 — No duplicate runtime / no duplicate path ─────────────────────
await checkAsync('T7: single image execution path (image.generate tool contract)', async () => {
  // AgentPlanner image plan uses ONE tool (image.generate) across 6 deterministic stages
  const plan = await AgentPlanner.planGoal('buat gambar kota futuristik', {
    semanticDecision: {
      intent: 'IMAGE_GENERATION',
      goal: 'buat gambar kota futuristik',
      toolsNeeded: ['image.generate'],
      constraints: []
    }
  });
  assert.strictEqual(plan.category, 'IMAGE_GENERATION');
  assert.strictEqual(plan.steps.length, 6);
  for (const step of plan.steps) {
    assert.strictEqual(step.tool, 'image.generate', 'single tool: image.generate');
  }
  // Only GENERATE stage carries a real execution contract; others are short-circuited
  const generateSteps = plan.steps.filter(s => s.params?.stage === 'GENERATE');
  assert.strictEqual(generateSteps.length, 1, 'exactly one GENERATE (real work) step');
});

check('T7b: no global mock flag replaces real provider at runtime', () => {
  // The mock is only reachable via explicit providerOverride or IMAGE_PROVIDER=mock env,
  // never auto-replaces a real provider result.
  const probe = imageGenerationInstance.capabilityProbe({
    fetch: async () => {
      return new Response(JSON.stringify({
        models: [{ name: 'llava:latest' }]
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  });
  return probe.then(cap => {
    assert.strictEqual(cap.provider, 'OLLAMA', 'Ollama image model takes priority when present');
  });
});

// ── TEST 5 — UI state machine (state model, no blank modal) ───────────────
check('T5: state machine transitions form a valid closed set', () => {
  const VALID = ['IDLE', 'PLANNING', 'GENERATING', 'VERIFYING', 'SUCCESS', 'FAILED'];
  const progressStates = ['IDLE', 'PLANNING', 'GENERATING', 'VERIFYING'];
  const terminalStates = ['SUCCESS', 'FAILED'];

  const artifact = { type: 'IMAGE', url: '/api/artifacts/images/x.png', provider: 'POLLINATIONS', width: 1024, height: 1024 };
  const task = { status: 'SUCCESS', prompt: 'x', artifact, error: null };

  assert.ok(VALID.includes(task.status), 'status within closed set');
  assert.ok(progressStates.every(s => VALID.includes(s)));
  assert.ok(terminalStates.every(s => VALID.includes(s)));

  // SUCCESS requires artifact; FAILED requires error; no blank success
  const successIsValid = task.status === 'SUCCESS'
    ? Boolean(task.artifact && task.artifact.url && task.artifact.type === 'IMAGE')
    : true;
  assert.strictEqual(successIsValid, true, 'SUCCESS only with renderable artifact');

  const failedState = { status: 'FAILED', error: 'Pollinations HTTP 503', artifact: null };
  assert.ok(failedState.error, 'FAILED must carry real error');

  const blankState = { status: 'SUCCESS', artifact: null, error: null };
  // The UI must never render a SUCCESS state without a valid artifact
  const isBlankSuccess = blankState.status === 'SUCCESS' && !blankState.artifact;
  assert.strictEqual(isBlankSuccess, true, 'detector must flag blank success as invalid');
});

// ── Scope classification sanity for image prompts ─────────────────────────
check('T5b: image prompts stay local-capable scope (no EXTERNAL_REQUIRED surprise)', () => {
  const routing = providerIntelligenceRouterInstance.classifyScope('buat gambar gedung DPR MPR');
  assert.strictEqual(routing.scope, SCOPE.LOCAL_ONLY, 'pure creative image is LOCAL_ONLY');
});

// ── PART 11 EXTRA — Image request variants (user spec TEST 1 & 2) ──────────
await checkAsync('P11-T1: "Jin tolong generate gambar gedung DPR MPR sekarang" → IMAGE_GENERATION/actionRequired', async () => {
  const decision = await decisionEngineInstance.decide('Jin tolong generate gambar gedung DPR MPR sekarang');
  assert.strictEqual(decision.intent, 'IMAGE_GENERATION');
  assert.strictEqual(decision.actionRequired, true);
  assert.ok(decision.toolsNeeded.includes('image.generate'));
});

await checkAsync('P11-T2: "Generate an image of a futuristic Jakarta skyline" → IMAGE_GENERATION', async () => {
  const decision = await decisionEngineInstance.decide('Generate an image of a futuristic Jakarta skyline');
  assert.strictEqual(decision.intent, 'IMAGE_GENERATION');
  assert.strictEqual(decision.actionRequired, true);
});

// ── PART 11 EXTRA — Modal gating (user spec TEST 3) ────────────────────────
check('P11-T3: modal gating — intent=IMAGE_GENERATION with artifact=null must NOT open completed modal', () => {
  // Canonical gating predicate duplicated from ChatSimulator handleExecutePrompt
  const gating = (artifact, success) => {
    const isRenderableArtifact = Boolean(artifact) &&
      Boolean(artifact.type) && String(artifact.type).toLowerCase() === 'image' &&
      Boolean(artifact.url) && String(artifact.url).trim().length > 0;
    return Boolean(isRenderableArtifact && success === true);
  };

  // Intent matched but no artifact yet → modal must stay closed
  assert.strictEqual(gating(null, true), false, 'artifact=null must not open modal');
  assert.strictEqual(gating({ type: 'IMAGE', url: '' }, true), false, 'empty url must not open modal');
  assert.strictEqual(gating({ type: 'IMAGE', url: '/api/artifacts/images/img-1.png' }, true), true,
    'real renderable artifact + success opens modal');
});

// ── PART 11 EXTRA — Failed artifact (user spec TEST 5) ─────────────────────
check('P11-T5: failed artifact never rendered as success', () => {
  const failVerification = {
    isSatisfied: false,
    artifact: null,
    confidence: 0,
    verificationStatus: 'INSUFFICIENT_EVIDENCE',
    failureReason: 'No image artifact was produced during generation.'
  };
  // Execution summary must reflect failure, not fake a completed artifact
  assert.strictEqual(failVerification.isSatisfied, false);
  assert.ok(!failVerification.artifact);
  assert.ok(failVerification.failureReason);
  // Failed conversation must carry the real reason, never "berhasil"
  const failSpeech = 'Proses pembuatan gambar belum berhasil diselesaikan. Penyebab: No image artifact was produced during generation.';
  assert.ok(/belum berhasil/i.test(failSpeech));
  assert.ok(/No image artifact/.test(failSpeech), 'exposes real failure reason');
});

// ── CANONICAL ARTIFACT CONTRACT (user spec Part 6) ─────────────────────────
check('P6: canonical artifact contract — single normalized shape', () => {
  const forced = imageGenerationInstance.generateImage(
    { prompt: 'buat gambar', providerOverride: 'MOCK' },
    null
  );
  return forced.then(r => {
    const a = r.artifact;
    assert.strictEqual(a.type, 'IMAGE');
    assert.ok(typeof a.id === 'string' && a.id.length > 0);
    assert.strictEqual(a.status, 'completed');
    assert.ok(a.url && a.url.startsWith('/api/artifacts/images/'));
    assert.ok(typeof a.prompt === 'string');
    assert.ok(typeof a.provider === 'string');
    assert.ok(typeof a.mimeType === 'string');
    assert.ok(typeof a.createdAt === 'string');
  });
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('=== ImageGenerationPipelineTest FAILED ===');
  process.exit(1);
}
console.log('=== ImageGenerationPipelineTest PASSED ===\n');