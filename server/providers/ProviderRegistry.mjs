/**
 * ProviderRegistry.mjs
 * Central Registry of all 9Router Upstream AI Providers with Dynamic Resolution.
 * Integrates Antigravity Multi-Model Pool as Primary Gateway alongside Direct Providers.
 */

import { AntigravityProvider } from './AntigravityProvider.mjs';
import { GeminiProvider } from './GeminiProvider.mjs';
import { OpenAIProvider } from './OpenAIProvider.mjs';
import { ClaudeProvider, DeepSeekProvider } from './ClaudeAndDeepSeekProviders.mjs';

export class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    // 1. Primary: Integrated Antigravity Model Pool
    this.register(new AntigravityProvider());
    // 2. Direct Providers
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
   * Resolve best configured provider and model based on capability and strategy
   */
  resolveProviderForStrategy(strategy, preferredModel) {
    const agProvider = this.get('antigravity');

    // If explicit model matches Antigravity catalog, route to Antigravity Pool
    if (agProvider && agProvider.isConfigured()) {
      if (preferredModel && agProvider.modelCatalog[preferredModel]) {
        return {
          provider: agProvider,
          model: preferredModel,
          gateway: 'ANTIGRAVITY',
          fallbackUsed: false
        };
      }

      // Map strategy to capability
      let capability = 'FAST_CHAT';
      if (strategy === 'DEEP_REASONING' || strategy === 'AGENT_SEMANTIC' || strategy === 'DATA_ANALYTICS') {
        capability = 'DEEP_REASONING';
      } else if (strategy === 'CODE_GENERATION' || strategy === 'APP_SYNTHESIS') {
        capability = 'CODE_GENERATION';
      }

      const best = agProvider.resolveBestModel(capability, preferredModel);
      return {
        provider: agProvider,
        model: best.modelId,
        gateway: 'ANTIGRAVITY',
        fallbackUsed: false
      };
    }

    // Direct Providers Fallback
    if (preferredModel && preferredModel.includes('claude') && this.get('claude')?.isConfigured()) {
      return { provider: this.get('claude'), model: preferredModel, gateway: 'DIRECT_ANTHROPIC', fallbackUsed: false };
    }
    if (preferredModel && preferredModel.includes('deepseek') && this.get('deepseek')?.isConfigured()) {
      return { provider: this.get('deepseek'), model: preferredModel, gateway: 'DIRECT_DEEPSEEK', fallbackUsed: false };
    }
    if (preferredModel && (preferredModel.includes('gpt') || preferredModel.includes('openai')) && this.get('openai')?.isConfigured()) {
      return { provider: this.get('openai'), model: preferredModel, gateway: 'DIRECT_OPENAI', fallbackUsed: false };
    }
    if (this.get('gemini')?.isConfigured()) {
      return { provider: this.get('gemini'), model: 'gemini-2.0-flash', gateway: 'DIRECT_GEMINI', fallbackUsed: false };
    }

    return null; // Local Heuristic Fallback
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
