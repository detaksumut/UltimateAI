// Public OHLC history for the JIN Cross-Asset Gold Monitor and PlatformTrader.
// Yahoo Finance data may be delayed; GC=F is a gold-futures proxy, not broker XAUUSD spot.
const SYMBOLS = {
  XAUUSD: 'GC=F',
  DXY: 'DX-Y.NYB',
  US10Y: '^TNX',
  US02Y: '^UST2Y',
  USDJPY: 'USDJPY=X',
  EURUSD: 'EURUSD=X',
  USDCHF: 'USDCHF=X',
  USOIL: 'CL=F',
  XAGUSD: 'SI=F',
  HG: 'HG=F',
  SPX500: '^GSPC',
  BTCUSDT: 'BTC-USD',
};

// Yahoo intraday ranges: 1m <= 7d, 5m/15m/30m <= 60d, 60m <= 730d.
// H4 is aggregated from 60m because Yahoo has no native 4h interval.
const TIMEFRAMES = {
  M1: { interval: '1m', range: '5d', aggregate: 1 },
  M5: { interval: '5m', range: '1mo', aggregate: 1 },
  M15: { interval: '15m', range: '1mo', aggregate: 1 },
  M30: { interval: '30m', range: '1mo', aggregate: 1 },
  H1: { interval: '60m', range: '3mo', aggregate: 1 },
  H4: { interval: '60m', range: '6mo', aggregate: 4 },
  D1: { interval: '1d', range: '1y', aggregate: 1 },
};

const send = (res, status, body) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.status(status).json(body);
};

function aggregateCandles(candles, size) {
  if (size <= 1) return candles;
  const grouped = [];
  for (let i = 0; i < candles.length; i += size) {
    const chunk = candles.slice(i, i + size);
    if (!chunk.length) continue;
    grouped.push({
      ...chunk[0],
      high: Math.max(...chunk.map(c => c.high)),
      low: Math.min(...chunk.map(c => c.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((sum, c) => sum + (Number(c.volume) || 0), 0),
    });
  }
  return grouped;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed; use GET.' });

  const symbol = String(req.query?.symbol || 'XAUUSD').toUpperCase();
  const timeframe = String(req.query?.timeframe || 'D1').toUpperCase();
  const limit = Math.min(500, Math.max(20, Number.parseInt(req.query?.limit || '150', 10) || 150));
  const ticker = SYMBOLS[symbol];
  const tf = TIMEFRAMES[timeframe];

  if (!ticker) return send(res, 400, { ok: false, error: 'Unsupported symbol: ' + symbol });
  if (!tf) {
    return send(res, 400, {
      ok: false,
      error: 'Unsupported timeframe: ' + timeframe + '. Supported: ' + Object.keys(TIMEFRAMES).join(', '),
    });
  }

  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) +
      '?range=' + encodeURIComponent(tf.range) + '&interval=' + encodeURIComponent(tf.interval);
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 JIN-CrossAsset/1.0' },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Yahoo Finance HTTP ' + response.status);
    const payload = await response.json();
    const result = payload?.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    if (!result?.timestamp?.length || !quote) throw new Error('Provider returned no ' + timeframe + ' OHLC series');

    const rawCandles = result.timestamp.map((ts, i) => {
      const open = Number(quote.open?.[i]);
      const high = Number(quote.high?.[i]);
      const low = Number(quote.low?.[i]);
      const close = Number(quote.close?.[i]);
      if (![open, high, low, close].every(Number.isFinite)) return null;
      if (high < Math.max(open, close, low) || low > Math.min(open, close, high)) return null;
      return {
        symbol, timeframe, timestamp: new Date(ts * 1000).toISOString(),
        open, high, low, close,
        volume: Number.isFinite(Number(quote.volume?.[i])) ? Number(quote.volume[i]) : 0,
        source: 'YAHOO_FINANCE', isSimulated: false,
      };
    }).filter(Boolean);

    const candles = aggregateCandles(rawCandles, tf.aggregate).slice(-limit);

    if (!candles.length) throw new Error('Provider returned zero valid ' + timeframe + ' candles');

    // The chart's "LIVE BID" otherwise falls back to the last (often still
    // forming and flat) candle close. Publish the provider quote explicitly.
    const meta = result.meta || {};
    const marketPrice = Number(meta.regularMarketPrice);
    const marketTime = Number(meta.regularMarketTime);
    const spread = symbol === 'XAUUSD' ? 0.35 : 0.01;
    const tick = Number.isFinite(marketPrice) ? {
      symbol,
      bid: marketPrice,
      ask: marketPrice + spread,
      spread,
      timestamp: Number.isFinite(marketTime) ? new Date(marketTime * 1000).toISOString() : new Date().toISOString(),
      source: 'YAHOO_FINANCE',
    } : null;

    return send(res, 200, {
      ok: true, symbol, timeframe, source: 'YAHOO_FINANCE', isSimulated: false,
      delayed: true, fetchedAt: new Date().toISOString(), tick, candles,
      note: symbol === 'XAUUSD'
        ? 'GC=F is a public gold-futures proxy; it is not a guaranteed real-time XAUUSD spot feed. Data may be delayed.'
        : 'Public Yahoo Finance market data may be delayed.',
    });
  } catch (error) {
    return send(res, 502, {
      ok: false, symbol, timeframe, source: 'YAHOO_FINANCE',
      error: String(error?.message || error).slice(0, 240),
    });
  }
}
