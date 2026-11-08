/**
 * SupplyDemandEngine.js
 * Phase 1 orchestrator: validate XM OHLC, detect zones per timeframe,
 * apply lifecycle/scoring, then compute nearest zones and MTF confluence.
 *
 * This engine intentionally does NOT produce BUY/SELL signals, does NOT change
 * any strategy, and does NOT submit orders.
 */

import {
  SD_DATA_STATUS,
  SD_LIFECYCLE,
  SD_SIDE,
  SD_TIMEFRAMES,
  SD_XM_SOURCE,
  mergeConfig,
} from './constants.js';
import { validateCandleSeries } from './candleValidation.js';
import { atrSeries, detectZonesForTimeframe } from './zoneDetection.js';
import {
  buildConfluenceClusters,
  pickNearestZone,
  pickStrongestZone,
} from './confluence.js';

const PRICE_PRIORITY = ['M1', 'M5', 'M15', 'H1', 'H4'];

function lastFinitePrice(entry) {
  if (!entry || entry.status !== SD_DATA_STATUS.READY) return null;
  const candles = entry.validation?.candles || [];
  const last = candles[candles.length - 1];
  return last && Number.isFinite(last.close) ? last.close : null;
}

function tickMid(tick) {
  if (!tick) return null;
  const bid = Number(tick.bid);
  const ask = Number(tick.ask);
  const hasBid = Number.isFinite(bid) && bid > 0;
  const hasAsk = Number.isFinite(ask) && ask > 0;
  if (hasBid && hasAsk && ask >= bid) return (bid + ask) / 2;
  if (hasBid) return bid;
  if (hasAsk) return ask;
  return null;
}

function resolveCurrentPrice(entries, providedPrice) {
  // Number(null) === 0, which would silently become a fake "current price".
  // Only a real positive number is accepted from the caller.
  if (providedPrice !== null && providedPrice !== undefined && providedPrice !== '') {
    const provided = Number(providedPrice);
    if (Number.isFinite(provided) && provided > 0) return provided;
  }

  for (const timeframe of PRICE_PRIORITY) {
    const entry = entries[timeframe];
    const mid = tickMid(entry?.payload?.tick);
    if (mid != null) return mid;
  }
  for (const timeframe of PRICE_PRIORITY) {
    const price = lastFinitePrice(entries[timeframe]);
    if (price != null) return price;
  }
  return null;
}

function aggregateLifecycle(zones) {
  const counts = {
    FRESH: 0,
    TESTED: 0,
    WEAKENED: 0,
    INVALID: 0,
  };
  for (const zone of zones) {
    if (Object.hasOwn(counts, zone.lifecycle)) counts[zone.lifecycle] += 1;
  }
  return counts;
}

function summarizeTimeframe(entry, timeframe) {
  if (!entry) {
    return {
      timeframe,
      status: SD_DATA_STATUS.DATA_UNAVAILABLE,
      ok: false,
      message: 'Payload timeframe tidak tersedia.',
      source: null,
      isXmValidated: false,
      count: 0,
      freshness: 'NO_DATA',
      warnings: [],
      errors: ['Missing payload'],
      zones: [],
      activeZones: [],
    };
  }
  return {
    timeframe,
    status: entry.status,
    ok: entry.status === SD_DATA_STATUS.READY,
    message: entry.message,
    source: entry.validation?.source || null,
    isXmValidated: entry.validation?.isXmValidated === true,
    count: entry.validation?.count || 0,
    freshness: entry.validation?.freshness || 'NO_DATA',
    qualityScore: entry.validation?.qualityScore ?? null,
    completeness: entry.validation?.completeness ?? null,
    gapRatio: entry.validation?.gapRatio ?? null,
    brokerClockOffsetMs: entry.validation?.brokerClockOffsetMs ?? null,
    lastTime: entry.validation?.lastTime || null,
    warnings: entry.validation?.warnings || [],
    errors: entry.validation?.errors || [],
    atr: entry.atrLast ?? null,
    zones: entry.zones || [],
    activeZones: entry.activeZones || [],
  };
}

/**
 * Analyze already-fetched payloads.
 *
 * @param {object} input
 * @param {string} input.symbol
 * @param {string[]} input.timeframes
 * @param {object} input.payloads map: timeframe -> { source, candles, tick }
 * @param {number|null} input.currentPrice
 * @param {object} input.config
 * @param {number} input.now
 * @param {boolean} input.allowNonXmSource lab/backtest only
 */
