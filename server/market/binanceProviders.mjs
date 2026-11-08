/**
 * binanceProviders.mjs
 * Real Binance market-data adapters for the JIN Crypto Risk Sentiment layer.
 *
 * Scope:
 *  - Spot BTCUSDT / ETHUSDT   -> /api/v3 (klines, 24hr ticker)
 *  - USD-M Futures BTCUSDT / ETHUSDT -> /fapi/v1 + /futures/data
 *
 * Rules:
 *  - Public market data only. No API keys are requested or stored.
 *  - No simulated values. On failure every function returns { ok:false, error }
 *    and/or empty collections so callers can report UNAVAILABLE honestly.
 *  - Spot and Futures are kept separate; their prices are never mixed.
 *  - WebSocket endpoints are documented but not streamed server-side. REST
 *    snapshots are labelled as snapshots, so the UI never claims a stream.
 */

const PROVIDER_TIMEOUT_MS = 12_000;

export const BINANCE_SPOT_HOSTS = [
  'https://data-api.binance.vision',
  'https://api.binance.com',
  'https://api1.binance.com',
];

export const BINANCE_FUTURES_HOSTS = [
  'https://fapi.binance.com',
  'https://fapi1.binance.com',
  'https://fapi2.binance.com',
];

// Documented only. Wiring a long-lived stream is intentionally out of scope for
// this snapshot layer; the browser/client can consume these if needed later.
export const BINANCE_WEBSOCKET = {
  spot: ['wss://data-stream.binance.vision', 'wss://stream.binance.com:9443'],
  futures: ['wss://fstream.binance.com'],
  note: 'REST snapshots are used here; LIVE requires a fresh snapshot timestamp, not a claim of streaming.',
};

export const BINANCE_SYMBOLS = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  PAXG: 'PAXGUSDT',
};

export const BINANCE_INTERVALS = {
  D1: '1d',
  H4: '4h',
  H1: '1h',
};

const SYMBOL_RE = /^[A-Z0-9]{5,20}$/;
const ALLOWED_INTERVALS = new Set(Object.values(BINANCE_INTERVALS));

function isValidSymbol(symbol) {
  return typeof symbol === 'string' && SYMBOL_RE.test(symbol);
}

