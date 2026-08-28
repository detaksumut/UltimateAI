/**
 * RouterConfig.js
 * Runtime configuration for UltimateAI Local Router (:20200).
 * Connects frontend UI directly to the Local Router backend.
 */

export const RouterConfig = {
  // Authoritative local endpoint for Local Router (:20200)
  DEFAULT_LOCAL_ENDPOINT: 'http://127.0.0.1:20200',
  
  getEndpoint() {
    if (typeof window !== 'undefined' && window.__ULTIMATE_ROUTER_ENDPOINT__) {
      return window.__ULTIMATE_ROUTER_ENDPOINT__;
    }
    return 'http://127.0.0.1:20200';
  },

  // Model routing preferences
  DEFAULT_MODEL: 'gemini-3.6-flash-high',
  FALLBACK_MODEL: 'gemini-3.6-flash-med',
  REQUEST_TIMEOUT_MS: 30000,
};

export default RouterConfig;
