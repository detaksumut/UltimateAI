/**
 * JiniDecisionEngine.js
 * Tahap 3 — Deterministic Conflict Gate + Weighted Evidence Engine.
 *
 * Reads a JINI_TRADING_CONTEXT_SNAPSHOT and produces a preliminary assessment.
 * It NEVER produces an executable order:
 *   - BUY_BIAS/SELL_BIAS are evidence labels, not entry permissions.
 *   - entryPermission/executionAllowed/autoTrade/isSignal/strategyApproved are
 *     always false.
 *
 * The engine is pure and deterministic for a given snapshot content.
 */

import crypto from 'crypto';
import { DATA_INTEGRITY_STATUS } from './constants.js';
import {
  DECISION_CONTRACT_VERSION,
  DECISION_THRESHOLDS,
  DECISION_NOTES,
} from './weights.js';
import {
  buildWeightedEvidence,
} from './evidenceEngine.js';
import {
  computeAnchor,
  evaluateConflictGate,
} from './conflictGate.js';
import {
  classifyTimeframe,
  computePriceResponse,
  computeZoneContext,
  deriveEntryRead,
  deriveIntermarketRead,
  deriveOrderFlowRead,
  deriveSetupRead,
  detectMarketStructure,
  getTimeframeCandles,
  round,
} from './marketAnalysis.js';
import { buildJiniTradingContextSnapshot, deepFreeze, stableStringify } from './JiniContextSnapshot.js';

const CRITICAL_PRICE_SOURCES = ['XM_TICK', 'XM_D1', 'XM_H4'];
const BLOCKING_HARD_CODES = new Set([
  'CRITICAL_DATA_UNAVAILABLE',
  'CRITICAL_DATA_STALE',
  'EXECUTION_SPREAD_TOO_WIDE',
  'EXECUTION_PRICE_UNAVAILABLE',
]);

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function computeDataQuality(snapshot) {
  const criticalMissing = Array.isArray(snapshot?.criticalSourcesMissing)
    ? snapshot.criticalSourcesMissing.slice()
    : [];
  const sourceFreshness = snapshot?.sourceFreshness || {};
  const missing = new Set(criticalMissing);

  for (const sourceId of CRITICAL_PRICE_SOURCES) {
    if (sourceFreshness[sourceId]?.status === DATA_INTEGRITY_STATUS.UNAVAILABLE) {
      missing.add(sourceId);
    }
  }

  const criticalUnavailable = missing.size > 0
    || snapshot?.overallIntegrity === DATA_INTEGRITY_STATUS.UNAVAILABLE;

  const criticalStale = CRITICAL_PRICE_SOURCES.filter((sourceId) =>
    [DATA_INTEGRITY_STATUS.STALE, DATA_INTEGRITY_STATUS.DEGRADED]
      .includes(sourceFreshness[sourceId]?.status));

  const optionalStale = Object.entries(sourceFreshness)
    .filter(([sourceId, entry]) => !CRITICAL_PRICE_SOURCES.includes(sourceId)
      && entry?.status === DATA_INTEGRITY_STATUS.STALE)
    .map(([sourceId]) => sourceId);

  const majorSkew = snapshot?.crossSourceTiming?.skewStatus === 'MAJOR_SKEW';
  const marketIntegrity = snapshot?.marketDataIntegrity ?? snapshot?.overallIntegrity;
  let status = DATA_INTEGRITY_STATUS.READY;
  if (criticalUnavailable) status = DATA_INTEGRITY_STATUS.UNAVAILABLE;
  else if (criticalStale.length > 0
    || marketIntegrity === DATA_INTEGRITY_STATUS.DEGRADED
    || majorSkew) {
    status = DATA_INTEGRITY_STATUS.DEGRADED;
  }

  const reasons = [];
  if (criticalUnavailable) reasons.push(`Sumber kritis hilang: ${[...missing].join(', ')}.`);
  if (criticalStale.length > 0) reasons.push(`Sumber kritis stale: ${criticalStale.join(', ')}.`);
  if (majorSkew) reasons.push('Cross-source timing berstatus MAJOR_SKEW.');
  if (reasons.length === 0) reasons.push('Sumber harga kritis tersedia dan sinkron.');

  return {
    status,
    criticalUnavailable,
    criticalStale: criticalStale.length > 0,
    stale: criticalStale,
    missing: [...missing],
    optionalStale,
    majorSkew,
    reasons,
  };
}

