/**
 * candleValidation.js
 * Strict validation for broker-sourced OHLC data used by the S&D engine.
 *
 * Rules enforced here:
 * - Only XM MT5 bridge data is accepted for live zones (unless explicitly
 *   allowed for an offline backtest/lab run).
 * - Symbol, timeframe, timestamp, timezone, OHLC integrity and candle
 *   completeness are checked before any zone is generated.
 * - No screenshot / visual capture is ever converted into OHLC here.
 */

import {
  SD_DATA_STATUS,
  SD_TIMEFRAMES,
  SD_TIMEFRAME_MS,
  SD_XM_SOURCE,
} from './constants.js';

const TF_ALIASES = {
  '1': 'M1', '1M': 'M1', 'M1': 'M1', '1MIN': 'M1', '1MINUTE': 'M1',
  '5': 'M5', '5M': 'M5', 'M5': 'M5', '5MIN': 'M5', '5MINUTE': 'M5',
  '15': 'M15', '15M': 'M15', 'M15': 'M15', '15MIN': 'M15', '15MINUTE': 'M15',
  '60': 'H1', '1H': 'H1', 'H1': 'H1', '1HR': 'H1', '1HOUR': 'H1',
  '240': 'H4', '4H': 'H4', 'H4': 'H4', '4HR': 'H4', '4HOUR': 'H4',
  'D': 'D1', '1D': 'D1', 'D1': 'D1', 'DAILY': 'D1',
};

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeSymbol(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function normalizeTimeframe(value) {
  const raw = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  return TF_ALIASES[raw] || raw;
}

export function parseTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (value instanceof Date) return value.getTime();
  const ms = Date.parse(String(value || ''));
  return Number.isFinite(ms) ? ms : NaN;
}

function hasExplicitTimezone(value) {
  if (typeof value !== 'string') return true;
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());
}

function normalizeCandle(raw, fallbackSymbol, fallbackTimeframe) {
  const open = Number(raw?.open);
  const high = Number(raw?.high);
  const low = Number(raw?.low);
  const close = Number(raw?.close);
  const volume = raw?.volume == null ? 0 : Number(raw.volume);
  const time = parseTimestamp(raw?.timestamp ?? raw?.time);
  const symbol = normalizeSymbol(raw?.symbol || fallbackSymbol);
  const timeframe = normalizeTimeframe(raw?.timeframe || fallbackTimeframe);
  const source = raw?.source || null;
  const isSimulated = raw?.isSimulated === true;

  const numericValid = [open, high, low, close, volume].every(Number.isFinite);
  const positiveValid = open > 0 && high > 0 && low > 0 && close > 0;
  const rangeValid = high >= Math.max(open, close) && low <= Math.min(open, close) && high >= low;
  const timeValid = Number.isFinite(time);

  return {
    valid: numericValid && positiveValid && rangeValid && timeValid,
    symbol,
    timeframe,
    source,
    isSimulated,
    timestamp: timeValid ? new Date(time).toISOString() : null,
    time,
    open,
    high,
    low,
    close,
    volume: Number.isFinite(volume) ? Math.max(0, volume) : 0,
  };
}

/**
 * Validate and normalize a single-timeframe OHLC series.
 *
 * @param {object} input
 * @param {Array} input.candles
 * @param {string} input.symbol
 * @param {string} input.timeframe
 * @param {string} input.source payload-level source (e.g. MT5_LOCAL_BRIDGE)
 * @param {object|null} input.tick optional tick for broker-time freshness
 * @param {number} input.now local clock in ms
 * @param {object} input.config
 * @param {boolean} input.allowNonXmSource lab/backtest escape hatch
 */
