/**
 * ProvenanceIntegrityTest.mjs
 * Behavioral test for claim provenance, jurisdiction, confidence, and verificationState.
 */

import { domainKnowledgeGraphInstance } from '../../server/knowledge/DomainKnowledgeGraph.mjs';
import { DOMAINS } from '../../server/knowledge/DomainOntologyAdapters.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: ProvenanceIntegrityTest — Claim Provenance & Integrity');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Register claim with full provenance
  try {
    const claim = domainKnowledgeGraphInstance.registerClaim({
      claim: 'Uji klinis fase 3 menunjukkan efikasi molekul X sebesar 94.2% terhadap strain target.',
      domain: DOMAINS.MEDICAL_BIOMEDICAL,
      jurisdiction: 'GLOBAL',
      source: { name: 'Lancet Biomedical Study 2026', doi: '10.1016/S0140-6736' },
      confidence: 0.98,
      verificationState: 'VERIFIED'
    });

    assert.ok(claim.id.startsWith('clm_'));
    assert.strictEqual(claim.domain, DOMAINS.MEDICAL_BIOMEDICAL);
    assert.strictEqual(claim.verificationState, 'VERIFIED');
    assert.strictEqual(claim.confidence, 0.98);
    console.log(`  ✓ [PASS] Claim registered with full provenance (ID: ${claim.id}, Confidence: ${claim.confidence})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Claim registration: ${err.message}`);
  }

  // Test 2: Semantic retrieval by domain and keyword
  try {
    const query = domainKnowledgeGraphInstance.queryDomainKnowledge({
      queryText: 'uji klinis efikasi molekul',
      domain: DOMAINS.MEDICAL_BIOMEDICAL,
      limit: 1
    });

    assert.ok(query.length > 0);
    assert.ok(query[0].claim.includes('efikasi molekul X'));
    console.log('  ✓ [PASS] Claim retrieved semantically by domain filter');
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Semantic claim retrieval: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/2 Tests Passed.\n`);
  if (passed < 2) process.exit(1);
}

runTests();
