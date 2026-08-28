/**
 * ProductionStartupIntegrityTest.mjs
 * Behavioral test asserting verifyProductionIntegrity executes cleanly on startup.
 */

import { ProductionIntegrityAuditor } from '../../server/telemetry/ProductionIntegrityAuditor.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: ProductionStartupIntegrityTest — Startup Integrity Gate');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Startup integrity verification
  try {
    const res = ProductionIntegrityAuditor.verifyProductionIntegrity();
    assert.strictEqual(res.isCompliant, true);
    assert.strictEqual(res.status, 'PRODUCTION_VERIFIED_CLEAN');
    console.log('  ✓ [PASS] Production Startup Integrity Gate passed (Clean 0-Mock Status)');
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Startup integrity: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/1 Tests Passed.\n`);
  if (passed < 1) process.exit(1);
}

runTests();
