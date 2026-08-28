/**
 * SandboxPowerShellExecutionTest.mjs
 * Behavioral test for isolated PowerShell sandbox execution.
 */

import { sandboxExecutionToolInstance } from '../../server/tools/SandboxExecutionTool.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: SandboxPowerShellExecutionTest — Isolated PowerShell Sandbox');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Safe PowerShell data transformation
  try {
    const psCode = `
      $data = @(10, 20, 30, 40, 50)
      $measure = $data | Measure-Object -Average -Sum
      @{
          Sum = $measure.Sum
          Average = $measure.Average
          Count = $measure.Count
      } | ConvertTo-Json -Compress
    `;

    const res = await sandboxExecutionToolInstance.execute({ code: psCode, runtime: 'powershell' });
    assert.strictEqual(res.success, true);
    const parsed = JSON.parse(res.stdout);
    assert.strictEqual(parsed.Sum, 150);
    assert.strictEqual(parsed.Average, 30);
    console.log(`  ✓ [PASS] PowerShell data transformation in sandbox (Result: ${res.stdout}, ${res.durationMs}ms)`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] PowerShell computation: ${err.message}`);
  }

  // Test 2: PowerShell environment isolation
  try {
    const leakCode = `
      @{
          hasOAuth = [bool]$env:DEFAULT_ANTIGRAVITY_CLIENT_SECRET
          hasApiKey = [bool]$env:GEMINI_API_KEY
      } | ConvertTo-Json -Compress
    `;

    const res = await sandboxExecutionToolInstance.execute({ code: leakCode, runtime: 'powershell' });
    const parsed = JSON.parse(res.stdout);
    assert.strictEqual(parsed.hasOAuth, false);
    assert.strictEqual(parsed.hasApiKey, false);
    console.log('  ✓ [PASS] PowerShell environment isolation verified (0 secrets accessible)');
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] PowerShell isolation: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/2 Tests Passed.\n`);
  if (passed < 2) process.exit(1);
}

runTests();
