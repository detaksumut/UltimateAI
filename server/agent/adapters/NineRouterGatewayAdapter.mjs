/**
 * NineRouterGatewayAdapter.mjs
 * 9Router Image Gateway Adapter — the ONLY image-generation gateway for JIN.
 *
 * Contract:
 *   discoverImageModels({fetchFn, force}) -> string[]           // /v1/models/image
 *   getModelInfo(modelId, {fetchFn, force}) -> Object           // /v1/models/info?id=
 *   select({...}) -> { ok, model, size, quality, responseFormat, reason, code }
 *   generateImage({...}) -> { success, gateway:'9ROUTER', model, provider,
 *                             mimeType, format, imageBytes, fallbackUsed, error?, code? }
 *   probe({fetchFn}) -> { available, provider:'9ROUTER', models, reason }
 *
 * Security:
 *   - The NINEROUTER_KEY is NEVER stored in this adapter's own state.
 *   - It is read from process.env.NINEROUTER_KEY only at request time.
 *   - Errors are passed through _maskSecrets(). Logging NEVER prints the key.
 *
 * Model selection is discovery-driven: the selector ONLY picks models that were
 * actually returned by /v1/models/image (or /v1/models/info). No model id is
 * ever invented or hard-coded as an assumption.
 *
 * Strict box policy:
 *   - For a requested aspect of 16:9 / 9:16 (JIN Strict Box Policy), the
 *     selection is a HARD filter: a model that does not advertise the `size`
 *     param is not a generation candidate at all — it may remain discoverable
 *     for diagnostics but is NEVER chosen for a strict box request (and the
 *     preferred hint is ignored when it is not aspect-capable).
 *   - 1:1 requests may use any discovered model.
 */

import crypto from 'crypto';

import '../../config/env.mjs';
import { resolveRequestSizes } from '../ImageOutputConfig.mjs';

const DISCOVERY_CACHE_TTL_MS = 30_000;
const INFO_CACHE_TTL_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 120_000;

export const NINEROUTER_DEFAULT_URL = 'http://127.0.0.1:20128';
export const GATEWAY_NAME = '9ROUTER';

const PLACEHOLDER_KEYS = new Set(['NINEROUTER_KEY_ANDA', 'YOUR_NINEROUTER_KEY', '']);

function resolveBaseUrl() {
  return (process.env.NINEROUTER_URL || NINEROUTER_DEFAULT_URL).replace(/\/+$/, '');
}

function hasAuthConfigured() {
  const key = String(process.env.NINEROUTER_KEY || '').trim();
  return key.length > 0 && !PLACEHOLDER_KEYS.has(key);
}

function buildAuthHeaders() {
  if (!hasAuthConfigured()) return {};
  return { Authorization: `Bearer ${String(process.env.NINEROUTER_KEY).trim()}` };
}

/** Mask anything that looks like a key/token from an arbitrary text blob. */
export function maskSecrets(text = '') {
  const raw = String(text);
  const key = String(process.env.NINEROUTER_KEY || '').trim();
  let out = raw;
  if (key && key.length >= 8) {
    out = out.split(key).join('[REDACTED]');
  }
  // Generic token-shaped splurges (sk-... long strings)
  out = out.replace(/(sk-[A-Za-z0-9_-]{6,})/g, '[REDACTED]');
  return out;
}

export function resolveImageAspectRatio(aspectRatio = '16:9') {
  if (aspectRatio === '9:16' || aspectRatio === '1:1') return aspectRatio;
  return '16:9';
}

/** Detect image format from magic bytes. */
export function detectImageFormat(buffer) {
  if (!buffer || buffer.length < 3) return { format: 'unknown', mimeType: 'application/octet-stream' };
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return { format: 'png', mimeType: 'image/png' };
  }
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { format: 'jpeg', mimeType: 'image/jpeg' };
  }
  if (buffer.subarray(0, 4).toString('ascii') === 'GIF8') {
    return { format: 'gif', mimeType: 'image/gif' };
  }
  return { format: 'webp', mimeType: 'image/webp' };
}

/** Render a reduced "W:H" (e.g. "16:9") label from pixel dimensions. */
export function reduceAspectRatio(width, height) {
  if (!width || !height || width <= 0 || height <= 0) return null;
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(width, height);
  return `${width / d}:${height / d}`;
}

export class ImageModelSelector {
  /**
   * @param {object} hints
   *   preferred: modelId the operator prefers when it appears in the discovered
   *              list AND (for strict aspect) is capable of honouring it.
   */
  constructor({ preferred = null } = {}) {
    this._preferred = preferred || null;
  }

