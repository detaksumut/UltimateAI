/**
 * TradingSymbols.mjs
 * Canonical symbol mapping for the local MT5 OHLC bridge.
 *
 * Broker feeds often use aliases/suffixes (GOLD, GOLD.a, XAUUSD.a). The bridge
 * and the UI must share one key so S&D/scalping reads the same candle set.
 */

export const JIN_TRADING_ALLOWED_SYMBOLS = Object.freeze([
  'XAUUSD',
  'BTCUSDT',
  'ETHUSDT',
  'EURUSD',
  'GBPUSD',
  'US30',
]);

export function canonicalTradingSymbol(value) {
  const raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!raw) return '';
  if (raw.startsWith('XAUUSD') || raw.startsWith('GOLD')) return 'XAUUSD';
  if (raw.startsWith('BTCUSDT') || raw === 'BTCUSD') return 'BTCUSDT';
  if (raw.startsWith('ETHUSDT') || raw === 'ETHUSD') return 'ETHUSDT';
  if (raw.startsWith('EURUSD')) return 'EURUSD';
  if (raw.startsWith('GBPUSD')) return 'GBPUSD';
  if (raw.startsWith('US30') || raw.startsWith('DJI')) return 'US30';
  return raw;
}

export default canonicalTradingSymbol;
