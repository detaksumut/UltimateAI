/**
 * timing.js
 * Cross-source freshness and synchronization registry for JINI.
 *
 * A snapshot may be structurally valid while silently mixing data from
 * different moments. This module makes those differences explicit:
 * - per-source age and SLA status,
 * - lag versus the primary XM price reference,
 * - SYNCED / MINOR_SKEW / MAJOR_SKEW classification.
 *
 * It never "fixes" skew by pretending sources are aligned.
 */

import { DATA_INTEGRITY_STATUS } from './constants.js';

const MINOR_LAG_MS = 60_000;

// Tolerances are per-source because higher timeframes are legitimately older.
export const INTRADAY_LAG_TOLERANCE_MS = Object.freeze({
  XM_TICK: 60_000,
  XM_M1: 180_000,
  XM_M5: 300_000,
  ORDER_FLOW: 60_000,
  SCALPING_M1: 180_000,
  SUPPLY_DEMAND: 300_000,
  INTERMARKET: 600_000,
  JINI_MONITOR: 300_000,
});

export const DEFAULT_REFERENCE_PRIORITY = Object.freeze([
  'XM_TICK',
  'XM_M1',
  'XM_M5',
  'XM_M15',
  'XM_H1',
  'XM_H4',
  'XM_D1',
]);

function toEpochMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeStatus(value) {
  const status = String(value || '').toUpperCase();
  if (status === 'FRESH' || status === 'READY' || status === 'OK' || status === 'LIVE') {
    return DATA_INTEGRITY_STATUS.READY;
  }
  if (status === 'DEGRADED' || status === 'DELAYED' || status === 'PARTIAL') {
    return DATA_INTEGRITY_STATUS.DEGRADED;
  }
  if (status === 'STALE') return DATA_INTEGRITY_STATUS.STALE;
  return DATA_INTEGRITY_STATUS.UNAVAILABLE;
}

/**
 * @param {object} input
 * @param {number} input.now
 * @param {Array<{id:string,dataAsOf:any,slaMs:number,status?:string,marketClosed?:boolean,note?:string}>} input.entries
 * @param {string[]} input.referencePriority
 */
export function evaluateSourceTiming({
  now = Date.now(),
  entries = [],
  referencePriority = DEFAULT_REFERENCE_PRIORITY,
} = {}) {
  const nowMs = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const sourceFreshness = {};
  const perSource = {};

  for (const entry of entries) {
    if (!entry || !entry.id) continue;
    const asOfMs = toEpochMs(entry.dataAsOf);
    const hasAsOf = Number.isFinite(asOfMs) && asOfMs > 0;
    const ageMs = hasAsOf ? Math.max(0, nowMs - asOfMs) : null;
    const slaMs = Number.isFinite(Number(entry.slaMs)) ? Number(entry.slaMs) : null;

    let status;
    if (entry.status) {
      status = normalizeStatus(entry.status);
    } else if (!hasAsOf) {
      status = DATA_INTEGRITY_STATUS.UNAVAILABLE;
    } else if (slaMs != null && ageMs > slaMs) {
      status = DATA_INTEGRITY_STATUS.STALE;
    } else {
      status = DATA_INTEGRITY_STATUS.READY;
    }

    const exceedsSla = slaMs != null && ageMs != null ? ageMs > slaMs : null;
    sourceFreshness[entry.id] = {
      id: entry.id,
      status,
      dataAsOf: hasAsOf ? new Date(asOfMs).toISOString() : null,
      ageMs,
      slaMs,
      exceedsSla,
      marketClosed: entry.marketClosed === true,
      note: entry.note ?? null,
    };
    perSource[entry.id] = {
      dataAsOf: hasAsOf ? new Date(asOfMs).toISOString() : null,
      ageMs,
      status,
      lagVsReferenceMs: null,
      toleranceMs: INTRADAY_LAG_TOLERANCE_MS[entry.id] ?? null,
    };
  }

  const referenceId = referencePriority.find((id) => {
    const entry = sourceFreshness[id];
    return entry && entry.dataAsOf && entry.status !== DATA_INTEGRITY_STATUS.UNAVAILABLE;
  }) || null;
  const referenceAtMs = referenceId ? toEpochMs(sourceFreshness[referenceId].dataAsOf) : NaN;

  const flags = [];
  if (referenceId) {
    for (const [id, item] of Object.entries(perSource)) {
      if (!item.dataAsOf) continue;
      const tolerance = INTRADAY_LAG_TOLERANCE_MS[id];
      if (tolerance == null) {
        item.lagVsReferenceMs = Math.round(referenceAtMs - toEpochMs(item.dataAsOf));
        continue;
      }
      const lag = Math.round(referenceAtMs - toEpochMs(item.dataAsOf));
      item.lagVsReferenceMs = lag;
      if (lag > tolerance) {
        const severity = lag > Math.max(tolerance * 3, 5 * MINOR_LAG_MS) ? 'MAJOR' : 'MINOR';
        flags.push({
          code: `${id}_LAGS_PRICE`,
          source: id,
          lagMs: lag,
          toleranceMs: tolerance,
          severity,
          note: `${id} tertinggal ${Math.round(lag / 1000)} dtk dari ${referenceId}.`,
        });
      }
    }
  }

  let skewStatus = 'UNKNOWN';
  if (referenceId) {
    if (flags.some((flag) => flag.severity === 'MAJOR')) skewStatus = 'MAJOR_SKEW';
    else if (flags.some((flag) => flag.severity === 'MINOR')) skewStatus = 'MINOR_SKEW';
    else skewStatus = 'SYNCED';
  }

  const affectedSources = [...new Set(flags.map((flag) => flag.source))];

  return {
    sourceFreshness,
    crossSourceTiming: {
      referenceSource: referenceId,
      referenceAt: referenceId ? sourceFreshness[referenceId].dataAsOf : null,
      skewStatus,
      affectedSources,
      flags,
      perSource,
      policy: 'Referensi = XM tick/OHLC terbaru. Sumber yang lebih tua tetap dilaporkan; tidak pernah dianggap satu kondisi pasar yang sama tanpa penanda skew.',
    },
  };
}

export { toEpochMs };
