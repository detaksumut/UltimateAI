/**
 * MarketPriceService.js
 * Frontend client for the HARGA PASAR STUDIO market data.
 *
 * Fetch strategy:
 *   - Primary: same-origin `/api/market/overview` (served by the Vite gateway).
 *   - Fallback: LocalRouter :20200.
 *
 * Integrity: on failure we return an empty, honest workspace (no panels, no
 * fabricated prices). We NEVER substitute hard-coded mock quotes.
 */

function candidateBases() {
  const bases = [];
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    bases.push(window.location.origin);
  }
  bases.push('http://127.0.0.1:20200');
  return unique(bases);
}

function unique(arr) {
  return Array.from(new Set(arr));
}

async function fetchFrom(base) {
  const response = await fetch(`${base}/api/market/overview`, {
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  if (!json || json.error) throw new Error(json?.error?.message || 'market endpoint error');
  return json;
}

function emptyWorkspace(errorMessage) {
  return {
    mode: 'MARKET_ROW_WALL',
    service: 'MARKET_PRICE_STUDIO',
    updatedAt: Date.now(),
    fetchedAt: Date.now(),
    fxAnchor: null,
    counts: { ready: 0, verified: 0, stale: 0, failed: 0, unavailable: 0, total: 0 },
    panels: [],
    error: errorMessage || 'unreachable'
  };
}

export async function getMarketOverview() {
  const bases = candidateBases();
  let lastError = null;
  for (const base of bases) {
    try {
      const data = await fetchFrom(base);
      if (data && Array.isArray(data.panels)) return data;
      lastError = new Error('Unexpected market payload shape');
    } catch (err) {
      lastError = err;
    }
  }
  return emptyWorkspace(lastError ? lastError.message : 'unreachable');
}

/**
 * getMarketSeries — REAL time-series for the REAL CHART.
 *
 * NEVER draws a chart from invented data: this returns the provider's actual
 * series, or an HONEST `{ ok:false }` when no real source provides it for the
 * requested range (the caller then shows that no chart data exists instead of a
 * fake curve). Suffix endpoints are all real providers, not mocks.
 */
export async function getMarketSeries({ panelId, symbol, range }) {
  const bases = candidateBases();
  const qs = `panelId=${encodeURIComponent(panelId || '')}&symbol=${encodeURIComponent(symbol || '')}&range=${encodeURIComponent(range || '1D')}`;
  let lastError = null;
  for (const base of bases) {
    try {
      const response = await fetch(`${base}/api/market/series?${qs}`, {
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }
      const json = await response.json();
      if (json && typeof json.ok === 'boolean') return json;
      lastError = new Error('Unexpected series payload shape');
    } catch (err) {
      lastError = err;
    }
  }
  return {
    ok: false,
    error: lastError ? lastError.message : 'Series unavailable',
    range: (range || '1D').toUpperCase()
  };
}

/**
 * getMarketChart — REAL candlestick/OHLCV series for the JIN CHART STUDIO.
 * Only real provider data is returned; never synthesized candles.
 */
export async function getMarketChart({ panelId, interval = '1h', limit = 300 }) {
  const bases = candidateBases();
  const qs = `panelId=${encodeURIComponent(panelId || '')}&interval=${encodeURIComponent(interval || '1h')}&limit=${Number(limit) || 300}`;
  let lastError = null;
  for (const base of bases) {
    try {
      const response = await fetch(`${base}/api/market/chart?${qs}`, {
        signal: AbortSignal.timeout(12000)
      });
      const json = await response.json();
      if (json && typeof json.ok === 'boolean') return json;
      lastError = new Error('Unexpected chart payload shape');
    } catch (err) {
      lastError = err;
    }
  }
  return { ok: false, error: lastError ? lastError.message : 'Chart unavailable' };
}

/**
 * getMarketChartProviders — provider capability metadata for an instrument.
 * A provider is only listed when it can genuinely deliver data for that panel.
 */
/**
 * getMarketChartResilient — JIN PERSISTENT INTELLIGENCE chart retrieval.
 * Returns the full source-resilience report alongside the (only-if-real) chart,
 * so the UI can show honest progress, the diagnosis, sources attempted, and why
 * retrieval stopped. Never returns a fabricated chart.
 */
export async function getMarketChartResilient({ panelId, interval = '1h', limit = 300 }) {
  const bases = candidateBases();
  const qs = `panelId=${encodeURIComponent(panelId || '')}&interval=${encodeURIComponent(interval || '1h')}&limit=${Number(limit) || 300}`;
  let lastError = null;
  for (const base of bases) {
    try {
      const response = await fetch(`${base}/api/market/chart/resilient?${qs}`, {
        signal: AbortSignal.timeout(30000)
      });
      const json = await response.json();
      if (json && typeof json.ok === 'boolean') return json;
      lastError = new Error('Unexpected resilient chart payload shape');
    } catch (err) {
      lastError = err;
    }
  }
  return {
    ok: false,
    chart: null,
    report: {
      ok: false,
      exhausted: true,
      report: {
        whatWasFound: null,
        whatWasNotFound: 'retrieval tidak dapat dijalankan karena server tidak terjangkau',
        sourcesAttempted: [],
        whyStopped: lastError ? lastError.message : 'server unreachable',
        nextAction: 'periksa koneksi ke server JIN'
      },
      steps: []
    }
  };
}

export async function getMarketChartProviders({ panelId }) {
  const bases = candidateBases();
  const qs = `panelId=${encodeURIComponent(panelId || '')}`;
  let lastError = null;
  for (const base of bases) {
    try {
      const response = await fetch(`${base}/api/market/chart/providers?${qs}`, {
        signal: AbortSignal.timeout(8000)
      });
      const json = await response.json();
      if (json && json.ok && Array.isArray(json.providers)) return json;
      lastError = new Error('Unexpected providers payload shape');
    } catch (err) {
      lastError = err;
    }
  }
  return { ok: true, panelId, providers: [], autoPriority: [] };
}

export const marketReferenceQuotes = [];
export default { getMarketOverview, getMarketSeries, getMarketChart, getMarketChartResilient, getMarketChartProviders, marketReferenceQuotes };