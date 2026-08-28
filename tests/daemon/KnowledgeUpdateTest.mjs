/**
 * KnowledgeUpdateTest.mjs
 * Behavioral test for diff detection, change classification, and incremental knowledge update without re-ingesting duplicates.
 */

import { backgroundIntelligenceSchedulerInstance } from '../../server/daemon/BackgroundIntelligenceScheduler.mjs';
import { DOMAINS } from '../../server/knowledge/DomainOntologyAdapters.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: KnowledgeUpdateTest — Diff Detection & Incremental Update');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Ingest first version of content
  try {
    backgroundIntelligenceSchedulerInstance.registerSource({
      id: 'src_regulatory_bi',
      url: 'https://bi.go.id/peraturan/pbi_2026.html',
      domain: DOMAINS.LAW_REGULATION
    });

    const v1 = backgroundIntelligenceSchedulerInstance.processSourceContent(
      'src_regulatory_bi',
      'PBI No. 28/2026 menetapkan ketentuan baru giro wajib minimum sebesar 7.5%.'
    );

    assert.strictEqual(v1.hasChanged, true);
    assert.strictEqual(v1.isFirstTime, true);
    console.log(`  ✓ [PASS] Initial content ingested and registered as new claim (ID: ${v1.claimId})`);
    passed++;

    // Test 2: Unchanged content causes NO-OP without duplicate creation
    const v2 = backgroundIntelligenceSchedulerInstance.processSourceContent(
      'src_regulatory_bi',
      'PBI No. 28/2026 menetapkan ketentuan baru giro wajib minimum sebesar 7.5%.'
    );

    assert.strictEqual(v2.hasChanged, false);
    assert.strictEqual(v2.status, 'UNCHANGED');
    console.log('  ✓ [PASS] Identical content detected as UNCHANGED (0 duplicate claims created)');
    passed++;

    // Test 3: Modified content triggers diff update
    const v3 = backgroundIntelligenceSchedulerInstance.processSourceContent(
      'src_regulatory_bi',
      'PBI No. 28/2026 direvisi menetapkan ketentuan baru giro wajib minimum sebesar 8.0%.'
    );

    assert.strictEqual(v3.hasChanged, true);
    assert.strictEqual(v3.status, 'UPDATED');
    console.log(`  ✓ [PASS] Modified content diff detected and updated incrementally (New Claim: ${v3.claimId})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Knowledge update diff: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/3 Tests Passed.\n`);
  if (passed < 3) process.exit(1);
}

runTests();
