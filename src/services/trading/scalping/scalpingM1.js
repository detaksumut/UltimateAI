/**
 * scalpingM1.js
 * JIN SCALPING - M1 analysis layer.
 *
 * Scope: M1 context, validated XM OHLC metrics, M1 supply/demand context,
 * higher-timeframe context, and PREVIEW-ONLY scenario levels.
 *
 * This module never produces BUY/SELL signals, never changes strategy, and
 * never submits orders. Strategy approval is explicitly false until the
 * scalping rules are approved by the user.
 */

import {
  SD_DATA_STATUS,
  SD_SIDE,
  mergeConfig,
} from '../supplyDemand/constants.js';
import { validateCandleSeries } from '../supplyDemand/candleValidation.js';
import { atrSeries, zoneOverlapRatio } from '../supplyDemand/zoneDetection.js';
import { pickNearestZone } from '../supplyDemand/confluence.js';
import { analyzeSupplyDemand } from '../supplyDemand/SupplyDemandEngine.js';

export const SCALPING_M1_TIMEFRAMES = ['M1', 'M5', 'M15', 'H1', 'H4'];
export const SCALPING_CONTEXT_TIMEFRAMES = ['M5', 'M15', 'H1', 'H4'];

export const SCALPING_M1_DEFAULT_CONFIG = Object.freeze({
  ...mergeConfig(),
  emaFast: 9,
  emaSlow: 21,
  adxPeriod: 14,
  efficiencyPeriod: 20,
  trendSlopeAtr: 0.05,
  adxTrending: 25,
  adxRanging: 20,
  erTrending: 0.35,
  erRanging: 0.2,
  volatilityLookback: 100,
  volatilityMinSamples: 20,
  volatilityLowPct: 0.33,
  volatilityHighPct: 0.67,
  maxSpreadAtrRatio: 0.35,
  contextNearAtr: 1.5,
  contextAlignAtr: 0.75,
  maxContextZones: 10,
  slBufferAtr: 0.2,
  minRR: 1.5,
  defaultRR: 2,
});

export function mergeScalpingConfig(overrides = {}) {
  return { ...SCALPING_M1_DEFAULT_CONFIG, ...(overrides || {}) };
}

export const SCALPING_DATA_SOURCES = Object.freeze({
  trend: 'M1 OHLC XM (MT5_LOCAL_BRIDGE) - EMA 9/21 + ADX(14)',
  marketCondition: 'M1 OHLC XM (MT5_LOCAL_BRIDGE) - ADX(14) + efficiency ratio(20)',
  spread: 'XM tick bid/ask dari MT5 bridge (MT5_LOCAL_BRIDGE)',
  volatility: 'M1 OHLC XM (MT5_LOCAL_BRIDGE) - ATR(14) percentile',
  supplyDemandM1: 'S&D Engine Phase 1 - M1 OHLC XM (MT5_LOCAL_BRIDGE)',
  higherTimeframeContext: 'S&D Engine Phase 1 - M5/M15/H1/H4 OHLC XM (MT5_LOCAL_BRIDGE)',
  entrySlTpRr: 'Turunan zona M1 + buffer ATR; PREVIEW ONLY, bukan sinyal',
  setupStatus: 'Aturan strategi scalping belum disetujui; tidak ada sinyal atau auto-order',
});

function lastFinite(values = []) {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (Number.isFinite(values[i])) return values[i];
  }
  return null;
}

export function ema(values = [], period = 9) {
  const n = values.length;
  const out = new Array(n).fill(null);
  if (n === 0 || period <= 0 || n < period) return out;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i += 1) sum += Number(values[i]);
  out[period - 1] = sum / period;
  for (let i = period; i < n; i += 1) {
    out[i] = (Number(values[i]) * k) + (out[i - 1] * (1 - k));
  }
  return out;
}

export function efficiencyRatio(values = [], period = 20) {
  if (values.length < period + 1) return null;
  const slice = values.slice(-(period + 1)).map(Number);
  let path = 0;
  for (let i = 1; i < slice.length; i += 1) path += Math.abs(slice[i] - slice[i - 1]);
  const change = Math.abs(slice[slice.length - 1] - slice[0]);
  return path > 0 ? change / path : 0;
}

