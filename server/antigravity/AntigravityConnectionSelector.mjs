/**
 * AntigravityConnectionSelector.mjs
 * Deterministic Sticky Sequential Rollover for Antigravity Connections.
 * Order: AG-01 -> AG-02 -> AG-03 -> AG-04 -> AG-05 -> AG-06 -> AG-07 -> AG-01.
 * Maintains sticky connection per session while healthy; triggers rollover on machine-derived failure reasons.
 */

import { antigravityConnectionStoreInstance } from './AntigravityConnectionStore.mjs';
import { antigravityQuotaTrackerInstance } from './AntigravityQuotaTracker.mjs';
import { AntigravityModelRegistry } from './AntigravityModelRegistry.mjs';

export class AntigravityConnectionSelector {
  constructor(store = antigravityConnectionStoreInstance, quotaTracker = antigravityQuotaTrackerInstance) {
    this.store = store;
    this.quotaTracker = quotaTracker;
    this.currentStickyConnectionId = 'ag-01';
  }

  /**
   * Evaluates eligibility of a single connection for a requested model
   */
  isConnectionEligible(connection, modelId) {
    if (!connection || connection.isActive === false) {
      return { eligible: false, reason: 'CONNECTION_INACTIVE' };
    }

    // 1. Cooldown Check
    if (connection.cooldownUntil && new Date(connection.cooldownUntil).getTime() > Date.now()) {
      return { eligible: false, reason: 'IN_COOLDOWN' };
    }

    // 2. Auth State Check
    if (connection.testStatus === 'AUTH_REFRESH_FAILED') {
      return { eligible: false, reason: 'AUTH_FAILED' };
    }

    // 3. Per-Model Lock Check
    if (this.quotaTracker.isModelLocked(connection.id, modelId)) {
      return { eligible: false, reason: 'MODEL_LOCKED' };
    }

    return { eligible: true };
  }

  /**
   * Deterministic Sticky Sequential Rollover:
   * Selects current sticky connection if eligible; otherwise steps forward to the next eligible connection.
   */
  selectConnection(capability = 'FAST_CHAT', preferredModel = null) {
    const connections = this.store.getAllConnections(false);
    if (!connections || connections.length === 0) {
      throw new Error('NO_ELIGIBLE_CONNECTION: No Antigravity connections configured.');
    }

    // Sort connections deterministically by priority / ID (ag-01 to ag-07)
    connections.sort((a, b) => (a.priority || 1) - (b.priority || 1) || a.id.localeCompare(b.id));

    // Resolve Target Model
    const modelMeta = AntigravityModelRegistry.resolveModelByCapability(capability, preferredModel);
    const targetModelId = modelMeta.id;

    // 1. Check if current sticky connection is eligible
    const currentSticky = connections.find(c => c.id === this.currentStickyConnectionId);
    if (currentSticky) {
      const eligibility = this.isConnectionEligible(currentSticky, targetModelId);
      if (eligibility.eligible) {
        return {
          connection: currentSticky,
          connectionId: currentSticky.id,
          accountAlias: currentSticky.accountAlias || `antigravity-${currentSticky.id.replace('ag-', '')}`,
          modelId: targetModelId,
          rollover: { occurred: false, previousConnectionId: null, reason: null }
        };
      }
    }

    // 2. Sequential Rollover: Start looking from the connection right after currentSticky
    const startIndex = currentSticky ? connections.findIndex(c => c.id === this.currentStickyConnectionId) : 0;
    const total = connections.length;
    let selectedConnection = null;
    let rolloverReason = currentSticky ? 'STICKY_CONNECTION_INELIGIBLE' : 'INITIAL_SELECTION';

    for (let offset = 1; offset <= total; offset++) {
      const idx = (startIndex + offset) % total;
      const candidate = connections[idx];
      const eligibility = this.isConnectionEligible(candidate, targetModelId);

      if (eligibility.eligible) {
        selectedConnection = candidate;
        break;
      }
    }

    if (!selectedConnection) {
      throw new Error(`NO_ELIGIBLE_CONNECTION: All ${connections.length} Antigravity connections exhausted or locked for model ${targetModelId}.`);
    }

    const previousId = this.currentStickyConnectionId;
    this.currentStickyConnectionId = selectedConnection.id;

    return {
      connection: selectedConnection,
      connectionId: selectedConnection.id,
      accountAlias: selectedConnection.accountAlias || `antigravity-${selectedConnection.id.replace('ag-', '')}`,
      modelId: targetModelId,
      rollover: {
        occurred: previousId !== selectedConnection.id,
        previousConnectionId: previousId,
        reason: rolloverReason
      }
    };
  }

  /**
   * Reports a machine-derived failure for the connection and locks the model / triggers cooldown
   */
  reportFailure(connectionId, modelId, failureReason) {
    if (failureReason === 'RATE_LIMIT' || failureReason === 'QUOTA_EXHAUSTED') {
      this.quotaTracker.lockModel(connectionId, modelId, failureReason, 10 * 60 * 1000);
    } else if (failureReason === 'TIMEOUT' || failureReason === 'SERVER_ERROR') {
      this.store.updateStatus(connectionId, {
        testStatus: 'DEGRADED',
        cooldownUntil: new Date(Date.now() + 2 * 60 * 1000).toISOString()
      });
    }
  }
}

export const antigravityConnectionSelectorInstance = new AntigravityConnectionSelector();
export default antigravityConnectionSelectorInstance;
