/**
 * backtest.js
 * Tahap 5 — Deterministic directional backtesting for the JINI decision engine.
 *
 * For every directional replay entry (BUY_BIAS/SELL_BIAS) it measures the
 * forward return over a configured horizon and checks whether the realized
 * direction agrees with the bias. WAIT/NO_TRADE are recorded as abstentions.
 *
 * This is deliberately descriptive:
 * - `hitRate` is directional agreement in this sample, NOT win probability.
 * - No position sizing, no orders, no execution.
 * - Forward candles must come from the XM MT5 bridge unless the run is
 *   explicitly labelled NON-XM LAB.
 */

import { DATA_INTEGRITY_STATUS } from './constants.js';
import { deepFreeze, stableStringify } from './JiniContextSnapshot.js';
import crypto from 'crypto';

export const BACKTEST_CONTRACT_VERSION = 'jini-directional-backtest-v1';

export const DEFAULT_BACKTEST_CONFIG = Object.freeze({
  horizonMs: 4 * 60 * 60 * 1000,
  flatThresholdPct: 0.02,
  allowNonXmSource: false,
});

const XM_SOURCE = 'MT5_LOCAL_BRIDGE';
const DIRECTIONAL_DECISIONS = new Set(['BUY_BIAS', 'SELL_BIAS']);

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toEpochMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function hashOf(payload) {
  try {
    return crypto.createHash('sha256').update(stableStringify(payload)).digest('hex');
  } catch (_) {
    return 'BACKTEST_HASH_GENERATION_FAILED';
  }
}

export function classifyForwardReturn(returnPct, flatThresholdPct = DEFAULT_BACKTEST_CONFIG.flatThresholdPct) {
  if (!Number.isFinite(returnPct)) return 'UNKNOWN';
  const threshold = Number.isFinite(Number(flatThresholdPct)) ? Math.abs(Number(flatThresholdPct)) : 0;
  if (returnPct > threshold) return 'UP';
  if (returnPct < -threshold) return 'DOWN';
  return 'FLAT';
}

function sideOf(decision) {
  if (decision === 'BUY_BIAS') return 'BUY';
  if (decision === 'SELL_BIAS') return 'SELL';
  return null;
}

function normalizeForwardCandles(candles) {
  if (!Array.isArray(candles)) return [];
  const normalized = [];
  for (const candle of candles) {
    const epochMs = toEpochMs(candle?.timestamp ?? candle?.time ?? candle?.epochMs);
    const close = finite(candle?.close);
    if (!Number.isFinite(epochMs) || close == null || close <= 0) continue;
    normalized.push({
      epochMs,
      timestamp: new Date(epochMs).toISOString(),
      close,
      high: finite(candle?.high),
      low: finite(candle?.low),
      source: candle?.source ?? 'UNKNOWN',
    });
  }
  normalized.sort((a, b) => a.epochMs - b.epochMs);
  return normalized;
}

function emptyMetrics() {
  return {
    total: 0,
    directional: 0,
    moved: 0,
    hits: 0,
    hitRate: null,
    hitRateIncludingFlat: null,
    flat: 0,
    censored: 0,
    abstentions: 0,
    avgForwardReturnPct: null,
    byDecision: {},
  };
}

