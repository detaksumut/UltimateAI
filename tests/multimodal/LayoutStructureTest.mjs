/**
 * LayoutStructureTest.mjs
 * Behavioral test for multimodal layout parsing and tabular matrix extraction.
 */

import { DocumentLayoutAnalyzer } from '../../server/multimodal/DocumentLayoutAnalyzer.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: LayoutStructureTest — Structural Layout & Table Extraction');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Extract table matrix and structure
  try {
    const rawTableDoc = `
# Laporan Keuangan Kuartal
| Periode | Pendapatan (Miliar) | Laba Bersih | Pertumbuhan |
|---|---|---|---|
| Q1 2026 | 120.5 | 34.2 | +12% |
| Q2 2026 | 145.0 | 41.8 | +18% |
    `;

    const layout = DocumentLayoutAnalyzer.analyzeLayout(rawTableDoc, { fileType: 'FINANCIAL_REPORT' });

    assert.strictEqual(layout.tables.length, 1);
    assert.strictEqual(layout.tables[0].colCount, 4);
    assert.strictEqual(layout.tables[0].rowCount, 2);
    assert.deepStrictEqual(layout.tables[0].headers, ['Periode', 'Pendapatan (Miliar)', 'Laba Bersih', 'Pertumbuhan']);
    console.log(`  ✓ [PASS] Table extracted with ${layout.tables[0].colCount} columns and ${layout.tables[0].rowCount} data rows`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Table extraction: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/1 Tests Passed.\n`);
  if (passed < 1) process.exit(1);
}

runTests();
