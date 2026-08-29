/**
 * ArtifactSilenceTest.mjs
 * Validates that code artifacts, HTML, charts, tables, and SVGs are never read aloud.
 */

import { strict as assert } from 'node:assert';
import { SpeechDecisionGate, SPEECH_DECISIONS, RESPONSE_MODALITIES, UserResponsePolicy } from '../../src/services/voice/SpeechDecisionGate.js';

console.log('=== TEST: ArtifactSilenceTest ===');

const gate = new SpeechDecisionGate();
const interactionId = gate.beginUserInteraction('INT-ARTIFACT-1');

// 1. Raw code block generation response
const rawCodeResponse = 'Berikut aplikasinya:\n```html\n<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello World</h1></body></html>\n```';
const artifactResult = gate.shouldSpeak({
  type: 'USER_RESPONSE',
  interactionId,
  userPrompt: 'Buatkan aplikasi kalkulator.',
  text: rawCodeResponse
});

// Artifacts default to ARTIFACT_ONLY -> NO_SPEECH
assert.equal(artifactResult.decision, SPEECH_DECISIONS.NO_SPEECH, 'Code artifact response must be delivered silently without raw code narration');
assert.equal(artifactResult.modality, RESPONSE_MODALITIES.ARTIFACT_ONLY);
console.log('✔ Code artifacts default to ARTIFACT_ONLY and remain silent');

// 2. Sanitize for speech test: verify code blocks, markdown pipes, and tags are stripped
const mixedContent = 'Grafik telah selesai dibuat.\n\n| Metrik | Nilai |\n|---|---|\n| Laba | 100M |\n\n```python\nimport matplotlib.pyplot as plt\n```\nSemua data telah valid.';
const sanitized = UserResponsePolicy.sanitizeForSpeech(mixedContent, RESPONSE_MODALITIES.TEXT_AND_SPEECH);
assert.ok(!sanitized.includes('import matplotlib'), 'Code must be removed from sanitized speech');
assert.ok(!sanitized.includes('| Metrik |'), 'Markdown tables must be stripped');
assert.ok(sanitized.includes('Grafik telah selesai dibuat'), 'Human prose is preserved');
assert.ok(sanitized.includes('Semua data telah valid'), 'Concluding human prose is preserved');
console.log('✔ Speech sanitization strips code, tables, and raw markup completely');

gate.endUserInteraction(interactionId);
console.log('=== ArtifactSilenceTest PASSED ===\n');
