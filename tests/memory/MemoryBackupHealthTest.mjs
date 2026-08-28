/**
 * MemoryBackupHealthTest.mjs
 * Behavioral test for Automated Snapshot Backup & Memory Core Health Diagnostics.
 */

import { memoryBackupServiceInstance } from '../../server/memory/MemoryBackupService.mjs';
import { memoryCoreHealthCheckInstance } from '../../server/memory/MemoryCoreHealthCheck.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: MemoryBackupHealthTest — Backup Snapshot & Health Diagnostics');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Perform automated snapshot backup
  try {
    const backupRes = memoryBackupServiceInstance.performBackup();
    assert.strictEqual(backupRes.success, true);
    assert.ok(backupRes.backupId.startsWith('bk_'));
    assert.ok(backupRes.filesCount >= 0);
    console.log(`  ✓ [PASS] Automated snapshot backup created (${backupRes.filesCount} files, ID: ${backupRes.backupId})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Backup creation: ${err.message}`);
  }

  // Test 2: Run comprehensive health check diagnostics
  try {
    const health = await memoryCoreHealthCheckInstance.runDiagnostics();
    assert.ok(['HEALTHY', 'DEGRADED'].includes(health.status));
    assert.strictEqual(health.checks.driveFAccessible, true);
    assert.strictEqual(health.checks.vaultAccessible, true);
    assert.strictEqual(health.checks.sqliteAccessible, true);
    console.log(`  ✓ [PASS] Comprehensive Health Check passed (Status: ${health.status}, Summary: ${health.summary})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Health check: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/2 Tests Passed.\n`);
  if (passed < 2) process.exit(1);
}

runTests();
