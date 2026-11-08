import assert from 'node:assert/strict';
import {
  JIN_FRESHNESS_MAX_AGE_INTERVALS,
  JIN_TRADING_TF_MS,
  resolveCandleFreshness,
} from '../server/local_router/tradingFreshness.mjs';

let passed = 0;
const now = Date.parse('2026-11-08T12:00:00.000Z');

function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  PASS ${name}`);
}

check('fresh candle stays FRESH', () => {
  const result = resolveCandleFreshness({
    lastCandleAt: new Date(now - 60_000).toISOString(),
    timeframe: 'M1',
    now,
  });
  assert.equal(result.status, 'FRESH');
  assert.equal(result.ageMs, 60_000);
  assert.equal(result.maxAgeMs, JIN_TRADING_TF_MS.M1 * JIN_FRESHNESS_MAX_AGE_INTERVALS);
  assert.equal(result.invalidTimestamp, false);
});

check('tick stops but clock advances, candle becomes STALE', () => {
  const candleAt = new Date(now - 10 * 60_000).toISOString();
  const tickStoppedNow = now + (10 * 60_000);
  const result = resolveCandleFreshness({
    lastCandleAt: candleAt,
    timeframe: 'M1',
    now: tickStoppedNow,
  });
  assert.equal(result.status, 'STALE');
  assert.equal(result.ageMs, 20 * 60_000);
});

check('bridge stop ages candle to STALE without new data', () => {
  const candleAt = new Date(now - 4 * 3_600_000).toISOString();
  const result = resolveCandleFreshness({
    lastCandleAt: candleAt,
    timeframe: 'H1',
    now,
  });
  assert.equal(result.status, 'STALE');
  assert.ok(result.ageMs > result.maxAgeMs);
});

check('old candle timestamp is STALE while market is open', () => {
  const mondayOpen = Date.parse('2026-11-09T12:00:00.000Z');
  const result = resolveCandleFreshness({
    lastCandleAt: '2026-11-06T23:57:00.000Z',
    timeframe: 'M5',
    now: mondayOpen,
  });
  assert.equal(result.status, 'STALE');
});

check('last Friday candle stays FRESH while market is closed for the weekend', () => {
  const result = resolveCandleFreshness({
    lastCandleAt: '2026-11-06T23:57:00.000Z',
    timeframe: 'M5',
    now,
  });
  assert.equal(result.status, 'FRESH');
  assert.equal(result.marketClosed, true);
});

check('candle from a previous week is STALE even on weekends', () => {
  const result = resolveCandleFreshness({
    lastCandleAt: '2026-10-30T23:57:00.000Z',
    timeframe: 'M5',
    now,
  });
  assert.equal(result.status, 'STALE');
  assert.equal(result.marketClosed, true);
});

check('invalid candle timestamp is marked invalid', () => {
  const result = resolveCandleFreshness({
    lastCandleAt: 'not-a-date',
    timeframe: 'M1',
    now,
  });
  assert.equal(result.status, 'STALE');
  assert.equal(result.invalidTimestamp, true);
  assert.equal(result.lastCandleAt, null);
});

check('fresh data after stale recovers to FRESH', () => {
  const stale = resolveCandleFreshness({
    lastCandleAt: new Date(now - 30 * 60_000).toISOString(),
    timeframe: 'M1',
    now,
  });
  const recovered = resolveCandleFreshness({
    lastCandleAt: new Date(now - 30_000).toISOString(),
    timeframe: 'M1',
    now,
  });
  assert.equal(stale.status, 'STALE');
  assert.equal(recovered.status, 'FRESH');
});

check('missing candle is NO_DATA', () => {
  const result = resolveCandleFreshness({ lastCandleAt: null, timeframe: 'M1', now });
  assert.equal(result.status, 'NO_DATA');
});

console.log(`Trading freshness tests: ${passed} passed`);
