/**
 * RouterConfig.js
 * Runtime configuration for UltimateAI Local Router (:20200).
 * Connects frontend UI directly to the Local Router backend.
 */

export const RouterConfig = {
  // Authoritative local endpoint for Local Router (:20200)
  DEFAULT_LOCAL_ENDPOINT: 'http://127.0.0.1:20200',

  // Canonical Local Router health path (single source of truth).
  // GET {DEFAULT_LOCAL_ENDPOINT}{LOCAL_ROUTER_HEALTH_PATH} == GET /health
  LOCAL_ROUTER_HEALTH_PATH: '/health',

  getEndpoint() {
    if (typeof window !== 'undefined' && window.__ULTIMATE_ROUTER_ENDPOINT__) {
      return window.__ULTIMATE_ROUTER_ENDPOINT__;
    }
    return 'http://127.0.0.1:20200';
  },

  getHealthUrl() {
    return `${this.getEndpoint()}${this.LOCAL_ROUTER_HEALTH_PATH}`;
  },

  // Model routing preferences
  DEFAULT_MODEL: 'hermes3:8b',
  FALLBACK_MODEL: 'qwen3:8b',
  REQUEST_TIMEOUT_MS: 60000,
};

export default RouterConfig;
