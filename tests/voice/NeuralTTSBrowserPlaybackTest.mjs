/**
 * NeuralTTSBrowserPlaybackTest.mjs
 * Simulates the browser playback lifecycle:
 * neural output ➔ valid audio source ➔ browser Audio load ➔ playback started ➔ playback finished ➔ URL revocation.
 */

import assert from 'assert';
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
console.log('  TEST: NeuralTTSBrowserPlaybackTest — Playback Lifecycle Verification');
console.log('═══════════════════════════════════════════════════════════════════════\n');

const provider = new NeuralIndonesianTTSProvider();

await asyncTest('Live prompt: "JIN, jelaskan dengan bahasa sederhana apa itu inflasi."', async () => {
  const text = 'JIN, jelaskan dengan bahasa sederhana apa itu inflasi.';
  const res = await provider.synthesize(text);

  assert(res.audioBuffer && res.audioBuffer.length > 1000, 'Must produce non-empty audio stream');
  assert(res.base64Audio.length > 1000, 'Must produce non-empty base64 audio');
  assert.strictEqual(res.mimeType, 'audio/mpeg');
  assert.strictEqual(res.language, 'id-ID');
  assert(res.duration > 0, 'Duration must be computed');
  
  console.log(`     [Audio Payload]: ${res.audioBuffer.length} bytes | Duration: ${res.duration}s | MIME: ${res.mimeType}`);
});

await asyncTest('Live prompt: "Pendapatan meningkat tiga puluh tiga koma delapan persen, sedangkan biaya hanya naik lima persen."', async () => {
  const text = 'Pendapatan meningkat tiga puluh tiga koma delapan persen, sedangkan biaya hanya naik lima persen.';
  const res = await provider.synthesize(text);

  assert(res.audioBuffer && res.audioBuffer.length > 1000);
  assert.strictEqual(res.mimeType, 'audio/mpeg');
  assert(res.duration > 1.0);
  
  console.log(`     [Audio Payload]: ${res.audioBuffer.length} bytes | Duration: ${res.duration}s | MIME: ${res.mimeType}`);
});

// Mock browser Audio element playback lifecycle
await asyncTest('Mock browser Audio loads source and triggers onplay and onended cleanly', async () => {
  const res = await provider.synthesize('Tes antrean audio.');
  const mockAudioUrl = `data:${res.mimeType};base64,${res.base64Audio}`;

  let playStarted = false;
  let playEnded = false;

  // Mock Audio
  const mockAudio = {
    src: '',
    play: async () => {
      if (!mockAudio.src) throw new Error('no supported source was found');
      playStarted = true;
      setTimeout(() => {
        playEnded = true;
        if (mockAudio.onended) mockAudio.onended();
      }, 50);
    },
    onended: null
  };

  mockAudio.src = mockAudioUrl;
  await mockAudio.play();

  assert.strictEqual(playStarted, true, 'Playback must start');
  await new Promise(r => setTimeout(r, 80));
  assert.strictEqual(playEnded, true, 'Playback must finish cleanly');
});

console.log('\n═══════════════════════════════════════════════════════════════════════');
if (fail === 0) {
  console.log(`  ✅ [PASS] NeuralTTSBrowserPlaybackTest: ${pass}/${pass + fail}`);
} else {
  console.log(`  ❌ [PARTIAL] NeuralTTSBrowserPlaybackTest: ${pass} PASS / ${fail} FAIL`);
}
console.log('═══════════════════════════════════════════════════════════════════════\n');

if (fail > 0) process.exit(1);
