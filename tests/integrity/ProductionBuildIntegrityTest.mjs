/**
 * ProductionBuildIntegrityTest.mjs
 * Behavioral test validating that the production build gate passes without violations.
 */

import { ProductionIntegrityAuditor } from '../../server/telemetry/ProductionIntegrityAuditor.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: ProductionBuildIntegrityTest — Build Gate Compliance');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Production build gate audit
  try {
    const report = ProductionIntegrityAuditor.verifyProductionIntegrity();
    assert.strictEqual(report.violations.length, 0);
    assert.ok(report.rulesEnforced.includes('NO_MOCK_IN_PRODUCTION'));
    assert.ok(report.rulesEnforced.includes('UNKNOWN_FIRST_POLICY'));
    console.log(`  ✓ [PASS] Production Build Gate validated (0 violations, ${report.rulesEnforced.length} rules enforced)`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Build gate audit: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/1 Tests Passed.\n`);
  if (passed < 1) process.exit(1);
}

runTests();