function computeExecutionFeasibility(snapshot) {
  const priceData = snapshot?.priceData || {};
  const spreadPips = finite(priceData.spreadPips);
  const maxSpreadPips = DECISION_THRESHOLDS.MAX_SPREAD_PIPS;
  const atrM1 = finite(snapshot?.scalpingEvidence?.trend?.atr);
  const spreadToAtr = finite(snapshot?.scalpingEvidence?.spreadToAtr)
    ?? (atrM1 && atrM1 > 0 && spreadPips != null ? spreadPips / atrM1 : null);

  let status = 'FEASIBLE';
  const reasons = [];

  if (priceData.valid !== true || spreadPips == null) {
    status = 'UNAVAILABLE';
    reasons.push('Tick/spread XM tidak tersedia; eksekusi tidak dapat dinilai.');
  } else if (spreadPips > maxSpreadPips) {
    status = 'WIDE_SPREAD';
    reasons.push(`Spread ${spreadPips} > batas ${maxSpreadPips}.`);
  } else if (spreadToAtr != null && spreadToAtr > DECISION_THRESHOLDS.MAX_SPREAD_TO_ATR) {
    status = 'DEGRADED';
    reasons.push(`Spread/ATR ${round(spreadToAtr, 3)} > ${DECISION_THRESHOLDS.MAX_SPREAD_TO_ATR}.`);
  } else {
    reasons.push(`Spread ${spreadPips} dalam batas; spread/ATR ${spreadToAtr == null ? '—' : round(spreadToAtr, 3)}.`);
  }

  return {
    status,
    feasible: status === 'FEASIBLE' || status === 'DEGRADED',
    spreadPips,
    maxSpreadPips,
    spreadToAtr: spreadToAtr == null ? null : round(spreadToAtr, 4),
    atrM1,
    reasons,
  };
}

function buildHigherTimeframeAlignment(trends, anchor) {
  return {
    d1: trends.D1?.direction ?? 'UNKNOWN',
    h4: trends.H4?.direction ?? 'UNKNOWN',
    h1: trends.H1?.direction ?? 'UNKNOWN',
    m15: trends.M15?.direction ?? 'UNKNOWN',
    m5: trends.M5?.direction ?? 'UNKNOWN',
    m1: trends.M1?.direction ?? 'UNKNOWN',
    aligned: anchor.aligned === true,
    conflict: anchor.conflict === true,
    anchorDirection: anchor.direction,
    reason: anchor.reason,
  };
}

function buildMissingEvidence(snapshot, weightedEvidence, orderFlowRead, intermarketRead) {
  const missing = [];

  for (const category of weightedEvidence.categories) {
    if (!category.available) {
      missing.push({
        id: category.id,
        kind: 'EVIDENCE_CATEGORY',
        reason: category.unavailableReason || `${category.label} tidak tersedia.`,
      });
    }
  }

  for (const [sourceId, entry] of Object.entries(snapshot?.sourceFreshness || {})) {
    if (entry?.status && entry.status !== DATA_INTEGRITY_STATUS.READY) {
      missing.push({
        id: sourceId,
        kind: 'SOURCE_FRESHNESS',
        status: entry.status,
        ageMs: entry.ageMs ?? null,
        dataAsOf: entry.dataAsOf ?? null,
      });
    }
  }

  for (const sourceId of snapshot?.criticalSourcesMissing || []) {
    missing.push({ id: sourceId, kind: 'CRITICAL_SOURCE' });
  }
  for (const sourceId of snapshot?.optionalSourcesMissing || []) {
    missing.push({ id: sourceId, kind: 'OPTIONAL_SOURCE' });
  }

  if (orderFlowRead?.available === false) {
    missing.push({
      id: 'ORDER_FLOW_CONFIRMATION',
      kind: 'ORDER_FLOW',
      reason: 'Order Flow tidak dipakai; tidak ada konfirmasi agresor yang dikarang.',
    });
  }

  if (intermarketRead?.available === false && Array.isArray(intermarketRead.notProvided)
    && intermarketRead.notProvided.length > 0) {
    missing.push({
      id: 'INTERMARKET_INSTRUMENTS_NOT_PROVIDED',
      kind: 'PROVIDER_COVERAGE',
      instruments: intermarketRead.notProvided.slice(),
      reason: 'Instrumen belum tersedia dari provider; tidak diisi data simulasi.',
    });
  }

  return missing;
}

