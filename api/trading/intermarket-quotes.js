// Live intermarket quotes for JIN Gold News Intelligence.
// Yahoo Finance chart metadata is used as a public market-data fallback; quotes can be delayed
// and market availability varies by instrument. The UI must never invent missing prices.
const send = (res, status, body) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res.status(status).json(body);
};

const INSTRUMENTS = [
  { symbol: 'DXY', label: 'US Dollar Index', ticker: 'DX-Y.NYB' },
  { symbol: 'US10Y', label: 'US Treasury 10Y', ticker: '^TNX' },
  { symbol: 'BRENT', label: 'Brent crude oil', ticker: 'BZ=F' },
  { symbol: 'WTI', label: 'WTI crude oil', ticker: 'CL=F' },
  { symbol: 'XAGUSD', label: 'Silver futures proxy', ticker: 'SI=F' },
  { symbol: 'COPPER', label: 'Copper futures', ticker: 'HG=F' },
  { symbol: 'SPX', label: 'S&P 500', ticker: '^GSPC' },
  { symbol: 'USDJPY', label: 'USD/JPY', ticker: 'USDJPY=X' }
];

async function quote(item) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(item.ticker) + '?range=5d&interval=5m';
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 JIN-GoldNews/1.0' },
    signal: AbortSignal.timeout(8000),
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(item.symbol + ' provider HTTP ' + response.status);
  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  if (!result?.meta) throw new Error(item.symbol + ' quote metadata unavailable');
  const meta = result.meta;
  const price = Number(meta.regularMarketPrice);
  const previousClose = Number(meta.chartPreviousClose ?? meta.previousClose);
  if (!Number.isFinite(price)) throw new Error(item.symbol + ' price unavailable');
  const changePercent = Number.isFinite(previousClose) && previousClose !== 0
    ? ((price - previousClose) / previousClose) * 100
    : null;
  const marketState = String(meta.marketState || 'UNKNOWN');
  return {
    symbol: item.symbol,
    label: item.label,
    ticker: item.ticker,
    price,
    previousClose: Number.isFinite(previousClose) ? previousClose : null,
    changePercent: Number.isFinite(changePercent) ? changePercent : null,
    currency: meta.currency || null,
    exchange: meta.exchangeName || null,
    marketState,
    delayed: true,
    quoteAt: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
    source: 'Yahoo Finance chart metadata'
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'GET') return send(res, 405, { success: false, error: 'Method not allowed. Use GET.' });
  try {
    const settled = await Promise.allSettled(INSTRUMENTS.map(quote));
    const quotes = settled.map((item, index) => item.status === 'fulfilled'
      ? item.value
      : ({ symbol: INSTRUMENTS[index].symbol, label: INSTRUMENTS[index].label, ticker: INSTRUMENTS[index].ticker, price: null, changePercent: null, marketState: 'UNAVAILABLE', delayed: true, error: item.reason?.message || 'Quote unavailable', source: 'Yahoo Finance' }));
    return send(res, 200, {
      success: true,
      provider: 'Yahoo Finance chart metadata',
      fetchedAt: new Date().toISOString(),
      delayed: true,
      quotes,
      unavailableCount: quotes.filter(q => !Number.isFinite(q.price)).length,
      note: 'Public fallback data may be delayed and is not a guaranteed real-time exchange feed.'
    });
  } catch (error) {
    return send(res, 502, { success: false, error: error?.message || 'Intermarket quote request failed' });
  }
}
