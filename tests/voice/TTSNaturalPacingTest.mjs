/**
 * TTSNaturalPacingTest.mjs
 * Tests sentence segmentation and natural pacing behavior.
 * Validates that long responses are split into appropriate speech segments.
 */

import assert from 'assert';
import { IndonesianTextNormalizer } from '../../src/services/voice/IndonesianTextNormalizer.js';

const norm = new IndonesianTextNormalizer();
let pass = 0, fail = 0;

function test(label, fn) {
  try { fn(); console.log(`  ✓ [PASS] ${label}`); pass++; }
  catch (e) { console.error(`  ✗ [FAIL] ${label}: ${e.message}`); fail++; }
}

console.log('\n══════════════════════════════════════════════════════');
console.log('  TTSNaturalPacingTest — Segmentation & Pacing Logic');
console.log('══════════════════════════════════════════════════════\n');

// ── SENTENCE SEGMENTATION ─────────────────────────────────────────────────
console.log('[BLOCK 1] Sentence Segmentation');

test('Single sentence produces one segment', () => {
  const segs = norm.splitIntoSentences('Ini adalah satu kalimat.');
  assert(segs.length === 1, `Expected 1, got ${segs.length}`);
});

test('Three sentences produce multiple segments', () => {
  const text = 'Pertama, pendapatan meningkat. Kedua, biaya turun. Ketiga, laba bersih naik.';
  const segs = norm.splitIntoSentences(text);
  assert(segs.length >= 2, `Expected ≥2 segments, got ${segs.length}. Segs: ${JSON.stringify(segs)}`);
});

test('Multi-paragraph response produces segments', () => {
  const text = `JIN, jelaskan kenapa biaya operasi bisa naik sementara pendapatan justru turun.

Ada beberapa kemungkinan yang bisa menjelaskan hal ini. Pertama, biaya tetap seperti sewa dan gaji terus berjalan meskipun pendapatan menurun. Kedua, mungkin ada investasi infrastruktur yang dilakukan bersamaan.

Dari sisi pendapatan, penurunan bisa terjadi karena berkurangnya permintaan atau persaingan yang lebih ketat.`;

  const segs = norm.splitIntoSentences(text);
  assert(segs.length >= 3, `Expected ≥3 segments, got ${segs.length}`);
  segs.forEach((s, i) => {
    assert(s.length > 5, `Segment ${i} too short: "${s}"`);
  });
});

test('Each segment length within reasonable TTS range', () => {
  const text = 'Intinya ada tiga hal yang perlu diperhatikan secara seksama. Pertama adalah soal regulasi yang semakin ketat di pasar Belanda dan Jerman. Kedua adalah hambatan distribusi yang meningkat. Ketiga, perlu ada negosiasi khusus dengan otoritas setempat.';
  const segs = norm.splitIntoSentences(text);
  segs.forEach((s, i) => {
    assert(s.length <= 300, `Segment ${i} too long (${s.length} chars): "${s.substring(0,80)}..."`);
  });
});

// ── PARAGRAPH SEGMENTATION ────────────────────────────────────────────────
console.log('\n[BLOCK 2] Paragraph Segmentation');

test('Multi-paragraph splits into separate paragraphs', () => {
  const text = `Paragraf pertama membahas topik A.

Paragraf kedua membahas topik B.

Paragraf ketiga adalah kesimpulan.`;

  const paras = norm.splitIntoParagraphs(text);
  assert(paras.length >= 3, `Expected ≥3, got ${paras.length}`);
});

test('No empty segments in output', () => {
  const text = `\n\nBaris pertama.\n\n\n\nBaris kedua.\n\n`;
  const paras = norm.splitIntoParagraphs(text);
  paras.forEach((p, i) => {
    assert(p.trim().length > 0, `Segment ${i} is empty`);
  });
});

// ── SPEC TEST UTTERANCES ─────────────────────────────────────────────────
console.log('\n[BLOCK 3] Spec Test Utterances from Requirements');

test('SPEC: Utterance 1 — JIN jelaskan biaya operasi naik sementara pendapatan turun', () => {
  const text = 'JIN, jelaskan dengan bahasa sederhana kenapa biaya operasi bisa naik sementara pendapatan justru turun.';
  const normalized = norm.normalize(text);
  // Should not modify this plain text significantly
  assert(normalized.includes('biaya operasi'), `Should preserve "biaya operasi". Got: "${normalized}"`);
  assert(normalized.includes('pendapatan'), `Should preserve "pendapatan". Got: "${normalized}"`);
  assert(!normalized.includes('###'), 'Should not contain markdown');
});

test('SPEC: Utterance 2 — Berapa 33,8 persen dari 1.250.000 rupiah?', () => {
  const text = 'Berapa 33,8 persen dari 1.250.000 rupiah?';
  const normalized = norm.normalize(text);
  assert(!normalized.includes('1.250.000'), `Should convert number. Got: "${normalized}"`);
  assert(normalized.includes('rupiah'), `Should contain "rupiah". Got: "${normalized}"`);
});

test('SPEC: Utterance 3 — Menurutmu apa risiko terbesar dari keputusan ini?', () => {
  const text = 'Menurutmu, apa risiko terbesar dari keputusan ini?';
  const normalized = norm.normalize(text);
  // Plain text — should pass through cleanly
  assert(normalized.includes('risiko'), `Should preserve "risiko". Got: "${normalized}"`);
  assert(normalized.includes('keputusan'), `Should preserve "keputusan". Got: "${normalized}"`);
});

// ── PROSODY ANTI-PATTERN CHECK ────────────────────────────────────────────
console.log('\n[BLOCK 4] Anti-Pattern Checks');

test('No raw percentage symbol in output', () => {
  const r = norm.normalize('Pertumbuhan 33,8%.');
  assert(!r.includes('%'), `Raw % found: "${r}"`);
});

test('No thousand-separator numbers in output', () => {
  const r = norm.normalize('Nilai 1.250.000 rupiah.');
  // After normalization, the Indonesian number 1.250.000 should be expanded
  const hasRawPattern = /\b\d{1,3}\.\d{3}\b/.test(r);
  assert(!hasRawPattern, `Raw thousand-sep number found: "${r}"`);
});

test('No raw Rp abbreviation in output', () => {
  const r = norm.normalize('Harga Rp 500.000.');
  // 'Rp' should be replaced by 'rupiah' at end of number
  assert(!r.includes(' Rp ') && !r.startsWith('Rp '), `Raw "Rp" found: "${r}"`);
});

test('No markdown hash symbols in output', () => {
  const r = norm.normalize('## Judul\nIsi teks.');
  assert(!r.includes('#'), `Hash found: "${r}"`);
});

console.log('\n══════════════════════════════════════════════════════');
if (fail === 0) {
  console.log(`  ✅ [PASS] TTSNaturalPacingTest: ${pass}/${pass + fail}`);
} else {
  console.log(`  ❌ [PARTIAL] TTSNaturalPacingTest: ${pass} PASS / ${fail} FAIL`);
}
console.log('══════════════════════════════════════════════════════\n');
if (fail > 0) process.exit(1);
