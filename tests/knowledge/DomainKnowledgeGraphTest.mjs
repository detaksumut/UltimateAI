/**
 * DomainKnowledgeGraphTest.mjs
 * Behavioral test for multi-disciplinary domain knowledge substrate & ontology adapters.
 */

import { domainKnowledgeGraphInstance } from '../../server/knowledge/DomainKnowledgeGraph.mjs';
import { DOMAINS } from '../../server/knowledge/DomainOntologyAdapters.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: DomainKnowledgeGraphTest — Multi-Domain Knowledge Substrate');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Add domain entities across disciplines
  try {
    const lawEnt = domainKnowledgeGraphInstance.addDomainEntity(DOMAINS.LAW_REGULATION, {
      regulation: 'UU ITE Revisi Kedua',
      jurisdiction: 'ID',
      article: 'Pasal 27A',
      effectiveDate: '2024-01-04'
    });

    const finEnt = domainKnowledgeGraphInstance.addDomainEntity(DOMAINS.FINANCE_QUANT, {
      asset: 'BBCA',
      metric: 'Price-to-Earnings Ratio',
      value: 22.4,
      period: '2026-Q2'
    });

    assert.strictEqual(lawEnt.domain, DOMAINS.LAW_REGULATION);
    assert.strictEqual(finEnt.domain, DOMAINS.FINANCE_QUANT);
    assert.strictEqual(finEnt.attributes.value, 22.4);
    console.log('  ✓ [PASS] Domain ontology entities created across Law and Finance disciplines');
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Domain entity creation: ${err.message}`);
  }

  // Test 2: Domain stats
  try {
    const stats = domainKnowledgeGraphInstance.getDomainStats();
    assert.ok(stats.totalEntities >= 2);
    assert.ok(stats.totalClaims >= 3);
    console.log(`  ✓ [PASS] Knowledge graph statistics verified (${stats.totalEntities} entities, ${stats.totalClaims} claims)`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Domain stats: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/2 Tests Passed.\n`);
  if (passed < 2) process.exit(1);
}

runTests();
