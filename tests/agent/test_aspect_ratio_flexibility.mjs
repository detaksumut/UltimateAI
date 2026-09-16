/**
 * tests/agent/test_aspect_ratio_flexibility.mjs
 * 
 * Verifies flexible aspect ratio support (16:9, 9:16, 1:1):
 * 1. Aspect ratio detection from prompt keywords.
 * 2. Dimension calculation for 16:9 (912x512) and 9:16 (512x912).
 * 3. SmartSceneImageEditingProvider dimension resolution for 16:9 and 9:16.
 */

import assert from 'assert';
import { ImageGenerationService } from '../../server/agent/ImageGeneration.mjs';
import { smartSceneImageEditingProviderInstance } from '../../server/agent/providers/SmartSceneImageEditingProvider.mjs';

console.log('=== VERIFICATION SUITE: Flexible Aspect Ratio (16:9 and 9:16) ===\n');

// 1. Keyword detection
console.log('[1] Aspect ratio keyword auto-detection:');
assert.strictEqual(ImageGenerationService.detectAspectRatio('gambar pemandangan 16:9 gunung'), '16:9');
assert.strictEqual(ImageGenerationService.detectAspectRatio('foto mobil sport landscape di tol'), '16:9');
assert.strictEqual(ImageGenerationService.detectAspectRatio('gambar horizontal pemandangan kota'), '16:9');

assert.strictEqual(ImageGenerationService.detectAspectRatio('visual vertikal untuk story instagram 9:16'), '9:16');
assert.strictEqual(ImageGenerationService.detectAspectRatio('wallpaper hp pemandangan senja'), '9:16');
assert.strictEqual(ImageGenerationService.detectAspectRatio('foto potret portrait wanita anggun'), '9:16');

assert.strictEqual(ImageGenerationService.detectAspectRatio('kucing lucu biasa'), '16:9');
console.log('  ✓ Keywords correctly resolve 16:9 and 9:16 (Zero 768x768 square)');

// 2. Mock execution with 16:9 and 9:16 in SmartSceneImageEditingProvider
console.log('\n[2] SmartSceneImageEditingProvider dimensions:');

let capturedUrls = [];
const mockTransport = {
  fetch: async (url) => {
    capturedUrls.push(url);
    const jpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
    const padded = Buffer.concat([jpeg, Buffer.alloc(4096)]);
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      arrayBuffer: async () => new Uint8Array(padded).buffer
    };
  }
};

// Test 16:9 revision
await smartSceneImageEditingProviderInstance.editImage({
  referenceArtifactId: 'ref-1',
  prompt: 'ubah pemandangan 16:9 senja',
  originalPrompt: 'pesawat terbang di gunung',
  aspectRatio: '16:9'
}, mockTransport);

const lastUrl16_9 = capturedUrls[0];
console.log('  16:9 URL:', lastUrl16_9);
assert.ok(lastUrl16_9.includes('width=912'), '16:9 must set width=912');
assert.ok(lastUrl16_9.includes('height=512'), '16:9 must set height=512');
console.log('  ✓ 16:9 correctly dispatched with 912x512');

// Test 9:16 revision (auto-detected from prompt)
await smartSceneImageEditingProviderInstance.editImage({
  referenceArtifactId: 'ref-2',
  prompt: 'ubah jadi wallpaper hp vertikal malam hari',
  originalPrompt: 'mobil sport di jalan raya'
}, mockTransport);

const lastUrl9_16 = capturedUrls[capturedUrls.length - 1];
console.log('  9:16 URL:', lastUrl9_16);
assert.ok(lastUrl9_16.includes('width=512'), '9:16 must set width=512');
assert.ok(lastUrl9_16.includes('height=912'), '9:16 must set height=912');
console.log('  ✓ 9:16 correctly dispatched with 512x912');

console.log('\n✅ ALL ASPECT RATIO FLEXIBILITY TESTS PASSED (16:9 and 9:16)!');
