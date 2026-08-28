/**
 * MemoryConsistencyTest.mjs
 * Behavioral test for SQLite Index ↔ 05_Vault Disk consistency & repair.
 */

import { memoryIndexSQLiteInstance } from '../../server/memory/MemoryIndexSQLite.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: MemoryConsistencyTest — Index Consistency & Auto-Repair');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Verify Index against 05_Vault
  try {
    const verify = memoryIndexSQLiteInstance.verifyIndex('F:\\UltimateAI_Memory\\05_Vault');
    assert.strictEqual(typeof verify.isConsistent, 'boolean');
    console.log(`  ✓ [PASS] Consistency check executed (Disk Files: ${verify.totalDiskFiles}, Indexed: ${verify.totalIndexedRows}, Consistent: ${verify.isConsistent})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Consistency check: ${err.message}`);
  }

  // Test 2: Rebuild / Repair Index
  try {
    const repair = memoryIndexSQLiteInstance.repairIndex('F:\\UltimateAI_Memory\\05_Vault');
    assert.strictEqual(repair.success, true);
    assert.ok(repair.indexedCount >= 0);
    console.log(`  ✓ [PASS] Index rebuild/repair successfully synchronized (${repair.indexedCount} files reindexed)`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Repair index: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/2 Tests Passed.\n`);
  if (passed < 2) process.exit(1);
}

runTests();
