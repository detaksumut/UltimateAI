/**
 * StructuredMemoryAgentTest.mjs
 * Behavioral test for Phase 4C Structured Knowledge Graph & Semantic Memory.
 */

import { MemoryGraph } from '../../server/memory/MemoryGraph.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: StructuredMemoryAgentTest — Entity-Relation Knowledge Graph');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;
  const graph = new MemoryGraph();

  // Test 1: Add structured entities and relations
  try {
    const org = graph.addEntity({
      type: 'Organization',
      name: 'Bank Indonesia',
      attributes: { sector: 'Central Banking', country: 'ID' }
    });

    const project = graph.addEntity({
      type: 'Project',
      name: 'Rupiah Digital',
      attributes: { stage: 'Proof of Concept' }
    });

    const rel = graph.addRelation({
      sourceId: org.id,
      targetId: project.id,
      relationType: 'related_to',
      metadata: { role: 'Lead Regulator' }
    });

    assert.strictEqual(org.type, 'Organization');
    assert.strictEqual(project.type, 'Project');
    assert.strictEqual(rel.relationType, 'related_to');
    console.log(`  ✓ [PASS] Structured entities & relation created (${org.name} ➔ ${rel.relationType} ➔ ${project.name})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Entity relation creation: ${err.message}`);
  }

  // Test 2: Record fact with provenance
  try {
    const fact = graph.recordFact({
      entityId: 'ent_jin_core',
      claim: 'JIN Core v4.0 supports isolated Playwright browser fetching',
      evidence: 'Phase 4 Architectural Blueprint',
      source: 'blueprint_doc.md',
      confidence: 1.0
    });

    assert.ok(fact.id.startsWith('fact_'));
    assert.strictEqual(fact.confidence, 1.0);
    console.log(`  ✓ [PASS] Verified fact recorded with provenance (ID: ${fact.id})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Fact recording: ${err.message}`);
  }

  // Test 3: Semantic retrieval returns relevant subgraph
  try {
    const queryResult = graph.queryRelevantGraph('Bank Indonesia', { maxEntities: 3 });
    assert.ok(queryResult.entities.some(e => e.name === 'Bank Indonesia'), 'Should retrieve Bank Indonesia');
    assert.ok(queryResult.relations.length > 0, 'Should include connected relations');
    console.log(`  ✓ [PASS] Semantic graph query retrieves relevant entities & relations (${queryResult.summary})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Semantic graph query: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/3 Tests Passed.\n`);
  if (passed < 3) process.exit(1);
}

runTests();
