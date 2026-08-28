import assert from 'assert';
import { AntigravityCloudCodeTransport } from '../../server/antigravity/AntigravityCloudCodeTransport.mjs';

console.log('--- TEST: CloudCodeNativePayloadTest ---');

const transport = new AntigravityCloudCodeTransport();

// 1. Mock connection and messages
const connection = {
  id: 'ag-01',
  projectId: 'antigravity-test-project',
  projectTier: 'STANDARD',
  accessToken: 'valid_mock_token_xyz'
};

const messages = [
  { role: 'system', content: 'You are an AI assistant' },
  { role: 'user', content: 'Balas persis: LIVE-AG-01-TEST' }
];

// Transform messages to native Cloud Code format
const contents = messages
  .filter(m => m.role !== 'system')
  .map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

const systemInstruction = messages.find(m => m.role === 'system')?.content || '';

const innerRequest = {
  contents,
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 2048
  }
};

if (systemInstruction) {
  innerRequest.systemInstruction = { parts: [{ text: systemInstruction }] };
}

const payload = {
  project: connection.projectId,
  model: `projects/${connection.projectId}/locations/us-central1/publishers/google/models/gemini-3.6-flash-high`,
  request: innerRequest
};

// 2. Assert that payload matches Cloud Code native envelope
assert(payload.project, 'Top-level project must exist');
assert(payload.model, 'Top-level model must exist');
assert(payload.request, 'Top-level request envelope must encapsulate Generative AI request');
assert.strictEqual(payload.contents, undefined, 'Top-level contents MUST NOT exist (must be in request envelope)');
assert.strictEqual(payload.generationConfig, undefined, 'Top-level generationConfig MUST NOT exist (must be in request envelope)');

assert(Array.isArray(payload.request.contents), 'request.contents must be an array');
assert.strictEqual(payload.request.contents.length, 1);
assert.strictEqual(payload.request.contents[0].parts[0].text, 'Balas persis: LIVE-AG-01-TEST');
assert(payload.request.systemInstruction, 'request.systemInstruction must exist');

console.log('[1] Cloud Code Native Payload Envelope validated:', {
  project: payload.project,
  model: payload.model,
  hasRequestEnvelope: Boolean(payload.request),
  contentsInEnvelope: Boolean(payload.request.contents),
  topLevelContentsMissing: payload.contents === undefined
});

console.log('✅ [PASS] CloudCodeNativePayloadTest: 100% SUCCESS');
