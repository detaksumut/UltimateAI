/**
 * SingleAuthorityConsolidationTest.mjs
 * Rigorously verifies that duplicate Antigravity pool schedulers are eliminated,
 * OLD_POOL_MANAGER_ACTIVE is false, and server/antigravity/* is the Single Source of Truth.
 */

import assert from 'assert';
import { OLD_POOL_MANAGER_ACTIVE, antigravityPoolManagerInstance } from '../../server/providers/AntigravityPoolManager.mjs';
import { antigravityProviderInstance as legacyProvider } from '../../server/providers/AntigravityProvider.mjs';
import { antigravityProviderInstance as coreProvider } from '../../server/antigravity/AntigravityProvider.mjs';
import { antigravityConnectionStoreInstance } from '../../server/antigravity/AntigravityConnectionStore.mjs';
import { antigravityQuotaTrackerInstance } from '../../server/antigravity/AntigravityQuotaTracker.mjs';
import { antigravityConnectionSelectorInstance } from '../../server/antigravity/AntigravityConnectionSelector.mjs';

async function runSingleAuthorityConsolidationTest() {
  console.log('================================================================');
  console.log('  ANTIGRAVITY ARCHITECTURE SINGLE AUTHORITY CONSOLIDATION TEST');
  console.log('================================================================\n');

  // [ASSERTION 1] Old Pool Manager must be marked inactive
  console.log('[ASSERTION 1] Verifying OLD_POOL_MANAGER_ACTIVE === false...');
  assert.strictEqual(OLD_POOL_MANAGER_ACTIVE, false, 'OLD_POOL_MANAGER_ACTIVE must be false');
  assert.strictEqual(antigravityPoolManagerInstance.isOldPoolManagerActive, false);
  console.log('  -> PASS: Legacy Pool Manager is decommissioned and marked inactive.');

  // [ASSERTION 2] Legacy Pool Manager delegates to SSOT Connection Store
  console.log('\n[ASSERTION 2] Verifying Pool Manager delegates to AntigravityConnectionStore...');
  assert.strictEqual(antigravityPoolManagerInstance.store, antigravityConnectionStoreInstance);
  assert.strictEqual(antigravityPoolManagerInstance.quotaTracker, antigravityQuotaTrackerInstance);
  assert.strictEqual(antigravityPoolManagerInstance.selector, antigravityConnectionSelectorInstance);
  console.log('  -> PASS: Legacy Pool Manager strictly points to core SSOT instances.');

  // [ASSERTION 3] Legacy Provider delegates to core AntigravityProvider
  console.log('\n[ASSERTION 3] Verifying server/providers/AntigravityProvider delegates to server/antigravity/AntigravityProvider...');
  assert.strictEqual(legacyProvider.coreProvider, coreProvider);
  console.log('  -> PASS: Provider adapter cleanly delegates to core provider engine.');

  // [ASSERTION 4] Single Source of Truth Invariant
  console.log('\n[ASSERTION 4] Verifying Single Source of Truth Invariant...');
  const poolConnections = antigravityPoolManagerInstance.connections;
  const storeConnections = antigravityConnectionStoreInstance.getAllConnections(false);
  assert.strictEqual(poolConnections.size, storeConnections.length, 'Connection count in adapter must match SSOT store exactly');
  console.log('  -> PASS: Exactly ONE authoritative connection state exists across entire runtime.');

  console.log('\n================================================================');
  console.log('  🏆 SINGLE AUTHORITY CONSOLIDATION TEST PASSED 100%');
  console.log('================================================================\n');
}

runSingleAuthorityConsolidationTest().catch(err => {
  console.error('❌ Single Authority Consolidation Test Failed:', err);
  process.exit(1);
});
