/**
 * AntigravityProvider.mjs (Backward-Compatibility Thin Adapter)
 * 
 * ARCHITECTURE CONSOLIDATION:
 * Delegates all operations directly to the authoritative Antigravity Provider located in:
 *   server/antigravity/AntigravityProvider.mjs
 * 
 * This ensures that ProviderRegistry and legacy 9Router components share the exact same
 * single source of truth for connection selection, quota tracking, and Cloud Code transport.
 */

import { antigravityProviderInstance as coreAntigravityProvider } from '../antigravity/AntigravityProvider.mjs';
import { antigravityModelRegistryInstance } from '../antigravity/AntigravityModelRegistry.mjs';

export class AntigravityProvider {
  constructor(coreProvider = coreAntigravityProvider, modelRegistry = antigravityModelRegistryInstance) {
    this.name = 'antigravity';
    this.coreProvider = coreProvider;
    this.modelRegistry = modelRegistry;
  }

  isConfigured() {
    return this.coreProvider.isConfigured();
  }

  get modelCatalog() {
    return this.modelRegistry.models;
  }

  resolveBestModel(capability = 'FAST_CHAT', preferredModel = null) {
    const targetModel = preferredModel || this.modelRegistry.resolveModelForCapability(capability);
    return {
      modelId: targetModel,
      capability
    };
  }

  async sendChat(options, onChunk = null) {
    const result = await this.coreProvider.sendChat(options, onChunk);
    return typeof result === 'object' && result.content !== undefined ? result.content : result;
  }

  async generateCompletion(payload, modelOverride = null) {
    const result = await this.coreProvider.sendChat({
      messages: payload.messages || [],
      stream: payload.stream || false,
      model: modelOverride || payload.model || 'auto',
      capability: payload.capability || 'FAST_CHAT',
      temperature: payload.temperature || 0.7
    });

    return {
      content: result.content,
      model: result.model,
      actualModel: result.actualModel,
      connectionId: result.connectionId,
      actualConnectionId: result.actualConnectionId,
      accountAlias: result.accountAlias,
      providerGateway: 'ANTIGRAVITY',
      transport: result.transport,
      transportClass: result.transportClass,
      responseId: result.responseId,
      fallbackUsed: false,
      rollover: result.rollover
    };
  }

  async healthCheck() {
    const coreHealth = await this.coreProvider.healthCheck();
    return {
      configured: coreHealth.configured,
      authenticated: coreHealth.authenticated,
      reachable: coreHealth.reachable,
      status: coreHealth.status,
      providerGateway: 'ANTIGRAVITY',
      activeConnectionsCount: coreHealth.activeConnections,
      activeModelsCount: Object.keys(this.modelCatalog).length,
      availableModels: Object.keys(this.modelCatalog)
    };
  }
}

export const antigravityProviderInstance = new AntigravityProvider();
export default antigravityProviderInstance;
