/**
 * providerAdapters.mjs
 * REAL PROVIDER ADAPTERS with per-provider symbol formats.
 *
 * Each adapter knows its own identifier for an instrument:
 *   Binance   → "BTCUSDT"   (meta.binance)
 *   CoinGecko → "bitcoin"   (meta.coingeckoId)
 *   Yahoo     → "BTC-USD"   (meta.yahoo)
 *
 * Every adapter:
 *   - calls the real public endpoint (host-fallback where available),
 *   - normalizes output into the common schema,
 *   - returns a real, clickable sourceUrl,
 *   - records a diagnostics entry (intent → provider → endpoint identity →
 *     status → failure reason) WITHOUT exposing secrets.
 *
 * NOTE: An adapter throws ONLY on a genuine fetch/parse failure so the router can
 * fall through to the next provider. It never fabricates a price.
 */
import { classifyError, FAILURE_TYPES } from '../../src/services/engineering/sourceResilienceEngine.js';

// Binance public market-data hosts. data-api.binance.vision is Binance's
// geo-friendly public data endpoint; api.binance.com / api1.binance.com official.
const BINANCE_TICKER_HOSTS = [
  'https://data-api.binance.vision',
  'https://api.binance.com',
  'https://api1.binance.com'
];

const YAHOO_CHART_HOSTS = [
  'https://query1.finance.yahoo.com/v8/finance/chart',
  'https://query2.finance.yahoo.com/v8/finance/chart'
];

const FETCH_TIMEOUT_MS = 10000;

async function httpJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'User-Agent': 'JIN-Market-Intelligence/1.0', Accept: 'application/json' }
  });
  return response;
}

// ── Binance adapter (crypto) ─────────────────────────────────────────────────
export async function binanceQuote(canonical, diagnostics) {
  const symbol = canonical.meta && canonical.meta.binance;
  if (!symbol) throw new Error('Tidak ada identitas Binance untuk instrumen ini.');
  let lastErr = null;
  let lastStatus = null;
  for (const host of BINANCE_TICKER_HOSTS) {
    const url = `${host}/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`;
    diagnostics.push({ provider: 'binance', endpoint: host + '/api/v3/ticker/24hr', symbol, status: 'ATTEMPTED' });
    try {
      const res = await httpJson(url);
      if (!res.ok) {
        lastStatus = res.status;
        lastErr = new Error(`Binance HTTP ${res.status} (${host})`);
        diagnostics[diagnostics.length - 1].status = `FAILED HTTP ${res.status}`;
        continue;
      }
      const d = await res.json();
      const price = Number(d.lastPrice);
      const prev = Number(d.prevClosePrice);
      if (!Number.isFinite(price) || price <= 0) throw new Error('Binance lastPrice tidak valid.');
      diagnostics[diagnostics.length - 1].status = 'OK';
      return {
        asset: canonical.asset,
        symbol: canonical.symbol,
        price,
        currency: 'USDT',
        change24h: Number.isFinite(Number(d.priceChangePercent)) ? Number(d.priceChangePercent) : null,
        high24h: Number(d.highPrice) > 0 ? Number(d.highPrice) : null,
        low24h: Number(d.lowPrice) > 0 ? Number(d.lowPrice) : null,
        volume24h: Number(d.quoteVolume) > 0 ? Number(d.quoteVolume) : null,
        source: 'Binance',
        sourceUrl: `https://www.binance.com/en/trade/${symbol}`,
        retrievedAt: Date.now(),
        verificationStatus: 'VERIFIED'
      };
    } catch (err) {
      lastErr = err;
      if (!lastStatus) lastStatus = null;
    }
  }
  throw lastErr || new Error(`Binance unreachable untuk ${symbol}`);
}

