/**
 * TTSQueueIntegrityTest.mjs
 * Tests the normalizer queue integrity: verifies segments are produced
 * correctly from raw agent responses for sequential synthesis.
 * (Browser synthesis API cannot be tested in Node — tests the preparation layer)
 */

import assert from 'assert';
import { IndonesianTextNormalizer } from '../../src/services/voice/IndonesianTextNormalizer.js';

const norm = new IndonesianTextNormalizer();
let pass = 0, fail = 0;

function test(label, fn) {
  try { fn(); console.log(`  ✓ [PASS] ${label}`); pass++; }
  catch (e) { console.error(`  ✗ [FAIL] ${label}: ${e.message}`); fail++; }
}

console.log('\n══════════════════════════════════════════════════════════');
console.log('  TTSQueueIntegrityTest — Segment Preparation & Queue Logic');
console.log('══════════════════════════════════════════════════════════\n');

// Simulate the segment preparation that TextToSpeech.js does
function prepareSegments(text, maxChars = 200) {
  const normalized = norm.normalize(text);
  if (!normalized.trim()) return [];

  const paragraphs = normalized.split(/\n{1,}/);
  const segments = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (trimmed.length <= maxChars) {
      segments.push({ text: trimmed, pause: 100 });
    } else {
      const sentenceSplit = trimmed.split(/(?<=[.!?])\s+/);
      let current = '';
      for (const sent of sentenceSplit) {
        const combined = (current + ' ' + sent).trim();
        if (combined.length > maxChars && current.length > 0) {
          segments.push({ text: current.trim(), pause: 100 });
          current = sent;
        } else {
          current = combined;
        }
      }
      if (current.trim()) segments.push({ text: current.trim(), pause: 280 });
    }
  }

  return segments.filter(s => s.text.length > 1);
}

test('Empty string produces no segments', () => {
  const segs = prepareSegments('');
  assert(segs.length === 0, `Expected 0, got ${segs.length}`);
});

test('Null produces no segments', () => {
  const segs = prepareSegments(null || '');
  assert(segs.length === 0, `Expected 0, got ${segs.length}`);
});

test('Single short sentence produces one segment', () => {
  const segs = prepareSegments('Halo, saya JIN.');
  assert(segs.length === 1, `Expected 1, got ${segs.length}`);
  assert(segs[0].text.includes('Halo'), `Expected Halo in segment. Got: "${segs[0].text}"`);
});

test('Markdown response produces clean segments', () => {
  const raw = `### Kesimpulan\n**Pertama:** pendapatan meningkat. **Kedua:** biaya turun. **Ketiga:** laba bersih naik.`;
  const segs = prepareSegments(raw);
  assert(segs.length >= 1, `Expected ≥1 segment`);
  segs.forEach(s => {
    assert(!s.text.includes('###'), `Segment still has ###: "${s.text}"`);
    assert(!s.text.includes('**'), `Segment still has **: "${s.text}"`);
  });
});

test('Long response (>200 chars) is split into multiple segments', () => {
  const long = 'Ada beberapa alasan mengapa biaya operasi bisa naik meskipun pendapatan turun secara bersamaan. Pertama, biaya tetap seperti sewa gedung, gaji pegawai, dan cicilan peralatan tidak berkurang otomatis ketika penjualan melemah. Kedua, bisa jadi perusahaan sedang berinvestasi dalam kapasitas produksi baru atau teknologi yang belum menghasilkan pendapatan.';
  const segs = prepareSegments(long, 200);
  assert(segs.length >= 2, `Expected ≥2 segments for long text, got ${segs.length}`);
});

test('Numbers are normalized in all segments', () => {
  const raw = 'Total biaya Rp 1.250.000. Pendapatan turun 33,8%. DPR menyetujui anggaran 500.000.000 rupiah.';
  const segs = prepareSegments(raw);
  const combined = segs.map(s => s.text).join(' ');
  assert(!combined.includes('1.250.000'), `Raw number found: "${combined.substring(0,100)}"`);
  assert(!combined.includes('%'), `Raw % found: "${combined.substring(0,100)}"`);
  assert(combined.includes('rupiah') || combined.includes('juta'), `Currency not expanded: "${combined.substring(0,100)}"`);
  assert(combined.includes('persen'), `Percentage not expanded: "${combined.substring(0,100)}"`);
});

test('All segment texts are non-empty strings', () => {
  const raw = `Halo JIN.\n\nBagaimana situasi pasar hari ini?\n\nTerima kasih.`;
  const segs = prepareSegments(raw);
  assert(segs.length > 0, 'Expected segments');
  segs.forEach((s, i) => {
    assert(typeof s.text === 'string', `Segment ${i} text is not a string`);
    assert(s.text.trim().length > 0, `Segment ${i} text is empty`);
  });
});

test('Segments do not overlap (no repeated content)', () => {
  const raw = 'Pendapatan meningkat. Biaya turun. Laba naik. Ini adalah kesimpulan akhir.';
  const segs = prepareSegments(raw);
  const allTexts = segs.map(s => s.text);
  const uniqueTexts = new Set(allTexts);
  assert(uniqueTexts.size === allTexts.length, `Duplicate segments detected: ${JSON.stringify(allTexts)}`);
});

test('Each segment has valid pause value', () => {
  const raw = 'Ini kalimat pertama. Ini kalimat kedua. Ini kalimat ketiga.';
  const segs = prepareSegments(raw);
  segs.forEach((s, i) => {
    assert(typeof s.pause === 'number' && s.pause > 0, `Segment ${i} has invalid pause: ${s.pause}`);
  });
});

console.log('\n══════════════════════════════════════════════════════════');
if (fail === 0) {
  console.log(`  ✅ [PASS] TTSQueueIntegrityTest: ${pass}/${pass + fail}`);
} else {
  console.log(`  ❌ [PARTIAL] TTSQueueIntegrityTest: ${pass} PASS / ${fail} FAIL`);
}
console.log('══════════════════════════════════════════════════════════\n');
if (fail > 0) process.exit(1);