export function computeBacktestMetrics(outcomes) {
  const metrics = emptyMetrics();
  metrics.total = outcomes.length;

  const directional = outcomes.filter((item) => item.side != null);
  metrics.directional = directional.length;

  const moved = directional.filter((item) => item.outcome === 'UP' || item.outcome === 'DOWN');
  const hits = moved.filter((item) => item.hit === true).length;
  const flat = directional.filter((item) => item.outcome === 'FLAT').length;
  const censored = directional.filter((item) => item.outcome === 'CENSORED').length;

  metrics.moved = moved.length;
  metrics.hits = hits;
  metrics.hitRate = moved.length > 0 ? round(hits / moved.length, 4) : null;
  metrics.hitRateIncludingFlat = (moved.length + flat) > 0
    ? round(hits / (moved.length + flat), 4)
    : null;
  metrics.flat = flat;
  metrics.censored = censored;
  metrics.abstentions = outcomes.filter((item) => item.outcome === 'ABSTAIN').length;

  const returns = outcomes.filter((item) => Number.isFinite(item.forwardReturnPct));
  metrics.avgForwardReturnPct = returns.length > 0
    ? round(returns.reduce((sum, item) => sum + item.forwardReturnPct, 0) / returns.length, 4)
    : null;

  for (const decision of ['BUY_BIAS', 'SELL_BIAS', 'WAIT', 'NO_TRADE']) {
    const subset = outcomes.filter((item) => item.decision === decision);
    const subsetDirectional = subset.filter((item) => item.side != null);
    const subsetMoved = subsetDirectional.filter((item) => item.outcome === 'UP' || item.outcome === 'DOWN');
    const subsetHits = subsetMoved.filter((item) => item.hit === true).length;
    metrics.byDecision[decision] = {
      total: subset.length,
      moved: subsetMoved.length,
      hits: subsetHits,
      hitRate: subsetMoved.length > 0 ? round(subsetHits / subsetMoved.length, 4) : null,
      flat: subsetDirectional.filter((item) => item.outcome === 'FLAT').length,
      censored: subsetDirectional.filter((item) => item.outcome === 'CENSORED').length,
      abstentions: subset.filter((item) => item.outcome === 'ABSTAIN').length,
    };
  }

  return metrics;
}

/**
 * Runs a directional backtest over a replay timeline.
 *
 * @param {object} input
 * @param {object} input.replay Output of replayJiniHistory.
 * @param {Array<object>} input.forwardCandles Chronological `{timestamp, close, high?, low?, source}`.
 * @param {object} [input.config]
 */
