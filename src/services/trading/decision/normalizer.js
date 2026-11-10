/**
 * normalizer.js
 * Mathematical normalization, data integrity verification, and freshness evaluation
 * for the JINI Gold Decision Engine.
 *
 * Strict Principles:
 * - Aggressor dominance formula: Buy% = V_Buy / (V_Buy + V_Sell) * 100
 * - Never claims COMEX GC tape when reading PAXG proxy.
 * - Enforces market-aware freshness for weekend/market closures.
 */

import {
  COMEX_INTEGRITY_CONTRACT,
  DATA_INTEGRITY_STATUS,
  EXECUTION_GATE_LIMITS,
  FRESHNESS_SLA_MS,
  ORDER_FLOW_VENUE,
  PROXY_INTEGRITY_CONTRACT,
} from './constants.js';
import { resolveCandleFreshness } from '../../../../server/local_router/tradingFreshness.mjs';

/**
 * Computes aggressive volume percentages strictly using Total Volume (V_Buy + V_Sell)
 * as the denominator.
 *
 * @param {number} buyVol - Aggressive Buy Volume
 * @param {number} sellVol - Aggressive Sell Volume
 * @returns {{ buyVolume: number, sellVolume: number, totalVolume: number, buyPercent: number, sellPercent: number, deltaVolume: number }}
 */
export function calculateAggressorVolumeMetrics(buyVol, sellVol) {
  const vBuy = Math.max(0, Number.isFinite(Number(buyVol)) ? Number(buyVol) : 0);
  const vSell = Math.max(0, Number.isFinite(Number(sellVol)) ? Number(sellVol) : 0);
  const totalVolume = vBuy + vSell;

  let buyPercent = 50.0;
  let sellPercent = 50.0;

  if (totalVolume > 0) {
    buyPercent = Number(((vBuy / totalVolume) * 100).toFixed(2));
    sellPercent = Number(((vSell / totalVolume) * 100).toFixed(2));
  }

  const deltaVolume = Number((vBuy - vSell).toFixed(4));

  return {
    buyVolume: vBuy,
    sellVolume: vSell,
    totalVolume: Number(totalVolume.toFixed(4)),
    buyPercent,
    sellPercent,
    deltaVolume,
  };
}

/**
 * Validates a single OHLC candle.
 */
export function isValidCandle(candle) {
  if (!candle || typeof candle !== 'object') return false;
  const o = Number(candle.open);
  const h = Number(candle.high);
  const l = Number(candle.low);
  const c = Number(candle.close);
  const v = Number(candle.volume ?? 0);
  const t = candle.timestamp ? Date.parse(candle.timestamp) : Number(candle.time || 0);

  if (!Number.isFinite(o) || !Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c)) return false;
  if (o <= 0 || h <= 0 || l <= 0 || c <= 0) return false;
  if (!Number.isFinite(t) || t <= 0) return false;
  if (!Number.isFinite(v) || v < 0) return false;

  // Strict geometrical sanity
  if (h < Math.max(o, c, l) || l > Math.min(o, c, h)) return false;

  return true;
}

/**
 * Normalizes and chronologically sorts a series of candles.
 */
export function normalizeCandleSeries(rawCandles, timeframe = 'M1') {
  if (!Array.isArray(rawCandles)) {
    return {
      timeframe,
      candles: [],
      count: 0,
      valid: false,
      reason: 'Candles payload is not an array',
    };
  }

  const validCandles = [];
  for (const c of rawCandles) {
    if (isValidCandle(c)) {
      const ts = c.timestamp ? new Date(c.timestamp).toISOString() : new Date(Number(c.time || 0)).toISOString();
      validCandles.push({
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume || 0),
        timestamp: ts,
        epochMs: Date.parse(ts),
      });
    }
  }

  validCandles.sort((a, b) => a.epochMs - b.epochMs);

  return {
    timeframe,
    candles: validCandles,
    count: validCandles.length,
    valid: validCandles.length > 0,
    lastCandle: validCandles.length > 0 ? validCandles[validCandles.length - 1] : null,
  };
}

/**
 * Normalizes tick data from XM broker bridge.
 */
