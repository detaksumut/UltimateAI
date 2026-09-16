/**
 * test_9router_image_pipeline.mjs
 * Comprehensive test suite for the 9ROUTER IMAGE PIPELINE architecture.
 *
 * Matrix:
 * IMAGE-9R-01: Module exports + singleton present; no key exposed in adapter state
 * IMAGE-9R-02: NINEROUTER_URL via config SSOT (endpoints.ninerouter)
 * IMAGE-9R-03: Discovery /v1/models/image returns ordered ids; cached (single fetch)
 * IMAGE-9R-04: Discovery force refresh re-fetches
 * IMAGE-9R-05: Model info /v1/models/info?id= parsed (params/capabilities), cached
 * IMAGE-9R-06: ImageModelSelector deterministic; strict 16:9/9:16 = HARD filter —
 *              only `size`-capable candidates may be selected (zero square models)
 * IMAGE-9R-07: Selector honors operator preference ONLY when discovered + aspect-capable
 * IMAGE-9R-08: Selector -> IMAGE_MODEL_UNAVAILABLE on empty discovery
 * IMAGE-9R-09: generateImage normalizes b64_json success -> { success, gateway:'9ROUTER', imageBytes, fallbackUsed:false }
 * IMAGE-9R-10: generateImage HTTP 401 failure -> success false, reasonCode path
 * IMAGE-9R-11: maskSecrets removes the NINEROUTER_KEY from error text
 * IMAGE-9R-12: Authorization Bearer header present when key configured; key NOT in payload body
 * IMAGE-9R-13: ImageGeneration active routing has ZERO Gemini/Hermes/Together references
 *               (DIRECT_GEMINI_IMAGE_PATH=0, HERMES_IMAGE_REFERENCES=0)
 * IMAGE-9R-14: QwenVisualPlanner (llama.cpp :8080) valid JSON -> QWEN planner success
 * IMAGE-9R-15: QwenVisualPlanner invalid JSON -> repair attempts -> deterministic fallback still succeeds
 * IMAGE-9R-16: Full pipeline -> artifact persisted, url set, verifyArtifact renderable,
 *               metadata.model set, IMAGE_STUDIO reference attached
 * IMAGE-9R-17: NO silent jump: 9Router down/unavailable -> IMAGE_GENERATION_FAILED
 *               (never Gemini/Hermes); DEACTIVATED provider override hard-rejected
 *
 * LIVE GROUP (run on demand, never automatically):
 *   RUN_9R_LIVE=1 node tests/agent/test_9router_image_pipeline.mjs
 *   -> real 9Router E2E "buatkan image pesawat terbang untuk presentasi enterprise"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Jimp from 'jimp';

import '../../server/config/env.mjs';
import { config } from '../../server/config/env.mjs';
import {
  NineRouterGatewayAdapter,
  ImageModelSelector,
  nineRouterGatewayAdapterInstance,
  detectImageFormat,
  maskSecrets
} from '../../server/agent/adapters/NineRouterGatewayAdapter.mjs';
import { QwenVisualPlanner, qwenVisualPlannerInstance } from '../../server/agent/planner/QwenVisualPlanner.mjs';
import { imageStudioInstance } from '../../server/studio/image/ImageStudio.mjs';
import { imageGenerationInstance } from '../../server/agent/ImageGeneration.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const testResults = [];
function recordTest(testId, name, passed, details = '') {
  testResults.push({ testId, name, passed, details });
  const mark = passed ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${testId}: ${name} ${details ? '(' + details + ')' : ''}`);
}

// ── Fixture data ──────────────────────────────────────────────────────────

const FIXTURE_MODELS = ['ag/gemini-3.1-flash-image', 'openai/gpt-image-1', 'openai/dall-e-3', 'openai/dall-e-2', 'cx/gpt-5.4-image'];

const FIXTURE_INFO = {
  'ag/gemini-3.1-flash-image': { id: 'ag/gemini-3.1-flash-image', kind: 'image', owned_by: 'ag', endpoint: '/v1/images/generations', capabilities: ['textToImage'], params: [] },
  'openai/gpt-image-1': { id: 'openai/gpt-image-1', kind: 'image', owned_by: 'openai', endpoint: '/v1/images/generations', params: ['n', 'size', 'quality', 'response_format'] },
  'openai/dall-e-3': { id: 'openai/dall-e-3', kind: 'image', owned_by: 'openai', endpoint: '/v1/images/generations', params: ['size', 'quality', 'style', 'response_format'] },
  'openai/dall-e-2': { id: 'openai/dall-e-2', kind: 'image', owned_by: 'openai', params: ['size'] },
  'cx/gpt-5.4-image': { id: 'cx/gpt-5.4-image', kind: 'image', owned_by: 'cx', endpoint: '/v1/images/generations', params: ['size', 'quality', 'output_format'], capabilities: ['text2img', 'edit'] }
};

const DISCOVERY_JSON = (models) => JSON.stringify({ object: 'list', data: models.map((id) => ({ id, object: 'model', owned_by: id.startsWith('openai') ? 'openai' : id.startsWith('cx') ? 'cx' : 'ag' })) });
const INFO_JSON = (info) => JSON.stringify(info);

async function makeFixtureImage() {
  const width = 912;
  const height = 512;
  const img = new Jimp(width, height, 0x2b3a55ff);
  img.scan(0, 0, width, height, function (x, y, idx) {
    this.bitmap.data[idx] = (x * 7 + y * 13) % 256;
    this.bitmap.data[idx + 1] = (x * 11 + y * 5) % 256;
    this.bitmap.data[idx + 2] = (x * 3 + y * 17) % 256;
  });
  const buf = await img.quality(70).getBufferAsync(Jimp.MIME_JPEG);
  if (buf.length < 1024) {
    // Guarantee above MIN_ARTIFACT_BYTES
    return Buffer.concat([buf, Buffer.alloc(1600, 0x42)]);
  }
  return buf;
}

/**
 * Fake 9Router + llama.cpp transport. Responds purely from fixtures.
 * failMode: '401' | '500' | 'empty-models' | 'no-image' | '503'
 */
