/**
 * ContradictionDetectionTest.mjs
 * Behavioral test for Phase 4D Multi-Source Contradiction Detection.
 */

import { ContradictionDetector } from '../../server/agent/ContradictionDetector.mjs';
import { EvidenceGraph } from '../../server/agent/EvidenceGraph.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: ContradictionDetectionTest — Multi-Source Conflict Detection');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;
  const detector = new ContradictionDetector(new EvidenceGraph());

  // Test 1: Factual negation contradiction (e.g. "berhasil" vs "gagal")
  try {
    const findings = [
      { source: 'Laporan A', claim: 'Migrasi database berhasil diselesaikan 100%' },
      { source: 'Laporan B', claim: 'Migrasi database gagal karena timeout koneksi' }
    ];

    const result = detector.detectContradictions(findings);
    assert.ok(result.hasContradiction, 'Should detect factual contradiction');
    assert.strictEqual(result.calibratedUncertainty, 'HIGH');
    assert.ok(result.surfaceReport && result.surfaceReport.includes('DIKOTOMI FAKTA TERDETEKSI'));
    console.log(`  ✓ [PASS] Factual negation detected & surfaced (Type: ${result.contradictions[0].conflictType})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Factual contradiction: ${err.message}`);
  }

  // Test 2: Numerical discrepancy contradiction (e.g. 15% vs 45%)
  try {
    const findings = [
      { source: 'BPS', claim: 'Inflasi tahunan tercatat 2.8%' },
      { source: 'Koran X', claim: 'Inflasi tahunan tercatat 6.4%' }
    ];

    const result = detector.detectContradictions(findings);
    assert.ok(result.hasContradiction, 'Should detect numerical contradiction');
    assert.strictEqual(result.contradictions[0].conflictType, 'NUMERICAL_DISCREPANCY');
    console.log(`  ✓ [PASS] Numerical discrepancy detected (BPS: 2.8% vs Koran X: 6.4%)`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Numerical contradiction: ${err.message}`);
  }

  // Test 3: Consistent non-conflicting findings
  try {
    const findings = [
      { source: 'Sumber 1', claim: 'Server dalam kondisi prima dan aktif' },
      { source: 'Sumber 2', claim: 'Sistem stabil dengan latency rendah' }
    ];

    const result = detector.detectContradictions(findings);
    assert.strictEqual(result.hasContradiction, false);
    assert.strictEqual(result.calibratedUncertainty, 'LOW');
    console.log('  ✓ [PASS] Consistent findings pass cleanly with LOW calibrated uncertainty');
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Consistent findings: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/3 Tests Passed.\n`);
  if (passed < 3) process.exit(1);
}

runTests();
