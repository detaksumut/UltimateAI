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
    if (typeof window !== 'undefined') {
      if (window.__ULTIMATE_ROUTER_ENDPOINT__) {
        return window.__ULTIMATE_ROUTER_ENDPOINT__;
      }
      try {
        const custom = localStorage.getItem('jin_custom_endpoint');
        if (custom) return custom;
      } catch (_) {}

      const host = window.location.hostname;
      // When opened on HP / smartphone via LAN IP (e.g. 192.168.1.3:5177 or 100.x.x.x)
      if (host && host !== 'localhost' && host !== '127.0.0.1' && !host.includes('vercel.app')) {
        return window.location.origin;
      }
    }
    return 'http://127.0.0.1:20200';
  },

  getHealthUrl() {
    return `${this.getEndpoint()}${this.LOCAL_ROUTER_HEALTH_PATH}`;
  },

  // Resolve backend API path to absolute LocalRouter URL.
  // Alasan: di deploy publik (Vercel) fetch('/api/...') nyasar ke origin
  // statis -> 405/HTML. Semua API JINI hidup di LocalRouter :20200
  // (mesin user sendiri), jadi harus absolut ke sana.
  api(path = '') {
    const base = String(this.getEndpoint() || 'http://127.0.0.1:20200').replace(/\/+$/, '');
    const p = String(path || '');
    return `${base}${p.startsWith('/') ? p : `/${p}`}`;
  },

  // Model routing preferences
  DEFAULT_MODEL: 'qwen3:8b',
  FALLBACK_MODEL: null,
  REQUEST_TIMEOUT_MS: 60000,
};

export default RouterConfig;
