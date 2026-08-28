/**
 * DiagramUnderstandingTest.mjs
 * Behavioral test for system architecture diagrams, schematics, and spatial relationship extraction.
 */

import { DocumentLayoutAnalyzer } from '../../server/multimodal/DocumentLayoutAnalyzer.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: DiagramUnderstandingTest — Architecture Diagram & Spatial Parsing');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Extract topology diagram
  try {
    const rawDiagDoc = 'Diagram arsitektur microservices dan koneksi service flow.';
    const layout = DocumentLayoutAnalyzer.analyzeLayout(rawDiagDoc);

    assert.strictEqual(layout.diagrams.length, 1);
    assert.ok(layout.diagrams[0].nodes.length >= 3);
    assert.ok(layout.diagrams[0].connections.length >= 2);
    console.log(`  ✓ [PASS] Architecture diagram parsed (${layout.diagrams[0].nodes.length} nodes, ${layout.diagrams[0].connections.length} connections)`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Diagram parsing: ${err.message}`);
  }

  // Test 2: Spatial relation evaluation
  try {
    const entA = { spatialBounds: { region: 'BODY_CENTER' } };
    const entB = { spatialBounds: { region: 'BODY_CENTER' } };
    const rel = DocumentLayoutAnalyzer.evaluateSpatialRelationship(entA, entB);

    assert.strictEqual(rel.relation, 'CO_LOCATED_IN_SAME_PANEL');
    console.log('  ✓ [PASS] Spatial co-location relationship verified');
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Spatial relationship: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/2 Tests Passed.\n`);
  if (passed < 2) process.exit(1);
}

runTests();
