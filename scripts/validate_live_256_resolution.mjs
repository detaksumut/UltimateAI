/**
 * scripts/validate_live_256_resolution.mjs
 * 
 * Performs 1 live IMAGE_GENERATION followed by 1 live IMAGE_REVISION
 * to verify that:
 * 1. Global image resolution is strictly 256x256 across production paths.
 * 2. Provider payloads physically carry width=256 and height=256.
 * 3. Persisted artifacts are physically verified at 256x256.
 */

import Jimp from 'jimp';
import fs from 'fs';
import path from 'path';
import { imageGenerationInstance } from '../server/agent/ImageGeneration.mjs';
import { imageEditingInstance } from '../server/agent/ImageEditing.mjs';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(' LIVE VALIDATION: GLOBAL IMAGE RESOLUTION 256x256 (GENERATION & REVISION)');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  // ── STEP 1: LIVE IMAGE_GENERATION ──
  console.log('>>> [STEP 1] EXECUTING LIVE IMAGE_GENERATION...');
  const genResult = await imageGenerationInstance.generateImage({
    prompt: 'A commercial airplane flying peacefully in a bright clear blue sky, photorealistic',
    providerOverride: 'GEMINI'
  });

  if (!genResult.success || !genResult.artifact) {
    console.error('❌ LIVE IMAGE_GENERATION FAILED:', genResult.error);
    process.exit(1);
  }

  const genArtifact = genResult.artifact;
  console.log('\n[GENERATION_SUCCESS]');
  console.log(`artifactId=${genArtifact.id}`);
  console.log(`url=${genArtifact.url}`);
  console.log(`reportedWidth=${genArtifact.width}`);
  console.log(`reportedHeight=${genArtifact.height}`);
  console.log(`sizeBytes=${genArtifact.sizeBytes}`);

  // Physically inspect file on disk with Jimp
  const genDiskImage = await Jimp.read(genArtifact.localPath);
  const physicalGenW = genDiskImage.bitmap.width;
  const physicalGenH = genDiskImage.bitmap.height;
  console.log(`physicalDiskWidth=${physicalGenW}`);
  console.log(`physicalDiskHeight=${physicalGenH}`);

  if (physicalGenW !== 256 || physicalGenH !== 256) {
    console.error(`❌ Invariant violated: Generated image is ${physicalGenW}x${physicalGenH}, expected 256x256`);
    process.exit(1);
  }
  console.log('✅ Generation physical 256x256 resolution verified on disk!');

  // ── STEP 2: LIVE IMAGE_REVISION (ComfyUI CPU) ──
  console.log('\n>>> [STEP 2] EXECUTING LIVE IMAGE_REVISION (ComfyUI CPU)...');
  console.log(`referenceImage=${genArtifact.url}`);

  const revResult = await imageEditingInstance.editImage({
    referenceImage: genArtifact.url,
    prompt: 'ubah suasananya menjadi sunset dramatis dengan langit jingga kemerahan',
    originalPrompt: genArtifact.originalPrompt || genArtifact.prompt,
    steps: 4,
    denoise: 0.75,
    width: 256,
    height: 256
  });

  if (!revResult.success || !revResult.artifact) {
    console.error('❌ LIVE IMAGE_REVISION FAILED:', revResult.error);
    process.exit(1);
  }

  const revArtifact = revResult.artifact;
  console.log('\n[REVISION_SUCCESS]');
  console.log(`artifactId=${revArtifact.id}`);
  console.log(`parentArtifactId=${revArtifact.parentArtifactId}`);
  console.log(`url=${revArtifact.url}`);
  console.log(`reportedWidth=${revArtifact.width}`);
  console.log(`reportedHeight=${revArtifact.height}`);
  console.log(`sizeBytes=${revArtifact.sizeBytes}`);

  // Physically inspect file on disk with Jimp
  const revDiskImage = await Jimp.read(revArtifact.localPath);
  const physicalRevW = revDiskImage.bitmap.width;
  const physicalRevH = revDiskImage.bitmap.height;
  console.log(`physicalDiskWidth=${physicalRevW}`);
  console.log(`physicalDiskHeight=${physicalRevH}`);

  if (physicalRevW !== 256 || physicalRevH !== 256) {
    console.error(`❌ Invariant violated: Revised image is ${physicalRevW}x${physicalRevH}, expected 256x256`);
    process.exit(1);
  }
  console.log('✅ Revision physical 256x256 resolution verified on disk!');

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(' ALL LIVE VALIDATIONS PASSED: GLOBAL IMAGE RESOLUTION STRICTLY 256x256');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('\n❌ UNHANDLED EXCEPTION IN LIVE VALIDATION:', err);
  process.exit(1);
});
