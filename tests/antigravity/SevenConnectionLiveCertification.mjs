/**
 * SevenConnectionLiveCertification.mjs
 * Iterates across all 7 enrolled connections (AG-01..AG-07) and executes non-mocked live probe for each.
 */

import { AntigravityConnectionStore } from '../../server/antigravity/AntigravityConnectionStore.mjs';
import { AntigravityTokenManager } from '../../server/antigravity/AntigravityTokenManager.mjs';
import { AntigravityCloudCodeTransport } from '../../server/antigravity/AntigravityCloudCodeTransport.mjs';

async function runSevenConnectionLiveCertification() {
  console.log('================================================================');
  console.log('  ULTIMATEAI 7-CONNECTION REAL LIVE CERTIFICATION');
  console.log('================================================================\n');

  const store = new AntigravityConnectionStore();
  const tokenManager = new AntigravityTokenManager(store);
  const transport = new AntigravityCloudCodeTransport(tokenManager);

  const targetIds = ['ag-01', 'ag-02', 'ag-03', 'ag-04', 'ag-05', 'ag-06', 'ag-07'];
  const results = [];

  for (const id of targetIds) {
    console.log(`[PROBING] ${id.toUpperCase()}...`);
    const conn = store.getConnection(id, true);

    if (!conn || (!conn.accessToken && !conn.refreshToken)) {
      console.log(`  -> 🟡 PENDING: ${id.toUpperCase()} not enrolled in vault.`);
      results.push({ id, status: 'PENDING' });
      continue;
    }

    try {
      const tokenResult = await tokenManager.ensureValidToken(conn);
      if (!tokenResult.valid) {
        console.error(`  -> ❌ FAILED: Token invalid for ${id}`);
        results.push({ id, status: 'AUTH_FAILED', error: tokenResult.error });
        continue;
      }

      const projectInfo = await transport.loadCodeAssist(conn, tokenResult.accessToken, { strictFreshProof: true });
      const chatRes = await transport.executeChat({
        connection: conn,
        modelId: 'gemini-3.6-flash-high',
        messages: [{ role: 'user', content: 'Ping from 7-pool verifier' }],
        stream: false,
        strictFreshProof: true
      });

      console.log(`  -> 🟢 LIVE VERIFIED: ${id.toUpperCase()} (Project: ${projectInfo.projectId}, RespLen: ${chatRes.content.length})`);
      results.push({ id, status: 'LIVE_VERIFIED', projectId: projectInfo.projectId });
    } catch (err) {
      console.error(`  -> ❌ FAILED: ${id.toUpperCase()} error: ${err.message}`);
      results.push({ id, status: 'FAILED', error: err.message });
    }
  }

  console.log('\n================================================================');
  console.log('  SUMMARY MATRIX:');
  console.table(results);

  const allPassed = results.length === 7 && results.every(r => r.status === 'LIVE_VERIFIED');
  if (allPassed) {
    console.log('🏆 SEVEN_CONNECTIONS_LIVE_VERIFIED 100%');
  } else {
    console.log('🟡 7-Connection verification incomplete (some connections pending enrolment).');
  }
  console.log('================================================================\n');
}

runSevenConnectionLiveCertification().catch(console.error);
