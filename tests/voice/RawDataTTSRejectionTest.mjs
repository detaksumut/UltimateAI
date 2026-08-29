/**
 * RawDataTTSRejectionTest.mjs
 * Validates that raw JSON, markdown tables, raw code, raw HTML, and raw URLs are rejected before TTS.
 */

import { strict as assert } from 'node:assert';
import { DisplaySpeechSeparationEngine } from '../../src/services/voice/DisplaySpeechSeparationEngine.js';

console.log('=== TEST: RawDataTTSRejectionTest ===');

// 1. Raw JSON rejection
const jsonInput = 'Hasil data: {"status": "ok", "items": [{"name": "beras", "price": 18000}]}';
const cleanJson = DisplaySpeechSeparationEngine.validateSpeechInput(jsonInput);
assert.ok(!cleanJson.includes('{"status"'), 'Raw JSON block must be stripped');
assert.ok(!cleanJson.includes('"price"'), 'Raw JSON keys must be stripped');
console.log('✔ Raw JSON payload rejected from speech');

// 2. Raw Markdown table pipes rejection
const tableInput = '| Komoditas | Harga |\n|---|---|\n| Beras | Rp18.000 |\n| Gula | Rp18.500 |';
const cleanTable = DisplaySpeechSeparationEngine.validateSpeechInput(tableInput);
assert.ok(!cleanTable.includes('|'), 'Markdown table pipe delimiters must never enter TTS');
console.log('✔ Raw markdown table pipes rejected from speech');

// 3. Raw Code fences rejection
const codeInput = 'Berikut kodenya:\n```javascript\nconst a = 10;\nconsole.log(a);\n```';
const cleanCode = DisplaySpeechSeparationEngine.validateSpeechInput(codeInput);
assert.ok(!cleanCode.includes('const a = 10'), 'Code snippets must never be read aloud');
console.log('✔ Raw code blocks rejected from speech');

// 4. Raw URLs rejection
const urlInput = 'Kunjungi https://badanpangan.go.id/harga-pasar untuk rincian.';
const cleanUrl = DisplaySpeechSeparationEngine.validateSpeechInput(urlInput);
assert.ok(!cleanUrl.includes('https://'), 'URLs must never be read character by character');
console.log('✔ Raw URLs rejected from speech');

console.log('=== RawDataTTSRejectionTest PASSED ===\n');
