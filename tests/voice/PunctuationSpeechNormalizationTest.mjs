/**
 * PunctuationSpeechNormalizationTest.mjs
 * Validates that punctuation marks (: ; / | # * _ {} [] <>) are never spoken literally.
 */

import { strict as assert } from 'node:assert';
import { indonesianTextNormalizerInstance } from '../../src/services/voice/IndonesianTextNormalizer.js';
import { DisplaySpeechSeparationEngine } from '../../src/services/voice/DisplaySpeechSeparationEngine.js';

console.log('=== TEST: PunctuationSpeechNormalizationTest ===');

const normalizer = indonesianTextNormalizerInstance;

const punctuatedText = 'Beras: Rp 18.000 / kg | Status: Stabil; Target: #1';
const normalized = normalizer.normalize(punctuatedText);

// Must not contain literal punctuation words
assert.ok(!normalized.toLowerCase().includes('titik dua'), 'Must not pronounce colon as "titik dua"');
assert.ok(!normalized.toLowerCase().includes('titik koma'), 'Must not pronounce semicolon as "titik koma"');
assert.ok(!normalized.toLowerCase().includes('garis miring'), 'Must not pronounce slash as "garis miring"');
assert.ok(!normalized.toLowerCase().includes('garis tegak'), 'Must not pronounce pipe as "garis tegak"');
assert.ok(!normalized.toLowerCase().includes('tanda pagar'), 'Must not pronounce hash as "tanda pagar"');

// Must be speech validated
const validated = DisplaySpeechSeparationEngine.validateSpeechInput(normalized);
assert.ok(!validated.includes('|'));
assert.ok(!validated.includes('#'));
assert.ok(!validated.includes(':'));

console.log('✔ Punctuation marks are never spoken literally as symbol names');
console.log('=== PunctuationSpeechNormalizationTest PASSED ===\n');