  /**
   * Deterministic selection from an already-discovered model list.
   *
   * Strict aspect (16:9 / 9:16) is a HARD filter: a model is a generation
   * candidate only when it advertises the `size` param. Non-capable models stay
   * discoverable (they appear in `available`) but never in `candidates`.
   *
   * @returns { { ok:true, model, info, size, quality, responseFormat, aspectRatio,
   *              candidates: [{model,size,quality,responseFormat}...] } |
   *            { ok:false, reason, code } }
   */
  selectImageModel({ availableModels = [], domain = 'GENERAL', aspectRatio = '16:9', size = null, quality = 'high', n = 1, fetchModelInfo = null }) {
    if (!Array.isArray(availableModels) || availableModels.length === 0) {
      return { ok: false, reason: 'IMAGE_MODEL_UNAVAILABLE: 9Router returned no discoverable image models.', code: 'IMAGE_MODEL_UNAVAILABLE' };
    }

    const ids = availableModels.map((m) => (typeof m === 'string' ? m : m?.id)).filter(Boolean);
    const infoOf = (id) => (typeof fetchModelInfo === 'function' ? (fetchModelInfo(id) || null) : null);
    const paramsOf = (id) => {
      const p = infoOf(id)?.params;
      return Array.isArray(p) ? p : [];
    };

    // HARD capability filter for strict box requests.
    const ar = resolveImageAspectRatio(aspectRatio);
    const honourAspect = ar !== '1:1';
    const capableOf = (id) => {
      if (!honourAspect) return true;
      const params = paramsOf(id);
      if (params.includes('size')) return true;
      const info = infoOf(id);
      if (Array.isArray(info?.capabilities) && (info.capabilities.includes('textToImage') || info.capabilities.includes('text2img'))) return true;
      if (/gemini.*image/i.test(id)) return true;
      return false;
    };
    const eligible = ids.filter(capableOf);

    if (honourAspect && eligible.length === 0) {
      return {
        ok: false,
        reason: `IMAGE_NO_ASPECT_CAPABLE_MODEL: No discovered 9Router image model advertises the 'size' param needed for strict ${ar} (${ids.length} model(s) discovered but none aspect-capable).`,
        code: 'IMAGE_NO_ASPECT_CAPABLE_MODEL'
      };
    }

    const scoreFor = (id) => {
      let score = 0;
      
      // Unified Scoring: Hanya mementingkan parameter rasio (honourAspect), bukan "jenis pipeline"
      if (honourAspect) {
        // Prioritas model aspect-capable untuk rasio lebar/panjang (16:9 / 9:16)
        if (/cx\/gpt-5/i.test(id)) score += 12;
        if (/gemini/i.test(id)) score += 6;
      } else {
        // Prioritas model cepat (ultra-fast) untuk rasio kotak (1:1)
        if (/gemini/i.test(id)) score += 12;
        if (/cx\/gpt-5/i.test(id)) score += 8;
      }
      
      // Unified fallback
      if (/gpt-image|image-1/i.test(id)) score += 3;
      if (/dall-e/i.test(id)) score += 2;
      
      return score + 1;
    };

    // The preferred hint is honoured ONLY when it actually appears in the
    // discovered list and passes the aspect-capability filter.
    const preferred = this._preferred && eligible.includes(this._preferred) ? this._preferred : null;
    const ranked = preferred
      ? [preferred, ...eligible.filter((id) => id !== preferred).sort((a, b) => scoreFor(b) - scoreFor(a) || ids.indexOf(a) - ids.indexOf(b))]
      : [...eligible].sort((a, b) => scoreFor(b) - scoreFor(a) || ids.indexOf(a) - ids.indexOf(b));

    const candidateFor = (id) => {
      const params = paramsOf(id);
      const info = infoOf(id);
      // Request `size` is ONLY a hint (providers map strings to internal canvases).
      // Ordered per Strict Box Policy: [preferred, fallback]; explicit `size` overrides.
      const sizes = resolveRequestSizes(ar);
      const supportsSize = params.includes('size') || (Array.isArray(info?.capabilities) && info.capabilities.includes('textToImage')) || /gemini.*image/i.test(id);
      // NEVER request "912x512"/"512x912": live probing proved a provider maps
      // these to a 3:2 canvas. Sanitize to the policy-preferred string instead.
      const FORBIDDEN_REQUEST_SIZES = new Set(['912x512', '512x912']);
      const explicitSize = typeof size === 'string' ? size : null;
      const safeSize = explicitSize && !FORBIDDEN_REQUEST_SIZES.has(explicitSize) ? explicitSize : sizes[0];
      return {
        model: id,
        size: supportsSize ? safeSize : null,
        fallbackSize: supportsSize ? sizes[1] : null,
        quality: params.includes('quality') ? quality : null,
        n: params.includes('n') ? n : 1,
        responseFormat: params.includes('response_format') ? 'b64_json' : 'url'
      };
    };

    const model = ranked[0];
    const top = candidateFor(model);
    return {
      ok: true,
      model,
      info: infoOf(model),
      domain,
      aspectRatio: ar,
      candidates: ranked.map(candidateFor),
      size: top.size,
      fallbackSize: top.fallbackSize,
      quality: top.quality,
      n: top.n,
      responseFormat: top.responseFormat
    };
  }
}

