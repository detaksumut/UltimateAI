/**
 * Production OHLC provider for JIN.
 * Uses GoldPrice.dev server-side API; never expose GOLDPRICE_API_KEY to the browser.
 * Free supports daily XAU history for the most recent 30 days; intraday needs a paid tier.
 * Never fabricate candles.
 */
const INTERVALS = { M5: '5m', M15: '15m', H1: '1h', H4: '4h', D1: '1d' };
const SYMBOLS = { XAUUSD: 'XAU-USD-SPOT', XAGUSD: 'XAG-USD-SPOT' };
const MS = { M5: 300000, M15: 900000, H1: 3600000, H4: 14400000, D1: 86400000 };

function send(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store, max-age=0');
  return res.json(body);
}
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(res, 405, { ok: false, error: 'method_not_allowed' });
  }
  const symbol = String(req.query?.symbol || 'XAUUSD').toUpperCase();
  const timeframe = String(req.query?.timeframe || 'M5').toUpperCase();
  const interval = INTERVALS[timeframe];
  const providerSymbol = SYMBOLS[symbol];
  const requestedLimit = Math.min(500, Math.max(1, Number.parseInt(req.query?.limit, 10) || 300));
  // Free tier only provides daily XAU bars, with a maximum 30-day lookback.
  const limit = timeframe === 'D1' ? Math.min(30, requestedLimit) : requestedLimit;
  if (!providerSymbol || !interval) {
    return send(res, 400, { ok: false, error: 'unsupported_symbol_or_timeframe', supportedSymbols: Object.keys(SYMBOLS), supportedTimeframes: Object.keys(INTERVALS) });
  }
  if (timeframe === 'D1' && symbol !== 'XAUUSD') {
    return send(res, 403, { ok: false, error: 'provider_plan_gated', source: 'GOLDPRICE_DEV', timeframe, message: 'The Free tier daily-history entitlement is documented for XAU/USD only.' });
  }
  const apiKey = process.env.GOLDPRICE_API_KEY;
  if (!apiKey) {
    return send(res, 503, { ok: false, error: 'market_data_provider_not_configured', source: 'GOLDPRICE_DEV', message: 'Set GOLDPRICE_API_KEY in the server environment. No simulated fallback is used.' });
  }
  const now = new Date();
  // Use date-only UTC bounds and a 29-day offset so the inclusive daily window
  // stays within Free's 30-day limit instead of requesting 35+ days.
  const from = timeframe === 'D1'
    ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29)).toISOString().slice(0, 10)
    : new Date(now.getTime() - MS[timeframe] * (limit + 5)).toISOString();
  const to = timeframe === 'D1'
    ? now.toISOString().slice(0, 10)
    : now.toISOString();
  const params = new URLSearchParams({ symbol: providerSymbol, interval, from, to, limit: String(limit) });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const upstream = await fetch('https://api.goldprice.dev/v1/bars?' + params.toString(), {
      headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store'
    });
    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const gated = upstream.status === 403;
      return send(res, gated ? 402 : (upstream.status === 429 ? 429 : 502), {
        ok: false, error: gated ? 'provider_plan_gated' : 'market_data_upstream_error',
        upstreamStatus: upstream.status, detail: payload.error || payload.message || null,
        source: 'GOLDPRICE_DEV', timeframe
      });
    }
    const rows = Array.isArray(payload.bars) ? payload.bars : [];
    const parsePrice = value => value === null || value === undefined || value === '' ? NaN : Number(value);
    const candles = rows.map(bar => {
      const open = parsePrice(bar.open), high = parsePrice(bar.high), low = parsePrice(bar.low), close = parsePrice(bar.close);
      const timestamp = bar.bar_start;
      if (![open, high, low, close].every(Number.isFinite) || !Number.isFinite(Date.parse(timestamp)) ||
          high < Math.max(open, close, low) || low > Math.min(open, close, high)) return null;
      return {
        symbol, timeframe, timestamp: new Date(timestamp).toISOString(),
        open, high, low, close, volume: bar.volume == null ? null : Number(bar.volume),
        source: 'GOLDPRICE_DEV', providerSymbol, isSimulated: false,
        isClosed: bar.is_closed === true, isStale: false, volumeAvailable: bar.volume != null
      };
    }).filter(Boolean).sort((a,b) => Date.parse(a.timestamp)-Date.parse(b.timestamp)).slice(-limit);
    const latest = candles.at(-1) || null;
    const ageMs = latest ? Math.max(0, Date.now()-Date.parse(latest.timestamp)) : null;
    const stale = ageMs !== null && ageMs > MS[timeframe] * 2;
    return send(res, 200, {
      ok: true, source: 'GOLDPRICE_DEV', isSimulated: false, symbol, timeframe,
      count: candles.length, candles, lastUpdated: latest?.timestamp || null,
      latestIsClosed: latest?.isClosed ?? null, isStale: stale,
      warning: candles.length < 50 && timeframe !== 'D1' ? 'insufficient_history' : (stale ? 'latest_candle_stale' : null),
      providerTierRequirements: { intraday: 'Pro tier required for 1m–4h bars', daily: 'Free tier supports XAU daily bars for the last 30 days' }
    });
  } catch (error) {
    return send(res, 502, { ok: false, error: 'market_data_provider_unreachable', source: 'GOLDPRICE_DEV', message: error?.name === 'AbortError' ? 'Provider timeout' : 'Provider request failed' });
  } finally {
    clearTimeout(timeout);
  }
}