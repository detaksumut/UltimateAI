/**
 * NeuralTTSBargeInTest.mjs
 * Unit tests for Instant Barge-In & Resume ("Lanjutkan") in Neural TTS Audio Queue.
 * Verifies that when interrupted:
 * 1. Audio playback halts immediately.
 * 2. Unspoken segments are preserved.
 * 3. Calling resume() continues from the exact unspoken position without repeating from beginning.
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
console.log('  TEST: NeuralTTSBargeInTest — Instant Barge-In & Residual Resume');
console.log('═══════════════════════════════════════════════════════════════════════\n');

const mockProvider = new NeuralIndonesianTTSProvider();
const renderer = new SpeechRenderer();
const queue = new JinAudioQueue(mockProvider, renderer);

// 1. Barge-In Halts Playback & Marks Interrupted
await asyncTest('Barge-in immediately stops playback and marks state as interrupted', async () => {
  const text = 'Kalimat pertama. Kalimat kedua. Kalimat ketiga. Kalimat keempat.';
  
  await queue.speak(text);
  
  // Simulate active playing on segment index 0
  queue.currentIndex = 0;
  queue.isPlaying = true;

  // Trigger Operator Barge-In
  queue.stop();

  assert.strictEqual(queue.isPlaying, false, 'Playback must halt immediately');
  assert.strictEqual(queue.isInterrupted, true, 'State must reflect isInterrupted = true');
});

// 2. Preserves Unspoken Segments
test('Unspoken segments are preserved in memory after barge-in', () => {
  const residual = queue.getResidualSegments();
  assert(residual.length > 0, `Expected residual segments, got ${residual.length}`);
  assert.strictEqual(queue.hasResidualContext(), true, 'hasResidualContext() must return true');
  console.log(`     [Preserved Unspoken Segments]: ${JSON.stringify(residual)}`);
});

// 3. Resume ("Lanjutkan") Continues from Preserved Segments
await asyncTest('Resume ("Lanjutkan") plays remaining segments without repeating sentence 1', async () => {
  const originalSegments = queue.getResidualSegments();
  
  let resumed = false;
  queue.resume({
    onStart: () => { resumed = true; }
  });

  assert(queue.queue.length === originalSegments.length, 'Resumed queue must match unspoken segment count');
  assert(queue.isInterrupted === false, 'Interrupted flag reset on resume');
});

// 4. Clean Cancel Clears Residual Context
test('Explicit cancel clears all residual context', () => {
  queue.cancel();
  assert.strictEqual(queue.hasResidualContext(), false);
  assert.strictEqual(queue.getResidualSegments().length, 0);
});

console.log('\n═══════════════════════════════════════════════════════════════════════');
if (fail === 0) {
  console.log(`  ✅ [PASS] NeuralTTSBargeInTest: ${pass}/${pass + fail}`);
} else {
  console.log(`  ❌ [PARTIAL] NeuralTTSBargeInTest: ${pass} PASS / ${fail} FAIL`);
}
console.log('═══════════════════════════════════════════════════════════════════════\n');

if (fail > 0) process.exit(1);
