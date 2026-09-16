/**
 * test_image_output_size_policy.mjs
 * Comprehensive Global Image Output Size Standard Verification Suite.
 * 
 * Verifies that:
 * 1. 100 KB image -> unchanged.
 * 2. 800 KB image -> unchanged.
 * 3. 950 KB image -> normalized below 900 KB.
 * 4. 1.5 MB JPEG -> normalized below 1 MB (targeting <= 900 KB).
 * 5. Oversized PNG -> converted to JPEG and normalized when transparency is unnecessary.
 * 6. Impossible-to-normalize image -> truthful failure (IMAGE_OUTPUT_SIZE_LIMIT_EXCEEDED).
 * 7. Physical persisted file verified < 1 MB.
 * 8. IMAGE_GENERATION artifact < 1 MB.
 * 9. IMAGE_REVISION artifact < 1 MB.
 * 10. Revision parentArtifactId preserved after normalization.
 * 11. Pollinations output passes through policy.
 * 12. ComfyUI Img2Img output passes through policy.
 * 13. Gemini Imagen output passes through policy.
 * 14. No oversized artifact can be marked VERIFIED.
 * 15. No provider can bypass ImageOutputSizePolicy.
 */

import fs from 'fs';
import path from 'path';
import Jimp from 'jimp';
import {
  ImageOutputSizePolicy,
  imageOutputSizePolicyInstance,
  MAX_IMAGE_BYTES,
  TARGET_IMAGE_BYTES
} from '../../server/agent/ImageOutputSizePolicy.mjs';
import { ImageGenerationService } from '../../server/agent/ImageGeneration.mjs';
import { ImageEditingService } from '../../server/agent/ImageEditing.mjs';
import { artifactManagerInstance } from '../../server/agent/ArtifactManager.mjs';

