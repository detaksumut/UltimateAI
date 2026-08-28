/**
 * NoMockProductionTest.mjs
 * Audits production tool registry and providers to ensure 0 mock modules are active.
 */

import { toolRegistryInstance } from '../../server/tools/ToolRegistry.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: NoMockProductionTest — Zero Mock Modules in Production');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Verify all registered tools are genuine tools
  try {
    const tools = toolRegistryInstance.listTools();
    const mockTools = tools.filter(t => /mock|dummy|fake|synthetic|fixture/i.test(t.name));

    assert.strictEqual(mockTools.length, 0, 'No mock tools must exist in production registry');
    console.log(`  ✓ [PASS] Tool Registry verified: ${tools.length} active production tools, 0 mock tools`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Mock tool audit: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/1 Tests Passed.\n`);
  if (passed < 1) process.exit(1);
}

runTests();
