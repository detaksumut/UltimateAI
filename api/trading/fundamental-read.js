// Vercel serverless reader for allowlisted official macroeconomic sources.
const ALLOWED = {
  fed: { label: 'Federal Reserve', url: 'https://www.federalreserve.gov/newsevents/pressreleases.htm', host: 'www.federalreserve.gov' },
  bls: { label: 'BLS Releases', url: 'https://www.bls.gov/schedule/news_release/', host: 'www.bls.gov' },
  bea: { label: 'BEA Releases', url: 'https://www.bea.gov/news/schedule', host: 'www.bea.gov' },
  treasury: { label: 'US Treasury Yields', url: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates', host: 'home.treasury.gov' },
  cftc: { label: 'CFTC COT Reports', url: 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm', host: 'www.cftc.gov' }
};
const send = (res, status, body) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
};
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed. Use POST.' });
  try {
    const requested = Array.isArray(req.body?.sources) ? req.body.sources : Object.keys(ALLOWED);
    const selected = [...new Set(requested)].filter(key => Object.hasOwn(ALLOWED, key)).slice(0, 5);
    const sources = await Promise.all(selected.map(async key => {
      const source = ALLOWED[key];
      try {
        const response = await fetch(source.url, {
          headers: { 'User-Agent': 'UltimateAI-JIN-FundamentalReader/1.0', 'Accept': 'text/html,application/xhtml+xml' },
          signal: AbortSignal.timeout(12000),
          redirect: 'error'
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const finalUrl = new URL(response.url);
        if (finalUrl.protocol !== 'https:' || finalUrl.hostname !== source.host) throw new Error('Unexpected source host');
        const html = (await response.text()).slice(0, 1500000);
        const content = html
          .replace(/<script[\\s\\S]*?<\\/script>/gi, ' ')
          .replace(/<style[\\s\\S]*?<\\/style>/gi, ' ')
          .replace(/<(br|\\/p|\\/div|\\/li|\\/tr|\\/h[1-6])\\b[^>]*>/gi, '\\n')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
          .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
          .replace(/[ \\t]+/g, ' ').replace(/\\n\\s*\\n+/g, '\\n').trim().slice(0, 18000);
        if (content.length < 100) throw new Error('Page content too short or blocked');
        return { key, label: source.label, url: source.url, status: 'READ', httpStatus: response.status, fetchedAt: new Date().toISOString(), content };
      } catch (error) {
        return { key, label: source.label, url: source.url, status: 'SOURCE_UNAVAILABLE', fetchedAt: new Date().toISOString(), error: error?.message || 'Source unavailable' };
      }
    }));
    const readable = sources.some(source => source.status === 'READ');
    return send(res, 200, { success: true, fetchedAt: new Date().toISOString(), sources, ...(readable ? {} : { warning: 'No allowlisted official source could be read by the deployment.' }) });
  } catch (error) {
    return send(res, 500, { success: false, error: error?.message || 'Fundamental source read failed' });
  }
}
