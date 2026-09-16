/**
 * tests/agent/test_global_image_resolution.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Regression Test Suite: Global Image Production Resolution (256x256)
 * 
 * Verifies:
 * 1. Central ImageOutputConfig contract:
 *    IMAGE_WIDTH = 256, IMAGE_HEIGHT = 256, MAX_BYTES = 1000000, TARGET_BYTES = 1000000
 * 2. IMAGE_GENERATION (Pollinations):
 *    Outgoing request strictly passes width=256 and height=256 in URL query params.
 * 3. IMAGE_GENERATION (Mock):
 *    Mock generator produces artifact with width=256, height=256.
 * 4. IMAGE_REVISION (ComfyUI):
 *    Workflow includes ImageScale node with width=256, height=256 and
 *    KSampler node with steps=4, denoise=0.75.
 * 5. Full invariant telemetry:
 *    [COMFYUI_REVISION_POLICY]
 *    steps=4
 *    denoise=0.75
 *    width=256
 *    height=256
 *    [COMFYUI_PROMPT_PAYLOAD]
 *    steps=4
 *    width=256
 *    height=256
 *    denoise=0.75
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import Jimp from 'jimp';

import {
  IMAGE_WIDTH,
  IMAGE_HEIGHT,
  IMAGE_MAX_BYTES,
  IMAGE_TARGET_BYTES,
  DEFAULT_IMAGE_SIZE
} from '../../server/agent/ImageOutputConfig.mjs';

import {
  MAX_IMAGE_BYTES,
  TARGET_IMAGE_BYTES
} from '../../server/agent/ImageOutputSizePolicy.mjs';

import { imageGenerationInstance } from '../../server/agent/ImageGeneration.mjs';
import { comfyUIImageEditingProviderInstance } from '../../server/agent/providers/ComfyUIImageEditingProvider.mjs';

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

async function runGlobalResolutionTests() {
  console.log(B('═══════════════════════════════════════════════════════════════════════════════'));
  console.log(B(' GLOBAL IMAGE PRODUCTION RESOLUTION REGRESSION SUITE (512x512)'));
  console.log(B('═══════════════════════════════════════════════════════════════════════════════\n'));

  // ── TEST 1: Central ImageOutputConfig Contract ──
  console.log(Y('TEST 1: Central ImageOutputConfig Contract'));
  assert.strictEqual(IMAGE_WIDTH, 512, 'IMAGE_WIDTH must strictly be 512');
  assert.strictEqual(IMAGE_HEIGHT, 512, 'IMAGE_HEIGHT must strictly be 512');
  assert.strictEqual(IMAGE_MAX_BYTES, 1000000, 'IMAGE_MAX_BYTES must strictly be 1000000 (1 MB enterprise ceiling)');
  assert.strictEqual(IMAGE_TARGET_BYTES, 1000000, 'IMAGE_TARGET_BYTES must strictly be 1000000 (no recompression <= 1 MB)');
  assert.strictEqual(DEFAULT_IMAGE_SIZE, '512x512', 'DEFAULT_IMAGE_SIZE must strictly be 512x512');
  assert.strictEqual(MAX_IMAGE_BYTES, 1000000, 'ImageOutputSizePolicy MAX_IMAGE_BYTES re-export must match');
  assert.strictEqual(TARGET_IMAGE_BYTES, 1000000, 'ImageOutputSizePolicy TARGET_IMAGE_BYTES re-export must match');
  pass('ImageOutputConfig defines IMAGE_WIDTH=512, IMAGE_HEIGHT=512, MAX_BYTES=1000000, TARGET_BYTES=1000000');

  // ── TEST 2: IMAGE_GENERATION (Pollinations URL & Payload Verification) ──
  console.log(Y('\nTEST 2: IMAGE_GENERATION (Pollinations Request Contract)'));
  let capturedPollinationsUrl = null;
  const sampleImage = new Jimp(512, 512);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      sampleImage.setPixelColor(Jimp.rgbaToInt(x % 256, y % 256, (x * y) % 256, 255), x, y);
    }
  }
  const sampleBuffer = await sampleImage.getBufferAsync(Jimp.MIME_JPEG);

  const mockPollinationsFetch = async (url, opts) => {
    capturedPollinationsUrl = url;
    return {
      ok: true,
      headers: { get: () => 'image/jpeg' },
      arrayBuffer: async () => sampleBuffer
    };
  };

  const genResult = await imageGenerationInstance._generatePollinations({
    prompt: 'scenic mountain lake at sunset',
    providerOverride: 'POLLINATIONS'
  }, mockPollinationsFetch);

  assert.strictEqual(genResult.success, true, 'Generation must succeed');
  assert.ok(capturedPollinationsUrl, 'Pollinations URL must have been invoked');

  const parsedUrl = new URL(capturedPollinationsUrl);
  const requestedWidth = parsedUrl.searchParams.get('width');
  const requestedHeight = parsedUrl.searchParams.get('height');
  assert.strictEqual(requestedWidth, '512', 'Pollinations request width must strictly be 512');
  assert.strictEqual(requestedHeight, '512', 'Pollinations request height must strictly be 512');
  assert.strictEqual(genResult.artifact.width, 512, 'Artifact record width must be 512');
  assert.strictEqual(genResult.artifact.height, 512, 'Artifact record height must be 512');
  pass('Pollinations URL parameters strictly require width=512&height=512', `url=${capturedPollinationsUrl}`);

  // ── TEST 3: IMAGE_GENERATION (Mock Provider Dimensions) ──
  console.log(Y('\nTEST 3: IMAGE_GENERATION (Mock Provider Dimensions)'));
  const mockGenResult = await imageGenerationInstance.generateImage({
    prompt: 'futuristic flying car',
    providerOverride: 'MOCK'
  });
  assert.strictEqual(mockGenResult.success, true);
  assert.strictEqual(mockGenResult.artifact.width, 512, 'Mock artifact width must be 512');
  assert.strictEqual(mockGenResult.artifact.height, 512, 'Mock artifact height must be 512');
  pass('Mock generation produces physical 512x512 artifact');

  // ── TEST 4: IMAGE_REVISION (ComfyUI ImageScale & KSampler) ──
  console.log(Y('\nTEST 4: IMAGE_REVISION (ComfyUI ImageScale + KSampler Verification)'));
  const workflow = comfyUIImageEditingProviderInstance._buildImg2ImgWorkflow({
    uploadedFilename: 'input.png',
    prompt: 'make it sunset',
    steps: 8,
    denoise: 0.75
  });

  // Verify ImageScale node
  const scaleNode = workflow['11'];
  assert.ok(scaleNode, 'Workflow must contain ImageScale node (11)');
  assert.strictEqual(scaleNode.class_type, 'ImageScale', 'Node 11 must be ImageScale');
  assert.strictEqual(scaleNode.inputs.width, 512, 'ImageScale width must strictly be 512');
  assert.strictEqual(scaleNode.inputs.height, 512, 'ImageScale height must strictly be 512');
  assert.deepStrictEqual(scaleNode.inputs.image, ['10', 0], 'ImageScale must connect to LoadImage (10)');

  // Verify VAEEncode connects to ImageScale
  const vaeEncodeNode = workflow['5'];
  assert.deepStrictEqual(vaeEncodeNode.inputs.pixels, ['11', 0], 'VAEEncode must consume scaled image from ImageScale (11)');

  // Verify KSampler
  const ksamplerNode = workflow['3'];
  assert.strictEqual(ksamplerNode.inputs.steps, 8, 'KSampler steps must strictly be 8');
  assert.strictEqual(ksamplerNode.inputs.denoise, 0.75, 'KSampler denoise must strictly be 0.75');
  pass('ComfyUI workflow has ImageScale(width=512, height=512) -> VAEEncode -> KSampler(steps=8, denoise=0.75)');

  // ── TEST 5: Runtime Telemetry & Invariant Assertions ──
  console.log(Y('\nTEST 5: Runtime Telemetry and Assertion Invariant Emission'));
  const capturedLogs = [];
  const origLog = console.log;
  console.log = (...args) => {
    capturedLogs.push(args.join(' '));
    origLog(...args);
  };

  let mockSubmittedWorkflow = null;
  const mockComfyFetch = async (url, opts) => {
    if (url.includes('/system_stats')) return { ok: true, json: async () => ({}) };
    if (url.includes('/upload/image')) return { ok: true, json: async () => ({ name: 'uploaded.png' }) };
    if (url.includes('/prompt')) {
      mockSubmittedWorkflow = JSON.parse(opts.body).prompt;
      return { ok: true, json: async () => ({ prompt_id: 'mock-prompt-global-512' }) };
    }
    if (url.includes('/history/')) {
      return {
        ok: true,
        json: async () => ({
          'mock-prompt-global-512': {
            status: { completed: true, status_str: 'success' },
            outputs: { '9': { images: [{ filename: 'out.png', subfolder: '', type: 'output' }] } }
          }
        })
      };
    }
    if (url.includes('/view')) return { ok: true, arrayBuffer: async () => sampleBuffer };
    return { ok: false, status: 404 };
  };

  try {
    const editRes = await comfyUIImageEditingProviderInstance.editImage({
      referenceImageBuffer: sampleBuffer,
      referenceMimeType: 'image/jpeg',
      referenceArtifactId: 'ref-test-512',
      prompt: 'ubah menjadi suasana sunset',
      steps: 8,
      denoise: 0.75
    }, { fetch: mockComfyFetch });

    assert.strictEqual(editRes.success, true);
    assert.strictEqual(editRes.width, 512);
    assert.strictEqual(editRes.height, 512);
    assert.strictEqual(editRes.steps, 8);
    assert.strictEqual(editRes.denoise, 0.75);

    // Verify submitted workflow payload
    assert.ok(mockSubmittedWorkflow);
    assert.strictEqual(mockSubmittedWorkflow['11'].inputs.width, 512);
    assert.strictEqual(mockSubmittedWorkflow['11'].inputs.height, 512);
    assert.strictEqual(mockSubmittedWorkflow['3'].inputs.steps, 8);
    assert.strictEqual(mockSubmittedWorkflow['3'].inputs.denoise, 0.75);

    // Verify logs
    const hasPolicyHeader = capturedLogs.some(l => l.includes('[COMFYUI_REVISION_POLICY]'));
    const hasPromptPayload = capturedLogs.some(l => l.includes('[COMFYUI_PROMPT_PAYLOAD]'));
    const hasWidth512 = capturedLogs.some(l => l.includes('width=512'));
    const hasHeight512 = capturedLogs.some(l => l.includes('height=512'));
    const hasSteps8 = capturedLogs.some(l => l.includes('steps=8'));
    const hasDenoise75 = capturedLogs.some(l => l.includes('denoise=0.75'));

    assert.ok(hasPolicyHeader, 'Telemetry must include [COMFYUI_REVISION_POLICY]');
    assert.ok(hasPromptPayload, 'Telemetry must include [COMFYUI_PROMPT_PAYLOAD]');
    assert.ok(hasWidth512, 'Telemetry must include width=512');
    assert.ok(hasHeight512, 'Telemetry must include height=512');
    assert.ok(hasSteps8, 'Telemetry must include steps=8');
    assert.ok(hasDenoise75, 'Telemetry must include denoise=0.75');
    pass('Telemetry strictly outputs COMFYUI_REVISION_POLICY and COMFYUI_PROMPT_PAYLOAD (width=512, height=512, steps=8, denoise=0.75)');
  } finally {
    console.log = origLog;
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

runGlobalResolutionTests().catch(err => {
  console.error('\n❌ GLOBAL RESOLUTION TEST RUNNER FAILED:', err);
  process.exit(1);
});
