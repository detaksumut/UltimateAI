/**
 * intermarketProviders.mjs
 * Provider layer for JIN Gold Intermarket (FAKTOR UP/DOWN GOLD).
 *
 * Rules:
 *  - Only public, real market-data endpoints are used.
 *  - No hardcoded price and no simulated fallback. On failure we return
 *    { ok:false, candles/observations:[], error } and let the caller expose
 *    status UNAVAILABLE.
 *  - This module does NOT compute trading signals. It only fetches and parses.
 *
 * Providers:
 *  - Yahoo Finance chart API  -> DXY, US10Y (^TNX), WTI (CL=F), Gold (GC=F)
 *  - FRED CSV (official)      -> US10Y real yield (DFII10), US02Y (DGS2)
 *
 * WTI is never substituted with Brent: a different instrument must not be
 * silently presented as the requested factor.
 */

const YAHOO_CHART_HOSTS = [
  'https://query1.finance.yahoo.com/v8/finance/chart',
  'https://query2.finance.yahoo.com/v8/finance/chart',
];

const FRED_CSV_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv';

const PROVIDER_TIMEOUT_MS = 12_000;

export const YAHOO_TICKERS = {
  DXY: 'DX-Y.NYB',
  US10Y: '^TNX',
  WTI: 'CL=F',
  GOLD_FUTURES: 'GC=F',
};

export const FRED_SERIES = {
  US10Y_REAL: 'DFII10',
  US02Y: 'DGS2',
};

function toIso(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function aggregateCandles(candles, hours) {
  if (!Number.isFinite(hours) || hours <= 0 || candles.length === 0) return candles;
  const bucketMs = hours * 60 * 60 * 1000;
  const buckets = new Map();
  for (const candle of candles) {
    const time = Date.parse(candle.timestamp);
    if (!Number.isFinite(time)) continue;
    const bucketStart = Math.floor(time / bucketMs) * bucketMs;
    const key = new Date(bucketStart).toISOString();
    const current = buckets.get(key);
    if (!current) {
      buckets.set(key, { ...candle, timestamp: key });
      continue;
    }
    current.high = Math.max(current.high, candle.high);
    current.low = Math.min(current.low, candle.low);
    current.close = candle.close;
    current.volume += candle.volume;
  }
  return Array.from(buckets.values()).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

export function parseYahooCandles(result) {
  const timestamps = result?.timestamp;
  const quote = result?.indicators?.quote?.[0] || {};
  if (!Array.isArray(timestamps) || timestamps.length === 0) return [];
  const candles = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const open = Number(quote.open?.[index]);
    const high = Number(quote.high?.[index]);
    const low = Number(quote.low?.[index]);
    const close = Number(quote.close?.[index]);
    const volume = Number(quote.volume?.[index] || 0);
    if (![open, high, low, close].every(Number.isFinite)) continue;
    // Yahoo emits all-zero OHLC placeholders for holidays and missing bars.
    // They pass the high/low consistency check and would otherwise corrupt
    // trend averages and correlations (e.g. a fake -100% change).
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) continue;
    if (high < Math.max(open, close) || low > Math.min(open, close)) continue;
    const timestamp = toIso(timestamps[index] * 1000);
    if (!timestamp) continue;
    candles.push({
      timestamp,
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volume) ? volume : 0,
    });
  }
  return candles.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

/**
 * Fetch a Yahoo Finance chart.
 * @param {{ ticker:string, interval:string, range:string, aggregateHours?:number }} options
 */
