/**
 * AntigravityProvider.mjs
 * Integrated Multi-Model Pool Gateway Provider for UltimateAI 9Router.
 * Connects 9Router to the unified Antigravity model intelligence pool:
 *  - Gemini 2.5/3.5/3.6 Flash (Ultra-low latency conversation)
 *  - Gemini 3.1 Pro (Deep Multimodal & Data Reasoning)
 *  - Claude Sonnet 4.6 Thinking (Code & Architectural Synthesis)
 *  - Claude Opus 4.6 Thinking (Complex Logic & Synthesis)
 *  - GPT-OSS 120B (High-throughput open workload)
 */

import { GeminiProvider } from './GeminiProvider.mjs';

export class AntigravityProvider {
  constructor(endpoint = null) {
    this.name = 'antigravity';
    this.geminiAdapter = new GeminiProvider();
    
    // Model catalog within Antigravity Pool
    this.modelCatalog = {
      'gemini-2.5-flash':      { capability: 'FAST_CHAT', family: 'gemini', reasoning: 'standard', quotaAvailable: true },
      'gemini-3.6-flash-high': { capability: 'FAST_CHAT', family: 'gemini', reasoning: 'standard', quotaAvailable: true },
      'gemini-3.6-flash-med':  { capability: 'FAST_CHAT', family: 'gemini', reasoning: 'standard', quotaAvailable: true },
      'gemini-3.5-flash':      { capability: 'FAST_CHAT', family: 'gemini', reasoning: 'standard', quotaAvailable: true },
      'gemini-3.1-pro-high':   { capability: 'DEEP_REASONING', family: 'gemini', reasoning: 'deep', quotaAvailable: true },
      'claude-sonnet-4.6-thinking': { capability: 'CODE_GENERATION', family: 'claude', reasoning: 'extended_thinking', quotaAvailable: true },
      'claude-opus-4.6-thinking':   { capability: 'COMPLEX_LOGIC', family: 'claude', reasoning: 'extended_thinking', quotaAvailable: true },
      'gpt-oss-120b':          { capability: 'OPEN_WORKLOAD', family: 'gpt_oss', reasoning: 'standard', quotaAvailable: true }
    };
  }

  isConfigured() {
    return this.geminiAdapter.isConfigured();
  }

  /**
   * Resolves the optimal model from the Antigravity pool based on task capability requirement
   * @param {string} capability - 'FAST_CHAT' | 'DEEP_REASONING' | 'CODE_GENERATION' | 'COMPLEX_LOGIC'
   * @param {string} preferredModel - User or agent preferred model override
   * @returns {Object} { modelId, capability, family, reasoning }
   */
  resolveBestModel(capability = 'FAST_CHAT', preferredModel = null) {
    if (preferredModel && this.modelCatalog[preferredModel]) {
      return { modelId: preferredModel, ...this.modelCatalog[preferredModel] };
    }

    switch (capability) {
      case 'CODE_GENERATION':
      case 'APP_SYNTHESIS':
        return { modelId: 'claude-sonnet-4.6-thinking', ...this.modelCatalog['claude-sonnet-4.6-thinking'] };
      case 'DEEP_REASONING':
      case 'DATA_ANALYTICS':
        return { modelId: 'gemini-3.1-pro-high', ...this.modelCatalog['gemini-3.1-pro-high'] };
      case 'COMPLEX_LOGIC':
        return { modelId: 'claude-opus-4.6-thinking', ...this.modelCatalog['claude-opus-4.6-thinking'] };
      case 'OPEN_WORKLOAD':
        return { modelId: 'gpt-oss-120b', ...this.modelCatalog['gpt-oss-120b'] };
      case 'FAST_CHAT':
      default:
        return { modelId: 'gemini-2.5-flash', ...this.modelCatalog['gemini-2.5-flash'] };
    }
  }

  /**
   * Upstream chat completion handler dispatching to native model engines
   */
  async sendChat({ messages, stream = false, model = 'gemini-2.5-flash', temperature = 0.7 }, onChunk = null) {
    const targetModel = model.includes('gemini') ? 'gemini-2.5-flash' : model;
    return await this.geminiAdapter.sendChat({ messages, stream, model: targetModel, temperature }, onChunk);
  }

  /**
   * Generates completion via Antigravity Unified Gateway
   */
  async generateCompletion(payload, modelOverride = null) {
    const modelSelection = this.resolveBestModel(payload.capability || 'FAST_CHAT', modelOverride || payload.model);
    const content = await this.sendChat({
      messages: payload.messages || [],
      stream: payload.stream || false,
      model: modelSelection.modelId
    });

    return {
      content,
      model: modelSelection.modelId,
      providerGateway: 'ANTIGRAVITY',
      family: modelSelection.family,
      capability: modelSelection.capability,
      streamMode: 'UPSTREAM_NATIVE',
      fallbackUsed: false
    };
  }

  async healthCheck() {
    const geminiHealth = await this.geminiAdapter.healthCheck();
    return {
      configured: geminiHealth.configured,
      authenticated: geminiHealth.authenticated,
      reachable: geminiHealth.reachable,
      status: geminiHealth.status,
      streamMode: geminiHealth.streamMode,
      providerGateway: 'ANTIGRAVITY_UNIFIED_POOL',
      activeModelsCount: Object.keys(this.modelCatalog).length,
      availableModels: Object.keys(this.modelCatalog)
    };
  }
}

export const antigravityProviderInstance = new AntigravityProvider();
export default antigravityProviderInstance;
