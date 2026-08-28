/**
 * ExactMathVerificationTest.mjs
 * Behavioral test for high-precision arbitrary arithmetic computation without LLM floating point hallucinations.
 */

import { formalSolveToolInstance } from '../../server/tools/FormalSolveTool.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: ExactMathVerificationTest — High-Precision CAS & Math Solver');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Exact compound interest / growth calculation
  try {
    const res = await formalSolveToolInstance.execute({
      mode: 'EXACT_ARITHMETIC',
      expression: 'P * (1 + r / n) ** (n * t)',
      variables: { P: 1000000, r: 0.08, n: 12, t: 5 }
    });

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.isVerified, true);
    assert.ok(Math.abs(res.exactResult - 1489845.71) < 1.0, 'Compound result must match exact math');
    console.log(`  ✓ [PASS] Exact compound formula calculated (Result: ${res.exactResult.toFixed(2)}, Duration: ${res.durationMs}ms)`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Exact math: ${err.message}`);
  }

  // Test 2: Exact mathematical division without floating point drift
  try {
    const res = await formalSolveToolInstance.execute({
      mode: 'EXACT_ARITHMETIC',
      expression: '355 / 113'
    });

    assert.strictEqual(res.status, 'SUCCESS');
    assert.ok(String(res.exactResult).startsWith('3.141592'), 'Must match pi rational approximation');
    console.log(`  ✓ [PASS] Precision division verified (Result: ${res.exactResult})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Precision division: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/2 Tests Passed.\n`);
  if (passed < 2) process.exit(1);
}

runTests();
