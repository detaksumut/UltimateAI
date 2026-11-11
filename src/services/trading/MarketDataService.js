/**
 * MarketDataService.js
 * JINI Trading Intelligence Studio
 * Lapisan layanan data pasar — terpisah dari komponen UI.
 */
export const CANDLE_SCHEMA = {
  symbol: 'string', timeframe: 'string', timestamp: 'string',
  open: 'number', high: 'number', low: 'number', close: 'number',
  volume: 'number', source: 'string', isSimulated: 'boolean',
};

const TIMEFRAMES = { M1: 'M1', M5: 'M5', M15: 'M15', H1: 'H1', H4: 'H4', D1: 'D1' };

const TIMEFRAME_MS = {
  M1: 60000, M5: 300000, M15: 900000, M30: 1800000,
  H1: 3600000, H4: 14400000, D1: 86400000, W1: 604800000,
};

// Yahoo (and some bridges) timestamp the still-forming bar with the latest
// tick time instead of the bar's period start. Without snapping to the
// timeframe boundary every poll creates a new "candle" a few seconds later,
// which renders as a trail of flat dashes on the chart.
function bucketTimestamp(timestamp, timeframe) {
  const bucket = TIMEFRAME_MS[String(timeframe || '').toUpperCase()];
  const time = Date.parse(timestamp);
  if (!bucket || !Number.isFinite(time)) return timestamp;
  return new Date(Math.floor(time / bucket) * bucket).toISOString();
}

function isValidCandle(c) {
  if (!c || typeof c !== 'object') return false;
  const { symbol, timeframe, open, high, low, close, volume, timestamp } = c;
  if (!symbol || !timeframe ||
      ![open, high, low, close, volume].every(v => typeof v === 'number' && Number.isFinite(v)) ||
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
    const tf = String(timeframe || '').toUpperCase();
    return Array.from(this.candles.values())
      .filter(c => c.symbol === symbol && String(c.timeframe || '').toUpperCase() === tf)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).slice(-limit);
  }
  getLatestCandle(symbol, timeframe) { return this.getCandles(symbol, timeframe, 1)[0] || null; }
  getTick(symbol) { return this.ticks.get(symbol) || null; }
  addCandle(candle) {
    if (!isValidCandle(candle)) { console.warn('[MarketData] Candle tidak valid ditolak:', candle); return false; }
    const normalized = { ...candle, timestamp: bucketTimestamp(candle.timestamp, candle.timeframe) };
    const key = `${normalized.symbol}|${normalized.timeframe}|${normalized.timestamp}`;
    const previous = this.candles.get(key);
    // Broker updates the still-forming candle on each poll; upsert it instead of
    // ignoring the timestamp after its first observation. Merge rather than
    // overwrite so a degenerate partial bar cannot erase the range already seen
    // for the same period.
    const merged = previous ? {
      ...previous,
      high: Math.max(previous.high, normalized.high),
      low: Math.min(previous.low, normalized.low),
      close: normalized.close,
      volume: Math.max(Number(previous.volume) || 0, Number(normalized.volume) || 0),
    } : normalized;
    if (previous && ['open','high','low','close','volume'].every(k => previous[k] === merged[k])) return false;
    this.candles.set(key, merged); this.lastUpdate = merged.timestamp; this.notify(); return true;
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