export function adxSeries(candles = [], period = 14) {
  const n = candles.length;
  const out = new Array(n).fill(null);
  if (n < period * 2 || period <= 0) return out;

  const tr = new Array(n).fill(0);
  const plusDM = new Array(n).fill(0);
  const minusDM = new Array(n).fill(0);

  for (let i = 1; i < n; i += 1) {
    const current = candles[i];
    const previous = candles[i - 1];
    tr[i] = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close),
    );
    const up = current.high - previous.high;
    const down = previous.low - current.low;
    plusDM[i] = up > down && up > 0 ? up : 0;
    minusDM[i] = down > up && down > 0 ? down : 0;
  }

  let trSum = 0;
  let plusSum = 0;
  let minusSum = 0;
  for (let i = 1; i <= period; i += 1) {
    trSum += tr[i];
    plusSum += plusDM[i];
    minusSum += minusDM[i];
  }

  const dxRows = [];
  const pushDx = (index) => {
    const plusDI = trSum > 0 ? (100 * plusSum) / trSum : 0;
    const minusDI = trSum > 0 ? (100 * minusSum) / trSum : 0;
    const diSum = plusDI + minusDI;
    dxRows.push({
      index,
      value: diSum > 0 ? (100 * Math.abs(plusDI - minusDI)) / diSum : 0,
    });
  };

  pushDx(period);
  for (let i = period + 1; i < n; i += 1) {
    trSum = trSum - (trSum / period) + tr[i];
    plusSum = plusSum - (plusSum / period) + plusDM[i];
    minusSum = minusSum - (minusSum / period) + minusDM[i];
    pushDx(i);
  }

  if (dxRows.length < period) return out;

  let adx = 0;
  for (let i = 0; i < period; i += 1) adx += dxRows[i].value;
  adx /= period;
  out[dxRows[period - 1].index] = adx;

  for (let i = period; i < dxRows.length; i += 1) {
    adx = ((adx * (period - 1)) + dxRows[i].value) / period;
    out[dxRows[i].index] = adx;
  }

  return out;
}

export function classifyTrend(candles = [], config = {}) {
  const cfg = mergeScalpingConfig(config);
  const base = {
    available: false,
    trend: 'UNKNOWN',
    condition: 'UNKNOWN',
    close: null,
    emaFast: null,
    emaSlow: null,
    emaSlopeAtr: null,
    adx: null,
    efficiencyRatio: null,
    atr: null,
    reasons: [],
    dataSource: SCALPING_DATA_SOURCES.trend,
  };

  if (!Array.isArray(candles) || candles.length < Math.max(cfg.emaSlow + 2, cfg.atrPeriod + 1)) {
    return { ...base, reasons: ['Candle M1 belum cukup untuk menghitung trend.'] };
  }

  const closes = candles.map((candle) => Number(candle.close));
  const emaFastSeries = ema(closes, cfg.emaFast);
  const emaSlowSeries = ema(closes, cfg.emaSlow);
  const emaFast = lastFinite(emaFastSeries);
  const emaSlow = lastFinite(emaSlowSeries);
  const atrValues = atrSeries(candles, cfg.atrPeriod);
  const atr = lastFinite(atrValues);
  const adxValues = adxSeries(candles, cfg.adxPeriod);
  const adx = lastFinite(adxValues);
  const er = efficiencyRatio(closes, cfg.efficiencyPeriod);

  if (emaFast == null || emaSlow == null || atr == null || atr <= 0) {
    return { ...base, reasons: ['EMA/ATR M1 belum valid.'] };
  }

  const close = closes[closes.length - 1];
  const emaSlopeAtr = (emaFast - emaSlow) / atr;
  let trend = 'SIDEWAYS';
  if (emaFast > emaSlow && close > emaSlow && emaSlopeAtr > cfg.trendSlopeAtr) {
    trend = 'BULLISH';
  } else if (emaFast < emaSlow && close < emaSlow && emaSlopeAtr < -cfg.trendSlopeAtr) {
    trend = 'BEARISH';
  }

  let condition = 'TRANSITION';
  if (adx != null) {
    condition = adx >= cfg.adxTrending ? 'TRENDING' : adx <= cfg.adxRanging ? 'RANGING' : 'TRANSITION';
  } else if (er != null) {
    condition = er >= cfg.erTrending ? 'TRENDING' : er <= cfg.erRanging ? 'RANGING' : 'TRANSITION';
  }

  const reasons = [
    `EMA ${cfg.emaFast}=${emaFast.toFixed(3)}, EMA ${cfg.emaSlow}=${emaSlow.toFixed(3)}`,
    `Slope EMA ${emaSlopeAtr.toFixed(2)} ATR`,
    adx != null ? `ADX ${adx.toFixed(1)}` : 'ADX belum tersedia',
    er != null ? `Efficiency ratio ${er.toFixed(2)}` : 'Efficiency ratio belum tersedia',
  ];

  return {
    available: true,
    trend,
    condition,
    close,
    emaFast,
    emaSlow,
    emaSlopeAtr,
    adx,
    efficiencyRatio: er,
    atr,
    reasons,
    dataSource: SCALPING_DATA_SOURCES.trend,
  };
}

