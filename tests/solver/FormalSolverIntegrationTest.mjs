/**
 * FormalSolverIntegrationTest.mjs
 * Behavioral test for formal.solve tool integration and constraint solving.
 */

import { formalSolveToolInstance } from '../../server/tools/FormalSolveTool.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: FormalSolverIntegrationTest — formal.solve Tool Execution');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Constraint SAT solving
  try {
    const res = await formalSolveToolInstance.execute({
      mode: 'CONSTRAINT_SAT',
      constraints: ['x > 10', 'x < 50', 'y == 2 * x'],
      variables: { x: 20, y: 40 }
    });

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.satisfiable, true);
    assert.strictEqual(res.failedConstraints.length, 0);
    console.log(`  ✓ [PASS] Constraint satisfaction problem solved (Satisfiable: ${res.satisfiable}, Duration: ${res.durationMs}ms)`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Constraint solve: ${err.message}`);
  }

  // Test 2: Unsatisfiable constraint detection
  try {
    const res = await formalSolveToolInstance.execute({
      mode: 'CONSTRAINT_SAT',
      constraints: ['x > 100', 'x < 50'],
      variables: { x: 75 }
    });

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.satisfiable, false);
    assert.ok(res.failedConstraints.length > 0);
    console.log(`  ✓ [PASS] Unsatisfiable constraints detected (Failed: ${res.failedConstraints.join(', ')})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Unsatisfiable constraint: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/2 Tests Passed.\n`);
  if (passed < 2) process.exit(1);
}

runTests();
