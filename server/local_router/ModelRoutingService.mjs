/**
 * ModelRoutingService.mjs
 * Intelligent Hybrid Model Routing Service for UltimateAI / JIN Runtime.
 * Orchestrates Cloud-First High-Speed Inference (Gemini 2.5 Flash)
 * with On-Device Emergency Resilience (Ollama hermes3:8b).
 * 
 * Routing Policies:
 *  - Primary Provider: Gemini 2.5 Flash Cloud (<1.5s TTFB, zero CPU/RAM stress)
 *  - Fallback Provider: Ollama (:11434) (offline safety net)
 *  - Zero Interruption: Seamless auto-failover if cloud connection drops
 */

import { ollamaProviderInstance } from '../providers/OllamaProvider.mjs';
import { geminiProviderInstance } from '../providers/GeminiProvider.mjs';

const HEAVY_CAPABILITIES = new Set([
  'DEEP_REASONING',
  'APP_SYNTHESIS',
  'MASSIVE_EXTRACTION',
  'MULTI_FILE_REFACTOR',
  'LONG_CONTEXT_ANALYSIS'
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
    const heavy = HEAVY_CAPABILITIES.has(String(capability || '').trim().toUpperCase());
    const isForcedLocal = process.env.ROUTER_FORCE_LOCAL === 'true' || String(model).startsWith('ollama:');
    const hasGemini = geminiProviderInstance.isConfigured();

    // Multimodal messages (images/documents) MUST route to Gemini Vision
    if (hasMedia && hasGemini) {
      return {
        candidates: [
          { provider: 'gemini', model: 'gemini-2.5-flash', fallback: false }
        ],
        hasMedia,
        heavy,
        strategy: 'cloud_multimodal',
        forcedProvider: 'gemini',
        provider: 'gemini',
        label: 'CLOUD_GEMINI_MULTIMODAL'
      };
    }

    if (!isForcedLocal && hasGemini) {
      return {
        candidates: [
          { provider: 'gemini', model: 'gemini-2.5-flash', fallback: false },
          { provider: 'ollama', model: 'hermes3:8b', fallback: !hasMedia }
        ],
        hasMedia,
        heavy,
        strategy: 'cloud_first',
        forcedProvider: null,
        provider: 'gemini',
        label: 'CLOUD_GEMINI_PRIMARY'
      };
    }

    return {
      candidates: [{ provider: 'ollama', model: 'hermes3:8b', fallback: false }],
      hasMedia,
      heavy,
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

        console.warn(`[ModelRoutingService] Gemini Cloud failed (${err.message}). Engaging Ollama Local failover...`);
        // Fall through to Ollama fallback below
      }
    }

    // 2. FALLBACK / LOCAL ROUTE: OLLAMA
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
    const isCloudFirst = geminiProviderInstance.isConfigured();

    return {
      strategy: isCloudFirst ? 'cloud_first' : 'local_first',
      primaryProvider: isCloudFirst ? 'gemini' : 'ollama',
      cloudLLM: {
        provider: 'gemini',
        configured: geminiProviderInstance.isConfigured(),
        available: geminiAvailable,
        model: geminiProviderInstance.defaultModel
      },
      localLLM: local,
      mode: isCloudFirst ? 'HYBRID_CLOUD_PRIMARY' : 'LOCAL_OLLAMA',
      providerGateway: isCloudFirst ? 'GEMINI' : 'OLLAMA'
    };
  }
}

export const modelRoutingServiceInstance = new ModelRoutingService();
export default modelRoutingServiceInstance;