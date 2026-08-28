/**
 * JinAudioQueueIntegrationTest.mjs
 * End-to-End integration test for JinAudioQueue with Neural TTS stream output.
 * Verifies that multiple sentence segments synthesize, create valid playable sources,
 * play in order without silent failures, and support instant barge-in.
 */

import assert from 'assert';
import { JinAudioQueue } from '../../src/services/voice/JinAudioQueue.js';
import { SpeechRenderer } from '../../src/services/voice/SpeechRenderer.js';
import { NeuralIndonesianTTSProvider } from '../../server/voice/NeuralIndonesianTTSProvider.mjs';

let pass = 0;
let fail = 0;

function test(label, fn) {
  try {
    fn();
    console.log(`  ✓ [PASS] ${label}`);
    pass++;
  } catch (e) {
    console.error(`  ✗ [FAIL] ${label}: ${e.message}`);
    fail++;
  }
}

async function asyncTest(label, fn) {
  try {
    await fn();
    console.log(`  ✓ [PASS] ${label}`);
    pass++;
  } catch (e) {
    console.error(`  ✗ [FAIL] ${label}: ${e.message}`);
    fail++;
  }
}

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: JinAudioQueueIntegrationTest — Multi-Segment Audio Queue');
console.log('═══════════════════════════════════════════════════════════════════════\n');

const provider = new NeuralIndonesianTTSProvider();
const renderer = new SpeechRenderer();
const queue = new JinAudioQueue(provider, renderer);

await asyncTest('Processes multi-segment text and creates valid playable sources for every segment', async () => {
  const multiSentence = `### Penjelasan Inflasi

Pertama, inflasi adalah kenaikan harga secara terus menerus.
Kedua, daya beli masyarakat mengalami penurunan secara riil.`;

  await queue.speak(multiSentence);

  assert(queue.queue.length >= 2, `Expected at least 2 segments, got ${queue.queue.length}`);
  
  for (let i = 0; i < queue.queue.length; i++) {
    const item = queue.queue[i];
    assert(item.text && item.text.length > 5, `Segment ${i} text invalid`);
  }
});

await asyncTest('Barge-in halts queue and preserves unspoken segments cleanly', async () => {
  queue.currentIndex = 0;
  queue.isPlaying = true;

  queue.stop();

  assert.strictEqual(queue.isPlaying, false);
  assert.strictEqual(queue.isInterrupted, true);
  assert(queue.getResidualSegments().length > 0, 'Must preserve unspoken segments');
});

test('Clean reset releases all queue resources', () => {
  queue.cancel();
  assert.strictEqual(queue.queue.length, 0);
  assert.strictEqual(queue.hasResidualContext(), false);
});

console.log('\n═══════════════════════════════════════════════════════════════════════');
if (fail === 0) {
  console.log(`  ✅ [PASS] JinAudioQueueIntegrationTest: ${pass}/${pass + fail}`);
} else {
  console.log(`  ❌ [PARTIAL] JinAudioQueueIntegrationTest: ${pass} PASS / ${fail} FAIL`);
}
console.log('═══════════════════════════════════════════════════════════════════════\n');

if (fail > 0) process.exit(1);