export function classifyVolatility(atrValues = [], currentAtr = null, config = {}) {
  const cfg = mergeScalpingConfig(config);
  const finite = atrValues.filter((value) => Number.isFinite(value) && value >= 0);
  if (!Number.isFinite(currentAtr) || currentAtr <= 0 || finite.length < cfg.volatilityMinSamples) {
    return {
      available: false,
      level: 'UNKNOWN',
      atr: Number.isFinite(currentAtr) ? currentAtr : null,
      percentile: null,
      average: null,
      ratio: null,
      dataSource: SCALPING_DATA_SOURCES.volatility,
    };
  }

  const recent = finite.slice(-cfg.volatilityLookback);
  const average = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  const percentile = recent.filter((value) => value <= currentAtr).length / recent.length;
  const level = percentile <= cfg.volatilityLowPct
    ? 'LOW'
    : percentile >= cfg.volatilityHighPct
      ? 'HIGH'
      : 'NORMAL';

  return {
    available: true,
    level,
    atr: currentAtr,
    percentile,
    average,
    ratio: average > 0 ? currentAtr / average : null,
    dataSource: SCALPING_DATA_SOURCES.volatility,
  };
}

export function computeSpread(tick, atr = null, config = {}) {
  const cfg = mergeScalpingConfig(config);
  const bid = Number(tick?.bid);
  const ask = Number(tick?.ask);
  if (!tick || !Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask < bid) {
    return {
      available: false,
      status: 'UNAVAILABLE',
      bid: null,
      ask: null,
      spread: null,
      spreadPctOfAtr: null,
      reason: 'Tick bid/ask XM belum tersedia.',
      dataSource: SCALPING_DATA_SOURCES.spread,
    };
  }

  const spread = ask - bid;
  const spreadPctOfAtr = Number.isFinite(atr) && atr > 0 ? spread / atr : null;
  const status = spreadPctOfAtr != null && spreadPctOfAtr > cfg.maxSpreadAtrRatio ? 'WIDE' : 'NORMAL';

  return {
    available: true,
    status,
    bid,
    ask,
    spread,
    spreadPctOfAtr,
    reason: status === 'WIDE' ? 'Spread melebar relatif terhadap ATR M1.' : 'Spread dalam batas ATR M1.',
    dataSource: SCALPING_DATA_SOURCES.spread,
  };
}

function zoneDistanceToPrice(zone, price) {
  if (!Number.isFinite(price)) return null;
  if (price >= zone.low && price <= zone.high) return 0;
  return Math.min(Math.abs(price - zone.low), Math.abs(price - zone.high));
}

