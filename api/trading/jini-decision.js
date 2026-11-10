// JINI DECISION ENGINE — live endpoint for the Broker Workspace tab.
// Providers and the pure engine live elsewhere; this handler only fetches the
// panel sources, composes the snapshot, and adapts HTTP. It never executes.
import { fetchXmOhlcMulti, fetchXmBridgeStatus } from '../../src/services/trading/supplyDemand/xmOhlcClient.js';
import { composeJiniDecision } from '../../src/services/trading/decision/liveDecision.js';
import { createSourceCache, withTimeout } from '../../src/services/trading/decision/sourceCache.js';
import { fetchGoldOrderFlow } from '../../server/market/goldOrderFlow.mjs';
import { fetchGoldIntermarketFactors } from '../../server/market/intermarketGoldService.mjs';

// TTLs sit below each provider SLA so a cached payload can never be presented
// as fresher than it is. Freshness is always recomputed at composition time.
const SOURCE_TTL_MS = Object.freeze({
  xm: 15_000,
  bridge: 10_000,
  orderFlow: 45_000,
  intermarket: 120_000,
});
const SOURCE_TIMEOUT_MS = Object.freeze({
  xm: 8_000,
  bridge: 5_000,
  orderFlow: 15_000,
  intermarket: 20_000,
});

const sourceCache = createSourceCache();

const send = (res, status, body) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res.status(status).json(body);
};

function localEndpoint() {
  const port = parseInt(process.env.LOCAL_ROUTER_PORT || '20200', 10);
  return `http://127.0.0.1:${Number.isFinite(port) ? port : 20200}`;
}

async function loadSource({ key, ttlMs, timeoutMs, loader, force = false }) {
  try {
    return await sourceCache.load(key, {
      ttlMs,
      force,
      loader: () => withTimeout(loader(), timeoutMs, key),
    });
  } catch (error) {
    return {
      value: null,
      cache: {
        hit: false,
        deduped: false,
        ageMs: 0,
        fetchedAt: new Date().toISOString(),
        error: error?.message || `${key} failed`,
      },
    };
  }
}

function summarizeCache(results) {
  const entries = {};
  let anyHit = false;
  let maxAgeMs = 0;
  for (const [key, result] of Object.entries(results)) {
    const cache = result.cache || {};
    entries[key] = cache;
    if (cache.hit) anyHit = true;
    if (Number.isFinite(cache.ageMs)) maxAgeMs = Math.max(maxAgeMs, cache.ageMs);
  }
  return { sources: entries, cached: anyHit, cacheAgeMs: maxAgeMs };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed. Use GET.' });

  const requestedAt = Date.now();
  let forceRefresh = false;
  let symbol = 'XAUUSD';
  try {
    const requestUrl = new URL(req.url || '', 'http://127.0.0.1');
    const flag = String(requestUrl.searchParams.get('refresh') || '').toLowerCase();
    forceRefresh = flag === '1' || flag === 'true';
    symbol = String(requestUrl.searchParams.get('symbol') || 'XAUUSD').toUpperCase();
  } catch (_) {
    forceRefresh = false;
  }

  const endpoint = localEndpoint();

  try {
    const [xmResult, bridgeResult, orderFlowResult, intermarketResult] = await Promise.all([
      loadSource({
        key: `xm:${symbol}`,
        ttlMs: SOURCE_TTL_MS.xm,
        timeoutMs: SOURCE_TIMEOUT_MS.xm,
        force: forceRefresh,
        loader: () => fetchXmOhlcMulti({
          symbol,
          timeframes: ['M1', 'M5', 'M15', 'H1', 'H4'],
          includeDaily: true,
          endpoint,
          timeoutMs: SOURCE_TIMEOUT_MS.xm,
        }),
      }),
      loadSource({
        key: `bridge:${symbol}`,
        ttlMs: SOURCE_TTL_MS.bridge,
        timeoutMs: SOURCE_TIMEOUT_MS.bridge,
        force: forceRefresh,
        loader: () => fetchXmBridgeStatus({ symbol, endpoint, timeoutMs: SOURCE_TIMEOUT_MS.bridge }),
      }),
      loadSource({
        key: 'orderFlow:PAXGUSDT',
        ttlMs: SOURCE_TTL_MS.orderFlow,
        timeoutMs: SOURCE_TIMEOUT_MS.orderFlow,
        force: forceRefresh,
        loader: () => fetchGoldOrderFlow({ now: Date.now() }),
      }),
      loadSource({
        key: 'intermarket:XAUUSD',
        ttlMs: SOURCE_TTL_MS.intermarket,
        timeoutMs: SOURCE_TIMEOUT_MS.intermarket,
        force: forceRefresh,
        loader: () => fetchGoldIntermarketFactors({ now: Date.now() }),
      }),
    ]);

    const composedAt = Date.now();
    const result = composeJiniDecision({
      xmMulti: xmResult.value,
      orderFlow: orderFlowResult.value,
      intermarket: intermarketResult.value,
      bridge: bridgeResult.value,
      now: composedAt,
    });

    const cacheSummary = summarizeCache({
      xm: xmResult,
      bridge: bridgeResult,
      orderFlow: orderFlowResult,
      intermarket: intermarketResult,
    });

    const payload = {
      ...result,
      generatedAt: new Date(composedAt).toISOString(),
      requestedAt: new Date(requestedAt).toISOString(),
      symbol,
      dataFeePolicy: 'real providers only; missing sources stay UNAVAILABLE',
      disclaimer: 'Bias bukan izin entry. Engine tidak pernah memberi execution permission otomatis.',
      noSimulatedData: true,
      sourceCache: cacheSummary.sources,
    };

    return send(res, 200, {
      ...payload,
      cached: cacheSummary.cached,
      cacheAgeMs: cacheSummary.cacheAgeMs,
      forceRefresh,
    });
  } catch (error) {
    return send(res, 502, {
      ok: false,
      status: 'UNAVAILABLE',
      error: error?.message || 'JINI decision request failed.',
      generatedAt: new Date(requestedAt).toISOString(),
      entryPermission: false,
      executionAllowed: false,
      autoTrade: false,
      isSignal: false,
      strategyApproved: false,
      noSimulatedData: true,
    });
  }
}
