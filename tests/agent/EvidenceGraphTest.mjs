/**
 * EvidenceGraphTest.mjs
 * Behavioral test for Phase 4D Epistemic Evidence Graph.
 */

import { EvidenceGraph, VERIFICATION_STATES } from '../../server/agent/EvidenceGraph.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: EvidenceGraphTest — Claim-to-Evidence Tracking & Verification');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;
  const graph = new EvidenceGraph();

  // Test 1: Add verified claim with primary evidence
  try {
    const claim = graph.addClaim({
      claim: 'Pertumbuhan pendapatan Q3 meningkat 33.8%',
      evidence: 'Laporan Keuangan Q3 2026 halaman 14',
      source: 'financial_report_q3.pdf',
      confidence: 0.95
    });

    assert.strictEqual(claim.state, VERIFICATION_STATES.VERIFIED);
    console.log(`  ✓ [PASS] Grounded claim added with state: ${claim.state}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Grounded claim: ${err.message}`);
  }

  // Test 2: Add ungrounded claim (insufficient evidence)
  try {
    const ungrounded = graph.addClaim({
      claim: 'Biaya operasional turun 90%',
      evidence: null,
      confidence: 0.4
    });

    assert.ok(
      ungrounded.state === VERIFICATION_STATES.UNVERIFIED || ungrounded.state === VERIFICATION_STATES.INSUFFICIENT_EVIDENCE,
      'Ungrounded claim must not be verified'
    );
    console.log(`  ✓ [PASS] Ungrounded claim correctly classified as: ${ungrounded.state}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Ungrounded claim: ${err.message}`);
  }

  // Test 3: Audit summary calculation
  try {
    const audit = graph.getAuditSummary();
    assert.strictEqual(audit.totalClaims, 2);
    assert.strictEqual(audit.verifiedCount, 1);
    console.log(`  ✓ [PASS] Evidence audit summary (Verified: ${audit.verifiedCount}/${audit.totalClaims})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Audit summary: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/3 Tests Passed.\n`);
  if (passed < 3) process.exit(1);
}

runTests();