export function validateCandleSeries({
  candles = [],
  symbol = 'XAUUSD',
  timeframe = 'M1',
  source = null,
  tick = null,
  now = Date.now(),
  config = {},
  allowNonXmSource = false,
} = {}) {
  const expectedSymbol = normalizeSymbol(symbol);
  const expectedTimeframe = normalizeTimeframe(timeframe);
  const intervalMs = SD_TIMEFRAME_MS[expectedTimeframe];
  const minBars = Math.max(10, Number(config.minBars) || 40);
  const errors = [];
  const warnings = [];

  if (!SD_TIMEFRAMES.includes(expectedTimeframe)) {
    return {
      ok: false,
      code: SD_DATA_STATUS.TIMEFRAME_MISMATCH,
      message: `Timeframe ${expectedTimeframe} tidak didukung engine Phase 1.`,
      errors: [`Unsupported timeframe: ${expectedTimeframe}`],
      warnings,
      candles: [],
    };
  }

  const payloadSource = String(source || '').toUpperCase();
  const isXmValidated = payloadSource === SD_XM_SOURCE;

  if (!isXmValidated && !allowNonXmSource) {
    return {
      ok: false,
      code: SD_DATA_STATUS.NON_XM_SOURCE,
      message: 'Data OHLC bukan dari bridge XM MT5. Zona tidak dibuat agar tidak memakai feed non-XM (mis. fallback OANDA/Yahoo).',
      source: payloadSource || null,
      isXmValidated: false,
      errors: [`Rejected source: ${payloadSource || 'UNKNOWN'}`],
      warnings,
      candles: [],
    };
  }

  if (!Array.isArray(candles) || candles.length === 0) {
    return {
      ok: false,
      code: SD_DATA_STATUS.DATA_UNAVAILABLE,
      message: 'OHLC XM tidak tersedia. Tidak ada zona yang dibuat.',
      source: payloadSource || null,
      isXmValidated,
      errors: ['Empty candle series'],
      warnings,
      candles: [],
    };
  }

  let invalidCount = 0;
  let symbolMismatch = 0;
  let timeframeMismatch = 0;
  let timezoneMissing = 0;
  let simulatedCount = 0;
  let nonXmCandleSourceCount = 0;

  const normalized = [];
  for (const raw of candles) {
    const c = normalizeCandle(raw, expectedSymbol, expectedTimeframe);
    if (!c.valid) {
      invalidCount += 1;
      continue;
    }
    if (c.symbol !== expectedSymbol) symbolMismatch += 1;
    if (c.timeframe !== expectedTimeframe) timeframeMismatch += 1;
    if (!hasExplicitTimezone(raw?.timestamp ?? raw?.time)) timezoneMissing += 1;
    if (c.isSimulated) simulatedCount += 1;
    const candleSource = String(c.source || '').toUpperCase();
    if (candleSource && candleSource !== SD_XM_SOURCE) nonXmCandleSourceCount += 1;
    normalized.push(c);
  }

  if (simulatedCount > 0 && !allowNonXmSource) {
    return {
      ok: false,
      code: SD_DATA_STATUS.INVALID_CANDLES,
      message: `Ditemukan ${simulatedCount} candle bertanda simulated. Data simulasi ditolak untuk zona live; tidak ada klaim live.`,
      source: payloadSource || null,
      isXmValidated: false,
      errors: [`Simulated candles rejected: ${simulatedCount}`],
      warnings,
      candles: [],
    };
  }

  if (nonXmCandleSourceCount > 0 && !allowNonXmSource) {
    return {
      ok: false,
      code: SD_DATA_STATUS.NON_XM_SOURCE,
      message: `Ditemukan ${nonXmCandleSourceCount} candle dengan source bukan ${SD_XM_SOURCE}. Seri ditolak agar tidak ada campuran feed non-XM.`,
      source: payloadSource || null,
      isXmValidated: false,
      errors: [`Non-XM candle sources: ${nonXmCandleSourceCount}`],
      warnings,
      candles: [],
    };
  }

  if (invalidCount > 0) {
    return {
      ok: false,
      code: SD_DATA_STATUS.INVALID_CANDLES,
      message: `Ditemukan ${invalidCount} candle dengan OHLC/timestamp tidak valid. Engine menolak seluruh seri agar tidak membuat zona dari data rusak.`,
      source: payloadSource || null,
      isXmValidated,
      errors: [`Invalid candles: ${invalidCount}`],
      warnings,
      candles: [],
    };
  }

  if (symbolMismatch > 0) {
    return {
      ok: false,
      code: SD_DATA_STATUS.SYMBOL_MISMATCH,
      message: `Simbol candle tidak cocok dengan ${expectedSymbol}.`,
      source: payloadSource || null,
      isXmValidated,
      errors: [`Symbol mismatches: ${symbolMismatch}`],
      warnings,
      candles: [],
    };
  }

  if (timeframeMismatch > 0) {
    return {
      ok: false,
      code: SD_DATA_STATUS.TIMEFRAME_MISMATCH,
      message: `Timeframe candle tidak cocok dengan ${expectedTimeframe}.`,
      source: payloadSource || null,
      isXmValidated,
      errors: [`Timeframe mismatches: ${timeframeMismatch}`],
      warnings,
      candles: [],
    };
  }

  if (timezoneMissing > 0) {
    warnings.push(`${timezoneMissing} timestamp tanpa penanda timezone; diasumsikan UTC.`);
  }
  if (simulatedCount > 0) {
    warnings.push(`${simulatedCount} candle ditandai simulated; tidak dipakai untuk klaim live.`);
  }

  // Sort ascending and de-duplicate by timestamp (keep last occurrence).
  normalized.sort((a, b) => a.time - b.time);
  const byTime = new Map();
  let duplicates = 0;
  for (const candle of normalized) {
    if (byTime.has(candle.time)) duplicates += 1;
    byTime.set(candle.time, candle);
  }
  const sorted = [...byTime.values()].sort((a, b) => a.time - b.time);

  if (sorted.length < minBars) {
    return {
      ok: false,
      code: SD_DATA_STATUS.INSUFFICIENT_CANDLES,
      message: `Candle XM tidak cukup (${sorted.length}/${minBars}) untuk ${expectedTimeframe}. Tidak ada zona yang dibuat.`,
      source: payloadSource || null,
      isXmValidated,
      count: sorted.length,
      errors: [`Insufficient candles: ${sorted.length}/${minBars}`],
      warnings,
      candles: sorted,
    };
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  let missingBars = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const delta = sorted[i].time - sorted[i - 1].time;
    if (delta > intervalMs * 1.5) {
      missingBars += Math.max(0, Math.round(delta / intervalMs) - 1);
    }
  }

  const expectedBars = Math.floor((last.time - first.time) / intervalMs) + 1;
  const completeness = expectedBars > 0 ? clamp(sorted.length / expectedBars, 0, 1) : 0;
  const gapRatio = expectedBars > 0 ? clamp(missingBars / expectedBars, 0, 1) : 0;

  if (gapRatio > (Number(config.maxGapRatio) || 0.1)) {
    warnings.push(`Gap candle ${(gapRatio * 100).toFixed(1)}% (kemungkinan market tutup/libur).`);
  }
  if (duplicates > 0) {
    warnings.push(`${duplicates} timestamp duplikat; hanya candle terakhir yang dipakai.`);
  }

  const minCompleteness = Number(config.minCompleteness) || 0.35;
  if (completeness < minCompleteness) {
    return {
      ok: false,
      code: SD_DATA_STATUS.INCOMPLETE_DATA,
      message: `Kelengkapan candle ${(completeness * 100).toFixed(1)}% di bawah batas ${(minCompleteness * 100).toFixed(0)}%. Engine menolak data yang terlalu bolong.`,
      source: payloadSource || null,
      isXmValidated,
      count: sorted.length,
      completeness,
      gapRatio,
      errors: [`Incomplete data: ${(completeness * 100).toFixed(1)}%`],
      warnings,
      candles: sorted,
    };
  }

  const tickTime = parseTimestamp(tick?.timestamp);
  const referenceTime = Number.isFinite(tickTime) ? tickTime : now;
  const ageMs = referenceTime - last.time;
  const brokerClockOffsetMs = referenceTime - now;
  const interval = intervalMs;
  const freshness = ageMs <= interval * (Number(config.freshnessIntervals) || 3)
    ? 'FRESH'
    : 'STALE';

  if (Math.abs(brokerClockOffsetMs) > 5 * 60_000) {
    warnings.push(
      `Jam broker bergeser ${Math.round(brokerClockOffsetMs / 60_000)} menit dari jam lokal; freshness dihitung terhadap waktu tick broker.`,
    );
  }
  if (last.time > referenceTime + interval) {
    warnings.push('Timestamp candle terakhir berada di masa depan relatif terhadap tick broker.');
  }
  if (freshness === 'STALE') {
    warnings.push(`Candle terakhir ${Math.round(Math.max(0, ageMs) / 1000)}s lebih lama dari batas ${expectedTimeframe}.`);
  }

  const freshnessScore = freshness === 'FRESH' ? 30 : 10;
  const completenessScore = completeness * 40;
  const gapScore = (1 - clamp(gapRatio * 4, 0, 1)) * 20;
  const integrityScore = (duplicates === 0 && simulatedCount === 0) ? 10 : 4;
  const qualityScore = Math.round(clamp(freshnessScore + completenessScore + gapScore + integrityScore, 0, 100));

  return {
    ok: true,
    code: SD_DATA_STATUS.READY,
    message: 'OHLC valid.',
    source: payloadSource || null,
    isXmValidated,
    symbol: expectedSymbol,
    timeframe: expectedTimeframe,
    count: sorted.length,
    candles: sorted,
    firstTime: first.timestamp,
    lastTime: last.timestamp,
    freshness,
    ageMs,
    brokerClockOffsetMs,
    expectedBars,
    missingBars,
    gapRatio,
    completeness,
    duplicates,
    qualityScore,
    errors,
    warnings,
  };
}
