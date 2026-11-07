/**
 * zoneDetection.js
 * Supply & Demand detection, lifecycle and scoring.
 *
 * A zone is a base (consolidation) followed by a strong departure candle.
 * - Demand: base -> bullish displacement -> proximal is the base body high,
 *   distal is the base wick low.
 * - Supply: base -> bearish displacement -> proximal is the base body low,
 *   distal is the base wick high.
 *
 * No future candles are used to decide that a zone exists. Future candles are
 * only used to update its lifecycle (FRESH / TESTED / WEAKENED / INVALID).
 */

import {
  SD_LIFECYCLE,
  SD_SIDE,
  mergeConfig,
} from './constants.js';
import { clamp } from './candleValidation.js';

function bodyOf(candle) {
  return Math.abs(candle.close - candle.open);
}

function rangeOf(candle) {
  return candle.high - candle.low;
}

function bodyRatioOf(candle) {
  const range = rangeOf(candle);
  return range > 0 ? bodyOf(candle) / range : 0;
}

export function atrSeries(candles, period = 14) {
  const n = candles.length;
  const out = new Array(n).fill(null);
  if (n === 0 || period <= 0) return out;

  const tr = new Array(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    const c = candles[i];
    if (i === 0) {
      tr[i] = c.high - c.low;
    } else {
      const prevClose = candles[i - 1].close;
      tr[i] = Math.max(
        c.high - c.low,
        Math.abs(c.high - prevClose),
        Math.abs(c.low - prevClose),
      );
    }
  }

  if (n < period) return out;

  let sum = 0;
  for (let i = 0; i < period; i += 1) sum += tr[i];
  out[period - 1] = sum / period;

  for (let i = period; i < n; i += 1) {
    out[i] = ((out[i - 1] * (period - 1)) + tr[i]) / period;
  }

  return out;
}

export function zoneOverlapRatio(a, b) {
  const overlap = Math.min(a.high, b.high) - Math.max(a.low, b.low);
  if (overlap <= 0) return 0;
  const smaller = Math.min(a.high - a.low, b.high - b.low);
  return smaller > 0 ? overlap / smaller : 0;
}

function baseQualityOf(base, atr, config) {
  if (!Number.isFinite(atr) || atr <= 0 || base.length === 0) return 0;

  let high = -Infinity;
  let low = Infinity;
  for (const candle of base) {
    high = Math.max(high, candle.high);
    low = Math.min(low, candle.low);
  }
  const baseRange = high - low;
  const baseOpen = base[0].open;
  const baseClose = base[base.length - 1].close;
  const baseBodyAtr = Math.abs(baseClose - baseOpen) / atr;

  const tightness = 1 - clamp((baseRange / atr) / Math.max(0.01, config.baseMaxRangeAtr), 0, 1);
  const compactness = 1 - clamp((base.length - 1) / Math.max(1, config.baseLookback - 1), 0, 1);
  const calmness = 1 - clamp(baseBodyAtr / Math.max(0.01, config.baseMaxBodyAtr), 0, 1);

  return clamp((0.5 * tightness) + (0.3 * compactness) + (0.2 * calmness), 0, 1);
}