function toIso(value) {
  const time = Number(value);
  if (!Number.isFinite(time) || time <= 0) return null;
  const date = new Date(time);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseSpotKlines(payload) {
  if (!Array.isArray(payload)) return [];
  const candles = [];
  for (const row of payload) {
    if (!Array.isArray(row) || row.length < 6) continue;
    const open = finite(row[1]);
    const high = finite(row[2]);
    const low = finite(row[3]);
    const close = finite(row[4]);
    const volume = finite(row[5]);
    const openTime = finite(row[0]);
    const closeTime = finite(row[6]);
    if ([open, high, low, close, volume, openTime].some((value) => value == null)) continue;
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) continue;
    if (high < Math.max(open, close) || low > Math.min(open, close)) continue;
    candles.push({
      openTime,
      closeTime,
      open,
      high,
      low,
      close,
      volume,
      quoteVolume: finite(row[7]) ?? 0,
      trades: finite(row[8]) ?? 0,
      takerBuyBase: finite(row[9]) ?? 0,
      takerBuyQuote: finite(row[10]) ?? 0,
    });
  }
  return candles.sort((a, b) => a.openTime - b.openTime);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    headers: { Accept: 'application/json', 'User-Agent': 'JIN-Crypto-Risk/1.0' },
    cache: 'no-store',
  });
  const text = await response.text();
  if (!response.ok) {
    let detail = '';
    try {
      const parsed = JSON.parse(text);
      detail = parsed?.msg || parsed?.message || '';
    } catch (_) {
      detail = text.slice(0, 160);
    }
    const error = new Error(`Binance HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
    error.status = response.status;
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error('Binance mengembalikan non-JSON.');
  }
}

async function firstSuccessful(hosts, buildPath) {
  let lastError = null;
  let lastStatus = null;
  for (const host of hosts) {
    try {
      const data = await fetchJson(`${host}${buildPath(host)}`);
      return { ok: true, host, data, error: null };
    } catch (error) {
      lastError = error;
      lastStatus = error?.status ?? lastStatus;
    }
  }
  return {
    ok: false,
    host: null,
    data: null,
    error: lastError?.message || 'Binance tidak terjangkau.',
    status: lastStatus,
  };
}

function marketMeta(market) {
  return market === 'futures'
    ? { provider: 'Binance USD-M Futures', market: 'FUTURES' }
    : { provider: 'Binance Spot', market: 'SPOT' };
}

export async function fetchBinanceKlines({ symbol, interval, limit = 220, market = 'spot' }) {
  const meta = marketMeta(market);
  if (!isValidSymbol(symbol)) {
    return { ok: false, ...meta, symbol, interval, candles: [], error: 'Simbol Binance tidak valid.' };
  }
  if (!ALLOWED_INTERVALS.has(interval)) {
    return { ok: false, ...meta, symbol, interval, candles: [], error: `Interval Binance tidak didukung: ${interval}` };
  }
  const hosts = market === 'futures' ? BINANCE_FUTURES_HOSTS : BINANCE_SPOT_HOSTS;
  const basePath = market === 'futures' ? '/fapi/v1/klines' : '/api/v3/klines';
  const path = `${basePath}?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${Math.min(1000, Math.max(1, Number(limit) || 220))}`;
  const result = await firstSuccessful(hosts, () => path);
  if (!result.ok) {
    return {
      ok: false,
      ...meta,
      symbol,
      interval,
      host: null,
      candles: [],
      sourceUrl: `https://www.binance.com/en/trade/${symbol}`,
      error: result.error,
    };
  }
  const candles = parseSpotKlines(result.data);
  if (candles.length === 0) {
    return {
      ok: false,
      ...meta,
      symbol,
      interval,
      host: result.host,
      candles: [],
      sourceUrl: `https://www.binance.com/en/trade/${symbol}`,
      error: `Binance tidak memiliki candle valid untuk ${symbol} ${interval}.`,
    };
  }
  return {
    ok: true,
    ...meta,
    symbol,
    interval,
    host: result.host,
    sourceUrl: `https://www.binance.com/en/trade/${symbol}`,
    candles,
    error: null,
  };
}

export async function fetchBinanceTicker24h({ symbol, market = 'spot' }) {
  const meta = marketMeta(market);
  if (!isValidSymbol(symbol)) {
    return { ok: false, ...meta, symbol, error: 'Simbol Binance tidak valid.' };
  }
  const hosts = market === 'futures' ? BINANCE_FUTURES_HOSTS : BINANCE_SPOT_HOSTS;
  const basePath = market === 'futures' ? '/fapi/v1/ticker/24hr' : '/api/v3/ticker/24hr';
  const result = await firstSuccessful(hosts, () => `${basePath}?symbol=${encodeURIComponent(symbol)}`);
  if (!result.ok) {
    return { ok: false, ...meta, symbol, host: null, error: result.error };
  }
  const data = result.data || {};
  const lastPrice = finite(data.lastPrice);
  if (lastPrice == null || lastPrice <= 0) {
    return { ok: false, ...meta, symbol, host: result.host, error: 'Binance lastPrice tidak valid.' };
  }
  return {
    ok: true,
    ...meta,
    symbol,
    host: result.host,
    lastPrice,
    prevClosePrice: finite(data.prevClosePrice),
    priceChangePercent: finite(data.priceChangePercent),
    highPrice: finite(data.highPrice),
    lowPrice: finite(data.lowPrice),
    volume: finite(data.volume),
    quoteVolume: finite(data.quoteVolume),
    count: finite(data.count),
    openTime: toIso(data.openTime),
    closeTime: toIso(data.closeTime),
    sourceUrl: `https://www.binance.com/en/trade/${symbol}`,
    error: null,
  };
}

