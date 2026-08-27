/**
 * ProviderRegistry.mjs
 * Central Registry of all 9Router Upstream AI Providers with Dynamic Resolution.
 */

import { GeminiProvider } from './GeminiProvider.mjs';
import { OpenAIProvider } from './OpenAIProvider.mjs';
import { ClaudeProvider, DeepSeekProvider } from './ClaudeAndDeepSeekProviders.mjs';

export class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.register(new GeminiProvider());
    this.register(new OpenAIProvider());
    this.register(new ClaudeProvider());
    this.register(new DeepSeekProvider());
  }

  register(provider) {
    this.providers.set(provider.name, provider);
  }

  get(name) {
    return this.providers.get(name);
  }

  /**
   * Resolve best configured provider for the selected strategy
   */
  resolveProviderForStrategy(strategy, preferredModel) {
    if (preferredModel && preferredModel.includes('claude') && this.get('claude')?.isConfigured()) {
      return { provider: this.get('claude'), model: preferredModel };
    }
    if (preferredModel && preferredModel.includes('deepseek') && this.get('deepseek')?.isConfigured()) {
      return { provider: this.get('deepseek'), model: preferredModel };
    }
    if (preferredModel && (preferredModel.includes('gpt') || preferredModel.includes('openai')) && this.get('openai')?.isConfigured()) {
      return { provider: this.get('openai'), model: preferredModel };
    }

    // Default to Gemini if configured
    if (this.get('gemini')?.isConfigured()) {
      return { provider: this.get('gemini'), model: 'gemini-2.0-flash' };
    }
    // Fallback to OpenAI if configured
    if (this.get('openai')?.isConfigured()) {
      return { provider: this.get('openai'), model: 'gpt-4o-mini' };
    }

    return null; // None configured -> triggers transparent Local Heuristic Mode
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
