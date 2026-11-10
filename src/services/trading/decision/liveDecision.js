/**
 * liveDecision.js
 * Tahap 7A — live composition of the JINI decision pipeline.
 *
 * This module is pure: it never fetches, never fabricates data, and never
 * grants execution privileges. Callers supply the same panel service outputs
 * that the Broker Workspace renders, and receive a frozen snapshot plus the
 * deterministic decision, its integrity validation, and a locked synthesis.
 */

import { analyzeSupplyDemand } from '../supplyDemand/SupplyDemandEngine.js';
import { buildScalpingM1Analysis } from '../scalping/scalpingM1.js';
import { buildJiniSnapshotFromPanels } from './panelIntegration.js';
import { evaluateJiniDecision, validateDecision } from './JiniDecisionEngine.js';
import { synthesizeJiniDecision, validateSynthesis } from './aiSynthesis.js';

const SNAPSHOT_SUMMARY_KEYS = [
  'snapshotId',
  'snapshotContractVersion',
  'engineVersion',
  'generatedAt',
  'overallIntegrity',
  'marketDataIntegrity',
  'terminalConnectivity',
  'overallSystemStatus',
  'criticalSourcesMissing',
  'optionalSourcesMissing',
  'degradedSources',
  'missingSources',
  'marketSession',
  'priceData',
  'sourceFreshness',
  'sourceIntegrity',
  'crossSourceTiming',
  'evidenceHash',
];

const EXECUTION_FLAGS = Object.freeze([
  'entryPermission',
  'executionAllowed',
  'autoTrade',
  'isSignal',
  'strategyApproved',
]);

function summarizeSnapshot(snapshot) {
  const summary = {};
  for (const key of SNAPSHOT_SUMMARY_KEYS) {
    if (snapshot?.[key] !== undefined) summary[key] = snapshot[key];
  }
  return summary;
}

function resolvePayloads(xmMulti) {
  return xmMulti?.payloads && typeof xmMulti.payloads === 'object'
    ? xmMulti.payloads
    : {};
}

