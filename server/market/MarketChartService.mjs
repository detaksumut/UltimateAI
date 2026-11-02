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

  // XM MT5 is the authoritative source for GOLD/XAUUSD when the local
  // read-only bridge is running. Never fall back to Yahoo or synthetic candles.
  const isGold = asset.isGold === true || panelId === 'market.gold' ||
    String(asset.symbol || '').toUpperCase().replace(/[^A-Z]/g, '') === 'XAUUSD';
  if (isGold) {
    const tfMap = { '5m': 'M5', '15m': 'M15', '1h': 'H1', '4h': 'H4', '1d': 'D1',
      'M5': 'M5', 'M15': 'M15', 'H1': 'H1', 'H4': 'H4', 'D1': 'D1' };
    const requested = String(interval || '1h');
    const timeframe = tfMap[requested] || tfMap[requested.toLowerCase()] || 'H1';
    const routerPort = Number(process.env.LOCAL_ROUTER_PORT || 20200);
    try {
      const response = await fetch(`http://127.0.0.1:${routerPort}/api/trading/ohlc?symbol=XAUUSD&timeframe=${timeframe}&limit=${Math.min(500, Math.max(1, Number(limit) || 300))}`, {
        signal: AbortSignal.timeout(4000),
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) throw new Error(`MT5 bridge HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload.ok || !Array.isArray(payload.candles) || payload.candles.length === 0) {
        return { ok: false, error: 'Belum ada candle XM MT5. Pastikan terminal MT5 aktif dan connector berjalan.', provider: { id: 'xm_mt5', name: 'XM MT5' }, panelId, symbol: 'XAUUSD', source: 'MT5_LOCAL_BRIDGE', live: false, freshness: payload.freshness || 'NO_DATA', count: payload.count || 0 };
      }
      const intervalMs = ({ M5: 300000, M15: 900000, H1: 3600000, H4: 14400000, D1: 86400000 })[timeframe];
      const last = payload.candles[payload.candles.length - 1];
      const lastTime = Date.parse(last.timestamp);
      const tick = payload.tick || null;
      const tickTime = tick && Number.isFinite(Date.parse(tick.timestamp)) ? Date.parse(tick.timestamp) : null;
      const tickPrice = tick && Number.isFinite(Number(tick.bid)) ? Number(tick.bid) : null;
      const lastHigh = Number(last.high);
      const lastLow = Number(last.low);
      const tolerance = Math.max(2, Number(tick?.spread || 0) * 3);
      // Fail closed: a recent broker tick must be inside the active candle's
      // range (with a small tolerance). Never draw or label mismatched prices LIVE.
      const sameActiveWindow = Number.isFinite(lastTime) && tickTime !== null &&
        tickTime >= lastTime && tickTime - lastTime <= intervalMs * 2;
      const tickOutsideLatestCandle = sameActiveWindow && tickPrice !== null &&
        Number.isFinite(lastHigh) && Number.isFinite(lastLow) &&
        (tickPrice > lastHigh + tolerance || tickPrice < lastLow - tolerance);
      if (tickOutsideLatestCandle) {
        return {
          ok: false,
          error: `Data XM MT5 tidak sinkron: tick bid ${tickPrice} berada di luar rentang candle ${timeframe} terbaru [${lastLow}, ${lastHigh}]. Chart ditahan agar analisis tidak memakai harga keliru.`,
          provider: { id: 'xm_mt5', name: 'XM MT5' },
          panelId, symbol: 'XAUUSD', source: 'MT5_LOCAL_BRIDGE',
          live: false, freshness: 'DESYNC', integrity: 'FAILED',
          tick, lastCandleTime: last.timestamp
        };
      }
      const candles = payload.candles.map((c) => {
        const openTime = Date.parse(c.timestamp);
        return { openTime, closeTime: openTime + intervalMs - 1, open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close), volume: Number(c.volume || 0) };
      }).filter(c => Number.isFinite(c.openTime) && [c.open,c.high,c.low,c.close,c.volume].every(Number.isFinite));
      const live = payload.freshness === 'FRESH' && Number.isFinite(lastTime) && Date.now() - lastTime < ({ M5: 600000, M15: 1800000, H1: 7200000, H4: 28800000, D1: 172800000 })[timeframe];
      return {
        ok: true,
        instrument: { panelId, symbol: 'XAU/USD', name: 'Emas (Gold)', category: asset.category },
        provider: { id: 'xm_mt5', name: 'XM MT5' },
        chartMode: 'JIN_RENDERED', symbol: 'XAUUSD', interval: requested,
        timeframe, source: 'XM Global MT5 / MT5_LOCAL_BRIDGE', live,
        freshness: payload.freshness, integrity: 'PASSED', count: candles.length,
        lastUpdate: lastTime, lastUpdateLabel: formatWIB(lastTime), tick: payload.tick || null, candles
      };
    } catch (err) {
      return { ok: false, error: `XM MT5 belum terhubung: ${err.message}`, provider: { id: 'xm_mt5', name: 'XM MT5' }, panelId, symbol: 'XAUUSD', source: 'MT5_LOCAL_BRIDGE', live: false };
    }
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

  if (asset && (asset.isGold === true || panelId === 'market.gold' ||
      String(asset.symbol || '').toUpperCase().replace(/[^A-Z]/g, '') === 'XAUUSD')) {
    providers.push({
      id: 'xm_mt5', name: 'XM MT5', sourceType: 'LOCAL_BROKER_TERMINAL',
      supportsLive: true, supportsHistorical: true, supportsNativeView: false,
      supportsApi: true, chartMode: 'JIN_RENDERED', symbol: 'XAUUSD',
      instrumentSupported: true,
      note: 'Candlestick broker XM MT5 melalui connector lokal; tidak memakai harga simulasi.'
    });
  }

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
    autoPriority: providers.some(p => p.id === 'xm_mt5') ? ['xm_mt5', 'open_source'] : ['binance', 'open_source'],
    modeChains: {
      JIN_RENDERED: providers.some(p => p.id === 'xm_mt5') ? ['xm_mt5'] : ['binance'],
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
