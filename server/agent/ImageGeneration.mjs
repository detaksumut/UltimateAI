/**
 * ImageGeneration.mjs
 * TAHAP 3B-3A: Real first-class IMAGE_GENERATION pipeline service.
 *
 * Provider resolution (priority order):
 *   1. Explicit providerOverride
 *   2. Environment IMAGE_PROVIDER (gemini_imagen | pollinations | mock | ollama)
 *   3. Gemini API key detection → Gemini Imagen (high quality, free tier)
 *   4. Ollama image model detection via /api/tags
 *   5. Pollinations (cloud, free, no API key)
 *
 * Contract:
 *   capabilityProbe() → { available, provider, reason }
 *   generateImage(params, transport?) → { success, artifact?, error? }
 *   verifyArtifact(artifact) → { renderable, reason }
 *
 * Transport seam: pass { fetch: fn } for tests (mock transport).
 */
import fs from 'fs';

import path from 'path';

import crypto from 'crypto';

import zlib from 'zlib';

// Auto-load .env (same as other agent files)
import '../config/env.mjs';

// PNG CRC-32 (zlib/libpng table) for chunk headers
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
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
  GEMINI_IMAGEN: 'GEMINI_IMAGEN',
  POLLINATIONS: 'POLLINATIONS',
  OLLAMA: 'OLLAMA',
  MOCK: 'MOCK',
  MOCK_FAILURE: 'MOCK_FAILURE'
};

export class ImageGeneration {
  constructor() {
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

    // 1. Explicit env override
    const envProvider = (process.env.IMAGE_PROVIDER || '').toLowerCase();
    if (envProvider === 'mock') {
      return { available: true, provider: IMAGE_PROVIDERS.MOCK, reason: 'Mock provider enabled via IMAGE_PROVIDER env' };
    }
    if (envProvider === 'pollinations') {
      return { available: true, provider: IMAGE_PROVIDERS.POLLINATIONS, reason: 'Pollinations forced via IMAGE_PROVIDER env' };
    }
    if (envProvider === 'gemini_imagen' || envProvider === 'gemini') {
      const key = this._resolveGeminiKey();
      if (key) {
        return { available: true, provider: IMAGE_PROVIDERS.GEMINI_IMAGEN, reason: 'Gemini Imagen forced via IMAGE_PROVIDER env' };
      }
    }

    // 2. Check Gemini API key (highest quality, free tier)
    const geminiKey = this._resolveGeminiKey();
    if (geminiKey) {
      return {
        available: true,
        provider: IMAGE_PROVIDERS.GEMINI_IMAGEN,
        reason: `Gemini API key found (${geminiKey.slice(0, 8)}...) — using Gemini Imagen`
      };
    }

    // 3. Check Ollama for image model
    try {
      const res = await fetchFn('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        const models = (data.models || []).map(m => (m.name || '').toLowerCase());
        const imageModels = models.filter(m =>
          /llava|sdxl|stable.?diffusion|flux|dall.?e|midjourney|image/i.test(m)
        );
        if (imageModels.length > 0) {
          return {
            available: true,
            provider: IMAGE_PROVIDERS.OLLAMA,
            reason: `Ollama image model found: ${imageModels[0]}`,
            model: imageModels[0]
          };
        }
      }
    } catch {
      // Ollama unreachable
    }

    // 4. Pollinations fallback (free cloud, no key)
    return { available: true, provider: IMAGE_PROVIDERS.POLLINATIONS, reason: 'Pollinations cloud (free, no API key)' };
  }

  // ── Generate Image ────────────────────────────────────────────────────────

