/**
 * MemoryTruthTest.mjs
 * Behavioral test asserting that querying non-existent memory returns empty results without fabricating facts.
 */

import { activeMemoryCoreInstance } from '../../server/memory/ActiveMemoryCore.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: MemoryTruthTest — Non-Fabricated Memory Authority');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Query for random non-existent secret fact returns empty array
  try {
    const results = activeMemoryCoreInstance.query({
      queryText: 'fakta_fiktif_yang_tidak_pernah_ada_987654321',
      limit: 5
    });

    assert.strictEqual(results.length, 0, 'Must return 0 records for non-existent memories');
    console.log('  ✓ [PASS] Querying absent memory returns 0 records (Zero fabricated memory entries)');
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Memory truth: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/1 Tests Passed.\n`);
  if (passed < 1) process.exit(1);
}

runTests();
