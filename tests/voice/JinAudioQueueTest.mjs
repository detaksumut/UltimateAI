/**
 * JinAudioQueueTest.mjs
 * Unit tests for JinAudioQueue.
 * Verifies segment queuing, sentence-based synthesis dispatch, queue state management,
 * observable state streaming, and queue clearing.
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
console.log('  TEST: JinAudioQueueTest — Sentence-Based Neural Audio Queue');
console.log('═══════════════════════════════════════════════════════════════════════\n');

const mockProvider = new NeuralIndonesianTTSProvider();
const renderer = new SpeechRenderer();
const queue = new JinAudioQueue(mockProvider, renderer);

// 1. Initial State
test('Initial queue state is clean and IDLE', () => {
  assert.strictEqual(queue.isPlaying, false);
  assert.strictEqual(queue.isInterrupted, false);
  assert.strictEqual(queue.queue.length, 0);
});

// 2. Subscription to State Updates
test('Listeners receive state updates', () => {
  let emittedState = null;
  const unsub = queue.subscribe((state) => {
    emittedState = state;
  });

  queue._emitState({ isPlaying: true, queueLength: 3 });
  assert.strictEqual(emittedState.isPlaying, true);
  assert.strictEqual(emittedState.queueLength, 3);
  unsub();
});

// 3. Queue Population and Segment Preparation
await asyncTest('Enqueues multiple speech segments from multi-sentence input', async () => {
  const input = 'Pertama, inflasi menyebabkan kenaikan harga. Kedua, daya beli masyarakat menurun secara riil. Ketiga, perlu adanya langkah mitigasi.';
  
  await queue.speak(input, {
    onStart: () => {},
    onEnd: () => {}
  });

  assert(queue.queue.length >= 2, `Expected at least 2 segments in queue, got ${queue.queue.length}`);
  assert(['PENDING', 'READY'].includes(queue.queue[0].status), `Expected PENDING or READY, got ${queue.queue[0].status}`);
});

// 4. Cancel and Reset
test('Cancel clears queue and resets state', () => {
  queue.cancel();
  assert.strictEqual(queue.queue.length, 0);
  assert.strictEqual(queue.isPlaying, false);
  assert.strictEqual(queue.currentIndex, -1);
});

console.log('\n═══════════════════════════════════════════════════════════════════════');
if (fail === 0) {
  console.log(`  ✅ [PASS] JinAudioQueueTest: ${pass}/${pass + fail}`);
} else {
  console.log(`  ❌ [PARTIAL] JinAudioQueueTest: ${pass} PASS / ${fail} FAIL`);
}
console.log('═══════════════════════════════════════════════════════════════════════\n');

if (fail > 0) process.exit(1);