export function applyLifecycle(zone, candles, endIndex, config = {}) {
  const cfg = mergeConfig(config);
  const demand = zone.side === SD_SIDE.DEMAND;
  const startIndex = zone.departureIndex + 1;
  const lastIndex = Math.min(endIndex, candles.length - 1);

  let inZone = false;
  let closeBeyondCount = 0;
  let testCount = 0;
  let heldRetestCount = 0;
  let currentTestHeld = false;
  let currentTestHadBreach = false;
  let firstTestTime = null;
  let lastTestTime = null;
  let firstTouchIndex = null;
  let invalidatedIndex = null;
  let wickBreach = false;

  for (let j = startIndex; j <= lastIndex; j += 1) {
    const candle = candles[j];
    const entered = demand
      ? candle.low <= zone.proximal
      : candle.high >= zone.proximal;

    if (!entered && inZone) {
      if (currentTestHeld) heldRetestCount += 1;
      currentTestHeld = false;
      currentTestHadBreach = false;
    }

    if (entered && !inZone) {
      testCount += 1;
      currentTestHeld = false;
      currentTestHadBreach = false;
      if (firstTestTime == null) {
        firstTestTime = candle.timestamp;
        firstTouchIndex = j;
      }
      lastTestTime = candle.timestamp;
    }
    inZone = entered;

    const closeBeyond = demand ? candle.close < zone.distal : candle.close > zone.distal;
    const wickBeyond = demand ? candle.low < zone.distal : candle.high > zone.distal;
    const invalidationTriggered = cfg.invalidationMode === 'WICK' ? wickBeyond : closeBeyond;

    if (invalidationTriggered) {
      closeBeyondCount += 1;
      if (cfg.invalidationMode === 'WICK' || closeBeyondCount >= cfg.invalidationConfirmBars) {
        zone.lifecycle = SD_LIFECYCLE.INVALID;
        zone.active = false;
        zone.invalidatedAt = candle.timestamp;
        zone.invalidatedIndex = j;
        zone.invalidReason = cfg.invalidationMode === 'WICK'
          ? 'Wick menembus distal zone (wick invalidation).'
          : 'Candle close di luar distal zone (candle-close invalidation).';
        break;
      }
    } else {
      closeBeyondCount = 0;
      if (cfg.invalidationMode === 'CLOSE' && wickBeyond) {
        wickBreach = true;
        currentTestHadBreach = true;
      }
      if (entered && !currentTestHadBreach) {
        const closedAway = demand ? candle.close > zone.proximal : candle.close < zone.proximal;
        if (closedAway) currentTestHeld = true;
      }
    }
  }

  if (inZone && currentTestHeld) heldRetestCount += 1;

  if (zone.lifecycle !== SD_LIFECYCLE.INVALID) {
    if (testCount === 0) {
      zone.lifecycle = SD_LIFECYCLE.FRESH;
    } else if (testCount === 1 && heldRetestCount === 1 && !wickBreach) {
      zone.lifecycle = SD_LIFECYCLE.TESTED;
    } else {
      zone.lifecycle = SD_LIFECYCLE.WEAKENED;
    }
  }

  zone.testCount = testCount;
  zone.heldRetestCount = heldRetestCount;
  zone.firstTestTime = firstTestTime;
  zone.lastTestTime = lastTestTime;
  zone.firstTouchIndex = firstTouchIndex;
  zone.wickBreach = wickBreach;

  if (firstTouchIndex != null) {
    const reactionEnd = Math.min(lastIndex, firstTouchIndex + cfg.reactionWindowBars);
    let best = demand ? -Infinity : Infinity;
    for (let k = firstTouchIndex; k <= reactionEnd; k += 1) {
      best = demand
        ? Math.max(best, candles[k].high)
        : Math.min(best, candles[k].low);
    }
    const excursion = demand ? best - zone.proximal : zone.proximal - best;
    zone.reactionAtr = zone.atr > 0 ? excursion / zone.atr : null;
  }

  return zone;
}

