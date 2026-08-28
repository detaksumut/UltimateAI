/**
 * DynamicReplanTest.mjs
 * Behavioral test for failure-aware bounded replanning and alternative recovery strategies.
 */

import { replanEngineInstance } from '../../server/agent/ReplanEngine.mjs';
import { AgentVerifier } from '../../server/agent/AgentVerifier.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: DynamicReplanTest — Bounded Failure-Aware Replanning');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Verifier flags network failure and triggers bounded replan
  try {
    const failedPlan = {
      goal: 'Ambil data laporan dari url mati',
      steps: [
        { id: 'S1', tool: 'web.fetch', params: { url: 'https://dead-server.invalid' } }
      ],
      evidenceContract: { minSteps: 1 }
    };

    const executionHistory = [
      {
        step: failedPlan.steps[0],
        observation: { valid: false, status: 'TIMEOUT', error: 'Connection refused' }
      }
    ];

    const verification = AgentVerifier.verifyGoalCompletion(failedPlan, executionHistory);
    assert.strictEqual(verification.isSatisfied, false);
    assert.strictEqual(verification.requiresReplan, true);

    const replanned = await replanEngineInstance.replan({
      failedPlan,
      executionHistory,
      attemptNumber: 1,
      failureReason: 'TIMEOUT'
    });

    assert.ok(replanned.steps.length > 0, 'Must produce recovery plan');
    console.log(`  ✓ [PASS] Failure diagnosed and recovery plan generated with ${replanned.steps.length} steps`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Dynamic replan: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/1 Tests Passed.\n`);
  if (passed < 1) process.exit(1);
}

runTests();