  async generateImage(params = {}, transport = null) {
    const {
      prompt = 'futuristic AI visual',
      negativePrompt = '',
      aspectRatio = '1:1',
      size = '1024x1024',
      referenceContext = null,
      providerOverride = null,
      stage = 'GENERATE',
      options = {}
    } = params;

    // Stage dispatch: only GENERATE does real work
    if (stage && stage !== 'GENERATE') {
      return { success: true, stage, skipped: true, reason: `Stage ${stage} is non-execution; only GENERATE performs network work.` };
    }

    const fetchFn = transport?.fetch || globalThis.fetch;

    // Resolve provider
    let provider = providerOverride;
    if (!provider) {
      const capability = await this.capabilityProbe(transport);
      provider = capability.provider;
    }

    // Dispatch
    if (String(provider).toUpperCase() === IMAGE_PROVIDERS.MOCK_FAILURE) {
      return this._generateMockFailure(params);
    }
    if (provider === IMAGE_PROVIDERS.MOCK) {
      return this._generateMock(params);
    }
    if (provider === IMAGE_PROVIDERS.GEMINI_IMAGEN) {
      const res = await this._generateGeminiImagen(params, fetchFn);
      if (res && res.success) {
        return res;
      }
      console.warn(`[ImageGeneration] Gemini Imagen unavailable (${res?.error}), seamlessly falling back to Pollinations Flux...`);
      return this._generatePollinations(params, fetchFn);
    }
    if (provider === IMAGE_PROVIDERS.POLLINATIONS) {
      return this._generatePollinations(params, fetchFn);
    }
    if (provider === IMAGE_PROVIDERS.OLLAMA) {
      return this._generateOllama(params, fetchFn);
    }

    return { success: false, error: `Unknown provider: ${provider}` };
  }

  // ── Pollinations Implementation ───────────────────────────────────────────

  async _generatePollinations(params, fetchFn) {
    const { prompt, negativePrompt, aspectRatio, size } = params;
    const [width, height] = (size || '1024x1024').split('x').map(Number);

    const seed = Math.floor(Math.random() * 2147483647);
    const optimizedPrompt = this._optimizePrompt(prompt);
    const encoded = encodeURIComponent(optimizedPrompt);

    const url = `https://image.pollinations.ai/prompt/${encoded}?width=${width || 1024}&height=${height || 1024}&nologo=true&seed=${seed}&model=flux`;

    try {
      const response = await fetchFn(url, {
        signal: AbortSignal.timeout(60000),
        redirect: 'follow'
      });

      if (!response.ok) {
        return { success: false, error: `Pollinations HTTP ${response.status}: ${response.statusText}` };
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('image')) {
        const text = await response.text().catch(() => '');
        return { success: false, error: `Pollinations returned non-image content: ${contentType}. Body: ${text.slice(0, 200)}` };
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Verify PNG/JPEG magic
      const isValidImage = this._verifyImageBytes(buffer);
      if (!isValidImage) {
        return { success: false, error: `Pollinations returned invalid image bytes (${buffer.length} bytes, no valid magic header)` };
      }

      // Detect actual format from response content-type or magic bytes
      const respIsPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_MAGIC);
      const respIsJpeg = buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
      const detectedMime = respIsPng ? 'image/png' : respIsJpeg ? 'image/jpeg' : contentType.includes('jpeg') ? 'image/jpeg' : 'image/png';

      const artifact = this._persistArtifact(buffer, {
        prompt: optimizedPrompt,
        originalPrompt: prompt,
        negativePrompt,
        provider: IMAGE_PROVIDERS.POLLINATIONS,
        width: width || 1024,
        height: height || 1024,
        seed,
        mimeType: detectedMime
      });

      return { success: true, artifact };
    } catch (err) {
      return { success: false, error: `Pollinations generation failed: ${err.message}` };
    }
  }

  // ── Gemini Imagen Implementation ──────────────────────────────────────────

