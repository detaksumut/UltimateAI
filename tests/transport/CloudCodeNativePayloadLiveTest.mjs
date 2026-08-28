import assert from 'assert';
import { antigravityCloudCodeTransportInstance } from '../../server/antigravity/AntigravityCloudCodeTransport.mjs';
import { antigravityConnectionStoreInstance } from '../../server/antigravity/AntigravityConnectionStore.mjs';

console.log('--- TEST: CloudCodeNativePayloadLiveTest ---');

async function runLiveTest() {
  const conn = antigravityConnectionStoreInstance.getConnection('ag-01', false);
  assert(conn, 'ag-01 connection must exist in vault');

  // Intercept fetch to assert payload format before dispatch
  let interceptedPayload = null;
  let interceptedHeaders = null;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    if (url.includes('streamGenerateContent')) {
      interceptedHeaders = options.headers;
      interceptedPayload = JSON.parse(options.body);
    }
    return originalFetch(url, options);
  };

  try {
    const result = await antigravityCloudCodeTransportInstance.executeChat({
      connection: conn,
      modelId: 'gemini-3.6-flash-high',
      messages: [
        { role: 'system', content: 'You are a concise AI.' },
        { role: 'user', content: 'Balas persis: LIVE-AG-01-TEST' }
      ],
      stream: false
    });

    console.log('[1] Live Execution Result:', result);
    assert.strictEqual(result.actualConnectionId, 'ag-01', 'actualConnectionId must remain ag-01');
    assert.strictEqual(result.requestedModel, 'gemini-3.6-flash-high', 'requestedModel must be preserved');
    assert.strictEqual(result.actualModel, 'gemini-3.6-flash', 'actualModel must match upstream canonical modelVersion');
    assert(result.upstreamResponseId, 'upstreamResponseId must be captured from Google SSE payload');
    assert(result.content.length > 0, 'Content must not be empty');

    // Schema assertions on intercepted payload
    assert(interceptedPayload, 'Request payload must be intercepted');
    assert.strictEqual(interceptedPayload.contents, undefined, 'Top-level contents MUST NOT exist');
    assert.strictEqual(interceptedPayload.generationConfig, undefined, 'Top-level generationConfig MUST NOT exist');
    assert(interceptedPayload.request, 'Top-level request envelope MUST exist');
    assert(Array.isArray(interceptedPayload.request.contents), 'request.contents must be an array');
    assert.strictEqual(interceptedHeaders['x-goog-user-project'], undefined, 'x-goog-user-project header must NOT be sent');

    console.log('✅ [PASS] CloudCodeNativePayloadLiveTest: Schema & Live Execution Validated');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

runLiveTest().catch(err => {
  console.error('❌ [FAIL] CloudCodeNativePayloadLiveTest:', err);
  process.exit(1);
});
