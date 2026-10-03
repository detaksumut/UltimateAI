/**
 * TechnicalEngine.mjs — MIE v1 Tahap 1
 * Pure calculation engine: RSI/SMA/EMA/MACD/ATR/Bollinger + swing S/R.
 * NO I/O, NO mock. Input = real close series (Yahoo). Output = auditable numbers.
 */

export function sma(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function ema(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}

export function rsi(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length < period + 1) return null;
  let gain = 0; let loss = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  if (loss === 0) return 100;
  const rs = gain / loss;
  return 100 - 100 / (1 + rs);
}

export function macd(closes, fast = 12, slow = 26, signal = 9) {
  if (!Array.isArray(closes) || closes.length < slow + signal) return null;
  const emaFast = (arr, p) => {
    const k = 2 / (p + 1);
    let e = arr.slice(0, p).reduce((a, b) => a + b, 0) / p;
    for (let i = p; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
    return e;
  };
  const line = emaFast(closes, fast) - emaFast(closes, slow);
  return { line, signal: null, histogram: null, note: 'signal-line needs full series; line only in Tahap 1' };
}

export function atrFromCloses(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length < period + 1) return null;
  let sum = 0;
  for (let i = closes.length - period; i < closes.length; i++) sum += Math.abs(closes[i] - closes[i - 1]);
  return sum / period;
}

export function bollinger(closes, period = 20, mult = 2) {
  if (!Array.isArray(closes) || closes.length < period) return null;
  const slice = closes.slice(-period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const sd = Math.sqrt(slice.reduce((a, v) => a + (v - mid) ** 2, 0) / period);
  return { mid, upper: mid + mult * sd, lower: mid - mult * sd };
}

/**
 * Swing support/resistance from close series.
 * Fractal window=2: local minima/maxima, nearest 3 below/above last close.
 */
export function swingLevels(closes, window = 2, maxEach = 3) {
  if (!Array.isArray(closes) || closes.length < window * 2 + 1) {
    return { support: [], resistance: [] };
  }
  const last = closes[closes.length - 1];
  const lows = []; const highs = [];
  for (let i = window; i < closes.length - window; i++) {
    const v = closes[i];
    let isLow = true; let isHigh = true;
    for (let j = i - window; j <= i + window; j++) {
      if (j === i) continue;
      if (closes[j] < v) isHigh = false;
      if (closes[j] > v) isLow = false;
    }
    if (isLow) lows.push(v);
    if (isHigh) highs.push(v);
  }
  const support = [...new Set(lows)].filter((v) => v < last).sort((a, b) => b - a).slice(0, maxEach);
  const resistance = [...new Set(highs)].filter((v) => v > last).sort((a, b) => a - b).slice(0, maxEach);
  return { support, resistance };
}

export function momentumLabel(rsi14) {
  if (rsi14 == null) return 'UNKNOWN';
  if (rsi14 <= 30) return 'OVERSOLD';
  if (rsi14 >= 70) return 'OVERBOUGHT';
  if (rsi14 >= 55) return 'BULLISH_MOMENTUM';
  if (rsi14 <= 45) return 'BEARISH_MOMENTUM';
  return 'NEUTRAL';
}

export function trendLabel(lastClose, sma20, sma50) {
  if (lastClose == null || sma20 == null) return 'UNKNOWN';
  if (sma50 != null) {
    if (lastClose > sma20 && sma20 > sma50) return 'UPTREND';
    if (lastClose < sma20 && sma20 < sma50) return 'DOWNTREND';
  }
  return lastClose > sma20 ? 'ABOVE_SMA20' : 'BELOW_SMA20';
}

export default { sma, ema, rsi, macd, atrFromCloses, bollinger, swingLevels, momentumLabel, trendLabel };