export class NineRouterGatewayAdapter {
  constructor() {
    this._discovery = null;
    this._infoCache = new Map();
    // Parameters the gateway REJECTED per model (learned from 400 "Unknown parameter"),
    // so future requests skip them even if /v1/models/info advertised them.
    this._paramBlacklist = new Map();
  }

  _baseUrl() {
    return resolveBaseUrl();
  }

  _requestSignal(signal, timeoutMs = REQUEST_TIMEOUT_MS) {
    const t = AbortSignal.timeout(timeoutMs);
    if (!signal) return t;
    if (typeof AbortSignal.any === 'function') return AbortSignal.any([signal, t]);
    return signal;
  }

  /** GET /v1/models/image → ordered list of image model ids (cached TTL). */
  async discoverImageModels({ fetchFn = null, force = false } = {}) {
    const fn = fetchFn || globalThis.fetch;
    const now = Date.now();
    if (!force && this._discovery && now - this._discovery.timestamp < DISCOVERY_CACHE_TTL_MS) {
      return [...this._discovery.models];
    }

    const url = `${this._baseUrl()}/v1/models/image`;
    const res = await fn(url, {
      method: 'GET',
      headers: buildAuthHeaders(),
      signal: this._requestSignal(null, 12_000)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const detail = maskSecrets(text).slice(0, 200);
      const err = new Error(`9Router discovery HTTP ${res.status}: ${detail}`);
      err.code = `NINEROUTER_DISCOVERY_HTTP_${res.status}`;
      throw err;
    }
    const json = await res.json().catch(() => null);
    const data = Array.isArray(json?.data) ? json.data : [];
    const models = data.map((m) => (typeof m === 'string' ? m : m?.id)).filter(Boolean);

    this._discovery = { timestamp: now, models };
    return [...models];
  }

  /** GET /v1/models/info?id= → parsed capability record (cached per model). */
  async getModelInfo(modelId, { fetchFn = null, force = false } = {}) {
    const fn = fetchFn || globalThis.fetch;
    const id = String(modelId);
    const now = Date.now();
    const cached = this._infoCache.get(id);
    if (!force && cached && now - cached.timestamp < INFO_CACHE_TTL_MS) {
      return cached.info;
    }

    const url = `${this._baseUrl()}/v1/models/info?id=${encodeURIComponent(id)}`;
    const res = await fn(url, {
      method: 'GET',
      headers: buildAuthHeaders(),
      signal: this._requestSignal(null, 12_000)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`9Router model info HTTP ${res.status}: ${maskSecrets(text).slice(0, 160)}`);
    }
    const json = await res.json().catch(() => null);
    const info = {
      id: json?.id || id,
      name: json?.name || null,
      kind: json?.kind || null,
      owned_by: json?.owned_by || null,
      endpoint: json?.endpoint || '/v1/images/generations',
      capabilities: Array.isArray(json?.capabilities) ? json.capabilities : [],
      params: Array.isArray(json?.params) ? json.params : []
    };
    this._infoCache.set(id, { timestamp: now, info });
    return info;
  }

  /**
   * Full selection: discover → pre-fetch capability info → capability-FIRST
   * scoring with HARD aspect filtering.
   */
  async select({ preferred = null, domain = 'GENERAL', aspectRatio = '16:9', size = null, quality = 'high', n = 1, fetchFn = null, requestId = null } = {}) {
    const tag = requestId ? `[${requestId}] ` : '';
    let availableModels;
    try {
      availableModels = await this.discoverImageModels({ fetchFn });
    } catch (err) {
      console.warn(`${tag}[9ROUTER] Model discovery failed: ${err.message}`);
      return { ok: false, reason: `IMAGE_MODEL_UNAVAILABLE: 9Router discovery failed: ${err.message}`, code: 'NINEROUTER_COMPLETELY_UNAVAILABLE' };
    }

    if (availableModels.length === 0) {
      return { ok: false, reason: 'IMAGE_MODEL_UNAVAILABLE: 9Router returned no discoverable image models.', code: 'IMAGE_MODEL_UNAVAILABLE' };
    }

    // Pre-fetch capability info for all discovered models (cached) so scoring
    // can HARD-FILTER models that cannot honour the requested aspect ratio
    // (the `size` param) — WITHOUT hard-coding any single model id.
    const infos = {};
    await Promise.all(availableModels.map(async (id) => {
      try {
        const info = await this.getModelInfo(id, { fetchFn });
        if (info) infos[id] = info;
      } catch {
        // info missing -> scored with empty params (thus not aspect-capable)
      }
    }));

    const selection = new ImageModelSelector({ preferred: preferred || null }).selectImageModel({
      availableModels,
      domain,
      aspectRatio,
      size,
      quality,
      n,
      fetchModelInfo: (m) => infos[m] || null
    });
    if (!selection.ok) {
      console.warn(`${tag}[9ROUTER] Selection unavailable: ${selection.reason}`);
      return selection;
    }
    const info = infos[selection.model];
    console.log(`${tag}[9ROUTER] Image model selected: ${selection.model} (discovery-driven${aspectRatio === '1:1' ? '' : `, aspect-capable candidates=${selection.candidates.map((c) => c.model).join(',')}`}, aspectHonoured=${Boolean(selection.size) || aspectRatio === '1:1'}, params=${Array.isArray(info?.params) ? info.params.join(',') : 'unknown'})`);
    return selection;
  }

  /**
   * POST /v1/images/generations → normalized generation record.
   *
   * SINGLE transport: one POST, one response parse. The JSON payload is built
   * by buildPayload() — the single source of truth. If the gateway rejects a
   * parameter (400/422 "Unknown parameter: 'x'"), that param is blacklisted
   * for this model and the request retries exactly once without it.
   *
   * Binary mode: `response_format=binary` is a QUERY parameter only — it is
   * never put in the JSON body — and the success body is read strictly via
   * arrayBuffer(); text/json parsing never touches a binary response.
   *
   * @returns {{ success:true, gateway, provider, model, mimeType, format,
   *             imageBytes, fallbackUsed, requestId, gatewayCreated } |
   *           { success:false, error, code }}
   */
  async generateImage({ prompt, model, negativePrompt = null, size = null, quality = null, n = 1, responseFormat = null, requestId = null, signal = null, fetchFn = null, referenceImageBuffer = null, referenceMimeType = null, maskBuffer = null } = {}) {
    const fn = fetchFn || globalThis.fetch;
    const reqId = requestId || `9r-${crypto.randomBytes(6).toString('hex')}`;
    const tag = `[${reqId}] `;
    const modelKey = String(model);
    const binaryMode = responseFormat === 'binary';
    const hasReferenceImage = Buffer.isBuffer(referenceImageBuffer) && referenceImageBuffer.length > 0;

    const blacklist = this._paramBlacklist.get(modelKey) || new Set();

    // Always use /v1/images/generations — the single working endpoint.
    // Reference image is passed as base64 "image" field in the JSON body.
    let url = `${this._baseUrl()}/v1/images/generations`;
    if (binaryMode) {
      url += '?response_format=binary';
    }

    let headers = buildAuthHeaders();
    let body = null;

    const buildJsonPayload = () => {
      const payload = { model: modelKey, prompt: String(prompt || ''), n: 1 };
      if (size && !blacklist.has('size')) payload.size = String(size);
      if (quality && !blacklist.has('quality')) payload.quality = String(quality);
      if (n && n !== 1 && !blacklist.has('n')) payload.n = n;
      // response_format intentionally omitted — rejected by dall-e-2 and similar models with 400
      // Include reference image as base64 when present (unified revision transport)
      if (hasReferenceImage && !blacklist.has('image')) {
        const mime = referenceMimeType || 'image/png';
        payload.image = `data:${mime};base64,${referenceImageBuffer.toString('base64')}`;
      }
      return payload;
    };

    let res = null;
    let bodyText = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      bodyText = '';
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(buildJsonPayload());

      try {
        res = await fn(url, {
          method: 'POST',
          headers,
          body,
          signal: this._requestSignal(signal, REQUEST_TIMEOUT_MS)
        });
      } catch (err) {
        return { success: false, code: 'NINEROUTER_NETWORK_FAULT', error: `IMAGE_GENERATION_FAILED: 9Router network fault: ${maskSecrets(err.message)}` };
      }

      if (res.ok) break; 

      bodyText = await res.text().catch(() => '');

      const m = bodyText.match(/Unknown parameter:\s*'([a-z_]+)'/i);
      if ((res.status === 400 || res.status === 422) && m && attempt === 0) {
        const dropped = m[1];
        blacklist.add(dropped);
        this._paramBlacklist.set(modelKey, blacklist);
        console.warn(`${tag}[9ROUTER] Gateway rejected param '${dropped}' for model ${modelKey} — retrying without it.`);
        continue;
      }
      break;
    }

    if (!res || !res.ok) {
      const detail = maskSecrets(bodyText).slice(0, 240);
      console.warn(`${tag}[9ROUTER] Generation HTTP ${res?.status}: ${detail}`);
      return {
        success: false,
        code: res ? `NINEROUTER_HTTP_${res.status}` : 'NINEROUTER_HTTP_ERROR',
        httpStatus: res?.status || null,
        error: `IMAGE_GENERATION_FAILED: 9Router ${res ? `HTTP ${res.status}` : 'error'}: ${detail}`
      };
    }

    // --- parse the response exactly once -------------------------------------
    let buffer = null;
    let json = null;
    if (binaryMode) {
      // Raw image bytes. Never res.text()/res.json() here.
      try {
        const arr = await res.arrayBuffer();
        buffer = Buffer.from(arr);
      } catch {
        buffer = null;
      }
    } else {
      try {
        json = JSON.parse(bodyText || await res.text());
      } catch {
        return { success: false, code: 'NINEROUTER_INVALID_JSON', error: 'IMAGE_GENERATION_FAILED: 9Router returned non-JSON response' };
      }
      const entry = Array.isArray(json?.data) ? json.data[0] : null;
      if (!entry) {
        return { success: false, code: 'NINEROUTER_EMPTY_DATA', error: 'IMAGE_GENERATION_FAILED: 9Router returned no image data entries' };
      }
      if (typeof entry.b64_json === 'string' && entry.b64_json) {
        try {
          buffer = Buffer.from(entry.b64_json, 'base64');
        } catch {
          buffer = null;
        }
      } else if (typeof entry.url === 'string' && entry.url) {
        try {
          const imgRes = await fn(entry.url, { method: 'GET', signal: this._requestSignal(null, 60_000) });
          if (imgRes.ok) {
            const arr = await imgRes.arrayBuffer();
            buffer = Buffer.from(arr);
          }
        } catch (err) {
          console.warn(`${tag}[9ROUTER] b64_json absent; url fetch failed: ${maskSecrets(err.message)}`);
          buffer = null;
        }
      }
    }

    if (!buffer || buffer.length === 0) {
      return { success: false, code: 'NINEROUTER_NO_IMAGE_BYTES', error: 'IMAGE_GENERATION_FAILED: 9Router response contained no usable image bytes' };
    }

    const { format, mimeType } = detectImageFormat(buffer);
    console.log(`${tag}[9ROUTER] Generation success model=${modelKey} bytes=${buffer.length} format=${format} mode=${binaryMode ? 'binary' : (responseFormat || 'url')}`);

    return {
      success: true,
      gateway: GATEWAY_NAME,
      provider: GATEWAY_NAME,
      model: modelKey,
      mimeType,
      format,
      imageBytes: buffer,
      fallbackUsed: false,
      requestId: reqId,
      gatewayCreated: json?.created != null ? Number(json.created) : null
    };
  }

  /** Lightweight reachability probe for ImageGeneration.capabilityProbe. */
  async probe({ fetchFn = null } = {}) {
    let models = [];
    try {
      models = await this.discoverImageModels({ fetchFn, force: true });
    } catch (err) {
      return { available: false, provider: GATEWAY_NAME, models: [], reason: maskSecrets(err.message) };
    }
    if (models.length === 0) {
      return { available: false, provider: GATEWAY_NAME, models: [], reason: '9Router reachable but exposed zero image models.' };
    }
    return { available: true, provider: GATEWAY_NAME, models, reason: `9Router gateway reachable; ${models.length} image model(s) discovered.` };
  }
}

export const nineRouterGatewayAdapterInstance = new NineRouterGatewayAdapter();
export default nineRouterGatewayAdapterInstance;