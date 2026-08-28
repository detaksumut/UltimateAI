/**
 * ActiveMemoryCoreTest.mjs
 * Behavioral test for Central Autonomous Active Memory Core on Drive F:.
 */

import { activeMemoryCoreInstance } from '../../server/memory/ActiveMemoryCore.mjs';
import { MEMORY_CATEGORIES, MEMORY_PRIORITIES } from '../../server/memory/MemoryClassifier.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: ActiveMemoryCoreTest — Autonomous Active Memory Core on Drive F:');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Store memory with contextual classification
  try {
    const stored = activeMemoryCoreInstance.store({
      key: 'security_doctrine',
      content: 'Dilarang keras mengekspos token OAuth atau vault keys ke eksternal.',
      category: MEMORY_CATEGORIES.OPERATIONAL_RULE,
      priority: MEMORY_PRIORITIES.CRITICAL
    });

    assert.ok(stored.id.startsWith('mem_'), 'Should have standard ID format');
    assert.strictEqual(stored.priority, 'CRITICAL');
    assert.strictEqual(stored.category, 'OPERATIONAL_RULE');
    assert.strictEqual(stored.status, 'ACTIVE');
    console.log(`  ✓ [PASS] Standard memory stored & indexed on Drive F: (ID: ${stored.id}, Category: ${stored.category}, Priority: ${stored.priority})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Memory store: ${err.message}`);
  }

  // Test 2: Fast indexed query with multi-factor scoring
  try {
    const results = activeMemoryCoreInstance.query({
      queryText: 'token OAuth keamanan',
      limit: 3
    });

    assert.ok(results.length > 0, 'Should find matching memory');
    assert.ok(results[0].content.includes('OAuth'), 'Content must match');
    assert.ok(results[0].rankingScore > 0, 'Should compute ranking score');
    console.log(`  ✓ [PASS] Fast indexed query returned top ranked record (Score: ${results[0].rankingScore.toFixed(2)})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Indexed query: ${err.message}`);
  }

  // Test 3: Invalidation preserves provenance
  try {
    const testMem = activeMemoryCoreInstance.store({
      key: 'temp_fact',
      content: 'Protokol pengujian fase 3 sementara.',
      priority: 'LOW'
    });

    const invalidated = activeMemoryCoreInstance.invalidate(testMem.id, 'PHASE_3_COMPLETED');
    assert.strictEqual(invalidated.status, 'INVALIDATED');
    assert.strictEqual(invalidated.invalidationReason, 'PHASE_3_COMPLETED');

    // Query active records should exclude invalidated
    const activeQuery = activeMemoryCoreInstance.query({ queryText: 'pengujian fase 3', includeInactive: false });
    assert.strictEqual(activeQuery.some(m => m.id === testMem.id), false, 'Invalidated records must be excluded from normal query');
    console.log('  ✓ [PASS] Memory invalidation soft-deactivates and preserves audit trail');
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Invalidation: ${err.message}`);
  }

  // Test 4: Agent State Snapshot
  try {
    const snapshot = activeMemoryCoreInstance.snapshotActiveState({
      taskId: 'task_active_demo',
      goal: 'Verifikasi Active Memory Core',
      currentStep: 1,
      selectedModel: 'gemini-3.6-flash-high'
    });

    assert.strictEqual(snapshot.taskId, 'task_active_demo');
    assert.ok(!JSON.stringify(snapshot).includes('token') && !JSON.stringify(snapshot).includes('secret'), 'Must not contain secrets');
    console.log(`  ✓ [PASS] Safe active state snapshot persisted to Drive F: (Task: ${snapshot.taskId})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] State snapshot: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/4 Tests Passed.\n`);
  if (passed < 4) process.exit(1);
}

runTests();
