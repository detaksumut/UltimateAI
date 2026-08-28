/**
 * ResearchToMemoryIntegrationTest.mjs
 * Behavioral test for piping verified research findings into Drive F Active Memory with provenance.
 */

import { KnowledgeGapDetector } from '../../server/agent/KnowledgeGapDetector.mjs';
import { activeMemoryCoreInstance } from '../../server/memory/ActiveMemoryCore.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: ResearchToMemoryIntegrationTest — Verified Research to Active Memory');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Ingest verified finding
  try {
    const finding = KnowledgeGapDetector.ingestVerifiedFinding({
      key: 'panos_cve_advisory',
      findingText: 'Palo Alto Networks merilis advisory CVE-2024-3400 dengan tingkat keparahan CRITICAL.',
      sourceUrl: 'https://security.paloaltonetworks.com/CVE-2024-3400',
      sourceTool: 'web.fetch',
      confidence: 0.98,
      category: 'RESEARCH_DATA',
      priority: 'HIGH'
    });

    assert.ok(finding.id.startsWith('mem_'), 'Must have memory ID');
    assert.strictEqual(finding.category, 'RESEARCH_DATA');
    assert.strictEqual(finding.priority, 'HIGH');
    assert.strictEqual(finding.source.sourceUrl, 'https://security.paloaltonetworks.com/CVE-2024-3400');
    console.log(`  ✓ [PASS] Verified research finding ingested to Drive F Memory (ID: ${finding.id})`);
    passed++;

    // Test 2: Retrieve newly ingested finding semantically
    const queryRes = activeMemoryCoreInstance.query({ queryText: 'CVE-2024-3400 Palo Alto', limit: 1 });
    assert.ok(queryRes.length > 0, 'Must retrieve stored research finding');
    assert.strictEqual(queryRes[0].memoryId || queryRes[0].id, finding.id);
    console.log(`  ✓ [PASS] Semantically retrieved finding from Drive F SQLite Index (Rank Score: ${queryRes[0].rankingScore?.toFixed(2) || 'OK'})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Research to memory integration: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/2 Tests Passed.\n`);
  if (passed < 2) process.exit(1);
}

runTests();
