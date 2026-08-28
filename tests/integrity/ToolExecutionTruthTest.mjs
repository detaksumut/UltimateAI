/**
 * ToolExecutionTruthTest.mjs
 * Behavioral test asserting that unexecuted or failed tools never report fake success.
 */

import { AgentVerifier } from '../../server/agent/AgentVerifier.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: ToolExecutionTruthTest — Strict Tool Execution Truth');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Step with failed observation never reports goal satisfaction
  try {
    const plan = {
      goal: 'Ambil data',
      steps: [{ id: 'S1', tool: 'web.fetch' }],
      evidenceContract: { minSteps: 1 }
    };

    const history = [{
      step: plan.steps[0],
      stepResult: { success: false, error: 'ECONNREFUSED' },
      observation: { valid: false, status: 'NETWORK_ERROR', error: 'ECONNREFUSED' }
    }];

    const verification = AgentVerifier.verifyGoalCompletion(plan, history);
    assert.strictEqual(verification.isSatisfied, false);
    assert.strictEqual(verification.requiresReplan, true);
    console.log('  ✓ [PASS] Tool execution failure strictly recognized (Zero fake success reports)');
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Tool truth verification: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/1 Tests Passed.\n`);
  if (passed < 1) process.exit(1);
}

runTests();
