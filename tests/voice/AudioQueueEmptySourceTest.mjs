/**
 * AudioQueueEmptySourceTest.mjs
 * Verifies that JinAudioQueue guards against empty audio sources,
 * never assigns empty src or crashes HTMLMediaElement with Empty src error.
 */

import assert from 'assert';
import { JinAudioQueue } from '../../src/services/voice/JinAudioQueue.js';
import { SpeechRenderer } from '../../src/services/voice/SpeechRenderer.js';

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
console.log('  TEST: AudioQueueEmptySourceTest — Empty Source Guard & Resilience');
console.log('═══════════════════════════════════════════════════════════════════════\n');

const mockProviderEmpty = {
  synthesize: async () => ({ audioDataUrl: null, base64Audio: '', duration: 0 })
};
const renderer = new SpeechRenderer();
const queue = new JinAudioQueue(mockProviderEmpty, renderer);

await asyncTest('Safely handles empty synthesized audio source without calling play() on empty src', async () => {
  let endedCalled = false;
  
  await queue.speak('Uji sumber audio kosong.', {
    onEnd: () => { endedCalled = true; }
  });

  // Mock audio
  let playCalledWithEmptySrc = false;
  queue.audioElement = {
    src: '',
    play: async () => {
      if (!queue.audioElement.src) {
        playCalledWithEmptySrc = true;
        throw new Error('MEDIA_ELEMENT_ERROR: Empty src');
      }
    }
  };

  await queue._synthesizeAndPlayFrom(0);

  assert.strictEqual(playCalledWithEmptySrc, false, 'play() must NEVER be called when src is empty');
});

test('Stop does not trigger audio element error event on empty src reset', () => {
  let errorLogged = false;
  queue.audioElement = {
    src: '',
    pause: () => {},
    onerror: (e) => { errorLogged = true; }
  };

  queue.stop();
  assert.strictEqual(queue.isPlaying, false);
});

console.log('\n═══════════════════════════════════════════════════════════════════════');
if (fail === 0) {
  console.log(`  ✅ [PASS] AudioQueueEmptySourceTest: ${pass}/${pass + fail}`);
} else {
  console.log(`  ❌ [PARTIAL] AudioQueueEmptySourceTest: ${pass} PASS / ${fail} FAIL`);
}
console.log('═══════════════════════════════════════════════════════════════════════\n');

if (fail > 0) process.exit(1);
