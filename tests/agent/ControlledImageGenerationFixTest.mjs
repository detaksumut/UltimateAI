import assert from 'node:assert/strict';
import { ImageGeneration } from '../../server/agent/ImageGeneration.mjs';

const service = new ImageGeneration();

const cases = [
  ['jin apakah kamu bisa buat image pesawat terbang', ['pesawat', 'terbang']],
  ['buat gambar rumah modern 2 lantai', ['rumah', 'modern', '2 lantai']],
  ['tolong buatkan gambar pesawat tempur di langit', ['pesawat tempur', 'langit']]
];

for (const [prompt, expectedTerms] of cases) {
  const normalized = service.normalizeImagePrompt(prompt).toLowerCase();
  for (const term of expectedTerms) {
    assert.match(normalized, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(normalized, /apakah kamu bisa|tolong buatkan|buat image|buat gambar/);
}

const result = await service.generateImage({
  prompt: cases[0][0],
  providerOverride: 'MOCK',
  generationId: 'generation-test-1',
  messageId: 'message-test-1'
});

assert.equal(result.success, true);
assert.equal(result.artifact.generationId, 'generation-test-1');
assert.equal(result.artifact.messageId, 'message-test-1');
assert.equal(result.artifact.originalPrompt, cases[0][0]);
assert.match(result.artifact.normalizedPrompt, /pesawat terbang/i);

const semantic = service.verifyImageSemantic({
  prompt: cases[0][0],
  normalizedPrompt: result.artifact.normalizedPrompt,
  image: result.artifact
});
assert.equal(semantic.available, false);
assert.equal(semantic.verified, false);

console.log('ControlledImageGenerationFixTest: PASS');
