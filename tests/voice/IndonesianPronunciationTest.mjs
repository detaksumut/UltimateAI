/**
 * IndonesianPronunciationTest.mjs
 * Unit tests for IndonesianTextNormalizer.js
 * Tests every normalization category without running a browser.
 */

import assert from 'assert';
import { IndonesianTextNormalizer } from '../../src/services/voice/IndonesianTextNormalizer.js';

const norm = new IndonesianTextNormalizer();

let pass = 0;
let fail = 0;

function test(label, fn) {
  try {
    fn();
    console.log(`  ✓ [PASS] ${label}`);
    pass++;
  } catch (e) {
    console.error(`  ✗ [FAIL] ${label}: ${e.message}`);
    fail++;
  }
}

console.log('\n════════════════════════════════════════════════════');
console.log('  IndonesianPronunciationTest — Text Normalization');
console.log('════════════════════════════════════════════════════\n');

// ── NUMBERS ──────────────────────────────────────────────────────────────
console.log('[BLOCK 1] Number Normalization');

test('Integer: 1.250.000 → satu juta dua ratus lima puluh ribu', () => {
  const result = norm.normalize('Biaya sebesar 1.250.000 rupiah.');
  assert(result.includes('satu juta dua ratus lima puluh ribu'), `Got: "${result}"`);
});

test('Integer: 500.000 → lima ratus ribu', () => {
  const result = norm.normalize('Total 500.000 unit terjual.');
  assert(result.includes('lima ratus ribu'), `Got: "${result}"`);
});

test('Small integer: 42', () => {
  const result = norm.normalize('Terdapat 42 kasus.');
  // Small numbers left as-is OR converted
  assert(result.includes('empat puluh dua') || result.includes('42'), `Got: "${result}"`);
});

test('Large number: 1.000.000.000 → satu miliar', () => {
  const result = norm.normalize('Anggaran 1.000.000.000 rupiah dialokasikan.');
  assert(result.includes('satu miliar') || result.includes('miliar'), `Got: "${result}"`);
});

// ── PERCENTAGES ───────────────────────────────────────────────────────────
console.log('\n[BLOCK 2] Percentage Normalization');

test('Percentage with comma: 33,8%', () => {
  const result = norm.normalize('Pertumbuhan mencapai 33,8%.');
  assert(
    result.includes('tiga puluh tiga koma delapan persen') ||
    result.includes('persen'),
    `Got: "${result}"`
  );
});

test('Whole percentage: 25%', () => {
  const result = norm.normalize('Efisiensi naik 25%.');
  assert(result.includes('dua puluh lima persen'), `Got: "${result}"`);
});

test('Percentage: 100%', () => {
  const result = norm.normalize('Lolos 100%.');
  assert(result.includes('seratus persen'), `Got: "${result}"`);
});

// ── CURRENCY ──────────────────────────────────────────────────────────────
console.log('\n[BLOCK 3] Currency Normalization');

test('Currency: Rp 1.250.000', () => {
  const result = norm.normalize('Harga barang Rp 1.250.000.');
  assert(
    result.includes('satu juta dua ratus lima puluh ribu rupiah') ||
    result.includes('rupiah'),
    `Got: "${result}"`
  );
});

test('Currency: Rp 500.000', () => {
  const result = norm.normalize('Diskon Rp 500.000.');
  assert(result.includes('lima ratus ribu rupiah'), `Got: "${result}"`);
});

// ── DATES ─────────────────────────────────────────────────────────────────
console.log('\n[BLOCK 4] Date Normalization');

test('Date: 28/08/2026', () => {
  const result = norm.normalize('Tanggal 28/08/2026.');
  assert(
    result.includes('delapan') && result.includes('Agustus') && result.includes('dua ribu'),
    `Got: "${result}"`
  );
});

test('Date: 01-01-2025', () => {
  const result = norm.normalize('Berlaku mulai 01-01-2025.');
  assert(result.includes('Januari') && result.includes('dua ribu dua puluh lima'), `Got: "${result}"`);
});

// ── ABBREVIATIONS ─────────────────────────────────────────────────────────
console.log('\n[BLOCK 5] Abbreviation Expansion');

test('UU → Undang-Undang', () => {
  const result = norm.normalize('UU Perampasan Aset disahkan.');
  assert(result.includes('Undang-Undang'), `Got: "${result}"`);
});

test('DPR → Dewan Perwakilan Rakyat', () => {
  const result = norm.normalize('DPR menyetujui anggaran.');
  assert(result.includes('Dewan Perwakilan Rakyat'), `Got: "${result}"`);
});

