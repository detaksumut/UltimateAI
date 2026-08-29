/**
 * WebResultSpeechCompressionTest.mjs
 * Validates that web search results with multiple URLs are compressed to key findings.
 */

import { strict as assert } from 'node:assert';
import { DisplaySpeechSeparationEngine } from '../../src/services/voice/DisplaySpeechSeparationEngine.js';

console.log('=== TEST: WebResultSpeechCompressionTest ===');

const webSearchResponse = `
Saya telah merayapi laporan berita terkini dari berbagai media nasional:

1. [Kompas](https://kompas.com/berita-1): Inflasi pangan tercatat stabil pada level 2,5 persen.
2. [Detik](https://detik.com/berita-2): Operasi pasar digelar serentak di 10 kota besar.
3. [CNN](https://cnnindonesia.com/berita-3): Pemerintah mengamankan pasokan beras nasional hingga akhir tahun.
4. [Antara](https://antaranews.com/berita-4): Distribusi minyak goreng subsidi berjalan lancar.

Sumber: Media Nasional Terverifikasi.
`;

const result = DisplaySpeechSeparationEngine.separate(webSearchResponse, 'Cari berita harga pangan hari ini');

// Display retains links and sources
assert.ok(result.displayContent.includes('kompas.com'), 'Display content preserves all citations');

// Speech does NOT narrate URLs or index numbers
assert.ok(!result.speechContent.includes('https'), 'Speech must not read URLs');
assert.ok(!result.speechContent.includes('titik satu'), 'Speech must not read numbered indices literally');
assert.ok(result.speechContent.length < result.displayContent.length, 'Speech must be significantly shorter than display content');
console.log('✔ Web search findings compressed into spoken summary without reading URLs');

console.log('=== WebResultSpeechCompressionTest PASSED ===\n');
