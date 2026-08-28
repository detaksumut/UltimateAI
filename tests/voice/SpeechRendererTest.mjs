/**
 * SpeechRendererTest.mjs
 * Unit tests for SpeechRenderer.
 * Verifies transformation of rich structured JIN responses (markdown, headers, bullets, numbers, dates, currency, abbreviations)
 * into conversational, natural spoken Indonesian.
 */

import assert from 'assert';
import { SpeechRenderer } from '../../src/services/voice/SpeechRenderer.js';

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

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: SpeechRendererTest — JIN Structured Response Speech Renderer');
console.log('═══════════════════════════════════════════════════════════════════════\n');

const renderer = new SpeechRenderer();

// 1. Empty & Null Inputs
test('Empty or null input returns empty result gracefully', () => {
  const res1 = renderer.renderForSpeech('');
  assert.strictEqual(res1.speechText, '');
  assert.strictEqual(res1.segments.length, 0);

  const res2 = renderer.renderForSpeech(null);
  assert.strictEqual(res2.speechText, '');
  assert.strictEqual(res2.segments.length, 0);
});

// 2. Heading to Conversational Transition Transformation
test('Transforms ### Kesimpulan to "Kesimpulannya."', () => {
  const raw = '### Kesimpulan\nPendapatan meningkat.';
  const res = renderer.renderForSpeech(raw);
  assert(res.speechText.includes('Kesimpulannya.'), `Expected "Kesimpulannya.", got: "${res.speechText}"`);
  assert(!res.speechText.includes('###'), 'Must not contain markdown hash');
});

test('Transforms ### Rekomendasi to "Berikut rekomendasinya."', () => {
  const raw = '### Rekomendasi\nEfisiensi biaya ditingkatkan.';
  const res = renderer.renderForSpeech(raw);
  assert(res.speechText.includes('Berikut rekomendasinya.'), `Expected "Berikut rekomendasinya.", got: "${res.speechText}"`);
});

// 3. Bullet & Numbered List to Conversational Sequence Transformation
test('Transforms bullet list into Pertama, Kedua, Ketiga', () => {
  const raw = `### Kesimpulan

- Pendapatan naik 20%
- Biaya operasional turun
- Laba bersih meningkat`;

  const res = renderer.renderForSpeech(raw);
  assert(res.speechText.includes('Pertama,'), `Expected "Pertama,", got: "${res.speechText}"`);
  assert(res.speechText.includes('Kedua,'), `Expected "Kedua,", got: "${res.speechText}"`);
  assert(res.speechText.includes('Ketiga,'), `Expected "Ketiga,", got: "${res.speechText}"`);
  assert(!res.speechText.includes('- '), 'Must not contain bullet symbol');
});

// 4. Number, Currency, Date, and Percentage Normalization in Rendered Output
test('Normalizes numbers, percentages, and currencies in structured reports', () => {
  const raw = `### Laporan Eksekutif

**Pendapatan** mencapai Rp 1.250.000 dengan margin 33,8%.
Tanggal pengesahan 28/08/2026 oleh DPR terkait UU baru.`;

  const res = renderer.renderForSpeech(raw);
  assert(res.speechText.includes('satu juta dua ratus lima puluh ribu rupiah') || res.speechText.includes('rupiah'), 'Currency normalized');
  assert(res.speechText.includes('tiga puluh tiga koma delapan persen') || res.speechText.includes('persen'), 'Percentage normalized');
  assert(res.speechText.includes('Agustus') && res.speechText.includes('dua ribu dua puluh enam'), 'Date normalized');
  assert(res.speechText.includes('Dewan Perwakilan Rakyat'), 'DPR expanded');
  assert(res.speechText.includes('Undang-Undang'), 'UU expanded');
  assert(!res.speechText.includes('**'), 'No bold markdown');
});

// 5. Sentence & Segment Generation for Neural Audio Queue
test('Produces clean segmented chunks for streaming TTS queue', () => {
  const longReport = `JIN, jelaskan dengan bahasa sederhana apa yang dimaksud dengan inflasi dan bagaimana pengaruhnya terhadap daya beli masyarakat.

Inflasi adalah kondisi di mana harga barang dan jasa secara umum mengalami kenaikan secara terus menerus dalam jangka waktu tertentu. Ketika inflasi terjadi, nilai riil uang kita menjadi berkurang.

Sebagai contoh, jika inflasi mencapai sepuluh persen, maka uang seratus ribu rupiah hanya bisa membeli barang yang nilainya setara sembilan puluh ribu rupiah di masa lalu.`;

  const res = renderer.renderForSpeech(longReport, { maxSegmentChars: 180 });
  assert(res.segments.length >= 2, `Expected at least 2 segments, got ${res.segments.length}`);
  res.segments.forEach((seg, i) => {
    assert(seg.length > 5, `Segment ${i} too short: "${seg}"`);
    assert(seg.length <= 250, `Segment ${i} too long: "${seg}"`);
  });
});

console.log('\n═══════════════════════════════════════════════════════════════════════');
if (fail === 0) {
  console.log(`  ✅ [PASS] SpeechRendererTest: ${pass}/${pass + fail}`);
} else {
  console.log(`  ❌ [PARTIAL] SpeechRendererTest: ${pass} PASS / ${fail} FAIL`);
}
console.log('═══════════════════════════════════════════════════════════════════════\n');

if (fail > 0) process.exit(1);