  async _generateGeminiImagen(params, fetchFn) {
    const { prompt, negativePrompt, aspectRatio, size } = params;
    const optimizedPrompt = this._optimizePrompt(prompt);

    // Resolve Gemini API key from env
    const geminiKey = this._resolveGeminiKey();
    if (!geminiKey) {
      return { success: false, error: 'Gemini API key not configured. Set GEMINI_API_KEY or GEMINI_API_KEY_1/GEMINI_API_KEY_2 in .env' };
    }

    const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    // Build prompt with negative prompt if provided
    let fullPrompt = optimizedPrompt;
    if (negativePrompt) {
      fullPrompt = `${optimizedPrompt}. Avoid: ${negativePrompt}`;
    }

    const requestBody = {
      contents: [
        {
          parts: [
            { text: `Generate an image based on this description: ${fullPrompt}` }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ['IMAGE'],
        ...(aspectRatio && aspectRatio !== '1:1' ? { aspectRatio } : {})
      }
    };

    try {
      const url = `${baseUrl}/models/${model}:generateContent`;
      const response = await fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiKey
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(60000)
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        return { success: false, error: `Gemini Imagen HTTP ${response.status}: ${errBody.slice(0, 300)}` };
      }

      const data = await response.json();

      // Extract base64 image from response
      const candidate = data.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const imagePart = parts.find(p => p.inlineData?.data);

      if (!imagePart) {
        return { success: false, error: 'Gemini Imagen returned no image data. Response: ' + JSON.stringify(data).slice(0, 300) };
      }

      const base64Data = imagePart.inlineData.data;
      const mimeType = imagePart.inlineData.mimeType || 'image/png';
      const buffer = Buffer.from(base64Data, 'base64');

      // Verify image bytes
      const isValidImage = this._verifyImageBytes(buffer);
      if (!isValidImage) {
        return { success: false, error: `Gemini Imagen returned invalid image bytes (${buffer.length} bytes)` };
      }

      const [width, height] = (size || '1024x1024').split('x').map(Number);

      const artifact = this._persistArtifact(buffer, {
        prompt: optimizedPrompt,
        originalPrompt: params.prompt,
        negativePrompt,
        provider: IMAGE_PROVIDERS.GEMINI_IMAGEN,
        model,
        width: width || 1024,
        height: height || 1024,
        mimeType
      });

      return { success: true, artifact };
    } catch (err) {
      return { success: false, error: `Gemini Imagen generation failed: ${err.message}` };
    }
  }

  _resolveGeminiKey() {
    // Priority: GEMINI_API_KEY > GEMINI_API_KEY_2 > GEMINI_API_KEY_1
    const keys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_1
    ];
    for (const key of keys) {
      if (key && key.trim().length > 10 && key.trim() !== 'API_KEY_GEMINI_ANDA') {
        return key.trim();
      }
    }
    return null;
  }

  // ── Ollama Implementation (stub — requires image model like llava) ────────

