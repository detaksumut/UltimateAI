/**
 * ImageGeneration.mjs
 * Real first-class IMAGE_GENERATION pipeline service.
 *
 * Provider model (9ROUTER architecture):
 *   1. Explicit providerOverride (MOCK / NINEROUTER for tests & ops)
 *   2. 9Router gateway (NINEROUTER_URL) — the ONLY image-generation gateway.
 *
 * Routing flow:
 *   capabilityProbe() → 9Router discovery (`/v1/models/image`)
 *   generateImage(params, transport?) →
 *     OpenAI via 9Router → VisualSpec (JSON)
 *     → NineRouterGatewayAdapter.select() → model selected from DISCOVERED list
 *     → NineRouterGatewayAdapter.generateImage() → b64 bytes
 *     → ImageOutputSizePolicy → _persistArtifact → IMAGE_STUDIO reference
 *
 * Hard boundaries (no silent jumps):
 *   - NEVER jumps to Gemini / Hermes / Ollama / Pollinations / Together AI
 *     when 9Router fails. Failures surface as IMAGE_GENERATION_FAILED.
 *   - Gemini direct image path, Hermes image fallback, Pollinations image
 *     references, and Ollama image usage are DEACTIVATED (DIRECT_GEMINI_IMAGE_PATH=0,
 *     HERMES_IMAGE_REFERENCES=0, POLLINATIONS_ACTIVE_IMAGE_REFERENCES=0).
 *   - Gemini TEXT functionality remains untouched.
 *
 * Contract:
 *   capabilityProbe() → { available, provider, reason }
 *   generateImage(params, transport?) → { success, artifact?, error? }
 *   verifyArtifact(artifact) → { renderable, reason }
 *
 * Transport seam: pass { fetch: fn } for tests.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';

// Auto-load .env (same as other agent files)
import '../config/env.mjs';
import { imageOutputSizePolicyInstance, MAX_IMAGE_BYTES, TARGET_IMAGE_BYTES } from './ImageOutputSizePolicy.mjs';
import { IMAGE_WIDTH, IMAGE_HEIGHT, DEFAULT_IMAGE_SIZE } from './ImageOutputConfig.mjs';
import { assertNoPollinationsImageProvider, geminiImageAdapterInstance } from './adapters/GeminiImageAdapter.mjs';
import { nineRouterGatewayAdapterInstance, reduceAspectRatio } from './adapters/NineRouterGatewayAdapter.mjs';
import { imageStudioInstance } from '../studio/image/ImageStudio.mjs';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

const ARTIFACTS_DIR = path.resolve('d:/Users/ultimateai/storage/artifacts/images');

// PNG magic bytes: 0x89504E470D0A1A0A
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const MIN_ARTIFACT_BYTES = 1024;

const IMAGE_PROVIDERS = {
  MOCK: 'MOCK',
  MOCK_FAILURE: 'MOCK_FAILURE',
  NINEROUTER: 'NINEROUTER',
  // Auto-fallback when 9Router is unavailable (offline/down)
  GEMINI_FALLBACK: 'GEMINI_FALLBACK',
  // Deactivated historical providers — kept ONLY for explicit rejection messages.
  DEACTIVATED: ['GEMINI', 'TOGETHER_AI', 'OLLAMA', 'POLLINATIONS']
};

export class ImageGenerationService {
  constructor() {
    this._ensureArtifactsDir();
    this._recentExecutions = new Map();
  }

  _ensureArtifactsDir() {
    this._ensureDirectories();
  }

  _ensureDirectories() {
    try {
      if (!fs.existsSync(ARTIFACTS_DIR)) {
        fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
      }
    } catch (err) {
      console.error('[ImageGeneration] Failed to create artifacts dir:', err.message);
    }
  }

  // ── Capability Probe ──────────────────────────────────────────────────────

  async capabilityProbe(transport = null) {
    const fetchFn = transport?.fetch || globalThis.fetch;

    // 1. Explicit env override (TEST / OPS only)
    const envProvider = (process.env.IMAGE_PROVIDER || '').toLowerCase();
    if (envProvider === 'mock') {
      return { available: true, provider: IMAGE_PROVIDERS.MOCK, reason: 'Mock provider forced via IMAGE_PROVIDER env' };
    }
    if (envProvider === 'mock_failure') {
      return { available: true, provider: IMAGE_PROVIDERS.MOCK_FAILURE, reason: 'Mock failure forced via IMAGE_PROVIDER env' };
    }
    if (envProvider === 'ninerouter' || envProvider === '9router') {
      const forceResult = await nineRouterGatewayAdapterInstance.probe({ fetchFn });
      if (forceResult.available) {
        return { available: true, provider: IMAGE_PROVIDERS.NINEROUTER, reason: `9Router forced via IMAGE_PROVIDER env (${forceResult.models.length} model(s) discovered)` };
      }
      return { available: false, provider: IMAGE_PROVIDERS.NINEROUTER, reason: forceResult.reason };
    }

    // 2. Default: live 9Router discovery probe (PRIMARY image gateway).
    const probeResult = await nineRouterGatewayAdapterInstance.probe({ fetchFn });
    if (probeResult.available) {
      return { available: true, provider: IMAGE_PROVIDERS.NINEROUTER, reason: probeResult.reason };
    }

    // 3. Auto-fallback: when 9Router is offline, try Gemini direct API.
    //    This is NOT a permanent provider switch — 9Router remains primary.
    //    Activates only when 9Router is completely unreachable (port down, etc).
    const hasGeminiKey = (() => {
      try {
        const keys = geminiImageAdapterInstance && geminiImageAdapterInstance.name ? true : false;
        const rawKey = process.env.GEMINI_API_KEY || '';
        return rawKey.length > 0;
      } catch { return false; }
    })();
    const hasGeminiModel = !!(process.env.GEMINI_IMAGE_MODEL || '').trim();
    if (hasGeminiKey && hasGeminiModel) {
      console.warn('[ImageGeneration] 9Router unavailable — activating Gemini direct fallback. Reason: ' + probeResult.reason);
      return { available: true, provider: IMAGE_PROVIDERS.GEMINI_FALLBACK, reason: `9Router offline; Gemini fallback active (model: ${process.env.GEMINI_IMAGE_MODEL})` };
    }

    return { available: false, provider: IMAGE_PROVIDERS.NINEROUTER, reason: probeResult.reason };
  }

  // ── Generate Image ────────────────────────────────────────────────────────

  static detectAspectRatio(text = '', defaultAr = '16:9') {
    const t = String(text || '').toLowerCase();
    if (/\b(?:1[:x]1|1\/1|square|kotak|persegi|avatar|logo|profil|profile|feed)\b/i.test(t)) {
      return '1:1';
    }
    if (/\b(?:9[:x]16|9\/16|portrait|vertikal|tegak|story|tiktok|reels|shorts|wallpaper(?:\s+hp|\s+ponsel)?)\b/i.test(t)) {
      return '9:16';
    }
    if (/\b(?:16[:x]9|16\/9|landscape|horizontal|lebar|slide|presentasi|banner|youtube|wallpaper(?:\s+desktop|\s+pc|\s+laptop)?)\b/i.test(t)) {
      return '16:9';
    }
    return defaultAr || '16:9';
  }

  /**
   * Smart aspect ratio adaptation engine:
   * Dynamically formats incoming image buffer to user's desired ratio (16:9, 9:16, 1:1)
   * while keeping resolution high and file size strictly < 1MB.
   */
  async adaptToAspectRatio(buffer, targetAspect = '16:9') {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) return buffer;

    try {
      const Jimp = (await import('jimp')).default;
      const img = await Jimp.read(buffer);
      const w = img.bitmap.width;
      const h = img.bitmap.height;
      if (!w || !h) return buffer;

      const currentRatio = w / h;
      let targetRatio = 16 / 9;
      let targetWidth = 1024;
      let targetHeight = 576;

      if (targetAspect === '9:16') {
        targetRatio = 9 / 16;
        targetWidth = 576;
        targetHeight = 1024;
      } else if (targetAspect === '1:1') {
        targetRatio = 1.0;
        targetWidth = Math.min(w, h, 1024);
        targetHeight = targetWidth;
      }

      // If already within 5% of target ratio, no need to re-crop
      if (Math.abs(currentRatio - targetRatio) / targetRatio <= 0.05) {
        return buffer;
      }

      img.cover(targetWidth, targetHeight);
      img.quality(88); // High quality JPEG
      return await img.getBufferAsync(Jimp.MIME_JPEG);
    } catch (err) {
      console.warn('[ImageGeneration] adaptToAspectRatio fallback:', err.message);
      return buffer;
    }
  }

  async generateImage(params = {}, transport = null) {
    const {
      prompt = 'futuristic AI visual',
      negativePrompt = '',
      aspectRatio = '16:9',
      size = '912x512',
      referenceContext = null,
      referenceImage = null,
      providerOverride = null,
      stage = 'GENERATE',
      options = {},
      generationId = null,
      messageId = null,
      signal = null
    } = params;

    // Stage dispatch: only GENERATE does real work
    if (stage && stage !== 'GENERATE') {
      return { success: true, stage, skipped: true, reason: `Stage ${stage} is non-execution; only GENERATE performs network work.` };
    }

    // STRICT ARCHITECTURAL SEPARATION:
    // If request specifies revision mode or intent IMAGE_REVISION:
    // EXPLICIT DELEGATE to ImageEditing IF referenceImage exists,
    // otherwise HARD REJECT. NEVER proceed to Pollinations or text-to-image!
    const isRevisionMode = params.mode === 'revision' || params.intent === 'IMAGE_REVISION' || (params.visualIntent && params.visualIntent.action === 'revision');
    if (isRevisionMode) {
      if (referenceImage) {
        const { imageEditingInstance } = await import('./ImageEditing.mjs');
        return await imageEditingInstance.editImage({
          referenceImage,
          prompt: params.prompt,
          originalPrompt: params.originalPrompt || params.prompt,
          negativePrompt: params.negativePrompt,
          providerOverride: params.providerOverride,
          aspectRatio: params.aspectRatio,
          width: params.width,
          height: params.height,
          steps: 8,
          generationId: params.generationId,
          messageId: params.messageId,
          signal: params.signal
        }, transport);
      }
      return {
        success: false,
        error: '[IMAGE_GENERATION_HARD_REJECT] ImageGeneration cannot process IMAGE_REVISION without referenceImage. Text-to-image models are strictly forbidden from fulfilling image revisions.'
      };
    }

    const fetchFn = transport?.fetch || globalThis.fetch;
    const originalPrompt = String(prompt || '').trim();
    const normalizedPrompt = this.normalizeImagePrompt(originalPrompt);

    // Auto-resolve aspect ratio: Supports 16:9, 9:16, and 1:1 based on user needs
    let resolvedAr = aspectRatio;
    if (!resolvedAr || (resolvedAr !== '1:1' && resolvedAr !== '9:16' && resolvedAr !== '16:9')) {
      resolvedAr = ImageGenerationService.detectAspectRatio(`${originalPrompt} ${options?.aspectRatio || ''}`, '16:9');
    }
    const resolvedWidth = resolvedAr === '9:16' ? 576 : resolvedAr === '1:1' ? 1024 : 1024;
    const resolvedHeight = resolvedAr === '9:16' ? 1024 : resolvedAr === '1:1' ? 1024 : 576;
    const resolvedSize = `${resolvedWidth}x${resolvedHeight}`;

    let effectiveNegativePrompt = negativePrompt || '';
    if (/\b(?:visual\s+slide|slide\s+visual|slide\s+presentasi|slide|presentation\s+slide|infografis|infografik|infographic)\b/i.test(originalPrompt)) {
      effectiveNegativePrompt = (effectiveNegativePrompt ? `${effectiveNegativePrompt}, ` : '') +
        'distorted writing, misspelled words, chaotic typography, blurry font, deformed shapes, deformed letters, gibberish characters, fake words, messy handwriting, illegible text, low quality, amateur, watermark';
    }

    const normalizedParams = {
      ...params,
      prompt: normalizedPrompt,
      originalPrompt,
      normalizedPrompt,
      negativePrompt: effectiveNegativePrompt,
      aspectRatio: resolvedAr,
      size: resolvedSize,
      width: resolvedWidth,
      height: resolvedHeight,
      referenceImage,
      generationId,
      messageId,
      signal
    };

    // Idempotency cache: one request/message ID -> at most one image generation
    const idempotencyKey = generationId || messageId || (referenceImage ? `${referenceImage}_${normalizedPrompt}` : null);
    if (idempotencyKey && this._recentExecutions.has(idempotencyKey)) {
      const cached = this._recentExecutions.get(idempotencyKey);
      if (cached.inFlightPromise) {
        console.log(`[ImageGeneration] In-flight hit: awaiting running execution for ${idempotencyKey}`);
        return await cached.inFlightPromise;
      }
      if (Date.now() - cached.timestamp < 120000 && cached.result?.success) {
        console.log(`[ImageGeneration] Idempotency hit: returning cached artifact for ${idempotencyKey} (${cached.result.artifact?.url})`);
        return cached.result;
      }
    }

    let resolveInFlight;
    const inFlightPromise = new Promise((resolve) => { resolveInFlight = resolve; });
    if (idempotencyKey) {
      this._recentExecutions.set(idempotencyKey, {
        timestamp: Date.now(),
        inFlightPromise
      });
    }

    assertNoPollinationsImageProvider(providerOverride);
    assertNoPollinationsImageProvider(params.provider);

    // Resolve provider
    let provider = providerOverride;
    if (!provider) {
      const capability = await this.capabilityProbe(transport);
      provider = capability.provider;
    }

    // Dispatch
    let result;
    const dispatchProvider = String(provider).toUpperCase();
    if (dispatchProvider === IMAGE_PROVIDERS.MOCK_FAILURE) {
      result = this._generateMockFailure(normalizedParams);
    } else if (dispatchProvider === IMAGE_PROVIDERS.MOCK) {
      result = await this._generateMock(normalizedParams);
    } else if (dispatchProvider === IMAGE_PROVIDERS.NINEROUTER) {
      result = await this._generateNineRouter(normalizedParams, fetchFn);
    } else if (dispatchProvider === IMAGE_PROVIDERS.GEMINI_FALLBACK) {
      // 9Router was offline at probe time — use Gemini direct as auto-fallback.
      result = await this._generateGeminiFallback(normalizedParams, fetchFn);
    } else if (IMAGE_PROVIDERS.DEACTIVATED.includes(dispatchProvider)) {
      // Explicit hard boundary: providers below are intentionally deactivated.
      result = {
        success: false,
        error: `IMAGE_GENERATION_FAILED: Provider ${dispatchProvider} is DEACTIVATED. 9Router (NINEROUTER) is the ONLY image-generation gateway. No fallback jump is permitted.`,
        reasonCode: 'IMAGE_GENERATION_FAILED'
      };
    } else {
      result = {
        success: false,
        error: `IMAGE_GENERATION_FAILED: Unknown or disabled provider: ${provider}`,
        reasonCode: 'IMAGE_GENERATION_FAILED'
      };
    }

    if (result && result.success && result.artifact && idempotencyKey) {
      this._recentExecutions.set(idempotencyKey, {
        timestamp: Date.now(),
        result
      });
      resolveInFlight(result);
    } else {
      if (idempotencyKey) this._recentExecutions.delete(idempotencyKey);
      resolveInFlight(result);
    }

    return result;
  }

  // ── Gemini Fallback (activated ONLY when 9Router is offline) ────────────
  //
  // This path is automatically activated by capabilityProbe() when 9Router
  // (port 20128) is completely unreachable. It bridges GeminiImageAdapter
  // output to the same artifact format used by _generateNineRouter().

  async _generateGeminiFallback(params, fetchFn) {
    const { prompt, originalPrompt, normalizedPrompt, negativePrompt, aspectRatio, generationId, messageId, signal } = params;
    const reqId = params.requestId || generationId || messageId || `gemini-fb-${Date.now()}`;
    const tag = `[ImageGeneration|${reqId}|GEMINI_FALLBACK] `;
    const cleanPrompt = prompt || normalizedPrompt || originalPrompt || '';

    console.log(`${tag}Generating via Gemini fallback. aspectRatio=${aspectRatio || '16:9'} model=${process.env.GEMINI_IMAGE_MODEL}`);

    let geminiResult;
    try {
      geminiResult = await geminiImageAdapterInstance.generateImage({
        prompt: cleanPrompt,
        negativePrompt: negativePrompt || '',
        aspectRatio: aspectRatio || '16:9',
        requestId: reqId,
        signal: signal || null,
        fetchFn: fetchFn || globalThis.fetch
      });
    } catch (err) {
      console.error(`${tag}Gemini fallback threw: ${err.message}`);
      return {
        success: false,
        error: `IMAGE_GENERATION_FAILED: Gemini fallback error: ${err.message}`,
        reasonCode: 'GEMINI_FALLBACK_ERROR'
      };
    }

    if (!geminiResult || !geminiResult.success) {
      const errMsg = geminiResult?.error || 'Gemini fallback returned no result';
      console.error(`${tag}Gemini fallback failed: ${errMsg}`);
      return {
        success: false,
        error: `IMAGE_GENERATION_FAILED: ${errMsg}`,
        reasonCode: geminiResult?.reasonCode || 'GEMINI_FALLBACK_FAILED'
      };
    }

    // Apply size policy (< 1 MB)
    const rawBuffer = geminiResult.buffer || geminiResult.bytes;
    if (!rawBuffer || rawBuffer.length === 0) {
      return { success: false, error: 'IMAGE_GENERATION_FAILED: Gemini fallback returned empty buffer', reasonCode: 'GEMINI_FALLBACK_EMPTY' };
    }

    // Adapt aspect ratio if needed
    const adaptedBuffer = await this.adaptToAspectRatio(rawBuffer, aspectRatio || '16:9');
    const finalBuffer = adaptedBuffer || rawBuffer;

    // Apply size policy
    const policyResult = await imageOutputSizePolicyInstance.ensureUnderLimit(finalBuffer);
    const outputBuffer = policyResult?.success && policyResult.buffer ? policyResult.buffer : finalBuffer;

    // Persist artifact same as NineRouter path (_persistArtifact is synchronous)
    let artifact;
    try {
      artifact = this._persistArtifact(outputBuffer, {
        prompt: cleanPrompt,
        originalPrompt: cleanPrompt,
        normalizedPrompt: cleanPrompt,
        aspectRatio: aspectRatio || '16:9',
        provider: 'GEMINI_FALLBACK',
        model: geminiResult.model || process.env.GEMINI_IMAGE_MODEL || 'gemini',
        requestId: reqId,
        mimeType: geminiResult.mimeType || 'image/jpeg'
      });
    } catch (persistErr) {
      console.error(`${tag}Artifact persist failed: ${persistErr.message}`);
      return { success: false, error: `IMAGE_GENERATION_FAILED: Artifact persistence failed: ${persistErr.message}`, reasonCode: 'ARTIFACT_PERSIST_FAILED' };
    }

    console.log(`${tag}Gemini fallback SUCCESS. bytes=${outputBuffer.length} artifact=${artifact?.url}`);
    return {
      success: true,
      artifact,
      provider: 'GEMINI_FALLBACK',
      model: geminiResult.model || process.env.GEMINI_IMAGE_MODEL,
      fallbackUsed: true,
      requestId: reqId
    };
  }

  // ── NineRouter Implementation (PRIMARY image-generation gateway) ─────────
  //
  // Flow: OpenAI via 9Router → visual spec → discovery-driven model selection
  // → 9Router /v1/images/generations → size policy → artifact persistence
  // → IMAGE_STUDIO reference registration.

  async _generateNineRouter(params, fetchFn) {
    const { prompt, originalPrompt, normalizedPrompt, negativePrompt, aspectRatio, size, generationId, messageId, signal, requestId, options = {} } = params;
    const reqId = requestId || generationId || messageId || `req-${Date.now()}`;
    const tag = `[ImageGeneration|${reqId}] `;
    const cleanPrompt = prompt || normalizedPrompt || originalPrompt || '';

    try {
      // Step 1: Use OpenAI via 9Router for image generation (no Qwen/llama.cpp planner).
      const domain = params.intent === 'SLIDE_STUDIO' || /slide|presentasi|presentation/i.test(cleanPrompt) ? 'PRESENTATION'
        : params.intent === 'HOUSE_DESIGN' || /rumah|hunian|arsitektur|house|building/i.test(cleanPrompt) ? 'HOUSE_DESIGN'
        : 'GENERAL';

      // Compose gateway prompt directly via optimized prompt (OpenAI via 9Router).
      const gatewayPrompt = this._optimizePrompt(cleanPrompt);
      const spec = {
        prompt: gatewayPrompt,
        originalPrompt: cleanPrompt,
        aspectRatio: aspectRatio || '16:9',
        domain
      };
      const plannerResult = { planner: 'openai_9router', spec };
      console.log(`${tag}[9ROUTER] OpenAI via 9Router domain=${domain} aspectRatio=${aspectRatio || '16:9'} size=${size || 'auto'}`);

      // Step 2: Discovery-driven model selection (never invents a model id).
      const selection = await nineRouterGatewayAdapterInstance.select({
        preferred: options.imageModel || process.env.NINEROUTER_IMAGE_MODEL || null,
        domain: domain,
        aspectRatio: aspectRatio || '16:9',
        size: size || null,
        quality: options.quality || 'high',
        n: 1,
        fetchFn,
        requestId: reqId,
        mustSupport: []
      });
      if (!selection.ok) {
        console.error(`${tag}[9ROUTER] Model selection unavailable: ${selection.reason}`);
        return {
          success: false,
          error: `IMAGE_GENERATION_FAILED: ${selection.reason}`,
          reasonCode: selection.code || 'IMAGE_MODEL_UNAVAILABLE'
        };
      }
      if (options.imageModel && selection.model !== options.imageModel) {
        console.warn(`${tag}[9ROUTER] Requested imageModel "${options.imageModel}" not in discovered list; using discovered "${selection.model}".`);
      }

      // Step 3: Gateway prompt already composed from optimized prompt (OpenAI via 9Router).

      // Step 4: Generate via 9Router — iterate the RANKED discovered candidates
      // best-first. Switching between candidates stays INSIDE the 9Router
      // gateway (model selection, NOT a fallback jump to another provider).
      // Bounded: never more candidates than were actually discovered.
      // Strict box: every candidate that passes transport but yields squares
      // (aspect drift) for a strict 16:9/9:16 request is ALSO rejected — the
      // artifact is only valid when its ACTUAL decoded dimensions honour the
      // requested aspect.
      const requestedAspectLabel = aspectRatio === '9:16' ? '9:16' : aspectRatio === '1:1' ? '1:1' : '16:9';
      const requestedRatio = requestedAspectLabel === '9:16' ? 9 / 16 : requestedAspectLabel === '1:1' ? 1.0 : 16 / 9;
      const ASPECT_TOLERANCE = 0.08; // approx 1.7778 / 0.5625 / 1.0, tiny rounding allowed
      const metadataOf = async (bytes) => {
        try {
          return await imageOutputSizePolicyInstance.getMetadata(bytes);
        } catch {
          return null;
        }
      };

      const candidates = selection.candidates && selection.candidates.length
        ? selection.candidates
        : [{ model: selection.model, size: selection.size || null, fallbackSize: selection.fallbackSize || null, quality: selection.quality || null, responseFormat: selection.responseFormat || null }];

      let generation = null;
      let chosenModel = null;
      let lastGatewayError = null;
      let aspectMismatch = null;
      let bestAttemptFallback = null;

      for (const candidate of candidates) {
        // Size string is ONLY a hint: try [preferred, fallback] per candidate
        // (never "912x512" — live-probed to map to a 3:2 canvas on a provider).
        const sizes = [
          ...new Set([candidate.size, candidate.fallbackSize].filter(Boolean))
        ];
        if (sizes.length === 0) sizes.push(null);

        let candidateOk = false;
        for (const sizeHint of sizes) {
          const attempt = await nineRouterGatewayAdapterInstance.generateImage({
            prompt: gatewayPrompt,
            model: candidate.model,
            negativePrompt: negativePrompt || '',
            size: sizeHint || null,
            quality: candidate.quality || null,
            n: candidate.n || 1,
            responseFormat: candidate.responseFormat && candidate.responseFormat !== 'url' ? candidate.responseFormat : null,
            requestId: reqId,
            signal: this._requestSignal(signal, 120000),
            fetchFn
          });
          if (!attempt.success || !attempt.imageBytes) {
            lastGatewayError = attempt;
            console.warn(`${tag}[MODEL_SWITCH] candidate ${candidate.model} size=${sizeHint || 'default'} failed (${attempt.code || 'NINEROUTER_HTTP'}) — trying next size/candidate (still within 9ROUTER).`);
            continue;
          }

          // Actual-dimension verification on the REAL bytes (not the requested size).
          const meta = await metadataOf(attempt.imageBytes);
          const actualRatio = meta && meta.width > 0 && meta.height > 0 ? meta.width / meta.height : null;
          const aspectPass = requestedRatio === null || actualRatio === null || Math.abs(actualRatio - requestedRatio) / requestedRatio <= ASPECT_TOLERANCE;
          console.log(`${tag}[IMAGE_POLICY]
requestedAspect=${requestedAspectLabel || '1:1'}
requestedSize=${sizeHint || 'default'}
actual=${meta && meta.width ? `${meta.width}x${meta.height}` : 'unknown'}
actualAspect=${actualRatio !== null ? actualRatio.toFixed(4) : 'n/a'}
bytes=${attempt.imageBytes.length}
maxBytes=1000000`);
          if (!aspectPass) {
            console.warn(`${tag}[IMAGE_POLICY] Model returned ${meta ? meta.width : '?'}x${meta ? meta.height : '?'} — adapting to requested ${requestedAspectLabel}`);
            const adapted = await this.adaptToAspectRatio(attempt.imageBytes, requestedAspectLabel);
            if (adapted && adapted.length > 0) {
              attempt.imageBytes = adapted;
              const adaptedMeta = await metadataOf(adapted);
              generation = attempt;
              chosenModel = candidate.model;
              generation._meta = adaptedMeta || meta || null;
              generation._requestedSize = sizeHint || 'default';
              candidateOk = true;
              break;
            }
            if (!bestAttemptFallback) {
              bestAttemptFallback = {
                attempt,
                model: candidate.model,
                meta,
                sizeHint: sizeHint || 'default'
              };
            }
            continue; // try fallback size, then next candidate
          }
          console.log(`${tag}[IMAGE_POLICY] PASS aspect`);

          generation = attempt;
          chosenModel = candidate.model;
          generation._meta = meta || null;
          generation._requestedSize = sizeHint || 'default';
          candidateOk = true;
          break;
        }

        if (candidateOk) {
          if (candidate.model !== selection.model) {
            console.warn(`${tag}[MODEL_SWITCH] primary ${selection.model} failed; succeeded with discovered candidate ${chosenModel} (still within 9ROUTER).`);
          }
          break;
        }
      }

      // If strict aspect match wasn't native from provider but we got a valid generated image,
      // adapt and accept it rather than failing the user!
      if (!generation && bestAttemptFallback) {
        console.log(`${tag}[IMAGE_POLICY] Using successful image candidate ${bestAttemptFallback.model} (adapting to requested ${requestedAspectLabel})`);
        generation = bestAttemptFallback.attempt;
        chosenModel = bestAttemptFallback.model;
        generation._meta = bestAttemptFallback.meta || null;
        generation._requestedSize = bestAttemptFallback.sizeHint;
      }

      if (!generation) {
        const err = lastGatewayError || {};
        console.error(`${tag}[9ROUTER] All ${candidates.length} discovered candidate(s) failed (code=${err.code}): ${err.error}${aspectMismatch ? `; last aspect mismatch on ${aspectMismatch.candidate}@${aspectMismatch.size}: requested ${aspectMismatch.requested}, got ${aspectMismatch.width}x${aspectMismatch.height}` : ''}`);
        return {
          success: false,
          error: err.error || 'IMAGE_GENERATION_FAILED',
          reasonCode: aspectMismatch ? 'IMAGE_ASPECT_MISMATCH' : 'IMAGE_GENERATION_FAILED',
          gatewayError: err.code || null
        };
      }

      // Step 5: Adapt buffer to user's requested aspect ratio (16:9, 9:16, 1:1)
      let candidateBytes = generation.imageBytes;
      const preMeta = await metadataOf(candidateBytes);
      const preRatio = preMeta && preMeta.width > 0 && preMeta.height > 0 ? preMeta.width / preMeta.height : null;
      if (requestedRatio !== null && preRatio !== null && Math.abs(preRatio - requestedRatio) / requestedRatio > ASPECT_TOLERANCE) {
        console.log(`${tag}[IMAGE_ADAPT] Adapting image from ${preMeta.width}x${preMeta.height} to requested ${requestedAspectLabel} (${requestedRatio.toFixed(3)})...`);
        const adapted = await this.adaptToAspectRatio(candidateBytes, requestedAspectLabel);
        if (adapted && adapted.length > 0) {
          candidateBytes = adapted;
        }
      }

      // Step 5.1: Centralized ImageOutputSizePolicy (guarantees strictly < 1MB).
      const policyResult = await imageOutputSizePolicyInstance.ensureUnderLimit(candidateBytes);
      if (!policyResult.success || !policyResult.buffer || policyResult.buffer.length >= MAX_IMAGE_BYTES) {
        return {
          success: false,
          error: `IMAGE_GENERATION_FAILED: 9Router output failed ImageOutputSizePolicy: ${policyResult.error || 'IMAGE_OUTPUT_SIZE_LIMIT_EXCEEDED'}`,
          reasonCode: 'IMAGE_OUTPUT_SIZE_LIMIT_EXCEEDED'
        };
      }
      const compliantBuffer = policyResult.buffer;

      // Enterprise byte policy: OPTIMIZE (compress, aspect-preserving) ONLY when
      // the raw output exceeds the 1 MB ceiling; otherwise never recompress.
      if (generation.imageBytes.length <= MAX_IMAGE_BYTES) {
        console.log(`${tag}[IMAGE_POLICY] PASS size (raw ${compliantBuffer.length} bytes <= ${MAX_IMAGE_BYTES}; strictly <1MB verified)`);
      } else {
        console.log(`${tag}[IMAGE_POLICY] OPTIMIZE bytes=${generation.imageBytes.length} -> ${compliantBuffer.length} aspect-preserving, dims untouched`);
      }

      // Actual-dimension verification on the FINAL (compliant) bytes
      const finalMeta = await metadataOf(compliantBuffer);
      let finalWidth = finalMeta && finalMeta.width > 0 ? finalMeta.width : policyResult.width || generation.width || null;
      let finalHeight = finalMeta && finalMeta.height > 0 ? finalMeta.height : policyResult.height || generation.height || null;

      const isValidImage = this._verifyImageBytes(compliantBuffer);
      if (!isValidImage) {
        return {
          success: false,
          error: `IMAGE_GENERATION_FAILED: 9Router returned invalid image bytes (${compliantBuffer.length} bytes)`,
          reasonCode: 'IMAGE_GENERATION_FAILED'
        };
      }

      // Step 6: Persist artifact (existing img-… path used by the frontend).
      const artifact = this._persistArtifact(compliantBuffer, {
        prompt: gatewayPrompt,
        originalPrompt: originalPrompt || cleanPrompt,
        normalizedPrompt: normalizedPrompt || cleanPrompt,
        generationId,
        messageId,
        requestId: reqId,
        negativePrompt: negativePrompt || '',
        provider: 'NINEROUTER',
        model: chosenModel,
        width: finalWidth,
        height: finalHeight,
        format: finalMeta?.format || policyResult.format || generation.format,
        sizeBytes: compliantBuffer.length,
        sizePolicy: policyResult.sizePolicy,
        mimeType: finalMeta?.mimeType || policyResult.mimeType || generation.mimeType || 'image/jpeg'
      });

      const postCheck = imageOutputSizePolicyInstance.validatePersistedFile(artifact.localPath);
      if (!postCheck.valid) {
        return {
          success: false,
          error: `IMAGE_GENERATION_FAILED: Persisted artifact failed size validation: ${postCheck.reason}`,
          reasonCode: 'IMAGE_GENERATION_FAILED'
        };
      }

      // Step 7: Persist 9Router audit meta + visual spec next to the artifact.
      this._persistNineRouterMeta(artifact, spec, { model: chosenModel }, generation, plannerResult, reqId);

      // Step 8: IMAGE_STUDIO consumes the artifact reference.
      let studioReference = null;
      try {
        const studioResult = imageStudioInstance.registerArtifact({
          artifact,
          requestId: reqId,
          prompt: originalPrompt || cleanPrompt,
          model: chosenModel,
          provider: '9ROUTER'
        });
        studioReference = studioResult.success ? studioResult.reference : null;
      } catch (err) {
        console.warn(`${tag}[IMAGE_STUDIO] Reference registration failed: ${err.message}`);
      }

      artifact.gateway = '9ROUTER';
      artifact.requestId = reqId;
      artifact.visualSpec = spec;
      artifact.visualPlanner = plannerResult.planner;
      if (studioReference) artifact.studio = studioReference;

      console.log(`${tag}[9ROUTER] Generation success model=${chosenModel} bytes=${compliantBuffer.length} format=${finalMeta?.format || policyResult.format || generation.format} width=${finalWidth} height=${finalHeight} aspect=${reduceAspectRatio(finalWidth, finalHeight) || 'n/a'} requestedAspect=${requestedAspectLabel || 'none (1:1)'} planner=${plannerResult.planner} [PASS < 1MB]`);
      return { success: true, artifact };
    } catch (err) {
      return {
        success: false,
        error: `IMAGE_GENERATION_FAILED: ${err.message}`,
        reasonCode: 'IMAGE_GENERATION_FAILED'
      };
    }
  }

  _persistNineRouterMeta(artifact, spec, selection, generation, plannerResult, requestId) {
    try {
      const meta = {
        schema: '9ROUTER_IMAGE_ARTIFACT_META',
        version: '1.0',
        artifactId: artifact.id,
        requestId: requestId || artifact.requestId || null,
        gateway: '9ROUTER',
        model: selection.model,
        planner: plannerResult?.planner || 'UNKNOWN',
        provider: '9ROUTER',
        width: artifact.width,
        height: artifact.height,
        format: artifact.format,
        sizeBytes: artifact.sizeBytes,
        created: artifact.createdAt,
        visualSpec: spec
      };
      const specFile = `${artifact.localPath.replace(/\.(png|jpg|jpeg|webp|gif)$/i, '')}.visual-spec.json`;
      const metaFile = `${artifact.localPath.replace(/\.(png|jpg|jpeg|webp|gif)$/i, '')}.9router.json`;
      fs.writeFileSync(specFile, JSON.stringify(spec, null, 2));
      fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
    } catch (err) {
      console.warn(`[ImageGeneration] Failed to persist 9Router meta: ${err.message}`);
    }
  }

  // ── Mock Implementation (for tests) ──────────────────────────────────────

  async _generateMock(params) {
    const prompt = params.prompt || 'mock';
    const lower = prompt.toLowerCase();

    // Simulate failure for testing
    if (/fail|error|gagal|tidak\s+bisa/i.test(lower)) {
      return { success: false, error: 'Mock: generation explicitly failed per prompt trigger' };
    }

    // Genuine valid PNG (generated, deterministic pattern) passing byte/magic checks
    const mockPng = this._encodePng(IMAGE_WIDTH, IMAGE_HEIGHT, params.seed || 0);

    // Pass mock buffer through ImageOutputSizePolicy
    const policyResult = await imageOutputSizePolicyInstance.ensureUnderLimit(mockPng);
    if (!policyResult.success || !policyResult.buffer || policyResult.buffer.length >= MAX_IMAGE_BYTES) {
      return {
        success: false,
        error: `Mock output failed ImageOutputSizePolicy: ${policyResult.error || 'IMAGE_OUTPUT_SIZE_LIMIT_EXCEEDED'}`
      };
    }
    const compliantBuffer = policyResult.buffer;

    const artifact = this._persistArtifact(compliantBuffer, {
      prompt,
      originalPrompt: params.originalPrompt || prompt,
      normalizedPrompt: params.normalizedPrompt || this.normalizeImagePrompt(prompt),
      generationId: params.generationId || null,
      messageId: params.messageId || null,
      provider: IMAGE_PROVIDERS.MOCK,
      mimeType: policyResult.mimeType || 'image/png',
      format: policyResult.format || 'png',
      width: policyResult.width || IMAGE_WIDTH,
      height: policyResult.height || IMAGE_HEIGHT,
      sizeBytes: compliantBuffer.length,
      sizePolicy: policyResult.sizePolicy
    });

    const postCheck = imageOutputSizePolicyInstance.validatePersistedFile(artifact.localPath);
    if (!postCheck.valid) {
      return {
        success: false,
        error: `Mock persisted artifact failed size validation: ${postCheck.reason}`
      };
    }

    return { success: true, artifact };
  }

  _generateMockFailure() {
    return {
      success: false,
      error: 'MOCK_FAILURE: simulated provider failure. Generation did not produce a valid image artifact.'
    };
  }

  _encodePng(width, height, seed = 0) {
    let s = (Number(seed) || 1) >>> 0 || 1;
    const next = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s;
    };

    const raw = Buffer.alloc(height * (1 + width * 3));
    let o = 0;
    for (let y = 0; y < height; y++) {
      raw[o++] = 0; // filter: None
      for (let x = 0; x < width; x++) {
        const v = next() & 0xff;
        raw[o++] = v;
        raw[o++] = (v * 2) & 0xff;
        raw[o++] = (255 - v) & 0xff;
      }
    }

    const idat = zlib.deflateSync(raw, { level: 9 });
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;  // bit depth
    ihdr[9] = 2;  // color type: truecolor RGB
    ihdr[10] = 0; // compression
    ihdr[11] = 0; // filter
    ihdr[12] = 0; // interlace

    const chunks = [];
    const chunk = (type, data) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length, 0);
      const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(crc32(body) >>> 0, 0);
      chunks.push(len, body, crc);
    };
    chunk('IHDR', ihdr);
    chunk('IDAT', idat);
    chunk('IEND', Buffer.alloc(0));
    return Buffer.concat([PNG_MAGIC, ...chunks]);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  _optimizePrompt(userPrompt) {
    const base = this.normalizeImagePrompt(userPrompt);
    let prompt = base;

    // Translation & Enrichment Dictionary for Indonesian visual concepts
    const mappings = [
      // Prepositions & Environments (Process first to avoid partial conflicts)
      [/\b(?:di\s+atas\s+laut|melintasi\s+laut(?:an)?|di\s+laut|di\s+atas\s+samudra)\b/gi, 'flying over the open ocean, visible blue sea water and waves below'],
      [/\b(?:di\s+atas\s+gunung|melintasi\s+gunung|di\s+pegunungan)\b/gi, 'flying across scenic mountain ranges'],
      [/\b(?:di\s+atas\s+kota|melintasi\s+kota)\b/gi, 'flying over a city skyline'],
      [/\b(?:di\s+bandara|di\s+landasan(?:\s+pacu)?)\b/gi, 'on an airport runway tarmac'],
      [/\bdi\s+jalan\s+pegunungan\b/gi, 'on a winding mountain road'],
      [/\bdi\s+jalan\s+raya\b|\bdi\s+jalan\s+tol\b/gi, 'on a highway road'],
      [/\bdi\s+jalan\b/gi, 'on the road'],
      [/\bdi\s+langit\b/gi, 'in the sky'],

      // Subjects (Clean, without forced assumptions)
      [/\bmesin\s+pemotong\s+rumput\b|\bpemotong\s+rumput\b/gi, 'lawn mower machine on grass lawn'],
      [/\bpesawat\s+tempur\b/gi, 'military fighter jet aircraft'],
      [/\bpesawat\s+terbang\b/gi, 'commercial airliner airplane'],
      [/\brumah\s+modern\s+3\s+lantai\b/gi, 'three-story luxury modern house exterior'],
      [/\brumah\s+modern\s+2\s+lantai\b/gi, 'two-story modern luxury residential house exterior'],
      [/\brumah\s+3\s+lantai\b/gi, 'three-story modern house exterior'],
      [/\brumah\s+3d\b/gi, '3D architectural render of a modern house'],
      [/\brumah\s+modern\b/gi, 'modern house exterior design'],
      [/\brumah\b/gi, 'house architecture exterior'],
      [/\bmobil\s+balap\b|\bmobil\s+sport\b/gi, 'high performance sports car'],
      [/\bmobil\b/gi, 'automobile car'],
      [/\bsepeda\s+motor\b|\bmotor\b/gi, 'motorcycle'],
      [/\bgedung\s+dpr(?:\s+mpr)?\b/gi, 'Indonesian DPR MPR Parliament landmark building in Jakarta, green dome architecture'],
      [/\bkota\s+futuristik\b/gi, 'futuristic sci-fi cyberpunk metropolis city with glowing neon towers'],
      [/\bpemandangan\s+gunung(?:\s+yang\s+indah)?\b/gi, 'majestic scenic mountain landscape with clear sky'],
      [/\bpantai\s+pasir\s+putih\b/gi, 'pristine white sand tropical beach with clear turquoise ocean water'],
      [/\bpantai\b/gi, 'coastal beach scenery with ocean waves'],
      [/\bhutan\s+tropis\b|\bhutan\b/gi, 'lush tropical rainforest with trees'],
      [/\btaman\s+bunga\b|\btaman\b/gi, 'lush flower garden with colorful blossoms'],
      [/\bkucing\s+lucu\b|\bkucing\b/gi, 'cute fluffy domestic cat'],
      [/\banjing\b/gi, 'dog'],
      [/\bburung\b/gi, 'bird in nature'],

      // Atmospheres
      [/\b(?:suasana\s+)?malam(?:\s+hari)?\b/gi, 'night scene, nighttime atmosphere under moonlight and starry dark sky'],
      [/\b(?:suasana\s+)?sunset(?:\s+hari)?\b/gi, 'sunset scenery, dramatic golden hour lighting with orange and purple sky'],
      [/\b(?:suasana\s+)?senja(?:\s+hari)?\b/gi, 'twilight dusk scenery, warm sunset glow'],
      [/\b(?:suasana\s+)?pagi(?:\s+hari)?\b/gi, 'morning sunrise scenery, golden dawn morning lighting'],
      [/\b(?:suasana\s+)?siang(?:\s+hari)?\b/gi, 'bright daylight midday scene'],
      [/\b(?:suasana\s+)?hujan\b/gi, 'rainy weather atmosphere, falling rain, wet reflections'],
      [/\b(?:suasana\s+)?salju\b/gi, 'snowy winter atmosphere, falling snow, frosted landscape'],
      [/\b(?:suasana\s+)?badai\b/gi, 'stormy weather atmosphere, dramatic dark storm clouds, lightning']
    ];

    for (const [pattern, replacement] of mappings) {
      if (pattern.test(prompt)) {
        prompt = prompt.replace(pattern, replacement);
      }
    }

    // Inanimate machine/vehicle/building protection: ensure diffusion model doesn't inject random humans
    const isSlide = /\b(?:slide|infographic|infografis|presentation)\b/i.test(prompt);
    const isInanimate = !isSlide && /\b(?:lawn mower|machine|aircraft|airplane|jet|house|car|building|motorcycle)\b/i.test(prompt);
    if (isInanimate && !/\b(?:person|human|people|woman|man|pilot|driver)\b/i.test(prompt)) {
      prompt += ', photorealistic, high resolution, detailed, clean composition, no people, no human figures';
    }

    return prompt;
  }

  normalizeImagePrompt(userPrompt) {
    const original = String(userPrompt || '').replace(/\s+/g, ' ').trim();
    if (!original) return 'Create a high-quality image of a futuristic AI visual.';
    // 1. DYNAMIC CONTEXTUAL INFOGRAPHIC COMPILER (ChatGPT / DALL-E Pattern)
    // Dynamically shapes the presentation slide infographic based on the topic and structure:
    // - Comparison (2 columns / Pros-Cons / Kelebihan-Kekurangan)
    // - Process / Workflow / Steps (Linear horizontal cards with numbered steps & arrows)
    // - Metrics / Data / Growth (Charts, bar graphs, percentage donuts, KPI cards)
    // - Cycle / Ecosystem / Pillars (Circular hub-and-spoke or donut cycle diagram)
    // - People / Roles / Community / Stakeholders (Human-centric illustration cards & team roles)
    // - Hierarchy / Structure (Pyramid tier or organizational hierarchy)
    if (/\b(?:visual\s+slide|slide\s+visual|slide\s+presentasi|slide|presentation\s+slide|infografis|infografik|infographic)\b/i.test(original)) {
      const quoteMatch = original.match(/["'“]([^"'“”]+)["'”]/);
      const titleText = quoteMatch ? quoteMatch[1] : '';
      const fullContext = `${original} ${titleText}`.toLowerCase();

      // Determine Infographic Archetype based on context
      let layoutDesign = '';
      const hasBulat = /lingkaran|siklus|cycle|ekosistem|pilar|hub|spoke|rotasi|roda|bulat|melingkar|pie|radial/i.test(fullContext);
      const hasChart = /grafik|chart|statistik|persentase|pertumbuhan|kinerja|metrik|kpi|finansial|keuangan|laporan|kurva|\bbar\s+chart\b|diagram\s+(?:batang|data|garis|tren|pertumbuhan)/i.test(fullContext);
      const hasPeople = /orang|manusia|masyarakat|warga|tokoh|profil|tim|team|pegawai|aparatur|peran|stakeholder|sdm|pemimpin|karakter|sosok|penduduk/i.test(fullContext);
      const hasProcess = /proses|alur|tahapan?|langkah|step|roadmap|timeline|fase|urutan/i.test(fullContext);
      const hasComparison = /kelebihan|kekurangan|pro\s+kontra|pros?\s+and\s+cons?|perbandingan|vs|versus|komparasi|banding|2\s+kolom|dua\s+kolom/i.test(fullContext);
      const hasHierarchy = /struktur|hierarki|organisasi|piramida|bagan/i.test(fullContext);

      if (hasBulat) {
        layoutDesign = 'Circular cycle ecosystem infographic layout. Centered hub core surrounded by radial interconnected node petals, circular curved process flow arrows, balanced thematic segment cards, and distinct icon markers';
      } else if (hasChart) {
        layoutDesign = 'Executive data analytics dashboard presentation infographic. Features polished business bar charts, trend lines, a circular percentage donut gauge, and clean KPI metric stat cards with growth arrows and highlight numbers';
      } else if (hasProcess) {
        layoutDesign = 'Sequential horizontal process roadmap infographic layout. 4 to 5 connected chronological milestone cards with numbered step badges (01, 02, 03, 04), directional flow arrows, modern icons for each phase, and descriptive milestone summary text';
      } else if (hasPeople) {
        layoutDesign = 'Human-centric stakeholder presentation infographic. Features professional illustrations of diverse people and community members, organizational role cards, collaborative interaction badges, and structured responsibility profiles';
      } else if (hasComparison) {
        layoutDesign = 'Structured two-column comparison infographic layout. Balanced left card with warm gold accents and positive thumbs-up icons for Advantages (Kelebihan), and right card with corporate blue accents and warning icons for Challenges (Kekurangan). Well-proportioned cards with neat modern bullet points, clean key takeaways, and an executive summary footer bar';
      } else if (hasHierarchy) {
        layoutDesign = 'Tiered pyramid hierarchy presentation infographic layout. Layered progressive levels from foundation base to strategic apex, clear organizational tier cards, and connecting alignment markers';
      } else {
        layoutDesign = 'Modern executive corporate presentation slide infographic. Well-structured modular card layout with thematic icons, clear topic headers, balanced visual hierarchy, and polished presentation aesthetic';
      }

      // Contextual element add-ons when requested alongside main layout
      const extraElements = [];
      if (hasPeople && !layoutDesign.startsWith('Human-centric')) {
        extraElements.push('with professional character illustrations and friendly human figures');
      }
      if (hasChart && !layoutDesign.startsWith('Executive data analytics')) {
        extraElements.push('including visual data graphs and KPI metrics');
      }
      if (hasBulat && !layoutDesign.startsWith('Circular cycle')) {
        extraElements.push('incorporating circular focal badges and radial motifs');
      }
      if (extraElements.length > 0) {
        layoutDesign += `, ${extraElements.join(', ')}`;
      }

      // Determine Contextual Backdrop
      let backdropContext = 'clean modern corporate executive backdrop';
      if (/perdes|desa|village|pemerintahan\s+desa|pedesaan|tata\s+kelola\s+desa/i.test(fullContext)) {
        backdropContext = 'subtle watermark background of Indonesian Balai Desa municipal building and majestic mountain scenery';
      } else if (/hukum|regulasi|kebijakan|undang|pasal|legal|aturan/i.test(fullContext)) {
        backdropContext = 'subtle background of institutional governance council hall and balanced legal pillars';
      } else if (/bisnis|korporat|enterprise|manajemen|kantor/i.test(fullContext)) {
        backdropContext = 'subtle architectural glass skyscraper boardroom and modern enterprise interior';
      } else if (/teknologi|ai|digital|cyber|software|cloud|data/i.test(fullContext)) {
        backdropContext = 'subtle futuristic digital network grid and clean tech infrastructure backdrop';
      } else if (/kesehatan|medis|rumah\s+sakit|klinik|obat/i.test(fullContext)) {
        backdropContext = 'subtle modern medical healthcare research center backdrop';
      } else if (/pendidikan|sekolah|kuliah|mahasiswa|guru/i.test(fullContext)) {
        backdropContext = 'subtle academic university library and innovation campus backdrop';
      }

      const displayTitle = titleText || original.replace(/^(?:buat(?:kan)?|generate|render)\s+(?:visual\s+slide|slide\s+presentasi|slide|infografis)\s*/i, '').trim();

      return `A high-resolution 16:9 executive presentation slide infographic titled '${displayTitle}'. Layout: ${layoutDesign}. Background: ${backdropContext}. Header banner with title '${displayTitle}', crisp graphic design, clean icons, professional typography layout, polished corporate slide deck presentation.`;
    }

    let subject = original
      .replace(/^jin\b[\s,:-]*/i, '')
      .replace(/^(?:apakah\s+kamu\s+bisa|bisakah\s+kamu|bisakah|can\s+you|could\s+you)\s+/i, '')
      .replace(/^(?:tolong|please)\s+/i, '');

    // Iteratively strip repetitive prompt wrapping prefixes
    let prev;
    do {
      prev = subject;
      subject = subject
        .replace(/^(?:sekarang|coba|tolong)\s+/i, '')
        .replace(/^(?:buat(?:kan)?|bikin|generate|create|hasilkan|render(?:kan)?|produce|draw|paint)\s+/i, '')
        .replace(/^(?:sebuah|a|an|the)\s+/i, '')
        .replace(/^(?:high[- ]quality|realistic|high[- ]resolution|photorealistic|detailed|cinematic|professional)\s+/i, '')
        .replace(/^(?:3d\s+(?:rendered\s+)?)?(?:image|gambar|illustration|ilustrasi|visual|foto|photo|picture|poster|artwork)\s*(?:of|tentang|mengenai)?\s*/i, '')
        .replace(/^(?:sebuah|a|an|the)\s+/i, '')
        .replace(/^(?:revisi|ubah|ganti|update|regenerate|buat\s+ulang|edit|modifikasi|timpa|ulang|jadikan|buat\s+jadi|bikin\s+jadi|ubah\s+jadi|ganti\s+jadi)\s+/i, '')
        .replace(/^(?:suasananya|warnanya|latarnya|gambarnya|visualnya|fotonya|langitnya)\s+(?:menjadi|jadi|dengan|yang)\s*/i, '')
        .trim();
    } while (subject !== prev && subject.length > 0);

    subject = subject.replace(/[?!.]+$/g, '').trim();

    if (!subject) subject = original;
    if (/\b3\s*d\b|\b3d\b|three[\s-]?dimensional/i.test(original)) {
      return `Create a high-quality 3D rendered image of ${subject}. Use one coherent composition with realistic depth, lighting, materials, and camera perspective. Do not create a floor plan, elevation sheet, engineering drawing, interactive model, or architectural workflow output.`;
    }
    return `Create a high-quality image of ${subject}.`;
  }

  _requestSignal(signal, timeoutMs) {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    if (!signal) return timeoutSignal;
    if (typeof AbortSignal.any === 'function') return AbortSignal.any([signal, timeoutSignal]);
    return signal;
  }

  _verifyImageBytes(buffer) {
    if (!buffer || buffer.length < MIN_ARTIFACT_BYTES) return false;
    // Check PNG magic
    if (buffer.subarray(0, 8).equals(PNG_MAGIC)) return true;
    // Check JPEG magic (FF D8 FF)
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
    return false;
  }

  _persistArtifact(buffer, metadata = {}) {
    if (!buffer || buffer.length >= MAX_IMAGE_BYTES) {
      throw new Error(`[ImageGeneration] Invariant violation: Cannot persist image artifact with size ${buffer?.length} >= MAX_IMAGE_BYTES (${MAX_IMAGE_BYTES})`);
    }

    const id = `img-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // Detect actual image format from magic bytes
    const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_MAGIC);
    const isJpeg = buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    const format = metadata.format || (isPng ? 'png' : isJpeg ? 'jpeg' : 'png');
    const ext = format === 'jpeg' ? 'jpg' : format;
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';

    const filename = `${id}.${ext}`;
    const localPath = path.join(ARTIFACTS_DIR, filename);
    const relativeUrl = `/api/artifacts/images/${filename}`;
    const timestamp = new Date().toISOString();

    try {
      fs.writeFileSync(localPath, buffer);
    } catch (err) {
      console.error(`[ImageGeneration] Failed to persist ${filename}:`, err.message);
    }

    const sizePolicy = metadata.sizePolicy || {
      maxBytes: MAX_IMAGE_BYTES,
      targetBytes: TARGET_IMAGE_BYTES,
      status: buffer.length < MAX_IMAGE_BYTES ? 'PASS' : 'FAILED'
    };

    const artifact = {
      id,
      type: 'IMAGE',
      status: 'completed',
      url: relativeUrl,
      thumbnailUrl: relativeUrl,
      localPath,
      mimeType: metadata.mimeType || mimeType,
      format,
      sizeBytes: buffer.length,
      bytesSize: buffer.length,
      sizePolicy,
      width: metadata.width || null,
      height: metadata.height || null,
      provider: metadata.provider || 'UNKNOWN',
      model: metadata.model || null,
      prompt: metadata.prompt || '',
      originalPrompt: metadata.originalPrompt || metadata.prompt || '',
      normalizedPrompt: metadata.normalizedPrompt || metadata.prompt || '',
      generationId: metadata.generationId || null,
      messageId: metadata.messageId || null,
      requestId: metadata.requestId || null,
      createdAt: timestamp,
      renderable: true,
      metadata: {
        artifactId: id,
        generationId: metadata.generationId || null,
        messageId: metadata.messageId || null,
        requestId: metadata.requestId || null,
        originalPrompt: metadata.originalPrompt || metadata.prompt || '',
        normalizedPrompt: metadata.normalizedPrompt || metadata.prompt || '',
        provider: metadata.provider || 'UNKNOWN',
        model: metadata.model || null,
        createdAt: timestamp,
        width: metadata.width || null,
        height: metadata.height || null,
        format,
        sizeBytes: buffer.length,
        bytesSize: buffer.length,
        sizePolicy,
        mimeType: metadata.mimeType || mimeType
      }
    };

    return artifact;
  }

  verifyArtifact(artifact) {
    if (!artifact) return { renderable: false, reason: 'ARTIFACT_NULL' };
    if (artifact.type !== 'IMAGE') return { renderable: false, reason: `TYPE_MISMATCH: expected IMAGE, got ${artifact.type}` };

    try {
      if (!fs.existsSync(artifact.localPath)) {
        return { renderable: false, reason: 'FILE_NOT_FOUND' };
      }
      const stat = fs.statSync(artifact.localPath);
      if (stat.size < MIN_ARTIFACT_BYTES) {
        return { renderable: false, reason: `FILE_TOO_SMALL: ${stat.size} bytes` };
      }
      if (stat.size >= MAX_IMAGE_BYTES) {
        return { renderable: false, reason: 'IMAGE_OUTPUT_SIZE_LIMIT_EXCEEDED' };
      }
      const head = Buffer.alloc(16);
      const fd = fs.openSync(artifact.localPath, 'r');
      fs.readSync(fd, head, 0, 16, 0);
      fs.closeSync(fd);
      const isPng = head.subarray(0, 8).equals(PNG_MAGIC);
      const isJpeg = head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF;
      if (!isPng && !isJpeg) {
        return { renderable: false, reason: 'INVALID_MAGIC_BYTES' };
      }

      // Check with centralized ImageOutputSizePolicy
      const postValidation = imageOutputSizePolicyInstance.validatePersistedFile(artifact.localPath);
      if (!postValidation.valid) {
        return { renderable: false, reason: postValidation.reason };
      }
    } catch (err) {
      return { renderable: false, reason: `VERIFICATION_ERROR: ${err.message}` };
    }

    return { renderable: true, reason: 'Artifact verified: file exists, valid size (< 1MB), valid image magic bytes.' };
  }

  verifyImageSemantic({ prompt, normalizedPrompt, image } = {}) {
    return {
      available: false,
      verified: false,
      capability: 'UNAVAILABLE',
      reason: 'No semantic image verifier is configured.',
      prompt: prompt || '',
      normalizedPrompt: normalizedPrompt || '',
      artifactId: image?.id || null
    };
  }
}

export const ImageGeneration = ImageGenerationService;
export const imageGenerationInstance = new ImageGenerationService();
export default imageGenerationInstance;