function summarizeReasons({
  anchor,
  trends,
  weightedEvidence,
  hardConflicts,
  softConflicts,
  confidenceCap,
  dataQuality,
  execution,
  preliminaryDecision,
}) {
  const reasons = [];
  reasons.push(`D1=${trends.D1?.direction || 'UNKNOWN'}, H4=${trends.H4?.direction || 'UNKNOWN'} => anchor ${anchor.direction || 'NONE'}.`);
  reasons.push(
    `Skor bukti BUY=${weightedEvidence.buyEvidenceScore}, SELL=${weightedEvidence.sellEvidenceScore}, NEUTRAL=${weightedEvidence.neutralEvidenceScore}.`,
  );
  reasons.push(`Data quality=${dataQuality.status}; eksekusi=${execution.status} (spread ${execution.spreadPips ?? '—'}).`);
  for (const conflict of hardConflicts) reasons.push(`HARD ${conflict.code}: ${conflict.message}`);
  for (const conflict of softConflicts) reasons.push(`SOFT ${conflict.code}: ${conflict.message}`);
  if (confidenceCap.applied) reasons.push(`Confidence cap ${confidenceCap.capPercent}%.`);
  reasons.push(`Keputusan sementara: ${preliminaryDecision}. ${DECISION_NOTES.biasIsNotEntry}`);
  return reasons;
}

function decide({ dataQuality, execution, hardConflicts, anchor, weightedEvidence, confidenceCap }) {
  const blockedByHard = hardConflicts.some((item) => BLOCKING_HARD_CODES.has(item.code));
  if (dataQuality.status === DATA_INTEGRITY_STATUS.UNAVAILABLE || blockedByHard) {
    return 'NO_TRADE';
  }
  if (hardConflicts.length > 0) return 'WAIT';
  if (!anchor.direction) return 'WAIT';

  const leading = anchor.direction === 'BUY'
    ? weightedEvidence.buyEvidenceScore
    : weightedEvidence.sellEvidenceScore;
  const other = anchor.direction === 'BUY'
    ? weightedEvidence.sellEvidenceScore
    : weightedEvidence.buyEvidenceScore;
  const edge = leading - other;
  const cappedLeading = Math.min(leading, confidenceCap.capPercent);

  if (edge < DECISION_THRESHOLDS.MIN_BIAS_EDGE_POINTS) return 'WAIT';
  if (cappedLeading < DECISION_THRESHOLDS.MIN_BIAS_CONFIDENCE) return 'WAIT';
  return anchor.direction === 'BUY' ? 'BUY_BIAS' : 'SELL_BIAS';
}

export function computeDecisionEvidenceHash(payload) {
  try {
    const clone = { ...(payload || {}) };
    delete clone.evidenceHash;
    delete clone.evaluatedAt;
    return crypto.createHash('sha256').update(stableStringify(clone)).digest('hex');
  } catch (_) {
    return 'DECISION_HASH_GENERATION_FAILED';
  }
}

/**
 * Evaluates a snapshot. Accepts either a snapshot object or raw panel inputs.
 */
