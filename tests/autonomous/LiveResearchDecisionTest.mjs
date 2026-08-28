/**
 * LiveResearchDecisionTest.mjs
 * Behavioral test for Knowledge Gap detection and autonomous live research triggers.
 */

import { KnowledgeGapDetector } from '../../server/agent/KnowledgeGapDetector.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: LiveResearchDecisionTest — Knowledge Gap & Research Strategy');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Explicit URL triggers direct URL inspection
  try {
    const analysis = KnowledgeGapDetector.analyzeGap('Periksa informasi di https://example.com/advisory');
    assert.strictEqual(analysis.hasGap, true);
    assert.strictEqual(analysis.strategy, 'DIRECT_URL_INSPECTION');
    assert.ok(analysis.recommendedTools.includes('web.fetch'));
    console.log(`  ✓ [PASS] Explicit URL mapped to DIRECT_URL_INSPECTION (Tool: ${analysis.recommendedTools.join(', ')})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Direct URL gap: ${err.message}`);
  }

  // Test 2: Fresh event query triggers live web research
  try {
    const analysis = KnowledgeGapDetector.analyzeGap('Cari berita terkini hari ini tentang kebijakan suku bunga BI.');
    assert.strictEqual(analysis.hasGap, true);
    assert.strictEqual(analysis.strategy, 'LIVE_WEB_RESEARCH');
    assert.ok(analysis.recommendedTools.includes('web.search'));
    console.log(`  ✓ [PASS] Freshness requirement mapped to LIVE_WEB_RESEARCH (Tool: ${analysis.recommendedTools.join(', ')})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Live search gap: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/2 Tests Passed.\n`);
  if (passed < 2) process.exit(1);
}

runTests();