export function runDirectionalBacktest({ replay, forwardCandles, config = {} } = {}) {
  const entries = Array.isArray(replay?.entries) ? replay.entries : null;
  if (!entries) {
    throw new TypeError('runDirectionalBacktest expects a replay object with entries.');
  }

  const settings = { ...DEFAULT_BACKTEST_CONFIG, ...(config || {}) };
  settings.horizonMs = Math.max(1, Number(settings.horizonMs) || DEFAULT_BACKTEST_CONFIG.horizonMs);
  settings.flatThresholdPct = Math.abs(Number(settings.flatThresholdPct) || DEFAULT_BACKTEST_CONFIG.flatThresholdPct);

  const candles = normalizeForwardCandles(forwardCandles);
  if (candles.length === 0) {
    return deepFreeze({
      ok: false,
      code: 'FORWARD_DATA_UNAVAILABLE',
      message: 'Tidak ada candle forward yang valid; tidak ada metrik yang diklaim.',
      backtestContractVersion: BACKTEST_CONTRACT_VERSION,
      config: settings,
      outcomes: [],
      metrics: emptyMetrics(),
      flags: { entryPermission: false, executionAllowed: false, autoTrade: false },
    });
  }

  const nonXm = candles.filter((candle) => String(candle.source).toUpperCase() !== XM_SOURCE);
  if (nonXm.length > 0 && !settings.allowNonXmSource) {
    return deepFreeze({
      ok: false,
      code: 'NON_XM_FORWARD_DATA',
      message: 'Candle forward bukan dari MT5_LOCAL_BRIDGE. Gunakan --allow-non-xm hanya untuk uji mekanika (NON-XM LAB).',
      backtestContractVersion: BACKTEST_CONTRACT_VERSION,
      config: settings,
      outcomes: [],
      metrics: emptyMetrics(),
      nonXmCandles: nonXm.length,
      flags: { entryPermission: false, executionAllowed: false, autoTrade: false },
    });
  }

  const outcomes = [];

  for (const entry of entries) {
    if (!entry || entry.status !== 'EVALUATED' || !entry.decision) continue;
    const decision = entry.decision.preliminaryDecision;
    const side = sideOf(decision);
    const referencePrice = finite(entry.referencePrice);
    const base = {
      index: entry.index,
      asOf: entry.asOf,
      asOfIso: entry.asOfIso,
      decision,
      side,
      referencePrice,
    };

    if (side == null) {
      outcomes.push({
        ...base,
        outcome: 'ABSTAIN',
        hit: null,
        forwardReturnPct: null,
        reason: `${decision}_NO_DIRECTIONAL_CLAIM`,
      });
      continue;
    }

    if (referencePrice == null || referencePrice <= 0) {
      outcomes.push({
        ...base,
        outcome: 'CENSORED',
        hit: null,
        forwardReturnPct: null,
        reason: 'REFERENCE_PRICE_UNAVAILABLE',
      });
      continue;
    }

    const firstAfter = candles.find((candle) => candle.epochMs > entry.asOf);
    if (!firstAfter) {
      outcomes.push({
        ...base,
        outcome: 'CENSORED',
        hit: null,
        forwardReturnPct: null,
        reason: 'NO_FORWARD_CANDLE',
      });
      continue;
    }

    const targetMs = entry.asOf + settings.horizonMs;
    const exitCandle = candles.find((candle) => candle.epochMs >= targetMs);
    if (!exitCandle) {
      outcomes.push({
        ...base,
        outcome: 'CENSORED',
        hit: null,
        forwardReturnPct: null,
        targetAt: new Date(targetMs).toISOString(),
        reason: 'TARGET_BEYOND_DATA',
      });
      continue;
    }

    const forwardReturnPct = ((exitCandle.close - referencePrice) / referencePrice) * 100;
    const outcome = classifyForwardReturn(forwardReturnPct, settings.flatThresholdPct);
    const hit = outcome === 'UP' || outcome === 'DOWN'
      ? ((side === 'BUY' && outcome === 'UP') || (side === 'SELL' && outcome === 'DOWN'))
      : null;

    const path = candles.filter((candle) => candle.epochMs > entry.asOf && candle.epochMs <= targetMs);
    const highs = path.map((candle) => candle.high).filter((value) => Number.isFinite(value));
    const lows = path.map((candle) => candle.low).filter((value) => Number.isFinite(value));

    outcomes.push({
      ...base,
      outcome,
      hit,
      forwardReturnPct: round(forwardReturnPct, 4),
      targetAt: new Date(targetMs).toISOString(),
      exitAt: exitCandle.timestamp,
      exitClose: exitCandle.close,
      mfePct: highs.length > 0 ? round(((Math.max(...highs) - referencePrice) / referencePrice) * 100, 4) : null,
      maePct: lows.length > 0 ? round(((Math.min(...lows) - referencePrice) / referencePrice) * 100, 4) : null,
      reason: null,
    });
  }

  const metrics = computeBacktestMetrics(outcomes);
  const dataLabel = settings.allowNonXmSource ? 'NON-XM LAB' : 'XM MT5 bridge only';

  const report = {
    ok: true,
    backtestContractVersion: BACKTEST_CONTRACT_VERSION,
    dataLabel,
    config: settings,
    replayHash: replay?.replayHash ?? null,
    forwardData: {
      candles: candles.length,
      firstAt: candles[0]?.timestamp ?? null,
      lastAt: candles[candles.length - 1]?.timestamp ?? null,
      sources: [...new Set(candles.map((candle) => candle.source))].sort(),
    },
    outcomes,
    metrics,
    flags: {
      entryPermission: false,
      executionAllowed: false,
      autoTrade: false,
      isSignal: false,
      strategyApproved: false,
    },
    note: 'hitRate adalah kecocokan arah pada sampel ini, bukan probabilitas kemenangan dan bukan saran entry.',
    limitations: [
      'Backtest tidak menghitung biaya transaksi, slippage, swap, atau ukuran posisi.',
      'Horizon dan ambang flat bersifat konfigurasi analitis, bukan optimasi trading.',
      'Forward candle non-XM hanya diterima pada mode NON-XM LAB.',
      'Tidak ada order, ukuran posisi, atau auto-trading yang dihasilkan.',
    ],
  };
  report.backtestHash = hashOf(report);
  return deepFreeze(report);
}

export default runDirectionalBacktest;
