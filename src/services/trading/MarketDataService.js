/**
 * MarketDataService.js
 * JINI Trading Intelligence Studio
 * Lapisan layanan data pasar — terpisah dari komponen UI.
 */
export const CANDLE_SCHEMA = {
  symbol: 'string', timeframe: 'string', timestamp: 'string',
  open: 'number', high: 'number', low: 'number', close: 'number',
  volume: 'number|null', source: 'string', isSimulated: 'boolean',
};

const TIMEFRAMES = { M5: 'M5', M15: 'M15', H1: 'H1', H4: 'H4', D1: 'D1' };

function isValidCandle(c) {
  if (!c || typeof c !== 'object') return false;
  const { symbol, timeframe, open, high, low, close, volume, timestamp } = c;
  if (!symbol || !timeframe ||
      ![open, high, low, close].every(v => typeof v === 'number' && Number.isFinite(v)) || !(volume === null || (typeof volume === 'number' && Number.isFinite(volume))) ||
      typeof timestamp !== 'string' || !Number.isFinite(new Date(timestamp).getTime())) return false;
  return high >= Math.max(open, close, low) && low <= Math.min(open, close, high);
}

export class MarketDataService {
  constructor() {
    this.candles = new Map();
    this.ticks = new Map();
    this.subscribers = new Set();
    this.status = 'DISCONNECTED';
    this.lastUpdate = null;
    this.source = null;
    this.isSimulated = false;
  }
  subscribe(callback) { this.subscribers.add(callback); return () => this.subscribers.delete(callback); }
  notify() {
    const snapshot = this.getSnapshot();
    this.subscribers.forEach(cb => { try { cb(snapshot); } catch (err) { console.error('[MarketData] subscriber error', err); } });
  }
  getSnapshot() {
    return { status: this.status, source: this.source, isSimulated: this.isSimulated,
      lastUpdate: this.lastUpdate, candles: this.getAllCandles(), ticks: Object.fromEntries(this.ticks) };
  }
  getAllCandles() { return Array.from(this.candles.values()); }
  getCandles(symbol, timeframe, limit = 500) {
    return Array.from(this.candles.values()).filter(c => c.symbol === symbol && c.timeframe === timeframe)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).slice(-limit);
  }
  getLatestCandle(symbol, timeframe) { return this.getCandles(symbol, timeframe, 1)[0] || null; }
  getTick(symbol) { return this.ticks.get(symbol) || null; }
  addCandle(candle) {
    if (!isValidCandle(candle)) { console.warn('[MarketData] Candle tidak valid ditolak:', candle); return false; }
    const key = `${candle.symbol}|${candle.timeframe}|${candle.timestamp}`;
    const previous = this.candles.get(key);
    // Broker updates the still-forming candle on each poll; upsert it instead of
    // ignoring the timestamp after its first observation.
    if (previous && ['open','high','low','close','volume'].every(k => previous[k] === candle[k])) return false;
    this.candles.set(key, candle); this.lastUpdate = candle.timestamp; this.notify(); return true;
  }
  addBatchCandles(candles = []) { let added = 0; candles.forEach(c => { if (this.addCandle(c)) added++; }); return added; }
  setTick(symbol, { bid, ask, timestamp = new Date().toISOString(), source = 'unknown' } = {}) {
    if (!symbol || !Number.isFinite(bid) || !Number.isFinite(ask) || ask < bid) return false;
    this.ticks.set(symbol, { symbol, bid, ask, spread: ask - bid, timestamp, source });
    this.lastUpdate = timestamp; this.notify(); return true;
  }
  setStatus(status, { source = null, isSimulated = false } = {}) {
    this.status = status; if (source) this.source = source; this.isSimulated = Boolean(isSimulated); this.notify();
  }
  clearCandles(symbol, timeframe) {
    for (const [key, candle] of this.candles.entries()) {
      if (candle.symbol === symbol && candle.timeframe === timeframe) this.candles.delete(key);
    }
    this.notify();
  }
}
export const marketDataServiceInstance = new MarketDataService();
export { TIMEFRAMES };
