/**
 * AutonomousExecutionDecisionTest.mjs
 * Behavioral test for autonomous self-execution decision without keyword mapping.
 */

import { semanticIntentEngineInstance } from '../../server/agent/SemanticIntentEngine.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: AutonomousExecutionDecisionTest — Dynamic Execution Decision');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Goal requiring computation selects sandbox.execute
  try {
    const decision = await semanticIntentEngineInstance.interpret(
      'Hitung rata-rata pertumbuhan pendapatan dari angka 12, 18, 25, dan 34 persen.'
    );

    assert.ok(decision.toolsNeeded.includes('sandbox.execute'), 'Should select sandbox.execute for calculation');
    console.log('  ✓ [PASS] Autonomously selected sandbox.execute for mathematical calculation');
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Execution decision: ${err.message}`);
  }

  // Test 2: Conversational goal does NOT select execution tools
  try {
    const decision = await semanticIntentEngineInstance.interpret(
      'Selamat pagi JIN, bagaimana kabarmu hari ini?'
    );

    assert.strictEqual(decision.actionRequired, false);
    assert.strictEqual(decision.toolsNeeded.length, 0);
    console.log('  ✓ [PASS] Conversational greeting requires zero execution tools');
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Chat non-execution: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/2 Tests Passed.\n`);
  if (passed < 2) process.exit(1);
}

runTests();