export function evaluateJiniDecision(snapshotOrInput, { now = Date.now() } = {}) {
  const snapshot = snapshotOrInput?.snapshotContractVersion
    ? snapshotOrInput
    : buildJiniTradingContextSnapshot({ ...(snapshotOrInput || {}), now });

  const trends = {};
  for (const timeframe of ['M1', 'M5', 'M15', 'H1', 'H4', 'D1']) {
    trends[timeframe] = classifyTimeframe(snapshot, timeframe);
  }

  const structure = detectMarketStructure(getTimeframeCandles(snapshot, 'H1'));
  const priceResponse = computePriceResponse(getTimeframeCandles(snapshot, 'M1'));
  const atrM1 = trends.M1?.atr ?? null;
  const zoneContext = computeZoneContext(snapshot, atrM1);
  const orderFlowRead = deriveOrderFlowRead(snapshot, zoneContext, priceResponse);
  const intermarketRead = deriveIntermarketRead(snapshot);
  const setupRead = deriveSetupRead(trends);
  const entryRead = deriveEntryRead(snapshot, trends.M1);
  const anchor = computeAnchor(trends);

  const weightedEvidence = buildWeightedEvidence({
    trends,
    structure,
    zoneContext,
    orderFlowRead,
    intermarketRead,
    setupRead,
    entryRead,
  });

  const dataQuality = computeDataQuality(snapshot);
  const execution = computeExecutionFeasibility(snapshot);

  const gate = evaluateConflictGate({
    snapshot,
    anchor,
    trends,
    structure,
    zoneContext,
    orderFlowRead,
    intermarketRead,
    setupRead,
    entryRead,
    priceResponse,
    execution,
    dataQuality,
    weightedEvidence,
  });

  const rawConfidence = Math.max(
    weightedEvidence.buyEvidenceScore,
    weightedEvidence.sellEvidenceScore,
  );
  const confidenceCap = {
    ...gate.confidenceCap,
    rawConfidence: round(rawConfidence, 2),
    cappedConfidence: round(Math.min(rawConfidence, gate.confidenceCap.capPercent), 2),
    leadingDirection: anchor.direction,
  };

  const preliminaryDecision = decide({
    dataQuality,
    execution,
    hardConflicts: gate.hardConflicts,
    anchor,
    weightedEvidence,
    confidenceCap,
  });

  const evaluatedAt = new Date(Number.isFinite(Number(now)) ? Number(now) : Date.now()).toISOString();

  const missingEvidence = buildMissingEvidence(
    snapshot,
    weightedEvidence,
    orderFlowRead,
    intermarketRead,
  );

  const decision = {
    engineVersion: 'jini-decision-engine-v1.0.0',
    decisionContractVersion: DECISION_CONTRACT_VERSION,
    instrument: snapshot.instrument || 'XAUUSD',
    evaluatedAt,
    dailyBias: trends.D1?.direction || 'UNKNOWN',
    higherTimeframeAlignment: buildHigherTimeframeAlignment(trends, anchor),
    buyEvidenceScore: weightedEvidence.buyEvidenceScore,
    sellEvidenceScore: weightedEvidence.sellEvidenceScore,
    neutralEvidenceScore: weightedEvidence.neutralEvidenceScore,
    weightedEvidence: weightedEvidence.categories,
    weightNormalization: {
      totalAvailableWeight: weightedEvidence.totalAvailableWeight,
      availableCategories: weightedEvidence.availableCategories,
      unavailableCategories: weightedEvidence.unavailableCategories,
      note: DECISION_NOTES.weightNormalization,
    },
    hardConflicts: gate.hardConflicts,
    softConflicts: gate.softConflicts,
    confidenceCap,
    dataQualityStatus: dataQuality.status,
    dataQuality: {
      criticalUnavailable: dataQuality.criticalUnavailable,
      criticalStale: dataQuality.criticalStale,
      staleSources: dataQuality.stale,
      optionalStaleSources: dataQuality.optionalStale,
      majorSkew: dataQuality.majorSkew,
      reasons: dataQuality.reasons,
    },
    executionFeasibility: execution,
    preliminaryDecision,
    decisionReasons: summarizeReasons({
      anchor,
      trends,
      weightedEvidence,
      hardConflicts: gate.hardConflicts,
      softConflicts: gate.softConflicts,
      confidenceCap,
      dataQuality,
      execution,
      preliminaryDecision,
    }),
    missingEvidence,
    diagnostics: {
      anchor,
      trends,
      structure,
      priceResponse,
      zoneContext,
      orderFlowRead,
      intermarketRead,
      setupRead,
      entryRead,
      limitations: [
        'Bobot adalah hipotesis, bukan probabilitas kemenangan.',
        'PAXG/USDT adalah proxy; COMEX GC tetap UNAVAILABLE.',
        intermarketRead?.available === false
          ? 'Intermarket tidak dipakai; instrumen silver/copper/sp500 tidak diisi simulasi.'
          : null,
      ].filter(Boolean),
    },
    // Execution guarantees: bias is never an entry permission.
    entryPermission: false,
    executionAllowed: false,
    autoTrade: false,
    isSignal: false,
    strategyApproved: false,
    note: DECISION_NOTES.biasIsNotEntry,
  };

  decision.evidenceHash = computeDecisionEvidenceHash(decision);
  return deepFreeze(decision);
}

export function validateDecision(decision) {
  const errors = [];
  const warnings = [];

  const allowed = ['BUY_BIAS', 'SELL_BIAS', 'WAIT', 'NO_TRADE'];
  if (!allowed.includes(decision?.preliminaryDecision)) {
    errors.push(`Unknown preliminaryDecision: ${decision?.preliminaryDecision}`);
  }
  if (typeof decision?.evidenceHash !== 'string' || decision.evidenceHash.length !== 64) {
    errors.push('Decision evidenceHash is missing or malformed');
  } else if (computeDecisionEvidenceHash(decision) !== decision.evidenceHash) {
    errors.push('Decision evidenceHash mismatch');
  }
  if (decision?.entryPermission !== false
    || decision?.executionAllowed !== false
    || decision?.autoTrade !== false
    || decision?.isSignal !== false
    || decision?.strategyApproved !== false) {
    errors.push('Bias must never grant entry/execution privileges');
  }
  if (['BUY_BIAS', 'SELL_BIAS'].includes(decision?.preliminaryDecision)
    && (decision?.hardConflicts || []).length > 0) {
    errors.push('A hard conflict must never coexist with a BUY_BIAS/SELL_BIAS decision');
  }
  if ((decision?.softConflicts || []).some((item) => item.severity !== 'SOFT')) {
    warnings.push('Soft conflict list contains a non-SOFT entry');
  }
  if ((decision?.hardConflicts || []).some((item) => item.severity !== 'HARD')) {
    warnings.push('Hard conflict list contains a non-HARD entry');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export default evaluateJiniDecision;
