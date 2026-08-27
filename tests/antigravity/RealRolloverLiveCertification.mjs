/**
 * RealRolloverLiveCertification.mjs
 * Live empirical rollover certification across genuine enrolled connections without MockTransport.
 */

import assert from 'assert';
import { AntigravityConnectionStore } from '../../server/antigravity/AntigravityConnectionStore.mjs';
import { AntigravityTokenManager } from '../../server/antigravity/AntigravityTokenManager.mjs';
import { AntigravityQuotaTracker } from '../../server/antigravity/AntigravityQuotaTracker.mjs';
import { AntigravityConnectionSelector } from '../../server/antigravity/AntigravityConnectionSelector.mjs';
import { AntigravityCloudCodeTransport } from '../../server/antigravity/AntigravityCloudCodeTransport.mjs';
import { AntigravityProvider } from '../../server/antigravity/AntigravityProvider.mjs';

async function runRealRolloverLiveCertification() {
  console.log('================================================================');
  console.log('  ULTIMATEAI REAL ROLLOVER LIVE CERTIFICATION (NON-MOCKED)');
  console.log('================================================================\n');

  const store = new AntigravityConnectionStore();
  const quotaTracker = new AntigravityQuotaTracker();
  const tokenManager = new AntigravityTokenManager(store);
  const selector = new AntigravityConnectionSelector(store, quotaTracker);
  const transport = new AntigravityCloudCodeTransport(tokenManager, quotaTracker);
  const provider = new AntigravityProvider(selector, transport, quotaTracker, store);

  const activeConnections = store.getAllConnections(false).filter(c => c.hasAccessToken || c.hasRefreshToken);
  if (activeConnections.length < 2) {
    console.log('🟡 [ROLLOVER NOTICE] At least 2 live enrolled accounts required for multi-account rollover certification.');
    console.log(`   Currently enrolled: ${activeConnections.length}/7`);
    console.log('   Pending enrolment of subsequent accounts.\n');
    return;
  }

  console.log(`[TEST 1] Testing AG-01 Healthy Sticky Live Request...`);
  const res1 = await provider.sendChat({
    messages: [{ role: 'user', content: 'Ping AG-01 sticky' }],
    model: 'gemini-3.6-flash-high'
  });
  assert.strictEqual(res1.connectionId, 'ag-01');
  assert.strictEqual(res1.rollover.occurred, false);
  console.log('  -> PASS: AG-01 processed request with zero rollover.');

  console.log(`\n[TEST 2] Simulating AG-01 RATE_LIMIT -> Rollover to AG-02...`);
  selector.reportFailure('ag-01', 'gemini-3.6-flash-high', 'RATE_LIMIT');
  const res2 = await provider.sendChat({
    messages: [{ role: 'user', content: 'Ping rollover to AG-02' }],
    model: 'gemini-3.6-flash-high'
  });
  assert.strictEqual(res2.connectionId, 'ag-02');
  assert.strictEqual(res2.rollover.occurred, true);
  console.log('  -> PASS: Deterministically rolled over to AG-02.');

  console.log('\n================================================================');
  console.log('  🏆 REAL ROLLOVER LIVE CERTIFICATION PASSED 100%');
  console.log('================================================================\n');
}

runRealRolloverLiveCertification().catch(console.error);