function parseAggTrades(payload) {
  if (!Array.isArray(payload)) return [];
  const trades = [];
  for (const row of payload) {
    if (!row || typeof row !== 'object') continue;
    const price = finite(row.p);
    const quantity = finite(row.q);
    const time = finite(row.T);
    if (price == null || price <= 0) continue;
    if (quantity == null || quantity <= 0) continue;
    if (time == null || time <= 0) continue;
    // Binance `m` = "was the buyer the maker?". false means the taker was the
    // buyer (aggressive BUY); true means the taker was the seller (aggressive
    // SELL). When `m` is missing the caller must mark the result ESTIMATED.
    const isBuyerMaker = typeof row.m === 'boolean' ? row.m : null;
    trades.push({
      id: finite(row.a),
      price,
      quantity,
      quoteQuantity: price * quantity,
      time,
      isBuyerMaker,
      isBestMatch: row.M === true,
    });
  }
  return trades.sort((a, b) => a.time - b.time || (a.id ?? 0) - (b.id ?? 0));
}

/**
 * Fetch the public aggregated trade tape. `isBuyerMaker` is the exchange's own
 * aggressor-side flag, so callers can classify real BUY/SELL aggression instead
 * of inferring it from price direction.
 */
export async function fetchBinanceAggTrades({ symbol, limit = 1000, market = 'spot' }) {
  const meta = marketMeta(market);
  if (!isValidSymbol(symbol)) {
    return { ok: false, ...meta, symbol, trades: [], error: 'Simbol Binance tidak valid.' };
  }
  const hosts = market === 'futures' ? BINANCE_FUTURES_HOSTS : BINANCE_SPOT_HOSTS;
  const basePath = market === 'futures' ? '/fapi/v1/aggTrades' : '/api/v3/aggTrades';
  const safeLimit = Math.min(1000, Math.max(1, Number(limit) || 1000));
  const path = `${basePath}?symbol=${encodeURIComponent(symbol)}&limit=${safeLimit}`;
  const result = await firstSuccessful(hosts, () => path);
  if (!result.ok) {
    return {
      ok: false,
      ...meta,
      symbol,
      host: null,
      trades: [],
      sourceUrl: `https://www.binance.com/en/trade/${symbol}`,
      error: result.error,
    };
  }
  const trades = parseAggTrades(result.data);
  if (trades.length === 0) {
    return {
      ok: false,
      ...meta,
      symbol,
      host: result.host,
      trades: [],
      sourceUrl: `https://www.binance.com/en/trade/${symbol}`,
      error: `Binance tidak mengembalikan trade valid untuk ${symbol}.`,
    };
  }
  const withSide = trades.filter((trade) => trade.isBuyerMaker !== null).length;
  return {
    ok: true,
    ...meta,
    symbol,
    host: result.host,
    sourceUrl: `https://www.binance.com/en/trade/${symbol}`,
    trades,
    classification: withSide === trades.length ? 'EXCHANGE_AGGRESSOR' : withSide > 0 ? 'MIXED' : 'UNKNOWN',
    error: null,
  };
}

export async function probeBinanceFutures({ now = Date.now() } = {}) {
  const result = await firstSuccessful(BINANCE_FUTURES_HOSTS, () => '/fapi/v1/ping');
  return {
    ok: Boolean(result.ok),
    host: result.host,
    error: result.ok ? null : result.error,
    status: result.status ?? null,
    checkedAt: new Date(now).toISOString(),
  };
}

export async function fetchBinanceOpenInterest({ host, symbol }) {
  const base = host || BINANCE_FUTURES_HOSTS[0];
  if (!isValidSymbol(symbol)) {
    return { ok: false, symbol, error: 'Simbol Binance tidak valid.', current: null, history: [] };
  }
  let current = null;
  let error = null;
  try {
    const payload = await fetchJson(`${base}/fapi/v1/openInterest?symbol=${encodeURIComponent(symbol)}`);
    const value = finite(payload?.openInterest);
    if (value == null) throw new Error('Open Interest tidak valid.');
    current = { value, time: toIso(payload?.time) };
  } catch (err) {
    error = err?.message || 'Open Interest gagal dimuat.';
  }
  let history = [];
  try {
    const payload = await fetchJson(`${base}/futures/data/openInterestHist?symbol=${encodeURIComponent(symbol)}&period=4h&limit=42`);
    if (Array.isArray(payload)) {
      history = payload
        .map((row) => ({
          time: toIso(Number(row?.timestamp)),
          sumOpenInterest: finite(row?.sumOpenInterest),
          sumOpenInterestValue: finite(row?.sumOpenInterestValue),
        }))
        .filter((row) => row.time && row.sumOpenInterest != null)
        .sort((a, b) => a.time.localeCompare(b.time));
    }
  } catch (err) {
    if (!error) error = err?.message || 'Riwayat Open Interest gagal dimuat.';
  }
  return { ok: Boolean(current) || history.length > 0, symbol, current, history, error };
}

