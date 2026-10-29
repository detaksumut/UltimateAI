/**
 * Chart Reader — reads normalized OHLC candles from MarketDataService.
 */
import { marketDataServiceInstance } from './MarketDataService.js';

export function getChartCandles(symbol, timeframe, limit = 100) {
  if (!symbol || !timeframe) return { candles: [], count: 0, freshness: 'UNKNOWN', status: 'INVALID_PARAMS', error: 'Symbol atau timeframe kosong' };
  const effectiveLimit = Math.min(Math.max(1, limit), 500);
  try {
    const source = marketDataServiceInstance.getCandles(symbol, timeframe, effectiveLimit);
    const candles = (source || []).filter(c =>
      c && c.symbol === symbol && c.timeframe === timeframe &&
      ['open', 'high', 'low', 'close', 'volume'].every(k => typeof c[k] === 'number' && Number.isFinite(c[k])) &&
      typeof c.timestamp === 'string' && Number.isFinite(new Date(c.timestamp).getTime()) &&
      c.high >= Math.max(c.open, c.close, c.low) && c.low <= Math.min(c.open, c.close, c.high)
    );
    if (!candles.length) return { candles: [], count: 0, freshness: 'NO_DATA', status: 'NO_DATA', error: 'Tidak ada candle valid untuk instrumen/timeframe ini' };
    const last = candles[candles.length - 1];
    const age = Math.max(0, Date.now() - new Date(last.timestamp).getTime());
    const tfMs = ({ M1: 60000, M5: 300000, M15: 900000, M30: 1800000, H1: 3600000, H4: 14400000, D1: 86400000, W1: 604800000 })[timeframe] || 3600000;
    const freshness = last.isSimulated === true ? 'SIMULATED' : age < tfMs * 2 ? 'FRESH' : age < tfMs * 24 ? 'RECENT' : 'STALE';
    return { candles, count: candles.length, freshness, status: 'READY', error: candles.length < effectiveLimit ? `Hanya ${candles.length} candle tersedia dari ${effectiveLimit} yang diminta` : null };
  } catch (error) {
    return { candles: [], count: 0, freshness: 'ERROR', status: 'ERROR', error: error?.message || 'Gagal membaca data candle' };
  }
}

export function checkDataAvailability(symbol, timeframe, minRequired = 50) {
  const result = getChartCandles(symbol, timeframe, 500);
  return { available: result.count >= minRequired, minRequired, count: result.count, status: result.status, freshness: result.freshness, error: result.error };
}

export function getChartContext({ symbol, timeframe, provider } = {}) {
  return { symbol, timeframe, provider: provider || (symbol === 'XAUUSD' ? 'GOLD' : symbol === 'BTCUSDT' ? 'BINANCE' : 'UNKNOWN'), timestamp: new Date().toISOString(), status: 'UNKNOWN' };
}
