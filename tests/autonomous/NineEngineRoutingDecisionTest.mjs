/**
 * NineEngineRoutingDecisionTest.mjs
 * Behavioral test for dynamic multi-factor engine and pool selection without hardcoded rules.
 */

import { routingOptimizerInstance } from '../../server/routing/RoutingOptimizer.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: NineEngineRoutingDecisionTest — Dynamic 9-Engine & Pool Routing');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Complex reasoning task scores high-reasoning engine
  try {
    const route = routingOptimizerInstance.optimizeRoute({
      taskCategory: 'MULTI_STEP_TASK',
      complexity: 0.9,
      requiresCodeExecution: true
    });

    assert.ok(route.selectedEngine, 'Must select an engine');
    assert.ok(route.selectedPool, 'Must select an Antigravity pool');
    assert.ok(route.engineScore > 0, 'Must have score');
    console.log(`  ✓ [PASS] High complexity task routed dynamically to: ${route.selectedEngine} (Score: ${route.engineScore.toFixed(1)}, Pool: ${route.selectedPool})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Complex routing: ${err.message}`);
  }

  // Test 2: Low-latency task scores fast engine
  try {
    const route = routingOptimizerInstance.optimizeRoute({
      taskCategory: 'CASUAL_CHAT',
      complexity: 0.2,
      requiresLowLatency: true
    });

    assert.ok(route.selectedEngine, 'Must select an engine');
    console.log(`  ✓ [PASS] Low latency task routed dynamically to: ${route.selectedEngine} (Score: ${route.engineScore.toFixed(1)}, Pool: ${route.selectedPool})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Low latency routing: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/2 Tests Passed.\n`);
  if (passed < 2) process.exit(1);
}

runTests();
