/**
 * JIN SCALPING - M1 tests.
 * Synthetic XAUUSD-like series only. These tests validate mechanics, data
 * gating, and preview math. They are not a market-accuracy claim.
 *
 * Run: node tests/scalping-m1.test.mjs
 */

import assert from 'node:assert/strict';
import {
  SCALPING_DATA_SOURCES,
  buildEntryScenarios,
  buildHigherTimeframeContext,
  buildScalpingM1Analysis,
  classifyTrend,
  classifyVolatility,
  computeSpread,
} from '../src/services/trading/scalping/scalpingM1.js';
import { buildPreviewLevels } from '../src/services/trading/scalping/previewLevels.js';
import { SD_DATA_STATUS, SD_SIDE } from '../src/services/trading/supplyDemand/constants.js';

const SYMBOL = 'XAUUSD';
let passed = 0;

function normalizeTimestamps(candles, intervalMs) {
  const lastTime = Date.now() - intervalMs;
  const firstTime = lastTime - ((candles.length - 1) * intervalMs);
  candles.forEach((candle, index) => {
    candle.timestamp = new Date(firstTime + (index * intervalMs)).toISOString();
  });
  return candles;
}

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    throw error;
  }
}

function makeTrendCandles(direction = 'up', count = 120, intervalMs = 60_000) {
  const candles = [];
  let price = 100;
  for (let i = 0; i < count; i += 1) {
    const drift = direction === 'up' ? 0.05 : direction === 'down' ? -0.05 : 0;
    const wobble = direction === 'flat' ? (i % 2 === 0 ? 0.02 : -0.02) : 0;
    const open = price;
    const close = open + drift + wobble;
    candles.push({
      symbol: SYMBOL,
      timeframe: 'M1',
      timestamp: new Date(Date.now() - ((count - i) * intervalMs)).toISOString(),
      open,
      high: Math.max(open, close) + 0.03,
      low: Math.min(open, close) - 0.03,
      close,
      volume: 100,
    });
    price = close;
  }
  return normalizeTimestamps(candles, intervalMs);
}

function makeDemandSeries({
  mode = 'tested',
  timeframe = 'M1',
  intervalMs = 60_000,
} = {}) {
  const candles = [];
  const push = (open, high, low, close, volume = 100) => {
    candles.push({
      symbol: SYMBOL,
      timeframe,
      timestamp: new Date().toISOString(),
      open,
      high,
      low,
      close,
      volume,
    });
  };

  let price = 103;
  for (let i = 0; i < 40; i += 1) {
    const open = price;
    const close = open - 0.06;
    push(open, open + 0.25, close - 0.25, close, 100);
    price = close;
  }

  for (let i = 0; i < 20; i += 1) {
    const open = 100.5 + (i % 2 === 0 ? 0.05 : -0.05);
    const close = 100.5 + (i % 2 === 0 ? -0.05 : 0.05);
    push(open, Math.max(open, close) + 0.25, Math.min(open, close) - 0.25, close, 80);
  }

  push(100.55, 105.2, 100.4, 105.0, 400);

  if (mode === 'fresh') {
    for (let i = 0; i < 25; i += 1) {
      const open = 105 + (i * 0.15);
      const close = open + 0.1;
      push(open, close + 0.2, open - 0.15, close, 120);
    }
    return normalizeTimestamps(candles, intervalMs);
  }

  for (let i = 0; i < 4; i += 1) {
    const open = 105 + (i * 0.3);
    const close = open + 0.25;
    push(open, close + 0.2, open - 0.15, close, 120);
  }

  push(106.2, 106.4, 100.4, 100.9, 180);

  for (let i = 0; i < 20; i += 1) {
    const open = 101 + (i * 0.35);
    const close = open + 0.3;
    push(open, close + 0.2, open - 0.2, close, 120);
  }

  return normalizeTimestamps(candles, intervalMs);
}

