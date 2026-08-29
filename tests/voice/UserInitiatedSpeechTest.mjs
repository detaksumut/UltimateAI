/**
 * UserInitiatedSpeechTest.mjs
 * Validates that speech is allowed ONLY when authorized by a user-initiated interaction.
 */

import { strict as assert } from 'node:assert';
import { SpeechDecisionGate, SPEECH_DECISIONS, RESPONSE_MODALITIES } from '../../src/services/voice/SpeechDecisionGate.js';

console.log('=== TEST: UserInitiatedSpeechTest ===');

const gate = new SpeechDecisionGate();

// 1. Before user interaction: speech blocked
const preInteraction = gate.shouldSpeak({
  type: 'USER_RESPONSE',
  interactionId: 'INT-999',
  text: 'Halo ada yang bisa dibantu?'
});
assert.equal(preInteraction.decision, SPEECH_DECISIONS.NO_SPEECH, 'Speech without active interaction window must be blocked');
console.log('✔ Speech without active interaction window is blocked');

// 2. User starts interaction INT-001
const interactionId = gate.beginUserInteraction('INT-001');
assert.equal(interactionId, 'INT-001');

// 3. Valid response inside active interaction window: speech allowed
const userResponse = gate.shouldSpeak({
  type: 'USER_RESPONSE',
  interactionId: 'INT-001',
  userPrompt: 'JIN, jelaskan konsep ini.',
  text: 'Konsep ini merupakan arsitektur terdistribusi yang memisahkan komputasi dari penyimpanan data.'
});
assert.equal(userResponse.decision, SPEECH_DECISIONS.SPEAK, 'Authorized user interaction response must return SPEAK');
assert.equal(userResponse.modality, RESPONSE_MODALITIES.TEXT_AND_SPEECH);
assert.ok(userResponse.speechText.includes('arsitektur terdistribusi'));
console.log('✔ User interaction response is authorized with sanitized text');

// 4. End user interaction
gate.endUserInteraction('INT-001');

// 5. Subsequent speech after interaction ended: blocked
const postInteraction = gate.shouldSpeak({
  type: 'USER_RESPONSE',
  interactionId: 'INT-001',
  text: 'Apakah ada hal lain?'
});
assert.equal(postInteraction.decision, SPEECH_DECISIONS.NO_SPEECH, 'Speech after interaction closed must be blocked');
console.log('✔ Post-interaction speech is strictly blocked');

console.log('=== UserInitiatedSpeechTest PASSED ===\n');
