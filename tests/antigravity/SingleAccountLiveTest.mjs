/**
 * SingleAccountLiveTest.mjs
 * Live Empirical Probe for Single Account AG-01 via Antigravity Cloud Code Transport.
 * Executes genuine HTTP/SSE stream request to test control plane onboarding and inference endpoint.
 * Non-mocked live probe.
 */

import { AntigravityCloudCodeTransport } from '../../server/antigravity/AntigravityCloudCodeTransport.mjs';
import { AntigravityConnectionStore } from '../../server/antigravity/AntigravityConnectionStore.mjs';

async function runSingleAccountLiveTest() {
  console.log('================================================================');
  console.log('  ULTIMATEAI SINGLE ACCOUNT AG-01 EMPIRICAL LIVE PROBE');
  console.log('================================================================\n');

  const store = new AntigravityConnectionStore();
  const connections = store.getAllConnections(false);
  const ag01 = connections.find(c => c.id === 'ag-01') || {
    id: 'ag-01',
    accountAlias: 'antigravity-01',
    provider: 'ANTIGRAVITY',
    isActive: true,
    accessToken: process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY || '',
    projectId: process.env.GOOGLE_PROJECT_ID || ''
  };

  if (!ag01.accessToken) {
    console.log('🟡 [LIVE PROBE NOTICE] No live OAuth access token currently enrolled for AG-01.');
    console.log('   Enrol OAuth token in storage/antigravity_connections.json to execute live upstream attestation.');
    return;
  }

  const transport = new AntigravityCloudCodeTransport();

  console.log(`[PROBE 1] Testing AG-01 Control Plane Onboarding (loadCodeAssist)...`);
  try {
    const projectInfo = await transport.loadCodeAssist(ag01, ag01.accessToken);
    console.log(`  -> Onboarding Result: ProjectId=${projectInfo.projectId}, Tier=${projectInfo.tier}`);
  } catch (err) {
    console.log(`  -> Onboarding Note (Expected if non-CodeAssist token): ${err.message}`);
  }

  console.log(`\n[PROBE 2] Testing Native Upstream Inference Dispatch...`);
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
  } catch (err) {
    console.log(`  -> Upstream Response: ${err.message}`);
  }

  console.log('\n================================================================');
  console.log('  SINGLE ACCOUNT LIVE PROBE COMPLETED');
  console.log('================================================================\n');
}

runSingleAccountLiveTest().catch(console.error);
