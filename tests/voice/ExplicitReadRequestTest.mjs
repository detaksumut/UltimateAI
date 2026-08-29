/**
 * ExplicitReadRequestTest.mjs
 * Validates expanded speech generation ONLY when the user explicitly requests full reading.
 */

import { strict as assert } from 'node:assert';
import { DisplaySpeechSeparationEngine } from '../../src/services/voice/DisplaySpeechSeparationEngine.js';

console.log('=== TEST: ExplicitReadRequestTest ===');

const mockData = `
| Komoditas | Harga |
|---|---|
| Beras Premium | Rp 18.000/kg |
| Gula Pasir | Rp 18.500/kg |
| Minyak Goreng | Rp 20.000/liter |
`;

// 1. Normal query: "Tampilkan harga sembako" -> Concise summary
const normalResult = DisplaySpeechSeparationEngine.separate(mockData, 'Tampilkan harga sembako');
assert.ok(normalResult.speechContent.includes('sudah saya tampilkan'), 'Default request must summarize');
assert.ok(!normalResult.internalMetadata.isExplicitReadRequest, 'Must not be explicit read');
console.log('✔ Normal request produces concise summary speech');

// 2. Explicit request: "Bacakan semua harga sembako" -> Expanded reading with natural Indonesian words
const explicitResult = DisplaySpeechSeparationEngine.separate(mockData, 'Bacakan semua harga sembako');
assert.ok(explicitResult.internalMetadata.isExplicitReadRequest, 'Explicit read flag must be detected');
assert.ok(explicitResult.speechContent.toLowerCase().includes('beras premium'), 'Explicit reading mentions items');
assert.ok(explicitResult.speechContent.includes('delapan belas ribu'), 'Currency converted to spoken Indonesian words');
assert.ok(!explicitResult.speechContent.includes('|'), 'Pipes must still be stripped');
console.log('✔ Explicit read request produces natural spoken item reading without raw markdown symbols');

console.log('=== ExplicitReadRequestTest PASSED ===\n');
