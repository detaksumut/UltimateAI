/**
 * IndicatorCalculator — EMA, RSI and ATR calculated from OHLC candles.
 */
function ema(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  const k = 2 / (period + 1);
  let current = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  const result = [current];
  for (let i = period; i < values.length; i++) {
    current = values[i] * k + current * (1 - k);
    result.push(current);
  }
  return result;
}

function rsi(values, period = 14) {
  if (!Array.isArray(values) || values.length < period + 1) return null;
  const gains = [], losses = [];
  for (let i = 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    gains.push(Math.max(change, 0));
    losses.push(Math.max(-change, 0));
  }
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const result = [null];
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }
  return result;
}

function atr(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < period + 1) return null;
  const ranges = [];
  for (let i = 1; i < candles.length; i++) {
    const { high, low } = candles[i], previousClose = candles[i - 1].close;
    ranges.push(Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose)));
  }
  let current = ranges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const result = [null];
  for (let i = period; i < ranges.length; i++) {
    current = (current * (period - 1) + ranges[i]) / period;
    result.push(current);
  }
  return result;
}

export function calculateIndicators(candles, { emaPeriods = [20, 50], rsiPeriod = 14, atrPeriod = 14 } = {}) {
  if (!Array.isArray(candles) || candles.length < Math.max(...emaPeriods, rsiPeriod + 1, atrPeriod + 1)) {
    return { ema: {}, rsi: null, atr: null, error: 'INSUFFICIENT_DATA' };
  }
  const closes = candles.map(c => c.close);
  const emaValues = {};
  emaPeriods.forEach(period => {
    const values = ema(closes, period);
    emaValues[period] = values ? values[values.length - 1] : null;
  });
  const rsiValues = rsi(closes, rsiPeriod), atrValues = atr(candles, atrPeriod);
  return { ema: emaValues, rsi: rsiValues ? rsiValues[rsiValues.length - 1] : null, atr: atrValues ? atrValues[atrValues.length - 1] : null, error: null };
}
export { ema, rsi, atr };
