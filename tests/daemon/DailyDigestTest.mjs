/**
 * DailyDigestTest.mjs
 * Behavioral test for Daily Intelligence Digest generation with multi-disciplinary sections.
 */

import { backgroundIntelligenceSchedulerInstance } from '../../server/daemon/BackgroundIntelligenceScheduler.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: DailyDigestTest — Daily Intelligence Briefing Generation');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Generate daily intelligence briefing
  try {
    const digest = backgroundIntelligenceSchedulerInstance.generateDailyDigest({ operatorName: 'Rahman' });

    assert.ok(digest.digestId.startsWith('digest_'));
    assert.strictEqual(digest.preparedFor, 'Rahman');
    assert.ok(digest.sections.IMPORTANT_CHANGES.length > 0);
    assert.ok(digest.sections.REGULATORY_UPDATES.length > 0);
    assert.ok(digest.sections.RECOMMENDED_ACTIONS.length > 0);
    console.log(`  ✓ [PASS] Daily Intelligence Briefing generated (ID: ${digest.digestId}, Sections: ${Object.keys(digest.sections).length})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Daily digest: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/1 Tests Passed.\n`);
  if (passed < 1) process.exit(1);
}

runTests();
