// Public fundamental-news context for JIN Cross-Asset Monitor.
// Uses Yahoo Finance public search headlines; results may be delayed/incomplete and are not trading advice.
const THEMES = {
  GOLD: { query: 'gold prices Federal Reserve inflation Treasury yields geopolitical risk', symbols: ['XAUUSD', 'XAGUSD'] },
  USD_RATES: { query: 'US dollar index Federal Reserve Treasury yields inflation economic data', symbols: ['DXY', 'US10Y', 'US02Y', 'USDJPY', 'EURUSD', 'USDCHF'] },
  OIL: { query: 'WTI crude oil prices OPEC supply geopolitical risk', symbols: ['USOIL'] },
  COPPER: { query: 'copper prices China demand manufacturing supply', symbols: ['HG'] },
  RISK: { query: 'S&P 500 stocks risk sentiment Bitcoin cryptocurrency markets', symbols: ['SPX500', 'BTCUSDT'] },
};

const send = (res, status, body) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.status(status).json(body);
};

async function searchNews(theme, config) {
  const url = 'https://query1.finance.yahoo.com/v1/finance/search?q=' +
    encodeURIComponent(config.query) + '&newsCount=6&quotesCount=0&enableFuzzyQuery=false';
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 JIN-Fundamental/1.0' },
      signal: AbortSignal.timeout(7000),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('News provider HTTP ' + response.status);
    const payload = await response.json();
    const news = (Array.isArray(payload.news) ? payload.news : []).slice(0, 6).map(item => ({
      title: String(item.title || '').slice(0, 240),
      publisher: String(item.publisher || 'Yahoo Finance').slice(0, 80),
      link: typeof item.link === 'string' ? item.link : null,
      publishedAt: Number.isFinite(item.providerPublishTime)
        ? new Date(item.providerPublishTime * 1000).toISOString() : null,
    })).filter(item => item.title);
    return { theme, symbols: config.symbols, news, error: news.length ? null : 'Tidak ada berita yang tersedia dari penyedia.' };
  } catch (error) {
    return { theme, symbols: config.symbols, news: [], error: String(error?.message || error).slice(0, 180) };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Use GET.' });
  const results = await Promise.all(Object.entries(THEMES).map(([theme, config]) => searchNews(theme, config)));
  const analyses = {};
  for (const result of results) {
    for (const symbol of result.symbols) {
      analyses[symbol] = {
        theme: result.theme,
        headlines: result.news,
        error: result.error,
      };
    }
  }
  return send(res, 200, {
    ok: true,
    source: 'Yahoo Finance News Search',
    delayed: true,
    fetchedAt: new Date().toISOString(),
    analyses,
    note: 'Headlines are public and may be delayed, incomplete, or not directly relevant. Analysis is contextual, not a guaranteed causal signal.',
  });
}