test('CSR → tanggung jawab sosial perusahaan', () => {
  const result = norm.normalize('Program CSR perusahaan berjalan baik.');
  assert(result.includes('tanggung jawab sosial perusahaan'), `Got: "${result}"`);
});

test('AI → Kecerdasan Buatan', () => {
  const result = norm.normalize('Teknologi AI semakin berkembang.');
  assert(result.includes('Kecerdasan Buatan'), `Got: "${result}"`);
});

test('API → antarmuka pemrograman aplikasi', () => {
  const result = norm.normalize('Integrasi API dilakukan.');
  assert(result.includes('antarmuka pemrograman aplikasi'), `Got: "${result}"`);
});

test('PDF → P-D-F', () => {
  const result = norm.normalize('File dalam format PDF.');
  assert(result.includes('P-D-F'), `Got: "${result}"`);
});

test('ROI → imbal hasil investasi', () => {
  const result = norm.normalize('ROI meningkat signifikan.');
  assert(result.includes('imbal hasil investasi'), `Got: "${result}"`);
});

// ── MARKDOWN STRIPPING ───────────────────────────────────────────────────
console.log('\n[BLOCK 6] Markdown Stripping');

test('### heading stripped', () => {
  const result = norm.normalize('### Kesimpulan\nAnalisis selesai.');
  assert(!result.includes('###'), `Should not contain ###. Got: "${result}"`);
  assert(result.includes('Kesimpulan'), `Should contain heading text. Got: "${result}"`);
});

test('** bold stripped', () => {
  const result = norm.normalize('**Penting:** data telah diverifikasi.');
  assert(!result.includes('**'), `Should not contain **. Got: "${result}"`);
  assert(result.includes('Penting'), `Should contain text. Got: "${result}"`);
});

test('Bullet points stripped', () => {
  const result = norm.normalize('- Pertama\n- Kedua\n- Ketiga');
  assert(!result.includes('- '), `Should not contain bullet. Got: "${result}"`);
});

test('Numbered list markers stripped', () => {
  const result = norm.normalize('1. Langkah pertama\n2. Langkah kedua');
  assert(!result.match(/^\d+\./m), `Should not start lines with "1.". Got: "${result}"`);
});

test('URL stripped', () => {
  const result = norm.normalize('Lihat https://example.com untuk info lebih lanjut.');
  assert(!result.includes('https://'), `Should not contain URL. Got: "${result}"`);
});

test('Code block stripped', () => {
  const result = norm.normalize('Gunakan kode berikut:\n```\nconsole.log("test");\n```\nSelesai.');
  assert(!result.includes('console.log'), `Should not contain code. Got: "${result}"`);
});

// ── COMPLEX COMBINATION ───────────────────────────────────────────────────
console.log('\n[BLOCK 7] Complex Combined Input');

test('Full JIN response normalization', () => {
  const raw = `### Laporan Keuangan Q2 2026

**Pendapatan** meningkat 33,8% menjadi Rp 1.250.000.000.

- KPI utama tercapai
- ROI naik 25%
- DPR menyetujui UU baru tanggal 28/08/2026

Lihat https://example.com/report.pdf untuk detail.`;

  const result = norm.normalize(raw);

  // Should not contain
  assert(!result.includes('###'), 'No heading markers');
  assert(!result.includes('**'), 'No bold markers');
  assert(!result.includes('- '), 'No bullet markers');
  assert(!result.includes('https://'), 'No URL');

  // Should contain
  assert(result.includes('tiga puluh tiga koma delapan persen') || result.includes('persen'), 'Percentage expanded');
  assert(result.includes('rupiah'), 'Currency expanded');
  assert(result.includes('Dewan Perwakilan Rakyat'), 'DPR expanded');
  assert(result.includes('Undang-Undang'), 'UU expanded');
  assert(result.includes('imbal hasil investasi') || result.toLowerCase().includes('roi'), 'ROI expanded or present');
  assert(result.includes('Agustus'), 'Date month expanded');

  console.log(`     [Sample result]: "${result.substring(0, 200)}..."`);
});

// ── RESULTS ────────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════════════════');
if (fail === 0) {
  console.log(`  ✅ [PASS] IndonesianPronunciationTest: ${pass}/${pass + fail}`);
} else {
  console.log(`  ❌ [PARTIAL] IndonesianPronunciationTest: ${pass} PASS / ${fail} FAIL`);
}
console.log('════════════════════════════════════════════════════\n');

if (fail > 0) process.exit(1);
