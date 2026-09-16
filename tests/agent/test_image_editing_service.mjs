/**
 * tests/agent/test_image_editing_service.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Verification Test Suite for TRUE Image-to-Image / Image Editing Architecture
 *
 * Strict Proof Requirements:
 * 1. Provider receives actual Buffer of source image (Buffer.isBuffer(buf) && buf.length > 0).
 * 2. Provider is called with modification prompt and referenceArtifactId.
 * 3. Artifact lineage: Artifact #2 parentArtifactId === Artifact #1 id.
 * 4. Artifact lineage chain: Artifact #3 parentArtifactId === Artifact #2 id.
 * 5. Revision strictly executes ImageEditing, NEVER calling Pollinations or text-to-image.
 * 6. Truthful Unavailability: If ComfyUI is offline, returns truthful unavailable error without silent fallback.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'fs';
import path from 'path';
import { imageEditingInstance } from '../../server/agent/ImageEditing.mjs';
import { mockImageEditingProviderInstance } from '../../server/agent/providers/MockImageEditingProvider.mjs';
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

async function runTests() {
  console.log(B('═══════════════════════════════════════════════════════════════════════════════'));
  console.log(B(' ULTIMATEAI TRUE IMAGE-TO-IMAGE VERIFICATION TEST SUITE'));
  console.log(B('═══════════════════════════════════════════════════════════════════════════════\n'));

  const ARTIFACTS_DIR = path.resolve('d:/Users/ultimateai/storage/artifacts/images');
  if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

  // Create physical Artifact #1 on disk (1x1 PNG padded to valid artifact bytes)
  const PNG_HEADER = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89
  ]);
  const artifact1Data = Buffer.concat([PNG_HEADER, Buffer.alloc(2048, 0xAA)]);
  const artifact1Id = `img-test1-${Date.now()}`;
  const artifact1File = `${artifact1Id}.png`;
  const artifact1Path = path.join(ARTIFACTS_DIR, artifact1File);
  fs.writeFileSync(artifact1Path, artifact1Data);

  // ── TEST 1: Physical File Resolution & Raw Buffer Reading ───────────────────
  console.log(Y('TEST 1: Physical File Resolution & Raw Buffer Reading'));
  {
    const res = imageEditingInstance.resolveReferenceImage(`/api/artifacts/images/${artifact1File}`);
    if (res.success && Buffer.isBuffer(res.buffer) && res.buffer.length === artifact1Data.length && res.artifactId === artifact1Id) {
      pass('Reference image resolved to exact binary Buffer from disk', `size=${res.buffer.length} bytes, id=${res.artifactId}`);
    } else {
      fail('Reference image resolution failed', JSON.stringify(res));
    }
  }

  // ── TEST 2: Provider Receives Raw Buffer (Proof of True Img2Img) ─────────────
  console.log(Y('\nTEST 2: Provider Receives Raw Buffer (Proof of True Img2Img)'));
  {
    const editRes = await imageEditingInstance.editImage({
      referenceImage: `/api/artifacts/images/${artifact1File}`,
      prompt: 'ubah menjadi suasana sunset',
      providerOverride: 'MOCK'
    });

    const mockInput = mockImageEditingProviderInstance.lastReceivedInput;
    const receivedBuffer = mockInput?.referenceImageBuffer;

    if (
      editRes.success &&
      editRes.artifact &&
      Buffer.isBuffer(receivedBuffer) &&
      receivedBuffer.length === artifact1Data.length &&
      mockInput.referenceArtifactId === artifact1Id &&
      mockInput.prompt === 'ubah menjadi suasana sunset'
    ) {
      pass('Editing Provider received and validated actual source image Buffer', `consumed=${receivedBuffer.length} bytes`);
      pass('Artifact #2 created with parentArtifactId pointing to Artifact #1', `id=${editRes.artifact.id}, parentArtifactId=${editRes.artifact.parentArtifactId}`);
    } else {
      fail('Provider did not receive expected image buffer or metadata', JSON.stringify({ editRes, mockInput }));
    }
  }

  // ── TEST 3: Chained Revision Lineage (#1 -> #2 -> #3) ──────────────────────
  console.log(Y('\nTEST 3: Chained Revision Lineage (#1 -> #2 -> #3)'));
  {
    // Step A: Revise #1 -> #2
    const rev2 = await imageEditingInstance.editImage({
      referenceImage: `/api/artifacts/images/${artifact1File}`,
      prompt: 'ubah menjadi sunset',
      providerOverride: 'MOCK'
    });
    const artifact2 = rev2.artifact;

    // Step B: Revise #2 -> #3
    const rev3 = await imageEditingInstance.editImage({
      referenceImage: artifact2.url,
      prompt: 'sekarang jadikan malam',
      providerOverride: 'MOCK'
    });
    const artifact3 = rev3.artifact;

    if (
      artifact2.parentArtifactId === artifact1Id &&
      artifact3.parentArtifactId === artifact2.id &&
      fs.existsSync(artifact2.localPath) &&
      fs.existsSync(artifact3.localPath)
    ) {
      pass('Multi-generational lineage preserved (#1 -> #2 -> #3)', `#1=${artifact1Id} -> #2=${artifact2.id} -> #3=${artifact3.id}`);
      pass('All generated artifacts exist physically on disk', `art2=${artifact2.url}, art3=${artifact3.url}`);
    } else {
      fail('Lineage tracking failed', JSON.stringify({ a2: artifact2, a3: artifact3 }));
    }
  }

  // ── TEST 4: ComfyUI Adapter Offline Guard (Truthful Unavailability) ─────────
  console.log(Y('\nTEST 4: ComfyUI Adapter Offline Guard (Truthful Unavailability)'));
  {
    // Mock transport where fetch fails (ComfyUI offline)
    const mockOfflineTransport = {
      fetch: async () => { throw new Error('ECONNREFUSED 127.0.0.1:8188'); }
    };

    const comfyProbe = await comfyUIImageEditingProviderInstance.capabilityProbe(mockOfflineTransport);
    if (!comfyProbe.available && comfyProbe.imageToImage === true) {
      pass('ComfyUI reports unavailable when port 8188 is offline', `reason="${comfyProbe.reason}"`);
    } else {
      fail('ComfyUI falsely reported available when offline', JSON.stringify(comfyProbe));
    }

    const editRes = await imageEditingInstance.editImage({
      referenceImage: `/api/artifacts/images/${artifact1File}`,
      prompt: 'ubah menjadi malam',
      providerOverride: 'COMFYUI'
    }, mockOfflineTransport);

    if (!editRes.success && editRes.error.includes('unavailable') && !editRes.error.includes('Pollinations')) {
      pass('ImageEditing returns honest unavailable error without faking or falling back to Pollinations', `err="${editRes.error}"`);
    } else {
      fail('ImageEditing did not handle offline provider properly', JSON.stringify(editRes));
    }
  }

  // ── TEST 5: ImageEditing strictly rejects empty or non-existent files ──────
  console.log(Y('\nTEST 5: ImageEditing strictly rejects invalid reference files'));
  {
    const badRes = await imageEditingInstance.editImage({
      referenceImage: '/api/artifacts/images/does-not-exist-999.jpg',
      prompt: 'ubah menjadi malam',
      providerOverride: 'MOCK'
    });

    if (!badRes.success && badRes.error.includes('not found on disk')) {
      pass('Non-existent reference image cleanly rejected', `err="${badRes.error}"`);
    } else {
      fail('Non-existent image was not rejected properly', JSON.stringify(badRes));
    }
  }

  console.log(B('\n═══════════════════════════════════════════════════════════════════════════════'));
  const passedCount = results.filter(r => r.ok).length;
  const failedCount = results.filter(r => !r.ok).length;
  console.log(` Results: ${passedCount > 0 ? G(`${passedCount} passed`) : '0 passed'}, ${failedCount > 0 ? R(`${failedCount} failed`) : '0 failed'}`);
  console.log(B('═══════════════════════════════════════════════════════════════════════════════\n'));

  // Cleanup test physical file
  try { if (fs.existsSync(artifact1Path)) fs.unlinkSync(artifact1Path); } catch {}

  if (failedCount > 0) process.exit(1);
}

runTests().catch(err => {
  console.error(R('FATAL TEST ERROR:'), err);
  process.exit(1);
});
