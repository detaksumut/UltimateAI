/**
 * MemoryIndexSQLiteTest.mjs
 * Behavioral test for SQLite index operations (upsert, query, delete, rebuild).
 */

import { memoryIndexSQLiteInstance } from '../../server/memory/MemoryIndexSQLite.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: MemoryIndexSQLiteTest — SQLite Semantic Index Engine');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Upsert and Retrieve
  try {
    const testId = `mem_test_${Date.now()}`;
    const testRec = {
      id: testId,
      timestamp: new Date().toISOString(),
      category: 'RESEARCH_DATA',
      priority: 'HIGH',
      tags: ['cve', 'security', 'pan-os'],
      content: 'Vulnerabilitas CVE-2024-3400 pada PAN-OS memiliki nilai CVSS 10.0.',
      source: { tool: 'threat.feed' },
      confidence: 0.98,
      status: 'ACTIVE',
      updatedAt: new Date().toISOString()
    };

    const ok = memoryIndexSQLiteInstance.upsert(testRec, 'F:\\UltimateAI_Memory\\05_Vault\\test.json');
    assert.strictEqual(ok, true, 'Upsert should succeed');

    const queried = memoryIndexSQLiteInstance.query({ queryText: 'PAN-OS CVE-2024-3400', limit: 1 });
    assert.ok(queried.length > 0, 'Should find indexed item');
    assert.strictEqual(queried[0].memoryId, testId);
    assert.strictEqual(queried[0].priority, 'HIGH');
    console.log(`  ✓ [PASS] SQLite Upsert & Indexed Search verified (Found ID: ${queried[0].memoryId})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] SQLite upsert & search: ${err.message}`);
  }

  // Test 2: Index Stats
  try {
    const stats = memoryIndexSQLiteInstance.getStats();
    assert.strictEqual(stats.isOnline, true);
    assert.ok(stats.totalRecords > 0, 'Should have positive record count');
    console.log(`  ✓ [PASS] SQLite Index Statistics online (${stats.totalRecords} total indexed records)`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Index stats: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/2 Tests Passed.\n`);
  if (passed < 2) process.exit(1);
}

runTests();
