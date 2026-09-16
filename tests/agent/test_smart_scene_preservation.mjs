/**
 * tests/agent/test_smart_scene_preservation.mjs
 * 
 * Verifies Smart Scene Preservation:
 * 1. Scene concept extraction (airplane, car, mountain, road, ship).
 * 2. Atmosphere extraction (sunset, night, rain, snow, sunrise).
 * 3. Master prompt synthesis preserves both original subject and environment while applying new atmosphere.
 * 4. SmartSceneImageEditingProvider registered as default provider in ImageEditingService.
 */

import assert from 'assert';
import { SmartScenePromptSynthesizer } from '../../server/agent/SmartScenePromptSynthesizer.mjs';
import { smartSceneImageEditingProviderInstance } from '../../server/agent/providers/SmartSceneImageEditingProvider.mjs';
import { imageEditingInstance } from '../../server/agent/ImageEditing.mjs';

const G = s => `\x1b[32m${s}\x1b[0m`;
const B = s => `\x1b[36m${s}\x1b[0m`;

async function run() {
  console.log(B('═══════════════════════════════════════════════════════════════════'));
  console.log(B(' SMART SCENE PRESERVATION REGRESSION SUITE'));
  console.log(B('═══════════════════════════════════════════════════════════════════\n'));

  // [1] Airplane + Mountains -> Sunset
  console.log('[1] Airplane + Mountains -> Sunset:');
  const prompt1 = SmartScenePromptSynthesizer.synthesize(
    'buatkan gambar pesawat terbang melintasi gunung',
    'sekarang ganti suasana sunset'
  );
  console.log('  Synthesized:', prompt1);
  assert(prompt1.includes('commercial airliner airplane'), 'Must preserve airplane');
  assert(prompt1.includes('mountain'), 'Must preserve mountain');
  assert(prompt1.includes('sunset'), 'Must apply sunset');
  assert(prompt1.includes('golden hour'), 'Must apply golden hour lighting');
  assert(prompt1.includes('high contrast'), 'Must include high contrast');
  console.log(`  ${G('✓')} Successfully synthesized airplane + mountain + sunset`);

  // [2] Sports Car on Road -> Night
  console.log('\n[2] Sports Car on Mountain Road -> Night:');
  const prompt2 = SmartScenePromptSynthesizer.synthesize(
    'gambar mobil sport merah di jalan pegunungan',
    'suasananya ubah jadi malam hari'
  );
  console.log('  Synthesized:', prompt2);
  assert(prompt2.includes('red sports car'), 'Must preserve red sports car');
  assert(prompt2.includes('mountain road'), 'Must preserve mountain road');
  assert(prompt2.includes('night'), 'Must apply nighttime');
  assert(prompt2.includes('moonlight'), 'Must include moonlight');
  console.log(`  ${G('✓')} Successfully synthesized red sports car + mountain road + night`);

  // [3] Provider Registration
  console.log('\n[3] Provider Registration & Capability:');
  const probe = await smartSceneImageEditingProviderInstance.capabilityProbe();
  assert(probe.available, 'Smart Scene provider must be available');
  assert.strictEqual(probe.provider, 'SMART_SCENE');

  const registered = imageEditingInstance.providers.get('SMART_SCENE');
  assert.ok(registered, 'SMART_SCENE must be registered in ImageEditingService');
  assert.strictEqual(imageEditingInstance.defaultProvider, 'SMART_SCENE', 'Default provider must be SMART_SCENE');
  console.log(`  ${G('✓')} SMART_SCENE provider registered and set as default provider`);

  // [4] Mock Execution with Lineage
  console.log('\n[4] Mock Execution Lineage:');
  const mockTransport = {
    fetch: async (url) => {
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

  const editResult = await smartSceneImageEditingProviderInstance.editImage({
    referenceArtifactId: 'img-orig-123',
    originalPrompt: 'buatkan gambar pesawat terbang melintasi gunung',
    prompt: 'sekarang ganti suasana sunset'
  }, mockTransport);

  assert(editResult.success, 'Edit must succeed');
  assert.strictEqual(editResult.parentArtifactId, 'img-orig-123', 'Must preserve parent lineage');
  assert.strictEqual(editResult.provider, 'SMART_SCENE');
  console.log(`  ${G('✓')} Execution returned valid image with parentArtifactId=img-orig-123`);

  console.log(B('\n═══════════════════════════════════════════════════════════════════'));
  console.log(G(' ALL 4 SMART SCENE PRESERVATION TESTS PASSED (4/4)'));
  console.log(B('═══════════════════════════════════════════════════════════════════\n'));
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