// ── CoinGecko adapter (crypto) ───────────────────────────────────────────────
export async function coingeckoQuote(canonical, diagnostics) {
  const id = canonical.meta && canonical.meta.coingeckoId;
  if (!id) throw new Error('Tidak ada identitas CoinGecko untuk instrumen ini.');
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd,idr&include_24hr_change=true&include_24hr_vol=true&include_24hr_high_low=true&precision=4`;
  diagnostics.push({ provider: 'coingecko', endpoint: 'api.coingecko.com/simple/price', symbol: id, status: 'ATTEMPTED' });
  const res = await httpJson(url);
  if (!res.ok) {
    diagnostics[diagnostics.length - 1].status = `FAILED HTTP ${res.status}`;
    throw new Error(`CoinGecko HTTP ${res.status}`);
  }
  const data = await res.json();
  const d = data[id] || {};
  const price = Number(d.usd);
  if (!Number.isFinite(price) || price <= 0) {
    diagnostics[diagnostics.length - 1].status = 'FAILED no-valid-price';
    throw new Error('CoinGecko tidak mengembalikan harga valid.');
  }
  diagnostics[diagnostics.length - 1].status = 'OK';
  return {
    asset: canonical.asset,
    symbol: canonical.symbol,
    price,
    currency: 'USD',
    change24h: Number.isFinite(Number(d.usd_24h_change)) ? Number(d.usd_24h_change) : null,
    high24h: Number.isFinite(Number(d.usd_24h_high)) ? Number(d.usd_24h_high) : null,
    low24h: Number.isFinite(Number(d.usd_24h_low)) ? Number(d.usd_24h_low) : null,
    volume24h: Number.isFinite(Number(d.usd_24h_vol)) ? Number(d.usd_24h_vol) : null,
    source: 'CoinGecko',
    sourceUrl: `https://www.coingecko.com/en/coins/${id}`,
    retrievedAt: Date.now(),
    verificationStatus: 'VERIFIED'
  };
}

// ── Yahoo adapter (all non-crypto + crypto cross-check) ──────────────────────
export async function yahooQuote(canonical, diagnostics) {
  const ysymbol = canonical.meta && canonical.meta.yahoo;
  if (!ysymbol) throw new Error('Tidak ada identitas Yahoo untuk instrumen ini.');
  let lastErr = null;
  for (const host of YAHOO_CHART_HOSTS) {
    const url = `${host}/${encodeURIComponent(ysymbol)}?range=1d&interval=5m`;
    diagnostics.push({ provider: 'yahoo', endpoint: host.split('/')[2] + '/v8/finance/chart', symbol: ysymbol, status: 'ATTEMPTED' });
    try {
      const res = await httpJson(url);
      if (!res.ok) {
        diagnostics[diagnostics.length - 1].status = `FAILED HTTP ${res.status}`;
        lastErr = new Error(`Yahoo HTTP ${res.status}`);
        continue;
      }
      const json = await res.json();
      const result = json && json.chart && json.chart.result && json.chart.result[0];
      if (!result || !result.meta) throw new Error('Yahoo meta kosong.');
      const meta = result.meta;
      const regularPrice = meta.regularMarketPrice;
      const prev = meta.chartPreviousClose || meta.previousClose;
      const price = Number(regularPrice);
      if (!Number.isFinite(price) || price <= 0) throw new Error('Yahoo regularMarketPrice tidak valid.');
      const change = prev != null && Number(prev) > 0 ? ((price - Number(prev)) / Number(prev)) * 100 : null;

      let high = null; let low = null; let volume = null;
      if (result.indicators && result.indicators.quote && result.indicators.quote[0]) {
        const q = result.indicators.quote[0];
        const highs = (q.high || []).filter((v) => Number.isFinite(v));
        const lows = (q.low || []).filter((v) => Number.isFinite(v));
        const vols = (q.volume || []).filter((v) => Number.isFinite(v));
        if (highs.length) high = Math.max(...highs);
        if (lows.length) low = Math.min(...lows);
        if (vols.length) volume = vols[vols.length - 1];
      }
      diagnostics[diagnostics.length - 1].status = 'OK';
      return {
        asset: canonical.asset,
        symbol: canonical.symbol,
        price,
        currency: meta.currency || canonical.currency || 'USD',
        change24h: change,
        high24h: high,
        low24h: low,
        volume24h: volume,
        source: 'Yahoo Finance',
        sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(ysymbol)}`,
        retrievedAt: Date.now(),
        verificationStatus: 'VERIFIED'
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error(`Yahoo unreachable untuk ${ysymbol}`);
}

export function classifyRouterError(err, status) {
  return classifyError(err, status);
}

export { FAILURE_TYPES };

export default { binanceQuote, coingeckoQuote, yahooQuote, classifyRouterError };