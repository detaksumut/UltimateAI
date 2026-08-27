/**
 * SingleAccountLiveTest.mjs
 * Live Empirical Probe for Single Account AG-01 via Antigravity Cloud Code Transport.
 * Strictly OAuth-Only (Zero fallback to GEMINI_API_KEY).
 * Fail-Closed: If Control Plane Onboarding fails, halts immediately.
 */

import { AntigravityCloudCodeTransport } from '../../server/antigravity/AntigravityCloudCodeTransport.mjs';
import { AntigravityConnectionStore } from '../../server/antigravity/AntigravityConnectionStore.mjs';

async function runSingleAccountLiveTest() {
  console.log('================================================================');
  console.log('  ULTIMATEAI SINGLE ACCOUNT AG-01 EMPIRICAL LIVE PROBE');
  console.log('================================================================\n');

  const store = new AntigravityConnectionStore();
  const connections = store.getAllConnections(false);
  const ag01 = connections.find(c => c.id === 'ag-01' || c.connectionId === 'ag-01');

  if (!ag01 || !ag01.accessToken) {
    console.log('🟡 [LIVE PROBE PENDING] AG-01 OAuth access token not enrolled in vault.');
    console.log('   Status: Awaiting live OAuth token in storage/antigravity_connections.json');
    console.log('   Strict Contract: Zero fallback to GEMINI_API_KEY environment variables.');
    return;
  }

  const transport = new AntigravityCloudCodeTransport();

  console.log(`[PROBE 1] Testing AG-01 Control Plane Onboarding (/v1internal:loadCodeAssist)...`);
  let projectInfo = null;
  try {
    projectInfo = await transport.loadCodeAssist(ag01, ag01.accessToken);
    console.log(`  -> Onboarding SUCCESS:`);
    console.log(`     ProjectId:     ${projectInfo.projectId}`);
    console.log(`     Tier:          ${projectInfo.tier}`);
    console.log(`     ProjectSource: ${projectInfo.projectSource}`);
  } catch (err) {
    console.error(`  -> Onboarding FAILED: ${err.message}`);
    console.error(`\n❌ [TEST FAILED] Probe 1 failed. Halting live probe (Fail-Closed Enforcement).`);
    process.exit(1);
  }

  console.log(`\n[PROBE 2] Testing Native Upstream Inference via /v1internal:streamGenerateContent...`);
  try {
    const result = await transport.executeChat({
      connection: ag01,
      modelId: 'gemini-3.6-flash-high',
      messages: [{ role: 'user', content: 'Ping Antigravity Cloud Code Gateway' }],
      stream: false
    });

    console.log('  -> Execution SUCCESS:');
    console.log(`     Requested Model:     ${result.requestedModel}`);
    console.log(`     Actual Model:        ${result.actualModel}`);
    console.log(`     Actual Connection:   ${result.actualConnectionId}`);
    console.log(`     Upstream Endpoint:   ${result.upstreamEndpoint}`);
    console.log(`     Upstream ResponseId: ${result.upstreamResponseId || 'null'}`);
    console.log(`     Local RequestId:     ${result.requestId}`);
    console.log(`     Transport Class:     ${result.transportClass}`);

    console.log('\n================================================================');
    console.log('  🏆 AG-01 SINGLE ACCOUNT LIVE PROBE PASSED 100%');
    console.log('================================================================\n');
  } catch (err) {
    console.error(`  -> Inference FAILED: ${err.message}`);
    console.error(`\n❌ [TEST FAILED] Probe 2 failed.`);
    process.exit(1);
  }
}

runSingleAccountLiveTest().catch(console.error);
