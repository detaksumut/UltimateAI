/**
 * RoutingPerformanceLearningTest.mjs
 * Behavioral test for aggregated runtime telemetry learning and weight calibration without manipulating scores.
 */

import { routingOptimizerInstance } from '../../server/routing/RoutingOptimizer.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: RoutingPerformanceLearningTest — Runtime Performance Learning');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Record outcomes and verify telemetry aggregation
  try {
    routingOptimizerInstance.recordTaskOutcome({
      engine: 'gemini-3.6-flash-high',
      taskCategory: 'RESEARCH_DATA',
      latencyMs: 650,
      success: true,
      verified: true
    });

    const stats = routingOptimizerInstance.getPerformanceStats();
    assert.ok(stats['gemini-3.6-flash-high'], 'Stats should contain recorded engine');
    assert.ok(stats['gemini-3.6-flash-high'].totalTasks > 0);
    assert.strictEqual(stats['gemini-3.6-flash-high'].successRate, '1.00');
    console.log(`  ✓ [PASS] Performance telemetry recorded (Tasks: ${stats['gemini-3.6-flash-high'].totalTasks}, SuccessRate: ${stats['gemini-3.6-flash-high'].successRate})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Performance recording: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/1 Tests Passed.\n`);
  if (passed < 1) process.exit(1);
}

runTests();
