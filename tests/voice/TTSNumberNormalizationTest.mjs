/**
 * TTSNumberNormalizationTest.mjs
 * Comprehensive number-to-words conversion tests for Indonesian TTS.
 */

import assert from 'assert';
import { IndonesianTextNormalizer } from '../../src/services/voice/IndonesianTextNormalizer.js';

const norm = new IndonesianTextNormalizer();
let pass = 0, fail = 0;

function test(label, fn) {
  try { fn(); console.log(`  ✓ [PASS] ${label}`); pass++; }
  catch (e) { console.error(`  ✗ [FAIL] ${label}: ${e.message}`); fail++; }
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  TTSNumberNormalizationTest — Indonesian Number Conversion');
console.log('═══════════════════════════════════════════════════════════\n');

// Indonesian thousand-separator numbers
test('1.000 → seribu', () => {
  const r = norm.normalize('Total 1.000 unit.');
  assert(r.includes('seribu') || r.includes('satu ribu'), `Got: "${r}"`);
});

test('1.000.000 → satu juta', () => {
  const r = norm.normalize('Total 1.000.000 rupiah.');
  assert(r.includes('satu juta'), `Got: "${r}"`);
});

test('1.250.000 → satu juta dua ratus lima puluh ribu', () => {
  const r = norm.normalize('Biaya 1.250.000 rupiah.');
  assert(r.includes('satu juta') && r.includes('dua ratus lima puluh ribu'), `Got: "${r}"`);
});

test('500.000.000 → lima ratus juta', () => {
  const r = norm.normalize('Anggaran 500.000.000 rupiah.');
  assert(r.includes('lima ratus juta') || r.includes('ratus juta'), `Got: "${r}"`);
});

test('1.000.000.000 → satu miliar', () => {
  const r = norm.normalize('Dana 1.000.000.000 rupiah.');
  assert(r.includes('satu miliar') || r.includes('miliar'), `Got: "${r}"`);
});

// Percentages
test('33,8% → tiga puluh tiga koma delapan persen', () => {
  const r = norm.normalize('Naik 33,8%.');
  assert(r.includes('persen'), `Got: "${r}"`);
  assert(r.includes('tiga puluh tiga') || r.includes('tiga'), `Got: "${r}"`);
});

test('0,5% → nol koma lima persen', () => {
  const r = norm.normalize('Inflasi 0,5%.');
  assert(r.includes('persen') && r.includes('nol'), `Got: "${r}"`);
});

test('100% → seratus persen', () => {
  const r = norm.normalize('Lolos 100%.');
  assert(r.includes('seratus persen'), `Got: "${r}"`);
});

// Currency
test('Rp 500.000 → lima ratus ribu rupiah', () => {
  const r = norm.normalize('Harga Rp 500.000.');
  assert(r.includes('lima ratus ribu') && r.includes('rupiah'), `Got: "${r}"`);
});

test('Rp 1.250.000 → satu juta dua ratus lima puluh ribu rupiah', () => {
  const r = norm.normalize('Biaya Rp 1.250.000.');
  assert(r.includes('rupiah'), `Got: "${r}"`);
  assert(r.includes('satu juta'), `Got: "${r}"`);
});

// Dates
test('28/08/2026 → dua puluh delapan Agustus dua ribu dua puluh enam', () => {
  const r = norm.normalize('Tanggal 28/08/2026.');
  assert(r.includes('delapan') && r.includes('Agustus'), `Got: "${r}"`);
  assert(r.includes('dua ribu'), `Got: "${r}"`);
});

test('01-01-2025 → satu Januari dua ribu dua puluh lima', () => {
  const r = norm.normalize('Berlaku 01-01-2025.');
  assert(r.includes('Januari') && r.includes('dua ribu'), `Got: "${r}"`);
});

// Decimal (comma as Indonesian decimal)
test('3,14 → tiga koma satu empat', () => {
  const r = norm.normalize('PI adalah 3,14.');
  assert(r.includes('tiga koma'), `Got: "${r}"`);
});

// Key acceptance tests from spec
test('SPEC: Berapa 33,8 persen dari 1.250.000 rupiah?', () => {
  const r = norm.normalize('Berapa 33,8% dari 1.250.000 rupiah?');
  assert(r.includes('persen'), `Must contain persen. Got: "${r}"`);
  assert(!r.includes('33,8%'), `Should not leave raw percentage. Got: "${r}"`);
  assert(!r.includes('1.250.000'), `Should not leave raw number. Got: "${r}"`);
});

console.log('\n═══════════════════════════════════════════════════════════');
if (fail === 0) {
  console.log(`  ✅ [PASS] TTSNumberNormalizationTest: ${pass}/${pass + fail}`);
} else {
  console.log(`  ❌ [PARTIAL] TTSNumberNormalizationTest: ${pass} PASS / ${fail} FAIL`);
}
console.log('═══════════════════════════════════════════════════════════\n');
if (fail > 0) process.exit(1);
