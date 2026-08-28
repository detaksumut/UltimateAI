/**
 * SandboxPythonExecutionTest.mjs
 * Behavioral test for isolated Python sandbox execution, timeout, and security.
 */

import { sandboxExecutionToolInstance } from '../../server/tools/SandboxExecutionTool.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: SandboxPythonExecutionTest — Isolated Python Runtime Sandbox');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Python mathematical data analysis
  try {
    const pyCode = `
import json
data = [12.5, 18.0, 25.5, 34.0]
avg = sum(data) / len(data)
growth = ((data[-1] - data[0]) / data[0]) * 100
print(json.dumps({"average": avg, "totalGrowthPct": round(growth, 2)}))
    `;

    const res = await sandboxExecutionToolInstance.execute({ code: pyCode, runtime: 'python' });
    assert.strictEqual(res.success, true);
    const parsed = JSON.parse(res.stdout);
    assert.strictEqual(parsed.average, 22.5);
    assert.strictEqual(parsed.totalGrowthPct, 172.0);
    console.log(`  ✓ [PASS] Python computation in sandbox executed successfully (Result: ${res.stdout}, ${res.durationMs}ms)`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Python computation: ${err.message}`);
  }

  // Test 2: Python timeout termination
  try {
    const timeoutCode = `
import time
while True:
    time.sleep(0.1)
    `;

    const res = await sandboxExecutionToolInstance.execute({ code: timeoutCode, runtime: 'python', timeoutMs: 1500 });
    assert.ok(res.timedOut || res.exitCode !== 0, 'Should terminate on timeout');
    console.log(`  ✓ [PASS] Python infinite loop terminated within timeout boundary (${res.durationMs}ms)`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Python timeout: ${err.message}`);
  }

  // Test 3: Zero secrets / environment leakage
  try {
    const leakCode = `
import os, json
print(json.dumps({
    "hasGeminiKey": bool(os.environ.get("GEMINI_API_KEY")),
    "hasVaultSecret": bool(os.environ.get("DEFAULT_ANTIGRAVITY_CLIENT_SECRET"))
}))
    `;

    const res = await sandboxExecutionToolInstance.execute({ code: leakCode, runtime: 'python' });
    const parsed = JSON.parse(res.stdout);
    assert.strictEqual(parsed.hasGeminiKey, false, 'Must not leak GEMINI_API_KEY');
    assert.strictEqual(parsed.hasVaultSecret, false, 'Must not leak Vault secrets');
    console.log('  ✓ [PASS] Python environment isolation verified (0 secrets accessible)');
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Python environment isolation: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/3 Tests Passed.\n`);
  if (passed < 3) process.exit(1);
}

runTests();
