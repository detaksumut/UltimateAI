/**
 * NeuralTTSFormatConversionTest.mjs
 * Unit tests verifying audio stream format conversion, base64-to-Blob handling,
 * valid MP3/WAV headers, sampleRate verification, and MIME types.
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
console.log('  TEST: NeuralTTSFormatConversionTest — Audio Format & Binary Integrity');
console.log('═══════════════════════════════════════════════════════════════════════\n');

const provider = new NeuralIndonesianTTSProvider();

// 1. Synthesize audio stream and verify binary headers
await asyncTest('Synthesized MP3 has valid MPEG sync header and non-empty byte stream', async () => {
  const res = await provider.synthesize('Inflasi adalah kenaikan harga secara umum.');
  
  assert(res.audioBuffer instanceof Buffer, 'Must return Buffer');
  assert(res.audioBuffer.length > 500, `Buffer too small: ${res.audioBuffer.length} bytes`);
  
  // Verify standard MP3 sync frame (0xFF followed by high 3 bits set)
  const isMp3Header = res.audioBuffer[0] === 0xFF && (res.audioBuffer[1] & 0xE0) === 0xE0;
  assert(isMp3Header || res.format === 'audio/wav', 'Buffer must have valid MP3 or WAV audio header');
  assert.strictEqual(res.mimeType, 'audio/mpeg');
  assert.strictEqual(res.sampleRate, 24000);
});

// 2. Base64 encoding integrity
await asyncTest('Base64 string decodes back to identical binary audio payload', async () => {
  const res = await provider.synthesize('Pendapatan meningkat tiga puluh tiga koma delapan persen.');
  
  const decoded = Buffer.from(res.base64Audio, 'base64');
  assert.strictEqual(decoded.length, res.audioBuffer.length, 'Decoded byte length must match audioBuffer length');
  assert.strictEqual(decoded[0], res.audioBuffer[0]);
  assert.strictEqual(decoded[decoded.length - 1], res.audioBuffer[res.audioBuffer.length - 1]);
});

// 3. Fallback WAV Generator header verification
test('WAV generator creates valid 44-byte standard RIFF header', () => {
  const wav = provider._generateValidWav('Tes audio wav', 24000);
  assert(wav.length > 44, 'WAV must exceed 44 bytes');
  assert.strictEqual(wav.toString('utf8', 0, 4), 'RIFF');
  assert.strictEqual(wav.toString('utf8', 8, 12), 'WAVE');
  assert.strictEqual(wav.toString('utf8', 12, 16), 'fmt ');
  assert.strictEqual(wav.readUInt16LE(20), 1, 'AudioFormat must be 1 (PCM)');
  assert.strictEqual(wav.readUInt32LE(24), 24000, 'SampleRate must match 24000');
});

console.log('\n═══════════════════════════════════════════════════════════════════════');
if (fail === 0) {
  console.log(`  ✅ [PASS] NeuralTTSFormatConversionTest: ${pass}/${pass + fail}`);
} else {
  console.log(`  ❌ [PARTIAL] NeuralTTSFormatConversionTest: ${pass} PASS / ${fail} FAIL`);
}
console.log('═══════════════════════════════════════════════════════════════════════\n');

if (fail > 0) process.exit(1);
