/**
 * FAKTOR UP/DOWN GOLD — deterministic tests (no network).
 * Run: node tests/gold-intermarket-factors.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CALC_VERSION,
  CORRELATION_WINDOW_DAYS,
  INSTRUMENT_DEFS,
  LIVE_WINDOW_MS,
  alignCorrelation,
  buildGoldIntermarketAnalysis,
  changeOf,
  classifyStatus,
  computeStability,
  computeTrend,
  normalizeFredInstrument,
  normalizeYahooInstrument,
  validateInstrument,
} from '../server/market/intermarketGoldService.mjs';
import { parseYahooCandles } from '../server/market/intermarketProviders.mjs';
import {
  alignCryptoWithBias,
  buildCryptoRiskSentiment,
  classifyCryptoStatus,
  computeCryptoChanges,
  computeCryptoTrend,
  CRYPTO_GROUP,
} from '../server/market/cryptoRiskSentiment.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

function dayKey(index) {
  const date = new Date(Date.UTC(2026, 0, 1 + index));
  return date.toISOString().slice(0, 10);
}

function makeChanges(count, step = 0.01, direction = 1) {
  return Array.from({ length: count }, (_, index) => {
    const sign = (index % 2 === 0 ? 1 : -1) * direction;
    const key = dayKey(index);
    return { key, date: key, value: 100 + index, change: sign * step };
  });
}

function invert(changes) {
  return changes.map((change) => ({ ...change, change: -change.change }));
}

function makeInstrument({ id, symbol, kind, unit, changes, status = 'DELAYED', latest = 100 }) {
  const lastChange = changes.at(-1)?.change ?? null;
  return {
    id,
    symbol,
    label: symbol,
    kind,
    unit,
    provider: 'TEST_FIXTURE',
    providerSymbol: symbol,
    status,
    latest,
    previousClose: Number.isFinite(lastChange) ? latest - lastChange : latest,
    change: lastChange,
    changeUnit: kind === 'yield' ? 'pp' : 'price',
    changePercent: kind === 'yield' ? null : 0,
    d1: { trend: 'BULLISH', available: true, bars: changes.length + 1 },
    h4: { trend: 'BULLISH', available: true, bars: changes.length + 1 },
    dailyPoints: [],
    dailyChanges: changes,
    h4Changes: changes,
  };
}

function candlesFromChanges(changes, { start = 1000, stepMs = 86400000, base = Date.UTC(2026, 0, 1) } = {}) {
  const candles = [];
  let close = start;
  candles.push({
    openTime: base - stepMs,
    closeTime: base,
    open: close,
    high: close,
    low: close,
    close,
    volume: 100,
    takerBuyBase: 55,
  });
  for (let index = 0; index < changes.length; index += 1) {
    const next = close * (1 + changes[index].change);
    const openTime = base + index * stepMs;
    candles.push({
      openTime,
      closeTime: openTime + stepMs,
      open: close,
      high: Math.max(close, next),
      low: Math.min(close, next),
      close: next,
      volume: 100,
      takerBuyBase: 55,
    });
    close = next;
  }
  return candles;
}

function cryptoRawFixture({ now = Date.parse('2026-02-01T00:00:00Z'), inverse = true, futuresReachable = true } = {}) {
  const goldChanges = makeChanges(31, 0.01, 1);
  const assetChanges = goldChanges.map((change) => ({
    ...change,
    change: inverse ? -change.change : change.change,
  }));
  const d1 = candlesFromChanges(assetChanges);
  const h4 = candlesFromChanges(Array.from({ length: 40 }, () => ({ change: 0.002 })), {
    stepMs: 4 * 3600 * 1000,
  });
  const h1 = candlesFromChanges(Array.from({ length: 40 }, () => ({ change: 0.001 })), {
    stepMs: 3600 * 1000,
  });
  const ts = new Date(now - 30_000).toISOString();
  const spot = (symbol) => ({
    symbol,
    market: 'SPOT',
    ticker: {
      ok: true,
      provider: 'Binance Spot',
      lastPrice: 50000,
      priceChangePercent: 2.5,
      quoteVolume: 1_000_000,
      volume: 500,
      closeTime: ts,
    },
    klines: {
      D1: { ok: true, provider: 'Binance Spot', candles: d1 },
      H4: { ok: true, provider: 'Binance Spot', candles: h4 },
      H1: { ok: true, provider: 'Binance Spot', candles: h1 },
    },
  });
  const futures = (symbol) => ({
    symbol,
    market: 'FUTURES',
    ticker: { ok: true, provider: 'Binance USD-M Futures', lastPrice: 50200, closeTime: ts },
    klines: {
      D1: { ok: true, candles: d1 },
      H4: { ok: true, candles: h4 },
      H1: { ok: true, candles: h1 },
    },
    openInterest: {
      ok: true,
      current: { value: 1234, time: ts },
      history: [
        { time: new Date(now - 8 * 3600_000).toISOString(), sumOpenInterest: 1000 },
        { time: new Date(now - 4 * 3600_000).toISOString(), sumOpenInterest: 1100 },
      ],
    },
    funding: {
      ok: true,
      markPrice: 50100,
      lastFundingRate: 0.0001,
      nextFundingTime: new Date(now + 3600_000).toISOString(),
      time: ts,
    },
    longShort: { ok: true, latest: { longShortRatio: 1.5, longAccount: 0.6, shortAccount: 0.4 } },
    liquidations: { ok: false, restricted: true, note: 'Endpoint likuidasi publik dibatasi.' },
  });
  return {
    ok: true,
    provider: 'Binance',
    fetchedAt: new Date(now).toISOString(),
    spot: { BTC: spot('BTCUSDT'), ETH: spot('ETHUSDT') },
    futures: {
      reachable: futuresReachable,
      host: futuresReachable ? 'https://fapi.binance.com' : null,
      error: futuresReachable ? null : 'Futures tidak terjangkau.',
      BTC: futuresReachable ? futures('BTCUSDT') : null,
      ETH: futuresReachable ? futures('ETHUSDT') : null,
    },
    apiKeysRequired: false,
  };
}

function coreInstruments(goldChanges, { conflictId = null, oilFlat = true } = {}) {
  const inverted = invert(goldChanges);
  const ids = [
    ['dxy', 'DXY', 'price', 'index'],
    ['us10y', 'US10Y', 'yield', 'percent'],
    ['us10y_real', 'US10Y_REAL', 'yield', 'percent'],
    ['us02y', 'US02Y', 'yield', 'percent'],
  ];
  const instruments = ids.map(([id, symbol, kind, unit]) => makeInstrument({
    id,
    symbol,
    kind,
    unit,
    changes: inverted,
    latest: kind === 'yield' ? 4.5 : 100,
  }));
  instruments.push(makeInstrument({
    id: 'wti',
    symbol: 'WTI',
    kind: 'price',
    unit: 'usd_per_bbl',
    changes: oilFlat ? makeChanges(goldChanges.length, 0, 1) : inverted,
    latest: 80,
  }));

  if (conflictId) {
    const target = instruments.find((instrument) => instrument.id === conflictId);
    const conflicting = goldChanges.map((change) => ({ ...change }));
    conflicting[conflicting.length - 1] = {
      ...conflicting[conflicting.length - 1],
      change: -Math.abs(conflicting[conflicting.length - 1].change),
    };
    target.dailyChanges = conflicting;
    target.h4Changes = conflicting;
    target.change = conflicting.at(-1).change;
    target.changeUnit = target.kind === 'yield' ? 'pp' : 'price';
  }

  return instruments;
}

test('registry contains exactly five real-provider core instruments', () => {
  assert.equal(INSTRUMENT_DEFS.length, 5);
  const ids = INSTRUMENT_DEFS.map((def) => def.id);
  assert.deepEqual(ids, ['dxy', 'us10y', 'us10y_real', 'us02y', 'wti']);
  for (const def of INSTRUMENT_DEFS) {
    assert.ok(['yahoo', 'fred'].includes(def.provider), `${def.id} must use a real provider`);
    assert.ok(!('isSimulated' in def), 'instrument definitions must not be simulated');
  }
  assert.equal(CALC_VERSION, 'gold-intermarket-v2');
  for (const def of INSTRUMENT_DEFS) {
    assert.ok(['CORE', 'CONFIRMATION', 'CONDITIONAL'].includes(def.role), `${def.id} needs a role`);
    assert.ok(typeof def.influenceGroup === 'string' && def.influenceGroup.length > 0, `${def.id} needs an influence group`);
  }
  const wti = INSTRUMENT_DEFS.find((def) => def.id === 'wti');
  assert.equal(wti.fallback, undefined, 'WTI must not be substituted with Brent');
  assert.equal(wti.ticker, 'CL=F');
});

test('Yahoo parser drops all-zero holiday placeholder bars', () => {
  const result = {
    timestamp: [1000, 2000, 3000, 4000],
    indicators: {
      quote: [{
        open: [100, 0, 101, 0],
        high: [102, 0, 103, 0],
        low: [99, 0, 100, 0],
        close: [101, 0, 102, 0],
        volume: [10, 0, 10, 0],
      }],
    },
  };
  const candles = parseYahooCandles(result);
  assert.equal(candles.length, 2, 'zero OHLC placeholders must be discarded');
  assert.deepEqual(candles.map((candle) => candle.close), [101, 102]);
});

test('status distinguishes LIVE, DELAYED, STALE, UNAVAILABLE', () => {
  const now = new Date('2026-02-01T12:00:00Z').getTime();
  assert.equal(classifyStatus({ hasData: false, updatedAt: null }), 'UNAVAILABLE');
  assert.equal(classifyStatus({
    hasData: true,
    updatedAt: new Date(now - 60_000).toISOString(),
    now,
    liveWindowMs: LIVE_WINDOW_MS,
    marketState: 'REGULAR',
  }), 'LIVE');
  assert.equal(classifyStatus({
    hasData: true,
    updatedAt: new Date(now - 60_000).toISOString(),
    now,
    liveWindowMs: LIVE_WINDOW_MS,
    marketState: 'CLOSED',
  }), 'DELAYED', 'closed market must not be labelled LIVE');
  assert.equal(classifyStatus({
    hasData: true,
    updatedAt: new Date(now - LIVE_WINDOW_MS - 60_000).toISOString(),
    now,
    liveWindowMs: LIVE_WINDOW_MS,
    marketState: 'REGULAR',
  }), 'DELAYED');
  assert.equal(classifyStatus({
    hasData: true,
    updatedAt: new Date(now - 30 * 86400000).toISOString(),
    now,
  }), 'STALE');
});

test('yield changes are percentage points, not price percentage returns', () => {
  assert.ok(Math.abs(changeOf(4.5, 4.55, 'yield') - 0.05) < 1e-9);
  assert.equal(changeOf(100, 101, 'price'), 0.01);
  assert.equal(changeOf(0, 101, 'price'), null);
});

test('US02Y/real-yield normalization keeps yield units and marks H4 unavailable', () => {
  const observations = Array.from({ length: 30 }, (_, index) => ({
    date: dayKey(index),
    value: 4.4 + index * 0.01,
  }));
  const normalized = normalizeFredInstrument(
    { id: 'us02y', symbol: 'US02Y', label: 'US 2Y', kind: 'yield', unit: 'percent', series: 'DGS2' },
    { ok: true, provider: 'FRED', providerSymbol: 'DGS2', observations },
    new Date('2026-02-01T00:00:00Z').getTime(),
  );
  assert.ok(Math.abs(normalized.change - 0.01) < 1e-9);
  assert.equal(normalized.changeUnit, 'pp');
  assert.equal(normalized.changePercent, null);
  assert.equal(normalized.h4.available, false);
  assert.equal(normalized.status, 'DELAYED');
  assert.ok(normalized.d1.trend === 'BULLISH');
});

test('price normalization converts changes to percent and computes D1/H4 trend', () => {
  const candles = Array.from({ length: 30 }, (_, index) => ({
    timestamp: new Date(Date.UTC(2026, 0, 1 + index, 12)).toISOString(),
    open: 90 + index,
    high: 95 + index,
    low: 89 + index,
    close: 94 + index,
    volume: 100,
  }));
  const normalized = normalizeYahooInstrument(
    { id: 'dxy', symbol: 'DXY', label: 'DXY', kind: 'price', unit: 'index', ticker: 'DX-Y.NYB' },
    {
      ok: true,
      provider: 'Yahoo Finance',
      providerSymbol: 'DX-Y.NYB',
      meta: {
        regularMarketPrice: 123,
        previousClose: 120,
        regularMarketTime: new Date('2026-01-30T12:00:00Z').toISOString(),
        marketState: 'CLOSED',
      },
      candles,
    },
    { ok: true, provider: 'Yahoo Finance', candles },
    new Date('2026-01-31T00:00:00Z').getTime(),
  );
  assert.equal(normalized.change, 1);
  assert.ok(Math.abs(normalized.changePercent - (1 / 122) * 100) < 1e-9);
  assert.equal(normalized.changeUnit, 'price');
  assert.equal(normalized.d1.trend, 'BULLISH');
  assert.equal(normalized.h4.trend, 'BULLISH');
  assert.equal(normalized.status, 'DELAYED');
});

test('trend and status helpers honour insufficiency and staleness', () => {
  assert.equal(computeTrend([1, 2, 3]).trend, 'UNKNOWN');
  assert.equal(computeTrend(Array.from({ length: 25 }, (_, index) => 100 + index)).trend, 'BULLISH');
  assert.equal(computeTrend(Array.from({ length: 25 }, (_, index) => 200 - index)).trend, 'BEARISH');
  assert.equal(classifyStatus({ hasData: false, updatedAt: null }), 'UNAVAILABLE');
  assert.equal(classifyStatus({ hasData: true, updatedAt: new Date().toISOString(), now: Date.now() }), 'DELAYED');
  assert.equal(classifyStatus({
    hasData: true,
    updatedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    now: Date.now(),
  }), 'STALE');
});

test('correlation requires enough aligned pairs and detects inverse linkage', () => {
  const short = alignCorrelation(makeChanges(10), makeChanges(10));
  assert.equal(short.r, null);
  assert.equal(short.n, 10);

  const gold = makeChanges(31, 0.01, 1);
  const factor = invert(gold);
  const aligned = alignCorrelation(gold, factor);
  assert.equal(aligned.n, 31);
  assert.ok(aligned.r < -0.99);
});

test('bias UP when negative-correlation factors fall, with confirmation', () => {
  const goldChanges = makeChanges(31, 0.01, 1);
  const instruments = coreInstruments(goldChanges);
  const analysis = buildGoldIntermarketAnalysis({
    instruments,
    gold: { latest: 4000, dailyChanges: goldChanges, h4Changes: goldChanges },
    now: new Date('2026-02-01T00:00:00Z').getTime(),
  });
  assert.equal(analysis.status, 'OK');
  assert.equal(analysis.bias, 'UP');
  assert.ok(analysis.confirmationCount >= 3);
  assert.equal(analysis.conflictCount, 0);
  assert.ok(analysis.supportsUp.length >= 4);
  assert.equal(analysis.supportsDown.length, 0);
  assert.equal(analysis.oil.validated, false, 'oil must not be validated without historical correlation');
  assert.ok(!analysis.supportsUp.some((item) => item.id === 'wti'));
  assert.ok(analysis.unvalidated.some((item) => item.id === 'wti'));
  assert.ok(['WEAK', 'MODERATE', 'STRONG'].includes(analysis.strength));
  assert.equal(analysis.independentConfirmationCount, 2, 'USD + RATES clusters only');
  const weights = new Map(analysis.factorMetrics.map((metric) => [metric.id, metric.weight]));
  const ratesWeight = ['us10y', 'us02y', 'us10y_real']
    .reduce((sum, id) => sum + (weights.get(id) || 0), 0);
  assert.ok(Math.abs(ratesWeight - weights.get('dxy')) < 0.02, 'correlated rates must share one group weight');
  assert.ok(analysis.factorMetrics.every((metric) => Number.isFinite(metric.redundancy)));
});

test('bias DOWN when negative-correlation factors rise', () => {
  const goldChanges = makeChanges(30, 0.01, 1);
  const instruments = coreInstruments(goldChanges);
  const analysis = buildGoldIntermarketAnalysis({
    instruments,
    gold: { latest: 4000, dailyChanges: goldChanges, h4Changes: goldChanges },
    now: new Date('2026-02-01T00:00:00Z').getTime(),
  });
  assert.equal(analysis.bias, 'DOWN');
  assert.ok(analysis.supportsDown.length >= 4);
});

test('missing core instrument forces INSUFFICIENT DATA', () => {
  const goldChanges = makeChanges(31, 0.01, 1);
  const instruments = coreInstruments(goldChanges).filter((instrument) => instrument.id !== 'us02y');
  const analysis = buildGoldIntermarketAnalysis({
    instruments,
    gold: { latest: 4000, dailyChanges: goldChanges, h4Changes: goldChanges },
    now: Date.now(),
  });
  assert.equal(analysis.bias, 'INSUFFICIENT DATA');
  assert.equal(analysis.status, 'INSUFFICIENT_DATA');
  assert.ok(analysis.dataCompleteness.missing.includes('US02Y'));
  assert.match(analysis.narrative, /INSUFFICIENT DATA/);
});

test('STALE instrument is displayed but never weighted as fresh evidence', () => {
  const goldChanges = makeChanges(31, 0.01, 1);
  const instruments = coreInstruments(goldChanges);
  instruments.find((instrument) => instrument.id === 'us10y').status = 'STALE';
  const analysis = buildGoldIntermarketAnalysis({
    instruments,
    gold: { latest: 4000, dailyChanges: goldChanges, h4Changes: goldChanges },
    now: Date.now(),
  });
  assert.ok(analysis.dataCompleteness.staleInstruments.includes('US10Y'));
  assert.ok(analysis.unvalidated.some((item) => item.id === 'us10y' && /usang|STALE/i.test(item.reason)));
  const us10y = analysis.factorMetrics.find((metric) => metric.id === 'us10y');
  assert.equal(us10y.weight, 0);
  assert.equal(us10y.validated, true, 'correlation still exists, but weight is withheld');
});

test('stale/missing core factor (DXY or real yield) forces INSUFFICIENT DATA', () => {
  const goldChanges = makeChanges(31, 0.01, 1);
  const instruments = coreInstruments(goldChanges);
  instruments.find((instrument) => instrument.id === 'us10y_real').status = 'STALE';
  const analysis = buildGoldIntermarketAnalysis({
    instruments,
    gold: { latest: 4000, dailyChanges: goldChanges, h4Changes: goldChanges },
    now: Date.now(),
  });
  assert.equal(analysis.dataCompleteness.coreFactorsUsable, false);
  assert.equal(analysis.bias, 'INSUFFICIENT DATA');
});

test('conflicting factor is reported, not hidden', () => {
  const goldChanges = makeChanges(31, 0.01, 1);
  const instruments = coreInstruments(goldChanges, { conflictId: 'us10y', oilFlat: true });
  const analysis = buildGoldIntermarketAnalysis({
    instruments,
    gold: { latest: 4000, dailyChanges: goldChanges, h4Changes: goldChanges },
    now: Date.now(),
  });
  assert.ok(analysis.conflictCount >= 1);
  assert.ok(analysis.conflicts.some((conflict) => conflict.id === 'us10y'));
  assert.ok(analysis.conflicts.some((conflict) => conflict.type === 'FACTOR_OPPOSES_BIAS'));
});

test('correlation uses the recent window and reports regime stability', () => {
  const gold = makeChanges(300, 0.01, 1);
  const inverse = invert(gold);
  const windowed = alignCorrelation(gold, inverse, { window: CORRELATION_WINDOW_DAYS });
  assert.equal(windowed.n, CORRELATION_WINDOW_DAYS);
  assert.ok(windowed.r < -0.99);
  assert.equal(windowed.stability.status, 'STABLE');

  const xs = Array.from({ length: CORRELATION_WINDOW_DAYS }, (_, index) => (index % 2 ? -1 : 1));
  const flippedPairs = xs.map((value, index) => [value, index < CORRELATION_WINDOW_DAYS / 2 ? -value : value]);
  const unstable = computeStability(flippedPairs);
  assert.equal(unstable.status, 'UNSTABLE');
  assert.ok(unstable.firstHalf < 0);
  assert.ok(unstable.secondHalf > 0);
});

test('validation flags missing provider, timestamp, and unit mismatches', () => {
  const good = validateInstrument({
    latest: 4.5,
    updatedAt: '2026-01-30T12:00:00.000Z',
    provider: 'FRED',
    unit: 'percent',
    kind: 'yield',
    changeUnit: 'pp',
    change: 0.01,
    dailyPoints: [{ key: '2026-01-30', value: 4.49 }],
  });
  assert.equal(good.ok, true);
  assert.deepEqual(good.warnings, []);

  const bad = validateInstrument({
    latest: 4.5,
    updatedAt: null,
    provider: '',
    unit: 'usd',
    kind: 'yield',
    changeUnit: 'price',
    change: null,
    dailyPoints: [{ key: '2026-01-30', value: 4.49 }],
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.warnings.length >= 4);
});

test('stability helper requires enough pairs and agrees with split halves', () => {
  assert.equal(computeStability([]).status, 'UNKNOWN');
  const pairs = makeChanges(60, 0.01, 1).map((change) => [change.change, -change.change]);
  assert.equal(computeStability(pairs).status, 'STABLE');
});

test('Broker Workspace exposes the fourth tab without removing existing tabs', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'BrokerWorkspace.jsx'), 'utf8');
  for (const label of ['JINI MONITOR', 'S&amp;D ENGINE', 'SCALPING M1', 'FAKTOR UP/DOWN GOLD']) {
    assert.ok(source.includes(label), `missing tab label: ${label}`);
  }
  assert.ok(source.includes("panelTab === 'goldFactors'"));
  assert.ok(source.includes('FaktorUpDownGoldPanel'));
  for (const existing of ["panelTab === 'monitor'", "panelTab === 'supplyDemand'", "panelTab === 'scalping'"]) {
    assert.ok(source.includes(existing), `existing tab wiring changed: ${existing}`);
  }
});

{
  const { errorText, displayText, fetchGoldIntermarketFactors } = await import('../src/services/trading/goldIntermarketClient.js');
  assert.equal(errorText({ error: { message: 'Route not found' } }), 'Route not found');
  assert.equal(errorText({ reason: { detail: 'provider down' } }), 'provider down');
  assert.equal(errorText(null), '');

  // Regression: provider objects must never render as "[object Object]".
  assert.equal(displayText({ message: 'ok' }), 'ok');
  assert.equal(displayText({ reason: { detail: 'nested reason' } }), 'nested reason');
  assert.equal(displayText({ label: 'DXY' }), 'DXY');
  assert.equal(displayText({ foo: 'bar' }), '—', 'unknown object shape uses a clear fallback');
  assert.equal(displayText([{ message: 'a' }, { message: 'b' }]), 'a · b');
  assert.ok(!displayText({ foo: 'bar' }).includes('[object Object]'));
  assert.ok(!displayText({ nested: { deep: 1 } }).includes('[object Object]'));
  assert.equal(displayText(undefined, 'fallback'), 'fallback');
  assert.equal(displayText(false), 'false');
  passed += 1;
  console.log('ok - displayText never renders [object Object]');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    status: 404,
    ok: false,
    text: async () => JSON.stringify({ error: { message: 'Route /trading/gold-intermarket-factors not found' } }),
  });
  try {
    await assert.rejects(
      fetchGoldIntermarketFactors(),
      /belum aktif di LocalRouter/,
      '404 must produce a human-readable restart instruction, not [object Object]',
    );
    passed += 1;
    console.log('ok - client turns 404 object errors into a readable message');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('crypto computes trend and actual correlation in one unweighted CRYPTO group', () => {
  const now = Date.parse('2026-02-01T00:00:00Z');
  const raw = cryptoRawFixture({ now });
  const goldChanges = makeChanges(31, 0.01, 1);
  const crypto = buildCryptoRiskSentiment({
    raw,
    gold: { dailyChanges: goldChanges, h4Changes: goldChanges },
    now,
  });
  assert.equal(crypto.ok, true);
  assert.equal(crypto.status, 'LIVE');
  assert.match(crypto.statusDetail, /REST snapshot/);
  assert.equal(crypto.group, CRYPTO_GROUP);
  const btc = crypto.assets.BTC;
  assert.ok(btc.correlationD1.r < -0.99, 'BTC correlation must derive from aligned actual data');
  assert.equal(btc.correlationD1.validated, true);
  assert.equal(btc.trends.D1.available, true);
  assert.equal(crypto.factor.influenceGroup, 'CRYPTO');
  assert.equal(crypto.factor.weight, 0);
  assert.equal(crypto.factor.contribution, 0);
  assert.equal(crypto.factor.appliedToMacroScore, false);
  assert.equal(crypto.factor.direction, -1);
  assert.match(crypto.factor.reason, /tidak diubah|tidak mengubah|bobot makro/i);
});

test('crypto keeps spot and futures prices separate and funding as a condition', () => {
  const now = Date.parse('2026-02-01T00:00:00Z');
  const crypto = buildCryptoRiskSentiment({
    raw: cryptoRawFixture({ now }),
    gold: { dailyChanges: makeChanges(31, 0.01, 1), h4Changes: makeChanges(31, 0.01, 1) },
    now,
  });
  const btc = crypto.assets.BTC;
  assert.equal(btc.latest, 50000, 'spot price must come from the spot ticker');
  assert.equal(btc.futures.markPrice, 50100, 'futures mark price must stay in the futures block');
  assert.equal(btc.futures.priceChangePercent, null);
  assert.equal(btc.futures.openInterestChangePct, 10);
  assert.equal(btc.futures.fundingCondition.status, 'POSITIVE');
  assert.match(btc.futures.fundingCondition.note, /TIDAK otomatis/);
  assert.equal(btc.futures.liquidations.restricted, true);
  assert.equal(btc.futures.liquidations.count, null);
});

test('crypto never alters macro bias, score, or factor weights', () => {
  const now = Date.parse('2026-02-01T00:00:00Z');
  const goldChanges = makeChanges(31, 0.01, 1);
  const instruments = coreInstruments(goldChanges);
  const gold = { latest: 4000, dailyChanges: goldChanges, h4Changes: goldChanges };
  const base = buildGoldIntermarketAnalysis({ instruments, gold, now });
  const crypto = buildCryptoRiskSentiment({ raw: cryptoRawFixture({ now }), gold, now });
  const withCrypto = buildGoldIntermarketAnalysis({ instruments, gold, crypto, now });
  assert.equal(withCrypto.bias, base.bias);
  assert.equal(withCrypto.score, base.score);
  assert.equal(withCrypto.confirmationCount, base.confirmationCount);
  assert.deepEqual(withCrypto.factorMetrics, base.factorMetrics);
  assert.ok(!withCrypto.factorMetrics.some((metric) => metric.influenceGroup === 'CRYPTO'));
  assert.equal(withCrypto.crypto.factor.weight, 0);
  assert.equal(withCrypto.crypto.factor.appliedToMacroScore, false);
  assert.match(withCrypto.cryptoNarrative, /tidak mengubah skor makro/);
});

test('crypto unavailable reports UNAVAILABLE without fabricated values', () => {
  const now = Date.parse('2026-02-01T00:00:00Z');
  const crypto = buildCryptoRiskSentiment({
    raw: { ok: false, error: 'Binance down' },
    gold: {},
    now,
  });
  assert.equal(crypto.ok, false);
  assert.equal(crypto.status, 'UNAVAILABLE');
  assert.equal(crypto.factor.weight, 0);
  assert.equal(crypto.factor.appliedToMacroScore, false);
  assert.equal(crypto.assets.BTC, null);
  assert.match(crypto.error, /Binance down/);
  const aligned = alignCryptoWithBias(crypto, 'UP');
  assert.equal(aligned.alignment, 'UNKNOWN');
});

test('unreachable futures stay UNAVAILABLE while spot remains usable', () => {
  const now = Date.parse('2026-02-01T00:00:00Z');
  const crypto = buildCryptoRiskSentiment({
    raw: cryptoRawFixture({ now, futuresReachable: false }),
    gold: { dailyChanges: makeChanges(31, 0.01, 1), h4Changes: makeChanges(31, 0.01, 1) },
    now,
  });
  const btc = crypto.assets.BTC;
  assert.equal(btc.spotOk, true);
  assert.equal(btc.latest, 50000);
  assert.equal(btc.futures.status, 'UNAVAILABLE');
  assert.equal(btc.futures.available, false);
  assert.equal(btc.futures.openInterest, null);
  assert.equal(btc.futures.markPrice, null);
  assert.match(btc.futures.statusDetail, /tidak terjangkau|tidak tersedia/i);
  assert.equal(crypto.futuresReachable, false);
  assert.ok(!Number.isFinite(btc.futures.fundingRate));
});

test('crypto trend/status helpers are deterministic and live only when fresh', () => {
  assert.equal(computeCryptoTrend([1, 2, 3]).trend, 'UNKNOWN');
  assert.equal(computeCryptoTrend(Array.from({ length: 25 }, (_, index) => 100 + index)).trend, 'BULLISH');
  assert.equal(computeCryptoTrend(Array.from({ length: 25 }, (_, index) => 200 - index)).trend, 'BEARISH');
  const now = Date.parse('2026-02-01T00:00:00Z');
  assert.equal(classifyCryptoStatus({ hasData: false }), 'UNAVAILABLE');
  assert.equal(classifyCryptoStatus({ hasData: true, updatedAt: new Date(now - 30_000).toISOString(), now }), 'LIVE');
  assert.equal(classifyCryptoStatus({ hasData: true, updatedAt: new Date(now - 5 * 60_000).toISOString(), now }), 'DELAYED');
  assert.equal(classifyCryptoStatus({ hasData: true, updatedAt: new Date(now - 30 * 60_000).toISOString(), now }), 'STALE');
  const changes = computeCryptoChanges([
    { openTime: Date.UTC(2026, 0, 1), close: 100 },
    { openTime: Date.UTC(2026, 0, 2), close: 110 },
  ]);
  assert.equal(changes.length, 1);
  assert.ok(Math.abs(changes[0].change - 0.1) < 1e-9);
});

test('alignCryptoWithBias confirms/opposes without changing the macro call', () => {
  const crypto = { ok: true, factor: { validated: true, direction: -1 } };
  assert.equal(alignCryptoWithBias(crypto, 'DOWN').alignment, 'CONFIRMS');
  assert.equal(alignCryptoWithBias(crypto, 'UP').alignment, 'OPPOSES');
  assert.equal(alignCryptoWithBias(crypto, 'MIXED').alignment, 'CONTEXT_ONLY');
  assert.equal(alignCryptoWithBias({ ok: true, factor: { validated: false, direction: 0 } }, 'UP').alignment, 'UNKNOWN');
  assert.equal(alignCryptoWithBias(null, 'UP'), null);
});

console.log(`\n${passed} tests passed.`);
