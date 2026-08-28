/**
 * SourceProvenanceIntegrityTest.mjs
 * Behavioral test verifying that claims carry authentic provenance metadata.
 */

import { domainKnowledgeGraphInstance } from '../../server/knowledge/DomainKnowledgeGraph.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: SourceProvenanceIntegrityTest — Authentic Source Provenance');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Verify recorded claim has valid source and timestamp
  try {
    const claim = domainKnowledgeGraphInstance.registerClaim({
      claim: 'Ketentuan batas emisi Euro 6 menetapkan limit NOx maksimal 80 mg/km.',
      domain: 'SCIENCE_ENGINEERING',
      source: 'European Emission Standard Directive',
      confidence: 1.0,
      verificationState: 'VERIFIED'
    });

    assert.ok(claim.retrievedAt);
    assert.ok(claim.source);
    assert.strictEqual(claim.verificationState, 'VERIFIED');
    console.log(`  ✓ [PASS] Authentic claim provenance verified (Domain: ${claim.domain}, Source: ${JSON.stringify(claim.source)})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Source provenance: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/1 Tests Passed.\n`);
  if (passed < 1) process.exit(1);
}

runTests();
