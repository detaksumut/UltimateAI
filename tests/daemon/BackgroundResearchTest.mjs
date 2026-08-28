/**
 * BackgroundResearchTest.mjs
 * Behavioral test for registering sources and scheduled background intelligence monitoring.
 */

import { backgroundIntelligenceSchedulerInstance } from '../../server/daemon/BackgroundIntelligenceScheduler.mjs';
import { DOMAINS } from '../../server/knowledge/DomainOntologyAdapters.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: BackgroundResearchTest — Source Registration & Monitoring');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Register sources for background monitoring
  try {
    const src1 = backgroundIntelligenceSchedulerInstance.registerSource({
      id: 'src_sec_advisory',
      url: 'https://cve.mitre.org/data/downloads/allitems.html',
      domain: DOMAINS.SOFTWARE_CLOUD
    });

    assert.strictEqual(src1.id, 'src_sec_advisory');
    assert.strictEqual(src1.domain, DOMAINS.SOFTWARE_CLOUD);
    console.log(`  ✓ [PASS] Source registered for background intelligence monitoring (${src1.id})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Source registration: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/1 Tests Passed.\n`);
  if (passed < 1) process.exit(1);
}

runTests();
