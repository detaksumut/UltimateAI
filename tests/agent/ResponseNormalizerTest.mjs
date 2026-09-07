/**
 * ResponseNormalizerTest.mjs
 * TAHAP 3B-2C — Response normalization test suite:
 * - role label artifacts ("assistant", "system", "user") must never leak
 * - deliberate content ("AI assistant membantu pengguna.") must stay intact
 * - deliberate ellipsis ("Tunggu...") must be preserved
 * - accidental double punctuation ("terpakai..") must collapse to one period
 * Style: plain assert .mjs script (repo backend convention).
 * Run: node tests/agent/ResponseNormalizerTest.mjs
 */

import assert from 'assert';

import { normalizeModelResponse, stripTrailingPunctuation } from '../../server/agent/ResponseNormalizer.mjs';

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL: ${name}`);
    console.error(`       ${err.message}`);
  }
}

console.log('=== TEST: ResponseNormalizerTest ===');

// ── Role label artifacts must be stripped ─────────────────────────────
check('removes standalone "assistant" block', () => {
  assert.strictEqual(normalizeModelResponse('assistant\n\nRAM: 73% terpakai.'), 'RAM: 73% terpakai.');
});

check('removes "assistant:" chat prefix', () => {
  assert.strictEqual(normalizeModelResponse('assistant: RAM: 73% terpakai.'), 'RAM: 73% terpakai.');
});

check('removes "system\n\n" prefix', () => {
  assert.strictEqual(normalizeModelResponse('system\n\nHalo'), 'Halo');
});

check('removes "user -" prefix', () => {
  assert.strictEqual(normalizeModelResponse('user - Cek RAM komputer ini'), 'Cek RAM komputer ini');
});

check('removes "model> Halo" prefix', () => {
  assert.strictEqual(normalizeModelResponse('model> Halo dunia'), 'Halo dunia');
});

check('removes role label after leading whitespace', () => {
  assert.strictEqual(normalizeModelResponse('\n\n  assistant\n\nRAM: 73% terpakai.'), 'RAM: 73% terpakai.');
});

check('removes [INST] fences', () => {
  assert.strictEqual(normalizeModelResponse('[INST] Halo dunia'), 'Halo dunia');
});

check('removes code fences', () => {
  assert.strictEqual(normalizeModelResponse('```\nRAM: 73% terpakai.\n```'), 'RAM: 73% terpakai.');
});

check('collapses leading whitespace', () => {
  assert.strictEqual(normalizeModelResponse('\n\n\n   Halo dunia'), 'Halo dunia');
});

// ── Legitimate content must not be damaged ────────────────────────────
check('keeps "AI assistant" inside a sentence', () => {
  assert.strictEqual(normalizeModelResponse('AI assistant membantu pengguna.'), 'AI assistant membantu pengguna.');
});

check('keeps "assistant" as first word of a real sentence', () => {
  assert.strictEqual(normalizeModelResponse('assistant membantu pengguna.'), 'assistant membantu pengguna.');
});

check('preserves non-prefix "system" mention', () => {
  assert.strictEqual(normalizeModelResponse('Sistem operasi berjalan normal.'), 'Sistem operasi berjalan normal.');
});

// ── Double punctuation ────────────────────────────────────────────────
check('collapses trailing ".." to "."', () => {
  assert.strictEqual(normalizeModelResponse('Berdasarkan data yang diverifikasi: RAM: 73% terpakai..'), 'Berdasarkan data yang diverifikasi: RAM: 73% terpakai.');
});

check('preserves deliberate "..." ellipsis', () => {
  assert.strictEqual(normalizeModelResponse('Tunggu...'), 'Tunggu...');
});

check('does not touch single "."', () => {
  assert.strictEqual(normalizeModelResponse('RAM: 73% terpakai.'), 'RAM: 73% terpakai.');
});

// ── Non-string passthrough ────────────────────────────────────────────
check('returns non-string input unchanged', () => {
  assert.strictEqual(normalizeModelResponse(123), 123);
  assert.strictEqual(normalizeModelResponse(null), null);
  assert.strictEqual(normalizeModelResponse(undefined), undefined);
});

// ── stripTrailingPunctuation ──────────────────────────────────────────
check('stripTrailingPunctuation removes trailing period', () => {
  assert.strictEqual(stripTrailingPunctuation('RAM: 73% terpakai.'), 'RAM: 73% terpakai');
});

check('stripTrailingPunctuation trims whitespace', () => {
  assert.strictEqual(stripTrailingPunctuation('  halo!  '), 'halo');
});

// ── Integration-style: full responseMessage composition ───────────────
check('composes clean responseMessage without double period', () => {
  const rawFact = 'assistant\n\nRAM: 73% terpakai.';
  const cleanFact = normalizeModelResponse(rawFact);
  const message = normalizeModelResponse(`Berdasarkan data yang diverifikasi: ${stripTrailingPunctuation(cleanFact)}.`);
  assert.strictEqual(message, 'Berdasarkan data yang diverifikasi: RAM: 73% terpakai.');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('=== ResponseNormalizerTest FAILED ===');
  process.exit(1);
}
console.log('=== ResponseNormalizerTest PASSED ===\n');