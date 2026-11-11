/**
 * MarketDataService — candle bucketing/merge regression (no network).
 * Run: node tests/market-data-candle-bucketing.test.mjs
 */
import assert from 'node:assert/strict';
import { MarketDataService } from '../src/services/trading/MarketDataService.js';

const base = { symbol: 'XAUUSD', timeframe: 'M1', volume: 0, source: 'YAHOO_FINANCE' };
const service = new MarketDataService();

service.addBatchCandles([
  { ...base, timestamp: '2026-11-11T14:30:00.000Z', open: 4072.7, high: 4073, low: 4070.2, close: 4070.8 },
  { ...base, timestamp: '2026-11-11T14:30:40.000Z', open: 4071, high: 4071, low: 4071, close: 4071 },
]);

const afterBatch = service.getCandles('XAUUSD', 'M1');
assert.equal(afterBatch.length, 1, 'partial updates within the same minute must not create extra candles');
assert.equal(afterBatch[0].timestamp, '2026-11-11T14:30:00.000Z');
assert.equal(afterBatch[0].open, 4072.7);
assert.equal(afterBatch[0].high, 4073);
assert.equal(afterBatch[0].low, 4070.2);
assert.equal(afterBatch[0].close, 4071);
console.log('ok - same-period partial updates collapse into one candle');

service.addCandle({ ...base, timestamp: '2026-11-11T14:30:52.000Z', open: 4071.1, high: 4071.5, low: 4071, close: 4071.4 });
const afterTick = service.getCandles('XAUUSD', 'M1');
assert.equal(afterTick.length, 1);
assert.equal(afterTick[0].high, 4073, 'merged high keeps the widest range');
assert.equal(afterTick[0].low, 4070.2, 'merged low keeps the widest range');
assert.equal(afterTick[0].close, 4071.4, 'latest update moves the close');
console.log('ok - later partial update merges OHLC instead of replacing it');

service.addCandle({ ...base, timestamp: '2026-11-11T14:31:05.000Z', open: 4071.4, high: 4072, low: 4071, close: 4071.8 });
assert.equal(service.getCandles('XAUUSD', 'M1').length, 2, 'a new minute still creates a new candle');
console.log('ok - new minute creates a new candle');
