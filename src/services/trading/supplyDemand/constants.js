/**
 * constants.js
 * Shared constants for the Phase 1 Automatic Supply & Demand engine.
 *
 * Scope: zone detection only. This module never produces BUY/SELL signals,
 * never changes strategy, and never submits orders.
 */

export const SD_TIMEFRAMES = ['M1', 'M5', 'M15', 'H1', 'H4'];

export const SD_TIMEFRAME_MS = {
  M1: 60_000,
  M5: 300_000,
  M15: 900_000,
  H1: 3_600_000,
  H4: 14_400_000,
  D1: 86_400_000,
};

export const SD_TIMEFRAME_WEIGHT = {
  M1: 0.6,
  M5: 0.8,
  M15: 1.0,
  H1: 1.2,
  H4: 1.5,
  D1: 1.6,
};

export const SD_LIFECYCLE = {
  FRESH: 'FRESH',
  TESTED: 'TESTED',
  WEAKENED: 'WEAKENED',
  INVALID: 'INVALID',
};

export const SD_SIDE = {
  SUPPLY: 'SUPPLY',
  DEMAND: 'DEMAND',
};

export const SD_XM_SOURCE = 'MT5_LOCAL_BRIDGE';

export const SD_DATA_STATUS = {
  READY: 'READY',
  DATA_UNAVAILABLE: 'DATA_UNAVAILABLE',
  NON_XM_SOURCE: 'NON_XM_SOURCE',
  INSUFFICIENT_CANDLES: 'INSUFFICIENT_CANDLES',
  SYMBOL_MISMATCH: 'SYMBOL_MISMATCH',
  TIMEFRAME_MISMATCH: 'TIMEFRAME_MISMATCH',
  INVALID_CANDLES: 'INVALID_CANDLES',
  INCOMPLETE_DATA: 'INCOMPLETE_DATA',
  FETCH_FAILED: 'FETCH_FAILED',
};

export const SD_DEFAULT_CONFIG = Object.freeze({
  atrPeriod: 14,
  minBars: 40,

  // Displacement / departure strength.
  displacementAtr: 1.2,
  displacementBodyRatio: 0.55,

  // Base (consolidation) before the departure.
  baseLookback: 6,
  baseMaxRangeAtr: 1.6,
  baseMaxBodyAtr: 1.1,

  // Zone geometry.
  maxWidthAtr: 3.5,
  minWidthAtr: 0.05,

  // Break of structure confirmation.
  bosLookback: 12,

  // Lifecycle / invalidation.
  invalidationMode: 'CLOSE', // 'CLOSE' | 'WICK'
  invalidationConfirmBars: 1,
  reactionWindowBars: 8,
  reactionAtr: 1.0,
  falseZoneWindowBars: 3,

  // Active-zone hygiene.
  maxActiveZonesPerSide: 8,
  dedupeOverlap: 0.65,
  dedupeBars: 30,

  // Scoring / recency.
  recencyBars: 250,
  strongScore: 70,

  // Multi-timeframe confluence.
  confluenceNearAtr: 0.35,

  // Data quality.
  maxGapRatio: 0.1,
  minCompleteness: 0.35,
  freshnessIntervals: 3,
});

export function mergeConfig(overrides = {}) {
  return { ...SD_DEFAULT_CONFIG, ...(overrides || {}) };
}
