/**
 * AutonomousTaskLifecycleTest.mjs
 * Behavioral test for full autonomous task lifecycle with timeline recording and active memory snapshot.
 */

import { AgentRuntime } from '../../server/agent/AgentRuntime.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: AutonomousTaskLifecycleTest — Full Lifecycle & Timeline Audit');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;
  const runtime = new AgentRuntime();

  // Test 1: Full end-to-end task execution and timeline capture
  try {
    const goal = 'Hitung rata-rata angka berikut dalam sandbox Python: 50, 75, 125, 150.';
    const result = await runtime.runGoal(goal, {}, { failClosed: false });

    assert.strictEqual(result.success, true, 'Task execution must succeed');
    assert.ok(result.timeline && result.timeline.length > 0, 'Timeline must be recorded');
    assert.ok(result.provenance?.selectedPool, 'Pool must be recorded in provenance');
    assert.ok(result.provenance?.semanticModel, 'Model must be recorded in provenance');
    console.log(`  ✓ [PASS] Full lifecycle completed (Timeline events: ${result.timeline.length}, Model: ${result.provenance.semanticModel}, Pool: ${result.provenance.selectedPool})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Task lifecycle: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/1 Tests Passed.\n`);
  if (passed < 1) process.exit(1);
}

runTests();
