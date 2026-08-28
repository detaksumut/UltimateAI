/**
 * CrossDomainReasoningTest.mjs
 * Behavioral test for connecting knowledge entities across disciplines (e.g. Law ➔ Finance ➔ Cloud Architecture).
 */

import { domainKnowledgeGraphInstance } from '../../server/knowledge/DomainKnowledgeGraph.mjs';
import { DOMAINS } from '../../server/knowledge/DomainOntologyAdapters.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: CrossDomainReasoningTest — Cross-Domain Entity Linking');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Cross-domain entity linkage (Law -> Finance -> Software Cloud)
  try {
    const lawEnt = domainKnowledgeGraphInstance.addDomainEntity(DOMAINS.LAW_REGULATION, {
      regulation: 'Regulasi Kedaulatan Data Lokal',
      jurisdiction: 'ID'
    });

    const finEnt = domainKnowledgeGraphInstance.addDomainEntity(DOMAINS.FINANCE_QUANT, {
      metric: 'Biaya Kepatuhan Cloud On-Premise',
      value: 150000000
    });

    const softEnt = domainKnowledgeGraphInstance.addDomainEntity(DOMAINS.SOFTWARE_CLOUD, {
      service: 'Drive F Air-Gapped Storage Architecture',
      protocol: 'LOCAL_REST_FS'
    });

    const rel1 = domainKnowledgeGraphInstance.linkRelationship(lawEnt.id, finEnt.id, 'impacts', { impactType: 'CAPEX_INCREASE' });
    const rel2 = domainKnowledgeGraphInstance.linkRelationship(finEnt.id, softEnt.id, 'requires', { requirement: 'LOCAL_AIRGAP_NODE' });

    assert.ok(rel1.id.startsWith('drel_'));
    assert.ok(rel2.id.startsWith('drel_'));
    console.log(`  ✓ [PASS] Cross-domain relations established: ${lawEnt.domain} ➔ ${finEnt.domain} ➔ ${softEnt.domain}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Cross-domain linking: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/1 Tests Passed.\n`);
  if (passed < 1) process.exit(1);
}

runTests();
