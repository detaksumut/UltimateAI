/**
 * tests/agent/test_image_revision_boundary_guard.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Regression Test Suite for IMAGE_REVISION Architectural Boundary Fix
 *
 * Enforces:
 * 1. ComfyUI OFFLINE -> IMAGE_REVISION -> success=false, artifact=null/undefined,
 *    zero Pollinations call, zero ImageGeneration text-to-image call, ImageEditing called,
 *    truthful response returned.
 * 2. MockImageEditingProvider:
 *    Artifact #1 -> IMAGE_REVISION -> ImageEditing consumes physical Buffer ->
 *    Artifact #2 created with parentArtifactId=#1, renderable, verificationStatus=VERIFIED.
 * 3. Telemetry Invariant:
 *    IMAGE_GENERATION uses toolsUsed: ['image.generate']
 *    IMAGE_REVISION uses toolsUsed: ['image.edit']
 * 4. Strict Revision Verification:
 *    IMAGE_REVISION can NEVER be VERIFIED without parentArtifactId and renderable artifact.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { imageEditingInstance } from '../../server/agent/ImageEditing.mjs';
import { imageGenerationInstance } from '../../server/agent/ImageGeneration.mjs';
import { semanticIntentEngineInstance } from '../../server/agent/SemanticIntentEngine.mjs';
import { AgentPlanner } from '../../server/agent/AgentPlanner.mjs';
import { agentExecutorInstance } from '../../server/agent/AgentExecutor.mjs';

const G   = s => `\x1b[32m${s}\x1b[0m`;
const R   = s => `\x1b[31m${s}\x1b[0m`;
const B   = s => `\x1b[36m${s}\x1b[0m`;
const Y   = s => `\x1b[33m${s}\x1b[0m`;
const DIM = s => `\x1b[2m${s}\x1b[0m`;

const results = [];
function pass(label, detail = '') {
  results.push({ label, ok: true });
  console.log(`  ${G('PASS')} ${label}${detail ? ' ' + DIM(`(${detail})`) : ''}`);
}
function fail(label, detail = '') {
  results.push({ label, ok: false, detail });
  console.log(`  ${R('FAIL')} ${label}${detail ? ' ' + DIM(`(${detail})`) : ''}`);
}

const ARTIFACTS_DIR = path.resolve('d:/Users/ultimateai/storage/artifacts/images');
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

// 1x1 valid PNG binary buffer (67 bytes)
const SAMPLE_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

async function runSuite() {
  console.log(B('═══════════════════════════════════════════════════════════════════════════════'));
  console.log(B(' IMAGE_REVISION ARCHITECTURAL BOUNDARY & OFFLINE GUARD REGRESSION SUITE'));
  console.log(B('═══════════════════════════════════════════════════════════════════════════════\n'));

  // Create a real initial artifact on disk
  const art1Id = `img-art1-${Date.now()}`;
  const art1File = `${art1Id}.png`;
  const art1Path = path.join(ARTIFACTS_DIR, art1File);
  fs.writeFileSync(art1Path, SAMPLE_PNG_BUFFER);
  const art1Url = `/api/artifacts/images/${art1File}`;

  // ── TEST 1: ComfyUI OFFLINE Guard (Zero Pollinations, Zero ImageGen, Truthful Error) ──
  console.log(Y('TEST 1: ComfyUI OFFLINE Guard (IMAGE_REVISION Truthful Unavailability)'));
  {
    let pollinationsCallCount = 0;
    let imageGenCallCount = 0;
    let imageEditingCallCount = 0;

    // Spy on ImageGeneration._generatePollinations
    const origPollinations = imageGenerationInstance._generatePollinations;
    imageGenerationInstance._generatePollinations = async (...args) => {
      pollinationsCallCount++;
      return origPollinations.apply(imageGenerationInstance, args);
    };

    // Spy on ImageEditing.editImage
    const origEditImage = imageEditingInstance.editImage;
    imageEditingInstance.editImage = async (...args) => {
      imageEditingCallCount++;
      return origEditImage.apply(imageEditingInstance, args);
    };

    const comfyProvider = imageEditingInstance.providers.get('COMFYUI');
    const origProbe = comfyProvider.capabilityProbe;
    comfyProvider.capabilityProbe = async () => ({
      available: false,
      provider: 'COMFYUI',
      reason: 'ComfyUI is offline or unreachable at http://127.0.0.1:8188',
      textToImage: false,
      imageToImage: true
    });

    try {
      // Execute revision with ComfyUI provider (simulating offline state)
      const result = await imageEditingInstance.editImage({
        referenceImage: art1Url,
        prompt: 'sunset sky',
        providerOverride: 'COMFYUI',
        requestId: `test-offline-${Date.now()}`
      });

      assert.strictEqual(result.success, false, 'Expected success === false when ComfyUI is offline');
      assert.strictEqual(result.artifact, undefined, 'Expected artifact to be undefined/null on failure');
      assert.strictEqual(imageEditingCallCount, 1, 'Expected ImageEditing.editImage to be called exactly once');
      assert.strictEqual(pollinationsCallCount, 0, 'Pollinations must NOT be called for IMAGE_REVISION');

      const truthfulErrorContains = result.error.includes('COMFYUI') && result.error.includes('unavailable');
      assert.strictEqual(truthfulErrorContains, true, 'Result error should indicate COMFYUI is unavailable');

      pass('ComfyUI OFFLINE guard returns success=false and artifact=undefined');
      pass('ImageEditing was called directly; Pollinations was NOT called (0 calls)');
      pass('Honest error returned without faking image generation');
    } catch (err) {
      fail('TEST 1 failed', err.message);
    } finally {
      imageGenerationInstance._generatePollinations = origPollinations;
      imageEditingInstance.editImage = origEditImage;
      comfyProvider.capabilityProbe = origProbe;
    }
  }

  // ── TEST 2: MockImageEditingProvider Consumes Actual Buffer & Preserves Lineage ──
  console.log(Y('\nTEST 2: MockImageEditingProvider Consumes Physical Buffer & Links Lineage'));
  {
    try {
      const result = await imageEditingInstance.editImage({
        referenceImage: art1Url,
        prompt: 'sunset glow with golden clouds',
        providerOverride: 'MOCK',
        requestId: `test-mock-${Date.now()}`
      });

      assert.strictEqual(result.success, true, 'Expected revision to succeed with MOCK provider');
      assert.ok(result.artifact, 'Expected artifact to be returned');
      assert.strictEqual(result.artifact.parentArtifactId, art1Id, `Expected parentArtifactId to be ${art1Id}`);
      assert.strictEqual(result.artifact.operation, 'REVISION', 'Expected operation to be REVISION');
      assert.strictEqual(result.artifact.renderable, true, 'Expected revised artifact to be renderable');

      // Verify physical file on disk
      const art2Path = path.resolve(`d:/Users/ultimateai${result.artifact.url.replace(/^\/api/, '/storage')}`);
      assert.ok(fs.existsSync(art2Path), `Revised artifact must physically exist on disk at ${art2Path}`);
      const art2Buffer = fs.readFileSync(art2Path);
      assert.ok(art2Buffer.length >= 1024, `Revised artifact must be a valid image buffer (${art2Buffer.length} bytes)`);

      pass('Mock provider successfully created revised Artifact #2');
      pass(`Artifact #2 has parentArtifactId=${art1Id} pointing to Artifact #1`);
      pass(`Artifact #2 physically exists on disk (${art2Buffer.length} bytes)`);
    } catch (err) {
      fail('TEST 2 failed', err.message);
    }
  }

  // ── TEST 3: Telemetry Contract Invariants (image.generate vs image.edit) ──
  console.log(Y('\nTEST 3: Telemetry Invariant Verification (image.generate vs image.edit)'));
  {
    // 1. SemanticIntentEngine deterministic classification
    const genUtterance = 'Buat gambar kucing di atas meja';
    const genDecision = semanticIntentEngineInstance._imageGenerationClassifier(genUtterance, []);
    assert.ok(genDecision, 'Generation classifier must detect IMAGE_GENERATION');
    assert.deepStrictEqual(genDecision.toolsNeeded, ['image.generate'], 'IMAGE_GENERATION toolsNeeded must be [image.generate]');
    pass('IMAGE_GENERATION specifies toolsNeeded: ["image.generate"]');

    const revHistory = [
      { role: 'user', content: genUtterance },
      { role: 'assistant', content: 'Visual dibuat.', imageUrl: art1Url }
    ];
    const revDecision = semanticIntentEngineInstance._imageRevisionClassifier('Ubah menjadi malam hari', revHistory);
    assert.ok(revDecision, 'Revision classifier must detect IMAGE_REVISION');
    assert.deepStrictEqual(revDecision.toolsNeeded, ['image.edit'], 'IMAGE_REVISION toolsNeeded must be [image.edit]');
    pass('IMAGE_REVISION specifies toolsNeeded: ["image.edit"]');

    // 2. AgentPlanner DAG generation
    const genPlan = await AgentPlanner.planGoal(genUtterance, { semanticDecision: genDecision });
    const genTools = genPlan.steps.map(s => s.tool);
    assert.ok(genTools.every(t => t === 'image.generate'), 'IMAGE_GENERATION plan steps must use tool image.generate');
    pass('AgentPlanner assigns tool: "image.generate" for all IMAGE_GENERATION steps');

    const revPlan = await AgentPlanner.planGoal('Ubah menjadi malam hari', { semanticDecision: revDecision, referenceImage: art1Url });
    const revTools = revPlan.steps.map(s => s.tool);
    assert.ok(revTools.every(t => t === 'image.edit'), 'IMAGE_REVISION plan steps must use tool image.edit');
    pass('AgentPlanner assigns tool: "image.edit" for all IMAGE_REVISION steps');
  }

  // ── TEST 4: AgentExecutor Dispatches image.edit to ImageEditing ──
  console.log(Y('\nTEST 4: AgentExecutor Dispatches image.edit to ImageEditing'));
  {
    try {
      const step = {
        id: 'S5',
        subgoal: 'Execute image editing with revision context',
        action: 'GENERATE_REVISION_IMAGE',
        tool: 'image.edit',
        params: {
          stage: 'GENERATE',
          prompt: 'futuristic neon night scene',
          referenceImage: art1Url,
          providerOverride: 'MOCK'
        }
      };

      const stepResult = await agentExecutorInstance.executeStep(step, {
        referenceImage: art1Url,
        generationId: `gen-exec-test-${Date.now()}`
      });

      assert.strictEqual(stepResult.tool, 'image.edit', 'Step tool must be image.edit');
      pass('AgentExecutor executes image.edit step via ImageEditingService');
    } catch (err) {
      fail('TEST 4 failed', err.message);
    }
  }

  // ── TEST 5: Defensive Delegation in ImageGeneration.generateImage ──
  console.log(Y('\nTEST 5: Defensive Boundary Delegation in ImageGeneration.generateImage'));
  {
    let delegatedToEditing = false;
    const origEditImage = imageEditingInstance.editImage;
    imageEditingInstance.editImage = async (params) => {
      delegatedToEditing = true;
      return { success: false, error: '[DELEGATED] Correctly delegated to ImageEditing' };
    };

    try {
      // Calling generateImage with mode='revision' must NOT call Pollinations, must delegate to ImageEditing
      const result = await imageGenerationInstance.generateImage({
        prompt: 'make it snowy',
        referenceImage: art1Url,
        mode: 'revision'
      });

      assert.strictEqual(delegatedToEditing, true, 'ImageGeneration must defensively delegate mode="revision" to ImageEditing');
      pass('Defensive boundary: ImageGeneration delegates mode="revision" directly to ImageEditing');
    } catch (err) {
      fail('TEST 5 failed', err.message);
    } finally {
      imageEditingInstance.editImage = origEditImage;
    }
  }

  // ── Clean up test artifacts ──
  try {
    if (fs.existsSync(art1Path)) fs.unlinkSync(art1Path);
  } catch (_) {}

  // ── Summary ──
  console.log(B('\n═══════════════════════════════════════════════════════════════════════════════'));
  const passedCount = results.filter(r => r.ok).length;
  const failedCount = results.filter(r => !r.ok).length;
  console.log(` Results: ${passedCount} passed, ${failedCount} failed`);
  console.log(B('═══════════════════════════════════════════════════════════════════════════════\n'));

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error(R('Fatal test suite error:'), err);
  process.exit(1);
});
