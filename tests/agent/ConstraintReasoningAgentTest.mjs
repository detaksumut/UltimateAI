/**
 * ConstraintReasoningAgentTest.mjs
 * Behavioral test for Phase 4B Negative & Positive Constraints Enforcement.
 */

import { semanticIntentEngineInstance } from '../../server/agent/SemanticIntentEngine.mjs';
import { AgentPlanner } from '../../server/agent/AgentPlanner.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: ConstraintReasoningAgentTest — Dynamic Constraint Reasoning');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Negative constraint "Jangan pakai internet" prevents web tools
  try {
    const decision = await semanticIntentEngineInstance.interpret(
      'Buat keputusan tentang analisis ini, tetapi jangan gunakan internet lagi.'
    );

    assert.ok(decision.constraints.some(c => /no_internet|jangan.*internet/i.test(c)), 'Should record NO_INTERNET constraint');
    assert.ok(!decision.toolsNeeded.includes('web.search') && !decision.toolsNeeded.includes('web.fetch'), 'Should not request web tools');
    console.log('  ✓ [PASS] Semantic intent strictly enforces "jangan gunakan internet" constraint');
    passed++;

    // Planner also strictly obeys constraint
    const plan = await AgentPlanner.planGoal('Buat keputusan', { semanticDecision: decision });
    const hasWebTool = plan.steps.some(s => s.tool === 'web.search' || s.tool === 'web.fetch');
    assert.ok(!hasWebTool, 'Planner should not include web tools when constrained');
    console.log('  ✓ [PASS] AgentPlanner generated plan with 0 web tools adhering to constraint');
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Negative constraint: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/2 Tests Passed.\n`);
  if (passed < 2) process.exit(1);
}

runTests();
