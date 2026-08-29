/**
 * NoSpontaneousSpeechTest.mjs
 * Validates that spontaneous greetings, idle timers, and unsolicited acknowledgements are blocked.
 */

import { strict as assert } from 'node:assert';
import { SpeechDecisionGate, SPEECH_DECISIONS } from '../../src/services/voice/SpeechDecisionGate.js';

console.log('=== TEST: NoSpontaneousSpeechTest ===');

const gate = new SpeechDecisionGate();

const spontaneousPhrases = [
  'Halo Rahman.',
  'Selamat pagi.',
  'Ada yang bisa saya bantu?',
  'Saya siap membantu.',
  'Baik, saya mulai.',
  'Sebentar ya.'
];

// Test 60-second idle / startup simulation: No active user interaction
for (const phrase of spontaneousPhrases) {
  const result = gate.shouldSpeak({
    type: 'STARTUP',
    text: phrase
  });
  assert.equal(result.decision, SPEECH_DECISIONS.NO_SPEECH, `Spontaneous greeting "${phrase}" must be blocked`);

  const idleResult = gate.shouldSpeak({
    type: 'IDLE_PROMPT',
    text: phrase
  });
  assert.equal(idleResult.decision, SPEECH_DECISIONS.NO_SPEECH, `Idle spontaneous prompt "${phrase}" must be blocked`);
}

console.log('✔ All spontaneous greetings and unsolicited phrases are strictly blocked');
console.log('=== NoSpontaneousSpeechTest PASSED ===\n');
