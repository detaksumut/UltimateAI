/**
 * ImageGeneration.mjs
 * TAHAP 3B-3A: Real first-class IMAGE_GENERATION pipeline service.
 *
 * Provider resolution (priority order):
 *   1. Explicit providerOverride
 *   2. Environment IMAGE_PROVIDER (together_ai | gemini_imagen | pollinations | ollama)
 *   3. Gemini API key detection → Gemini Imagen (high quality, free tier)
 *   4. Ollama image model detection via /api/tags
 *   5. Pollinations (cloud, free, no API key)
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

// Auto-load .env (same as other agent files)
import '../config/env.mjs';
import { geminiProviderInstance } from '../providers/GeminiProvider.mjs';

const ARTIFACTS_DIR = path.resolve('d:/Users/ultimateai/storage/artifacts/images');

// PNG magic bytes: 0x89504E470D0A1A0A
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const MIN_ARTIFACT_BYTES = 1024;

const IMAGE_PROVIDERS = {
  TOGETHER_AI: 'TOGETHER_AI',
  GEMINI_IMAGEN: 'GEMINI_IMAGEN',
  POLLINATIONS: 'POLLINATIONS',
  OLLAMA: 'OLLAMA'
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
    if (envProvider === 'pollinations') {
      return { available: true, provider: IMAGE_PROVIDERS.POLLINATIONS, reason: 'Pollinations forced via IMAGE_PROVIDER env' };
    }
    if (envProvider === 'gemini_imagen' || envProvider === 'gemini') {
      const key = this._resolveGeminiKey();
      if (key) {
        return { available: true, provider: IMAGE_PROVIDERS.GEMINI_IMAGEN, reason: 'Gemini Imagen forced via IMAGE_PROVIDER env' };
      }
    }
    if (envProvider === 'together' || envProvider === 'together_ai') {
      const key = this._resolveTogetherKey();
      if (key) {
        return { available: true, provider: IMAGE_PROVIDERS.TOGETHER_AI, reason: 'Together AI forced via IMAGE_PROVIDER env' };
      }
    }

    // 2. Pollinations (primary - always available, uses API key for better quality)
    const pollinationsKey = this._resolvePollinationsKey();
    if (pollinationsKey) {
      return {
        available: true,
        provider: IMAGE_PROVIDERS.POLLINATIONS,
        reason: `Pollinations API key found — using gen.pollinations.ai`
      };
    }

    // 3. Check Gemini API key (highest quality, free tier)
    const geminiKey = this._resolveGeminiKey();
    if (geminiKey) {
      return {
        available: true,
        provider: IMAGE_PROVIDERS.GEMINI_IMAGEN,
        reason: `Gemini API key found (${geminiKey.slice(0, 8)}...) — using Gemini Imagen`
      };
    }

    // 4. Check Ollama for image model
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

    // 5. Pollinations fallback (free cloud, no key)
    return { available: true, provider: IMAGE_PROVIDERS.POLLINATIONS, reason: 'Pollinations cloud (free, no API key)' };
  }

  // ── Generate Image ────────────────────────────────────────────────────────

  async generateImage(params = {}, transport = null) {
    const {
      prompt = 'futuristic AI visual',
      negativePrompt = '',
      aspectRatio = '1:1',
      size = '768x768',
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

    const fetchFn = transport?.fetch || globalThis.fetch;
    const originalPrompt = String(prompt || '').trim();
    const normalizedPrompt = this.normalizeImagePrompt(originalPrompt);
    const normalizedParams = {
      ...params,
      prompt: normalizedPrompt,
      originalPrompt,
      normalizedPrompt,
      referenceImage,
      generationId,
      messageId,
      signal
    };

    // Resolve provider
    let provider = providerOverride;
    if (!provider) {
      const capability = await this.capabilityProbe(transport);
      provider = capability.provider;
    }

    // Dispatch
    if (provider === IMAGE_PROVIDERS.TOGETHER_AI) {
      const res = await this._generateTogetherAI(normalizedParams, fetchFn);
      if (res && res.success) {
        return res;
      }
      console.warn(`[ImageGeneration] Together AI unavailable (${res?.error}), seamlessly falling back to Pollinations...`);
      return this._generatePollinations(normalizedParams, fetchFn);
    }
    if (provider === IMAGE_PROVIDERS.GEMINI_IMAGEN) {
      const res = await this._generateGeminiImagen(normalizedParams, fetchFn);
      if (res && res.success) {
        return res;
      }
      console.warn(`[ImageGeneration] Gemini Imagen unavailable (${res?.error}), seamlessly falling back to Pollinations Flux...`);
      return this._generatePollinations(normalizedParams, fetchFn);
    }
    if (provider === IMAGE_PROVIDERS.POLLINATIONS) {
      return this._generatePollinations(normalizedParams, fetchFn);
    }
    if (provider === IMAGE_PROVIDERS.OLLAMA) {
      return this._generateOllama(normalizedParams, fetchFn);
    }

    return { success: false, error: `Unknown provider: ${provider}` };
  }

  // ── Pollinations Implementation ───────────────────────────────────────────

  _resolvePollinationsKey() {
    const keys = [
      process.env.POLLINATIONS_API_KEY,
      process.env.POLLINATIONS_KEY
    ];
    for (const key of keys) {
      if (key && key.trim().length > 10) {
        return key.trim();
      }
    }
    return null;
  }

  async _generatePollinations(params, fetchFn) {
    const { prompt, originalPrompt, normalizedPrompt, negativePrompt, aspectRatio, size, referenceImage, generationId, messageId, signal } = params;
    const [width, height] = (size || '1024x1024').split('x').map(Number);

    const seed = Math.floor(Math.random() * 2147483647);
    const optimizedPrompt = this._optimizePrompt(prompt);
    
    // For IMAGE_REVISION, append reference context to prompt for visual continuity
    let finalPrompt = optimizedPrompt;
    if (referenceImage) {
      // Extract key elements from the prompt and combine with reference context
      finalPrompt = `${optimizedPrompt}. Maintain the same visual style, composition, and subject matter as the reference image, with the requested modifications applied.`;
    }
    
    const encoded = encodeURIComponent(finalPrompt);
    const apiKey = this._resolvePollinationsKey();

    // Model priority: quality first, fallback to fast
    const models = ['flux', 'nanobanana-pro', 'nanobanana', 'gptimage', 'turbo'];
    let lastError = null;

    for (const model of models) {
      const url = `https://gen.pollinations.ai/image/${encoded}?model=${model}&width=${width || 768}&height=${height || 768}&nologo=true&seed=${seed}&quality=80&format=jpg`;

      const headers = {};
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      try {
        const response = await fetchFn(url, {
          headers,
          signal: this._requestSignal(signal, 90000),
          redirect: 'follow'
        });

        if (!response.ok) {
          lastError = `Pollinations HTTP ${response.status} (model: ${model})`;
          console.warn(`[ImageGeneration] ${lastError}, trying next model...`);
          continue;
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('image')) {
          const text = await response.text().catch(() => '');
          lastError = `Pollinations returned non-image content: ${contentType} (model: ${model})`;
          console.warn(`[ImageGeneration] ${lastError}, trying next model...`);
          continue;
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        // Check file size (< 1MB)
        const MAX_SIZE = 1024 * 1024; // 1MB
        if (buffer.length > MAX_SIZE) {
          lastError = `Pollinations returned image too large: ${(buffer.length / 1024 / 1024).toFixed(2)}MB (model: ${model})`;
          console.warn(`[ImageGeneration] ${lastError}, trying next model...`);
          continue;
        }

        // Verify PNG/JPEG magic
        const isValidImage = this._verifyImageBytes(buffer);
        if (!isValidImage) {
          lastError = `Pollinations returned invalid image bytes (model: ${model})`;
          console.warn(`[ImageGeneration] ${lastError}, trying next model...`);
          continue;
        }

        // Detect actual format from response content-type or magic bytes
        const respIsPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_MAGIC);
        const respIsJpeg = buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
        const detectedMime = respIsPng ? 'image/png' : respIsJpeg ? 'image/jpeg' : contentType.includes('jpeg') ? 'image/jpeg' : 'image/png';

        const artifact = this._persistArtifact(buffer, {
          prompt: finalPrompt,
          originalPrompt: originalPrompt || prompt,
          normalizedPrompt: normalizedPrompt || optimizedPrompt,
          generationId,
          messageId,
          negativePrompt,
          provider: IMAGE_PROVIDERS.POLLINATIONS,
          model,
          width: width || 768,
          height: height || 768,
          seed,
          mimeType: detectedMime,
          referenceImage: referenceImage || null
        });

        console.log(`[ImageGeneration] Pollinations success with model: ${model} (${(buffer.length / 1024).toFixed(1)}KB)${referenceImage ? ' (revision)' : ''}`);
        return { success: true, artifact };
      } catch (err) {
        lastError = `Pollinations failed (model: ${model}): ${err.message}`;
        console.warn(`[ImageGeneration] ${lastError}, trying next model...`);
        continue;
      }
    }

    return { success: false, error: lastError || 'All Pollinations models failed' };
  }

  // ── Gemini Imagen Implementation ──────────────────────────────────────────

  async _generateGeminiImagen(params, fetchFn) {
    const { prompt, originalPrompt, normalizedPrompt, negativePrompt, aspectRatio, size, generationId, messageId, signal } = params;
    const optimizedPrompt = this._optimizePrompt(prompt);

    const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';

    try {
      const result = await geminiProviderInstance.sendImage({
        prompt: optimizedPrompt,
        negativePrompt,
        aspectRatio: aspectRatio || '16:9',
        model,
        signal: this._requestSignal(signal, 90000),
        fetchFn
      });
      const base64Data = result.base64Data;
      const mimeType = result.mimeType;
      const buffer = Buffer.from(base64Data, 'base64');

      // Verify image bytes
      const isValidImage = this._verifyImageBytes(buffer);
      if (!isValidImage) {
        return { success: false, error: `Gemini Imagen returned invalid image bytes (${buffer.length} bytes)` };
      }

      const [width, height] = (size || '1024x1024').split('x').map(Number);

      const artifact = this._persistArtifact(buffer, {
        prompt: optimizedPrompt,
        originalPrompt: originalPrompt || params.prompt,
        normalizedPrompt: normalizedPrompt || optimizedPrompt,
        generationId,
        messageId,
        negativePrompt,
        provider: IMAGE_PROVIDERS.GEMINI_IMAGEN,
        model: result.model,
        keyIndex: result.keyIndex,
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

  _resolveTogetherKey() {
    const keys = [
      process.env.TOGETHER_API_KEY,
      process.env.TOGETHER_API_KEY_1,
      process.env.TOGETHER_API_KEY_2
    ];
    for (const key of keys) {
      if (key && key.trim().length > 10 && key.trim() !== 'API_KEY_TOGETHER_ANDA') {
        return key.trim();
      }
    }
    return null;
  }

  // ── Together AI Implementation (FLUX.1 Schnell Free) ─────────────────────

  async _generateTogetherAI(params, fetchFn) {
    const { prompt, originalPrompt, normalizedPrompt, negativePrompt, size, generationId, messageId, signal } = params;
    const [width, height] = (size || '1024x1024').split('x').map(Number);
    const apiKey = this._resolveTogetherKey();
    const optimizedPrompt = this._optimizePrompt(prompt);

    try {
      const response = await fetchFn('https://api.together.xyz/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'black-forest-labs/FLUX.1-schnell-Free',
          prompt: optimizedPrompt,
          width: width || 1024,
          height: height || 1024,
          steps: 4,
          n: 1,
          response_format: 'b64_json'
        }),
        signal: this._requestSignal(signal, 60000)
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return { success: false, error: `Together AI HTTP ${response.status}: ${errText.slice(0, 150)}` };
      }

      const data = await response.json();
      const imageData = data.data?.[0];
      if (!imageData?.b64_json) {
        return { success: false, error: 'Together AI returned no image data' };
      }

      const buffer = Buffer.from(imageData.b64_json, 'base64');

      const isValidImage = this._verifyImageBytes(buffer);
      if (!isValidImage) {
        return { success: false, error: `Together AI returned invalid image bytes (${buffer.length} bytes)` };
      }

      const artifact = this._persistArtifact(buffer, {
        prompt: optimizedPrompt,
        originalPrompt: originalPrompt || prompt,
        normalizedPrompt: normalizedPrompt || optimizedPrompt,
        generationId,
        messageId,
        negativePrompt,
        provider: IMAGE_PROVIDERS.TOGETHER_AI,
        model: 'FLUX.1-schnell-Free',
        width: width || 1024,
        height: height || 1024,
        mimeType: 'image/png'
      });

      console.log(`[ImageGeneration] Together AI success with FLUX.1-schnell-Free`);
      return { success: true, artifact };
    } catch (err) {
      return { success: false, error: `Together AI generation failed: ${err.message}` };
    }
  }

  // ── Ollama Implementation (stub — requires image model like llava) ────────

  async _generateOllama(params, fetchFn) {
    const { prompt, originalPrompt, normalizedPrompt, generationId, messageId, signal } = params;
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
        signal: this._requestSignal(signal, 120000)
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
          originalPrompt: originalPrompt || prompt,
          normalizedPrompt: normalizedPrompt || optimizedPrompt,
          generationId,
          messageId,
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

  // ── Helpers ──────────────────────────────────────────────────────────────

  _optimizePrompt(userPrompt) {
    const base = this.normalizeImagePrompt(userPrompt);
    let prompt = base;

    // Translation & Enrichment Dictionary for Indonesian visual concepts
    const mappings = [
      [/\bmesin\s+pemotong\s+rumput\b/gi, 'mechanical lawn mower, grass cutting machine, push lawn mower equipment on a manicured green grass lawn'],
      [/\bpemotong\s+rumput\b/gi, 'lawn mower machine, mechanical grass cutter'],
      [/\bpesawat\s+tempur(?:\s+di\s+langit)?\b/gi, 'supersonic fighter jet aircraft soaring through the sky with dramatic clouds'],
      [/\bpesawat\s+terbang\b/gi, 'commercial airliner airplane flying in the sky'],
      [/\brumah\s+modern\s+3\s+lantai\b/gi, 'three-story luxury modern architectural villa house, contemporary exterior design'],
      [/\brumah\s+modern\s+2\s+lantai\b/gi, 'two-story modern luxury residential house, architectural photography'],
      [/\brumah\s+3\s+lantai\b/gi, 'three-story modern architectural house, exterior view'],
      [/\brumah\s+3d\b/gi, '3D architectural render of a modern house, photorealistic lighting, octane render'],
      [/\brumah\s+modern\b/gi, 'modern architectural house, exterior design'],
      [/\brumah\b/gi, 'house architecture, modern exterior'],
      [/\bmobil\s+balap\b/gi, 'high performance racing sports car'],
      [/\bmobil\b/gi, 'automobile car'],
      [/\bsepeda\s+motor\b|\bmotor\b/gi, 'motorcycle'],
      [/\bgedung\s+dpr(?:\s+mpr)?\b/gi, 'Indonesian DPR MPR Parliament landmark building in Jakarta, green dome architecture'],
      [/\bkota\s+futuristik\b/gi, 'futuristic sci-fi cyberpunk metropolis city with flying vehicles and glowing neon towers'],
      [/\bpemandangan\s+gunung(?:\s+yang\s+indah)?\b/gi, 'majestic scenic mountain landscape with clear blue sky and lush valleys'],
      [/\bpantai\s+pasir\s+putih\b/gi, 'pristine white sand tropical beach with clear turquoise ocean water'],
      [/\bpantai\b/gi, 'beautiful coastal beach scenery with ocean waves'],
      [/\bhutan\s+tropis\b|\bhutan\b/gi, 'lush tropical rainforest with morning sunlight rays filtering through trees'],
      [/\btaman\s+bunga\b|\btaman\b/gi, 'vibrant lush botanical flower garden with stone pathway and colorful blossoms'],
      [/\bkucing\s+lucu\b|\bkucing\b/gi, 'cute fluffy domestic cat with expressive eyes, high detail'],
      [/\banjing\b/gi, 'dog'],
      [/\bburung\b/gi, 'bird in nature'],
      [/\bdi\s+langit\b/gi, 'in the sky'],
      [/\bdi\s+laut\b/gi, 'in the ocean'],
      [/\bdi\s+malam\s+hari\b/gi, 'at night under moonlight'],
      [/\bdi\s+siang\s+hari\b/gi, 'in bright daylight']
    ];

    for (const [pattern, replacement] of mappings) {
      if (pattern.test(prompt)) {
        prompt = prompt.replace(pattern, replacement);
      }
    }

    // Inanimate machine/vehicle/building protection: ensure diffusion model doesn't inject random humans
    const isInanimate = /\b(?:lawn mower|machine|aircraft|airplane|jet|house|car|building|motorcycle)\b/i.test(prompt);
    if (isInanimate && !/\b(?:person|human|people|woman|man|pilot|driver)\b/i.test(prompt)) {
      prompt += ', photorealistic, high resolution, detailed, clean composition, no people, no human figures';
    }

    return prompt;
  }

  normalizeImagePrompt(userPrompt) {
    const original = String(userPrompt || '').replace(/\s+/g, ' ').trim();
    if (!original) return 'Create a high-quality image of a futuristic AI visual.';

    let subject = original
      .replace(/^jin\b[\s,:-]*/i, '')
      .replace(/^(?:apakah\s+kamu\s+bisa|bisakah\s+kamu|bisakah|can\s+you|could\s+you)\s+/i, '')
      .replace(/^(?:tolong|please)\s+/i, '')
      .replace(/^(?:buat(?:kan)?|bikin|generate|create|hasilkan|render(?:kan)?)\s+/i, '')
      .replace(/^(?:sebuah|a|an)\s+/i, '')
      .replace(/^(?:image|gambar|illustration|ilustrasi|visual|foto|poster|artwork)\s*(?:of|tentang|mengenai)?\s*/i, '')
      .replace(/^(?:buat(?:kan)?|bikin|generate|create|hasilkan|render(?:kan)?)\s+/i, '')
      .replace(/^(?:sebuah|a|an)\s+/i, '')
      // Strip revision vocabulary for IMAGE_REVISION prompts
      .replace(/^(?:revisi|ubah|ganti|update|regenerate|buat\s+ulang|edit|modifikasi|timpa|ulang)\s+/i, '')
      .replace(/^(?:suasananya|warnanya|latarnya|gambarnya|visualnya|fotonya)\s+(?:menjadi|jadi|dengan|yang)\s*/i, '')
      .replace(/[?!]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

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
      model: metadata.model || null,
      prompt: metadata.prompt || '',
      originalPrompt: metadata.originalPrompt || metadata.prompt || '',
      normalizedPrompt: metadata.normalizedPrompt || metadata.prompt || '',
      generationId: metadata.generationId || null,
      messageId: metadata.messageId || null,
      bytesSize: buffer.length,
      createdAt: timestamp,
      renderable: true,
      metadata: {
        artifactId: id,
        generationId: metadata.generationId || null,
        messageId: metadata.messageId || null,
        originalPrompt: metadata.originalPrompt || metadata.prompt || '',
        normalizedPrompt: metadata.normalizedPrompt || metadata.prompt || '',
        provider: metadata.provider || 'UNKNOWN',
        model: metadata.model || null,
        createdAt: timestamp,
        width: metadata.width || null,
        height: metadata.height || null,
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

export const imageGenerationInstance = new ImageGeneration();
export default imageGenerationInstance;
