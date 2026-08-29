/**
 * DisplaySpeechSeparationTest.mjs
 * Validates the core contract: DISPLAY CONTENT != SPEECH CONTENT.
 */

import { strict as assert } from 'node:assert';
import { DisplaySpeechSeparationEngine } from '../../src/services/voice/DisplaySpeechSeparationEngine.js';

console.log('=== TEST: DisplaySpeechSeparationTest ===');

const mockAgentResponse = `
# Ringkasan Harga Komoditas Pangan Nasional

Berikut adalah rincian data harga pangan terbaru:

| No | Komoditas | Harga | Perubahan |
|---|---|---|---|
| 1 | Beras Premium | Rp 18.000/kg | +2.5% |
| 2 | Beras Medium | Rp 14.000/kg | Tetap |
| 3 | Gula Pasir | Rp 18.500/kg | +1.2% |
| 4 | Minyak Goreng | Rp 20.000/liter | -0.5% |
| 5 | Daging Sapi | Rp 135.000/kg | Tetap |

*Catatan: Data diperbarui langsung dari Badan Pangan Nasional.*
`;

const result = DisplaySpeechSeparationEngine.separate(mockAgentResponse, 'Tampilkan harga sembako hari ini.');

// 1. Display content has full markdown table & headers
assert.ok(result.displayContent.includes('| Beras Premium | Rp 18.000/kg |'));
assert.ok(result.displayContent.includes('# Ringkasan Harga'));

// 2. Speech content contains only human-digestible insight
assert.ok(!result.speechContent.includes('|'));
assert.ok(!result.speechContent.includes('#'));
assert.ok(result.speechContent.includes('Harga sembako hari ini sudah saya tampilkan'));

// 3. Speech to display ratio must be compact
assert.ok(result.speechToDisplayRatio < 0.5, 'Speech content length must be compact compared to display content');
console.log(`✔ Full dataset displayed visually (${result.displayContent.length} chars), compact insight spoken (${result.speechContent.length} chars, ratio: ${result.speechToDisplayRatio})`);

console.log('=== DisplaySpeechSeparationTest PASSED ===\n');
