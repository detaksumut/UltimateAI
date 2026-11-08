/**
 * xmOhlcClient.js
 * Read-only client for the local XM MT5 OHLC bridge.
 *
 * Data policy:
 * - Live zones only accept source === MT5_LOCAL_BRIDGE.
 * - If the bridge is offline and the router falls back to a non-XM feed
 *   (e.g. LIVE_MARKET_FEED), the request is rejected with NON_XM_SOURCE.
 * - No screenshot, no OANDA fallback, no synthetic OHLC for live zones.
 */

import { RouterConfig } from '../../router/RouterConfig.js';
import {
  SD_DATA_STATUS,
  SD_TIMEFRAMES,
  SD_XM_SOURCE,
} from './constants.js';
import { normalizeSymbol, normalizeTimeframe } from './candleValidation.js';

export function resolveEndpoint(endpoint) {
  return String(endpoint || RouterConfig.getEndpoint() || 'http://127.0.0.1:20200')
    .replace(/\/+$/, '');
}

function errorMessage(error) {
  if (!error) return 'Unknown error';
  if (error.name === 'AbortError') return 'Request dibatalkan / timeout.';
  return error.message || String(error);
}

async function fetchJson(url, {
  timeoutMs = 8000,
  fetchImpl = globalThis.fetch,
  signal = null,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch tidak tersedia di runtime ini.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
  }
}

export async function fetchXmOhlc({
  symbol = 'XAUUSD',
  timeframe = 'M1',
  limit = 500,
  endpoint = null,
  timeoutMs = 8000,
  allowNonXmSource = false,
  fetchImpl = globalThis.fetch,
  signal = null,
} = {}) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const normalizedTimeframe = normalizeTimeframe(timeframe);

  if (!SD_TIMEFRAMES.includes(normalizedTimeframe)) {
    return {
      ok: false,
      code: SD_DATA_STATUS.TIMEFRAME_MISMATCH,
      message: `Timeframe ${timeframe} tidak didukung engine Phase 1.`,
    };
  }

  const base = resolveEndpoint(endpoint);
  const url = `${base}/api/trading/ohlc?symbol=${encodeURIComponent(normalizedSymbol)}`
    + `&timeframe=${encodeURIComponent(normalizedTimeframe)}`
    + `&limit=${Math.min(500, Math.max(1, Number(limit) || 500))}`;

  try {
    const payload = await fetchJson(url, { timeoutMs, fetchImpl, signal });
    if (!payload || payload.ok !== true) {
      return {
        ok: false,
        code: SD_DATA_STATUS.FETCH_FAILED,
        message: payload?.error || 'Endpoint OHLC mengembalikan respons gagal.',
        endpoint: base,
        url,
      };
    }

    const source = String(payload.source || '').toUpperCase();
    if (source !== SD_XM_SOURCE && !allowNonXmSource) {
      return {
        ok: false,
        code: SD_DATA_STATUS.NON_XM_SOURCE,
        source: source || null,
        message: 'Sumber OHLC bukan XM MT5 bridge. Fallback non-XM (mis. Yahoo/OANDA) ditolak agar zona tidak dibuat dari feed yang salah.',
        endpoint: base,
        url,
        raw: payload,
      };
    }

    if (normalizeSymbol(payload.symbol) !== normalizedSymbol) {
      return {
        ok: false,
        code: SD_DATA_STATUS.SYMBOL_MISMATCH,
        message: `Simbol respons (${payload.symbol}) tidak cocok dengan ${normalizedSymbol}.`,
        endpoint: base,
        url,
        raw: payload,
      };
    }

    if (normalizeTimeframe(payload.timeframe) !== normalizedTimeframe) {
      return {
        ok: false,
        code: SD_DATA_STATUS.TIMEFRAME_MISMATCH,
        message: `Timeframe respons (${payload.timeframe}) tidak cocok dengan ${normalizedTimeframe}.`,
        endpoint: base,
        url,
        raw: payload,
      };
    }

    const freshness = String(payload.freshness || 'NO_DATA').toUpperCase();
    if (freshness !== 'FRESH') {
      return {
        ok: false,
        code: freshness === 'STALE' ? SD_DATA_STATUS.STALE : SD_DATA_STATUS.DATA_UNAVAILABLE,
        source,
        freshness,
        lastUpdate: payload.lastUpdate || null,
        lastCandleAt: payload.lastCandleAt || null,
        lastTickAt: payload.lastTickAt || null,
        lastReceivedAt: payload.lastReceivedAt || null,
        message: freshness === 'STALE'
          ? 'Candle XM sudah kedaluwarsa (STALE). Data tidak dipakai untuk analisis baru.'
          : 'Candle XM belum tersedia untuk timeframe ini.',
        endpoint: base,
        url,
        raw: payload,
      };
    }

    const candles = Array.isArray(payload.candles) ? payload.candles : [];
    return {
      ok: true,
      code: SD_DATA_STATUS.READY,
      symbol: normalizedSymbol,
      timeframe: normalizedTimeframe,
      source,
      isXmValidated: source === SD_XM_SOURCE,
      freshness,
      tick: payload.tick || null,
      count: candles.length,
      candles,
      lastUpdate: payload.lastUpdate || null,
      lastCandleAt: payload.lastCandleAt || null,
      lastTickAt: payload.lastTickAt || null,
      lastReceivedAt: payload.lastReceivedAt || null,
      endpoint: base,
      url,
      raw: payload,
    };
  } catch (error) {
    return {
      ok: false,
      code: SD_DATA_STATUS.FETCH_FAILED,
      message: `Gagal mengambil OHLC XM: ${errorMessage(error)}`,
      endpoint: base,
      url,
    };
  }
}

