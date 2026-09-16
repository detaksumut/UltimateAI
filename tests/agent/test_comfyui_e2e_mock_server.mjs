/**
 * tests/agent/test_comfyui_e2e_mock_server.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * End-to-End Simulation of ComfyUI ONLINE Protocol
 * 
 * Verifies the full E2E flow:
 * Artifact #1 -> physical bytes -> POST /upload/image (:8188) ->
 * POST /prompt with LoadImage + VAEEncode + KSampler -> GET /history ->
 * GET /view -> Artifact #2 (parentArtifactId = Artifact #1).
 * Then Artifact #2 -> Artifact #3 (parentArtifactId = Artifact #2).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert';
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

// 1x1 valid PNG binary buffer (67 bytes)
const SAMPLE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Revised 1x1 valid PNG binary buffer (68 bytes)
const REVISED_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

function startMockComfyUIServer(port = 8188) {
  let uploadedImageBytes = null;
  let receivedWorkflow = null;
  const promptId = `prompt-${Date.now()}`;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    if (url.pathname === '/system_stats' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ system: { os: 'windows', comfyui_version: '0.2.2' } }));
      return;
    }

    if (url.pathname === '/upload/image' && req.method === 'POST') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        uploadedImageBytes = Buffer.concat(chunks);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ name: 'comfy_uploaded_image.png', subfolder: '', type: 'input' }));
      });
      return;
    }

    if (url.pathname === '/prompt' && req.method === 'POST') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
        receivedWorkflow = body.prompt;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ prompt_id: promptId, number: 1 }));
      });
      return;
    }

    if (url.pathname.startsWith('/history/') && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const resp = {};
      resp[promptId] = {
        outputs: {
          "9": {
            images: [
              { filename: 'comfy_output_revised.png', subfolder: '', type: 'output' }
            ]
          }
        },
        status: { completed: true, status_str: 'success' }
      };
      res.end(JSON.stringify(resp));
      return;
    }

    if (url.pathname === '/view' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(REVISED_PNG);
      return;
    }

    res.writeHead(404);
    res.end();
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve({
        server,
        getUploadedBytes: () => uploadedImageBytes,
        getWorkflow: () => receivedWorkflow,
        close: () => new Promise(r => server.close(r))
      });
    });
  });
}

async function runTest() {
  console.log(B('═══════════════════════════════════════════════════════════════════════════════'));
  console.log(B(' COMFYUI ONLINE RUNTIME PROTOCOL & CHAINING VERIFICATION'));
  console.log(B('═══════════════════════════════════════════════════════════════════════════════\n'));

  // Start Mock ComfyUI Server on port 8199 to avoid clashing with live ComfyUI
  const testPort = 8199;
  console.log(Y(`Starting simulated ComfyUI service on 127.0.0.1:${testPort}...`));
  const mockComfy = await startMockComfyUIServer(testPort);
  console.log(G(`ComfyUI server online on http://127.0.0.1:${testPort}\n`));

  const comfyProvider = imageEditingInstance.providers.get('COMFYUI');
  const origBaseUrl = comfyProvider.baseUrl;
  comfyProvider.baseUrl = `http://127.0.0.1:${testPort}`;

  // 1. Create Initial Artifact #1
  const art1Id = `img-art1-${Date.now()}`;
  const art1File = `${art1Id}.png`;
  const art1Path = path.join(ARTIFACTS_DIR, art1File);
  fs.writeFileSync(art1Path, SAMPLE_PNG);
  const art1Url = `/api/artifacts/images/${art1File}`;

  try {
    // ── TEST A: Probe Check with ComfyUI ONLINE ──
    console.log(Y('TEST A: ComfyUI Capability Probe when ONLINE'));
    const probe = await comfyProvider.capabilityProbe();
    assert.strictEqual(probe.available, true, 'ComfyUI probe should report available=true');
    pass('ComfyUI capability probe reports available=true when port is active', probe.reason);

    // ── TEST B: True Revision (Artifact #1 -> Artifact #2 via ComfyUI) ──
    console.log(Y('\nTEST B: True Image Revision via ComfyUI Protocol'));
    const result2 = await imageEditingInstance.editImage({
      referenceImage: art1Url,
      prompt: 'pesawat terbang suasana sunset dengan awan jingga keemasan',
      providerOverride: 'COMFYUI',
      requestId: `e2e-rev1-${Date.now()}`
    });

    assert.strictEqual(result2.success, true, `Expected revision to succeed: ${result2.error}`);
    assert.ok(result2.artifact, 'Expected artifact to be created');
    assert.strictEqual(result2.artifact.parentArtifactId, art1Id, `parentArtifactId must be ${art1Id}`);
    assert.strictEqual(result2.artifact.provider, 'COMFYUI', 'Provider must be COMFYUI');
    assert.strictEqual(result2.artifact.operation, 'REVISION', 'Operation must be REVISION');
    assert.strictEqual(result2.artifact.renderable, true, 'Artifact must be renderable');

    // Verify multipart upload received actual binary bytes
    const uploaded = mockComfy.getUploadedBytes();
    assert.ok(uploaded && uploaded.length > SAMPLE_PNG.length, 'ComfyUI /upload/image must receive binary multipart form');
    assert.ok(uploaded.includes(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])), 'Uploaded payload must contain valid PNG binary buffer');
    pass('Physical Artifact #1 binary Buffer uploaded to ComfyUI /upload/image');

    // Verify LoadImage -> VAEEncode -> KSampler workflow structure
    const workflow = mockComfy.getWorkflow();
    assert.ok(workflow['10'], 'Workflow must contain LoadImage node (10)');
    assert.strictEqual(workflow['10'].inputs.image, 'comfy_uploaded_image.png');
    assert.ok(workflow['5'], 'Workflow must contain VAEEncode node (5) connected to LoadImage');
    assert.ok(workflow['3'], 'Workflow must contain KSampler node (3) for img2img');
    pass('ComfyUI img2img workflow executed with LoadImage -> VAEEncode -> KSampler pipeline');
    pass(`Artifact #2 created with parentArtifactId=${art1Id} (url=${result2.artifact.url})`);

    // ── TEST C: Chained Revision (Artifact #2 -> Artifact #3) ──
    console.log(Y('\nTEST C: Chained Revision Lineage (#2 -> #3)'));
    const result3 = await imageEditingInstance.editImage({
      referenceImage: result2.artifact.url,
      prompt: 'sekarang jadikan suasana malam bertabur bintang',
      providerOverride: 'COMFYUI',
      requestId: `e2e-rev2-${Date.now()}`
    });

    assert.strictEqual(result3.success, true, `Expected chained revision to succeed: ${result3.error}`);
    assert.ok(result3.artifact, 'Expected Artifact #3 to be created');
    assert.strictEqual(result3.artifact.parentArtifactId, result2.artifact.id, `Artifact #3 parentArtifactId must be Artifact #2 id (${result2.artifact.id})`);
    assert.strictEqual(result3.artifact.provider, 'COMFYUI');
    pass(`Artifact #3 created with parentArtifactId=${result2.artifact.id} (url=${result3.artifact.url})`);
    pass('Chained revision preserved multi-generational lineage: Artifact #1 -> Artifact #2 -> Artifact #3');

  } catch (err) {
    fail('E2E Test Failed', err.message);
  } finally {
    comfyProvider.baseUrl = origBaseUrl;
    await mockComfy.close();
    console.log(DIM('\nClosed mock ComfyUI server.'));
    try {
      if (fs.existsSync(art1Path)) fs.unlinkSync(art1Path);
    } catch (_) {}
  }

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

runTest().catch(err => {
  console.error(R('Fatal error:'), err);
  process.exit(1);
});
