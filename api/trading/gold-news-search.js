// Vercel serverless endpoint for JIN Gold News Intelligence.
// Keep this API response JSON-shaped on every path so the client never tries to
// parse an empty or HTML response as JSON.
const send = (res, status, body) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res.status(status).json(body);
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed. Use POST.' });

  try {
    const instrument = String(req.body?.instrument || 'XAUUSD').slice(0, 20);
    const session = ['asia', 'london', 'newyork'].includes(req.body?.session) ? req.body.session : 'all';
    const apiKey = String(process.env.TAVILY_API_KEY || '').trim();
    if (!apiKey) {
      return send(res, 503, {
        success: false,
        provider: 'TAVILY_AI',
        error: 'TAVILY_API_KEY belum disetel pada Environment Variables deployment LIVE (Vercel).'
      });
    }

    const query = [
      'gold XAUUSD latest fundamental news article with explicit publication date in the last 7 days',
      'crude oil Brent WTI price change latest news OPEC supply inventory geopolitical risk inflation impact on gold',
      'US Dollar Index DXY latest change and US Treasury 10 year nominal real yields latest move impact on gold',
      'Federal Reserve rate expectations US CPI PCE inflation NFP jobs Treasury yields and central-bank gold demand',
      'silver XAGUSD copper industrial metals US equity risk sentiment and safe haven flows latest market news',
      'official economic releases and scheduled events affecting spot gold',
      session === 'all' ? '' : 'current trading session ' + session
    ].filter(Boolean).join('; ');

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        topic: 'news',
        search_depth: 'advanced',
        days: 7,
        max_results: 15,
        include_answer: false,
        include_raw_content: false
      }),
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 250);
      return send(res, 502, { success: false, provider: 'TAVILY_AI', error: 'Tavily HTTP ' + response.status + (detail ? ': ' + detail : '') });
    }

    const result = await response.json();
    const now = Date.now();
    const cutoff = now - 7 * 24 * 60 * 60 * 1000;
    const futureLimit = now + 24 * 60 * 60 * 1000;
    const seen = new Set();
    const sources = (Array.isArray(result.results) ? result.results : []).map((item) => {
      let url;
      try {
        const parsed = new URL(String(item.url || '').trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) return null;
        url = parsed.toString();
      } catch { return null; }

      // Accept only explicit Tavily publication-date metadata, not the fetch time.
      const rawDate = item.published_date ?? item.publishedDate ?? null;
      if (typeof rawDate !== 'string' || !rawDate.trim()) return null;
      const publishedMs = Date.parse(rawDate);
      if (!Number.isFinite(publishedMs) || publishedMs < cutoff || publishedMs > futureLimit || seen.has(url)) return null;
      seen.add(url);
      const parsedUrl = new URL(url);
      return {
        title: String(item.title || '').trim().slice(0, 300),
        url,
        domain: parsedUrl.hostname.replace(/^www\./, ''),
        snippet: String(item.content || '').trim().slice(0, 2000),
        score: Number.isFinite(item.score) ? item.score : null,
        publishedAt: new Date(publishedMs).toISOString(),
        publicationDateVerified: true,
        freshness: 'RECENT',
        category: 'GOLD_MARKET'
      };
    }).filter(Boolean);

    return send(res, 200, {
      success: true,
      query,
      provider: 'TAVILY_AI',
      freshnessWindowDays: 7,
      directAnswer: null,
      fetchedAt: new Date(now).toISOString(),
      instrument,
      session,
      sources,
      error: sources.length ? null : 'Tavily merespons, tetapi tidak ada artikel dengan tanggal publikasi valid dalam 7 hari terakhir. Hasil tanpa tanggal tidak ditampilkan.'
    });
  } catch (error) {
    return send(res, 502, {
      success: false,
      provider: 'TAVILY_AI',
      error: error?.message || 'Gold news search failed'
    });
  }
}
