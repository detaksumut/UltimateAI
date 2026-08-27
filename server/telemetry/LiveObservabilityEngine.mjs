/**
 * LiveObservabilityEngine.mjs
 * PHASE 4.4 - Real-Time Observability & Forensic Telemetry Event Bus.
 * Zero Hardcoding | 100% Granular Event-Driven Streaming.
 */

export class LiveObservabilityEngine {
  constructor() {
    this.subscribers = new Set();
    this.currentMetrics = {
      activeSessionId: 100,
      activeProvider: 'STANDALONE_LOCAL',
      streamMode: 'LOCAL_SYNTHETIC',
      webToolStatus: 'LIVE',
      sttState: 'STANDBY',
      ttsState: 'IDLE',
      lastLatencyMs: 0,
      totalTokensStreamed: 0,
      abortEventsCount: 0,
      lastEventTimestamp: new Date().toISOString()
    };
    this.forensicAuditLog = [];
  }

  recordEvent(eventType, payload = {}) {
    const timestamp = new Date().toISOString();
    const event = {
      id: `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp,
      type: eventType,
      payload
    };

    // Update state based on live events
    if (payload.sessionId) this.currentMetrics.activeSessionId = payload.sessionId;
    if (payload.provider) this.currentMetrics.activeProvider = payload.provider;
    if (payload.streamMode) this.currentMetrics.streamMode = payload.streamMode;
    if (payload.latencyMs !== undefined) this.currentMetrics.lastLatencyMs = payload.latencyMs;
    if (payload.sttState) this.currentMetrics.sttState = payload.sttState;
    if (payload.ttsState) this.currentMetrics.ttsState = payload.ttsState;

    if (eventType === 'ABORT_SIGNAL_DISPATCHED' || eventType === 'BARGE_IN_TRIGGERED') {
      this.currentMetrics.abortEventsCount++;
    }
    if (eventType === 'TOKEN_CHUNK_STREAMED') {
      this.currentMetrics.totalTokensStreamed += (payload.tokenLength || 1);
    }

    this.currentMetrics.lastEventTimestamp = timestamp;
    this.forensicAuditLog.push(event);
    if (this.forensicAuditLog.length > 500) this.forensicAuditLog.shift(); // Bound memory

    // Notify live subscribers
    for (const sub of this.subscribers) {
      try {
        sub(this.currentMetrics, event);
      } catch {}
    }

    return event;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.currentMetrics, null);
    return () => this.subscribers.delete(callback);
  }

  getSnapshot() {
    return {
      metrics: { ...this.currentMetrics },
      recentEvents: [...this.forensicAuditLog.slice(-20)]
    };
  }
}

export const liveObservabilityEngineInstance = new LiveObservabilityEngine();
export default liveObservabilityEngineInstance;
