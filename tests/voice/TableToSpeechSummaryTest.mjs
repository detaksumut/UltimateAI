/**
 * TableToSpeechSummaryTest.mjs
 * Validates that tables are summarized into concise human insights without reading every row.
 */

import { strict as assert } from 'node:assert';
import { TableSpeechSummarizer } from '../../src/services/voice/DisplaySpeechSeparationEngine.js';

console.log('=== TEST: TableToSpeechSummaryTest ===');

const sembakoTable = `
Berikut daftar harga pangan hari ini:

| Komoditas | Harga | Satuan |
|---|---|---|
| Beras Premium | Rp 18.000 | /kg |
| Beras Medium | Rp 14.000 | /kg |
| Gula Pasir | Rp 18.500 | /kg |
| Minyak Goreng | Rp 20.000 | /liter |
| Telur Ayam | Rp 31.000 | /kg |
| Daging Sapi | Rp 135.000 | /kg |
| Cabai Rawit | Rp 45.000 | /kg |
| Bawang Merah | Rp 38.000 | /kg |
`;

// Test default summary: JIN should NOT read every row
const summaryResult = TableSpeechSummarizer.summarize(sembakoTable, 'Tampilkan harga sembako hari ini.', false);

assert.ok(summaryResult.omittedDetails, 'Table rows must be omitted from speech');
assert.ok(summaryResult.speechText.includes('Harga sembako hari ini sudah saya tampilkan'));
assert.ok(!summaryResult.speechText.includes('Daging Sapi titik dua'), 'Punctuation/row enumeration must not occur');
console.log('✔ Commodity table summarized into concise human insight');

// Test single specific item query: JIN answers only that specific item
const singleItemResult = TableSpeechSummarizer.summarize(sembakoTable, 'Berapa harga beras premium?', false);
assert.ok(singleItemResult.speechText.toLowerCase().includes('beras premium'));
assert.ok(singleItemResult.speechText.includes('Rp 18.000'));
console.log('✔ Specific item query returns targeted answer without reading full table');

console.log('=== TableToSpeechSummaryTest PASSED ===\n');
