/**
 * IndicatorCalculator.js — EMA, RSI and ATR from OHLC candles.
 */
function ema(values, period) {
  if (!values || values.length < period) return null;
  const k = 2 / (period + 1);
  let current = values.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
  const result = [current];
  for (let i = period; i < values.length; i++) { current = values[i] * k + current * (1 - k); result.push(current); }
  return result;
}
function rsi(values, period = 14) {
  if (!values || values.length < period + 1) return null;
  const gains = [], losses = [];
  for (let i = 1; i < values.length; i++) {
    const change = values[i] - values[i - 1]; gains.push(Math.max(change, 0)); losses.push(Math.max(-change, 0));
  }
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const firstRs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  const result = [100 - 100 / (1 + firstRs)];
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }
  return result;
}
function atr(candles, period = 14) {
  if (!candles || candles.length < period + 1) return null;
  const ranges = [];
  for (let i = 1; i < candles.length; i++) {
    const { high, low } = candles[i], prevClose = candles[i - 1].close;
    ranges.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  let current = ranges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const result = [current];
  for (let i = period; i < ranges.length; i++) { current = (current * (period - 1) + ranges[i]) / period; result.push(current); }
  return result;
}
function macd(closes, fast = 12, slow = 26, signal = 9) {
  if (!closes || closes.length < slow + signal) return { macd: null, signal: null, histogram: null };
  const emaFast = ema(closes, fast), emaSlow = ema(closes, slow);
  if (!emaFast || !emaSlow) return { macd: null, signal: null, histogram: null };
  const macdLine = emaFast.map((v, i) => v - (emaSlow[i] || 0));
  const macdSignal = ema(macdLine, signal);
  if (!macdSignal) return { macd: null, signal: null, histogram: null };
  const lastMacd = macdLine[macdLine.length - 1];
  const lastSignal = macdSignal[macdSignal.length - 1];
  return { macd: lastMacd, signal: lastSignal, histogram: lastMacd - lastSignal };
}
function detectCandlestickPattern(candles) {
  if (!candles || candles.length < 3) return { pattern: 'NONE', strength: 0, bullish: false, bearish: false };
  const c = candles[candles.length - 1];
  const p1 = candles[candles.length - 2];
  const p2 = candles[candles.length - 3];
  const body = Math.abs(c.close - c.open);
  const range = c.high - c.low;
  const upperWick = c.high - Math.max(c.open, c.close);
  const lowerWick = Math.min(c.open, c.close) - c.low;
  const isDoji = body <= range * 0.1;
  const isHammer = lowerWick >= body * 2 && upperWick <= body * 0.5 && range > body * 3;
  const isShootingStar = upperWick >= body * 2 && lowerWick <= body * 0.5 && range > body * 3;
  const isBullishEngulfing = c.close > c.open && p1.close < p1.open && c.close > p1.open && c.open < p1.close;
  const isBearishEngulfing = c.close < c.open && p1.close > p1.open && c.close < p1.open && c.open > p1.close;
  let pattern = 'NONE', strength = 0, bullish = false, bearish = false;
  if (isBullishEngulfing) { pattern = 'BULLISH_ENGULFING'; strength = 8; bullish = true; }
  else if (isBearishEngulfing) { pattern = 'BEARISH_ENGULFING'; strength = 8; bearish = true; }
  else if (isHammer && c.close > p1.close) { pattern = 'HAMMER'; strength = 6; bullish = true; }
  else if (isShootingStar && c.close < p1.close) { pattern = 'SHOOTING_STAR'; strength = 6; bearish = true; }
  else if (isDoji) { pattern = 'DOJI'; strength = 3; }
  return { pattern, strength, bullish, bearish };
}
function detectSupplyDemand(candles, lookback = 50) {
  if (!candles || candles.length < lookback) return { supply: null, demand: null };
  const recent = candles.slice(-lookback);
  const highs = recent.map(c => c.high);
  const lows = recent.map(c => c.low);
  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);
  const maxHighIdx = highs.indexOf(maxHigh);
  const minLowIdx = lows.indexOf(minLow);
  const supplyZone = { price: maxHigh, strength: maxHighIdx >= recent.length - 10 ? 'RECENT' : 'OLDER', touches: highs.filter(h => Math.abs(h - maxHigh) <= maxHigh * 0.002).length };
  const demandZone = { price: minLow, strength: minLowIdx >= recent.length - 10 ? 'RECENT' : 'OLDER', touches: lows.filter(l => Math.abs(l - minLow) <= minLow * 0.002).length };
  return { supply: supplyZone, demand: demandZone };
}
function analyzeVolume(candles, period = 20) {
  if (!candles || candles.length < period + 1) return { volumeSpike: false, avgVolume: null, currentVolume: null, volumeTrend: 'UNKNOWN' };
  const recent = candles.slice(-period);
  const volumes = recent.map(c => c.volume || 0);
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const currentVolume = candles[candles.length - 1].volume || 0;
  const prevVolumes = volumes.slice(0, -1);
  const prevAvg = prevVolumes.reduce((a, b) => a + b, 0) / prevVolumes.length;
  return { volumeSpike: currentVolume > avgVolume * 1.5, avgVolume, currentVolume, volumeTrend: currentVolume > prevAvg * 1.2 ? 'INCREASING' : currentVolume < prevAvg * 0.8 ? 'DECREASING' : 'STABLE' };
}
function detectTrendStructure(candles) {
  if (!candles || candles.length < 20) return { structure: 'UNKNOWN', higherHighs: false, higherLows: false, lowerHighs: false, lowerLows: false };
  const recent = candles.slice(-20);
  const highs = recent.map(c => c.high);
  const lows = recent.map(c => c.low);
  const firstHalfHighs = highs.slice(0, 10);
  const secondHalfHighs = highs.slice(10);
  const firstHalfLows = lows.slice(0, 10);
  const secondHalfLows = lows.slice(10);
  const firstHigh = Math.max(...firstHalfHighs);
  const secondHigh = Math.max(...secondHalfHighs);
  const firstLow = Math.min(...firstHalfLows);
  const secondLow = Math.min(...secondHalfLows);
  const higherHighs = secondHigh > firstHigh;
  const higherLows = secondLow > firstLow;
  const lowerHighs = secondHigh < firstHigh;
  const lowerLows = secondLow < firstLow;
  let structure = 'UNKNOWN';
  if (higherHighs && higherLows) structure = 'UPTREND';
  else if (lowerHighs && lowerLows) structure = 'DOWNTREND';
  else structure = 'RANGE';
  return { structure, higherHighs, higherLows, lowerHighs, lowerLows };
}
export function calculateIndicators(candles, { emaPeriods = [9, 20, 50], rsiPeriod = 14, atrPeriod = 14 } = {}) {
  if (!candles || candles.length < Math.max(...emaPeriods, rsiPeriod + 1, atrPeriod + 1, 26)) return { ema: {}, rsi: null, atr: null, macd: { macd: null, signal: null, histogram: null }, error: 'INSUFFICIENT_DATA', pattern: { pattern: 'NONE', strength: 0, bullish: false, bearish: false }, supplyDemand: { supply: null, demand: null }, volume: { volumeSpike: false, avgVolume: null, currentVolume: null, volumeTrend: 'UNKNOWN' }, structure: { structure: 'UNKNOWN', higherHighs: false, higherLows: false, lowerHighs: false, lowerLows: false } };
  const closes = candles.map(c => c.close), emaResult = {};
  emaPeriods.forEach(p => { const values = ema(closes, p); emaResult[p] = values ? values[values.length - 1] : null; });
  const rsiResult = rsi(closes, rsiPeriod);
  const atrResult = atr(candles, atrPeriod);
  const macdResult = macd(closes);
  const patternResult = detectCandlestickPattern(candles);
  const supplyDemandResult = detectSupplyDemand(candles);
  const volumeResult = analyzeVolume(candles);
  const structureResult = detectTrendStructure(candles);
  return { ema: emaResult, rsi: rsiResult ? rsiResult[rsiResult.length - 1] : null, atr: atrResult ? atrResult[atrResult.length - 1] : null, macd: macdResult, pattern: patternResult, supplyDemand: supplyDemandResult, volume: volumeResult, structure: structureResult, error: null };
}
export { ema, rsi, atr, macd, detectCandlestickPattern, detectSupplyDemand, analyzeVolume, detectTrendStructure };