  async _generateOllama(params, fetchFn) {
    const { prompt } = params;
    const optimizedPrompt = this._optimizePrompt(prompt);

    try {
      const response = await fetchFn('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llava',
          prompt: `Generate an image: ${optimizedPrompt}`,
          stream: false,
          options: { temperature: 0.7 }
        }),
        signal: AbortSignal.timeout(120000)
      });

      if (!response.ok) {
        return { success: false, error: `Ollama HTTP ${response.status}` };
      }

      const data = await response.json();
      // Ollama image models may return base64 images in response
      if (data.images && data.images.length > 0) {
        const base64Data = data.images[0];
        const buffer = Buffer.from(base64Data, 'base64');
        const artifact = this._persistArtifact(buffer, {
          prompt: optimizedPrompt,
          originalPrompt: prompt,
          provider: IMAGE_PROVIDERS.OLLAMA,
          mimeType: 'image/png'
        });
        return { success: true, artifact };
      }

      return { success: false, error: 'Ollama image model returned no image data' };
    } catch (err) {
      return { success: false, error: `Ollama generation failed: ${err.message}` };
    }
  }

  // ── Mock Implementation (for tests) ──────────────────────────────────────

  _generateMock(params) {
    const prompt = params.prompt || 'mock';
    const lower = prompt.toLowerCase();

    // Simulate failure for testing
    if (/fail|error|gagal|tidak\s+bisa/i.test(lower)) {
      return { success: false, error: 'Mock: generation explicitly failed per prompt trigger' };
    }

    // Genuine valid PNG (generated, deterministic pattern) passing byte/magic checks
    const mockPng = this._encodePng(96, 96, params.seed || 0);
    const width = 96;
    const height = 96;

    const artifact = this._persistArtifact(mockPng, {
      prompt,
      provider: IMAGE_PROVIDERS.MOCK,
      mimeType: 'image/png',
      width,
      height
    });

    return { success: true, artifact };
  }

  /**
   * Deterministic failure-injection provider (MOCK_FAILURE).
   * ALWAYS fails regardless of prompt, simulating provider outage/timeout/corrupt
   * output so the FAILED path can be exercised end-to-end without a real outage.
   * Straightforward for `providerOverride: 'MOCK_FAILURE'` in runGoal options.
   */
  _generateMockFailure() {
    return {
      success: false,
      error: 'MOCK_FAILURE: simulated provider failure. Generation did not produce a valid image artifact.'
    };
  }

  /**
   * Minimal PNG encoder producing a real, valid PNG > MIN_ARTIFACT_BYTES.
   * Row-major RGBA with filter byte 0, deflated via node zlib.
   * Deterministic pixel pattern derived from the seed (LCG) so repeated
   * mock generations are reproducible and genuinely renderable.
   */
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
    if (!userPrompt) return 'futuristic AI visual';
    // If prompt is already descriptive enough (English + > 20 chars), use as-is
    const lower = userPrompt.toLowerCase();
    const isRich = /\s/.test(userPrompt) && userPrompt.length > 20;
    if (isRich) return userPrompt;

    // Simple prompt: enrich slightly for Pollinations
    return `${userPrompt}, high quality, detailed, 4k, cinematic lighting`;
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
    const id = `img-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // Detect actual image format from magic bytes
    const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_MAGIC);
    const isJpeg = buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    const ext = isPng ? 'png' : isJpeg ? 'jpg' : 'png';
    const mimeType = isPng ? 'image/png' : isJpeg ? 'image/jpeg' : 'image/png';

    const filename = `${id}.${ext}`;
    const localPath = path.join(ARTIFACTS_DIR, filename);
    const relativeUrl = `/api/artifacts/images/${filename}`;
    const timestamp = new Date().toISOString();

    try {
      fs.writeFileSync(localPath, buffer);
    } catch (err) {
      console.error(`[ImageGeneration] Failed to persist ${filename}:`, err.message);
    }

    const artifact = {
      id,
      type: 'IMAGE',
      status: 'completed',
      url: relativeUrl,
      thumbnailUrl: relativeUrl,
      localPath,
      mimeType: metadata.mimeType || mimeType,
      width: metadata.width || null,
      height: metadata.height || null,
      provider: metadata.provider || 'UNKNOWN',
      prompt: metadata.prompt || '',
      originalPrompt: metadata.originalPrompt || metadata.prompt || '',
      bytesSize: buffer.length,
      createdAt: timestamp,
      renderable: true,
      metadata: { width: metadata.width || null, height: metadata.height || null, mimeType: metadata.mimeType || mimeType }
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
      const head = Buffer.alloc(16);
      const fd = fs.openSync(artifact.localPath, 'r');
      fs.readSync(fd, head, 0, 16, 0);
      fs.closeSync(fd);
      const isPng = head.subarray(0, 8).equals(PNG_MAGIC);
      const isJpeg = head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF;
      if (!isPng && !isJpeg) {
        return { renderable: false, reason: 'INVALID_MAGIC_BYTES' };
      }
    } catch (err) {
      return { renderable: false, reason: `VERIFICATION_ERROR: ${err.message}` };
    }

    return { renderable: true, reason: 'Artifact verified: file exists, valid size, valid image magic bytes.' };
  }
}

export const imageGenerationInstance = new ImageGeneration();
export default imageGenerationInstance;