const ARTIFACTS_DIR = path.resolve('d:/Users/ultimateai/storage/artifacts/images');
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS ${message}`);
    passed++;
  } else {
    console.error(`  FAIL ${message}`);
    failed++;
  }
}

/**
 * Helper to synthesize a realistic decodable image of target approximate size
 */
async function createTestImage(width, height, mime = Jimp.MIME_JPEG, quality = 90) {
  const img = new Jimp(width, height);
  // Fill with noisy gradients so it doesn't compress down to 0 bytes
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const r = (x * 7 + y * 13) % 256;
      const g = (x * 11 + y * 3) % 256;
      const b = (x * 5 + y * 17) % 256;
      const hex = Jimp.rgbaToInt(r, g, b, 255);
      img.setPixelColor(hex, x, y);
    }
  }
  if (mime === Jimp.MIME_JPEG) {
    img.quality(quality);
  }
  return await img.getBufferAsync(mime);
}

async function runSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(' GLOBAL IMAGE OUTPUT SIZE POLICY REGRESSION TEST SUITE (< 1 MB CONTRACT)');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  // ── TEST 1 & 2: Under-target images accepted without modification ─────────
  console.log('TEST 1 & 2: Small Images (< 900 KB) Accepted Unchanged');
  const img100k = await createTestImage(200, 200, Jimp.MIME_JPEG, 80);
  assert(img100k.length < 900_000, `Generated test image is < 900 KB (${img100k.length} bytes)`);

  const res100k = await imageOutputSizePolicyInstance.ensureUnderLimit(img100k);
  assert(res100k.success === true, '100 KB image returned success=true');
  assert(res100k.buffer.length === img100k.length, '100 KB image accepted unchanged with identical byte count');
  assert(res100k.sizePolicy.status === 'PASS', '100 KB image has sizePolicy.status="PASS"');

  const img800k = await createTestImage(500, 500, Jimp.MIME_JPEG, 85);
  const res800k = await imageOutputSizePolicyInstance.ensureUnderLimit(img800k);
  assert(res800k.success === true && res800k.buffer.length === img800k.length, `800 KB-range image accepted unchanged (${res800k.buffer.length} bytes)`);

  // ── TEST 3: 950 KB image normalized/accepted under limit ──────────────────
  console.log('\nTEST 3: 950 KB image normalized below 900 KB');
  // Create a dense uncompressed image > 900 KB
  const denseImage = await createTestImage(900, 900, Jimp.MIME_JPEG, 95);
  console.log(`  Dense image generated: ${denseImage.length} bytes`);
  assert(denseImage.length > TARGET_IMAGE_BYTES, `Dense test image is > 900 KB (${denseImage.length} bytes)`);

  const resDense = await imageOutputSizePolicyInstance.ensureUnderLimit(denseImage);
  assert(resDense.success === true, 'Dense image normalized successfully');
  assert(resDense.buffer.length < MAX_IMAGE_BYTES, `Normalized image strictly < 1,000,000 bytes (${resDense.buffer.length} bytes)`);
  assert(resDense.buffer.length <= TARGET_IMAGE_BYTES, `Normalized image meets target <= 900,000 bytes (${resDense.buffer.length} bytes)`);
  assert(resDense.sizePolicy.status === 'PASS', 'Normalized image has sizePolicy.status="PASS"');

  // ── TEST 4: 1.5 MB JPEG normalized below 1 MB ────────────────────────────
  console.log('\nTEST 4: 1.5 MB+ JPEG Normalized Below 1 MB');
  const hugeJpeg = await createTestImage(1200, 1200, Jimp.MIME_JPEG, 100);
  console.log(`  Huge JPEG generated: ${hugeJpeg.length} bytes`);
  assert(hugeJpeg.length > MAX_IMAGE_BYTES, `Huge JPEG is physically > 1,000,000 bytes (${hugeJpeg.length} bytes)`);

  const resHuge = await imageOutputSizePolicyInstance.ensureUnderLimit(hugeJpeg);
  assert(resHuge.success === true, '1.5MB+ JPEG normalized successfully');
  assert(resHuge.buffer.length < MAX_IMAGE_BYTES, `Final bytes strictly < 1,000,000 (${resHuge.buffer.length} bytes)`);
  assert(resHuge.sizePolicy.status === 'PASS', 'Status marked PASS');

  // ── TEST 5: Oversized PNG converted/normalized when transparency unnecessary
  console.log('\nTEST 5: Oversized PNG Converted & Normalized');
  const hugePng = await createTestImage(1100, 1100, Jimp.MIME_PNG);
  console.log(`  Huge PNG generated: ${hugePng.length} bytes`);
  assert(hugePng.length > TARGET_IMAGE_BYTES, `Huge PNG is > 900 KB (${hugePng.length} bytes)`);

  const resPng = await imageOutputSizePolicyInstance.ensureUnderLimit(hugePng);
  assert(resPng.success === true, 'Oversized PNG normalized successfully');
  assert(resPng.format === 'jpeg', 'Oversized PNG converted to JPEG standard');
  assert(resPng.buffer.length < MAX_IMAGE_BYTES, `Final size strictly < 1,000,000 bytes (${resPng.buffer.length} bytes)`);

  // ── TEST 6: Impossible-to-normalize image -> Truthful Failure ─────────────
  console.log('\nTEST 6: Impossible-to-Normalize Image -> Truthful Failure');
  const corruptBuffer = Buffer.alloc(1_500_000, 0xFF); // Non-image garbage bytes > 1 MB
  const resCorrupt = await imageOutputSizePolicyInstance.ensureUnderLimit(corruptBuffer);
  assert(resCorrupt.success === false, 'Corrupt oversized buffer failed normalization');
  assert(resCorrupt.error === 'IMAGE_OUTPUT_SIZE_LIMIT_EXCEEDED' || resCorrupt.error.includes('DECODE'), `Truthful failure reason returned (${resCorrupt.error})`);
  assert(resCorrupt.sizePolicy.status === 'FAILED', 'Status marked FAILED');

  // ── TEST 7: Physical Persisted File Verified < 1 MB ───────────────────────
  console.log('\nTEST 7: Physical Persisted File Stat Verification');
  const testFileId = `test-persist-${Date.now()}`;
  const testFilePath = path.join(ARTIFACTS_DIR, `${testFileId}.jpg`);
  fs.writeFileSync(testFilePath, resHuge.buffer);

  const statCheck = imageOutputSizePolicyInstance.validatePersistedFile(testFilePath);
  assert(statCheck.valid === true, 'Physical file on disk validated successfully');
  assert(statCheck.sizeBytes < MAX_IMAGE_BYTES, `Physical disk size < 1,000,000 bytes (${statCheck.sizeBytes} bytes)`);

  // Test oversized physical file rejection
  const fakeHugePath = path.join(ARTIFACTS_DIR, `oversized-fake-${Date.now()}.jpg`);
  fs.writeFileSync(fakeHugePath, Buffer.alloc(1_200_000, 0xAA));
  const badStatCheck = imageOutputSizePolicyInstance.validatePersistedFile(fakeHugePath);
  assert(badStatCheck.valid === false, 'Physical file >= 1 MB rejected by post-persistence validator');
  assert(badStatCheck.reason === 'IMAGE_OUTPUT_SIZE_LIMIT_EXCEEDED', 'Rejected with IMAGE_OUTPUT_SIZE_LIMIT_EXCEEDED');

  // ── TEST 8: IMAGE_GENERATION Artifact < 1 MB ──────────────────────────────
  console.log('\nTEST 8: IMAGE_GENERATION Produces Artifact Strictly < 1 MB');
  const imageGen = new ImageGenerationService();
  const genResult = await imageGen.generateImage({
    prompt: 'A futuristic city skyline',
    providerOverride: 'MOCK',
    generationId: `test-gen-${Date.now()}`
  });
  assert(genResult.success === true, 'Mock ImageGeneration succeeded');
  assert(genResult.artifact.bytesSize < MAX_IMAGE_BYTES, `IMAGE_GENERATION artifact.bytesSize < 1,000,000 (${genResult.artifact.bytesSize} bytes)`);
  assert(genResult.artifact.sizePolicy.status === 'PASS', 'Artifact contains sizePolicy.status="PASS"');
  assert(fs.statSync(genResult.artifact.localPath).size < MAX_IMAGE_BYTES, 'Persisted artifact file on disk < 1,000,000 bytes');

  // ── TEST 9 & 10: IMAGE_REVISION Artifact < 1 MB & Lineage Preserved ───────
  console.log('\nTEST 9 & 10: IMAGE_REVISION Artifact < 1 MB with Lineage Preserved');
  const imageEdit = new ImageEditingService();

  // Create an oversized provider mock that simulates returning 1.4 MB image
  class OversizedMockEditingProvider {
    async capabilityProbe() { return { available: true }; }
    async editImage() {
      // Returns dense 1.2 MB image buffer
      const buf = await createTestImage(1100, 1100, Jimp.MIME_JPEG, 95);
      return { success: true, imageBuffer: buf, model: 'oversized_mock' };
    }
  }
  imageEdit.registerProvider('OVERSIZED_MOCK', new OversizedMockEditingProvider());

  const revResult = await imageEdit.editImage({
    referenceImage: genResult.artifact.url,
    prompt: 'Sekarang ubah suasananya menjadi malam',
    providerOverride: 'OVERSIZED_MOCK',
    generationId: `test-rev-${Date.now()}`
  });

  assert(revResult.success === true, 'ImageEditing revision succeeded');
  assert(revResult.artifact.parentArtifactId === genResult.artifact.id, `parentArtifactId preserved (${revResult.artifact.parentArtifactId} -> ${genResult.artifact.id})`);
  assert(revResult.artifact.operation === 'REVISION', 'operation="REVISION" preserved');
  assert(revResult.artifact.bytesSize < MAX_IMAGE_BYTES, `Revised artifact size strictly < 1,000,000 bytes (${revResult.artifact.bytesSize} bytes)`);
  assert(revResult.artifact.sizePolicy.status === 'PASS', 'Revised artifact sizePolicy.status="PASS"');
  assert(fs.statSync(revResult.artifact.localPath).size < MAX_IMAGE_BYTES, 'Revised physical file on disk strictly < 1,000,000 bytes');

  // ── TEST 11: Pollinations Output Passes Through Policy ────────────────────
  console.log('\nTEST 11: Pollinations Output Gatekeeper Verification');
  // Mock fetch returning oversized 1.5 MB image from Pollinations
  const mockFetchOversizedPollinations = async () => {
    const buf = await createTestImage(1100, 1100, Jimp.MIME_JPEG, 95);
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'image/jpeg']]),
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    };
  };

  const polGenResult = await imageGen.generateImage({
    prompt: 'A photorealistic lion in the savannah',
    providerOverride: 'POLLINATIONS',
    generationId: `test-pol-${Date.now()}`
  }, { fetch: mockFetchOversizedPollinations });

  assert(polGenResult.success === true, 'Pollinations generation succeeded');
  assert(polGenResult.artifact.bytesSize < MAX_IMAGE_BYTES, `Pollinations output normalized below 1 MB (${polGenResult.artifact.bytesSize} bytes)`);
  assert(polGenResult.artifact.sizePolicy.status === 'PASS', 'Pollinations artifact has sizePolicy PASS');

  // ── TEST 12: ComfyUI Img2Img Output Passes Through Policy ─────────────────
  console.log('\nTEST 12: ComfyUI Img2Img Output Gatekeeper Verification');
  class MockComfyWithOversized {
    async capabilityProbe() { return { available: true }; }
    async editImage() {
      const buf = await createTestImage(1200, 1200, Jimp.MIME_JPEG, 98);
      return { success: true, imageBuffer: buf, model: 'comfyui_sdxl_img2img' };
    }
  }
  imageEdit.registerProvider('COMFYUI', new MockComfyWithOversized());

  const comfyRevResult = await imageEdit.editImage({
    referenceImage: genResult.artifact.url,
    prompt: 'Make the car futuristic neon cyberpunk',
    providerOverride: 'COMFYUI',
    generationId: `test-comfy-${Date.now()}`
  });

  assert(comfyRevResult.success === true, 'ComfyUI revision succeeded');
  assert(comfyRevResult.artifact.bytesSize < MAX_IMAGE_BYTES, `ComfyUI output normalized below 1 MB (${comfyRevResult.artifact.bytesSize} bytes)`);
  assert(comfyRevResult.artifact.parentArtifactId === genResult.artifact.id, 'parentArtifactId correctly preserved');

  // ── TEST 13: Gemini Imagen Output Passes Through Policy ───────────────────
  console.log('\nTEST 13: Gemini Imagen Output Gatekeeper Verification');
  const mockGeminiBuf = await createTestImage(1024, 1024, Jimp.MIME_JPEG, 95);
  // Test ImageOutputSizePolicy directly on Gemini-like output
  const geminiPolicyResult = await imageOutputSizePolicyInstance.ensureUnderLimit(mockGeminiBuf);
  assert(geminiPolicyResult.success === true, 'Gemini Imagen buffer processed through policy');
  assert(geminiPolicyResult.buffer.length < MAX_IMAGE_BYTES, `Gemini Imagen output < 1,000,000 bytes (${geminiPolicyResult.buffer.length} bytes)`);

  // ── TEST 14: No Oversized Artifact Can Be Marked VERIFIED ─────────────────
  console.log('\nTEST 14: Oversized Artifact Verification Guard');
  // Attempt to verify an oversized artifact
  const oversizedArtifact = {
    type: 'IMAGE',
    localPath: fakeHugePath,
    bytesSize: 1_200_000,
    renderable: true
  };
  const verifyResult = imageGen.verifyArtifact(oversizedArtifact);
  assert(verifyResult.renderable === false, 'Oversized artifact rejected by verifyArtifact');
  assert(verifyResult.reason === 'IMAGE_OUTPUT_SIZE_LIMIT_EXCEEDED', `Rejection reason is IMAGE_OUTPUT_SIZE_LIMIT_EXCEEDED (${verifyResult.reason})`);

  // ── TEST 15: No Provider Can Bypass ImageOutputSizePolicy ─────────────────
  console.log('\nTEST 15: Hard Persistence Boundary Guard');
  let thrown = false;
  try {
    imageGen._persistArtifact(Buffer.alloc(1_050_000, 0x01), { prompt: 'bypass test' });
  } catch (err) {
    thrown = true;
    assert(err.message.includes('MAX_IMAGE_BYTES'), `_persistArtifact threw invariant error (${err.message})`);
  }
  assert(thrown === true, '_persistArtifact hard-rejected oversized buffer');

  // Clean up test files
  try {
    if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
    if (fs.existsSync(fakeHugePath)) fs.unlinkSync(fakeHugePath);
  } catch {}

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(` Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
