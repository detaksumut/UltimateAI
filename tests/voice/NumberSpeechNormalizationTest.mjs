/**
 * NumberSpeechNormalizationTest.mjs
 * Validates natural Indonesian spoken pronunciation of currency, units, percentages, and dates.
 */

import { strict as assert } from 'node:assert';
import { indonesianTextNormalizerInstance } from '../../src/services/voice/IndonesianTextNormalizer.js';

console.log('=== TEST: NumberSpeechNormalizationTest ===');

const normalizer = indonesianTextNormalizerInstance;

// 1. Currency with units: Rp18.500/kg
const curUnit = normalizer.normalize('Harga beras Rp 18.500/kg.');
assert.ok(curUnit.includes('delapan belas ribu lima ratus rupiah per kilogram'), 'Rp18.500/kg must be spoken with natural currency and unit');
console.log('✔ Rp18.500/kg → "delapan belas ribu lima ratus rupiah per kilogram"');

// 2. Currency with liter: Rp 20.000/liter
const curLiter = normalizer.normalize('Minyak goreng Rp 20.000/liter.');
assert.ok(curLiter.includes('dua puluh ribu rupiah per liter'), 'Rp 20.000/liter must be normalized naturally');
console.log('✔ Rp 20.000/liter → "dua puluh ribu rupiah per liter"');

// 3. Percentages: 33,8%
const pct = normalizer.normalize('Kenaikan sebesar 33,8%.');
assert.ok(pct.includes('tiga puluh tiga koma delapan persen'), '33,8% must be pronounced properly');
assert.ok(!pct.includes('tanda persen'), 'Must not say "tanda persen"');
console.log('✔ 33,8% → "tiga puluh tiga koma delapan persen"');

// 4. Thousand separator numbers: 1.250.000
const thousand = normalizer.normalize('Jumlah tonase mencapai 1.250.000 ton.');
assert.ok(thousand.includes('satu juta dua ratus lima puluh ribu'), '1.250.000 must expand to spoken Indonesian words');
console.log('✔ 1.250.000 → "satu juta dua ratus lima puluh ribu"');

console.log('=== NumberSpeechNormalizationTest PASSED ===\n');