function contextZoneSummary(zone, timeframe, price, atrM1) {
  const distance = zoneDistanceToPrice(zone, price);
  const distanceAtr = Number.isFinite(distance) && Number.isFinite(atrM1) && atrM1 > 0
    ? distance / atrM1
    : null;
  return {
    id: zone.id,
    timeframe,
    side: zone.side,
    proximal: zone.proximal,
    distal: zone.distal,
    high: zone.high,
    low: zone.low,
    score: zone.score,
    lifecycle: zone.lifecycle,
    testCount: zone.testCount,
    heldRetestCount: zone.heldRetestCount,
    distance,
    distanceAtr,
    relation: distance === 0 ? 'INSIDE' : 'NEAR',
    dataSource: SCALPING_DATA_SOURCES.higherTimeframeContext,
  };
}

export function buildHigherTimeframeContext({
  analysis,
  currentPrice,
  atrM1,
  config = {},
} = {}) {
  const cfg = mergeScalpingConfig(config);
  const price = Number(currentPrice);
  const zones = [];

  for (const timeframe of SCALPING_CONTEXT_TIMEFRAMES) {
    const entry = analysis?.timeframes?.[timeframe];
    if (!entry?.ok) continue;
    for (const zone of entry.activeZones || []) {
      const summary = contextZoneSummary(zone, timeframe, price, atrM1);
      if (summary.distanceAtr != null && summary.distanceAtr > cfg.contextNearAtr) continue;
      zones.push(summary);
    }
  }

  zones.sort((a, b) => {
    const da = Number.isFinite(a.distanceAtr) ? a.distanceAtr : Infinity;
    const db = Number.isFinite(b.distanceAtr) ? b.distanceAtr : Infinity;
    return (da - db) || (b.score - a.score);
  });
  const limited = zones.slice(0, cfg.maxContextZones);

  const m1Zones = analysis?.timeframes?.M1?.activeZones || [];
  const m1Demand = pickNearestZone(m1Zones, SD_SIDE.DEMAND, price);
  const m1Supply = pickNearestZone(m1Zones, SD_SIDE.SUPPLY, price);
  const m1Candidates = [m1Demand, m1Supply].filter(Boolean);
  m1Candidates.sort((a, b) => {
    const da = Number.isFinite(a.distance) ? a.distance : Infinity;
    const db = Number.isFinite(b.distance) ? b.distance : Infinity;
    return da - db;
  });
  const nearestM1 = m1Candidates[0] || null;

  const aligned = [];
  const conflicting = [];
  if (nearestM1) {
    for (const contextZone of limited) {
      const overlap = zoneOverlapRatio(nearestM1, contextZone);
      const near = contextZone.distanceAtr != null && contextZone.distanceAtr <= cfg.contextAlignAtr;
      if (overlap > 0 || near) {
        if (contextZone.side === nearestM1.side) aligned.push(contextZone);
        else conflicting.push(contextZone);
      }
    }
  }

  const sync = conflicting.length > 0
    ? 'CONFLICT'
    : aligned.length > 0
      ? 'ALIGNED'
      : 'NO_HTF_CONTEXT';

  return {
    zones: limited,
    nearestM1,
    aligned,
    conflicting,
    sync,
    dataSource: SCALPING_DATA_SOURCES.higherTimeframeContext,
  };
}

