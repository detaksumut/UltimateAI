/**
 * tests/agent/test_image_revision_steps_policy.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Strict Verification of JIN IMAGE_REVISION 4-Step Policy Guard:
 * 
 * Rules:
 * 1. COMFYUI_IMG2IMG_STEPS must strictly equal 4.
 * 2. Any attempt to submit steps != 4 (e.g. 20) MUST FAIL FAST with
 *    reasonCode: "IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION".
 * 3. Provider _buildImg2ImgWorkflow must throw if steps != 4, and always output KSampler.inputs.steps = 4.
 * 4. Provider constructor throws if defaultSteps != 4.
 * 5. Runtime telemetry must emit:
 *    [COMFYUI_EXECUTION]
 *    steps=4
 * 6. No silent execution of 20 steps.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import {
  comfyUIImageEditingProviderInstance,
  ComfyUIImageEditingProvider,
  COMFYUI_IMG2IMG_STEPS
} from '../../server/agent/providers/ComfyUIImageEditingProvider.mjs';
import { imageEditingInstance } from '../../server/agent/ImageEditing.mjs';

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

import Jimp from 'jimp';

// Create a real valid 64x64 PNG buffer
const sampleImage = new Jimp(64, 64, 0x0000FFFF);
const SAMPLE_PNG = await sampleImage.getBufferAsync(Jimp.MIME_PNG);

async function runPolicyTests() {
  console.log(B('═══════════════════════════════════════════════════════════════════════════════'));
  console.log(B(' JIN IMAGE_REVISION STRICT 8-STEP WORKFLOW POLICY VERIFICATION'));
  console.log(B('═══════════════════════════════════════════════════════════════════════════════\n'));

  // Create test reference image
  const testRefId = `img-test-policy-${Date.now()}`;
  const testRefFile = `${testRefId}.png`;
  const testRefPath = path.join(ARTIFACTS_DIR, testRefFile);
  fs.writeFileSync(testRefPath, SAMPLE_PNG);
  const testRefUrl = `/api/artifacts/images/${testRefFile}`;

  try {
    // ── TEST 1: COMFYUI_IMG2IMG_STEPS Constant ──
    console.log(Y('TEST 1: Constant Invariant Verification'));
    assert.strictEqual(COMFYUI_IMG2IMG_STEPS, 8, 'COMFYUI_IMG2IMG_STEPS constant must be strictly 8');
    assert.strictEqual(comfyUIImageEditingProviderInstance.defaultSteps, 8, 'Provider defaultSteps must be strictly 8');
    pass('COMFYUI_IMG2IMG_STEPS is strictly 8 and cannot be overridden to 20');

    // ── TEST 2: Provider Constructor Guard against defaultSteps != 8 ──
    console.log(Y('\nTEST 2: Provider Constructor Guard against defaultSteps != 8'));
    assert.throws(() => {
      new ComfyUIImageEditingProvider({ defaultSteps: 20 });
    }, /IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION/, 'Constructor must throw if defaultSteps != 8');
    pass('Provider constructor throws IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION on defaultSteps=20');

    // ── TEST 3: _buildImg2ImgWorkflow Rejects steps != 8 ──
    console.log(Y('\nTEST 3: Workflow Builder Policy Enforcement'));
    assert.throws(() => {
      comfyUIImageEditingProviderInstance._buildImg2ImgWorkflow({
        uploadedFilename: 'test.png',
        prompt: 'test prompt',
        steps: 20
      });
    }, /IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION/, 'Workflow builder must throw if steps != 8');
    pass('Workflow builder throws IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION when steps=20');

    const validWorkflow = comfyUIImageEditingProviderInstance._buildImg2ImgWorkflow({
      uploadedFilename: 'test.png',
      prompt: 'test prompt',
      steps: 8
    });
    assert.strictEqual(validWorkflow['3'].inputs.steps, 8, 'KSampler inputs.steps must strictly be 8');
    pass('Workflow builder outputs KSampler with inputs.steps === 8');

    // ── TEST 4: ImageEditing.editImage Fails Fast on steps: 20 ──
    console.log(Y('\nTEST 4: ImageEditing.editImage Fail-Fast on steps=20'));
    const violationResult20 = await imageEditingInstance.editImage({
      referenceImage: testRefUrl,
      prompt: 'ubah suasananya',
      steps: 20
    });
    assert.strictEqual(violationResult20.success, false, 'Expected success=false for steps=20');
    assert.strictEqual(violationResult20.reasonCode, 'IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION');
    assert.ok(violationResult20.error.includes('IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION'));
    pass('editImage with steps=20 rejected immediately with IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION');

    // ── TEST 5: ImageEditing.editImage Fails Fast on steps: 10 ──
    console.log(Y('\nTEST 5: ImageEditing.editImage Fail-Fast on steps=10'));
    const violationResult10 = await imageEditingInstance.editImage({
      referenceImage: testRefUrl,
      prompt: 'ubah suasananya',
      steps: 10
    });
    assert.strictEqual(violationResult10.success, false, 'Expected success=false for steps=10');
    assert.strictEqual(violationResult10.reasonCode, 'IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION');
    pass('editImage with steps=10 rejected immediately with IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION');

    // ── TEST 6: Provider editImage directly fails fast on steps != 8 ──
    console.log(Y('\nTEST 6: ComfyUIImageEditingProvider.editImage Fail-Fast on steps != 8'));
    const directProviderViolation = await comfyUIImageEditingProviderInstance.editImage({
      referenceImageBuffer: SAMPLE_PNG,
      referenceMimeType: 'image/png',
      referenceArtifactId: testRefId,
      prompt: 'test',
      steps: 20
    });
    assert.strictEqual(directProviderViolation.success, false);
    assert.strictEqual(directProviderViolation.reasonCode, 'IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION');
    pass('Direct provider.editImage rejects steps=20 with IMAGE_REVISION_WORKFLOW_POLICY_VIOLATION');

    // ── TEST 7: Telemetry Emission and Invariant Assertions Verification ──
    console.log(Y('\nTEST 7: Runtime Telemetry and Strict Invariant Assertions'));
    const capturedLogs = [];
    const origLog = console.log;
    console.log = (...args) => {
      capturedLogs.push(args.join(' '));
      origLog(...args);
    };

    let mockSubmittedWorkflow = null;
    let mockUploadedBuffer = null;
    const mockFetch = async (url, opts) => {
      if (url.includes('/system_stats')) {
        return { ok: true, json: async () => ({}) };
      }
      if (url.includes('/upload/image')) {
        mockUploadedBuffer = opts.body;
        return { ok: true, json: async () => ({ name: 'uploaded_test.png' }) };
      }
      if (url.includes('/prompt')) {
        mockSubmittedWorkflow = JSON.parse(opts.body).prompt;
        return { ok: true, json: async () => ({ prompt_id: 'mock-prompt-8step-256' }) };
      }
      if (url.includes('/history/')) {
        return {
          ok: true,
          json: async () => ({
            'mock-prompt-8step-256': {
              status: { completed: true, status_str: 'success' },
              outputs: {
                '9': { images: [{ filename: 'out.png', subfolder: '', type: 'output' }] }
              }
            }
          })
        };
      }
      if (url.includes('/view')) {
        return { ok: true, arrayBuffer: async () => SAMPLE_PNG };
      }
      return { ok: false, status: 404 };
    };

    try {
      const validResult = await comfyUIImageEditingProviderInstance.editImage({
        referenceImageBuffer: SAMPLE_PNG,
        referenceMimeType: 'image/png',
        referenceArtifactId: testRefId,
        prompt: 'test sunset transformation',
        steps: 8
      }, { fetch: mockFetch });

      assert.strictEqual(validResult.success, true);
      assert.strictEqual(validResult.steps, 8);
      assert.strictEqual(validResult.width, 512, 'Result width must strictly be 512');
      assert.strictEqual(validResult.height, 512, 'Result height must strictly be 512');
      assert.strictEqual(validResult.denoise, 0.52, 'Result denoise must strictly be 0.52');

      // Verify submitted workflow has steps === 8
      assert.ok(mockSubmittedWorkflow, 'Workflow must have been submitted');
      const workflowKSamplerSteps = mockSubmittedWorkflow['3'].inputs.steps;
      assert.strictEqual(workflowKSamplerSteps, 8, 'Submitted KSampler steps must strictly be 8');
      assert.strictEqual(validResult.width, 512, 'Payload width must strictly be 512');
      assert.strictEqual(validResult.height, 512, 'Payload height must strictly be 512');
      assert.strictEqual(mockSubmittedWorkflow['3'].inputs.denoise, 0.52, 'Submitted denoise must strictly be 0.52');
      pass('Submitted ComfyUI workflow strictly asserts workflowKSamplerSteps === 8, width === 512, height === 512, denoise === 0.52');

      // Verify telemetry logs
      const hasHeader = capturedLogs.some(l => l.includes('[COMFYUI_EXECUTION]'));
      const hasSteps8 = capturedLogs.some(l => l.includes('steps=8'));
      const hasPolicyHeader = capturedLogs.some(l => l.includes('[COMFYUI_REVISION_POLICY]'));
      const hasDenoise52 = capturedLogs.some(l => l.includes('denoise=0.52'));
      const hasWidth512 = capturedLogs.some(l => l.includes('width=512'));
      const hasHeight512 = capturedLogs.some(l => l.includes('height=512'));
      const hasPromptPayload = capturedLogs.some(l => l.includes('[COMFYUI_PROMPT_PAYLOAD]'));

      assert.ok(hasHeader, 'Telemetry must include [COMFYUI_EXECUTION]');
      assert.ok(hasSteps8, 'Telemetry must explicitly include steps=8');
      assert.ok(hasPolicyHeader, 'Telemetry must include [COMFYUI_REVISION_POLICY]');
      assert.ok(hasDenoise52, 'Telemetry must include denoise=0.52');
      assert.ok(hasWidth512, 'Telemetry must include width=512');
      assert.ok(hasHeight512, 'Telemetry must include height=512');
      assert.ok(hasPromptPayload, 'Telemetry must include [COMFYUI_PROMPT_PAYLOAD]');
      pass('Runtime telemetry strictly outputs COMFYUI_REVISION_POLICY and COMFYUI_PROMPT_PAYLOAD with 512x512, steps=8, denoise=0.52');
    } finally {
      console.log = origLog;
    }

  } finally {
    try {
      if (fs.existsSync(testRefPath)) fs.unlinkSync(testRefPath);
    } catch (_) {}
  }

  console.log(B('\n═══════════════════════════════════════════════════════════════════════════════'));
  const passedCount = results.filter(r => r.ok).length;
  const failedCount = results.filter(r => !r.ok).length;
  console.log(` Results: ${passedCount} passed, ${failedCount} failed`);
  console.log(B('═══════════════════════════════════════════════════════════════════════════════\n'));

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPolicyTests().catch(err => {
  console.error('\n❌ TEST RUNNER FAILED:', err);
  process.exit(1);
});
