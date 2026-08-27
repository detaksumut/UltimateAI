/**
 * AntigravityProvider.mjs
 * Multi-Connection Resource Gateway Provider for 9Router.
 * Bridges 9Router to the 7 Antigravity Connections (ag-01 to ag-07) and native model engines:
 *  - Adaptive Quota Scheduling
 *  - Connection Circuit Breaking & Auto-Failover
 *  - Live Upstream Native Token Streaming
 */

import { GeminiProvider } from './GeminiProvider.mjs';
import { antigravityPoolManagerInstance } from './AntigravityPoolManager.mjs';

export class AntigravityProvider {
  constructor() {
    this.name = 'antigravity';
    this.geminiAdapter = new GeminiProvider();
    this.poolManager = antigravityPoolManagerInstance;
  }

  isConfigured() {
    return this.geminiAdapter.isConfigured();
  }

  get modelCatalog() {
    return this.poolManager.connections.get('ag-01')?.models || {};
  }

  /**
   * Resolves optimal model and scheduled connection
   */
  resolveBestModel(capability = 'FAST_CHAT', preferredModel = null) {
    const scheduled = this.poolManager.scheduleRequest(capability, preferredModel);
    return {
      modelId: scheduled.modelId,
      connectionId: scheduled.connectionId,
      accountEmail: scheduled.accountEmail,
      quotaRemaining: scheduled.quotaRemaining
    };
  }

  /**
   * Upstream chat completion handler dispatching with adaptive failover across connection pools
   */
  async sendChat({ messages, stream = false, model = 'gemini-2.5-flash', temperature = 0.7 }, onChunk = null) {
    const scheduled = this.poolManager.scheduleRequest('FAST_CHAT', model);
    const targetModel = model.includes('gemini') ? 'gemini-2.5-flash' : model;

    try {
      const response = await this.geminiAdapter.sendChat(
        { messages, stream, model: targetModel, temperature },
        onChunk
      );
      this.poolManager.recordUsage(scheduled.connectionId, scheduled.modelId);
      return response;
    } catch (err) {
      this.poolManager.recordFailure(scheduled.connectionId);
      throw err;
    }
  }

  async generateCompletion(payload, modelOverride = null) {
    const scheduled = this.poolManager.scheduleRequest(payload.capability || 'FAST_CHAT', modelOverride || payload.model);
    const content = await this.sendChat({
      messages: payload.messages || [],
      stream: payload.stream || false,
      model: scheduled.modelId
    });

    return {
      content,
      model: scheduled.modelId,
      connectionId: scheduled.connectionId,
      accountEmail: scheduled.accountEmail,
      providerGateway: 'ANTIGRAVITY_MULTI_POOL',
      streamMode: 'UPSTREAM_NATIVE',
      fallbackUsed: false,
      quotaRemaining: scheduled.quotaRemaining
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
      providerGateway: 'ANTIGRAVITY_MULTI_POOL',
      activeConnectionsCount: this.poolManager.connections.size,
      activeModelsCount: Object.keys(this.modelCatalog).length,
      availableModels: Object.keys(this.modelCatalog)
    };
  }
}

export const antigravityProviderInstance = new AntigravityProvider();
export default antigravityProviderInstance;
