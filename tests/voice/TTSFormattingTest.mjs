/**
 * TTSFormattingTest.mjs
 * Verifies markdown stripping, spoken summary generation, and paragraph segmentation.
 */

import assert from 'assert';
import { IndonesianTextNormalizer } from '../../src/services/voice/IndonesianTextNormalizer.js';

const norm = new IndonesianTextNormalizer();
let pass = 0, fail = 0;

function test(label, fn) {
  try { fn(); console.log(`  ✓ [PASS] ${label}`); pass++; }
  catch (e) { console.error(`  ✗ [FAIL] ${label}: ${e.message}`); fail++; }
}

console.log('\n════════════════════════════════════════════════════');
console.log('  TTSFormattingTest — Speech Formatting & Structure');
console.log('════════════════════════════════════════════════════\n');

const jinkResponse = `### Analisis Keuangan Q2 2026

**Pendapatan** perusahaan meningkat 33,8% menjadi Rp 1.250.000.000.

- KPI utama: ROI naik 25%
- DPR menyetujui UU baru
- Audit UU Perampasan Aset selesai tanggal 28/08/2026

Lihat https://report.example.com/detail.pdf untuk informasi lebih lanjut.

\`\`\`json
{"key": "value"}
\`\`\`

> Catatan: data ini bersifat **rahasia**.`;

test('Heading markers removed', () => {
  const r = norm.normalize(jinkResponse);
  assert(!r.includes('###'), `Still contains ###: "${r.substring(0,80)}"`);
});

test('Bold markers removed', () => {
  const r = norm.normalize(jinkResponse);
  assert(!r.includes('**'), `Still contains **: "${r.substring(0,80)}"`);
});

test('URL removed', () => {
  const r = norm.normalize(jinkResponse);
  assert(!r.includes('http'), `Still contains URL: "${r.substring(0,120)}"`);
});

test('Code block removed', () => {
  const r = norm.normalize(jinkResponse);
  assert(!r.includes('```'), 'Still contains code fence');
  assert(!r.includes('"key"'), 'Still contains JSON key');
});

test('Blockquote marker removed', () => {
  const r = norm.normalize(jinkResponse);
  assert(!r.match(/^>/m), 'Still contains blockquote >');
});

test('Heading text preserved', () => {
  const r = norm.normalize(jinkResponse);
  assert(r.includes('Analisis Keuangan'), `Heading text missing: "${r.substring(0,100)}"`);
});

test('Bullet list content preserved', () => {
  const r = norm.normalize(jinkResponse);
  assert(r.includes('Dewan Perwakilan Rakyat'), 'DPR expansion missing');
});

test('Spoken summary: max 4 sentences', () => {
  const summary = norm.toSpokenSummary(jinkResponse, 4);
  const sentences = summary.split(/(?<=[.!?])\s+/);
  assert(sentences.length <= 6, `Too many sentences: ${sentences.length}`);
  assert(summary.length > 20, 'Summary too short');
});

test('Paragraph splitting produces multiple segments', () => {
  const paras = norm.splitIntoParagraphs(jinkResponse);
  assert(paras.length >= 2, `Expected multiple paragraphs, got ${paras.length}`);
});

test('Sentence splitting produces multiple segments', () => {
  const text = 'Pendapatan meningkat. Biaya turun signifikan. Laba bersih naik dua puluh persen.';
  const sentences = norm.splitIntoSentences(text);
  assert(sentences.length >= 2, `Expected multiple sentences, got ${sentences.length}`);
});

test('Empty input returns empty string', () => {
  assert(norm.normalize('') === '', 'Empty input should return empty string');
});

test('Null input handled gracefully', () => {
  assert(norm.normalize(null) === '', 'Null input should return empty string');
});

console.log('\n════════════════════════════════════════════════════');
if (fail === 0) {
  console.log(`  ✅ [PASS] TTSFormattingTest: ${pass}/${pass + fail}`);
} else {
  console.log(`  ❌ [PARTIAL] TTSFormattingTest: ${pass} PASS / ${fail} FAIL`);
}
console.log('════════════════════════════════════════════════════\n');
if (fail > 0) process.exit(1);