function makeFakeTransport({ models = FIXTURE_MODELS, info = FIXTURE_INFO, generationB64, failMode = null, calls = null } = {}) {
  const state = calls || { discovery: 0, info: 0, generation: 0 };
  const okJson = (obj, headers) => ({
    ok: true,
    status: 200,
    json: async () => obj,
    text: async () => JSON.stringify(obj),
    headers: { get: (k) => (headers ? headers[k] : null) }
  });
  const failResponse = (status, body) => ({ ok: false, status, text: async () => body, json: async () => { throw new Error('no json'); } });
  return async (url, init = {}) => {
    const method = (init?.method || 'GET').toUpperCase();
    if (url.endsWith('/v1/models/image')) {
      state.discovery++;
      if (failMode === '500') return failResponse(500, '{"error":"boom"}');
      if (failMode === '503') return failResponse(503, '9router unavailable');
      if (failMode === 'empty-models') return okJson({ object: 'list', data: [] });
      return okJson(JSON.parse(DISCOVERY_JSON(models)));
    }
    if (url.includes('/v1/models/info?id=')) {
      state.info++;
      const id = decodeURIComponent(url.split('id=')[1]);
      if (failMode === '500') return failResponse(500, 'boom');
      return okJson(JSON.parse(INFO_JSON(info[id] || { id, kind: 'image', owned_by: 'unknown', params: [] })));
    }
    const binaryMode = url.includes('response_format=binary');
    if (url.includes('/v1/images/generations')) {
      state.generation++;
      if (binaryMode) {
        // Raw-bytes body: arrayBuffer() only; the adapter must never text()/json() here.
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => Uint8Array.from(generationB64 || new Uint8Array(0)),
          text: async () => '',
          headers: { get: () => null }
        };
      }
      if (typeof init?.body === 'string' && init.body.includes(process.env.NINEROUTER_KEY)) {
        return failResponse(400, 'KEY LEAKED INTO BODY');
      }
      if (failMode === '401') return failResponse(401, JSON.stringify({ error: { message: `Missing API key ${process.env.NINEROUTER_KEY}`, type: 'authentication_error' } }));
      if (failMode === 'reject-response-format') {
        const body = JSON.parse(init?.body || '{}');
        if (body.response_format) return failResponse(400, JSON.stringify({ error: { message: `[openai/gpt-image-1] [400]: Unknown parameter: 'response_format'.` } }));
        state.lastPayload = body;
      }
      if (failMode === 'no-image') return okJson({ created: 1, data: [] });
      Object.assign(state, { lastAuthHeader: init?.headers?.Authorization || null, lastBody: init?.body || null });
      return okJson({ created: 1780000001, data: [{ b64_json: generationB64.toString('base64') }] });
    }
    if (url.endsWith('/v1/chat/completions')) {
      const msg = init?.body ? JSON.parse(init.body) : {};
      const lastUser = (msg?.messages || []).filter((m) => m.role === 'user').pop()?.content || '';
      const send = (content, ok = true) => (ok
        ? okJson({ choices: [{ message: { content } }] })
        : failResponse(500, 'llama boom'));
      if (failMode === 'llama-down') return failResponse(503, 'llama unavailable');
      if (failMode === 'llama-garbage') return send('```surely this is not json```');
      if (lastUser.includes('REPAIR INSTRUCTION')) {
        return send('{"subject":"pesawat terbang","visualIntent":"photorealistic","style":"corporate","composition":"centered","lighting":"studio-soft","camera":"eye-level-medium","colorPalette":["#1A2332","#38BDF8"],"aspectRatio":"16:9","size":"912x512","prompt":"A commercial airplane in clear sky, photorealistic","negativePrompt":"distorted text","domain":"PRESENTATION"}');
      }
      return send('```json\n{"subject":"pesawat terbang","visualIntent":"photorealistic","style":"corporate","composition":"subject centered","lighting":"studio-soft","camera":"eye-level-medium","colorPalette":["#1A2332","#38BDF8","#D4AF37"],"aspectRatio":"16:9","size":"912x512","prompt":"A commercial airplane flying over the ocean at golden hour, photorealistic, enterprise presentation","negativePrompt":"distorted text, low quality","domain":"PRESENTATION"}\n```');
    }
    return failResponse(404, 'not found');
  };
}