export function scoreZone(zone, config = {}) {
  const cfg = mergeConfig(config);
  const displacementRaw = clamp(
    (zone.displacementAtr - cfg.displacementAtr) / 2.5,
    0,
    1,
  );
  const bodyRaw = clamp(
    (zone.departureBodyRatio - cfg.displacementBodyRatio)
      / Math.max(0.01, 1 - cfg.displacementBodyRatio),
    0,
    1,
  );
  const bosRaw = zone.bos ? 1 : 0;
  const baseRaw = clamp(zone.baseQuality, 0, 1);
  const lifecycleRaw = zone.lifecycle === SD_LIFECYCLE.FRESH
    ? 1
    : zone.lifecycle === SD_LIFECYCLE.TESTED
      ? 0.8
      : zone.lifecycle === SD_LIFECYCLE.WEAKENED
        ? 0.3
        : 0;
  const retestRaw = zone.testCount === 0
    ? 0
    : zone.heldRetestCount > 0
      ? (zone.testCount === 1 ? 1 : 0.6)
      : 0.2;
  const widthRaw = 1 - clamp(
    (zone.widthAtr - cfg.minWidthAtr) / Math.max(0.01, cfg.maxWidthAtr - cfg.minWidthAtr),
    0,
    1,
  );
  const volumeRaw = zone.volumeValid
    ? clamp(((zone.volumeRatio ?? 0) - 0.8) / 1.2, 0, 1)
    : 0;
  const recencyRaw = clamp(zone.recency ?? 0, 0, 1);

  const factors = [
    {
      key: 'displacement',
      label: 'Kekuatan displacement (ATR)',
      weight: 20,
      raw: displacementRaw,
      points: displacementRaw * 20,
      note: `${zone.displacementAtr.toFixed(2)}x ATR`,
    },
    {
      key: 'body',
      label: 'Body ratio candle departure',
      weight: 10,
      raw: bodyRaw,
      points: bodyRaw * 10,
      note: `${(zone.departureBodyRatio * 100).toFixed(0)}% body`,
    },
    {
      key: 'bos',
      label: 'Break of Structure',
      weight: 15,
      raw: bosRaw,
      points: bosRaw * 15,
      note: zone.bos ? 'BOS terkonfirmasi' : 'Belum BOS',
    },
    {
      key: 'base',
      label: 'Kualitas base',
      weight: 15,
      raw: baseRaw,
      points: baseRaw * 15,
      note: `${zone.baseBars} candle base`,
    },
    {
      key: 'lifecycle',
      label: 'Freshness / lifecycle',
      weight: 10,
      raw: lifecycleRaw,
      points: lifecycleRaw * 10,
      note: zone.lifecycle,
    },
    {
      key: 'retest',
      label: 'Retest terkonfirmasi',
      weight: 10,
      raw: retestRaw,
      points: retestRaw * 10,
      note: zone.testCount === 0
        ? 'Belum dites (sengaja 0 poin)'
        : `${zone.testCount}x test, ${zone.heldRetestCount || 0}x tertahan`,
    },
    {
      key: 'width',
      label: 'Kerapatan zona',
      weight: 10,
      raw: widthRaw,
      points: widthRaw * 10,
      note: `${zone.widthAtr.toFixed(2)}x ATR`,
    },
    {
      key: 'volume',
      label: 'Volume departure',
      weight: 5,
      raw: volumeRaw,
      points: volumeRaw * 5,
      note: zone.volumeValid
        ? `${zone.volumeRatio.toFixed(2)}x rata-rata`
        : 'Volume tidak valid',
    },
    {
      key: 'recency',
      label: 'Kebaruan zona',
      weight: 5,
      raw: recencyRaw,
      points: recencyRaw * 5,
      note: `${zone.ageBars ?? 0} bar lalu`,
    },
  ];

  const score = Math.round(clamp(factors.reduce((sum, f) => sum + f.points, 0), 0, 100));
  const reasons = factors
    .filter((f) => f.raw >= 0.5)
    .sort((a, b) => b.points - a.points)
    .slice(0, 4)
    .map((f) => `${f.label}: ${f.note}`);

  if (zone.testCount === 0) {
    reasons.push('Zona belum dites; skor retest sengaja 0 agar tidak diinflasi.');
  }
  if (zone.lifecycle === SD_LIFECYCLE.INVALID) {
    reasons.unshift('Zona INVALID: tidak ditampilkan sebagai zona aktif.');
  }

  zone.score = score;
  zone.scoreBreakdown = factors;
  zone.reasons = reasons;
  return zone;
}

