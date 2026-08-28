import assert from 'assert';
import { textToSpeechInstance } from '../../src/services/voice/TextToSpeech.js';

console.log('========================================================================');
console.log('  TEST: IndonesianTTSVoiceTest — Prioritize id-ID / Indonesian TTS Voices');
console.log('========================================================================\n');

async function testIndonesianTTSVoice() {
  const tts = textToSpeechInstance;

  // Mock voice list with Microsoft David and Google Bahasa Indonesia
  tts.voices = [
    { name: 'Microsoft David - English (United States)', lang: 'en-US', default: true },
    { name: 'Microsoft Zira - English (United States)', lang: 'en-US', default: false },
    { name: 'Google Bahasa Indonesia', lang: 'id-ID', default: false }
  ];

  const bestVoice = tts.getBestVoice('id-ID');
  console.log(`[TTS] TTS_SELECTED_VOICE: "${bestVoice?.name}" | TTS_LANG: id-ID`);
  
  assert(bestVoice, 'Must find Indonesian voice when available');
  assert.strictEqual(bestVoice.name, 'Google Bahasa Indonesia', 'Must pick Google Bahasa Indonesia, NOT Microsoft David');

  // Test when ONLY English voices exist (should return null so browser doesn't force English voice object)
  tts.voices = [
    { name: 'Microsoft David - English (United States)', lang: 'en-US', default: true }
  ];
  const fallback = tts.getBestVoice('id-ID');
  console.log(`[TTS] Fallback when only English installed: ${fallback ? fallback.name : 'null (Uses native browser id-ID synthesizer)'}`);
  assert.strictEqual(fallback, null, 'Must not force Microsoft David English on id-ID text');

  console.log('\n========================================================================');
  console.log('  ✅ [PASS] IndonesianTTSVoiceTest: 100% SUCCESS');
  console.log('========================================================================\n');
}

testIndonesianTTSVoice().catch(err => {
  console.error('❌ [FAIL] IndonesianTTSVoiceTest:', err);
  process.exit(1);
});
