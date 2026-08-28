/**
 * SelfCorrectionAgentTest.mjs
 * Behavioral test for Phase 4D Autonomous Self-Correction & Bounded Replanning.
 */

import { replanEngineInstance } from '../../server/agent/ReplanEngine.mjs';
import { AgentVerifier } from '../../server/agent/AgentVerifier.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: SelfCorrectionAgentTest — Autonomous Replanning & Self-Correction');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Verifier detects failed step and demands replan
  try {
    const failedHistory = [
      {
        step: { id: 'S1', tool: 'web.fetch', params: { url: 'https://broken-link.invalid' } },
        observation: { valid: false, status: 'FAILED', error: 'DNS resolution failed' }
      }
    ];

    const currentPlan = {
      goal: 'Ambil berita dari broken link',
      steps: [{ id: 'S1', tool: 'web.fetch' }],
      evidenceContract: { minSteps: 1 }
    };

    const verification = AgentVerifier.verifyGoalCompletion(currentPlan, failedHistory);
    assert.strictEqual(verification.isSatisfied, false);
    assert.strictEqual(verification.requiresReplan, true);
    console.log(`  ✓ [PASS] Verifier flags failed step and mandates replan (Reason: ${verification.reason})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Verifier replan trigger: ${err.message}`);
  }

  // Test 2: Replanner generates alternative recovery step
  try {
    const currentPlan = {
      goal: 'Cari data inflasi 2026',
      steps: [
        { id: 'S1', tool: 'web.fetch', params: { url: 'https://site-down.com' } },
        { id: 'S2', tool: 'doc.analyze', dependsOn: ['S1'] }
      ],
      evidenceContract: { minSteps: 2 }
    };

    const history = [
      {
        step: currentPlan.steps[0],
        observation: { valid: false, status: 'HTTP_500_TIMEOUT' }
      }
    ];

    const replanned = await replanEngineInstance.replan({
      failedPlan: currentPlan,
      executionHistory: history,
      attemptNumber: 1,
      failureReason: 'HTTP_500_TIMEOUT'
    });

    assert.ok(replanned.steps.length > 0, 'Replanned DAG should contain recovery steps');
    console.log(`  ✓ [PASS] ReplanEngine generated alternative DAG with ${replanned.steps.length} recovery steps`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] ReplanEngine alternative DAG: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/2 Tests Passed.\n`);
  if (passed < 2) process.exit(1);
}

runTests();
