/**
 * JIN GOLD ORDER FLOW — deterministic tests (no network).
 * Run: node tests/gold-order-flow.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ABSORPTION_VOLUME_MULTIPLIER,
  COMEX_FEED_INFO,
  ORDER_FLOW_BIAS_THRESHOLD,
  ORDER_FLOW_MIN_TRADES,
  aggregateOrderFlow,
  buildGoldOrderFlow,
  unavailableOrderFlow,
} from '../server/market/goldOrderFlow.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NOW = Date.parse('2026-02-01T12:00:00Z');
let passed = 0;

const test = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

function trade({ price = 4000, quantity = 0.01, time, m }) {
  return {
    price,
    quantity,
    quoteQuantity: price * quantity,
    time,
    isBuyerMaker: m,
  };
}

function series({ count, price = 4000, quantity = 0.01, m = false, stepMs = 1000, startMs = NOW - 60_000, priceStep = 0 }) {
  return Array.from({ length: count }, (_, index) => trade({
    price: price + index * priceStep,
    quantity,
    time: startMs + index * stepMs,
    m,
  }));
}

test('aggressor side comes from the exchange flag, not price direction', () => {
  // Price rises, but every trade is seller-aggressive (buyer was maker).
  const risingButSelling = series({ count: 40, priceStep: 1, m: true });
  const result = aggregateOrderFlow({ trades: risingButSelling, now: NOW });
  assert.equal(result.ok, true);
  assert.equal(result.classification, 'EXCHANGE_AGGRESSOR');
  assert.equal(result.percentages.buy, 0);
  assert.equal(result.percentages.sell, 100);
  assert.equal(result.bias, 'SELLER DOMINANT');

  // Price falls, but every trade is buyer-aggressive.
  const fallingButBuying = series({ count: 40, priceStep: -1, m: false });
  const opposite = aggregateOrderFlow({ trades: fallingButBuying, now: NOW });
  assert.equal(opposite.percentages.buy, 100);
  assert.equal(opposite.bias, 'BUYER DOMINANT');
  assert.ok(opposite.price.changePct < 0, 'price direction must not drive the bias');
});

test('percentages, delta, imbalance and CVD use aggressor volume', () => {
  const buys = series({ count: 600, quantity: 0.001, m: false, startMs: NOW - 120_000 });
  const sells = series({ count: 400, quantity: 0.001, m: true, startMs: NOW - 60_000 });
  const trades = [...buys, ...sells].sort((a, b) => a.time - b.time);
  const result = aggregateOrderFlow({ trades, now: NOW });
  assert.ok(Math.abs(result.volume.totalBase - 1) < 1e-9);
  assert.ok(Math.abs(result.percentages.buy - 60) < 1e-9);
  assert.ok(Math.abs(result.percentages.sell - 40) < 1e-9);
  assert.ok(Math.abs(result.delta - 0.2) < 1e-9);
  assert.ok(Math.abs(result.imbalance - 0.2) < 1e-9);
  assert.ok(Math.abs(result.cvd - 0.2) < 1e-9);
  assert.equal(result.cvdSign, 'POSITIVE');
  assert.equal(result.bias, 'BUYER DOMINANT');
  assert.ok(result.imbalance >= ORDER_FLOW_BIAS_THRESHOLD);
});

test('absorption is detected on high volume with flat price', () => {
  const quiet = series({ count: 20, quantity: 0.005, m: false, startMs: NOW - 120_000, stepMs: 1000 });
  const heavy = series({ count: 20, quantity: 0.5, m: true, startMs: NOW - 60_000, stepMs: 1000 });
  const trades = [...quiet, ...heavy];
  const result = aggregateOrderFlow({ trades, now: NOW });
  assert.ok(result.volumeRatio >= ABSORPTION_VOLUME_MULTIPLIER);
  assert.equal(result.volumeLevel, 'HIGH');
  assert.equal(result.absorption.status, 'DETECTED');
  assert.ok(['BUY', 'SELL', 'TWO_WAY'].includes(result.absorption.side));
});

test('absorption is not detected when price moves proportionally', () => {
  const quiet = series({ count: 20, quantity: 0.005, m: false, startMs: NOW - 120_000, stepMs: 1000 });
  const heavy = series({
    count: 20,
    quantity: 0.5,
    m: false,
    startMs: NOW - 60_000,
    stepMs: 1000,
    price: 4000,
    priceStep: 10,
  });
  const result = aggregateOrderFlow({ trades: [...quiet, ...heavy], now: NOW });
  assert.equal(result.volumeLevel, 'HIGH');
  assert.equal(result.absorption.status, 'NOT_DETECTED');
});

test('missing maker/taker flags fall back to a tick rule and are marked ESTIMATED', () => {
  const trades = series({ count: 40, priceStep: 1, m: null });
  const result = aggregateOrderFlow({ trades, now: NOW });
  assert.equal(result.classification, 'ESTIMATED');
  assert.ok(result.percentages.buy > 97, 'rising ticks are classified as buys after the first print');
  assert.ok(result.percentages.neutral > 0, 'the first print has no prior tick and stays neutral');
  assert.match(result.classificationNote, /ESTIMATED/);
  assert.ok(result.notes.some((note) => /ESTIMATED/.test(note)));
});

test('freshness status uses the last actual trade timestamp', () => {
  const live = aggregateOrderFlow({ trades: series({ count: 40, startMs: NOW - 40_000 }), now: NOW });
  assert.equal(live.status, 'LIVE');
  const delayed = aggregateOrderFlow({ trades: series({ count: 40, startMs: NOW - 180_000 }), now: NOW });
  assert.equal(delayed.status, 'DELAYED');
  const stale = aggregateOrderFlow({ trades: series({ count: 40, startMs: NOW - 900_000 }), now: NOW });
  assert.equal(stale.status, 'STALE');
});

test('thin samples withhold a dominant bias', () => {
  const trades = series({ count: ORDER_FLOW_MIN_TRADES - 1, m: false });
  const result = aggregateOrderFlow({ trades, now: NOW });
  assert.equal(result.insufficientSample, true);
  assert.equal(result.bias, 'NEUTRAL');
  assert.match(result.biasReason, /Sampel tipis/);
});

test('unavailable feed yields UNAVAILABLE with null numbers, never simulation', () => {
  const result = buildGoldOrderFlow({ raw: { ok: false, error: 'feed down' }, now: NOW });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.percentages.buy, null);
  assert.equal(result.percentages.sell, null);
  assert.equal(result.volume.totalQuote, null);
  assert.equal(result.cvd, null);
  assert.equal(result.bias, 'NEUTRAL');
  assert.match(result.error, /feed down/);
  assert.equal(result.instrument.isComex, false);
  assert.equal(result.comex.status, 'UNAVAILABLE');

  const empty = buildGoldOrderFlow({ raw: { ok: true, trades: [] }, now: NOW });
  assert.equal(empty.status, 'UNAVAILABLE');
  assert.equal(empty.volume.buyBase, null);

  const direct = unavailableOrderFlow({ now: NOW });
  assert.equal(direct.status, 'UNAVAILABLE');
  assert.equal(direct.complete, undefined);
});

test('instrument is an explicit PAXG proxy and COMEX stays UNAVAILABLE', () => {
  const result = aggregateOrderFlow({ trades: series({ count: 40, m: false }), now: NOW });
  assert.equal(COMEX_FEED_INFO.isComex, true);
  assert.equal(COMEX_FEED_INFO.status, 'UNAVAILABLE');
  assert.equal(result.comex.status, 'UNAVAILABLE');
  assert.equal(result.instrument.isComex, false);
  assert.equal(result.instrument.isProxy, true);
  assert.equal(result.instrument.symbol, 'PAXGUSDT');
  assert.ok(result.notes.some((note) => /BUKAN COMEX GC/.test(note)));
  assert.ok(!result.notes.some((note) => /institutional buying/i.test(note) && !/bukan/i.test(note)));
});

test('Broker Workspace exposes GOLD ORDER FLOW without removing existing tabs', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'BrokerWorkspace.jsx'), 'utf8');
  for (const label of ['JINI MONITOR', 'S&amp;D ENGINE', 'SCALPING M1', 'FAKTOR UP/DOWN GOLD', 'GOLD ORDER FLOW']) {
    assert.ok(source.includes(label), `missing tab label: ${label}`);
  }
  assert.ok(source.includes("panelTab === 'orderFlow'"));
  assert.ok(source.includes('JinGoldOrderFlowPanel'));
  for (const existing of ["panelTab === 'monitor'", "panelTab === 'supplyDemand'", "panelTab === 'scalping'", "panelTab === 'goldFactors'"]) {
    assert.ok(source.includes(existing), `existing tab wiring changed: ${existing}`);
  }
});

test('order flow UI stays text-only and uses the required signs', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'broker-workspace', 'JinGoldOrderFlowPanel.jsx'),
    'utf8',
  );
  for (const sign of ['▲', '▼', '◆', '●']) {
    assert.ok(source.includes(sign), `missing sign ${sign}`);
  }
  assert.ok(!/<canvas|Heatmap|Footprint/.test(source), 'no heatmap/footprint/canvas element may be added');
});

{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('network down');
  };
  const { fetchGoldOrderFlow } = await import('../server/market/goldOrderFlow.mjs');
  const payload = await fetchGoldOrderFlow({ now: NOW });
  assert.equal(payload.ok, false);
  assert.equal(payload.status, 'UNAVAILABLE');
  assert.equal(payload.volume.totalBase, null);
  assert.match(payload.error, /network down/);
  globalThis.fetch = originalFetch;
  passed += 1;
  console.log('ok - provider connection failure returns UNAVAILABLE instead of throwing');
}

console.log(`\n${passed} tests passed.`);
