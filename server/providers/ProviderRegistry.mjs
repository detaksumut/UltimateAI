/**
 * ProviderRegistry.mjs
 * Central Registry of all Local AI Providers with Dynamic Resolution.
 * Primary Gateway: Local Ollama Provider (:11434)
 */

import { OllamaProvider } from './OllamaProvider.mjs';
import { geminiProviderInstance } from './GeminiProvider.mjs';

export class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    // Primary: Gemini Cloud & Local Ollama
    this.register(geminiProviderInstance);
    this.register(new OllamaProvider());
  }

  register(provider) {
    this.providers.set(provider.name, provider);
  }

  get(name) {
    return this.providers.get(name);
  }

  /**
   * Resolve best configured provider and model based on capability and strategy
   */
  resolveProviderForStrategy(strategy, preferredModel) {
    const ollamaProvider = this.get('ollama');

    if (ollamaProvider && ollamaProvider.isConfigured()) {
      return {
        provider: ollamaProvider,
        model: preferredModel || 'qwen3:8b',
        gateway: 'OLLAMA',
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
