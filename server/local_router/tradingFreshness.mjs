import { resolveMarketAwareFreshness } from '../../src/services/trading/marketSession.js';

export const JIN_TRADING_TF_MS = Object.freeze({
  M1: 60_000,
  M5: 300_000,
  M15: 900_000,
  H1: 3_600_000,
  H4: 14_400_000,
  D1: 86_400_000,
});

export const JIN_FRESHNESS_MAX_AGE_INTERVALS = 3;

function timestampMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function resolveCandleFreshness({
  lastCandleAt = null,
  timeframe = 'M1',
  now = Date.now(),
  maxAgeIntervals = JIN_FRESHNESS_MAX_AGE_INTERVALS,
} = {}) {
  const tf = String(timeframe || 'M1').toUpperCase();
  const intervalMs = JIN_TRADING_TF_MS[tf] || JIN_TRADING_TF_MS.M1;
  const maxAgeMs = intervalMs * Math.max(1, Number(maxAgeIntervals) || JIN_FRESHNESS_MAX_AGE_INTERVALS);
  const nowMs = Number.isFinite(Number(now)) ? Number(now) : Date.now();

  if (lastCandleAt == null || lastCandleAt === '') {
    return {
      status: 'NO_DATA',
      timeframe: tf,
      lastCandleAt: null,
      ageMs: null,
      maxAgeMs,
      invalidTimestamp: false,
    };
  }

  const candleMs = timestampMs(lastCandleAt);
  if (!Number.isFinite(candleMs)) {
    return {
      status: 'STALE',
      timeframe: tf,
      lastCandleAt: null,
      ageMs: null,
      maxAgeMs,
      invalidTimestamp: true,
    };
  }

  const ageMs = nowMs - candleMs;
  const resolved = resolveMarketAwareFreshness({
    ageMs,
    maxAgeMs,
    lastCandleAt: candleMs,
    now: nowMs,
  });
  return {
    status: resolved.status,
    timeframe: tf,
    lastCandleAt: new Date(candleMs).toISOString(),
    ageMs,
    maxAgeMs,
    invalidTimestamp: false,
    marketClosed: resolved.marketClosed === true,
    marketClosedAt: resolved.marketClosedAt || null,
    sessionNote: resolved.sessionNote || null,
  };
}
