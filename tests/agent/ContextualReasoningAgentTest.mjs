/**
 * ContextualReasoningAgentTest.mjs
 * Behavioral test for Phase 4B Contextual Reasoning across multi-turn dialogs.
 */

import { semanticIntentEngineInstance } from '../../server/agent/SemanticIntentEngine.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: ContextualReasoningAgentTest — Dynamic Multi-Turn Context Reasoning');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Derives goal from multi-turn dialog context
  try {
    const context = {
      recentTurns: [
        { role: 'user', content: 'Apakah kita bisa membahas proyek riset AI terbaru?' },
        { role: 'assistant', content: 'Tentu, saya siap menganalisis dokumen dan data proyek riset AI Anda.' }
      ]
    };

    const decision = await semanticIntentEngineInstance.interpret(
      'Analisis struktur dan temukan risiko terbesarnya.',
      context
    );

    assert.ok(decision.goal, 'Goal should be derived');
    assert.strictEqual(typeof decision.actionRequired, 'boolean', 'Action requirement should be boolean');
    console.log(`  ✓ [PASS] Multi-turn context analysis (Intent: ${decision.intent}, ActionRequired: ${decision.actionRequired})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Multi-turn context: ${err.message}`);
  }

  // Test 2: Real-time task control (pause/resume)
  try {
    const pauseDecision = await semanticIntentEngineInstance.interpret('Tunggu dulu sebentar');
    assert.strictEqual(pauseDecision.intent, 'TASK_CONTROL');
    assert.strictEqual(pauseDecision.taskControlAction, 'PAUSE');
    console.log('  ✓ [PASS] Real-time task pause control recognized dynamically');
    passed++;

    const resumeDecision = await semanticIntentEngineInstance.interpret('Lanjutkan');
    assert.strictEqual(resumeDecision.intent, 'TASK_CONTROL');
    assert.strictEqual(resumeDecision.taskControlAction, 'RESUME');
    console.log('  ✓ [PASS] Real-time task resume control recognized dynamically');
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Task control: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/3 Tests Passed.\n`);
  if (passed < 3) process.exit(1);
}

runTests();