export function analyzeSupplyDemand({
  symbol = 'XAUUSD',
  timeframes = SD_TIMEFRAMES,
  payloads = {},
  currentPrice = null,
  config = {},
  now = Date.now(),
  allowNonXmSource = false,
} = {}) {
  const cfg = mergeConfig(config);
  const requested = [...new Set((timeframes || []).map((tf) => String(tf).toUpperCase()))]
    .filter((tf) => SD_TIMEFRAMES.includes(tf));
  const entries = {};
  const warnings = [];

  for (const timeframe of requested) {
    const payload = payloads[timeframe];
    if (!payload) {
      entries[timeframe] = {
        status: SD_DATA_STATUS.DATA_UNAVAILABLE,
        message: 'OHLC XM belum tersedia untuk timeframe ini.',
        validation: null,
        payload: null,
        zones: [],
        activeZones: [],
      };
      continue;
    }

    const validation = validateCandleSeries({
      candles: payload.candles,
      symbol,
      timeframe,
      source: payload.source,
      tick: payload.tick,
      now,
      config: cfg,
      allowNonXmSource,
    });

    if (!validation.ok) {
      entries[timeframe] = {
        status: validation.code,
        message: validation.message,
        validation,
        payload,
        zones: [],
        activeZones: [],
      };
      warnings.push(`${timeframe}: ${validation.message}`);
      continue;
    }

    const zones = detectZonesForTimeframe({
      candles: validation.candles,
      symbol,
      timeframe,
      config: cfg,
      endIndex: validation.candles.length - 1,
    });
    const activeZones = zones.filter(
      (zone) => zone.active !== false && zone.lifecycle !== SD_LIFECYCLE.INVALID,
    );

    const atrValues = atrSeries(validation.candles, cfg.atrPeriod);
    entries[timeframe] = {
      status: SD_DATA_STATUS.READY,
      message: validation.message,
      validation,
      payload,
      zones,
      activeZones,
      atrLast: atrValues.length ? atrValues[atrValues.length - 1] : null,
    };
    for (const warning of validation.warnings) {
      warnings.push(`${timeframe}: ${warning}`);
    }
  }

  const timeframesSummary = {};
  for (const timeframe of requested) {
    timeframesSummary[timeframe] = summarizeTimeframe(entries[timeframe], timeframe);
  }

  const readyTimeframes = requested.filter(
    (timeframe) => entries[timeframe]?.status === SD_DATA_STATUS.READY,
  );
  const dataAvailable = readyTimeframes.length > 0;

  const allZones = readyTimeframes.flatMap((timeframe) => entries[timeframe].zones || []);
  const activeZones = allZones.filter(
    (zone) => zone.active !== false && zone.lifecycle !== SD_LIFECYCLE.INVALID,
  );

  const resolvedPrice = resolveCurrentPrice(entries, currentPrice);
  const supplyZones = activeZones
    .filter((zone) => zone.side === SD_SIDE.SUPPLY)
    .sort((a, b) => b.score - a.score);
  const demandZones = activeZones
    .filter((zone) => zone.side === SD_SIDE.DEMAND)
    .sort((a, b) => b.score - a.score);

  const strongest = pickStrongestZone(activeZones);
  const nearestSupply = pickNearestZone(activeZones, SD_SIDE.SUPPLY, resolvedPrice);
  const nearestDemand = pickNearestZone(activeZones, SD_SIDE.DEMAND, resolvedPrice);
  const confluence = buildConfluenceClusters(activeZones, cfg, resolvedPrice);
  const lifecycleCounts = aggregateLifecycle(allZones);

  const sources = [...new Set(
    readyTimeframes
      .map((timeframe) => entries[timeframe].validation?.source)
      .filter(Boolean),
  )];
  const isXmValidated = sources.length > 0 && sources.every((source) => source === SD_XM_SOURCE);
  const lastUpdate = readyTimeframes
    .map((timeframe) => entries[timeframe].validation?.lastTime)
    .filter(Boolean)
    .sort()
    .at(-1) || null;

  const missingTimeframes = requested.filter(
    (timeframe) => entries[timeframe]?.status !== SD_DATA_STATUS.READY,
  );

  if (!dataAvailable) {
    const firstFailure = requested
      .map((timeframe) => entries[timeframe])
      .find((entry) => entry && entry.status);
    return {
      ok: false,
      code: SD_DATA_STATUS.DATA_UNAVAILABLE,
      dataAvailable: false,
      symbol,
      generatedAt: new Date(now).toISOString(),
      currentPrice: resolvedPrice,
      source: sources[0] || null,
      isXmValidated: false,
      dataStatus: 'DATA_UNAVAILABLE',
      message: firstFailure?.message
        || 'OHLC XM tidak tersedia. Tidak ada zona yang dibuat.',
      timeframes: timeframesSummary,
      readyTimeframes,
      missingTimeframes,
      zones: [],
      activeZones: [],
      supplyZones: [],
      demandZones: [],
      strongest: null,
      nearestSupply: null,
      nearestDemand: null,
      confluence: [],
      lifecycleCounts,
      warnings,
      lastUpdate,
      config: cfg,
      limitations: [
        'Tidak ada zona dibuat tanpa OHLC XM yang tervalidasi.',
        'Screenshot / visual capture tidak pernah diubah menjadi OHLC.',
      ],
    };
  }

  return {
    ok: true,
    code: SD_DATA_STATUS.READY,
    dataAvailable: true,
    partial: missingTimeframes.length > 0,
    symbol,
    generatedAt: new Date(now).toISOString(),
    currentPrice: resolvedPrice,
    source: sources.length === 1 ? sources[0] : 'MIXED',
    isXmValidated,
    dataStatus: 'READY',
    message: 'Zona S&D dihitung dari OHLC XM tervalidasi.',
    timeframes: timeframesSummary,
    readyTimeframes,
    missingTimeframes,
    zones: allZones,
    activeZones,
    supplyZones,
    demandZones,
    strongest,
    nearestSupply,
    nearestDemand,
    confluence,
    lifecycleCounts,
    warnings,
    lastUpdate,
    config: cfg,
    limitations: [
      'Engine Phase 1 hanya mendeteksi zona; tidak menghasilkan sinyal BUY/SELL dan tidak mengirim order.',
      'Zona XM native chart tidak bisa ditimpa HTML secara aman dari WebContentsView; overlay JIN dirender dari OHLC XM di panel.',
      'Screenshot hanya untuk validasi visual, bukan sumber OHLC.',
    ],
  };
}

export default analyzeSupplyDemand;
