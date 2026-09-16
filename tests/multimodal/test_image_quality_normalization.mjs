/**
 * test_image_quality_normalization.mjs
 * Deterministic unit test covering:
 * - low, medium, high, hd
 * - current invalid/internal numeric values (e.g. 80, 50, 95)
 * - undefined, null, default fallback
 * - case normalization (e.g. "HIGH", "Hd", " MEDIUM ")
 * - prompt de-duplication
 */

import assert from 'assert';
import { imageGenerationInstance } from '../../server/agent/ImageGeneration.mjs';

function runTests() {
  console.log('=== Running Pollinations Quality Normalization Tests ===');

  const ig = imageGenerationInstance;

  // 1. Standard allowed values
  assert.strictEqual(ig.normalizePollinationsQuality('low'), 'low', 'low should return low');
  assert.strictEqual(ig.normalizePollinationsQuality('medium'), 'medium', 'medium should return medium');
  assert.strictEqual(ig.normalizePollinationsQuality('high'), 'high', 'high should return high');
  assert.strictEqual(ig.normalizePollinationsQuality('hd'), 'hd', 'hd should return hd');

  // 2. Case and whitespace normalization
  assert.strictEqual(ig.normalizePollinationsQuality('LOW'), 'low');
  assert.strictEqual(ig.normalizePollinationsQuality(' Medium '), 'medium');
  assert.strictEqual(ig.normalizePollinationsQuality('  HIGH  '), 'high');
  assert.strictEqual(ig.normalizePollinationsQuality('Hd'), 'hd');

  // 3. Aliases
  assert.strictEqual(ig.normalizePollinationsQuality('ultra'), 'hd');
  assert.strictEqual(ig.normalizePollinationsQuality('4k'), 'hd');
  assert.strictEqual(ig.normalizePollinationsQuality('standard'), 'medium');
  assert.strictEqual(ig.normalizePollinationsQuality('fast'), 'low');

  // 4. Numeric percentages (like the previously failing 80)
  assert.strictEqual(ig.normalizePollinationsQuality(80), 'high', 'Numeric 80 should map to high');
  assert.strictEqual(ig.normalizePollinationsQuality('80'), 'high', 'String "80" should map to high');
  assert.strictEqual(ig.normalizePollinationsQuality(95), 'hd', 'Numeric 95 should map to hd');
  assert.strictEqual(ig.normalizePollinationsQuality(50), 'medium', 'Numeric 50 should map to medium');
  assert.strictEqual(ig.normalizePollinationsQuality(20), 'low', 'Numeric 20 should map to low');

  // 5. Undefined, null, and empty fallbacks
  assert.strictEqual(ig.normalizePollinationsQuality(undefined), 'high', 'undefined should default to high');
  assert.strictEqual(ig.normalizePollinationsQuality(null), 'high', 'null should default to high');
  assert.strictEqual(ig.normalizePollinationsQuality(''), 'high', 'empty string should default to high');
  assert.strictEqual(ig.normalizePollinationsQuality('invalid_xyz'), 'high', 'unknown string should default to high');

  console.log('✅ All 5 quality normalization test groups passed!');

  // 6. Prompt de-duplication tests
  console.log('=== Running Prompt De-duplication Tests ===');

  const raw1 = 'Create a high-quality image of high-quality image of realistic high-resolution image of airplane flying over mountain';
  const norm1 = ig.normalizeImagePrompt(raw1);
  assert(
    !norm1.includes('high-quality image of high-quality image of'),
    `Prompt must not contain duplicated "high-quality image of": got "${norm1}"`
  );
  console.log(`Input : "${raw1}"`);
  console.log(`Result: "${norm1}"`);
  assert(norm1.includes('airplane flying over mountain'), 'Must preserve semantic subject');

  const raw2 = 'Buat gambar pesawat terbang melintasi gunung';
  const norm2 = ig._optimizePrompt(raw2);
  console.log(`Input : "${raw2}"`);
  console.log(`Result: "${norm2}"`);
  assert(norm2.includes('commercial airliner airplane') || norm2.includes('airplane'), 'Must enrich subject without duplication');

  console.log('✅ Prompt de-duplication tests passed!');
  console.log('=== ALL TESTS PASSED SUCCESSFULLY ===');
}

runTests();
