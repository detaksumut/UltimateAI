/**
 * RouterConfig.js
 * Runtime configuration for UltimateAI 9Router.
 * Zero-secret exposure: Reads endpoints from environment / runtime proxy.
 */

export const RouterConfig = {
  // Default local endpoint for 9Router Proxy (standard OpenAI-compatible /v1 endpoint)
  DEFAULT_LOCAL_ENDPOINT: 'http://localhost:20128/v1',
  
  // Production / Proxy fallback endpoint (configured in Vite environment without leaking secrets)
  getEndpoint() {
    if (typeof window !== 'undefined') {
      if (window.__ULTIMATE_ROUTER_ENDPOINT__) {
        return window.__ULTIMATE_ROUTER_ENDPOINT__;
      }
      return `${window.location.origin}/api/ultimateai`;
    }
    return 'http://localhost:5177/api/ultimateai';
  },

  // Model routing preferences
  DEFAULT_MODEL: 'ultimateai-9router-orchestrator',
  FALLBACK_MODEL: 'gemini-2.0-flash',
  REQUEST_TIMEOUT_MS: 30000,
};

export default RouterConfig;
