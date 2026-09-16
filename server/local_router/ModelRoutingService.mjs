/**
 * ModelRoutingService.mjs
 * Intelligent Hybrid Model Routing Service for UltimateAI / JIN Runtime.
 * Primary Local Inference Engine: llama.cpp (Qwen 2.5 3B on :8080)
 * Visual / Multimodal Engine: Gemini Cloud
 * 
 * STRICT POLICY:
 *  - Zero silent / hidden fallback between runtimes.
 *  - When local Qwen is chosen, failures report directly to caller.
 */

import { llamaCppAdapterInstance } from '../providers/LlamaCppAdapter.mjs';
import { geminiProviderInstance } from '../providers/GeminiProvider.mjs';
import { groqProviderInstance } from '../providers/GroqProvider.mjs';

const HEAVY_CAPABILITIES = new Set([
  'DEEP_REASONING',
  'APP_SYNTHESIS',
  'MASSIVE_EXTRACTION',
  'MULTI_FILE_REFACTOR',
  'LONG_CONTEXT_ANALYSIS'
]);

const VISUAL_CAPABILITIES = new Set([
  'IMAGE_GENERATION',
  'VIDEO_GENERATION',
  'GRAPHIC_GENERATION',
  'VISUAL_GENERATION',
  'TEXT_TO_IMAGE',
  'TEXT_TO_VIDEO',
  'TEXT_TO_GRAPHIC'
]);

export class ModelRoutingService {
  constructor() {
    this.name = 'ModelRoutingService';
  }

  _strategy() {
    if (
      process.env.ROUTER_FORCE_LOCAL === 'true' ||
      process.env.ROUTE_STRATEGY === 'local_first' ||
      process.env.ROUTE_PROVIDER === 'llamacpp'
    ) {
      return 'local_first';
    }
    return geminiProviderInstance.isConfigured() ? 'cloud_first' : 'local_first';
  }

  _localModel() {
    return process.env.LLAMACPP_MODEL || 'hermes-3-8b';
  }

  _maxPromptChars() {
    const raw = Number(process.env.LOCAL_LLM_MAX_PROMPT_CHARS || 48000);
    return Number.isFinite(raw) && raw > 0 ? raw : 48000;
  }

  _localRouteLabel(model) {
    const modelName = String(model || 'hermes-3-8b').split(':')[0].replace(/[^a-z0-9]+/gi, '_').toUpperCase();
    return `LOCAL_${modelName}_PRIMARY`;
  }

  _normalizeCapability(capability) {
    return String(capability || 'FAST_CHAT').trim().toUpperCase().replace(/[\s-]+/g, '_');
  }

  _isVisualCapability(capability) {
    return VISUAL_CAPABILITIES.has(this._normalizeCapability(capability));
  }

