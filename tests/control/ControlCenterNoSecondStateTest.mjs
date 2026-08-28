import assert from 'assert';
import { runtimeObservabilityInstance } from '../../server/local_router/RuntimeObservabilityService.mjs';
import { antigravityConnectionStoreInstance } from '../../server/antigravity/AntigravityConnectionStore.mjs';
import { antigravityQuotaTrackerInstance } from '../../server/antigravity/AntigravityQuotaTracker.mjs';

console.log('========================================================================');
console.log('  TEST: ControlCenterNoSecondStateTest — Verifying No Secondary Store');
console.log('========================================================================\n');

async function testNoSecondState() {
  // 1. Verify runtimeObservabilityInstance does NOT hold an independent duplicate list of connections
  assert.strictEqual(runtimeObservabilityInstance.pools, undefined, 'Observability service must not store a private pools array');
  assert.strictEqual(runtimeObservabilityInstance.quotas, undefined, 'Observability service must not store a private quotas store');

  // 2. Modifying Connection in SSOT immediately reflects in getSnapshot()
  const conn1 = antigravityConnectionStoreInstance.getConnection('ag-01', false);
  const initialActive = conn1.isActive;

  // Toggle in SSOT
  conn1.isActive = !initialActive;
  antigravityConnectionStoreInstance.saveConnection(conn1);

  const snapshot1 = runtimeObservabilityInstance.getSnapshot();
  const pool1 = snapshot1.pools.find(p => p.id === 'ag-01');
  assert.strictEqual(pool1.isActive, !initialActive, 'Snapshot must dynamically reflect SSOT changes without caching');

  // Revert back
  conn1.isActive = initialActive;
  antigravityConnectionStoreInstance.saveConnection(conn1);

  const snapshot2 = runtimeObservabilityInstance.getSnapshot();
  const pool2 = snapshot2.pools.find(p => p.id === 'ag-01');
  assert.strictEqual(pool2.isActive, initialActive, 'Snapshot must dynamically reflect SSOT revert');

  console.log('[1] Dynamic SSOT Passthrough Validated: No Second State Store Exists');

  // 3. Quota changes in QuotaTracker immediately reflect in getSnapshot()
  antigravityQuotaTrackerInstance.recordUpstreamObserved('ag-01', 'gemini-3.6-flash-high', {
    remaining: 850,
    limit: 1000
  });

  const snapshot3 = runtimeObservabilityInstance.getSnapshot();
  const pool1Model = snapshot3.pools.find(p => p.id === 'ag-01').models.find(m => m.id === 'gemini-3.6-flash-high');
  assert.strictEqual(pool1Model.quota.remaining, 850, 'Snapshot must reflect QuotaTracker SSOT directly');
  assert.strictEqual(pool1Model.quota.source, 'UPSTREAM_OBSERVED', 'Snapshot quota source must match QuotaTracker SSOT');

  console.log('[2] Quota SSOT Passthrough Validated');

  console.log('\n========================================================================');
  console.log('  ✅ [PASS] ControlCenterNoSecondStateTest: 100% SUCCESS');
  console.log('========================================================================\n');
}

testNoSecondState().catch(err => {
  console.error('❌ [FAIL] ControlCenterNoSecondStateTest:', err);
  process.exit(1);
});