export async function fetchXmOhlcMulti({
  symbol = 'XAUUSD',
  timeframes = SD_TIMEFRAMES,
  limit = 500,
  endpoint = null,
  timeoutMs = 8000,
  allowNonXmSource = false,
  fetchImpl = globalThis.fetch,
  signal = null,
} = {}) {
  const requested = [...new Set((timeframes || []).map((tf) => normalizeTimeframe(tf)))]
    .filter((tf) => SD_TIMEFRAMES.includes(tf));

  const results = await Promise.all(requested.map(async (timeframe) => [
    timeframe,
    await fetchXmOhlc({
      symbol,
      timeframe,
      limit,
      endpoint,
      timeoutMs,
      allowNonXmSource,
      fetchImpl,
      signal,
    }),
  ]));

  const payloads = {};
  const failures = {};
  for (const [timeframe, result] of results) {
    if (result.ok) {
      payloads[timeframe] = {
        source: result.source,
        candles: result.candles,
        tick: result.tick,
        freshness: result.freshness,
        raw: result.raw,
      };
    } else {
      failures[timeframe] = result;
    }
  }

  return {
    ok: Object.keys(payloads).length > 0,
    endpoint: resolveEndpoint(endpoint),
    symbol: normalizeSymbol(symbol),
    payloads,
    failures,
    results: Object.fromEntries(results),
  };
}

export async function fetchXmBridgeStatus({
  symbol = 'XAUUSD',
  endpoint = null,
  timeoutMs = 5000,
  fetchImpl = globalThis.fetch,
  signal = null,
} = {}) {
  const base = resolveEndpoint(endpoint);
  const normalizedSymbol = normalizeSymbol(symbol);
  const url = `${base}/api/trading/ohlc/status?symbol=${encodeURIComponent(normalizedSymbol)}`;

  try {
    const payload = await fetchJson(url, { timeoutMs, fetchImpl, signal });
    const timeframes = payload?.timeframes || {};
    const online = Object.values(timeframes).some(
      (entry) => Number(entry?.count) > 0 && String(entry?.freshness || '').toUpperCase() === 'FRESH',
    );
    return {
      ok: payload?.ok === true,
      online,
      source: payload?.source || null,
      symbol: payload?.symbol || normalizedSymbol,
      timeframes,
      tick: payload?.tick || null,
      endpoint: base,
      raw: payload,
    };
  } catch (error) {
    return {
      ok: false,
      online: false,
      source: null,
      symbol: normalizedSymbol,
      timeframes: {},
      tick: null,
      endpoint: base,
      message: errorMessage(error),
    };
  }
}