export function detectZonesForTimeframe({
  candles = [],
  symbol = 'XAUUSD',
  timeframe = 'M1',
  config = {},
  endIndex = null,
} = {}) {
  const cfg = mergeConfig(config);
  const lastIndex = Math.min(
    endIndex == null ? candles.length - 1 : endIndex,
    candles.length - 1,
  );
  if (lastIndex < cfg.atrPeriod) return [];

  const atr = atrSeries(candles, cfg.atrPeriod);
  const zones = [];

  for (let i = Math.max(cfg.atrPeriod, cfg.baseLookback, cfg.bosLookback); i <= lastIndex; i += 1) {
    const candle = candles[i];
    const atrValue = atr[i];
    if (!Number.isFinite(atrValue) || atrValue <= 0) continue;

    const body = bodyOf(candle);
    const range = rangeOf(candle);
    if (range <= 0) continue;

    const bodyRatio = body / range;
    const displacementAtr = body / atrValue;
    if (displacementAtr < cfg.displacementAtr) continue;
    if (bodyRatio < cfg.displacementBodyRatio) continue;

    const isBull = candle.close > candle.open;
    const isBear = candle.close < candle.open;
    if (!isBull && !isBear) continue;
    const side = isBull ? SD_SIDE.DEMAND : SD_SIDE.SUPPLY;

    // Build the base cluster immediately before the departure candle.
    let start = i - 1;
    let baseHigh = candles[start].high;
    let baseLow = candles[start].low;

    while (start - 1 >= 0 && (i - (start - 1)) <= cfg.baseLookback) {
      const prev = candles[start - 1];
      const nextHigh = Math.max(baseHigh, prev.high);
      const nextLow = Math.min(baseLow, prev.low);
      if (nextHigh - nextLow > cfg.baseMaxRangeAtr * atrValue) break;
      baseHigh = nextHigh;
      baseLow = nextLow;
      start -= 1;
    }

    const base = candles.slice(start, i);
    if (base.length === 0) continue;

    const baseOpen = base[0].open;
    const baseClose = base[base.length - 1].close;
    const baseBodyAtr = Math.abs(baseClose - baseOpen) / atrValue;
    if (baseBodyAtr > cfg.baseMaxBodyAtr) continue;

    const zoneHigh = Math.max(...base.map((c) => c.high));
    const zoneLow = Math.min(...base.map((c) => c.low));
    const proximal = isBull
      ? Math.max(...base.map((c) => Math.max(c.open, c.close)))
      : Math.min(...base.map((c) => Math.min(c.open, c.close)));
    const distal = isBull ? zoneLow : zoneHigh;
    const width = Math.abs(proximal - distal);

    if (width <= 0) continue;
    if (width < cfg.minWidthAtr * atrValue) continue;
    if (width > cfg.maxWidthAtr * atrValue) continue;

    // Departure must start near the base and close outside it.
    const nearBase = candle.open >= zoneLow - (atrValue * 0.5)
      && candle.open <= zoneHigh + (atrValue * 0.5);
    if (!nearBase) continue;

    const breaksBase = isBull ? candle.close > zoneHigh : candle.close < zoneLow;
    if (!breaksBase) continue;

    const bosStart = Math.max(0, start - cfg.bosLookback);
    const prior = bosStart < start ? candles.slice(bosStart, start) : [];
    const priorHigh = prior.length ? Math.max(...prior.map((c) => c.high)) : null;
    const priorLow = prior.length ? Math.min(...prior.map((c) => c.low)) : null;
    const bos = isBull
      ? (priorHigh != null && candle.close > priorHigh)
      : (priorLow != null && candle.close < priorLow);

    const volumeWindow = candles.slice(Math.max(0, i - 20), i);
    const avgVolume = volumeWindow.length
      ? volumeWindow.reduce((sum, c) => sum + (Number(c.volume) || 0), 0) / volumeWindow.length
      : 0;
    const volumeValid = candle.volume > 0 && avgVolume > 0;
    const volumeRatio = volumeValid ? candle.volume / avgVolume : null;

    const baseQuality = baseQualityOf(base, atrValue, cfg);
    const ageBars = lastIndex - i;
    const recency = clamp(1 - (ageBars / Math.max(1, cfg.recencyBars)), 0, 1);

    const zone = {
      id: `${symbol}|${timeframe}|${side}|${candle.timestamp}|${Math.round(proximal * 10000)}`,
      symbol,
      timeframe,
      side,
      high: zoneHigh,
      low: zoneLow,
      proximal,
      distal,
      proximalSource: 'BODY',
      distalSource: 'WICK',
      originIndex: start,
      baseStartIndex: start,
      baseEndIndex: i - 1,
      baseBars: base.length,
      departureIndex: i,
      originTime: candles[start].timestamp,
      departureTime: candle.timestamp,
      displacementAtr,
      departureBody: body,
      departureBodyRatio: bodyRatio,
      bos,
      bosLevel: isBull ? priorHigh : priorLow,
      baseQuality,
      atr: atrValue,
      width,
      widthAtr: width / atrValue,
      volumeValid,
      volumeRatio,
      recency,
      ageBars,
      testCount: 0,
      firstTestTime: null,
      lastTestTime: null,
      firstTouchIndex: null,
      invalidatedAt: null,
      invalidatedIndex: null,
      invalidReason: null,
      wickBreach: false,
      reactionAtr: null,
      lifecycle: SD_LIFECYCLE.FRESH,
      active: true,
      score: 0,
      scoreBreakdown: null,
      reasons: [],
    };

    applyLifecycle(zone, candles, lastIndex, cfg);
    scoreZone(zone, cfg);
    zones.push(zone);
  }

  return dedupeZones(zones, cfg);
}

