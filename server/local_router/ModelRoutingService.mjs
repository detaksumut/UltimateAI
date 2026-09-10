/**
 * ModelRoutingService.mjs
 * Intelligent Hybrid Model Routing Service for UltimateAI / JIN Runtime.
 * Routes text reasoning to local Qwen and visual generation to Gemini,
 * while preserving cloud/local failover for ordinary chat.
 * 
 * Routing Policies:
 *  - Primary Provider: Gemini 2.5 Flash Cloud (<1.5s TTFB, zero CPU/RAM stress)
 *  - Fallback Provider: Ollama (:11434) (offline safety net)
 *  - Zero Interruption: Seamless auto-failover if cloud connection drops
 */

import { ollamaProviderInstance } from '../providers/OllamaProvider.mjs';
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
    if (process.env.ROUTER_FORCE_LOCAL === 'true') {
      return 'local_only';
    }
    return geminiProviderInstance.isConfigured() ? 'cloud_first' : 'local_first';
  }

  _maxPromptChars() {
    const raw = Number(process.env.LOCAL_LLM_MAX_PROMPT_CHARS || 16000);
    return Number.isFinite(raw) && raw > 0 ? raw : 16000;
  }

  _localRouteLabel(model) {
    const modelName = String(model || 'ollama').split(':')[0].replace(/[^a-z0-9]+/gi, '_').toUpperCase();
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

  determineRoute({ messages = [], capability = 'FAST_CHAT', model = 'auto' }) {
    const hasMedia = this._hasMedia(messages);
    const normalizedCapability = this._normalizeCapability(capability);
    const heavy = HEAVY_CAPABILITIES.has(normalizedCapability);
    const geminiModel = (model && model.startsWith('gemini-')) ? model : (process.env.GEMINI_MODEL || 'gemini-3.6-flash');
    const ollamaModel = process.env.OLLAMA_MODEL || 'qwen3:8b';
    const cleanModel = String(model || '').trim();
    const isExplicitGemini = cleanModel.startsWith('gemini-');
    const isExplicitLocal  = cleanModel.startsWith('ollama:') || cleanModel.startsWith('hermes');
    const isLocalPreferred = !isExplicitGemini && (
      isExplicitLocal ||
      process.env.ROUTER_FORCE_LOCAL === 'true' ||
      process.env.ROUTE_PROVIDER === 'ollama' ||
      process.env.ROUTE_STRATEGY === 'local_first'
    );
    const hasGemini = geminiProviderInstance.isConfigured();

    // Visual generation must stay on Gemini. Falling back to a text model would
    // produce a plausible-looking text response while silently dropping the
    // requested artifact capability.
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

    // Multimodal messages (images/documents) MUST route to Gemini Vision
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

    // If user configured local-first or Hermes 3 in .env / model
    if (isLocalPreferred) {
      return {
        candidates: [
          { provider: 'ollama', model: ollamaModel, fallback: false },
          ...(hasGemini ? [{ provider: 'gemini', model: geminiModel, fallback: true }] : [])
        ],
        hasMedia,
        heavy,
        capability: normalizedCapability,
        strategy: 'local_first',
        forcedProvider: 'ollama',
        provider: 'ollama',
        label: this._localRouteLabel(ollamaModel)
      };
    }

    if (hasGemini) {
      return {
        candidates: [
          { provider: 'gemini', model: geminiModel, fallback: false },
          { provider: 'ollama', model: ollamaModel, fallback: !hasMedia }
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
      candidates: [{ provider: 'ollama', model: ollamaModel, fallback: false }],
      hasMedia,
      heavy,
      capability: normalizedCapability,
      strategy: 'local_first',
      forcedProvider: 'ollama',
      provider: 'ollama',
      label: 'LOCAL_OLLAMA'
    };
  }

  routeCompute({ messages = [], capability = 'FAST_CHAT', model = 'auto' }) {
    return this.determineRoute({ messages, capability, model });
  }

  async routeChat(args = {}, onChunk = null) {
    const { messages = [], stream = false, model = 'auto', capability = 'FAST_CHAT', temperature = 0.7 } = args || {};
    const route = this.determineRoute({ messages, capability, model });

    let emitted = false;
    const safeOnChunk = onChunk ? (chunk) => {
      emitted = true;
      onChunk(chunk);
    } : null;

    // 1. PRIMARY ROUTE: GEMINI CLOUD
    if (route.provider === 'gemini') {
      try {
        const raw = await geminiProviderInstance.sendChat(
          { messages, stream, model, temperature },
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
        // If stream already emitted tokens, cannot switch mid-stream cleanly
        if (stream && emitted) {
          throw err;
        }

        // If this was a multimodal request, NEVER fallback to text-only Ollama
        if (route.hasMedia) {
          console.error(`[ModelRoutingService] Gemini Multimodal failed: ${err.message}`);
          throw new Error(`MULTIMODAL_ERROR: Gagal memproses gambar/media dengan Gemini Vision: ${err.message}`);
        }
        if (route.strictCapability) {
          throw new Error(`VISUAL_PROVIDER_ERROR: Gemini tidak dapat menyelesaikan capability ${route.capability}: ${err.message}`);
        }

        console.warn(`[ModelRoutingService] Gemini Cloud failed (${err.message}). Engaging Ollama Local failover...`);
        // Fall through to Ollama fallback below
      }
    }

    // 2. TIER 2 FAILOVER: GROQ CLOUD ULTRA-FAST
    // Fires when Gemini is unavailable/quota-exhausted. <0.8s TTFB, zero local load.
    if (groqProviderInstance.isConfigured()) {
      const groqReady = await groqProviderInstance.isAvailable();
      if (groqReady) {
        try {
          const groqModel = groqProviderInstance._resolveModel(model);
          console.log(`[ModelRoutingService] Engaging Groq Cloud Tier-2 failover... model=${groqModel}`);
          const raw = await groqProviderInstance.sendChat(
            { messages, stream, model, temperature },
            safeOnChunk
          );

          const responseId = `groq-${Date.now()}`;
          return {
            content: raw,
            model,
            actualModel: groqModel,
            providerGateway: 'GROQ',
            transport: 'GROQ_CLOUD',
            transportClass: 'CLOUD_GROQ',
            upstreamEndpoint: `${groqProviderInstance.baseUrl}/chat/completions`,
            localResponseId: responseId,
            responseId,
            routedTo: 'groq',
            fallbackUsed: true,
            routePlan: route
          };
        } catch (groqErr) {
          if (stream && emitted) throw groqErr;
          console.warn(`[ModelRoutingService] Groq Cloud Tier-2 failed (${groqErr.message}). Engaging Ollama Local Tier-3...`);
        }
      } else {
        console.warn('[ModelRoutingService] Groq is configured but unreachable. Skipping to Tier-3 Ollama.');
      }
    }

    // 3. TIER 3 FALLBACK: OLLAMA LOCAL (pre-flight checked)
    const ollamaAvailable = await ollamaProviderInstance.isAvailable();
    if (!ollamaAvailable) {
      const err = new Error('AI_PROVIDERS_UNAVAILABLE: Gemini Cloud dan Ollama lokal (:11434) tidak dapat dihubungi.');
      err.code = 'PROVIDERS_UNAVAILABLE';
      err.routeAttempts = route.candidates;
      throw err;
    }

    try {
      const localMessages = this._truncateForLocal(messages, this._maxPromptChars());
      const raw = await ollamaProviderInstance.sendChat(
        { messages: localMessages, stream, model, temperature },
        safeOnChunk
      );

      const resolvedModel = ollamaProviderInstance._resolveModel(model);
      const responseId = `ollama-${Date.now()}`;
      return {
        content: raw,
        model,
        actualModel: resolvedModel,
        providerGateway: 'OLLAMA',
        transport: 'OLLAMA',
        transportClass: 'LOCAL_OLLAMA',
        upstreamEndpoint: `${ollamaProviderInstance.baseUrl}/v1/chat/completions`,
        localResponseId: responseId,
        responseId,
        routedTo: 'ollama',
        fallbackUsed: route.provider === 'gemini', // was a fallback if gemini was primary
        routePlan: route
      };
    } catch (err) {
      if (stream && emitted) {
        throw err;
      }
      const wrappedErr = new Error(`AI_EXECUTION_ERROR: ${err.message}`);
      wrappedErr.original = err;
      wrappedErr.routeAttempts = route.candidates;
      throw wrappedErr;
    }
  }

  async status() {
    const local = await ollamaProviderInstance.healthCheck();
    const geminiAvailable = await geminiProviderInstance.isAvailable();
    const hasGemini = geminiProviderInstance.isConfigured();
    const hasGroq = groqProviderInstance.isConfigured();
    const groqAvailable = hasGroq ? await groqProviderInstance.isAvailable() : false;
    const isLocalPreferred =
      process.env.ROUTER_FORCE_LOCAL === 'true' ||
      process.env.ROUTE_PROVIDER === 'ollama' ||
      process.env.ROUTE_STRATEGY === 'local_first';

    const isCloudFirst = hasGemini && !isLocalPreferred;

    return {
      strategy: isCloudFirst ? 'cloud_first' : 'local_first',
      primaryProvider: isCloudFirst ? 'gemini' : 'ollama',
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
        model: groqProviderInstance.defaultModel,
        role: 'tier2_failover'
      },
      localLLM: local,
      mode: isCloudFirst ? 'HYBRID_CLOUD_PRIMARY' : this._localRouteLabel(local.model),
      providerGateway: isCloudFirst ? 'GEMINI' : 'OLLAMA',
      routingTiers: [
        { tier: 1, provider: 'gemini', status: geminiAvailable ? 'READY' : 'UNAVAILABLE' },
        { tier: 2, provider: 'groq', status: groqAvailable ? 'READY' : (hasGroq ? 'UNREACHABLE' : 'NOT_CONFIGURED') },
        { tier: 3, provider: 'ollama', status: local.status }
      ]
    };
  }
}

export const modelRoutingServiceInstance = new ModelRoutingService();
export default modelRoutingServiceInstance;