export async function fetchBinanceFunding({ host, symbol }) {
  const base = host || BINANCE_FUTURES_HOSTS[0];
  if (!isValidSymbol(symbol)) {
    return { ok: false, symbol, error: 'Simbol Binance tidak valid.' };
  }
  try {
    const payload = await fetchJson(`${base}/fapi/v1/premiumIndex?symbol=${encodeURIComponent(symbol)}`);
    return {
      ok: true,
      symbol,
      markPrice: finite(payload?.markPrice),
      indexPrice: finite(payload?.indexPrice),
      lastFundingRate: finite(payload?.lastFundingRate),
      nextFundingTime: toIso(payload?.nextFundingTime),
      time: toIso(payload?.time),
      error: null,
    };
  } catch (error) {
    return { ok: false, symbol, error: error?.message || 'Funding rate gagal dimuat.' };
  }
}

export async function fetchBinanceLongShort({ host, symbol }) {
  const base = host || BINANCE_FUTURES_HOSTS[0];
  if (!isValidSymbol(symbol)) {
    return { ok: false, symbol, error: 'Simbol Binance tidak valid.', history: [] };
  }
  try {
    const payload = await fetchJson(`${base}/futures/data/globalLongShortAccountRatio?symbol=${encodeURIComponent(symbol)}&period=4h&limit=42`);
    const history = (Array.isArray(payload) ? payload : [])
      .map((row) => ({
        time: toIso(Number(row?.timestamp)),
        longShortRatio: finite(row?.longShortRatio),
        longAccount: finite(row?.longAccount),
        shortAccount: finite(row?.shortAccount),
      }))
      .filter((row) => row.time && row.longShortRatio != null)
      .sort((a, b) => a.time.localeCompare(b.time));
    if (history.length === 0) {
      return { ok: false, symbol, history: [], error: 'Long/Short ratio tidak tersedia.' };
    }
    return { ok: true, symbol, history, latest: history.at(-1), error: null };
  } catch (error) {
    return { ok: false, symbol, history: [], error: error?.message || 'Long/Short ratio gagal dimuat.' };
  }
}

/**
 * Public liquidation REST is restricted by Binance (forceOrders generally needs
 * authentication). We attempt it once and report restricted/ unavailable rather
 * than inventing liquidation numbers.
 */
export async function fetchBinanceLiquidations({ host, symbol }) {
  const base = host || BINANCE_FUTURES_HOSTS[0];
  if (!isValidSymbol(symbol)) {
    return { ok: false, symbol, restricted: false, error: 'Simbol Binance tidak valid.' };
  }
  try {
    const payload = await fetchJson(`${base}/fapi/v1/allForceOrders?symbol=${encodeURIComponent(symbol)}&limit=100`);
    const rows = Array.isArray(payload) ? payload : [];
    return {
      ok: true,
      symbol,
      restricted: false,
      count: rows.length,
      note: rows.length
        ? 'Snapshot force orders publik; cakupan terbatas.'
        : 'Tidak ada force order pada jendela snapshot.',
      error: null,
    };
  } catch (error) {
    const status = error?.status;
    const restricted = status === 401 || status === 403 || status === 418;
    return {
      ok: false,
      symbol,
      restricted,
      count: null,
      note: restricted
        ? 'Endpoint likuidasi publik dibatasi; membutuhkan akses khusus.'
        : 'Data likuidasi tidak tersedia dari endpoint publik.',
      error: error?.message || 'Liquidations gagal dimuat.',
    };
  }
}