function scenarioForZone({
  zone,
  oppositeZone,
  currentPrice,
  atrM1,
  spread,
  context,
  config,
}) {
  const cfg = mergeScalpingConfig(config);
  if (!zone) {
    return {
      available: false,
      status: 'WAITING_FOR_ZONE',
      side: null,
      entry: null,
      stopLoss: null,
      takeProfit: null,
      risk: null,
      reward: null,
      riskReward: null,
      warnings: ['Zona M1 belum tersedia.'],
      isSignal: false,
      autoOrder: false,
      strategyApproved: false,
      dataSource: SCALPING_DATA_SOURCES.entrySlTpRr,
    };
  }

  const demand = zone.side === SD_SIDE.DEMAND;
  const entry = zone.proximal;
  const buffer = Math.max(
    Number.isFinite(atrM1) ? atrM1 * cfg.slBufferAtr : 0,
    Number.isFinite(spread?.spread) ? spread.spread : 0,
  );
  const stopLoss = demand ? zone.distal - buffer : zone.distal + buffer;
  const risk = demand ? entry - stopLoss : stopLoss - entry;
  const oppositeTarget = oppositeZone
    ? (demand ? oppositeZone.proximal : oppositeZone.proximal)
    : null;
  const targetValid = Number.isFinite(oppositeTarget)
    && (demand ? oppositeTarget > entry : oppositeTarget < entry);
  const takeProfit = targetValid
    ? oppositeTarget
    : demand
      ? entry + (risk * cfg.defaultRR)
      : entry - (risk * cfg.defaultRR);
  const reward = demand ? takeProfit - entry : entry - takeProfit;
  const riskReward = risk > 0 ? reward / risk : null;

  const warnings = [];
  if (!Number.isFinite(riskReward) || riskReward < cfg.minRR) {
    warnings.push(`RR ${Number.isFinite(riskReward) ? riskReward.toFixed(2) : '—'} < minimum ${cfg.minRR}.`);
  }
  if (spread?.status === 'WIDE') warnings.push('Spread melebar relatif terhadap ATR M1.');
  if (spread?.status === 'UNAVAILABLE') warnings.push('Spread XM belum tersedia.');
  if (context?.sync === 'CONFLICT') warnings.push('Ada zona higher timeframe berlawanan arah dekat harga.');
  warnings.push('PREVIEW ONLY - bukan sinyal BUY/SELL dan tidak ada auto-order.');

  return {
    available: true,
    status: warnings.length > 1 ? 'PREVIEW_WITH_WARNINGS' : 'PREVIEW_ONLY',
    side: zone.side,
    timeframe: zone.timeframe,
    zoneScore: zone.score,
    zoneLifecycle: zone.lifecycle,
    entry,
    stopLoss,
    takeProfit,
    risk,
    reward,
    riskReward,
    targetSource: targetValid ? 'higher-timeframe opposing zone' : `${cfg.defaultRR}R fallback`,
    currentPrice: Number.isFinite(currentPrice) ? currentPrice : null,
    warnings,
    isSignal: false,
    autoOrder: false,
    strategyApproved: false,
    dataSource: SCALPING_DATA_SOURCES.entrySlTpRr,
  };
}

export function buildEntryScenarios({
  analysis,
  currentPrice,
  atrM1,
  spread,
  context,
  config = {},
} = {}) {
  const cfg = mergeScalpingConfig(config);
  const m1Zones = analysis?.timeframes?.M1?.activeZones || [];
  const demandZone = pickNearestZone(m1Zones, SD_SIDE.DEMAND, currentPrice);
  const supplyZone = pickNearestZone(m1Zones, SD_SIDE.SUPPLY, currentPrice);

  return {
    demand: scenarioForZone({
      zone: demandZone,
      oppositeZone: supplyZone,
      currentPrice,
      atrM1,
      spread,
      context,
      config: cfg,
    }),
    supply: scenarioForZone({
      zone: supplyZone,
      oppositeZone: demandZone,
      currentPrice,
      atrM1,
      spread,
      context,
      config: cfg,
    }),
    dataSource: SCALPING_DATA_SOURCES.entrySlTpRr,
  };
}

