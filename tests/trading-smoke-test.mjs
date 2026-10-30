import assert from 'node:assert/strict';
import { marketDataServiceInstance as market, TIMEFRAMES } from '../src/services/trading/MarketDataService.js';
import { getChartCandles, checkDataAvailability } from '../src/services/trading/ChartReader.js';
import { calculateIndicators } from '../src/services/trading/IndicatorCalculator.js';

const symbol = 'TESTUSDT';
const timeframe = TIMEFRAMES.M15 || 'M15';

// Empty state and invalid input must fail safely.
assert.equal(getChartCandles(symbol, timeframe, 50).status, 'NO_DATA');
assert.equal(market.addCandle({ symbol, timeframe, open: 1, high: 0, low: 0, close: 1, volume: 1, timestamp: new Date().toISOString() }), false);

// Missing broker volume is allowed, while malformed OHLC is still rejected.
const secondsTimestamp = Math.floor(Date.now() / 1000);
assert.equal(market.addCandle({
  symbol, timeframe, timestamp: secondsTimestamp,
  open: 10, high: 12, low: 9, close: 11,
}), true);
assert.equal(market.getLatestCandle(symbol, timeframe).timestamp,
  new Date(secondsTimestamp * 1000).toISOString());
assert.equal(market.addCandle({
  symbol, timeframe, timestamp: new Date().toISOString(),
  open: 10, high: 8, low: 9, close: 11,
}), false);

// Generate deterministic, valid, fresh candles to exercise the real service pipeline.
const now = Date.now();
const candles = [];
let close = 100;
for (let i = 59; i >= 0; i--) {
  const open = close;
  close = open + 0.2 + (i % 3) * 0.01;
  candles.push({
    symbol, timeframe,
    timestamp: new Date(now - i * 60_000).toISOString(),
    open, high: close + 0.15, low: open - 0.1, close,
    volume: 100 + i, source: 'smoke-test', isSimulated: false,
  });
}
assert.equal(market.addBatchCandles(candles), 60);
const result = getChartCandles(symbol, timeframe, 60);
assert.equal(result.status, 'READY');
assert.equal(result.count, 60);
assert.equal(result.freshness, 'FRESH');
assert.equal(result.candles.at(-1).symbol, symbol);
assert.equal(checkDataAvailability(symbol, timeframe, 50).available, true);

// Indicator values should be numeric on sufficient data.
const indicators = calculateIndicators(result.candles, { emaPeriods: [9, 20, 50], rsiPeriod: 14, atrPeriod: 14 });
assert.equal(indicators.error, null);
assert.ok(Number.isFinite(indicators.ema[9]));
assert.ok(Number.isFinite(indicators.ema[20]));
assert.ok(Number.isFinite(indicators.ema[50]));
assert.ok(Number.isFinite(indicators.rsi));
assert.ok(Number.isFinite(indicators.atr));
assert.ok(indicators.atr > 0);

// Tick validation and subscriber notification.
let notified = false;
const unsubscribe = market.subscribe(() => { notified = true; });
assert.equal(market.setTick(symbol, { bid: 123.4, ask: 123.5, source: 'smoke-test' }), true);
assert.equal(market.setTick(symbol, { bid: 124, ask: 123, source: 'smoke-test' }), false);
assert.equal(market.getTick(symbol).bid, 123.4);
assert.equal(notified, true);
unsubscribe();

console.log('Trading smoke tests passed: candle validation, storage, freshness, availability, EMA/RSI/ATR, tick validation, subscriptions.');
