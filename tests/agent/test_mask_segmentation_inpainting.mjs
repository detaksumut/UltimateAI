/**
 * tests/agent/test_mask_segmentation_inpainting.mjs
 * 
 * Verifies:
 * 1. MaskSegmentationService produces valid black/white inpaint mask.
 * 2. ComfyUIImageEditingProvider._buildImg2ImgWorkflow outputs VAEEncodeForInpaint and LoadImageMask.
 * 3. Default CFG is 7.5 (high contrast).
 * 4. RevisionPromptEnhancer emits high contrast and anti-dullness conditioning.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { maskSegmentationServiceInstance } from '../../server/agent/MaskSegmentationService.mjs';
import { comfyUIImageEditingProviderInstance, COMFYUI_IMG2IMG_CFG } from '../../server/agent/providers/ComfyUIImageEditingProvider.mjs';
import { RevisionPromptEnhancer } from '../../server/agent/RevisionPromptEnhancer.mjs';

const G = s => `\x1b[32m${s}\x1b[0m`;
const B = s => `\x1b[36m${s}\x1b[0m`;

async function run() {
  console.log(B('═══════════════════════════════════════════════════════════════════'));
  console.log(B(' INPAINTING MASKING & HIGH CONTRAST VERIFICATION SUITE'));
  console.log(B('═══════════════════════════════════════════════════════════════════\n'));

  // [1] CFG Scale Verification (Contrast)
  console.log('[1] CFG Scale Verification (7.5 for punchy contrast):');
  assert.strictEqual(COMFYUI_IMG2IMG_CFG, 7.5, 'Default CFG must be 7.5 for vivid contrast');
  console.log(`  ${G('✓')} COMFYUI_IMG2IMG_CFG is strictly 7.5`);

  // [2] Inpaint Workflow Architecture
  console.log('\n[2] Inpaint Workflow Architecture:');
  const inpaintWorkflow = comfyUIImageEditingProviderInstance._buildImg2ImgWorkflow({
    uploadedFilename: 'test_input.png',
    uploadedMaskFilename: 'test_mask.png',
    prompt: 'fiery orange sunset',
    steps: 8,
    denoise: 0.75
  });

  assert.ok(inpaintWorkflow['12'], 'Node 12 (LoadImageMask) must exist');
  assert.strictEqual(inpaintWorkflow['12'].class_type, 'LoadImageMask');
  assert.strictEqual(inpaintWorkflow['12'].inputs.image, 'test_mask.png');

  assert.ok(inpaintWorkflow['5'], 'Node 5 must exist');
  assert.strictEqual(inpaintWorkflow['5'].class_type, 'VAEEncodeForInpaint');
  assert.deepStrictEqual(inpaintWorkflow['5'].inputs.pixels, ['11', 0]);
  assert.deepStrictEqual(inpaintWorkflow['5'].inputs.mask, ['12', 0]);
  assert.strictEqual(inpaintWorkflow['3'].inputs.steps, 8);
  assert.strictEqual(inpaintWorkflow['3'].inputs.cfg, 7.5);
  console.log(`  ${G('✓')} Workflow correctly binds LoadImageMask -> VAEEncodeForInpaint -> KSampler (CFG 7.5)`);

  // [3] Prompt Enhancement Contrast Conditioning
  console.log('\n[3] Prompt Enhancement Contrast Conditioning:');
  const enhanced = RevisionPromptEnhancer.enhance({
    modification: 'ubah suasananya jadi sunset',
    originalPrompt: 'pesawat terbang melintasi gunung'
  });
  assert(enhanced.positivePrompt.includes('high contrast, vivid saturated colors'));
  assert(enhanced.negativePrompt.includes('washed out, low contrast, dull grey'));
  console.log(`  ${G('✓')} Positive prompt includes high contrast tokens and negative prompt suppresses dull grey/washed out colors`);

  // [4] Mask Segmentation Test on synthetic/test buffer
  console.log('\n[4] Mask Segmentation Service:');
  const Jimp = (await import('jimp')).default;
  const testImg = new Jimp(512, 512, 0x888888FF);
  const testBuffer = await testImg.getBufferAsync(Jimp.MIME_PNG);
  
  const maskResult = await maskSegmentationServiceInstance.generateInpaintMask(testBuffer, 'unit-test-mask');
  assert(maskResult.success, 'Mask segmentation must succeed');
  assert(Buffer.isBuffer(maskResult.maskBuffer), 'Mask buffer must be returned');
  assert(maskResult.maskBuffer.length > 100, 'Mask buffer must contain valid PNG data');
  console.log(`  ${G('✓')} MaskSegmentationService successfully generated inpaint mask (${maskResult.maskBuffer.length} bytes)`);

  console.log(B('\n═══════════════════════════════════════════════════════════════════'));
  console.log(G(' ALL 4 INPAINTING & CONTRAST VERIFICATIONS PASSED (4/4)'));
  console.log(B('═══════════════════════════════════════════════════════════════════\n'));
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
