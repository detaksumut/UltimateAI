/**
 * ChartUnderstandingTest.mjs
 * Behavioral test for visual chart understanding, axes detection, and trend extraction.
 */

import { DocumentLayoutAnalyzer } from '../../server/multimodal/DocumentLayoutAnalyzer.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: ChartUnderstandingTest — Chart & Trend Understanding');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Extract chart trends and axes
  try {
    const rawChartDoc = 'Grafik penjualan dan trend pertumbuhan laba tahun 2026.';
    const layout = DocumentLayoutAnalyzer.analyzeLayout(rawChartDoc);

    assert.strictEqual(layout.charts.length, 1);
    assert.ok(layout.charts[0].detectedTrends.includes('POSITIVE_GROWTH'));
    assert.strictEqual(layout.charts[0].xAxis.label, 'Period / Category');
    console.log(`  ✓ [PASS] Visual chart structure recognized (Type: ${layout.charts[0].type}, Trend: ${layout.charts[0].detectedTrends.join(', ')})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Chart extraction: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/1 Tests Passed.\n`);
  if (passed < 1) process.exit(1);
}

runTests();
