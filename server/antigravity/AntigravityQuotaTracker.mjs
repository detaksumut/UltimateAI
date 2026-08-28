/**
 * AntigravityQuotaTracker.mjs
 * Single Source of Truth (SSOT) for Quota State & Per-Model Locking.
 * Differentiates UPSTREAM_OBSERVED (authoritative upstream feedback) vs LOCAL_ACCOUNTING (local estimates).
 */

export class AntigravityQuotaTracker {
  constructor() {
    this.quotaStore = new Map();
    this.modelLocks = new Map(); // Key: `${connectionId}:${modelId}` -> { locked: boolean, reason: string, unlockAt: string }
  }

  /**
   * Initializes or gets the quota state for a connection
   */
  _ensureConnectionState(connectionId) {
    if (!this.quotaStore.has(connectionId)) {
      this.quotaStore.set(connectionId, {
        connectionId,
        source: 'LOCAL_ACCOUNTING',
        lastUpdated: new Date().toISOString(),
        models: {}
      });
    }
    return this.quotaStore.get(connectionId);
  }

  /**
   * Records observed upstream quota state from HTTP headers / telemetry
   */
  recordUpstreamObserved(connectionId, modelId, { remaining, limit = 1000, resetAt = null }) {
    const connState = this._ensureConnectionState(connectionId);
    connState.source = 'UPSTREAM_OBSERVED';
    connState.lastUpdated = new Date().toISOString();

    connState.models[modelId] = {
      source: 'UPSTREAM_OBSERVED',
      limit,
      remaining,
      used: limit - remaining,
      resetAt: resetAt || new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    };
  }

  /**
   * Increments local usage accounting counter
   */
  recordLocalUsage(connectionId, modelId) {
    const connState = this._ensureConnectionState(connectionId);
    const existing = connState.models[modelId] || {
      source: 'LOCAL_ACCOUNTING',
      limit: 1000,
      used: 0,
      remaining: 1000
    };

    existing.used += 1;
    existing.remaining = Math.max(0, existing.limit - existing.used);
    existing.remainingEstimate = existing.remaining;
    connState.models[modelId] = existing;
    connState.lastUpdated = new Date().toISOString();
  }

  /**
   * Locks a specific model on a specific connection (e.g. rate limit, quota exhaustion)
   */
  lockModel(connectionId, modelId, reason = 'QUOTA_EXHAUSTED', durationMs = 15 * 60 * 1000) {
    const lockKey = `${connectionId}:${modelId}`;
    const unlockAt = new Date(Date.now() + durationMs).toISOString();

    this.modelLocks.set(lockKey, {
      locked: true,
      reason,
      unlockAt
    });
  }

  /**
   * Unlocks a specific model on a connection
   */
  unlockModel(connectionId, modelId) {
    const lockKey = `${connectionId}:${modelId}`;
    this.modelLocks.delete(lockKey);
  }

  /**
   * Checks if a specific model is locked on a connection
   */
  isModelLocked(connectionId, modelId) {
    const lockKey = `${connectionId}:${modelId}`;
    const lock = this.modelLocks.get(lockKey);
    if (!lock) return false;

    // Check if lock duration has expired
    if (new Date(lock.unlockAt).getTime() <= Date.now()) {
      this.modelLocks.delete(lockKey);
      return false;
    }

    return true;
  }

  /**
   * Returns complete SSOT Quota Snapshot
   */
  getQuotaSnapshot() {
    const snapshot = {};
    for (const [id, conn] of this.quotaStore.entries()) {
      snapshot[id] = {
        connectionId: id,
        source: conn.source,
        lastUpdated: conn.lastUpdated,
        models: { ...conn.models }
      };

      // Annotate locked models
      for (const modelId of Object.keys(snapshot[id].models)) {
        snapshot[id].models[modelId].isLocked = this.isModelLocked(id, modelId);
      }
    }
    return snapshot;
  }

  getQuotaSummary() {
    return this.getQuotaSnapshot();
  }
}

export const antigravityQuotaTrackerInstance = new AntigravityQuotaTracker();
export default antigravityQuotaTrackerInstance;
