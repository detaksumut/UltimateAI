/**
 * ContradictionDrivenReplanTest.mjs
 * Behavioral test for contradiction detection across multi-source evidence and uncertainty calibration.
 */

import { contradictionDetectorInstance } from '../../server/agent/ContradictionDetector.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: ContradictionDrivenReplanTest — Evidence Conflict Calibration');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Conflict detection elevates uncertainty and generates transparency report
  try {
    const conflictingData = [
      { source: 'Vendor Advisory 2026', claim: 'Patch keamanan sudah aktif dan aman digunakan.' },
      { source: 'Independent Security Lab', claim: 'Patch keamanan masih nonaktif dan rentan bypass.' }
    ];

    const report = contradictionDetectorInstance.detectContradictions(conflictingData);
    assert.strictEqual(report.hasContradiction, true);
    assert.strictEqual(report.calibratedUncertainty, 'HIGH');
    assert.ok(report.surfaceReport.includes('DIKOTOMI FAKTA TERDETEKSI'));
    console.log(`  ✓ [PASS] Contradiction detected, uncertainty calibrated to HIGH (${report.contradictions[0].conflictType})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Contradiction detection: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/1 Tests Passed.\n`);
  if (passed < 1) process.exit(1);
}

runTests();
