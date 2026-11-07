/**
 * Chart Reader module — menyediakan data terstruktur bagi AI Analyst dari candlestick grafik.
 * Mengambil OHLC aktual dari MarketDataService, bukan membaca gambar/DOM.
 */
import { marketDataServiceInstance } from './MarketDataService.js';

export function getChartCandles(symbol, timeframe, limit = 100) {
  if (!symbol || !timeframe) return { candles: [], count: 0, requestedTimeframe: timeframe, actualTimeframe: null, freshness: 'UNKNOWN', status: 'INVALID_PARAMS', error: 'Symbol atau timeframe kosong' };
  const targetTf = String(timeframe).toUpperCase();
  const effectiveLimit = Math.min(Math.max(1, limit), 500);
  try {
    const candles = marketDataServiceInstance.getCandles(symbol, targetTf, effectiveLimit);
    if (!candles?.length) return { candles: [], count: 0, requestedTimeframe: targetTf, actualTimeframe: null, freshness: 'NO_DATA', status: 'NO_DATA', error: `Tidak ada candle data untuk ${symbol} ${targetTf}` };
    const validCandles = candles.filter(c => {
      if (!c || typeof c !== 'object') return false;
      const { open, high, low, close, volume, timestamp, symbol: s, timeframe: tf } = c;
      return [open, high, low, close, volume].every(v => typeof v === 'number' && Number.isFinite(v)) &&
        typeof timestamp === 'string' && Number.isFinite(new Date(timestamp).getTime()) &&
        s === symbol && String(tf || '').toUpperCase() === targetTf && high >= Math.max(open, close, low) && low <= Math.min(open, close, high);
    });
    if (!validCandles.length) return { candles: [], count: 0, requestedTimeframe: targetTf, actualTimeframe: null, freshness: 'NO_DATA', status: 'NO_DATA', error: 'Tidak ada candle valid' };
    const last = validCandles[validCandles.length - 1];
    const age = Math.max(0, Date.now() - new Date(last.timestamp).getTime());
    const tfMs = ({ M1: 60000, M5: 300000, M15: 900000, M30: 1800000, H1: 3600000, H4: 14400000, D1: 86400000, W1: 604800000 })[targetTf] || 60000;
    const freshness = last.isSimulated === true ? 'SIMULATED' : age < tfMs * 2 ? 'FRESH' : age < tfMs * 24 ? 'RECENT' : 'STALE';
    return {
      candles: validCandles,
      count: validCandles.length,
      requestedTimeframe: targetTf,
      actualTimeframe: targetTf,
      lastCandle: {
        timestamp: last.timestamp,
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
        volume: last.volume
      },
      freshness,
      status: 'READY',
      error: validCandles.length < effectiveLimit ? `Hanya ${validCandles.length} candle tersedia dari ${effectiveLimit} yang diminta` : null
    };
  } catch (err) {
    console.error('[ChartReader] Error ambil candle:', err);
    return { candles: [], count: 0, requestedTimeframe: targetTf, actualTimeframe: null, freshness: 'ERROR', status: 'ERROR', error: err?.message || 'Unknown error retrieving chart data' };
  }
}
function getTimeframeMs(tf) {
  return ({ M1: 60000, M5: 300000, M15: 900000, M30: 1800000, H1: 3600000, H4: 14400000, D1: 86400000, W1: 604800000 })[tf] || 3600000;
}
export function getChartContext({ symbol, timeframe, provider } = {}) {
  return { symbol, timeframe, provider: provider || (symbol === 'XAUUSD' ? 'GOLD' : symbol === 'BTCUSDT' ? 'BINANCE' : 'NONE'), timestamp: new Date().toISOString(), status: 'UNKNOWN' };
}
export function checkDataAvailability(symbol, timeframe, minRequired = 50) {
  const result = getChartCandles(symbol, timeframe, 500);
  return { available: result.count >= minRequired, minRequired, count: result.count, status: result.status, freshness: result.freshness, error: result.error };
}
