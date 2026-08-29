/**
 * SingleResponseWindowTest.mjs
 * Validates that ONE user interaction permits at most ONE logical response speech window.
 */

import { strict as assert } from 'node:assert';
import { SpeechDecisionGate, SPEECH_DECISIONS } from '../../src/services/voice/SpeechDecisionGate.js';

console.log('=== TEST: SingleResponseWindowTest ===');

const gate = new SpeechDecisionGate();
const interactionId = gate.beginUserInteraction('INT-SINGLE-1');

// 1. First response in window: ALLOWED
const firstResponse = gate.shouldSpeak({
  type: 'USER_RESPONSE',
  interactionId,
  userPrompt: 'Berapa total pendapatan tahun 2025?',
  text: 'Total pendapatan pada tahun 2025 tercatat sebesar 1,2 triliun rupiah.'
});
assert.equal(firstResponse.decision, SPEECH_DECISIONS.SPEAK, 'First response in window must be allowed');
console.log('✔ First logical response permitted');

// 2. Second unsolicited speech in the SAME interaction window: BLOCKED
const secondResponse = gate.shouldSpeak({
  type: 'USER_RESPONSE',
  interactionId,
  userPrompt: 'Berapa total pendapatan tahun 2025?',
  text: 'Apakah Anda ingin saya membuatkan visualisasi grafiknya?'
});
assert.equal(secondResponse.decision, SPEECH_DECISIONS.NO_SPEECH, 'Second response in single window must be blocked');
assert.ok(secondResponse.reason.includes('Single response speech quota reached'));
console.log('✔ Second response in same window blocked by quota');

gate.endUserInteraction(interactionId);
console.log('=== SingleResponseWindowTest PASSED ===\n');
