/**
 * MemoryClassificationTest.mjs
 * Behavioral test for Automatic Contextual Memory Classification & Tagging.
 */

import { MemoryClassifier, MEMORY_CATEGORIES, MEMORY_PRIORITIES } from '../../server/memory/MemoryClassifier.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: MemoryClassificationTest — Contextual Classification & Schemas');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Operating Rule auto-classified as OPERATIONAL_RULE & HIGH/CRITICAL priority
  try {
    const res = MemoryClassifier.classify({
      key: 'rule_internet',
      content: 'Dilarang keras melakukan pencarian internet tanpa izin operator.'
    });

    assert.strictEqual(res.category, MEMORY_CATEGORIES.OPERATIONAL_RULE);
    assert.strictEqual(res.priority, MEMORY_PRIORITIES.CRITICAL);
    assert.ok(res.tags.includes('operational_rule'));
    console.log(`  ✓ [PASS] Rule auto-classified: Category=${res.category}, Priority=${res.priority}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Rule classification: ${err.message}`);
  }

  // Test 2: Research Data auto-classified as RESEARCH_DATA
  try {
    const res = MemoryClassifier.classify({
      key: 'market_data',
      content: 'Laporan riset pasar kuartal 3 menunjukkan pertumbuhan 48% pada segmen SaaS.'
    });

    assert.strictEqual(res.category, MEMORY_CATEGORIES.RESEARCH_DATA);
    assert.strictEqual(res.priority, MEMORY_PRIORITIES.MEDIUM);
    console.log(`  ✓ [PASS] Research data auto-classified: Category=${res.category}, Priority=${res.priority}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Research classification: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/2 Tests Passed.\n`);
  if (passed < 2) process.exit(1);
}

runTests();
