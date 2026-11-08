// JIN GOLD ORDER FLOW — real aggressor-side tape for the Broker Workspace tab.
// Provider and calculation live in server/market/*; this handler only adapts HTTP.
import { fetchGoldOrderFlow } from '../../server/market/goldOrderFlow.mjs';

const CACHE_MS = 15_000;
const cache = { at: 0, payload: null };

const send = (res, status, body) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res.status(status).json(body);
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed. Use GET.' });

  const now = Date.now();
  let forceRefresh = false;
  try {
    const requestUrl = new URL(req.url || '', 'http://127.0.0.1');
    const flag = String(requestUrl.searchParams.get('refresh') || '').toLowerCase();
    forceRefresh = flag === '1' || flag === 'true';
  } catch (_) {
    forceRefresh = false;
  }

  if (!forceRefresh && cache.payload && now - cache.at < CACHE_MS) {
    return send(res, 200, {
      ...cache.payload,
      cached: true,
      cacheAgeMs: now - cache.at,
      forceRefresh: false,
    });
  }

  try {
    const payload = await fetchGoldOrderFlow({ now });
    cache.at = now;
    cache.payload = payload;
    return send(res, 200, {
      ...payload,
      cached: false,
      cacheAgeMs: 0,
      forceRefresh,
    });
  } catch (error) {
    return send(res, 502, {
      ok: false,
      status: 'UNAVAILABLE',
      error: error?.message || 'Gold order flow request failed.',
      generatedAt: new Date(now).toISOString(),
      noSimulatedData: true,
    });
  }
}
