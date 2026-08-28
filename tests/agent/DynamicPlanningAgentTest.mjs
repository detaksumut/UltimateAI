/**
 * DynamicPlanningAgentTest.mjs
 * Behavioral test for Phase 4B Dynamic DAG Planning without hardcoded templates.
 */

import { AgentPlanner } from '../../server/agent/AgentPlanner.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: DynamicPlanningAgentTest — Dynamic DAG Plan Generation');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Plan with toolsNeeded = ['web.fetch', 'doc.analyze']
  try {
    const semantic = {
      intent: 'URL_INSPECTION',
      goal: 'Buka https://example.com dan analisis dokumennya',
      toolsNeeded: ['web.fetch', 'doc.analyze'],
      constraints: []
    };

    const plan = await AgentPlanner.planGoal(semantic.goal, { semanticDecision: semantic });
    assert.ok(plan.steps && plan.steps.length >= 2, 'Should have at least 2 steps');
    assert.strictEqual(plan.steps[0].tool, 'web.fetch');
    assert.strictEqual(plan.steps[1].tool, 'doc.analyze');
    assert.ok(plan.steps[1].dependsOn.includes(plan.steps[0].id), 'Step 2 should depend on Step 1');
    console.log(`  ✓ [PASS] Dynamic DAG plan generated with 2 sequential dependent steps (S1: ${plan.steps[0].tool} ➔ S2: ${plan.steps[1].tool})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Multi-step DAG: ${err.message}`);
  }

  // Test 2: Conversational goal produces direct conversation step (0 external tools)
  try {
    const semantic = {
      intent: 'CASUAL_CHAT',
      goal: 'Halo JIN, apa kabar?',
      actionRequired: false,
      toolsNeeded: []
    };

    const plan = await AgentPlanner.planGoal(semantic.goal, { semanticDecision: semantic });
    assert.strictEqual(plan.category, 'CONVERSATION');
    assert.strictEqual(plan.steps[0].tool, null, 'No external tool for conversational goal');
    console.log('  ✓ [PASS] Casual conversation produces direct reasoning step without external tools');
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Casual chat plan: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/2 Tests Passed.\n`);
  if (passed < 2) process.exit(1);
}

runTests();
