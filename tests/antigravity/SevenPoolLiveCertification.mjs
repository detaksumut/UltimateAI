import assert from 'assert';
import { antigravityCloudCodeTransportInstance } from '../../server/antigravity/AntigravityCloudCodeTransport.mjs';
import { antigravityConnectionStoreInstance } from '../../server/antigravity/AntigravityConnectionStore.mjs';
import { antigravityTokenManagerInstance } from '../../server/antigravity/AntigravityTokenManager.mjs';

console.log('========================================================================');
console.log('  LIVE CERTIFICATION HARNESS — 7 ANTIGRAVITY POOLS (AG-01 TO AG-07)');
console.log('========================================================================\n');

const results = {};

async function certifyPool(poolId) {
  console.log(`\n------------------------------------------------------------------------`);
  console.log(`  CERTIFYING ${poolId.toUpperCase()}`);
  console.log(`------------------------------------------------------------------------`);

  const report = {
    poolId,
    email: null,
    oauthCredential: '❌',
    tokenDecryption: '❌',
    cloudCodeAssist: '❌',
    projectDiscovery: '❌',
    nonStreamInference: '❌',
    streamInference: '❌',
    connectionFidelity: '❌',
    modelAttestation: '❌',
    responseIdProvenance: '❌',
    projectId: null,
    actualModel: null,
    upstreamResponseId: null,
    nonStreamContent: null,
    streamContent: null,
    error: null
  };

  try {
    // 1. Vault credential retrieval
    const conn = antigravityConnectionStoreInstance.getConnection(poolId, false);
    assert(conn, `${poolId} connection record must exist in vault`);
    report.email = conn.email;
    assert(conn.refreshToken || conn.accessToken, `${poolId} must have valid tokens`);
    report.oauthCredential = '✅';
    report.tokenDecryption = '✅';

    // 2. Token refresh & validation
    const tokenRes = await antigravityTokenManagerInstance.ensureValidToken(conn);
    assert(tokenRes.valid, `Token validation failed for ${poolId}: ${tokenRes.error}`);
    const accessToken = tokenRes.accessToken;
    assert(accessToken, `Access token must be available for ${poolId}`);

    // 3. Control Plane: loadCodeAssist
    const projectInfo = await antigravityCloudCodeTransportInstance.loadCodeAssist(conn, accessToken, { strictFreshProof: true });
    assert(projectInfo.projectId, `Project must be discovered for ${poolId}`);
    report.projectId = projectInfo.projectId;
    report.cloudCodeAssist = '✅';
    report.projectDiscovery = '✅';

    // 4. Non-stream live inference
    const expectedPrompt = `Balas persis: LIVE-${poolId.toUpperCase()}-TEST`;
    const nonStreamResult = await antigravityCloudCodeTransportInstance.executeChat({
      connection: conn,
      modelId: 'gemini-3.6-flash-high',
      messages: [{ role: 'user', content: expectedPrompt }],
      stream: false
    });

    assert(nonStreamResult.content, `Non-stream content must not be empty for ${poolId}`);
    assert.strictEqual(nonStreamResult.actualConnectionId, poolId, `actualConnectionId must match ${poolId}`);
    assert.strictEqual(nonStreamResult.requestedModel, 'gemini-3.6-flash-high', 'requestedModel must be gemini-3.6-flash-high');
    assert.strictEqual(nonStreamResult.actualModel, 'gemini-3.6-flash', 'actualModel must be gemini-3.6-flash');
    assert(nonStreamResult.upstreamResponseId, `upstreamResponseId must exist for ${poolId}`);

    report.nonStreamInference = '✅';
    report.nonStreamContent = nonStreamResult.content.trim();
    report.actualModel = nonStreamResult.actualModel;
    report.upstreamResponseId = nonStreamResult.upstreamResponseId;

    // 5. Stream live inference
    let streamAccum = '';
    const streamResult = await antigravityCloudCodeTransportInstance.executeChat({
      connection: conn,
      modelId: 'gemini-3.6-flash-high',
      messages: [{ role: 'user', content: expectedPrompt }],
      stream: true
    }, (chunk) => {
      streamAccum += chunk;
    });

    assert(streamAccum.length > 0, `Stream chunks must be received for ${poolId}`);
    assert.strictEqual(streamResult.actualConnectionId, poolId, `Stream actualConnectionId must match ${poolId}`);
    assert(streamResult.upstreamResponseId, `Stream upstreamResponseId must exist for ${poolId}`);

    report.streamInference = '✅';
    report.streamContent = streamAccum.trim();
    report.connectionFidelity = '✅';
    report.modelAttestation = '✅';
    report.responseIdProvenance = '✅';

    console.log(`[PASS] ${poolId.toUpperCase()} certified successfully!`);
    console.log(`       Email: ${report.email}`);
    console.log(`       Project: ${report.projectId}`);
    console.log(`       Non-stream response: "${report.nonStreamContent}"`);
    console.log(`       Stream response: "${report.streamContent}"`);
    console.log(`       Upstream ResponseId: ${report.upstreamResponseId}`);
  } catch (err) {
    report.error = err.message;
    console.error(`[FAIL] ${poolId.toUpperCase()} failed certification: ${err.message}`);
  }

  results[poolId] = report;
  return report;
}

async function runAll() {
  const pools = ['ag-01', 'ag-02', 'ag-03', 'ag-04', 'ag-05', 'ag-06', 'ag-07'];
  for (const pool of pools) {
    await certifyPool(pool);
  }

  console.log('\n========================================================================');
  console.log('  FINAL 7-POOL CERTIFICATION SUMMARY TABLE');
  console.log('========================================================================\n');

  console.log('| Pool  | Email                       | OAuth | Token | CloudCode | Project | Non-Stream | Stream | Fidelity | Model | RespID |');
  console.log('|-------|-----------------------------|-------|-------|-----------|---------|------------|--------|----------|-------|--------|');

  let allPassed = true;
  for (const pool of pools) {
    const r = results[pool];
    const emailPadded = (r.email || 'N/A').padEnd(27, ' ');
    console.log(`| ${r.poolId.toUpperCase()} | ${emailPadded} | ${r.oauthCredential}     | ${r.tokenDecryption}     | ${r.cloudCodeAssist}         | ${r.projectDiscovery}       | ${r.nonStreamInference}          | ${r.streamInference}      | ${r.connectionFidelity}        | ${r.modelAttestation}     | ${r.responseIdProvenance}      |`);
    if (r.nonStreamInference !== '✅' || r.streamInference !== '✅') {
      allPassed = false;
    }
  }

  console.log('\n========================================================================');
  if (allPassed) {
    console.log('  ALL 7 ANTIGRAVITY POOLS ARE 100% CERTIFIED LIVE!');
  } else {
    console.log('  SOME POOLS FAILED CERTIFICATION — SEE DETAILS ABOVE');
  }
  console.log('========================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runAll().catch(err => {
  console.error('Certification runner error:', err);
  process.exit(1);
});
