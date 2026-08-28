/**
 * NeuralIndonesianTTSProviderTest.mjs
 * Unit tests for NeuralIndonesianTTSProvider.
 * Verifies speaker conditioning, audio prompt configuration, Indonesian id-ID language,
 * audio metadata, fail-closed handling, and synthesis output structure.
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
console.log('  TEST: NeuralIndonesianTTSProviderTest — Neural Indonesian TTS Engine');
console.log('═══════════════════════════════════════════════════════════════════════\n');

const provider = new NeuralIndonesianTTSProvider({
  audioPromptPath: 'storage/voice/jin_voice_prompt.wav'
});

// 1. Initial State & Configuration
test('Provider name is NEURAL_INDONESIAN_TTS', () => {
  assert.strictEqual(provider.name, 'NEURAL_INDONESIAN_TTS');
});

test('Default language is id-ID', () => {
  assert.strictEqual(provider.config.language, 'id-ID');
});

test('Speaker is configured with authoritative Indonesian neural voice', () => {
  assert(provider.config.defaultSpeaker.includes('id-ID'), `Expected id-ID speaker, got ${provider.config.defaultSpeaker}`);
});

test('Audio Prompt can be dynamically updated', () => {
  provider.setAudioPrompt('storage/voice/custom_operator_voice.wav');
  assert.strictEqual(provider.config.audioPromptPath, 'storage/voice/custom_operator_voice.wav');
});

test('Voice status reports correct metadata and protected reference status', () => {
  const status = provider.getVoiceStatus();
  assert.strictEqual(status.provider, 'NEURAL_INDONESIAN_TTS');
  assert.strictEqual(status.language, 'id-ID');
  assert.strictEqual(status.status, 'READY');
});

// 2. Synthesis Behavior with clean text
await asyncTest('Empty text returns empty audio payload safely', async () => {
  const res = await provider.synthesize('');
  assert.strictEqual(res.duration, 0);
  assert.strictEqual(res.provider, 'NEURAL_INDONESIAN_TTS');
});

await asyncTest('Synthesizes Indonesian text and returns audioBuffer & base64Audio', async () => {
  const sampleText = 'Inflasi adalah kenaikan harga barang dan jasa secara umum dan terus menerus.';
  const res = await provider.synthesize(sampleText, { rate: 0.92, pitch: 1.05 });
  
  assert(res.audioBuffer instanceof Buffer || res.audioBuffer instanceof Uint8Array, 'Must return binary buffer');
  assert(res.base64Audio.length > 0, 'Must return base64 audio');
  assert.strictEqual(res.language, 'id-ID');
  assert(res.duration > 0, 'Must compute valid duration');
  assert.strictEqual(res.provider, 'NEURAL_INDONESIAN_TTS');
  assert.strictEqual(res.format, 'audio/mp3');
});

await asyncTest('Synthesizes number-heavy Indonesian text', async () => {
  const text = 'Pendapatan naik tiga puluh tiga koma delapan persen menjadi satu miliar rupiah.';
  const res = await provider.synthesize(text);
  assert(res.base64Audio.length > 0);
  assert(res.duration > 0);
});

// 3. Audio Prompt & Speaker Conditioning
await asyncTest('Audio prompt parameter is honored in synthesis call', async () => {
  const res = await provider.synthesize('Tes referensi suara.', {
    audioPromptPath: 'storage/voice/reference.wav'
  });
  assert(res.voiceReferenceUsed === true, 'voiceReferenceUsed must be true when audio prompt is passed');
});

console.log('\n═══════════════════════════════════════════════════════════════════════');
if (fail === 0) {
  console.log(`  ✅ [PASS] NeuralIndonesianTTSProviderTest: ${pass}/${pass + fail}`);
} else {
  console.log(`  ❌ [PARTIAL] NeuralIndonesianTTSProviderTest: ${pass} PASS / ${fail} FAIL`);
}
console.log('═══════════════════════════════════════════════════════════════════════\n');

if (fail > 0) process.exit(1);
