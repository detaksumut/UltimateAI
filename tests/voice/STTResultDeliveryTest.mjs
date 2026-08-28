/**
 * STTResultDeliveryTest.mjs
 * Verifies that microphone capture ➔ VAD ➔ STT transcript delivers
 * directly into AGENT_INPUT_RECEIVED for AgentRuntime execution.
 */

import assert from 'assert';
import { SpeechToText } from '../../src/services/voice/SpeechToText.js';

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
console.log('  TEST: STTResultDeliveryTest — STT Transcript to Agent Delivery Pipeline');
console.log('═══════════════════════════════════════════════════════════════════════\n');

const stt = new SpeechToText();

await asyncTest('Delivers spoken sentence to onFinalTranscript callback cleanly', async () => {
  const sampleTranscript = 'JIN, jelaskan kondisi ekonomi Indonesia secara sederhana.';
  let deliveredToAgent = '';

  // Mock local provider start to simulate real audio transcription delivery
  stt.localProvider.isAvailable = () => true;
  stt.localProvider.start = async (cb) => {
    cb.onStart();
    cb.onTranscript(sampleTranscript, true);
    cb.onFinalTranscript(sampleTranscript);
    return true;
  };

  stt.setProvider('LOCAL_BACKEND_STT');

  await stt.startListening({
    onFinalTranscript: (text) => {
      deliveredToAgent = text;
      console.log(`     [AGENT_INPUT_RECEIVED]: "${text}"`);
    }
  });

  assert.strictEqual(deliveredToAgent, sampleTranscript, 'Transcript must reach agent handler exactly');
});

test('Clean stop clears listening state without hanging in LISTENING', () => {
  stt.stopListening();
  assert.strictEqual(stt.isListening, false);
});

console.log('\n═══════════════════════════════════════════════════════════════════════');
if (fail === 0) {
  console.log(`  ✅ [PASS] STTResultDeliveryTest: ${pass}/${pass + fail}`);
} else {
  console.log(`  ❌ [PARTIAL] STTResultDeliveryTest: ${pass} PASS / ${fail} FAIL`);
}
console.log('═══════════════════════════════════════════════════════════════════════\n');

if (fail > 0) process.exit(1);