export function normalizeTickData(rawTick) {
  if (!rawTick || typeof rawTick !== 'object') {
    return {
      valid: false,
      bid: null,
      ask: null,
      mid: null,
      spreadPips: null,
      spreadAcceptable: false,
      timestamp: null,
      source: 'UNKNOWN',
    };
  }

  const bid = Number(rawTick.bid);
  const ask = Number(rawTick.ask);
  const hasBid = Number.isFinite(bid) && bid > 0;
  const hasAsk = Number.isFinite(ask) && ask > 0;

  if (!hasBid || !hasAsk || ask < bid) {
    return {
      valid: false,
      bid: hasBid ? bid : null,
      ask: hasAsk ? ask : null,
      mid: null,
      spreadPips: null,
      spreadAcceptable: false,
      timestamp: rawTick.timestamp || null,
      source: rawTick.source || 'XM_GLOBAL_MT5',
    };
  }

  const mid = Number(((bid + ask) / 2).toFixed(2));
  const spread = Number((ask - bid).toFixed(2));
  const spreadAcceptable = spread <= EXECUTION_GATE_LIMITS.MAX_SPREAD_PIPS;

  return {
    valid: true,
    bid,
    ask,
    mid,
    spreadPips: spread,
    spreadAcceptable,
    timestamp: rawTick.timestamp || new Date().toISOString(),
    source: rawTick.source || 'XM_GLOBAL_MT5',
  };
}

function firstFinite(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function normalizeAbsorption(rawAbsorption) {
  if (!rawAbsorption || typeof rawAbsorption !== 'object') {
    return { status: 'UNKNOWN', side: null, note: 'Absorption tidak dilaporkan provider.' };
  }
  return {
    status: rawAbsorption.status || 'UNKNOWN',
    side: rawAbsorption.side || null,
    note: rawAbsorption.note || null,
  };
}

function normalizeEpochMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : NaN;
}

/**
 * Normalizes Order Flow with strict attribution to Binance PAXG Proxy.
 * Ensures COMEX GC status is explicitly marked UNAVAILABLE.
 *
 * Accepts both the canonical normalizer input and the real provider output of
 * server/market/goldOrderFlow.mjs (window/volume/cvd/absorption shape).
 * Every branch keeps the PAXG proxy + COMEX contract attached.
 */
