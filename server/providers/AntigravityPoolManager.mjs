/**
 * AntigravityPoolManager.mjs (DEPRECATED / READ-ONLY ADAPTER)
 * 
 * ARCHITECTURE CONSOLIDATION NOTICE:
 * This legacy pool manager has been decommissioned.
 * The Single Source of Truth (SSOT) for all Antigravity connections, model catalog,
 * token lifecycle, quota state, and deterministic routing is located in:
 *   server/antigravity/ (AntigravityConnectionStore, AntigravityQuotaTracker, AntigravityConnectionSelector)
 * 
 * This file serves purely as a read-only compatibility adapter for legacy consumers.
 */

import { antigravityConnectionStoreInstance } from '../antigravity/AntigravityConnectionStore.mjs';
import { antigravityQuotaTrackerInstance } from '../antigravity/AntigravityQuotaTracker.mjs';
import { antigravityConnectionSelectorInstance } from '../antigravity/AntigravityConnectionSelector.mjs';
import { antigravityModelRegistryInstance } from '../antigravity/AntigravityModelRegistry.mjs';

export const OLD_POOL_MANAGER_ACTIVE = false;

export class AntigravityPoolManager {
  constructor(
    store = antigravityConnectionStoreInstance,
    quotaTracker = antigravityQuotaTrackerInstance,
    selector = antigravityConnectionSelectorInstance,
    modelRegistry = antigravityModelRegistryInstance
  ) {
    this.store = store;
    this.quotaTracker = quotaTracker;
    this.selector = selector;
    this.modelRegistry = modelRegistry;
    this.isOldPoolManagerActive = OLD_POOL_MANAGER_ACTIVE;
  }

  get connections() {
    const conns = this.store.getAllConnections(false);
    const map = new Map();
    for (const c of conns) {
      map.set(c.id, c);
    }
    return map;
  }

  getQuotaSnapshot() {
    return this.quotaTracker.getQuotaSummary();
  }

  scheduleRequest(capability = 'FAST_CHAT', preferredModel = null) {
    const selection = this.selector.selectConnection(capability, preferredModel);
    return {
      connectionId: selection.connectionId,
      modelId: selection.modelId,
      accountAlias: selection.accountAlias,
      quotaRemaining: 1000
    };
  }

  recordUsage(connectionId, modelId) {
    this.quotaTracker.recordLocalUsage(connectionId, modelId);
  }

  recordFailure(connectionId, modelId = 'gemini-3.6-flash-high', reason = 'TIMEOUT') {
    this.selector.reportFailure(connectionId, modelId, reason);
  }
}

export const antigravityPoolManagerInstance = new AntigravityPoolManager();
export default antigravityPoolManagerInstance;
