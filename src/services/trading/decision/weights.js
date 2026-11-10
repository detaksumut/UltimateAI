/**
 * weights.js
 * Documented hypothesis weights and decision policy for Tahap 3.
 *
 * These weights are NOT calibrated statistics and must never be described as
 * win probabilities. They are starting hypotheses to be evaluated by backtesting
 * in a later stage.
 *
 * Why this split (avoids double counting):
 * - TREND_ALIGNMENT uses only D1 + H4 (direction anchors).
 * - MARKET_STRUCTURE uses only H1 swing structure (HH/HL vs LH/LL).
 * - SUPPLY_DEMAND uses only zone location/quality, not trend indicators.
 * - ORDER_FLOW uses the PAXG proxy tape as ONE category. Delta, CVD and
 *   imbalance are derived from the same buy/sell volume, so they are used only
 *   as internal confirmation, never as separate weighted categories.
 * - INTERMARKET uses macro factors only.
 * - SETUP_CONFIRMATION uses M15 + M5 trend.
 * - ENTRY_TRIGGER uses M1 only.
 * - EXECUTION_FEASIBILITY has ZERO directional weight: spread/ATR can block or
 *   degrade a decision, but it must never vote BUY or SELL.
 *
 * Total directional weight = 100.
 */

export const DECISION_CONTRACT_VERSION = 'jini-decision-evaluation-v1';

export const DECISION_WEIGHTS = Object.freeze({
  TREND_ALIGNMENT: 30,
  MARKET_STRUCTURE: 20,
  SUPPLY_DEMAND: 15,
  ORDER_FLOW: 15,
  INTERMARKET: 10,
  SETUP_CONFIRMATION: 5,
  ENTRY_TRIGGER: 5,
});

export const DECISION_THRESHOLDS = Object.freeze({
  MIN_BIAS_EDGE_POINTS: 3,
  MIN_BIAS_CONFIDENCE: 30,
  AGGRESSOR_DOMINANCE_PERCENT: 65,
  PRICE_RESPONSE_FLAT_PCT: 0.02,
  PRICE_RESPONSE_LOOKBACK_M1: 5,
  ZONE_PROXIMITY_ATR_M1: 0.5,
  ZONE_PROXIMITY_PRICE_PCT: 0.0005,
  STRUCTURE_SWING_WINDOW: 2,
  STRUCTURE_MIN_SWINGS: 2,
  MAX_SPREAD_PIPS: 1.5,
  MAX_SPREAD_TO_ATR: 0.35,
});

/**
 * Hard ceilings on the leading directional score. A cap never changes the
 * direction of evidence; it only limits how confident the snapshot may look.
 */
export const CONFIDENCE_CAPS = Object.freeze({
  FULL: 100,
  ORDER_FLOW_UNAVAILABLE: 70,
  ORDER_FLOW_STALE: 60,
  INTERMARKET_UNAVAILABLE: 80,
  SUPPLY_DEMAND_UNAVAILABLE: 75,
  SETUP_CONFIRMATION_UNAVAILABLE: 70,
  ENTRY_TRIGGER_UNAVAILABLE: 75,
  ORDER_FLOW_VS_TREND: 60,
  INTERMARKET_VS_TREND: 70,
  ABSORPTION_UNCONFIRMED: 65,
  EXECUTION_DEGRADED: 70,
  MAJOR_SKEW_OPTIONAL: 60,
});

export const DECISION_NOTES = Object.freeze({
  biasIsNotEntry: 'BUY_BIAS/SELL_BIAS hanya penilaian bukti; bukan izin entry, bukan sinyal, dan tidak memicu order.',
  weightsAreHypothesis: 'Bobot adalah hipotesis awal, bukan probabilitas kemenangan; wajib dievaluasi lewat backtesting.',
  weightNormalization: 'Bobot dinormalisasi ulang hanya terhadap kategori yang benar-benar tersedia; sumber unavailable/stale tidak boleh menjadi bukti valid.',
  executionGate: 'Spread/ATR dievaluasi sebagai gate eksekusi tanpa bobot arah: dapat memblokir atau menurunkan confidence, tidak pernah memberi arah.',
  proxy: 'Order Flow berasal dari PAXG/USDT (proxy), bukan tape COMEX GC.',
});

export const EVIDENCE_SOURCE_MAP = Object.freeze({
  TREND_ALIGNMENT: ['XM_OHLC_D1', 'XM_OHLC_H4'],
  MARKET_STRUCTURE: ['XM_OHLC_H1'],
  SUPPLY_DEMAND: ['SUPPLY_DEMAND'],
  ORDER_FLOW: ['ORDER_FLOW'],
  INTERMARKET: ['INTERMARKET'],
  SETUP_CONFIRMATION: ['XM_OHLC_M15', 'XM_OHLC_M5'],
  ENTRY_TRIGGER: ['XM_OHLC_M1', 'SCALPING_M1'],
});
