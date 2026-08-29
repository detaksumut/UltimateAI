/**
 * InterruptSilenceTest.mjs
 * Validates that user interruption immediately silences TTS and does NOT generate verbal fillers.
 */

import { strict as assert } from 'node:assert';
import { SpeechDecisionGate, SPEECH_DECISIONS } from '../../src/services/voice/SpeechDecisionGate.js';

console.log('=== TEST: InterruptSilenceTest ===');

const gate = new SpeechDecisionGate();

// 1. Interruption / Barge-In event MUST be completely silent (no verbal fillers like "Ya" or "Baik")
const bargeInEvent = gate.shouldSpeak({
  type: 'USER_BARGE_IN',
  text: 'Baik, saya dengarkan.'
});
assert.equal(bargeInEvent.decision, SPEECH_DECISIONS.NO_SPEECH, 'Barge-in event must be completely silent');
console.log('✔ User barge-in generates zero automatic speech fillers');

// 2. Control words (e.g. "Tunggu", "Berhenti") must not generate speech
const controlInteraction = gate.beginUserInteraction('INT-STOP-1');
const controlResult = gate.shouldSpeak({
  type: 'USER_RESPONSE',
  interactionId: controlInteraction,
  userPrompt: 'Berhenti',
  text: 'Baik, eksekusi dihentikan.'
});
assert.equal(controlResult.decision, SPEECH_DECISIONS.NO_SPEECH, 'Control stop command must execute silently');
gate.endUserInteraction(controlInteraction);
console.log('✔ Stop/pause commands execute silently without automatic verbal noise');

console.log('=== InterruptSilenceTest PASSED ===\n');
