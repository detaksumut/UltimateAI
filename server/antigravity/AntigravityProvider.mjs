/**
 * AntigravityProvider.mjs
 * Multi-Connection Provider Adapter for UltimateAI 9Router.
 * Exposes sendChat & generateCompletion with sticky rollover and fail-closed handling.
 */

import { antigravityConnectionSelectorInstance } from './AntigravityConnectionSelector.mjs';
import { antigravityCloudCodeTransportInstance } from './AntigravityCloudCodeTransport.mjs';
import { antigravityQuotaTrackerInstance } from './AntigravityQuotaTracker.mjs';
import { antigravityConnectionStoreInstance } from './AntigravityConnectionStore.mjs';

export class AntigravityProvider {
  constructor(
    selector = antigravityConnectionSelectorInstance,
    transport = antigravityCloudCodeTransportInstance,
    quotaTracker = antigravityQuotaTrackerInstance,
    store = antigravityConnectionStoreInstance
  ) {
    this.name = 'antigravity';
    this.selector = selector;
    this.transport = transport;
    this.quotaTracker = quotaTracker;
    this.store = store;
  }

  isConfigured() {
    const connections = this.store.getAllConnections(false);
    return connections.length > 0 && connections.some(c => c.isActive !== false);
  }

  /**
   * Main sendChat interface with automatic sticky rollover retry
   */
  async sendChat({ messages, stream = false, model = 'auto', capability = 'FAST_CHAT', temperature = 0.7 }, onChunk = null) {
    let attempts = 0;
    const maxAttempts = 3;
    let lastError = null;

    while (attempts < maxAttempts) {
      attempts++;
      const selection = this.selector.selectConnection(capability, model === 'auto' ? null : model);

      try {
        const transportResult = await this.transport.executeChat({
          connection: selection.connection,
          modelId: selection.modelId,
          messages,
          stream,
          temperature
        }, onChunk);

        return {
          content: typeof transportResult === 'object' ? transportResult.content : transportResult,
          upstreamResponseId: transportResult?.upstreamResponseId || null,
          localResponseId: transportResult?.requestId || `resp-${Date.now()}`,
          responseId: transportResult?.upstreamResponseId || null,
          connectionId: selection.connectionId,
          actualConnectionId: transportResult?.actualConnectionId || selection.connectionId,
          accountAlias: selection.accountAlias,
          model: selection.modelId,
          actualModel: transportResult?.actualModel || selection.modelId,
          upstreamEndpoint: transportResult?.upstreamEndpoint || 'https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse',
          transportClass: transportResult?.transportClass || 'ANTIGRAVITY_CLOUD_CODE',
          rollover: selection.rollover,
          transport: 'ANTIGRAVITY'
        };
      } catch (err) {
        lastError = err;
        const failureReason = err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED') ? 'RATE_LIMIT' : 'TIMEOUT';
        this.selector.reportFailure(selection.connectionId, selection.modelId, failureReason);
      }
    }

    throw lastError || new Error('NO_ELIGIBLE_CONNECTION: All retry attempts exhausted across connections.');
  }

  async healthCheck() {
    const connections = this.store.getAllConnections(true);
    const activeCount = connections.filter(c => c.isActive !== false).length;

    return {
      status: activeCount > 0 ? 'AUTHENTICATED_LIVE' : 'NOT_CONFIGURED',
      configured: activeCount > 0,
      authenticated: activeCount > 0,
      reachable: activeCount > 0,
      streamMode: 'UPSTREAM_NATIVE',
      providerGateway: 'ANTIGRAVITY',
      activeConnectionsCount: activeCount,
      totalConnections: connections.length
    };
  }
}

export const antigravityProviderInstance = new AntigravityProvider();
export default antigravityProviderInstance;