  _hasMedia(messages = []) {
    if (!Array.isArray(messages)) return false;
    for (const msg of messages) {
      if (!msg) continue;
      if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (!part) continue;
          if (part.type === 'image_url' || part.type === 'image' || part.image_url || part.inlineData) {
            return true;
          }
        }
      }
      if (msg.images && Array.isArray(msg.images) && msg.images.length > 0) return true;
      if (msg.inlineData) return true;
    }
    return false;
  }

  _truncateForLocal(messages = [], maxChars = 16000) {
    if (!Array.isArray(messages)) return messages;
    const copy = JSON.parse(JSON.stringify(messages));
    const lastUser = [...copy].reverse().find(m => m && m.role === 'user');
    if (!lastUser) return copy;

    if (typeof lastUser.content === 'string' && lastUser.content.length > maxChars) {
      lastUser.content = `${lastUser.content.slice(0, maxChars)}\n...[konten dipotong oleh router: melebihi batas konteks]`;
    } else if (Array.isArray(lastUser.content)) {
      for (let i = lastUser.content.length - 1; i >= 0; i--) {
        const part = lastUser.content[i];
        if (part && typeof part.text === 'string' && part.text.length > maxChars) {
          part.text = `${part.text.slice(0, maxChars)}\n...[konten dipotong oleh router: melebihi batas konteks]`;
          break;
        }
      }
    }
    return copy;
  }

  _sanitizeMessages(messages = []) {
    if (!Array.isArray(messages)) return [];
    return messages
      .filter(m => m && typeof m === 'object' && m.role)
      .map(m => {
        const role = String(m.role).toLowerCase();
        const sanitized = { role };

        if (typeof m.content === 'string') {
          sanitized.content = m.content;
        } else if (Array.isArray(m.content)) {
          sanitized.content = m.content.map(part => {
            if (typeof part === 'string') return { type: 'text', text: part };
            if (part && typeof part === 'object') {
              if (part.type === 'text') return { type: 'text', text: part.text || '' };
              if (part.type === 'image_url' && part.image_url) {
                return { type: 'image_url', image_url: { url: part.image_url.url || part.image_url } };
              }
              if (part.type === 'image' && part.image) {
                return { type: 'image_url', image_url: { url: part.image } };
              }
            }
            return part;
          }).filter(Boolean);
        } else {
          sanitized.content = String(m.content || '');
        }

        if (m.name && typeof m.name === 'string') sanitized.name = m.name;
        if (Array.isArray(m.tool_calls)) sanitized.tool_calls = m.tool_calls;
        if (m.tool_call_id) sanitized.tool_call_id = m.tool_call_id;

        return sanitized;
      });
  }

  determineRoute({ messages = [], capability = 'FAST_CHAT', model = 'auto' }) {
    const hasMedia = this._hasMedia(messages);
    const normalizedCapability = this._normalizeCapability(capability);
    const heavy = HEAVY_CAPABILITIES.has(normalizedCapability);
    const geminiModel = (model && model.startsWith('gemini-')) ? model : (process.env.GEMINI_MODEL || 'gemini-3.6-flash');
    const localModel = this._localModel();
    const cleanModel = String(model || '').trim();

    const isExplicitGemini = cleanModel.startsWith('gemini-');
    const isExplicitLocal  = cleanModel.startsWith('llamacpp:') || cleanModel.startsWith('hermes') || cleanModel.startsWith('ollama:');
    const isLocalPreferred = !isExplicitGemini && (
      isExplicitLocal ||
      process.env.ROUTER_FORCE_LOCAL === 'true' ||
      process.env.ROUTE_PROVIDER === 'llamacpp' ||
      process.env.ROUTE_STRATEGY === 'local_first'
    );
    const hasGemini = geminiProviderInstance.isConfigured();

    // 1. Visual generation must stay on Gemini (image/video generation)
    if (this._isVisualCapability(normalizedCapability)) {
      return {
        candidates: hasGemini
          ? [{ provider: 'gemini', model: geminiModel, fallback: false }]
          : [],
        hasMedia,
        heavy,
        capability: normalizedCapability,
        strategy: 'visual_gemini_only',
        forcedProvider: 'gemini',
        provider: 'gemini',
        strictCapability: true,
        label: 'CLOUD_GEMINI_VISUAL'
      };
    }

    // 2. Multimodal messages (images/documents) MUST route to Gemini Vision
    if (hasMedia && hasGemini) {
      return {
        candidates: [
          { provider: 'gemini', model: geminiModel, fallback: false }
        ],
        hasMedia,
        heavy,
        capability: normalizedCapability,
        strategy: 'cloud_multimodal',
        forcedProvider: 'gemini',
        provider: 'gemini',
        label: 'CLOUD_GEMINI_MULTIMODAL'
      };
    }

    // 3. Local Primary Route (Hermes 3:8B via llama.cpp)
    // ZERO hidden fallback.
    if (isLocalPreferred) {
      return {
        candidates: [
          { provider: 'llamacpp', model: localModel, fallback: false }
        ],
        hasMedia,
        heavy,
        capability: normalizedCapability,
        strategy: 'local_first',
        forcedProvider: 'llamacpp',
        provider: 'llamacpp',
        label: this._localRouteLabel(localModel)
      };
    }

    // 4. Cloud Primary Route (Gemini)
    if (hasGemini) {
      return {
        candidates: [
          { provider: 'gemini', model: geminiModel, fallback: false }
        ],
        hasMedia,
        heavy,
        capability: normalizedCapability,
        strategy: 'cloud_first',
        forcedProvider: null,
        provider: 'gemini',
        label: 'CLOUD_GEMINI_PRIMARY'
      };
    }

    return {
      candidates: [{ provider: 'llamacpp', model: localModel, fallback: false }],
      hasMedia,
      heavy,
      capability: normalizedCapability,
      strategy: 'local_first',
      forcedProvider: 'llamacpp',
      provider: 'llamacpp',
      label: this._localRouteLabel(localModel)
    };
  }

  routeCompute({ messages = [], capability = 'FAST_CHAT', model = 'auto' }) {
    return this.determineRoute({ messages, capability, model });
  }

  async routeChat({
    messages = [],
    stream = false,
    model = 'auto',
    capability = 'FAST_CHAT',
    temperature = 0.7,
    maxTokens = null
  }, onChunk = null) {
    const route = this.determineRoute({ messages, capability, model });
    let emitted = false;

    const safeOnChunk = typeof onChunk === 'function' ? (chunk) => {
      emitted = true;
      onChunk(chunk);
    } : null;

    const sanitizedMessages = this._sanitizeMessages(messages);

    // 1. LOCAL ROUTE: LLAMA.CPP
    if (route.provider === 'llamacpp') {
      // isAvailable() now checks for status='ok' (model fully loaded).
      // If server just started, waitUntilReady() polls up to 30s before giving up.
      const isReady = await llamaCppAdapterInstance.isAvailable() ||
        await llamaCppAdapterInstance.waitUntilReady(30_000);
      if (!isReady) {
        const err = new Error('LLAMACPP_UNAVAILABLE: llama-server tidak aktif atau model belum selesai dimuat di http://127.0.0.1:8080. Tunggu beberapa detik lalu coba lagi.');
        err.code = 'LLAMACPP_UNAVAILABLE';
        err.routeAttempts = route.candidates;
        throw err;
      }

      try {
        const localMessages = this._truncateForLocal(sanitizedMessages, this._maxPromptChars());
        const raw = await llamaCppAdapterInstance.sendChat(
          { messages: localMessages, stream, model: route.candidates[0].model, temperature, ...(maxTokens ? { maxTokens } : {}) },
          safeOnChunk
        );

        const responseId = `llamacpp-hermes-${Date.now()}`;
        return {
          content: raw,
          model,
          actualModel: route.candidates[0].model,
          providerGateway: 'LLAMA_CPP',
          transport: 'LLAMA_CPP',
          transportClass: 'LOCAL_LLAMA_CPP',
          upstreamEndpoint: `${llamaCppAdapterInstance.host}/v1/chat/completions`,
          localResponseId: responseId,
          responseId,
          routedTo: 'llamacpp',
          fallbackUsed: false,
          routePlan: route
        };
      } catch (err) {
        if (stream && emitted) {
          throw err;
        }
        if (err.code === 'CONTEXT_LIMIT_EXCEEDED' || err.message?.includes('CONTEXT_LIMIT_EXCEEDED')) {
          err.code = 'CONTEXT_LIMIT_EXCEEDED';
          throw err;
        }
        // STRICT ZERO FALLBACK POLICY: Do not silently fallback to Ollama or Gemini
        const wrappedErr = new Error(`LLAMACPP_EXECUTION_ERROR: ${err.message}`);
        wrappedErr.original = err;
        wrappedErr.code = err.code || 'LLAMACPP_EXECUTION_ERROR';
        wrappedErr.routeAttempts = route.candidates;
        throw wrappedErr;
      }
    }

    // 2. CLOUD ROUTE: GEMINI
    if (route.provider === 'gemini') {
      try {
        const raw = await geminiProviderInstance.sendChat(
          { messages: sanitizedMessages, stream, model, temperature },
          safeOnChunk
        );

        const resolvedModel = geminiProviderInstance._resolveModel(model);
        const responseId = `gemini-${Date.now()}`;
        return {
          content: raw,
          model,
          actualModel: resolvedModel,
          providerGateway: 'GEMINI',
          transport: 'GEMINI_CLOUD',
          transportClass: 'CLOUD_GEMINI',
          upstreamEndpoint: `${geminiProviderInstance.baseUrl}/models`,
          localResponseId: responseId,
          responseId,
          routedTo: 'gemini',
          fallbackUsed: false,
          routePlan: route
        };
      } catch (err) {
        if (stream && emitted) {
          throw err;
        }
        if (route.hasMedia) {
          console.error(`[ModelRoutingService] Gemini Multimodal failed: ${err.message}`);
          throw new Error(`MULTIMODAL_ERROR: Gagal memproses gambar/media dengan Gemini Vision: ${err.message}`);
        }
        if (route.strictCapability) {
          throw new Error(`VISUAL_PROVIDER_ERROR: Gemini tidak dapat menyelesaikan capability ${route.capability}: ${err.message}`);
        }
        throw err;
      }
    }

    const err = new Error(`NO_ROUTE_MATCHED: Tidak ditemukan provider aktif untuk rute ${route.provider}`);
    err.code = 'NO_ROUTE';
    throw err;
  }

  async status() {
    const llamaCheck = await llamaCppAdapterInstance.healthCheck();
    const geminiAvailable = await geminiProviderInstance.isAvailable();
    const hasGemini = geminiProviderInstance.isConfigured();
    const hasGroq = groqProviderInstance.isConfigured();
    const groqAvailable = hasGroq ? await groqProviderInstance.isAvailable() : false;

    const isLocalPreferred =
      process.env.ROUTER_FORCE_LOCAL === 'true' ||
      process.env.ROUTE_PROVIDER === 'llamacpp' ||
      process.env.ROUTE_STRATEGY === 'local_first';

    return {
      strategy: isLocalPreferred ? 'local_first' : 'cloud_first',
      primaryProvider: isLocalPreferred ? 'llamacpp' : 'gemini',
      localLLM: {
        provider: 'llamacpp',
        endpoint: llamaCppAdapterInstance.host,
        configured: true,
        status: llamaCheck.status,
        model: this._localModel(),
        role: 'primary_local'
      },
      cloudLLM: {
        provider: 'gemini',
        configured: hasGemini,
        available: geminiAvailable,
        model: geminiProviderInstance.defaultModel
      },
      groqLLM: {
        provider: 'groq',
        configured: hasGroq,
        available: groqAvailable,
        model: groqProviderInstance.defaultModel
      },
      mode: isLocalPreferred ? 'LOCAL_LLAMA_HERMES_PRIMARY' : 'HYBRID_CLOUD_PRIMARY',
      providerGateway: isLocalPreferred ? 'LLAMA_CPP' : 'GEMINI',
      routingTiers: [
        { tier: 1, provider: 'llamacpp', model: this._localModel(), status: llamaCheck.status },
        { tier: 2, provider: 'gemini', status: geminiAvailable ? 'READY' : 'UNAVAILABLE' }
      ]
    };
  }
}

export const modelRoutingServiceInstance = new ModelRoutingService();
export default modelRoutingServiceInstance;