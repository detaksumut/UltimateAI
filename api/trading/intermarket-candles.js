// Live OHLC candle history for JIN Cross-Asset Gold Monitor.
// Scope: JIN trading only. Do not import or modify APASIFIC modules here.
// Yahoo Finance public data may be delayed; this endpoint never fabricates candles.
const send = (res, status, body) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res.status(status).json(body);
};

const ASSETS = [
  { symbol: 'XAUUSD', ticker: 'GC=F' },
  { symbol: 'DXY', ticker: 'DX-Y.NYB' },
  { symbol: 'US10Y', ticker: '^TNX' },
  // Yahoo's 13-week Treasury bill (^IRX) is NOT a 2-year yield.
  { symbol: 'US02Y', ticker: '^UST2Y' },
  { symbol: 'USDJPY', ticker: 'USDJPY=X' },
  { symbol: 'EURUSD', ticker: 'EURUSD=X' },
  { symbol: 'USDCHF', ticker: 'USDCHF=X' },
  { symbol: 'USOIL', ticker: 'CL=F' },
  { symbol: 'XAGUSD', ticker: 'SI=F' },
  { symbol: 'HG', ticker: 'HG=F' },
  { symbol: 'SPX500', ticker: '^GSPC' },
  { symbol: 'BTCUSDT', ticker: 'BTC-USD' }
];
const finite = v => typeof v === 'number' && Number.isFinite(v);

const toCandle = (symbol, timeframe, timestamp, q, i) => {
  const open = q.open?.[i], high = q.high?.[i], low = q.low?.[i], close = q.close?.[i], volume = q.volume?.[i];
  if (![open, high, low, close].every(finite)) return null;
  if (high < Math.max(open, close, low) || low > Math.min(open, close, high)) return null;
  return {
    symbol, timeframe, timestamp: new Date(timestamp * 1000).toISOString(),
    open, high, low, close, volume: finite(volume) ? volume : 0,
    source: 'Yahoo Finance', isSimulated: false
  };
};

async function fetchCandles(asset, timeframe) {
  const isDaily = timeframe === 'D1';
  const interval = isDaily ? '1d' : '1h';
  const range = isDaily ? '1y' : '3mo';
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
    encodeURIComponent(asset.ticker) + '?range=' + range + '&interval=' + interval;
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 JIN-CrossAsset/1.0' },
    signal: AbortSignal.timeout(9000),
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(asset.symbol + ' provider HTTP ' + response.status);
  const payload = await response.json();
  if (payload?.chart?.error) throw new Error(asset.symbol + ' provider: ' + (payload.chart.error.description || 'unknown error'));
  const result = payload?.chart?.result?.[0];
  if (!result?.timestamp?.length) throw new Error(asset.symbol + ' has no candle timestamps');
  const q = result.indicators?.quote?.[0];
  if (!q) throw new Error(asset.symbol + ' has no OHLC series');

  const now = Date.now();
  const raw = result.timestamp
    .map((t, i) => toCandle(asset.symbol, isDaily ? 'D1' : 'H1', t, q, i))
    .filter(Boolean)
    // Do not expose the currently forming D1/H1 bar as a completed candle.
    .filter(c => isDaily
      ? Date.parse(c.timestamp) < Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate())
      : Date.parse(c.timestamp) + 3600000 <= now);

  if (isDaily) return raw.slice(-500);

  // Build only complete UTC-aligned H4 candles from four consecutive closed H1 bars.
  const buckets = new Map();
  for (const candle of raw) {
    const t = Date.parse(candle.timestamp);
    const start = Math.floor(t / 14400000) * 14400000;
    const key = String(start);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(candle);
  }

  return Array.from(buckets.entries())
    .filter(([, bars]) => {
      if (bars.length !== 4) return false;
      bars.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
      const first = Date.parse(bars[0].timestamp);
      return bars.every((bar, index) => Date.parse(bar.timestamp) === first + index * 3600000) &&
        first === Number(bars[0] && Math.floor(first / 14400000) * 14400000);
    })
    .map(([key, bars]) => ({
      symbol: asset.symbol,
      timeframe: 'H4',
      timestamp: new Date(Number(key)).toISOString(),
      open: bars[0].open,
      high: Math.max(...bars.map(c => c.high)),
      low: Math.min(...bars.map(c => c.low)),
      close: bars[3].close,
      volume: bars.reduce((sum, c) => sum + (finite(c.volume) ? c.volume : 0), 0),
      source: 'Yahoo Finance',
      isSimulated: false
    }))
    .slice(-500);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'GET') return send(res, 405, { success: false, error: 'Method not allowed. Use GET.' });

  const requested = String(req.query?.symbols || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const unknown = requested.filter(symbol => !ASSETS.some(asset => asset.symbol === symbol));
  if (unknown.length) return send(res, 400, { success: false, error: 'Unsupported symbols: ' + unknown.join(', '), supportedSymbols: ASSETS.map(a => a.symbol) });

  const selected = requested.length ? ASSETS.filter(asset => requested.includes(asset.symbol)) : ASSETS;
  const jobs = selected.flatMap(asset => ['D1', 'H4'].map(timeframe => ({ asset, timeframe })));
  const settled = await Promise.allSettled(jobs.map(job => fetchCandles(job.asset, job.timeframe)));
  const data = {}, errors = [];
  settled.forEach((entry, index) => {
    const { asset, timeframe } = jobs[index];
    if (!data[asset.symbol]) data[asset.symbol] = { D1: [], H4: [] };
    if (entry.status === 'fulfilled') data[asset.symbol][timeframe] = entry.value;
    else errors.push({ symbol: asset.symbol, timeframe, message: String(entry.reason?.message || entry.reason).slice(0, 180) });
  });

  const series = Object.values(data).flatMap(value => [value.D1.length, value.H4.length]);
  const successfulSeries = series.filter(count => count > 0).length;
  return send(res, 200, {
    success: successfulSeries > 0,
    provider: 'Yahoo Finance chart API',
    delayed: true,
    fetchedAt: new Date().toISOString(),
    data,
    errors,
    summary: {
      symbols: selected.length,
      successfulSeries,
      totalSeries: series.length,
      unavailableSeries: series.filter(count => count === 0).length
    },
    note: 'Public market data may be delayed and is not a guaranteed real-time broker feed. H4 contains only complete four-bar groups.'
  });
}
