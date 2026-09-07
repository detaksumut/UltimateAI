/**
 * MarketChartService.mjs
 * Backend for the INDEPENDENT JIN CHART STUDIO.
 *
 * Providers & modes (honest, never faked):
 *   - BINANCE (crypto): real OHLCV klines via the public Binance REST API.
 *     Mode: JIN_RENDERED (JIN draws the candlestick chart from the provider's
 *     real kline data). No iframe/embed, no fabricated candles.
 *   - For non-crypto / unsupported instruments: no fake source view. We report
 *     an honest `{ ok:false }` and the UI offers OPEN SOURCE instead.
 *
 * The frontend presents provider capability metadata so it never shows a
 * provider as selectable unless it can genuinely deliver data.
 */
import { findAssetByPanel } from './MarketDataService.mjs';

// Binance public market-data endpoints (ordered by reachability; the .vision
// public market data host is Binance's geo-friendly data endpoint).
const BINANCE_KLINES_HOSTS = [
  'https://data-api.binance.vision',
  'https://api.binance.com',
  'https://api1.binance.com'
];

// Internal panel category → Binance-capable.
function binanceSymbolForPanel(asset) {
  // Only crypto panels have Binance spot markets.
  if (!asset || asset.category !== 'crypto') return null;
  const base = (asset.symbol || '').split('/')[0].replace(/[^A-Z0-9]/gi, '').toUpperCase();
  // Binance spot quote = USDT for our crypto set.
  return base ? `${base}USDT` : null;
}

// Chart interval → Binance kline interval.
const BINANCE_INTERVALS = {
  '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d',
  '1M': '1M', '3M': '3M'
};

function intervalToBinance(interval) {
  return BINANCE_INTERVALS[interval] || '1h';
}

export { BINANCE_KLINES_HOSTS, binanceSymbolForPanel, intervalToBinance, fetchBinanceKlinesFromHost };

/**
 * Fetch REAL Binance klines for a symbol + interval from ONE specific host.
 * Only points Binance actually returns; never fabricates candles.
 * Throws on failure (caller diagnoses the failure type).
 */
async function fetchBinanceKlinesFromHost(host, symbol, interval, limit) {
  const url = `${host}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit || 500}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: { 'User-Agent': 'JIN-Market-Intelligence/1.0' }
  });
  if (!response.ok) throw new Error(`Binance HTTP ${response.status} for ${symbol} (${host})`);
  const json = await response.json();
  if (!Array.isArray(json)) throw new Error(`Unexpected Binance payload for ${symbol}`);
  const candles = json
    .filter((k) => Array.isArray(k) && k.length >= 6)
    .map((k) => ({
      openTime: Number(k[0]),
      closeTime: Number(k[6]),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5])
    }))
    .filter((c) =>
      [c.open, c.high, c.low, c.close].every((v) => Number.isFinite(v) && v >= 0)
    );
  if (candles.length === 0) throw new Error(`Empty klines for ${symbol}`);
  return candles;
}

/**
 * Fetch REAL Binance klines for a symbol + interval.
 * Returns only points Binance actually returns; never fabricates candles.
 *   { openTime, closeTime, open, high, low, close, volume }
 */
async function fetchBinanceKlines(symbol, interval, limit) {
  let lastError = null;
  for (const host of BINANCE_KLINES_HOSTS) {
    try {
      return await fetchBinanceKlinesFromHost(host, symbol, interval, limit);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error(`Binance unreachable for ${symbol}`);
}

/**
 * PUBLIC: get a real chart series.
 * @param {object} opts { panelId, interval, limit }
 * Returns:
 *   { ok:true, instrument:{...}, provider:{id,name}, mode:'JIN_RENDERED',
 *     symbol, interval, candles:[{openTime,closeTime,open,high,low,close,volume}],
 *     lastUpdate, live:boolean, source }
 * or honest failure { ok:false, error, provider:null }
 */
export async function getMarketChart({ panelId, interval = '1h', limit = 300 }) {
  const asset = findAssetByPanel(panelId);
  if (!asset) {
    return { ok: false, error: 'Instrumen tidak dikenal.', panelId };
  }

  // Priority / only real provider: Binance spot for crypto.
  const binanceSymbol = binanceSymbolForPanel(asset);
  if (binanceSymbol) {
    try {
      const candles = await fetchBinanceKlines(binanceSymbol, intervalToBinance(interval), limit);
      const last = candles[candles.length - 1];
      // Honest LIVE: true only when the newest candle closed recently (Binance
      // REST is near-real-time but not a persistent WebSocket stream here).
      const ageSec = (Date.now() - last.closeTime) / 1000;
      const live = ageSec <= 900; // within 15 min of the last close → live-enough
      return {
        ok: true,
        instrument: { panelId, symbol: asset.symbol, name: asset.name, category: asset.category },
        provider: { id: 'binance', name: 'Binance' },
        chartMode: 'JIN_RENDERED',
        symbol: binanceSymbol,
        interval,
        source: 'Binance Spot Public API (/api/v3/klines)',
        live,
        lastUpdate: Date.now(),
        lastUpdateLabel: formatWIB(last.closeTime),
        candles
      };
    } catch (err) {
      return {
        ok: false,
        error: `Binance tidak terjangkau untuk ${binanceSymbol}: ${err.message}`,
        provider: { id: 'binance', name: 'Binance' },
        symbol: binanceSymbol,
        panelId
      };
    }
  }

  // Not Binance-capable → honest unsupported; UI offers OPEN SOURCE / existing
  // historical series instead. This RESOLVES as unavailable, never faked.
  return {
    ok: false,
    error: `Native live candlestick belum tersedia untuk ${asset.symbol || panelId} dari provider yang didukung.`,
    provider: null,
    panelId,
    unsupported: true
  };
}

/**
 * PUBLIC: provider capability metadata for an instrument. The UI only lists a
 * provider as selectable when it can genuinely deliver data for that panel.
 */
export function getMarketChartProviders({ panelId }) {
  const asset = findAssetByPanel(panelId);

  const providers = [];

  if (asset && asset.category === 'crypto') {
    const binanceSymbol = binanceSymbolForPanel(asset);
    providers.push({
      id: 'binance',
      name: 'Binance',
      sourceType: 'SPOT_EXCHANGE',
      supportsLive: true,
      supportsHistorical: true,
      supportsNativeView: false,
      supportsApi: true,
      chartMode: 'JIN_RENDERED',
      symbol: binanceSymbol,
      instrumentSupported: true,
      note: 'Data kline riil Binance dirender JIN (candlestick).'
    });
  }

  providers.push({
    id: 'open_source',
    name: 'Open Source',
    sourceType: 'EXPLICIT_LINK',
    supportsLive: false,
    supportsHistorical: false,
    supportsNativeView: false,
    supportsApi: false,
    chartMode: 'OPEN_SOURCE',
    symbol: null,
    instrumentSupported: true,
    note: 'Membuka halaman/sumber asli instrumen bila tersedia.'
  });

  return {
    ok: true,
    panelId,
    providers,
    autoPriority: ['binance', 'open_source'],
    modeChains: {
      JIN_RENDERED: ['binance'],
      OPEN_SOURCE: ['open_source']
    }
  };
}

function formatWIB(ms) {
  try {
    return new Date(ms).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }) + ' WIB';
  } catch {
    return '';
  }
}

export default { getMarketChart, getMarketChartProviders };
