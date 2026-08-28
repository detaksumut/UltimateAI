/**
 * HierarchicalPlannerTest.mjs
 * Behavioral test for hierarchical DAG decomposition (Goal -> Objectives -> Subgoals -> Tasks -> Actions).
 */

import { AgentPlanner } from '../../server/agent/AgentPlanner.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: HierarchicalPlannerTest — Multi-Level Goal Decomposition');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Complex goal decomposed into hierarchical objectives and sequential steps
  try {
    const semanticDecision = {
      intent: 'MULTI_STEP_TASK',
      goal: 'Buka https://example.com, ekstrak data finansial, lalu hitung rasio ROI di sandbox.',
      toolsNeeded: ['web.fetch', 'sandbox.execute'],
      constraints: []
    };

    const plan = await AgentPlanner.planGoal(semanticDecision.goal, { semanticDecision });

    assert.ok(plan.steps.length >= 2, 'Should generate at least 2 DAG steps');
    assert.ok(plan.hierarchicalObjectives && plan.hierarchicalObjectives.length > 0, 'Should have hierarchical objectives');
    assert.ok(plan.selectedEngine, 'Should have dynamic specialist engine assigned');
    assert.ok(plan.selectedPool, 'Should have Antigravity pool assigned');
    console.log(`  ✓ [PASS] Hierarchical Plan generated (Objectives: ${plan.hierarchicalObjectives.length}, Engine: ${plan.selectedEngine}, Pool: ${plan.selectedPool}, Steps: ${plan.steps.length})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Hierarchical planner: ${err.message}`);
  }

  // Test 2: Dependency chain verification
  try {
    const semanticDecision = {
      intent: 'URL_INSPECTION',
      goal: 'Buka http://localhost:5177/simulator dan analisis kontennya.',
      toolsNeeded: ['web.fetch', 'doc.analyze'],
      constraints: []
    };

    const plan = await AgentPlanner.planGoal(semanticDecision.goal, { semanticDecision });
    assert.strictEqual(plan.steps[0].tool, 'web.fetch');
    assert.strictEqual(plan.steps[1].tool, 'doc.analyze');
    assert.ok(plan.steps[1].dependsOn.includes(plan.steps[0].id), 'Step 2 must depend on Step 1');
    console.log(`  ✓ [PASS] Step dependencies correctly established (${plan.steps[0].id} ➔ ${plan.steps[1].id})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Dependency chain: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/2 Tests Passed.\n`);
  if (passed < 2) process.exit(1);
}

runTests();