export function normalizeOrderFlowSnapshot(rawPayload, now = Date.now()) {
  const unavailable = (note) => ({
    status: DATA_INTEGRITY_STATUS.UNAVAILABLE,
    proxy: { ...PROXY_INTEGRITY_CONTRACT, venue: ORDER_FLOW_VENUE.PAXG_PROXY },
    comex: COMEX_INTEGRITY_CONTRACT,
    metrics: calculateAggressorVolumeMetrics(0, 0),
    cvd: null,
    tradesCount: 0,
    lastTradeAt: null,
    ageMs: Infinity,
    freshness: DATA_INTEGRITY_STATUS.UNAVAILABLE,
    absorption: normalizeAbsorption(null),
    absorptionDetected: false,
    note,
  });

  if (!rawPayload || typeof rawPayload !== 'object') {
    return unavailable('Data order flow tidak tersedia dari provider.');
  }

  if (rawPayload.ok === false || rawPayload.status === DATA_INTEGRITY_STATUS.UNAVAILABLE) {
    return unavailable(rawPayload.error || 'Tape order flow dilaporkan UNAVAILABLE oleh provider.');
  }

  const metrics = calculateAggressorVolumeMetrics(
    firstFinite(
      rawPayload.buyVolume,
      rawPayload.metrics?.buyVolume,
      rawPayload.volume?.buyBase,
    ) ?? 0,
    firstFinite(
      rawPayload.sellVolume,
      rawPayload.metrics?.sellVolume,
      rawPayload.volume?.sellBase,
    ) ?? 0,
  );

  const tradesCount = firstFinite(
    rawPayload.tradesCount,
    rawPayload.windowTrades,
    rawPayload.window?.trades,
  ) ?? 0;

  const rawLastTradeAt = rawPayload.lastTradeAt ?? rawPayload.window?.lastTradeAt ?? null;
  const lastTradeAtMs = normalizeEpochMs(rawLastTradeAt);
  const hasTimestamp = Number.isFinite(lastTradeAtMs) && lastTradeAtMs > 0;
  const ageMs = hasTimestamp ? Math.max(0, now - lastTradeAtMs) : Infinity;

  let freshness = DATA_INTEGRITY_STATUS.UNAVAILABLE;
  if (!hasTimestamp) {
    freshness = DATA_INTEGRITY_STATUS.UNAVAILABLE;
  } else if (ageMs <= FRESHNESS_SLA_MS.ORDER_FLOW_LIVE) {
    freshness = DATA_INTEGRITY_STATUS.READY;
  } else if (ageMs <= FRESHNESS_SLA_MS.ORDER_FLOW_DELAYED) {
    freshness = DATA_INTEGRITY_STATUS.DEGRADED;
  } else {
    freshness = DATA_INTEGRITY_STATUS.STALE;
  }

  const cvdRaw = firstFinite(rawPayload.cvd, rawPayload.cvdBase);
  const cvd = cvdRaw === null ? metrics.deltaVolume : cvdRaw;

  const absorption = normalizeAbsorption(rawPayload.absorption ?? rawPayload.absorptionDetected);
  const absorptionDetected = absorption.status === 'DETECTED';

  let status;
  if (tradesCount === 0 || freshness === DATA_INTEGRITY_STATUS.UNAVAILABLE) {
    status = DATA_INTEGRITY_STATUS.UNAVAILABLE;
  } else if (tradesCount < EXECUTION_GATE_LIMITS.MIN_ORDER_FLOW_TRADES) {
    status = DATA_INTEGRITY_STATUS.DEGRADED;
  } else {
    status = freshness;
  }

  return {
    status,
    proxy: {
      ...PROXY_INTEGRITY_CONTRACT,
      venue: ORDER_FLOW_VENUE.PAXG_PROXY,
    },
    comex: COMEX_INTEGRITY_CONTRACT,
    metrics,
    cvd,
    tradesCount,
    lastTradeAt: hasTimestamp ? new Date(lastTradeAtMs).toISOString() : null,
    ageMs,
    freshness,
    absorption,
    absorptionDetected,
    note: status === DATA_INTEGRITY_STATUS.UNAVAILABLE
      ? 'Tape order flow tidak dapat diverifikasi (kosong atau tanpa timestamp).'
      : null,
  };
}

/**
 * Normalizes multi-timeframe XM candles and derives their market-aware freshness.
 */
export function normalizeMultiTimeframeCandles(rawMultiTfMap = {}, now = Date.now()) {
  const timeframes = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'];
  const normalized = {};

  for (const tf of timeframes) {
    const rawEntry = rawMultiTfMap[tf] || {};
    const candleList = Array.isArray(rawEntry) ? rawEntry : (rawEntry.candles || []);
    const series = normalizeCandleSeries(candleList, tf);
    const lastAt = series.lastCandle?.timestamp || rawEntry.lastCandleAt || null;

    const freshness = resolveCandleFreshness({
      lastCandleAt: lastAt,
      timeframe: tf,
      now,
    });

    const ready = series.count >= (tf === 'D1' ? EXECUTION_GATE_LIMITS.MIN_CANDLE_COUNT_D1 : (tf === 'M1' ? EXECUTION_GATE_LIMITS.MIN_CANDLE_COUNT_M1 : 10));

    let integrity = DATA_INTEGRITY_STATUS.READY;
    if (series.count === 0) {
      integrity = DATA_INTEGRITY_STATUS.UNAVAILABLE;
    } else if (!ready) {
      integrity = DATA_INTEGRITY_STATUS.DEGRADED;
    } else if (freshness.status === 'STALE' || freshness.status === 'NO_DATA') {
      integrity = DATA_INTEGRITY_STATUS.STALE;
    }

    normalized[tf] = {
      timeframe: tf,
      candles: series.candles,
      count: series.count,
      lastCandle: series.lastCandle,
      freshness,
      ready,
      integrity,
    };
  }

  return normalized;
}