export function dedupeZones(zones, config = {}) {
  const cfg = mergeConfig(config);
  const sorted = [...zones].sort((a, b) => (
    (b.score - a.score) || (b.departureIndex - a.departureIndex)
  ));
  const kept = [];

  for (const zone of sorted) {
    const duplicate = kept.find((existing) => (
      existing.side === zone.side
      && Math.abs(existing.departureIndex - zone.departureIndex) <= cfg.dedupeBars
      && zoneOverlapRatio(existing, zone) >= cfg.dedupeOverlap
    ));
    if (!duplicate) kept.push(zone);
  }

  return kept.sort((a, b) => a.departureIndex - b.departureIndex);
}

export function collectZoneOutcomes({
  candles = [],
  symbol = 'XAUUSD',
  timeframe = 'M1',
  config = {},
  endIndex = null,
} = {}) {
  const cfg = mergeConfig(config);
  const lastIndex = Math.min(
    endIndex == null ? candles.length - 1 : endIndex,
    candles.length - 1,
  );
  const zones = detectZonesForTimeframe({
    candles,
    symbol,
    timeframe,
    config: cfg,
    endIndex: lastIndex,
  });

  return zones.map((zone) => {
    const forwardBars = lastIndex - zone.departureIndex;
    const enoughForwardData = forwardBars >= Math.max(cfg.reactionWindowBars, cfg.falseZoneWindowBars) + 1;
    const touched = zone.testCount > 0;
    const reacted = Number.isFinite(zone.reactionAtr)
      && zone.reactionAtr >= cfg.reactionAtr;
    const invalid = zone.lifecycle === SD_LIFECYCLE.INVALID;
    const invalidatedAfterTouch = invalid
      && zone.firstTouchIndex != null
      && zone.invalidatedIndex != null
      && zone.invalidatedIndex >= zone.firstTouchIndex;
    const barsFromTouchToInvalidation = invalidatedAfterTouch
      ? zone.invalidatedIndex - zone.firstTouchIndex
      : null;
    const falseZone = touched
      && invalidatedAfterTouch
      && barsFromTouchToInvalidation <= cfg.falseZoneWindowBars
      && !reacted;

    return {
      zone,
      timeframe,
      side: zone.side,
      score: zone.score,
      lifecycle: zone.lifecycle,
      touched,
      reacted,
      invalid,
      falseZone,
      enoughForwardData,
      barsFromTouchToInvalidation,
    };
  });
}