function deriveSetupStatus({ analysis, spread, context, scenarios, config = {} }) {
  const cfg = mergeScalpingConfig(config);
  const flags = [];
  if (!analysis?.ok) flags.push('DATA_UNAVAILABLE');
  if (!analysis?.isXmValidated) flags.push('DATA_NOT_XM_VALIDATED');
  if (spread?.status === 'UNAVAILABLE') flags.push('SPREAD_UNAVAILABLE');
  if (spread?.status === 'WIDE') flags.push('SPREAD_WIDE');
  if (context?.sync === 'CONFLICT') flags.push('HTF_CONFLICT');
  if (!scenarios?.demand?.available && !scenarios?.supply?.available) flags.push('WAITING_FOR_ZONE');
  flags.push('STRATEGY_NOT_APPROVED');

  let code = 'PREVIEW_ONLY';
  if (flags.includes('DATA_UNAVAILABLE') || flags.includes('DATA_NOT_XM_VALIDATED')) {
    code = 'DATA_UNAVAILABLE';
  } else if (flags.includes('WAITING_FOR_ZONE')) {
    code = 'WAITING_FOR_ZONE';
  } else if (flags.includes('HTF_CONFLICT')) {
    code = 'HTF_CONFLICT';
  } else if (flags.includes('SPREAD_WIDE')) {
    code = 'SPREAD_WIDE';
  }

  return {
    code,
    flags,
    signalAllowed: false,
    autoOrder: false,
    strategyApproved: false,
    minimumRR: cfg.minRR,
    message: code === 'DATA_UNAVAILABLE'
      ? 'OHLC XM tervalidasi belum tersedia. Tidak ada setup atau level yang diklaim.'
      : code === 'WAITING_FOR_ZONE'
        ? 'Belum ada zona M1 aktif. Setup menunggu zona, bukan sinyal.'
        : code === 'HTF_CONFLICT'
          ? 'Zona M1 bertabrakan dengan konteks higher timeframe. Setup ditahan.'
          : code === 'SPREAD_WIDE'
            ? 'Spread melebar relatif terhadap ATR M1. Setup ditahan.'
            : 'Preview level dari zona M1. Strategi scalping belum disetujui; tidak ada sinyal BUY/SELL.',
    dataSource: SCALPING_DATA_SOURCES.setupStatus,
  };
}

function unavailableResult({ symbol, code, message, now, failures = {}, warnings = [] }) {
  return {
    ok: false,
    code,
    dataAvailable: false,
    symbol,
    generatedAt: new Date(now).toISOString(),
    source: null,
    isXmValidated: false,
    dataStatus: 'DATA_UNAVAILABLE',
    message,
    trend: null,
    volatility: null,
    spread: null,
    supplyDemand: null,
    context: {
      zones: [],
      nearestM1: null,
      aligned: [],
      conflicting: [],
      sync: 'NO_HTF_CONTEXT',
      dataSource: SCALPING_DATA_SOURCES.higherTimeframeContext,
    },
    scenarios: {
      demand: {
        available: false,
        status: 'DATA_UNAVAILABLE',
        warnings: [message],
        isSignal: false,
        autoOrder: false,
        strategyApproved: false,
        dataSource: SCALPING_DATA_SOURCES.entrySlTpRr,
      },
      supply: {
        available: false,
        status: 'DATA_UNAVAILABLE',
        warnings: [message],
        isSignal: false,
        autoOrder: false,
        strategyApproved: false,
        dataSource: SCALPING_DATA_SOURCES.entrySlTpRr,
      },
      dataSource: SCALPING_DATA_SOURCES.entrySlTpRr,
    },
    setupStatus: {
      code: 'DATA_UNAVAILABLE',
      flags: ['DATA_UNAVAILABLE', 'STRATEGY_NOT_APPROVED'],
      signalAllowed: false,
      autoOrder: false,
      strategyApproved: false,
      minimumRR: SCALPING_M1_DEFAULT_CONFIG.minRR,
      message,
      dataSource: SCALPING_DATA_SOURCES.setupStatus,
    },
    failures,
    warnings,
    dataSources: SCALPING_DATA_SOURCES,
    limitations: [
      'Tidak ada level entry/SL/TP/RR yang dibuat tanpa OHLC XM tervalidasi.',
      'Tidak ada sinyal BUY/SELL otomatis dan tidak ada auto-order.',
      'Screenshot / visual capture tidak pernah diubah menjadi OHLC.',
    ],
  };
}

