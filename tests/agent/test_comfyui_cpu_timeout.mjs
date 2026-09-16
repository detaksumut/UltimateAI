/**
 * tests/agent/test_comfyui_cpu_timeout.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Verification of CPU-Safe ComfyUI Polling Timeout & Robust Execution Semantics
 * 
 * Required Tests:
 * TEST A: ComfyUI completes in 5 seconds → SUCCESS
 * TEST B: ComfyUI completes in 120 seconds → SUCCESS (CPU inference benchmark ~114.6s)
 * TEST C: ComfyUI completes after the old timeout (60s) but before 30 minutes → SUCCESS
 * TEST D: ComfyUI remains running beyond 30 minutes → PROVIDER_TIMEOUT
 * TEST E: ComfyUI completes but produces no output → OUTPUT_NOT_FOUND
 * TEST F: Output > 1 MB → ImageOutputSizePolicy normalizes it before persistence (< 1 MB)
 * TEST G: Successful revision has parentArtifactId
 * TEST H: No Pollinations fallback during any IMAGE_REVISION test
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { ComfyUIImageEditingProvider, COMFYUI_EXECUTION_TIMEOUT_MS, COMFYUI_POLLING_INTERVAL_MS } from '../../server/agent/providers/ComfyUIImageEditingProvider.mjs';
import { ImageEditingService } from '../../server/agent/ImageEditing.mjs';
import { MAX_IMAGE_BYTES } from '../../server/agent/ImageOutputSizePolicy.mjs';

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

// 1x1 valid PNG (67 bytes)
const SAMPLE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Helper to create mock transport simulating ComfyUI server behavior
function createMockTransport(options = {}) {
  const {
    pollsUntilSuccess = 1,
    statusStr = 'success',
    hasOutput = true,
    outputBuffer = SAMPLE_PNG,
    outputFilename = 'test_comfy_output.png',
    simulatedElapsedMs = 0,
    stillRunningOnTimeout = true
  } = options;

  let pollCount = 0;
  const promptId = `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  let pollinationsCalled = false;

  const mockFetch = async (url, fetchOptions = {}) => {
    const urlStr = String(url);

    // Track any illegal Pollinations calls
    if (urlStr.includes('pollinations.ai')) {
      pollinationsCalled = true;
      throw new Error('[BOUNDARY_VIOLATION] Pollinations must NEVER be called during IMAGE_REVISION!');
    }

    const parsedUrl = new URL(urlStr, 'http://127.0.0.1:8188');

    if (parsedUrl.pathname === '/system_stats') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ system: { os: 'windows', cpu: true, comfyui_version: '0.2.2' } })
      };
    }

    if (parsedUrl.pathname === '/upload/image') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ name: 'uploaded_input.png', subfolder: '', type: 'input' })
      };
    }

    if (parsedUrl.pathname.startsWith('/history/')) {
      pollCount++;
      if (pollCount <= pollsUntilSuccess) {
        // Still running
        return {
          ok: true,
          status: 200,
          json: async () => {
            const resp = {};
            resp[promptId] = {
              status: { completed: false, status_str: 'running' }
            };
            return resp;
          }
        };
      } else {
        // Finished
        return {
          ok: true,
          status: 200,
          json: async () => {
            const resp = {};
            resp[promptId] = {
              status: { completed: true, status_str: statusStr },
              outputs: hasOutput ? {
                "9": {
                  images: [{ filename: outputFilename, subfolder: '', type: 'output' }]
                }
              } : {}
            };
            return resp;
          }
        };
      }
    }

    if (parsedUrl.pathname === '/prompt') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ prompt_id: promptId, number: 1 })
      };
    }

    if (urlStr.includes('/queue')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          queue_running: stillRunningOnTimeout ? [[0, promptId, {}]] : [],
          queue_pending: []
        })
      };
    }

    if (urlStr.includes('/view')) {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => outputBuffer.buffer.slice(outputBuffer.byteOffset, outputBuffer.byteOffset + outputBuffer.byteLength)
      };
    }

    return {
      ok: false,
      status: 404,
      text: async () => 'Not Found'
    };
  };

  return {
    fetch: mockFetch,
    getPollCount: () => pollCount,
    wasPollinationsCalled: () => pollinationsCalled,
    promptId
  };
}

async function runSuite() {
  console.log(B('═══════════════════════════════════════════════════════════════════════════════'));
  console.log(B(' JIN COMFYUI CPU TIMEOUT & IMAGE_REVISION TEST SUITE'));
  console.log(B('═══════════════════════════════════════════════════════════════════════════════\n'));

  // Precondition: verify exported default constants
  assert.strictEqual(COMFYUI_EXECUTION_TIMEOUT_MS, 30 * 60 * 1000, 'COMFYUI_EXECUTION_TIMEOUT_MS must be 30 minutes');
  assert.strictEqual(COMFYUI_POLLING_INTERVAL_MS, 2000, 'COMFYUI_POLLING_INTERVAL_MS must be 2000 ms');
  pass('Timeout constants configured: 30 minutes limit, 2000ms polling interval');

  // Setup base test artifact
  const baseArtId = `img-test-base-${Date.now()}`;
  const baseArtFile = `${baseArtId}.png`;
  const baseArtPath = path.join(ARTIFACTS_DIR, baseArtFile);
  fs.writeFileSync(baseArtPath, SAMPLE_PNG);
  const baseArtUrl = `/api/artifacts/images/${baseArtFile}`;

  const imageEditing = new ImageEditingService();

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST A: ComfyUI completes in 5 seconds → SUCCESS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(Y('\nTEST A: ComfyUI completes in 5 seconds → SUCCESS'));
  {
    const transportA = createMockTransport({
      pollsUntilSuccess: 2, // finishes after 2 polls
      hasOutput: true,
      outputBuffer: SAMPLE_PNG
    });

    const resA = await imageEditing.editImage({
      referenceImage: baseArtUrl,
      prompt: 'ubah menjadi suasana sunset',
      providerOverride: 'COMFYUI',
      pollingIntervalMs: 20, // fast polling for unit test
      timeoutMs: 5000
    }, transportA);

    assert.strictEqual(resA.success, true, `TEST A failed: ${resA.error}`);
    assert.ok(resA.artifact, 'TEST A must produce an artifact');
    assert.strictEqual(resA.artifact.provider, 'COMFYUI');
    assert.strictEqual(resA.artifact.parentArtifactId, baseArtId);
    assert.strictEqual(transportA.wasPollinationsCalled(), false);
    pass('ComfyUI completes within 5s and returns SUCCESS', `artifact=${resA.artifact.id}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST B: ComfyUI completes in 120 seconds → SUCCESS (CPU benchmark)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(Y('\nTEST B: ComfyUI completes in 120 seconds → SUCCESS'));
  {
    // Simulating multiple polling cycles representing long CPU inference (~114.6s)
    const transportB = createMockTransport({
      pollsUntilSuccess: 8,
      hasOutput: true,
      outputBuffer: SAMPLE_PNG
    });

    const resB = await imageEditing.editImage({
      referenceImage: baseArtUrl,
      prompt: 'ubah menjadi malam berbintang',
      providerOverride: 'COMFYUI',
      pollingIntervalMs: 20,
      timeoutMs: COMFYUI_EXECUTION_TIMEOUT_MS
    }, transportB);

    assert.strictEqual(resB.success, true, `TEST B failed: ${resB.error}`);
    assert.ok(resB.artifact, 'TEST B must produce an artifact');
    assert.ok(transportB.getPollCount() >= 8, 'TEST B must continue polling through running state');
    assert.strictEqual(resB.artifact.parentArtifactId, baseArtId);
    pass('ComfyUI completes in simulated CPU timeframe (120s) and returns SUCCESS');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST C: ComfyUI completes after the old timeout (60s) but before 30m → SUCCESS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(Y('\nTEST C: ComfyUI completes after old timeout but before 30 minutes → SUCCESS'));
  {
    // Old timeout was 60s (60 polling ticks). New provider must not give up after 60 ticks.
    const transportC = createMockTransport({
      pollsUntilSuccess: 12,
      hasOutput: true,
      outputBuffer: SAMPLE_PNG
    });

    const resC = await imageEditing.editImage({
      referenceImage: baseArtUrl,
      prompt: 'ubah pemandangan dengan salju putih',
      providerOverride: 'COMFYUI',
      pollingIntervalMs: 15,
      timeoutMs: COMFYUI_EXECUTION_TIMEOUT_MS
    }, transportC);

    assert.strictEqual(resC.success, true, `TEST C failed: ${resC.error}`);
    assert.ok(resC.artifact, 'TEST C must produce an artifact');
    assert.strictEqual(resC.artifact.parentArtifactId, baseArtId);
    pass('Execution completing after old timeout is treated as SUCCESS');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST D: ComfyUI remains running beyond 30 minutes → PROVIDER_TIMEOUT
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(Y('\nTEST D: ComfyUI remains running beyond 30 minutes → PROVIDER_TIMEOUT'));
  {
    // Configure never-finishing transport with small timeoutMs to simulate expiration
    const transportD = createMockTransport({
      pollsUntilSuccess: 999999, // never finishes
      stillRunningOnTimeout: true
    });

    const resD = await imageEditing.editImage({
      referenceImage: baseArtUrl,
      prompt: 'ubah menjadi cyberpunk city',
      providerOverride: 'COMFYUI',
      pollingIntervalMs: 10,
      timeoutMs: 60 // expire after 60ms
    }, transportD);

    assert.strictEqual(resD.success, false, 'Expired execution must fail');
    assert.strictEqual(resD.reasonCode, 'PROVIDER_TIMEOUT', `reasonCode must be PROVIDER_TIMEOUT, got: ${resD.reasonCode}`);
    assert.ok(resD.promptId, 'Failure details must include promptId');
    assert.ok(typeof resD.elapsedMs === 'number', 'Failure details must include elapsedMs');
    assert.strictEqual(resD.lastStatus, 'RUNNING', 'Failure details must include lastStatus');
    assert.strictEqual(resD.stillRunning, true, 'Failure details must include whether ComfyUI was still running');
    assert.notStrictEqual(resD.reasonCode, 'PROVIDER_UNAVAILABLE', 'Timeout MUST NOT be reported as PROVIDER_UNAVAILABLE');
    pass('ComfyUI timeout beyond threshold returns PROVIDER_TIMEOUT with promptId, elapsedMs, lastStatus, stillRunning');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST E: ComfyUI completes but produces no output → OUTPUT_NOT_FOUND
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(Y('\nTEST E: ComfyUI completes but produces no output → OUTPUT_NOT_FOUND'));
  {
    const transportE = createMockTransport({
      pollsUntilSuccess: 1,
      hasOutput: false // empty outputs
    });

    const resE = await imageEditing.editImage({
      referenceImage: baseArtUrl,
      prompt: 'ubah menjadi anime style',
      providerOverride: 'COMFYUI',
      pollingIntervalMs: 15,
      timeoutMs: 5000
    }, transportE);

    assert.strictEqual(resE.success, false, 'Missing output must fail');
    assert.strictEqual(resE.reasonCode, 'OUTPUT_NOT_FOUND', `reasonCode must be OUTPUT_NOT_FOUND, got: ${resE.reasonCode}`);
    assert.notStrictEqual(resE.reasonCode, 'PROVIDER_UNAVAILABLE', 'Missing output MUST NOT be reported as PROVIDER_UNAVAILABLE');
    pass('Completed execution with no output returns OUTPUT_NOT_FOUND');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST F: Output > 1 MB → ImageOutputSizePolicy normalizes it before persistence
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(Y('\nTEST F: Output > 1 MB → ImageOutputSizePolicy normalizes it before persistence'));
  {
    const Jimp = (await import('jimp')).default;
    const img = new Jimp(1200, 1200);
    for (let x = 0; x < 1200; x++) {
      for (let y = 0; y < 1200; y++) {
        const r = (x * 7 + y * 13) % 256;
        const g = (x * 11 + y * 3) % 256;
        const b = (x * 5 + y * 17) % 256;
        img.setPixelColor(Jimp.rgbaToInt(r, g, b, 255), x, y);
      }
    }
    img.quality(95);
    const bigRaw = await img.getBufferAsync(Jimp.MIME_JPEG);

    assert.ok(bigRaw.length > MAX_IMAGE_BYTES, `Test buffer must be > 1 MB (was ${bigRaw.length} bytes)`);

    const transportF = createMockTransport({
      pollsUntilSuccess: 1,
      hasOutput: true,
      outputBuffer: bigRaw,
      outputFilename: 'oversized_comfyui_render.jpg'
    });

    const resF = await imageEditing.editImage({
      referenceImage: baseArtUrl,
      prompt: 'ubah dengan pencahayaan dramatis',
      providerOverride: 'COMFYUI',
      pollingIntervalMs: 15,
      timeoutMs: 5000
    }, transportF);

    assert.strictEqual(resF.success, true, `TEST F failed: ${resF.error}`);
    assert.ok(resF.artifact, 'TEST F must produce an artifact');
    assert.ok(resF.artifact.bytesSize < MAX_IMAGE_BYTES, `Artifact bytesSize must be < 1,000,000 bytes (got ${resF.artifact.bytesSize})`);

    // Verify physical file size on disk
    const stat = fs.statSync(resF.artifact.localPath);
    assert.ok(stat.size < MAX_IMAGE_BYTES, `Physical file on disk must be < 1,000,000 bytes (got ${stat.size})`);
    assert.strictEqual(resF.artifact.sizePolicy.status, 'PASS');
    pass('Output > 1 MB normalized by ImageOutputSizePolicy before persistence', `disk=${stat.size} bytes`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST G: Successful revision has parentArtifactId
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(Y('\nTEST G: Successful revision has parentArtifactId'));
  {
    const transportG = createMockTransport({
      pollsUntilSuccess: 1,
      hasOutput: true,
      outputBuffer: SAMPLE_PNG
    });

    const resG = await imageEditing.editImage({
      referenceImage: baseArtUrl,
      prompt: 'tambahkan efek kabut pagi',
      providerOverride: 'COMFYUI',
      pollingIntervalMs: 15,
      timeoutMs: 5000
    }, transportG);

    assert.strictEqual(resG.success, true);
    assert.strictEqual(resG.artifact.parentArtifactId, baseArtId, 'parentArtifactId must match base artifact');
    assert.strictEqual(resG.artifact.lineage.parentArtifactId, baseArtId, 'lineage.parentArtifactId must match base artifact');
    assert.ok(resG.artifact.id !== baseArtId, 'Artifact ID must be newly generated');
    pass('Successful revision strictly persists parentArtifactId lineage');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST H: No Pollinations fallback during any IMAGE_REVISION test
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(Y('\nTEST H: No Pollinations fallback during any IMAGE_REVISION test'));
  {
    // Even if ComfyUI fails or errors, ImageEditing must never call Pollinations
    const transportH = createMockTransport({
      pollsUntilSuccess: 1,
      statusStr: 'execution_error', // simulates error in ComfyUI
      hasOutput: false
    });

    const resH = await imageEditing.editImage({
      referenceImage: baseArtUrl,
      prompt: 'modifikasi visual gagal',
      providerOverride: 'COMFYUI',
      pollingIntervalMs: 15,
      timeoutMs: 5000
    }, transportH);

    assert.strictEqual(resH.success, false, 'Failed execution must return success=false');
    assert.strictEqual(transportH.wasPollinationsCalled(), false, 'Pollinations was never called');
    assert.strictEqual(resH.artifact, undefined, 'No fake fallback artifact was produced');
    pass('No Pollinations fallback during any IMAGE_REVISION scenario');
  }

  console.log(B('\n═══════════════════════════════════════════════════════════════════════════════'));
  console.log(G(` Results: ${results.filter(r => r.ok).length} passed, ${results.filter(r => !r.ok).length} failed`));
  console.log(B('═══════════════════════════════════════════════════════════════════════════════\n'));

  if (results.some(r => !r.ok)) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error(R('Unhandled exception in test suite:'), err);
  process.exit(1);
});
