/**
 * Phase 1 S&D engine tests.
 * Synthetic XAUUSD-like series only. These tests validate mechanics, not
 * market accuracy. Live accuracy must come from XM historical candles.
 *
 * Run: node tests/supply-demand-engine.test.mjs
 */

import assert from 'node:assert/strict';
import { analyzeSupplyDemand } from '../src/services/trading/supplyDemand/SupplyDemandEngine.js';
import { detectZonesForTimeframe } from '../src/services/trading/supplyDemand/zoneDetection.js';
import { validateCandleSeries } from '../src/services/trading/supplyDemand/candleValidation.js';
import {
  fetchXmOhlc,
  fetchXmOhlcMulti,
} from '../src/services/trading/supplyDemand/xmOhlcClient.js';
import {
  SD_DATA_STATUS,
  SD_LIFECYCLE,
  SD_SIDE,
} from '../src/services/trading/supplyDemand/constants.js';

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

async function checkAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    throw error;
  }
}

function makeDemandSeries({
  mode = 'tested',
  timeframe = 'M1',
  intervalMs = 60_000,
} = {}) {
  const candles = [];
  const start = Date.now() - (120 * intervalMs);
  const push = (open, high, low, close, volume = 100) => {
    const index = candles.length;
    candles.push({
      symbol: SYMBOL,
      timeframe,
      timestamp: new Date(start + (index * intervalMs)).toISOString(),
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

  if (mode === 'invalid') {
    push(100.9, 101.0, 98.8, 99.0, 220);
    for (let i = 0; i < 10; i += 1) {
      const open = 99 - (i * 0.1);
      const close = open - 0.05;
      push(open, open + 0.15, close - 0.15, close, 90);
    }
    return normalizeTimestamps(candles, intervalMs);
  }

  for (let i = 0; i < 20; i += 1) {
    const open = 101 + (i * 0.35);
    const close = open + 0.3;
    push(open, close + 0.2, open - 0.2, close, 120);
  }
  return normalizeTimestamps(candles, intervalMs);
}

function makeSupplySeries({
  mode = 'tested',
  timeframe = 'M1',
  intervalMs = 60_000,
} = {}) {
  const candles = [];
  const start = Date.now() - (120 * intervalMs);
  const push = (open, high, low, close, volume = 100) => {
    const index = candles.length;
    candles.push({
      symbol: SYMBOL,
      timeframe,
      timestamp: new Date(start + (index * intervalMs)).toISOString(),
      open,
      high,
      low,
      close,
      volume,
    });
  };

  let price = 98;
  for (let i = 0; i < 40; i += 1) {
    const open = price;
    const close = open + 0.06;
    push(open, close + 0.25, open - 0.25, close, 100);
    price = close;
  }

  for (let i = 0; i < 20; i += 1) {
    const open = 100.5 + (i % 2 === 0 ? -0.05 : 0.05);
    const close = 100.5 + (i % 2 === 0 ? 0.05 : -0.05);
    push(open, Math.max(open, close) + 0.25, Math.min(open, close) - 0.25, close, 80);
  }

  push(100.45, 100.6, 94.8, 95.0, 400);

  if (mode === 'fresh') {
    for (let i = 0; i < 25; i += 1) {
      const open = 95 - (i * 0.15);
      const close = open - 0.1;
      push(open, open + 0.15, close - 0.2, close, 120);
    }
    return normalizeTimestamps(candles, intervalMs);
  }

  for (let i = 0; i < 4; i += 1) {
    const open = 95 - (i * 0.3);
    const close = open - 0.25;
    push(open, open + 0.15, close - 0.2, close, 120);
  }

  push(94.2, 100.6, 94.0, 100.1, 180);

  if (mode === 'invalid') {
    push(100.1, 101.6, 100.0, 101.5, 220);
    for (let i = 0; i < 10; i += 1) {
      const open = 101.5 + (i * 0.1);
      const close = open + 0.05;
      push(open, close + 0.15, open - 0.15, close, 90);
    }
    return normalizeTimestamps(candles, intervalMs);
  }

  for (let i = 0; i < 20; i += 1) {
    const open = 99.5 - (i * 0.35);
    const close = open - 0.3;
    push(open, open + 0.2, close - 0.2, close, 120);
  }
  return normalizeTimestamps(candles, intervalMs);
}

function payload(candles, source = 'MT5_LOCAL_BRIDGE') {
  return { source, candles, tick: null };
}

console.log('Phase 1 Supply & Demand engine tests');

check('rejects non-XM OHLC sources for live zones', () => {
  const result = validateCandleSeries({
    candles: makeDemandSeries(),
    symbol: SYMBOL,
    timeframe: 'M1',
    source: 'LIVE_MARKET_FEED',
    now: Date.now(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, SD_DATA_STATUS.NON_XM_SOURCE);
});

check('accepts valid MT5_LOCAL_BRIDGE OHLC', () => {
  const candles = makeDemandSeries();
  const result = validateCandleSeries({
    candles,
    symbol: SYMBOL,
    timeframe: 'M1',
    source: 'MT5_LOCAL_BRIDGE',
    now: Date.now(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.isXmValidated, true);
  assert.equal(result.count, candles.length);
  assert.equal(result.freshness, 'FRESH');
});

check('rejects simulated candles even when the payload claims MT5 source', () => {
  const candles = makeDemandSeries().map((candle) => ({ ...candle, isSimulated: true }));
  const result = validateCandleSeries({
    candles,
    symbol: SYMBOL,
    timeframe: 'M1',
    source: 'MT5_LOCAL_BRIDGE',
    now: Date.now(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, SD_DATA_STATUS.INVALID_CANDLES);
  assert.equal(result.isXmValidated, false);
  assert.ok(result.message.includes('simulated'));
});

check('rejects candles that carry a non-XM per-candle source', () => {
  const candles = makeDemandSeries().map((candle) => ({ ...candle, source: 'LIVE_MARKET_FEED' }));
  const result = validateCandleSeries({
    candles,
    symbol: SYMBOL,
    timeframe: 'M1',
    source: 'MT5_LOCAL_BRIDGE',
    now: Date.now(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, SD_DATA_STATUS.NON_XM_SOURCE);
  assert.equal(result.isXmValidated, false);
});

check('does not create zones when OHLC is unavailable', () => {
  const result = analyzeSupplyDemand({
    symbol: SYMBOL,
    timeframes: ['M1', 'M5'],
    payloads: {},
    now: Date.now(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.dataAvailable, false);
  assert.deepEqual(result.zones, []);
  assert.deepEqual(result.activeZones, []);
  assert.equal(result.strongest, null);
});

check('detects a fresh demand zone without inflating the retest score', () => {
  const candles = makeDemandSeries({ mode: 'fresh' });
  const zones = detectZonesForTimeframe({
    candles,
    symbol: SYMBOL,
    timeframe: 'M1',
  });
  const demand = zones.find((zone) => zone.side === SD_SIDE.DEMAND);
  assert.ok(demand, 'demand zone should exist');
  assert.equal(demand.lifecycle, SD_LIFECYCLE.FRESH);
  assert.equal(demand.testCount, 0);
  assert.equal(demand.heldRetestCount, 0);
  assert.ok(demand.proximal > demand.distal);
  const retestFactor = demand.scoreBreakdown.find((factor) => factor.key === 'retest');
  assert.equal(retestFactor.points, 0);
  assert.ok(demand.score > 0);
});

check('marks a single held retest as TESTED', () => {
  const candles = makeDemandSeries({ mode: 'tested' });
  const zones = detectZonesForTimeframe({
    candles,
    symbol: SYMBOL,
    timeframe: 'M1',
  });
  const demand = zones.find((zone) => zone.side === SD_SIDE.DEMAND);
  assert.ok(demand, 'demand zone should exist');
  assert.equal(demand.lifecycle, SD_LIFECYCLE.TESTED);
  assert.equal(demand.testCount, 1);
  assert.equal(demand.heldRetestCount, 1);
  assert.equal(demand.active, true);
});

check('invalidates a zone after a candle close beyond the distal edge', () => {
  const candles = makeDemandSeries({ mode: 'invalid' });
  const zones = detectZonesForTimeframe({
    candles,
    symbol: SYMBOL,
    timeframe: 'M1',
  });
  const demand = zones.find((zone) => zone.side === SD_SIDE.DEMAND);
  assert.ok(demand, 'demand zone should exist');
  assert.equal(demand.lifecycle, SD_LIFECYCLE.INVALID);
  assert.equal(demand.active, false);
  assert.ok(demand.invalidReason.includes('distal'));

  const analysis = analyzeSupplyDemand({
    symbol: SYMBOL,
    timeframes: ['M1'],
    payloads: { M1: payload(candles) },
    now: Date.now(),
  });
  assert.equal(analysis.activeZones.some((zone) => zone.side === SD_SIDE.DEMAND), false);
});

check('detects and tests a supply zone', () => {
  const candles = makeSupplySeries({ mode: 'tested' });
  const zones = detectZonesForTimeframe({
    candles,
    symbol: SYMBOL,
    timeframe: 'M1',
  });
  const supply = zones.find((zone) => zone.side === SD_SIDE.SUPPLY);
  assert.ok(supply, 'supply zone should exist');
  assert.ok(supply.proximal < supply.distal);
  assert.equal(supply.lifecycle, SD_LIFECYCLE.TESTED);
});

check('resolves current price from broker tick instead of treating null as zero', () => {
  const candles = makeDemandSeries({ mode: 'tested' });
  const tick = { bid: 100.4, ask: 100.6, timestamp: new Date().toISOString() };
  const result = analyzeSupplyDemand({
    symbol: SYMBOL,
    timeframes: ['M1'],
    payloads: { M1: { source: 'MT5_LOCAL_BRIDGE', candles, tick } },
    currentPrice: null,
    now: Date.now(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.currentPrice, 100.5);
});

check('falls back to the last close when broker tick is zeroed', () => {
  const candles = makeDemandSeries({ mode: 'tested' });
  const result = analyzeSupplyDemand({
    symbol: SYMBOL,
    timeframes: ['M1'],
    payloads: { M1: { source: 'MT5_LOCAL_BRIDGE', candles, tick: { bid: 0, ask: 0 } } },
    currentPrice: null,
    now: Date.now(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.currentPrice, candles[candles.length - 1].close);
});

check('keeps timeframe identity in multi-timeframe confluence', () => {
  const m5 = makeDemandSeries({ mode: 'tested', timeframe: 'M5', intervalMs: 300_000 });
  const m15 = makeDemandSeries({ mode: 'tested', timeframe: 'M15', intervalMs: 900_000 });
  const result = analyzeSupplyDemand({
    symbol: SYMBOL,
    timeframes: ['M5', 'M15'],
    payloads: {
      M5: payload(m5),
      M15: payload(m15),
    },
    currentPrice: 110,
    now: Date.now(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.isXmValidated, true);
  const cluster = result.confluence.find(
    (item) => item.side === SD_SIDE.DEMAND && item.isConfluence,
  );
  assert.ok(cluster, 'demand confluence cluster should exist');
  assert.ok(cluster.timeframes.includes('M5'));
  assert.ok(cluster.timeframes.includes('M15'));
  assert.ok(cluster.members.some((member) => member.timeframe === 'M5'));
  assert.ok(cluster.members.some((member) => member.timeframe === 'M15'));
  assert.ok(cluster.strongestMember.timeframe);
});

await checkAsync('client gates non-XM fallback and accepts MT5 bridge payload', async () => {
  const fakeFetch = async (url) => {
    const parsed = new URL(url);
    const timeframe = parsed.searchParams.get('timeframe');
    const candles = makeDemandSeries({
      timeframe,
      intervalMs: timeframe === 'M15' ? 900_000 : 300_000,
    });
    const source = timeframe === 'M5' ? 'MT5_LOCAL_BRIDGE' : 'LIVE_MARKET_FEED';
    return {
      ok: true,
      json: async () => ({
        ok: true,
        symbol: SYMBOL,
        timeframe,
        source,
        freshness: 'FRESH',
        candles,
        tick: null,
      }),
    };
  };

  const rejected = await fetchXmOhlc({
    symbol: SYMBOL,
    timeframe: 'M15',
    endpoint: 'http://fake',
    fetchImpl: fakeFetch,
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, SD_DATA_STATUS.NON_XM_SOURCE);

  const multi = await fetchXmOhlcMulti({
    symbol: SYMBOL,
    timeframes: ['M5', 'M15'],
    endpoint: 'http://fake',
    fetchImpl: fakeFetch,
  });
  assert.equal(multi.ok, true);
  assert.equal(multi.payloads.M5.source, 'MT5_LOCAL_BRIDGE');
  assert.equal(multi.failures.M15.code, SD_DATA_STATUS.NON_XM_SOURCE);

  const analysis = analyzeSupplyDemand({
    symbol: SYMBOL,
    timeframes: ['M5'],
    payloads: multi.payloads,
    now: Date.now(),
  });
  assert.equal(analysis.ok, true);
  assert.ok(analysis.demandZones.length > 0);
});

check('rejects stale XM candles instead of building live zones', () => {
  const staleCandles = makeDemandSeries().map((candle) => ({
    ...candle,
    timestamp: new Date(Date.parse(candle.timestamp) - (30 * 60_000)).toISOString(),
  }));
  const result = validateCandleSeries({
    candles: staleCandles,
    symbol: SYMBOL,
    timeframe: 'M1',
    source: 'MT5_LOCAL_BRIDGE',
    now: Date.now(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, SD_DATA_STATUS.STALE);
  assert.equal(result.freshness, 'STALE');
  assert.equal(result.candles.length, 0);
});

check('stale S&D payload produces no analysis zones', () => {
  const staleCandles = makeDemandSeries().map((candle) => ({
    ...candle,
    timestamp: new Date(Date.parse(candle.timestamp) - (30 * 60_000)).toISOString(),
  }));
  const analysis = analyzeSupplyDemand({
    symbol: SYMBOL,
    timeframes: ['M1'],
    payloads: { M1: payload(staleCandles) },
    now: Date.now(),
  });
  assert.equal(analysis.ok, false);
  assert.equal(analysis.dataAvailable, false);
  assert.equal(analysis.timeframes.M1.status, SD_DATA_STATUS.STALE);
  assert.equal(analysis.activeZones.length, 0);
});

await checkAsync('client rejects stale MT5 bridge payloads', async () => {
  const candles = makeDemandSeries();
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({
      ok: true,
      symbol: SYMBOL,
      timeframe: 'M1',
      source: 'MT5_LOCAL_BRIDGE',
      freshness: 'STALE',
      candles,
      tick: { bid: 100, ask: 100.5, timestamp: new Date().toISOString() },
    }),
  });

  const result = await fetchXmOhlc({
    symbol: SYMBOL,
    timeframe: 'M1',
    endpoint: 'http://fake',
    fetchImpl: fakeFetch,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, SD_DATA_STATUS.STALE);
  assert.equal(result.freshness, 'STALE');
});

console.log(`\nSupply & Demand engine tests passed: ${passed} checks.`);