async function loadSpotAsset(symbol, now) {
  const [D1, H4, H1, ticker] = await Promise.all([
    fetchBinanceKlines({ symbol, interval: BINANCE_INTERVALS.D1, limit: 220, market: 'spot' }),
    fetchBinanceKlines({ symbol, interval: BINANCE_INTERVALS.H4, limit: 220, market: 'spot' }),
    fetchBinanceKlines({ symbol, interval: BINANCE_INTERVALS.H1, limit: 120, market: 'spot' }),
    fetchBinanceTicker24h({ symbol, market: 'spot' }),
  ]);
  return {
    symbol,
    market: 'SPOT',
    fetchedAt: new Date(now).toISOString(),
    ticker,
    klines: { D1, H4, H1 },
  };
}

async function loadFuturesAsset(host, symbol, now) {
  const [D1, H4, H1, ticker, openInterest, funding, longShort, liquidations] = await Promise.all([
    fetchBinanceKlines({ symbol, interval: BINANCE_INTERVALS.D1, limit: 220, market: 'futures' }),
    fetchBinanceKlines({ symbol, interval: BINANCE_INTERVALS.H4, limit: 220, market: 'futures' }),
    fetchBinanceKlines({ symbol, interval: BINANCE_INTERVALS.H1, limit: 120, market: 'futures' }),
    fetchBinanceTicker24h({ symbol, market: 'futures' }),
    fetchBinanceOpenInterest({ host, symbol }),
    fetchBinanceFunding({ host, symbol }),
    fetchBinanceLongShort({ host, symbol }),
    fetchBinanceLiquidations({ host, symbol }),
  ]);
  return {
    symbol,
    market: 'FUTURES',
    fetchedAt: new Date(now).toISOString(),
    ticker,
    klines: { D1, H4, H1 },
    openInterest,
    funding,
    longShort,
    liquidations,
  };
}

/**
 * Fetch the complete crypto snapshot. Never throws: partial failures are
 * returned alongside the data that succeeded.
 */
export async function fetchBinanceCryptoSnapshot({ now = Date.now() } = {}) {
  const futuresProbe = probeBinanceFutures({ now });
  const spotTasks = [loadSpotAsset(BINANCE_SYMBOLS.BTC, now), loadSpotAsset(BINANCE_SYMBOLS.ETH, now)];
  const [probe, btcSpot, ethSpot] = await Promise.all([futuresProbe, ...spotTasks]);

  const snapshot = {
    ok: Boolean(btcSpot?.ticker?.ok || ethSpot?.ticker?.ok || btcSpot?.klines?.D1?.ok || ethSpot?.klines?.D1?.ok),
    provider: 'Binance',
    fetchedAt: new Date(now).toISOString(),
    spot: { BTC: btcSpot, ETH: ethSpot },
    futures: {
      reachable: probe.ok,
      host: probe.host,
      error: probe.error,
      checkedAt: probe.checkedAt,
      BTC: null,
      ETH: null,
    },
    websocket: BINANCE_WEBSOCKET,
    apiKeysRequired: false,
    error: null,
  };

  if (!snapshot.ok) {
    snapshot.error = btcSpot?.ticker?.error
      || ethSpot?.ticker?.error
      || btcSpot?.klines?.D1?.error
      || 'Binance Spot tidak terjangkau.';
  }

  if (probe.ok) {
    const [btcFutures, ethFutures] = await Promise.all([
      loadFuturesAsset(probe.host, BINANCE_SYMBOLS.BTC, now),
      loadFuturesAsset(probe.host, BINANCE_SYMBOLS.ETH, now),
    ]);
    snapshot.futures.BTC = btcFutures;
    snapshot.futures.ETH = ethFutures;
  }

  return snapshot;
}

export const BINANCE_PROVIDER_INFO = {
  id: 'binance',
  name: 'Binance',
  spotEndpoints: ['/api/v3/klines', '/api/v3/ticker/24hr'],
  futuresEndpoints: [
    '/fapi/v1/klines',
    '/fapi/v1/ticker/24hr',
    '/fapi/v1/openInterest',
    '/futures/data/openInterestHist',
    '/fapi/v1/premiumIndex',
    '/futures/data/globalLongShortAccountRatio',
    '/fapi/v1/allForceOrders',
  ],
  websocket: BINANCE_WEBSOCKET,
  apiKeysRequired: false,
  rateLimitNote: 'Market-data weights are low; the gold route caches for 45s. Public futures endpoints may be geo-restricted.',
};
