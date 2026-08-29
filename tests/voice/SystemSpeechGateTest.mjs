/**
 * SystemSpeechGateTest.mjs
 * Validates default silence across all system, tool, and internal events.
 */

import { strict as assert } from 'node:assert';
import { SpeechDecisionGate, SPEECH_DECISIONS, FORBIDDEN_EVENT_TYPES, CRITICAL_EXCEPTIONS } from '../../src/services/voice/SpeechDecisionGate.js';

console.log('=== TEST: SystemSpeechGateTest ===');

const gate = new SpeechDecisionGate();

// 1. All forbidden internal events MUST result in NO_SPEECH
for (const eventType of FORBIDDEN_EVENT_TYPES) {
  const result = gate.shouldSpeak({ type: eventType, text: 'Saya siap membantu.' });
  assert.equal(result.decision, SPEECH_DECISIONS.NO_SPEECH, `Forbidden event ${eventType} must return NO_SPEECH`);
}
console.log('✔ All forbidden internal events return NO_SPEECH by default');

// 2. Unauthenticated event without interactionId MUST result in NO_SPEECH
const unauthResult = gate.shouldSpeak({ type: 'UNKNOWN', text: 'Halo selamat pagi.' });
assert.equal(unauthResult.decision, SPEECH_DECISIONS.NO_SPEECH, 'Unauthenticated event must be silent');
console.log('✔ Unauthenticated events are strictly silent');

// 3. Critical exceptions (Safety, Security, Approval) MUST be allowed
for (const critType of CRITICAL_EXCEPTIONS) {
  const critResult = gate.shouldSpeak({
    type: 'ALERT',
    isCritical: true,
    criticalType: critType,
    text: 'Peringatan keamanan kritis terdeteksi.'
  });
  assert.equal(critResult.decision, SPEECH_DECISIONS.SPEAK, `Critical exception ${critType} must return SPEAK`);
}
console.log('✔ Critical safety exceptions successfully authorized');

console.log('=== SystemSpeechGateTest PASSED ===\n');
