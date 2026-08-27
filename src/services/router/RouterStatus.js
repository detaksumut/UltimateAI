/**
 * RouterStatus.js
 * Telemetry and health tracker for UltimateAI 9Router connection.
 */

export class RouterStatus {
  constructor() {
    this.isConnected = false;
    this.activeRoutes = ['Intent', 'Context', 'Multi-Source Reasoning', 'Code Generation', 'Data Analytics', 'Model Selection', 'Security Guard', 'Knowledge Graph', 'Response Synthesizer'];
    this.activeCount = 9;
    this.latencyMs = 0;
    this.lastChecked = null;
    this.listeners = new Set();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.getStatus());
    return () => this.listeners.delete(callback);
  }

  notify() {
    const status = this.getStatus();
    this.listeners.forEach(cb => cb(status));
  }

  updateHealth(isConnected, latencyMs = 0) {
    this.isConnected = isConnected;
    this.latencyMs = latencyMs;
    this.lastChecked = new Date();
    this.notify();
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      activeRoutes: this.activeRoutes,
      activeCount: this.activeCount,
      latencyMs: this.latencyMs,
      lastChecked: this.lastChecked,
      label: this.isConnected ? '9ROUTER ACTIVE' : '9ROUTER STANDBY'
    };
  }
}

export const routerStatusInstance = new RouterStatus();
export default routerStatusInstance;
