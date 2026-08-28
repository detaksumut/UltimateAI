/**
 * SandboxSafetyTest.mjs
 * Behavioral test for Phase 4E Safe Execution Sandbox.
 */

import { sandboxExecutionToolInstance } from '../../server/tools/SandboxExecutionTool.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: SandboxSafetyTest — Isolated Sandbox Safety & Governance');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Harmless computation execution
  try {
    const code = `
      const numbers = [10, 20, 30, 40, 50];
      const sum = numbers.reduce((a, b) => a + b, 0);
      const avg = sum / numbers.length;
      console.log(JSON.stringify({ sum, avg }));
    `;

    const result = await sandboxExecutionToolInstance.execute({ code, runtime: 'node' });
    assert.strictEqual(result.exitCode, 0);
    const parsed = JSON.parse(result.stdout);
    assert.strictEqual(parsed.sum, 150);
    assert.strictEqual(parsed.avg, 30);
    console.log(`  ✓ [PASS] Safe mathematical calculation in sandbox (Stdout: ${result.stdout}, Duration: ${result.durationMs}ms)`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Harmless computation: ${err.message}`);
  }

  // Test 2: Timeout enforcement on infinite loop
  try {
    const infiniteCode = `while(true) {}`;
    const result = await sandboxExecutionToolInstance.execute({ code: infiniteCode, timeoutMs: 1500 });
    assert.ok(result.timedOut || result.exitCode !== 0, 'Should enforce timeout on infinite loop');
    console.log(`  ✓ [PASS] Sandbox enforces strict timeout termination (Duration: ${result.durationMs}ms)`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Infinite loop timeout: ${err.message}`);
  }

  // Test 3: Zero environment secrets leakage
  try {
    const leakAttemptCode = `
      console.log(JSON.stringify({
        geminiKey: process.env.GEMINI_API_KEY || null,
        oauthSecret: process.env.DEFAULT_ANTIGRAVITY_CLIENT_SECRET || null
      }));
    `;

    const result = await sandboxExecutionToolInstance.execute({ code: leakAttemptCode, runtime: 'node' });
    const parsed = JSON.parse(result.stdout);
    assert.strictEqual(parsed.geminiKey, null, 'Sandbox must NOT leak GEMINI_API_KEY');
    assert.strictEqual(parsed.oauthSecret, null, 'Sandbox must NOT leak OAuth secrets');
    console.log('  ✓ [PASS] Subprocess environment isolation strictly verified (0 leaked secrets)');
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Environment isolation: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/3 Tests Passed.\n`);
  if (passed < 3) process.exit(1);
}

runTests();