function payload(candles, { source = 'MT5_LOCAL_BRIDGE', tick = null } = {}) {
  return { source, candles, tick };
}

function zone(overrides) {
  return {
    id: overrides.id,
    symbol: SYMBOL,
    timeframe: overrides.timeframe || 'M1',
    side: overrides.side,
    proximal: overrides.proximal,
    distal: overrides.distal,
    high: overrides.high,
    low: overrides.low,
    score: overrides.score ?? 75,
    lifecycle: overrides.lifecycle || 'FRESH',
    testCount: overrides.testCount ?? 0,
    heldRetestCount: overrides.heldRetestCount ?? 0,
    atr: overrides.atr ?? 1,
    active: true,
  };
}

console.log('JIN SCALPING - M1 tests');

check('rejects non-XM M1 OHLC for scalping', () => {
  const result = buildScalpingM1Analysis({
    symbol: SYMBOL,
    payloads: {
      M1: payload(makeDemandSeries(), { source: 'LIVE_MARKET_FEED' }),
    },
    now: Date.now(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, SD_DATA_STATUS.NON_XM_SOURCE);
  assert.equal(result.dataAvailable, false);
  assert.equal(result.setupStatus.code, 'DATA_UNAVAILABLE');
  assert.equal(result.scenarios.demand.available, false);
  assert.equal(result.scenarios.supply.available, false);
});

check('shows DATA UNAVAILABLE when M1 OHLC is missing', () => {
  const result = buildScalpingM1Analysis({
    symbol: SYMBOL,
    payloads: {},
    now: Date.now(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.dataAvailable, false);
  assert.equal(result.trend, null);
  assert.equal(result.volatility, null);
  assert.equal(result.spread, null);
  assert.equal(result.setupStatus.signalAllowed, false);
  assert.equal(result.setupStatus.autoOrder, false);
});

check('classifies M1 trend and market condition', () => {
  const up = classifyTrend(makeTrendCandles('up'));
  const down = classifyTrend(makeTrendCandles('down'));
  const flat = classifyTrend(makeTrendCandles('flat'));

  assert.equal(up.available, true);
  assert.equal(up.trend, 'BULLISH');
  assert.equal(down.trend, 'BEARISH');
  assert.equal(flat.trend, 'SIDEWAYS');
  assert.ok(Number.isFinite(up.adx));
  assert.ok(Number.isFinite(up.efficiencyRatio));
});

check('classifies M1 volatility from ATR percentile', () => {
  const atrValues = new Array(120).fill(1);
  assert.equal(classifyVolatility(atrValues, 3).level, 'HIGH');
  assert.equal(classifyVolatility(atrValues, 0.2).level, 'LOW');
  assert.equal(classifyVolatility([], 1).available, false);
});

check('computes spread and flags wide spread without inventing data', () => {
  const wide = computeSpread({ bid: 100, ask: 100.4 }, 1);
  const normal = computeSpread({ bid: 100, ask: 100.2 }, 1);
  const missing = computeSpread(null, 1);

  assert.equal(wide.available, true);
  assert.ok(Math.abs(wide.spread - 0.4) < 1e-9);
  assert.equal(wide.status, 'WIDE');
  assert.equal(normal.status, 'NORMAL');
  assert.equal(missing.available, false);
  assert.equal(missing.status, 'UNAVAILABLE');
});

check('builds demand and supply preview levels with RR math and no signal', () => {
  const demandZone = zone({
    id: 'd1',
    side: SD_SIDE.DEMAND,
    proximal: 100.8,
    distal: 100.2,
    high: 100.9,
    low: 100.1,
    score: 82,
    lifecycle: 'TESTED',
    testCount: 1,
    heldRetestCount: 1,
  });
  const supplyZone = zone({
    id: 's1',
    side: SD_SIDE.SUPPLY,
    proximal: 106.0,
    distal: 106.6,
    high: 106.7,
    low: 105.9,
    score: 78,
    lifecycle: 'FRESH',
  });
  const analysis = {
    timeframes: {
      M1: { ok: true, activeZones: [demandZone, supplyZone] },
    },
  };

  const scenarios = buildEntryScenarios({
    analysis,
    currentPrice: 103,
    atrM1: 1,
    spread: { status: 'NORMAL', spread: 0.3 },
    context: { sync: 'ALIGNED' },
    config: { slBufferAtr: 0.2, minRR: 1.5, defaultRR: 2 },
  });

  const demand = scenarios.demand;
  const supply = scenarios.supply;

  assert.equal(demand.available, true);
  assert.equal(demand.entry, 100.8);
  assert.ok(demand.stopLoss < demand.entry);
  assert.ok(demand.takeProfit > demand.entry);
  assert.ok(demand.riskReward > 0);
  assert.equal(demand.isSignal, false);
  assert.equal(demand.autoOrder, false);
  assert.equal(demand.strategyApproved, false);

  assert.equal(supply.available, true);
  assert.equal(supply.entry, 106.0);
  assert.ok(supply.stopLoss > supply.entry);
  assert.ok(supply.takeProfit < supply.entry);
  assert.ok(supply.riskReward > 0);
  assert.equal(supply.isSignal, false);
  assert.equal(supply.autoOrder, false);
  assert.equal(supply.strategyApproved, false);
});

check('keeps higher-timeframe identity and detects conflict', () => {
  const m1Demand = zone({
    id: 'm1d',
    timeframe: 'M1',
    side: SD_SIDE.DEMAND,
    proximal: 100.8,
    distal: 100.2,
    high: 100.9,
    low: 100.1,
    score: 80,
  });
  const m5Demand = zone({
    id: 'm5d',
    timeframe: 'M5',
    side: SD_SIDE.DEMAND,
    proximal: 100.7,
    distal: 100.0,
    high: 100.9,
    low: 99.9,
    score: 85,
    atr: 2,
    lifecycle: 'TESTED',
    testCount: 1,
    heldRetestCount: 1,
  });
  const m15Supply = zone({
    id: 'm15s',
    timeframe: 'M15',
    side: SD_SIDE.SUPPLY,
    proximal: 101.0,
    distal: 101.5,
    high: 101.6,
    low: 100.9,
    score: 70,
    atr: 3,
  });
  const analysis = {
    timeframes: {
      M1: { ok: true, activeZones: [m1Demand] },
      M5: { ok: true, activeZones: [m5Demand] },
      M15: { ok: true, activeZones: [m15Supply] },
      H1: { ok: true, activeZones: [] },
      H4: { ok: true, activeZones: [] },
    },
  };

  const context = buildHigherTimeframeContext({
    analysis,
    currentPrice: 100.5,
    atrM1: 1,
    config: { contextNearAtr: 5, contextAlignAtr: 1 },
  });

  assert.ok(context.zones.some((item) => item.timeframe === 'M5'));
  assert.ok(context.zones.some((item) => item.timeframe === 'M15'));
  assert.ok(context.aligned.some((item) => item.timeframe === 'M5'));
  assert.ok(context.conflicting.some((item) => item.timeframe === 'M15'));
  assert.equal(context.sync, 'CONFLICT');
});

check('builds M1 scalping analysis from validated MT5 payloads', () => {
  const m1 = makeDemandSeries({ timeframe: 'M1', intervalMs: 60_000 });
  const m5 = makeDemandSeries({ timeframe: 'M5', intervalMs: 300_000 });
  const m15 = makeDemandSeries({ timeframe: 'M15', intervalMs: 900_000 });
  const h1 = makeDemandSeries({ timeframe: 'H1', intervalMs: 3_600_000 });
  const h4 = makeDemandSeries({ timeframe: 'H4', intervalMs: 14_400_000 });

  const result = buildScalpingM1Analysis({
    symbol: SYMBOL,
    payloads: {
      M1: payload(m1, { tick: { bid: 107.5, ask: 107.9 } }),
      M5: payload(m5),
      M15: payload(m15),
      H1: payload(h1),
      H4: payload(h4),
    },
    now: Date.now(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.dataAvailable, true);
  assert.equal(result.isXmValidated, true);
  assert.equal(result.trend.available, true);
  assert.equal(result.volatility.available, true);
  assert.equal(result.spread.available, true);
  assert.equal(result.supplyDemand.timeframe, 'M1');
  assert.ok(Array.isArray(result.supplyDemand.activeZones));
  assert.equal(result.scenarios.demand.isSignal, false);
  assert.equal(result.scenarios.supply.isSignal, false);
  assert.equal(result.setupStatus.signalAllowed, false);
  assert.equal(result.setupStatus.autoOrder, false);
  assert.equal(result.setupStatus.strategyApproved, false);
  assert.ok(result.setupStatus.flags.includes('STRATEGY_NOT_APPROVED'));
  assert.equal(result.dataSources.entrySlTpRr, SCALPING_DATA_SOURCES.entrySlTpRr);
});

check('builds chart preview levels from demand and supply scenarios', () => {
  const levels = buildPreviewLevels({
    demand: { available: true, side: 'DEMAND', entry: 100, stopLoss: 99, takeProfit: 102 },
    supply: { available: true, side: 'SUPPLY', entry: 103, stopLoss: 104, takeProfit: 101 },
  });
  assert.equal(levels.length, 6);
  assert.deepEqual(
    levels.map((level) => level.label),
    ['DEMAND ENTRY', 'DEMAND SL', 'DEMAND TP', 'SUPPLY ENTRY', 'SUPPLY SL', 'SUPPLY TP'],
  );
  assert.equal(levels[0].style, 'solid');
  assert.equal(levels[1].style, 'dashed');
  assert.equal(levels[2].style, 'dotted');
  assert.equal(levels[0].side, 'DEMAND');
  assert.equal(levels[3].side, 'SUPPLY');
});

check('merges chart levels that share the same price', () => {
  const levels = buildPreviewLevels({
    demand: { available: true, side: 'DEMAND', entry: 100, stopLoss: 99, takeProfit: 102 },
    supply: { available: true, side: 'SUPPLY', entry: 102, stopLoss: 103, takeProfit: 101 },
  });
  assert.equal(levels.length, 5);
  const shared = levels.find((level) => level.price === 102);
  assert.equal(shared.label, 'DEMAND TP / SUPPLY ENTRY');
  assert.equal(shared.color, '#cbd5e1');
});

check('skips unavailable or invalid chart preview levels', () => {
  const levels = buildPreviewLevels({
    demand: { available: false, side: 'DEMAND', entry: 100, stopLoss: 99, takeProfit: 102 },
    supply: { available: true, side: 'SUPPLY', entry: 0, stopLoss: 'x', takeProfit: 101 },
  });
  assert.equal(levels.length, 1);
  assert.equal(levels[0].price, 101);
});

check('rejects stale M1 candles and produces no scalping setup', () => {
  const staleM1 = makeDemandSeries({ timeframe: 'M1', intervalMs: 60_000 }).map((candle) => ({
    ...candle,
    timestamp: new Date(Date.parse(candle.timestamp) - (30 * 60_000)).toISOString(),
  }));

  const result = buildScalpingM1Analysis({
    symbol: SYMBOL,
    payloads: { M1: payload(staleM1) },
    now: Date.now(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.dataAvailable, false);
  assert.equal(result.code, SD_DATA_STATUS.STALE);
  assert.equal(result.failures.M1.code, SD_DATA_STATUS.STALE);
  assert.equal(result.scenarios.demand.available, false);
  assert.equal(result.scenarios.demand.isSignal, false);
  assert.equal(result.setupStatus.signalAllowed, false);
});

console.log(`\nJIN SCALPING - M1 tests passed: ${passed} checks.`);
