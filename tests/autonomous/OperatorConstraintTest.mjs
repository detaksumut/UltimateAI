/**
 * OperatorConstraintTest.mjs
 * Behavioral test for natural operator constraints ("Jangan jalankan script", "Jangan cari internet", "Tunggu", "Lanjutkan").
 */

import { semanticIntentEngineInstance } from '../../server/agent/SemanticIntentEngine.mjs';
import { AgentPlanner } from '../../server/agent/AgentPlanner.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: OperatorConstraintTest — Operator Natural Language Constraints');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Constraint "Jangan pakai internet" forbids web tools
  try {
    const decision = await semanticIntentEngineInstance.interpret(
      'Analisis dokumen keuangan ini tetapi jangan pakai internet sama sekali.'
    );

    assert.ok(decision.constraints.some(c => /no_internet|jangan.*internet/i.test(c)), 'Must detect NO_INTERNET constraint');
    assert.ok(!decision.toolsNeeded.includes('web.search') && !decision.toolsNeeded.includes('web.fetch'), 'Web tools must be excluded');
    console.log('  ✓ [PASS] Natural constraint "jangan pakai internet" strictly blocks web tools');
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Internet constraint: ${err.message}`);
  }

  // Test 2: Task control "Tunggu dulu"
  try {
    const pause = await semanticIntentEngineInstance.interpret('Tunggu dulu');
    assert.strictEqual(pause.intent, 'TASK_CONTROL');
    assert.strictEqual(pause.taskControlAction, 'PAUSE');
    console.log('  ✓ [PASS] Real-time pause constraint recognized dynamically');
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Pause constraint: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/2 Tests Passed.\n`);
  if (passed < 2) process.exit(1);
}

runTests();
