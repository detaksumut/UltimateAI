/**
 * ProviderRegistry.mjs
 * Central Registry of all Local AI Providers with Dynamic Resolution.
 * Primary Inference Engine: llama.cpp (LlamaCppAdapter on :8080)
 * STRICT POLICY: Zero hidden fallback between runtimes.
 */

import { LlamaCppAdapter } from './LlamaCppAdapter.mjs';
import { geminiProviderInstance } from './GeminiProvider.mjs';

export class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    // Primary local engine: llama.cpp
    this.llamaCppAdapter = new LlamaCppAdapter();
    this.register(this.llamaCppAdapter);

    // Cloud Provider
    this.register(geminiProviderInstance);
  }

  register(provider) {
    this.providers.set(provider.name, provider);
  }

  get(name) {
    return this.providers.get(name);
  }

  /**
   * Resolve best configured provider and model based on capability and strategy.
   * Default local runtime is llama.cpp.
   */
  resolveProviderForStrategy(strategy, preferredModel) {
    const llamaCpp = this.get('llamacpp');

    if (llamaCpp && llamaCpp.isConfigured()) {
      return {
        provider: llamaCpp,
        model: preferredModel || 'qwen2.5-3b-instruct-q4_k_m.gguf',
        gateway: 'LLAMA_CPP',
        fallbackUsed: false
      };
    }

    return null;
  }

  async getHealthStatus() {
    const statuses = {};
    for (const [name, provider] of this.providers.entries()) {
      statuses[name] = await provider.healthCheck();
    }
    return statuses;
  }
}

export const providerRegistryInstance = new ProviderRegistry();
export default providerRegistryInstance;