function bucketOfScore(score) {
  if (score >= 75) return '75-100';
  if (score >= 60) return '60-74';
  if (score >= 40) return '40-59';
  return '0-39';
}

export function summarizeOutcomes(outcomes = [], config = {}) {
  const cfg = mergeConfig(config);
  const evaluable = outcomes.filter((o) => o.enoughForwardData);
  const total = evaluable.length;
  const touched = evaluable.filter((o) => o.touched).length;
  const reacted = evaluable.filter((o) => o.reacted).length;
  const invalid = evaluable.filter((o) => o.invalid).length;
  const falseZones = evaluable.filter((o) => o.falseZone).length;
  const censored = outcomes.length - total;

  const rate = (num, den) => (den > 0 ? num / den : null);

  const byScore = {};
  for (const label of ['0-39', '40-59', '60-74', '75-100']) {
    const rows = evaluable.filter((o) => bucketOfScore(o.score) === label);
    const rowTouched = rows.filter((o) => o.touched).length;
    const rowReacted = rows.filter((o) => o.reacted).length;
    const rowInvalid = rows.filter((o) => o.invalid).length;
    const rowFalse = rows.filter((o) => o.falseZone).length;
    byScore[label] = {
      total: rows.length,
      touched: rowTouched,
      reacted: rowReacted,
      invalid: rowInvalid,
      falseZones: rowFalse,
      reactionRate: rate(rowReacted, rowTouched),
      invalidationRate: rate(rowInvalid, rows.length),
      falseZoneRate: rate(rowFalse, rowTouched),
    };
  }

  const byLifecycle = {};
  for (const lifecycle of Object.values(SD_LIFECYCLE)) {
    const rows = evaluable.filter((o) => o.lifecycle === lifecycle);
    const rowTouched = rows.filter((o) => o.touched).length;
    const rowReacted = rows.filter((o) => o.reacted).length;
    byLifecycle[lifecycle] = {
      total: rows.length,
      touched: rowTouched,
      reacted: rowReacted,
      reactionRate: rate(rowReacted, rowTouched),
    };
  }

  return {
    total,
    censored,
    touched,
    reacted,
    invalid,
    falseZones,
    touchRate: rate(touched, total),
    reactionRate: rate(reacted, touched),
    invalidationRate: rate(invalid, total),
    falseZoneRate: rate(falseZones, touched),
    precision: rate(reacted, total),
    byScore,
    byLifecycle,
    config: {
      reactionAtr: cfg.reactionAtr,
      reactionWindowBars: cfg.reactionWindowBars,
      falseZoneWindowBars: cfg.falseZoneWindowBars,
      invalidationMode: cfg.invalidationMode,
    },
  };
}

export function runBacktestForTimeframe({
  candles = [],
  symbol = 'XAUUSD',
  timeframe = 'M1',
  config = {},
  splitRatio = 0.7,
} = {}) {
  const cfg = mergeConfig(config);
  const splitIndex = Math.floor(candles.length * clamp(splitRatio, 0.1, 0.9));

  // Dev metrics only see candles before the split. Test metrics see the full
  // forward window, but only zones whose origin is inside the test segment.
  const devOutcomes = collectZoneOutcomes({
    candles,
    symbol,
    timeframe,
    config: cfg,
    endIndex: Math.max(0, splitIndex - 1),
  }).filter((o) => o.zone.departureIndex < splitIndex);

  const testOutcomes = collectZoneOutcomes({
    candles,
    symbol,
    timeframe,
    config: cfg,
    endIndex: candles.length - 1,
  }).filter((o) => o.zone.departureIndex >= splitIndex);

  return {
    timeframe,
    symbol,
    candleCount: candles.length,
    splitIndex,
    dev: summarizeOutcomes(devOutcomes, cfg),
    test: summarizeOutcomes(testOutcomes, cfg),
    devOutcomes,
    testOutcomes,
  };
}