function sameStringArray(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

/**
 * Reads the intermarket provider contract at its real location
 * (`analysis.status` plus per-instrument status) and preserves DELAYED/STALE
 * labels instead of collapsing everything into UNAVAILABLE.
 */
export function deriveIntermarketSourceStatus(intermarket, snapshot) {
  const evidenceStatus = snapshot?.intermarketEvidence?.status ?? 'UNAVAILABLE';
  const freshnessStatus = snapshot?.sourceFreshness?.INTERMARKET?.status ?? 'UNAVAILABLE';
  const providerStatus = intermarket?.analysis?.status ?? null;
  const instruments = Array.isArray(intermarket?.instruments) ? intermarket.instruments : [];
  const symbolsByStatus = (value) => instruments
    .filter((instrument) => instrument?.status === value)
    .map((instrument) => instrument?.symbol ?? instrument?.id)
    .filter(Boolean);

  const delayedInstruments = symbolsByStatus('DELAYED');
  const staleInstruments = Array.from(new Set([
    ...(intermarket?.analysis?.dataCompleteness?.staleInstruments || []),
    ...symbolsByStatus('STALE'),
  ]));
  const unavailableInstruments = symbolsByStatus('UNAVAILABLE');

  let status = 'UNAVAILABLE';
  if (intermarket?.ok === true && intermarket?.analysis) {
    if (evidenceStatus === 'UNAVAILABLE') {
      status = 'UNAVAILABLE';
    } else if (freshnessStatus === 'STALE' || staleInstruments.length > 0) {
      status = 'STALE';
    } else if (delayedInstruments.length > 0) {
      status = 'DELAYED';
    } else if (instruments.length > 0 && unavailableInstruments.length === instruments.length) {
      status = 'UNAVAILABLE';
    } else if (unavailableInstruments.length > 0
      || providerStatus === 'INSUFFICIENT_DATA'
      || evidenceStatus === 'DEGRADED') {
      status = 'DEGRADED';
    } else {
      status = 'READY';
    }
  }

  return {
    ok: intermarket?.ok === true,
    status,
    providerStatus,
    freshnessStatus,
    engineStatus: evidenceStatus,
    instrumentCount: instruments.length,
    delayedInstruments,
    staleInstruments,
    unavailableInstruments,
  };
}

/**
 * Verifies that synthesis only interprets the deterministic decision and can
 * never alter decision, conflicts, confidence cap, or execution privileges.
 */
export function validateLiveSynthesis(synthesis, decision) {
  const base = validateSynthesis(synthesis, decision);
  const errors = [...base.errors];

  if (!synthesis || !decision) {
    return { valid: false, errors: [...errors, 'Synthesis or decision missing'], warnings: base.warnings };
  }
  if (synthesis.inputDecisionHash !== decision.evidenceHash) {
    errors.push('Synthesis inputDecisionHash does not match the decision evidence hash');
  }
  if (synthesis.finalDecision !== decision.preliminaryDecision) {
    errors.push('Synthesis changed the deterministic decision');
  }
  if (synthesis.decisionLocked !== true) {
    errors.push('Synthesis decisionLocked must be true');
  }
  if (synthesis.finalDecisionSource !== 'DETERMINISTIC_ENGINE') {
    errors.push('Synthesis finalDecisionSource must be DETERMINISTIC_ENGINE');
  }

  const hardCodes = (decision.hardConflicts || []).map((item) => item.code);
  const softCodes = (decision.softConflicts || []).map((item) => item.code);
  if (!sameStringArray(synthesis.hardGateSnapshot?.hardConflicts, hardCodes)) {
    errors.push('Synthesis altered the hard conflict gate');
  }
  if (!sameStringArray(synthesis.hardGateSnapshot?.softConflicts, softCodes)) {
    errors.push('Synthesis altered the soft conflict gate');
  }
  if (synthesis.hardGateSnapshot?.dataQualityStatus !== decision.dataQualityStatus) {
    errors.push('Synthesis altered dataQualityStatus');
  }
  if (synthesis.hardGateSnapshot?.executionStatus !== decision.executionFeasibility?.status) {
    errors.push('Synthesis altered execution feasibility');
  }
  if (synthesis.hardGateSnapshot?.confidenceCapPercent !== decision.confidenceCap?.capPercent) {
    errors.push('Synthesis altered the confidence cap');
  }
  for (const flag of EXECUTION_FLAGS) {
    if (synthesis[flag] !== false) errors.push(`Synthesis must keep ${flag} false`);
  }

  return { valid: errors.length === 0, errors, warnings: base.warnings };
}

function buildSynthesis(decision, now, synthesizer = synthesizeJiniDecision) {
  try {
    const candidate = synthesizer(decision, { now });
    const validation = validateLiveSynthesis(candidate, decision);
    if (validation.valid) {
      return { synthesis: candidate, synthesisStatus: 'READY', synthesisValidation: validation, synthesisError: null };
    }
    return {
      synthesis: null,
      synthesisStatus: 'UNAVAILABLE',
      synthesisValidation: validation,
      synthesisError: validation.errors.join('; ') || 'Synthesis contract validation failed.',
    };
  } catch (error) {
    return {
      synthesis: null,
      synthesisStatus: 'UNAVAILABLE',
      synthesisValidation: { valid: false, errors: [error?.message || 'Synthesis failed.'], warnings: [] },
      synthesisError: error?.message || 'Synthesis failed.',
    };
  }
}

/**
 * Builds the snapshot and decision from already-fetched panel outputs.
 *
 * @param {object} input
 * @param {object} input.xmMulti Output of fetchXmOhlcMulti({ includeDaily:true })
 * @param {object} [input.supplyDemand] Pre-computed analyzeSupplyDemand output
 * @param {object} [input.scalping] Pre-computed buildScalpingM1Analysis output
 * @param {object} [input.orderFlow] Output of fetchGoldOrderFlow(...)
 * @param {object} [input.intermarket] Output of fetchGoldIntermarketFactors(...)
 * @param {object} [input.terminal] BrokerWorkspaceManager getStatus() snapshot
 * @param {object} [input.bridge] Output of fetchXmBridgeStatus(...)
 * @param {number} [input.now]
 */
export function composeJiniDecision({
  xmMulti = null,
  supplyDemand = null,
  scalping = null,
  orderFlow = null,
  intermarket = null,
  terminal = null,
  bridge = null,
  now = Date.now(),
} = {}) {
  const evaluatedAt = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const symbol = xmMulti?.symbol || 'XAUUSD';
  const payloads = resolvePayloads(xmMulti);

  const supplyDemandOutput = supplyDemand
    || analyzeSupplyDemand({ symbol, payloads, now: evaluatedAt });
  const scalpingOutput = scalping
    || buildScalpingM1Analysis({ symbol, payloads, now: evaluatedAt });

  const snapshot = buildJiniSnapshotFromPanels({
    xmMulti,
    supplyDemand: supplyDemandOutput,
    scalping: scalpingOutput,
    orderFlow,
    intermarket,
    terminal,
    bridge,
    now: evaluatedAt,
  });

  const decision = evaluateJiniDecision(snapshot, { now: evaluatedAt });
  const validation = validateDecision(decision);
  const synthesisResult = buildSynthesis(decision, evaluatedAt);
  const finalDecision = decision.preliminaryDecision;

  return {
    ok: true,
    instrument: decision.instrument,
    decision,
    validation,
    synthesis: synthesisResult.synthesis,
    synthesisStatus: synthesisResult.synthesisStatus,
    synthesisValidation: synthesisResult.synthesisValidation,
    synthesisError: synthesisResult.synthesisError,
    finalDecision,
    finalDecisionSource: 'DETERMINISTIC_ENGINE',
    decisionLocked: true,
    decisionConsistency: {
      engineDecision: decision.preliminaryDecision,
      finalDecision,
      matches: finalDecision === decision.preliminaryDecision,
      aiMayOverride: false,
      synthesisStatus: synthesisResult.synthesisStatus,
    },
    snapshot: summarizeSnapshot(snapshot),
    sources: {
      xm: {
        ok: xmMulti?.ok === true,
        symbol,
        timeframes: Object.keys(payloads),
        failures: Object.keys(xmMulti?.failures || {}),
      },
      orderFlow: {
        ok: orderFlow?.ok === true,
        status: snapshot.orderFlowEvidence?.status ?? 'UNAVAILABLE',
        providerStatus: orderFlow?.status ?? null,
        freshness: snapshot.orderFlowEvidence?.freshness ?? 'UNAVAILABLE',
      },
      intermarket: deriveIntermarketSourceStatus(intermarket, snapshot),
      supplyDemand: { ok: supplyDemandOutput?.ok === true, status: snapshot.supplyDemandEvidence?.status ?? 'UNAVAILABLE' },
      scalping: { ok: scalpingOutput?.ok === true, status: snapshot.scalpingEvidence?.status ?? 'UNAVAILABLE' },
      bridge: { online: bridge?.online === true, status: bridge?.status ?? 'UNAVAILABLE' },
      terminal: {
        supplied: Boolean(terminal),
        status: snapshot.terminalConnectivity?.status ?? 'UNAVAILABLE',
        bridgeOnline: snapshot.terminalConnectivity?.bridgeOnline === true,
      },
    },
    // Constitution: the decision is analysis, never an execution permission.
    entryPermission: false,
    executionAllowed: false,
    autoTrade: false,
    isSignal: false,
    strategyApproved: false,
  };
}

export default composeJiniDecision;
