// Public OHLC history for the JIN Cross-Asset Gold Monitor.
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

const send = (res, status, body) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.status(status).json(body);
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed; use GET.' });
  const symbol = String(req.query?.symbol || 'XAUUSD').toUpperCase();
  const timeframe = String(req.query?.timeframe || 'D1').toUpperCase();
  const limit = Math.min(365, Math.max(20, Number.parseInt(req.query?.limit || '30', 10) || 30));
  const ticker = SYMBOLS[symbol];
  if (!ticker) return send(res, 400, { ok: false, error: 'Unsupported symbol: ' + symbol });
  if (timeframe !== 'D1') return send(res, 400, { ok: false, error: 'Only D1 is supported by this endpoint.' });

  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?range=1y&interval=1d';
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 JIN-CrossAsset/1.0' },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Yahoo Finance HTTP ' + response.status);
    const payload = await response.json();
    const result = payload?.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    if (!result?.timestamp?.length || !quote) throw new Error('Provider returned no D1 OHLC series');

    const candles = result.timestamp.map((ts, i) => {
      const open = Number(quote.open?.[i]);
      const high = Number(quote.high?.[i]);
      const low = Number(quote.low?.[i]);
      const close = Number(quote.close?.[i]);
      if (![open, high, low, close].every(Number.isFinite)) return null;
      if (high < Math.max(open, close, low) || low > Math.min(open, close, high)) return null;
      return {
        symbol, timeframe: 'D1', timestamp: new Date(ts * 1000).toISOString(),
        open, high, low, close,
        volume: Number.isFinite(Number(quote.volume?.[i])) ? Number(quote.volume[i]) : 0,
        source: 'YAHOO_FINANCE', isSimulated: false,
      };
    }).filter(Boolean).slice(-limit);

    if (!candles.length) throw new Error('Provider returned zero valid D1 candles');
    return send(res, 200, {
      ok: true, symbol, timeframe: 'D1', source: 'YAHOO_FINANCE', isSimulated: false,
      delayed: true, fetchedAt: new Date().toISOString(), candles,
      note: symbol === 'XAUUSD'
        ? 'GC=F is a public gold-futures proxy; it is not a guaranteed real-time XAUUSD spot feed.'
        : 'Public Yahoo Finance market data may be delayed.',
    });
  } catch (error) {
    return send(res, 502, {
      ok: false, symbol, timeframe, source: 'YAHOO_FINANCE',
      error: String(error?.message || error).slice(0, 240),
    });
  }
}