export function buildScalpingM1Analysis({
  symbol = 'XAUUSD',
  payloads = {},
  now = Date.now(),
  config = {},
} = {}) {
  const cfg = mergeScalpingConfig(config);
  const m1Payload = payloads.M1;
  const validation = validateCandleSeries({
    candles: m1Payload?.candles,
    symbol,
    timeframe: 'M1',
    source: m1Payload?.source,
    tick: m1Payload?.tick,
    now,
    config: cfg,
  });

  if (!validation.ok) {
    return unavailableResult({
      symbol,
      code: validation.code || SD_DATA_STATUS.DATA_UNAVAILABLE,
      message: validation.message || 'OHLC M1 XM tidak tersedia.',
      now,
      failures: { M1: validation },
      warnings: validation.warnings || [],
    });
  }

  const analysis = analyzeSupplyDemand({
    symbol,
    timeframes: SCALPING_M1_TIMEFRAMES,
    payloads,
    now,
    config: cfg,
  });

  if (!analysis.ok || !analysis.timeframes?.M1?.ok) {
    return unavailableResult({
      symbol,
      code: analysis.code || SD_DATA_STATUS.DATA_UNAVAILABLE,
      message: analysis.message || 'S&D Engine M1 belum siap.',
      now,
      failures: analysis.timeframes || {},
      warnings: analysis.warnings || [],
    });
  }

  const candles = validation.candles;
  const atrValues = atrSeries(candles, cfg.atrPeriod);
  const atr = lastFinite(atrValues);
  const trend = classifyTrend(candles, cfg);
  const volatility = classifyVolatility(atrValues, atr, cfg);
  const tick = m1Payload?.tick || analysis.timeframes.M1?.payload?.tick || null;
  const spread = computeSpread(tick, atr, cfg);
  const currentPrice = analysis.currentPrice ?? (candles.length ? candles[candles.length - 1].close : null);
  const context = buildHigherTimeframeContext({
    analysis,
    currentPrice,
    atrM1: atr,
    config: cfg,
  });
  const scenarios = buildEntryScenarios({
    analysis,
    currentPrice,
    atrM1: atr,
    spread,
    context,
    config: cfg,
  });
  const setupStatus = deriveSetupStatus({
    analysis,
    spread,
    context,
    scenarios,
    config: cfg,
  });

  const m1Summary = analysis.timeframes.M1;
  const supplyDemand = {
    timeframe: 'M1',
    status: m1Summary.status,
    source: m1Summary.source,
    isXmValidated: m1Summary.isXmValidated,
    freshness: m1Summary.freshness,
    qualityScore: m1Summary.qualityScore,
    atr: m1Summary.atr,
    activeZones: m1Summary.activeZones,
    lifecycleCounts: analysis.lifecycleCounts,
    nearestDemand: pickNearestZone(m1Summary.activeZones, SD_SIDE.DEMAND, currentPrice),
    nearestSupply: pickNearestZone(m1Summary.activeZones, SD_SIDE.SUPPLY, currentPrice),
    strongest: m1Summary.activeZones
      .slice()
      .sort((a, b) => b.score - a.score)[0] || null,
    dataSource: SCALPING_DATA_SOURCES.supplyDemandM1,
  };

  return {
    ok: true,
    code: SD_DATA_STATUS.READY,
    dataAvailable: true,
    symbol,
    generatedAt: new Date(now).toISOString(),
    source: analysis.source,
    isXmValidated: analysis.isXmValidated === true,
    dataStatus: 'READY',
    message: 'Metrik scalping M1 dihitung dari OHLC XM tervalidasi.',
    currentPrice,
    trend,
    volatility,
    spread,
    supplyDemand,
    context,
    scenarios,
    setupStatus,
    partial: analysis.partial,
    missingTimeframes: analysis.missingTimeframes,
    warnings: analysis.warnings,
    dataSources: SCALPING_DATA_SOURCES,
    limitations: [
      'Panel ini tidak menghasilkan sinyal BUY/SELL dan tidak mengirim order.',
      'Entry/SL/TP/RR adalah preview turunan zona M1; aturan strategi scalping belum disetujui.',
      'Konteks higher timeframe mempertahankan identitas TF; zona tidak digabung menjadi satu box anonim.',
      'Sumber live hanya diakui jika payload OHLC berasal dari MT5_LOCAL_BRIDGE dan tervalidasi.',
    ],
  };
}

export default buildScalpingM1Analysis;
