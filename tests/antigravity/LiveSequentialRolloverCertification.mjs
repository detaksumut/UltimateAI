import assert from 'assert';
import { antigravityProviderInstance } from '../../server/antigravity/AntigravityProvider.mjs';
import { antigravityConnectionSelectorInstance } from '../../server/antigravity/AntigravityConnectionSelector.mjs';
import { antigravityQuotaTrackerInstance } from '../../server/antigravity/AntigravityQuotaTracker.mjs';
import { antigravityConnectionStoreInstance } from '../../server/antigravity/AntigravityConnectionStore.mjs';

console.log('========================================================================');
console.log('  LIVE SEQUENTIAL ROLLOVER CERTIFICATION (AG-01 -> ... -> AG-07 -> AG-01)');
console.log('========================================================================\n');

async function runLiveRolloverChain() {
  const pools = ['ag-01', 'ag-02', 'ag-03', 'ag-04', 'ag-05', 'ag-06', 'ag-07'];
  
  // Clear any existing locks and ensure all are enrolled and active
  antigravityQuotaTrackerInstance.modelLocks.clear();
  for (const poolId of pools) {
    const conn = antigravityConnectionStoreInstance.getConnection(poolId, false);
    if (conn) {
      conn.testStatus = 'ENROLLED';
      conn.cooldownUntil = null;
      conn.isActive = true;
      antigravityConnectionStoreInstance.saveConnection(conn);
    }
  }

  // Start with sticky at ag-01
  antigravityConnectionSelectorInstance.currentStickyConnectionId = 'ag-01';
  console.log('Initial sticky connection:', antigravityConnectionSelectorInstance.currentStickyConnectionId);

  // 1. First execution on AG-01
  console.log(`\n--- Step 1: Live chat on initial pool AG-01 ---`);
  const res1 = await antigravityProviderInstance.sendChat({
    model: 'gemini-3.6-flash-high',
    messages: [{ role: 'user', content: 'Balas persis: LIVE-AG-01-ROLLOVER' }],
    stream: false
  });
  console.log(`  Selected Connection: ${res1.connectionId}`);
  console.log(`  Actual Connection:   ${res1.actualConnectionId}`);
  console.log(`  Content:             "${res1.content.trim()}"`);
  console.log(`  Upstream ResponseId: ${res1.upstreamResponseId}`);
  console.log(`  Rollover:            occurred=${res1.rollover.occurred}`);
  assert.strictEqual(res1.actualConnectionId, 'ag-01');

  // 2. Sequential Rollovers from AG-01 -> AG-02 -> ... -> AG-07
  for (let i = 0; i < pools.length - 1; i++) {
    const fromPool = pools[i];
    const toPool = pools[i + 1];

    console.log(`\n--- Rollover Step ${i + 2}: ${fromPool.toUpperCase()} (failed) -> ${toPool.toUpperCase()} (active) ---`);
    console.log(`  [SIMULATING 429 RATE_LIMIT ON ${fromPool.toUpperCase()}]`);
    antigravityQuotaTrackerInstance.lockModel(fromPool, 'gemini-3.6-flash-high', 'RATE_LIMIT', 60000);

    const prompt = `Balas persis: LIVE-${toPool.toUpperCase()}-ROLLOVER`;
    const res = await antigravityProviderInstance.sendChat({
      model: 'gemini-3.6-flash-high',
      messages: [{ role: 'user', content: prompt }],
      stream: false
    });

    console.log(`  Selected Connection: ${res.connectionId}`);
    console.log(`  Actual Connection:   ${res.actualConnectionId}`);
    console.log(`  Content:             "${res.content.trim()}"`);
    console.log(`  Upstream ResponseId: ${res.upstreamResponseId}`);
    console.log(`  Rollover details:    from=${res.rollover.previousConnectionId} to=${res.connectionId} reason=${res.rollover.reason}`);

    assert.strictEqual(res.connectionId, toPool, `Must rollover to ${toPool}`);
    assert.strictEqual(res.actualConnectionId, toPool, `Actual connection must be ${toPool}`);
    assert.strictEqual(res.rollover.occurred, true, 'Rollover must have occurred');
    assert.strictEqual(res.rollover.previousConnectionId, fromPool, `Rollover must be from ${fromPool}`);
  }

  // 3. Final Step: AG-07 -> AG-01 Cycle
  console.log(`\n--- Final Rollover Step: AG-07 (failed) -> AG-01 (recycled & active) ---`);
  console.log(`  [SIMULATING 429 RATE_LIMIT ON AG-07 AND UNLOCKING AG-01]`);
  antigravityQuotaTrackerInstance.lockModel('ag-07', 'gemini-3.6-flash-high', 'RATE_LIMIT', 60000);
  antigravityQuotaTrackerInstance.unlockModel('ag-01', 'gemini-3.6-flash-high');

  const finalRes = await antigravityProviderInstance.sendChat({
    model: 'gemini-3.6-flash-high',
    messages: [{ role: 'user', content: 'Balas persis: LIVE-AG-01-CYCLE' }],
    stream: false
  });

  console.log(`  Selected Connection: ${finalRes.connectionId}`);
  console.log(`  Actual Connection:   ${finalRes.actualConnectionId}`);
  console.log(`  Content:             "${finalRes.content.trim()}"`);
  console.log(`  Upstream ResponseId: ${finalRes.upstreamResponseId}`);
  console.log(`  Rollover details:    from=${finalRes.rollover.previousConnectionId} to=${finalRes.connectionId} reason=${finalRes.rollover.reason}`);

  assert.strictEqual(finalRes.actualConnectionId, 'ag-01', 'Must cycle back to ag-01');
  assert.strictEqual(finalRes.rollover.occurred, true, 'Rollover must have occurred');
  assert.strictEqual(finalRes.rollover.previousConnectionId, 'ag-07', 'Previous connection must be ag-07');

  // Clean up all locks after certification
  antigravityQuotaTrackerInstance.modelLocks.clear();
  antigravityConnectionSelectorInstance.currentStickyConnectionId = 'ag-01';

  console.log('\n========================================================================');
  console.log('  ✅ [PASS] LIVE SEQUENTIAL ROLLOVER CERTIFIED 100% ACROSS ALL 7 POOLS');
  console.log('========================================================================\n');
}

runLiveRolloverChain().catch(err => {
  console.error('❌ [FAIL] Live rollover certification failed:', err);
  process.exit(1);
});
