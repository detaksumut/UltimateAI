/**
 * constants.js
 * Core constants, SLA thresholds, and status enums for JINI Gold Decision Engine.
 *
 * Strict Compliance:
 * - XM XAUUSD is the primary price source.
 * - PAXG/USDT is explicitly labelled as a proxy; COMEX is marked UNAVAILABLE.
 * - Auto-trading is forbidden.
 */

export const ENGINE_VERSION = 'jini-decision-engine-v1.0.0';

export const DECISION_STATUS = Object.freeze({
  BUY: 'BUY',
  SELL: 'SELL',
  WAIT: 'WAIT',
  NO_TRADE: 'NO_TRADE',
});

export const DATA_INTEGRITY_STATUS = Object.freeze({
  READY: 'READY',
  STALE: 'STALE',
  DEGRADED: 'DEGRADED',
  UNAVAILABLE: 'UNAVAILABLE',
});

export const BIAS_DIRECTION = Object.freeze({
  BULLISH: 'BULLISH',
  BEARISH: 'BEARISH',
  NEUTRAL: 'NEUTRAL',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
});

export const ORDER_FLOW_VENUE = Object.freeze({
  PAXG_PROXY: 'BINANCE_SPOT_PAXG_PROXY',
  COMEX_GC: 'COMEX_GC_EXCHANGE',
});

export const COMEX_INTEGRITY_CONTRACT = Object.freeze({
  symbol: 'GC',
  label: 'COMEX Gold Futures (GC)',
  status: DATA_INTEGRITY_STATUS.UNAVAILABLE,
  reason: 'Tape trade COMEX/CME memerlukan kredensial data feed berbayar; feed belum terhubung.',
  isComex: true,
  isProxy: false,
});

export const PROXY_INTEGRITY_CONTRACT = Object.freeze({
  symbol: 'PAXGUSDT',
  label: 'PAXG/USDT (Gold Token Proxy)',
  venue: ORDER_FLOW_VENUE.PAXG_PROXY,
  isComex: false,
  isProxy: true,
  limitationNote: 'Aktivitas agresor berasal dari pasar kripto spot PAXG/USDT (Binance), bukan pasar berjangka COMEX GC.',
});

export const FRESHNESS_SLA_MS = Object.freeze({
  XM_M1: 180_000,          // 3 menit
  XM_M5: 900_000,          // 15 menit
  XM_M15: 2_700_000,       // 45 menit
  XM_H1: 10_800_000,       // 3 jam
  XM_H4: 43_200_000,       // 12 jam
  XM_D1: 259_200_000,      // 3 hari (toleransi penutupan weekend)
  ORDER_FLOW_LIVE: 60_000, // 60 detik untuk LIVE
  ORDER_FLOW_DELAYED: 300_000, // 5 menit untuk DELAYED
  INTERMARKET_LIVE: 600_000,   // 10 menit
});

export const EXECUTION_GATE_LIMITS = Object.freeze({
  MAX_SPREAD_PIPS: 1.5,       // Spread maksimal XAUUSD sebelum risk gate memblokir entry
  MIN_CANDLE_COUNT_M1: 50,    // Minimal candle M1 untuk analisis micro
  MIN_CANDLE_COUNT_D1: 20,    // Minimal candle D1 untuk daily trend
  MIN_ORDER_FLOW_TRADES: 30,  // Minimal trades di tape window
  ABSORPTION_MIN_VOLUME_RATIO: 1.5, // Volume minimal dibanding baseline untuk absorption
  ABSORPTION_MAX_DISPLACEMENT_PCT: 0.05, // Batas maksimal perpindahan harga saat absorption (0.05%)
  AGGRESSOR_DOMINANCE_THRESHOLD: 65.0, // Batas minimal dominasi volume agresor (65%)
});

