/**
 * chartProviders.js
 * Chart provider abstraction for the INDEPENDENT JIN CHART STUDIO.
 *
 * A ChartProvider declares its capabilities so the UI NEVER lists a provider as
 * selectable unless it can genuinely supply data/chart for the given instrument.
 *
 * Modes:
 *   JIN_RENDERED  → JIN draws the chart from the provider's real data.
 *   NATIVE_SOURCE → official embed/widget/integration (only if licensed/valid).
 *   OPEN_SOURCE   → explicit link to the original source page.
 *
 * AUTO selection is transparent: it scores providers and records WHY each was
 * chosen (compatibility, credibility, live/historical capability, integration).
 */

export const CHART_MODES = {
  JIN_RENDERED: 'JIN_RENDERED',
  NATIVE_SOURCE: 'NATIVE_SOURCE',
  OPEN_SOURCE: 'OPEN_SOURCE'
};

// Timeframe presets (intraday → daily) with labels.
export const TF_PRESETS = [
  { id: '1m', label: '1M' },
  { id: '5m', label: '5M' },
  { id: '15m', label: '15M' },
  { id: '1h', label: '1H' },
  { id: '4h', label: '4H' },
  { id: '1d', label: '1D' }
];

export const RANGE_PRESETS = ['1D', '5D', '1M', '3M', '1Y', 'MAX'];

// Built-in provider catalogue with capability metadata (real, verified).
export const CHART_PROVIDERS = {
  binance: {
    providerId: 'binance',
    providerName: 'Binance',
    sourceType: 'SPOT_EXCHANGE',
    supportsLive: true,
    supportsHistorical: true,
    supportsNativeView: false,
    supportsEmbed: false,
    supportsApi: true,
    chartMode: CHART_MODES.JIN_RENDERED,
    credibility: 100,
    // Symbol resolver: internal BTC/USD → Binance BTCUSDT (provider-specific).
    resolveSymbol: (panel) => {
      const base = (panel?.symbol || '').split('/')[0].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      return base ? `${base}USDT` : null;
    },
    instrumentsFor: (panel) => (panel?.category === 'crypto' ? ['CRYPTO'] : []),
    openUrl: null,
    nativeNote: null
  },
  open_source: {
    providerId: 'open_source',
    providerName: 'Open Source',
    sourceType: 'EXPLICIT_LINK',
    supportsLive: false,
    supportsHistorical: false,
    supportsNativeView: false,
    supportsEmbed: false,
    supportsApi: false,
    chartMode: CHART_MODES.OPEN_SOURCE,
    credibility: 60,
    resolveSymbol: () => null,
    instrumentsFor: () => [],
    openUrl: (panel) => resolveOpenSourceUrl(panel),
    nativeNote: 'Native source view tidak tersedia — membuka halaman sumber asli.'
  }
};

/** Best-effort explicit source page for an instrument (real, openable links). */
export function resolveOpenSourceUrl(panel) {
  if (!panel) return null;
  const symbol = (panel.symbol || '').toLowerCase();
  // Crypto has a public Binance spot page.
  if (panel.category === 'crypto') {
    const base = (panel.symbol || '').split('/')[0].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return base ? `https://www.binance.com/en/trade/${base}_USDT` : null;
  }
  // Indices/stocks/articles best resolved by search — but we only return a real,
  // a priori known page, never a fabricated one.
  if (symbol === 'ihsg') return 'https://id.investing.com/indices/idx-composite';
  if (symbol === 'spx' || symbol === 's&p 500') return 'https://www.investing.com/indices/s-p-500';
  if (symbol === 'gold' || panel.category === 'metals' && panel.symbol?.includes('XAU')) {
    return 'https://www.gold.org/goldhub/data/gold-prices';
  }
  return null;
}

/**
 * Resolve which providers are genuinely usable for a given panel (from server
 * capability metadata) merged with the local catalogue.
 * Returns the list of provider objects the UI may actually offer.
 */
export function resolveProvidersForPanel(providerMeta, panel) {
  const available = [];
  for (const p of (providerMeta || [])) {
    const def = CHART_PROVIDERS[p.id];
    if (!def) continue;
    if (p.id === 'open_source') {
      const url = resolveOpenSourceUrl(panel);
      available.push({ ...def, id: p.id, instrumentSupported: true, openUrl: url });
      continue;
    }
    if (!p.instrumentSupported) continue;
    available.push({ ...def, id: p.id, ...p, symbol: def.resolveSymbol(panel) });
  }
  return available;
}

/**
 * AUTO-mode selection. Scores every usable provider and returns the best one
 * WITH a transparent reason list (never an arbitrary pick).
 */
export function autoSelectProvider(providers, panel) {
  const usable = providers.filter((p) => p.instrumentSupported !== false);
  if (usable.length === 0) {
    return { best: null, reasons: ['Tidak ada provider yang mendukung instrumen ini.'] };
  }
  const scored = usable.map((p) => {
    let score = 0;
    const reasons = [];
    if (p.supportsLive) { score += 40; reasons.push('live capability'); }
    if (p.supportsHistorical) { score += 20; reasons.push('historical capability'); }
    score += (p.credibility || 0) / 5;
    score += p.chartMode === CHART_MODES.JIN_RENDERED ? 15 : 0;
    if (p.id === 'open_source' && !p.openUrl) score -= 10;
    if (p.chartMode === CHART_MODES.JIN_RENDERED) reasons.push('JIN-rendered from real provider data');
    return { p, score, reasons };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  return {
    best: best.p,
    score: best.score,
    reasons: [`AUTO: ${best.p.providerName} (${best.p.chartMode})`, ...best.reasons].slice(0, 4)
  };
}

export default CHART_PROVIDERS;