export async function fetchYahooChart({ ticker, interval = '1d', range = '1y', aggregateHours = null }) {
  const encoded = encodeURIComponent(ticker);
  let lastError = null;

  for (const host of YAHOO_CHART_HOSTS) {
    const url = `${host}/${encoded}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`;
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 JIN-Gold-Intermarket/1.0' },
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        cache: 'no-store',
      });
      if (!response.ok) {
        lastError = new Error(`Yahoo Finance HTTP ${response.status} untuk ${ticker}`);
        continue;
      }
      const payload = await response.json();
      const result = payload?.chart?.result?.[0];
      if (!result) {
        lastError = new Error(`Yahoo Finance tidak mengembalikan data untuk ${ticker}`);
        continue;
      }
      const meta = result.meta || {};
      let candles = parseYahooCandles(result);
      if (aggregateHours) candles = aggregateCandles(candles, aggregateHours);
      if (candles.length === 0) {
        lastError = new Error(`Yahoo Finance tidak memiliki candle valid untuk ${ticker}`);
        continue;
      }
      return {
        ok: true,
        provider: 'Yahoo Finance',
        providerSymbol: ticker,
        sourceUrl: `https://finance.yahoo.com/quote/${encoded}`,
        meta: {
          currency: meta.currency || null,
          exchange: meta.exchangeName || null,
          marketState: String(meta.marketState || 'UNKNOWN'),
          regularMarketPrice: Number.isFinite(Number(meta.regularMarketPrice)) ? Number(meta.regularMarketPrice) : null,
          regularMarketTime: meta.regularMarketTime ? toIso(meta.regularMarketTime * 1000) : null,
          // Prefer regular previousClose. chartPreviousClose is the close at the
          // start of the requested range (e.g. one year ago for range=1y) and
          // must not be used as the daily change baseline.
          previousClose: Number.isFinite(Number(meta.previousClose))
            ? Number(meta.previousClose)
            : Number.isFinite(Number(meta.chartPreviousClose))
              ? Number(meta.chartPreviousClose)
              : null,
          chartPreviousClose: Number.isFinite(Number(meta.chartPreviousClose))
            ? Number(meta.chartPreviousClose)
            : null,
          timezone: meta.exchangeTimezoneName || null,
        },
        candles,
        error: null,
      };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    ok: false,
    provider: 'Yahoo Finance',
    providerSymbol: ticker,
    sourceUrl: `https://finance.yahoo.com/quote/${encoded}`,
    meta: null,
    candles: [],
    error: lastError?.message || `Yahoo Finance gagal memuat ${ticker}`,
  };
}

/**
 * Fetch a daily FRED series (official Federal Reserve Bank of St. Louis mirror
 * of US Treasury data). No API key is required for the public CSV export.
 */
export async function fetchFredSeries(seriesId, { limit = 420 } = {}) {
  const url = `${FRED_CSV_URL}?id=${encodeURIComponent(seriesId)}`;
  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/csv', 'User-Agent': 'Mozilla/5.0 JIN-Gold-Intermarket/1.0' },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!response.ok) {
      return {
        ok: false,
        provider: 'FRED',
        providerSymbol: seriesId,
        sourceUrl: `https://fred.stlouisfed.org/series/${seriesId}`,
        observations: [],
        error: `FRED HTTP ${response.status} untuk ${seriesId}`,
      };
    }
    const text = await response.text();
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2 || !/date/i.test(lines[0])) {
      return {
        ok: false,
        provider: 'FRED',
        providerSymbol: seriesId,
        sourceUrl: `https://fred.stlouisfed.org/series/${seriesId}`,
        observations: [],
        error: `Format CSV FRED tidak valid untuk ${seriesId}`,
      };
    }
    const observations = [];
    for (const line of lines.slice(1)) {
      const [date, rawValue] = line.split(',');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) continue;
      const value = Number(rawValue);
      if (!Number.isFinite(value)) continue;
      observations.push({ date, value });
    }
    observations.sort((a, b) => a.date.localeCompare(b.date));
    if (observations.length === 0) {
      return {
        ok: false,
        provider: 'FRED',
        providerSymbol: seriesId,
        sourceUrl: `https://fred.stlouisfed.org/series/${seriesId}`,
        observations: [],
        error: `FRED tidak memiliki observasi valid untuk ${seriesId}`,
      };
    }
    return {
      ok: true,
      provider: 'FRED',
      providerSymbol: seriesId,
      sourceUrl: `https://fred.stlouisfed.org/series/${seriesId}`,
      observations: observations.slice(-limit),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      provider: 'FRED',
      providerSymbol: seriesId,
      sourceUrl: `https://fred.stlouisfed.org/series/${seriesId}`,
      observations: [],
      error: error?.message || `FRED gagal memuat ${seriesId}`,
    };
  }
}