async function runTests() {
  console.log('===============================================================');
  console.log('     RUNNING TEST MATRIX: 9ROUTER IMAGE PIPELINE (IMAGE-9R)');
  console.log('===============================================================\n');

  const fixturePng = await makeFixtureImage();

  // ── IMAGE-9R-01: exports + no key in adapter state ──
  try {
    const adapterState = JSON.stringify({ discovery: nineRouterGatewayAdapterInstance._discovery, info: [...(nineRouterGatewayAdapterInstance._infoCache?.keys() || [])] });
    const stateHasKey = adapterState.includes(process.env.NINEROUTER_KEY || 'improbable-key-xyz');
    const ok = typeof NineRouterGatewayAdapter === 'function' &&
      typeof ImageModelSelector === 'function' &&
      typeof nineRouterGatewayAdapterInstance.discoverImageModels === 'function' &&
      typeof nineRouterGatewayAdapterInstance.generateImage === 'function' &&
      !stateHasKey;
    recordTest('IMAGE-9R-01', 'Exports + singleton present; key NOT stored in adapter state', ok,
      `hasDiscover=${typeof nineRouterGatewayAdapterInstance.discoverImageModels === 'function'}, stateLeaksKey=${stateHasKey}`);
  } catch (err) { recordTest('IMAGE-9R-01', 'Exports + singleton', false, err.message); }

  // ── IMAGE-9R-02: NINEROUTER_URL via config SSOT ──
  try {
    const url = config.endpoints?.ninerouter;
    const ok = typeof url === 'string' && /^https?:\/\//.test(url) && url.length > 0;
    recordTest('IMAGE-9R-02', 'NINEROUTER_URL present in config SSOT (endpoints.ninerouter)', ok, `url=${url}`);
  } catch (err) { recordTest('IMAGE-9R-02', 'config SSOT ninerouter', false, err.message); }

  // ── IMAGE-9R-03: discovery ordered ids + cached ──
  try {
    const calls = { discovery: 0, info: 0, generation: 0 };
    const fetchFn = makeFakeTransport({ calls });
    const first = await nineRouterGatewayAdapterInstance.discoverImageModels({ fetchFn });
    const second = await nineRouterGatewayAdapterInstance.discoverImageModels({ fetchFn });
    const ok = Array.isArray(first) && first.length === FIXTURE_MODELS.length &&
      first[0] === 'ag/gemini-3.1-flash-image' && calls.discovery === 1 && JSON.stringify(second) === JSON.stringify(first);
    recordTest('IMAGE-9R-03', 'Discovery ordered ids + cache (single fetch)', ok, `fetches=${calls.discovery}, first=${first[0]}`);
  } catch (err) { recordTest('IMAGE-9R-03', 'Discovery + cache', false, err.message); }

  // ── IMAGE-9R-04: force refresh ──
  try {
    const calls = { discovery: 0, info: 0, generation: 0 };
    const fetchFn = makeFakeTransport({ calls });
    nineRouterGatewayAdapterInstance._discovery = null;
    await nineRouterGatewayAdapterInstance.discoverImageModels({ fetchFn });
    await nineRouterGatewayAdapterInstance.discoverImageModels({ fetchFn, force: true });
    const ok = calls.discovery === 2;
    recordTest('IMAGE-9R-04', 'Discovery force refresh re-fetches', ok, `fetches=${calls.discovery}`);
  } catch (err) { recordTest('IMAGE-9R-04', 'Force refresh', false, err.message); }

  // ── IMAGE-9R-05: model info parsed + cached ──
  try {
    nineRouterGatewayAdapterInstance._infoCache.clear();
    const calls = { discovery: 0, info: 0, generation: 0 };
    const fetchFn = makeFakeTransport({ calls });
    const info1 = await nineRouterGatewayAdapterInstance.getModelInfo('openai/gpt-image-1', { fetchFn });
    await nineRouterGatewayAdapterInstance.getModelInfo('openai/gpt-image-1', { fetchFn });
    const ok = info1.id === 'openai/gpt-image-1' && Array.isArray(info1.params) &&
      info1.params.includes('response_format') && calls.info === 1;
    recordTest('IMAGE-9R-05', 'Model info parsed + cached', ok, `calls=${calls.info}, params=${info1.params?.join(',')}`);
  } catch (err) { recordTest('IMAGE-9R-05', 'Model info', false, err.message); }

  // ── IMAGE-9R-06: deterministic selection on discovered list; strict 16:9 is
  //                 a HARD filter (only `size`-capable models are candidates) ──
  try {
    const sel = new ImageModelSelector();
    const both = sel.selectImageModel({ availableModels: FIXTURE_MODELS, aspectRatio: '16:9', fetchModelInfo: (m) => FIXTURE_INFO[m] || null });
    const again = sel.selectImageModel({ availableModels: FIXTURE_MODELS, aspectRatio: '16:9', fetchModelInfo: (m) => FIXTURE_INFO[m] || null });
    const noInfo = sel.selectImageModel({ availableModels: FIXTURE_MODELS, aspectRatio: '16:9' });

    const capable = both.candidates.filter((c) => FIXTURE_INFO[c.model]?.params?.includes('size'));
    const ok = both.ok && both.model === 'openai/gpt-image-1' && both.model === again.model &&
      capable.length === both.candidates.length && // every candidate aspect-capable
      !both.candidates.some((c) => c.model === 'ag/gemini-3.1-flash-image') && // square-only model excluded
      noInfo.ok === false && noInfo.code === 'IMAGE_NO_ASPECT_CAPABLE_MODEL'; // params unknown => not eligible
    recordTest('IMAGE-9R-06', 'Strict 16:9 hard-filter: only `size`-capable candidates; deterministic', ok,
      `winner=${both.model}, candidates=${both.candidates?.map((c) => c.model).join(',')}, noInfoCode=${noInfo.code}`);
  } catch (err) { recordTest('IMAGE-9R-06', 'Strict aspect hard-filter selector', false, err.message); }

  // ── IMAGE-9R-07: preference honored ONLY when discovered AND aspect-capable;
  //                 forbidden "912x512" request size is sanitized to the policy
  //                 preferred "1024x576" (never requested as 3:2-mapping hint) ──
  try {
    const sel = new ImageModelSelector({ preferred: 'openai/gpt-image-1' });
    const res = sel.selectImageModel({
      availableModels: FIXTURE_MODELS,
      aspectRatio: '16:9',
      size: '912x512', // forbidden string: must be sanitized
      quality: 'high',
      fetchModelInfo: (m) => FIXTURE_INFO[m] || null
    });
    // preferred hint pointing at a NON-capable model (square-only) must be ignored
    // for a strict 16:9 request — it must NEVER become a candidate.
    const nonCapablePreferred = new ImageModelSelector({ preferred: 'ag/gemini-3.1-flash-image' });
    const res2 = nonCapablePreferred.selectImageModel({
      availableModels: FIXTURE_MODELS,
      aspectRatio: '16:9',
      fetchModelInfo: (m) => FIXTURE_INFO[m] || null
    });
    const ok = res.ok && res.model === 'openai/gpt-image-1' && res.size === '1024x576' && res.fallbackSize === '912x513' && res.responseFormat === 'b64_json' &&
      res2.ok && res2.model !== 'ag/gemini-3.1-flash-image' &&
      !res2.candidates.some((c) => c.model === 'ag/gemini-3.1-flash-image');
    recordTest('IMAGE-9R-07', 'Preference honored (capable) + forbidden 912x512 sanitized to 1024x576', ok,
      `model=${res.model}, size=${res.size}, fb=${res.fallbackSize}, fmt=${res.responseFormat}, preferredNonCapableIgnored=${!(res2.model === 'ag/gemini-3.1-flash-image')}`);
  } catch (err) { recordTest('IMAGE-9R-07', 'Preference + hard filter', false, err.message); }

  // ── IMAGE-9R-08: empty discovery -> unavailable ──
  try {
    const sel = new ImageModelSelector();
    const res = sel.selectImageModel({ availableModels: [] });
    const ok = res.ok === false && res.code === 'IMAGE_MODEL_UNAVAILABLE';
    recordTest('IMAGE-9R-08', 'Empty discovery -> IMAGE_MODEL_UNAVAILABLE', ok, `code=${res.code}`);
  } catch (err) { recordTest('IMAGE-9R-08', 'Empty discovery', false, err.message); }

  // ── IMAGE-9R-09: generateImage normalizes b64 success + self-heals on
  //                 rejected parameter (learned per-model blacklist) ──
  try {
    nineRouterGatewayAdapterInstance._paramBlacklist.clear();
    const calls = { discovery: 0, info: 0, generation: 0 };
    const fetchFn = makeFakeTransport({ generationB64: fixturePng, calls, failMode: 'reject-response-format' });
    const res = await nineRouterGatewayAdapterInstance.generateImage({
      prompt: 'test airplane',
      model: 'openai/gpt-image-1',
      size: '912x512',
      quality: 'high',
      responseFormat: 'b64_json',
      requestId: 'req-9r-09',
      fetchFn
    });
    const fmt = detectImageFormat(res.imageBytes).format;
    const retryBody = JSON.parse(calls.lastBody || '{}');
    const pruned = calls.generation === 2 && retryBody.response_format === undefined && retryBody.size === '912x512';
    const ok = res.success === true && res.gateway === '9ROUTER' && res.model === 'openai/gpt-image-1' &&
      res.fallbackUsed === false && res.imageBytes.length > 0 && (fmt === 'png' || fmt === 'jpeg') && pruned;
    recordTest('IMAGE-9R-09', 'Generation b64 success + rejected param pruned on retry (self-heal)', ok,
      `bytes=${res.imageBytes?.length}, format=${fmt}, generations=${calls.generation}, pruned=${pruned}`);
  } catch (err) { recordTest('IMAGE-9R-09', 'Generation success + self-heal', false, err.message); }

  // ── IMAGE-9R-10: HTTP 401 failure ──
  try {
    const fetchFn = makeFakeTransport({ generationB64: fixturePng, failMode: '401' });
    const res = await nineRouterGatewayAdapterInstance.generateImage({
      prompt: 'test',
      model: 'openai/gpt-image-1',
      requestId: 'req-9r-10',
      fetchFn
    });
    const ok = res.success === false && res.httpStatus === 401 && /IMAGE_GENERATION_FAILED/.test(res.error);
    recordTest('IMAGE-9R-10', 'HTTP 401 -> success false with masked error', ok, `code=${res.code}`);
  } catch (err) { recordTest('IMAGE-9R-10', 'HTTP 401 failure', false, err.message); }

  // ── IMAGE-9R-11: maskSecrets removes the key ──
  try {
    const key = process.env.NINEROUTER_KEY;
    const masked = maskSecrets(`error 401 Missing API key ${key} [REDACTED check]`);
    const ok = typeof masked === 'string' && (key ? !masked.includes(key) : true) && masked.includes('[REDACTED]');
    recordTest('IMAGE-9R-11', 'maskSecrets redacts NINEROUTER_KEY', ok, `redacted=${masked.includes('[REDACTED]')}`);
  } catch (err) { recordTest('IMAGE-9R-11', 'maskSecrets', false, err.message); }

  // ── IMAGE-9R-12: Bearer header present; key not in payload ──
  try {
    nineRouterGatewayAdapterInstance._infoCache.clear();
    const calls = { discovery: 0, info: 0, generation: 0 };
    const fetchFn = makeFakeTransport({ generationB64: fixturePng, calls });
    await nineRouterGatewayAdapterInstance.generateImage({
      prompt: 'test',
      model: 'openai/gpt-image-1',
      requestId: 'req-9r-12',
      fetchFn
    });
    const auth = calls.lastAuthHeader || '';
    const body = calls.lastBody || '';
    const key = process.env.NINEROUTER_KEY;
    const ok = typeof auth === 'string' && auth.startsWith('Bearer ') &&
      (key ? !body.includes(key) : true);
    recordTest('IMAGE-9R-12', 'Bearer header present; key NOT in payload body', ok, `headerPrefix=${auth.slice(0, 7)}, bodyLeaks=${key ? body.includes(key) : false}`);
  } catch (err) { recordTest('IMAGE-9R-12', 'Auth header hygiene', false, err.message); }

  // ── IMAGE-9R-13: active routing zero Gemini/Hermes/Together ──
  try {
    const src = fs.readFileSync(path.join(rootDir, 'server/agent/ImageGeneration.mjs'), 'utf8');
    const forbidden = ['hermesVisualFallbackInstance', 'isGeminiQuotaFailure', 'api.together.xyz', '_generateGeminiImagen', '_generateTogetherAI'];
    const leaks = forbidden.filter((t) => src.includes(t));
    const ok = leaks.length === 0 && src.includes('_generateNineRouter') && src.includes('NINEROUTER');
    recordTest('IMAGE-9R-13', 'Active routing: ZERO Gemini/Hermes/Together references', ok,
      leaks.length ? `leaks=${leaks.join(',')}` : 'DIRECT_GEMINI_IMAGE_PATH=0, HERMES_IMAGE_REFERENCES=0');
  } catch (err) { recordTest('IMAGE-9R-13', 'Active routing scan', false, err.message); }

  // ── IMAGE-9R-14: QwenValid planner JSON -> QWEN success ──
  try {
    const calls = { discovery: 0, info: 0, generation: 0 };
    const fetchFn = makeFakeTransport({ generationB64: fixturePng, calls });
    const res = await qwenVisualPlannerInstance.generateVisualSpec({
      prompt: 'buatkan image pesawat terbang untuk presentasi enterprise',
      aspectRatio: '16:9',
      requestId: 'req-9r-14',
      fetchFn,
      domain: 'PRESENTATION'
    });
    const ok = res.success && res.planner === 'QWEN' && res.spec.prompt && res.spec.subject &&
      res.spec.aspectRatio === '16:9' && res.spec.size === '912x512' && Array.isArray(res.spec.colorPalette);
    recordTest('IMAGE-9R-14', 'Qwen planner valid JSON -> QWEN success', ok,
      `planner=${res.planner}, subject=${res.spec?.subject}`);
  } catch (err) { recordTest('IMAGE-9R-14', 'Qwen planner', false, err.message); }

  // ── IMAGE-9R-15: Qwen invalid JSON -> repair -> deterministic fallback ──
  try {
    const fetchFn = makeFakeTransport({ generationB64: fixturePng, failMode: 'llama-garbage' });
    const res = await qwenVisualPlannerInstance.generateVisualSpec({
      prompt: 'garbage llm output test',
      aspectRatio: '16:9',
      requestId: 'req-9r-15',
      fetchFn,
      domain: 'GENERAL'
    });
    const ok = res.success && res.planner === 'DETERMINISTIC' && res.spec.prompt && res.spec.prompt.length > 0;
    recordTest('IMAGE-9R-15', 'Invalid JSON -> repair loop exhausted -> deterministic fallback (success)', ok,
      `planner=${res.planner}, hasError=${Boolean(res.error)}`);
  } catch (err) { recordTest('IMAGE-9R-15', 'Repair fallback', false, err.message); }

  // ── IMAGE-9R-16: full pipeline -> artifact persisted + studio reference ──
  try {
    const calls = { discovery: 0, info: 0, generation: 0 };
    const fetchFn = makeFakeTransport({ generationB64: fixturePng, calls });
    const res = await imageGenerationInstance.generateImage({
      prompt: 'buatkan image pesawat terbang untuk presentasi enterprise',
      providerOverride: 'NINEROUTER',
      aspectRatio: '16:9',
      generationId: 'gid-9r-16',
      messageId: 'mid-9r-16',
      signal: null
    }, { fetch: fetchFn });
    const art = res?.artifact;
    const verify = art ? imageGenerationInstance.verifyArtifact(art) : { renderable: false };
    const ok = res?.success === true && art && art.type === 'IMAGE' && art.url &&
      /\/api\/artifacts\/images\//.test(art.url) && art.model && art.gateway === '9ROUTER' &&
      art.studio?.artifactId === art.id && art.visualSpec && verify.renderable === true &&
      art.width === 912 && art.height === 512 && // ACTUAL artifact dims honour strict 16:9
      fs.existsSync(art.localPath);
    recordTest('IMAGE-9R-16', 'Full pipeline -> artifact persisted, studio ref, verified renderable 16:9', ok,
      `model=${art?.model}, ${art?.width}x${art?.height}, url=${art?.url}, renderable=${verify.renderable}, studio=${Boolean(art?.studio)}`);
  } catch (err) { recordTest('IMAGE-9R-16', 'Full pipeline', false, err.message); }

  // ── IMAGE-9R-17: no silent jump + deactivated override hard-rejected ──
  try {
    // a) 9Router unusable -> capabilityProbe available=false
    const downFetch = makeFakeTransport({ generationB64: fixturePng, failMode: '500' });
    const probe = await imageGenerationInstance.capabilityProbe({ fetch: downFetch });
    const probeUnavailable = probe.available === false && probe.provider === 'NINEROUTER';

    // b) generateImage providerOverride NINEROUTER + gateway failure -> IMAGE_GENERATION_FAILED (no fallback)
    const failFetch = makeFakeTransport({ generationB64: fixturePng, failMode: '401' });
    const resFail = await imageGenerationInstance.generateImage({
      prompt: 'airplane',
      providerOverride: 'NINEROUTER',
      generationId: 'gid-9r-17',
      signal: null
    }, { fetch: failFetch });
    const noJump = resFail.success === false && /IMAGE_GENERATION_FAILED/.test(resFail.error);

    // c) DEACTIVATED provider override -> hard reject
    const resGemini = await imageGenerationInstance.generateImage({
      prompt: 'airplane',
      providerOverride: 'GEMINI',
      generationId: 'gid-9r-17b',
      signal: null
    }, { fetch: downFetch });
    const deactivatedReject = resGemini.success === false && /DEACTIVATED/.test(resGemini.error);

    const ok = probeUnavailable && noJump && deactivatedReject;
    recordTest('IMAGE-9R-17', 'NO silent jump (probe down, gateway down, deactivated override hard-rejected)', ok,
      `probe=${probeUnavailable}, noJump=${noJump}, deactivatedReject=${deactivatedReject}`);
  } catch (err) { recordTest('IMAGE-9R-17', 'No silent jump', false, err.message); }

  // ── LIVE GROUP (on-demand only) ──────────────────────────────────────────
  if (process.env.RUN_9R_LIVE === '1') {
    console.log('\n===============================================================');
    console.log('             LIVE GROUP: REAL 9ROUTER E2E (9R-LIVE-01)');
    console.log('===============================================================');
    try {
      const res = await imageGenerationInstance.generateImage({
        prompt: 'buatkan image pesawat terbang untuk presentasi enterprise',
        providerOverride: 'NINEROUTER',
        aspectRatio: '16:9',
        generationId: `gid-live-${Date.now()}`,
        signal: null
      });
      const art = res?.artifact;
      const verify = art ? imageGenerationInstance.verifyArtifact(art) : { renderable: false };
      const passed = res?.success === true && art && verify.renderable === true && fs.existsSync(art.localPath);
      recordTest('9R-LIVE-01', 'REAL 9Router E2E pesawat terbang enterprise', passed,
        `model=${art?.model}, ${art?.width}x${art?.height}, bytes=${art?.bytesSize}, url=${art?.url}, renderable=${verify.renderable}`);
    } catch (err) {
      recordTest('9R-LIVE-01', 'REAL 9Router E2E', false, err.message);
    }
  }

  // ── SUMMARY ─────────────────────────────────────────────────────────────
  console.log('\n===============================================================');
  console.log('                 TEST SUMMARY: IMAGE-9R-01 TO IMAGE-9R-17');
  console.log('===============================================================');
  let allPass = true;
  for (const t of testResults) {
    const statusStr = t.passed ? 'PASS' : 'FAIL';
    if (!t.passed) allPass = false;
    console.log(`${t.testId.padEnd(13)} ${statusStr.padEnd(8)} ${t.name}`);
  }
  console.log('===============================================================');
  console.log(`Overall Result: ${allPass ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log('===============================================================');

  process.exit(allPass ? 0 : 1);
}

runTests();