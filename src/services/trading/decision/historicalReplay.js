/**
 * historicalReplay.js
 * Tahap 5 — Deterministic Historical Replay.
 *
 * Replays a chronological sequence of already-captured JINI context snapshots
 * through the Tahap 3 decision engine (and, optionally, the Tahap 4 synthesis).
 *
 * Guarantees:
 * - No network, no live fetch, no order execution.
 * - No look-ahead: every source timestamp must be <= the replay `asOf` instant
 *   (small tolerance), otherwise the record is rejected (fail-closed).
 * - Chronological ordering is enforced; duplicate `asOf` records are rejected.
 * - A SHA-256 hash chain lets a replay be re-verified for tampering.
 * - The replay only reports what the deterministic engine produced; it never
 *   rewrites a decision or invents missing evidence.
 */

import crypto from 'crypto';
import { evaluateJiniDecision } from './JiniDecisionEngine.js';
import { synthesizeJiniDecision } from './aiSynthesis.js';
import { buildJiniSnapshotFromPanels } from './panelIntegration.js';
import { deepFreeze, stableStringify } from './JiniContextSnapshot.js';

export const REPLAY_CONTRACT_VERSION = 'jini-historical-replay-v1';
export const DEFAULT_LOOKAHEAD_TOLERANCE_MS = 1000;

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toEpochMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function hashOf(payload) {
  try {
    return crypto.createHash('sha256').update(stableStringify(payload)).digest('hex');
  } catch (_) {
    return 'REPLAY_HASH_GENERATION_FAILED';
  }
}

function resolveRecordAsOf(record) {
  if (!record || typeof record !== 'object') return NaN;
  return toEpochMs(
    record.asOf
      ?? record.generatedAtEpochMs
      ?? record.snapshot?.generatedAtEpochMs
      ?? record.snapshot?.generatedAt
      ?? record.panels?.now,
  );
}

function buildRecordSnapshot(record, asOfMs) {
  if (record?.snapshot && typeof record.snapshot === 'object') return record.snapshot;
  if (record?.panels && typeof record.panels === 'object') {
    return buildJiniSnapshotFromPanels({ ...record.panels, now: asOfMs });
  }
  return null;
}

function extractReferencePrice(snapshot) {
  const mid = finite(snapshot?.priceData?.mid);
  if (mid != null && mid > 0) return mid;
  const series = snapshot?.sources?.xmPrice?.candles?.M1?.candles;
  if (Array.isArray(series) && series.length > 0) {
    const close = finite(series[series.length - 1]?.close);
    if (close != null && close > 0) return close;
  }
  return null;
}

/**
 * Verifies that a snapshot does not contain evidence stamped after `asOf`.
 * This is the look-ahead guard for historical replay.
 */
export function auditSnapshotNoLookahead(snapshot, asOf, {
  toleranceMs = DEFAULT_LOOKAHEAD_TOLERANCE_MS,
} = {}) {
  const asOfMs = toEpochMs(asOf);
  if (!Number.isFinite(asOfMs)) {
    return {
      safe: false,
      asOf: null,
      maxDataAsOf: null,
      violations: [{ source: 'AS_OF', code: 'INVALID_AS_OF', dataAsOf: null, lagMs: null }],
    };
  }

  const violations = [];
  let maxDataMs = null;
  const check = (source, raw) => {
    const ms = toEpochMs(raw);
    if (!Number.isFinite(ms)) return;
    if (maxDataMs == null || ms > maxDataMs) maxDataMs = ms;
    if (ms > asOfMs + toleranceMs) {
      violations.push({
        source,
        dataAsOf: new Date(ms).toISOString(),
        lagMs: ms - asOfMs,
      });
    }
  };

  for (const [source, entry] of Object.entries(snapshot?.sourceFreshness || {})) {
    check(source, entry?.dataAsOf);
  }
  check('XM_TICK_PRICE', snapshot?.priceData?.tickTimestamp);

  violations.sort((a, b) => a.source.localeCompare(b.source));

  return {
    safe: violations.length === 0,
    asOf: new Date(asOfMs).toISOString(),
    maxDataAsOf: maxDataMs == null ? null : new Date(maxDataMs).toISOString(),
    violations,
  };
}

/**
 * Replays a list of `{ asOf, snapshot }` or `{ asOf, panels }` records.
 *
 * @param {Array<object>} records
 * @param {object} [options]
 * @param {boolean} [options.includeSynthesis=true]
 * @param {boolean} [options.strictLookahead=true] Reject (instead of flag) leaks.
 * @param {number} [options.toleranceMs]
 */
export function replayJiniHistory(records, {
  includeSynthesis = true,
  strictLookahead = true,
  toleranceMs = DEFAULT_LOOKAHEAD_TOLERANCE_MS,
} = {}) {
  if (!Array.isArray(records)) {
    throw new TypeError('replayJiniHistory expects an array of records');
  }

  const scheduled = records.map((record, inputIndex) => ({
    record,
    inputIndex,
    asOfMs: resolveRecordAsOf(record),
  }));
  scheduled.sort((a, b) => {
    const left = Number.isFinite(a.asOfMs) ? a.asOfMs : Number.POSITIVE_INFINITY;
    const right = Number.isFinite(b.asOfMs) ? b.asOfMs : Number.POSITIVE_INFINITY;
    if (left !== right) return left - right;
    return a.inputIndex - b.inputIndex;
  });

  const entries = [];
  const errors = [];
  const seenAsOf = new Set();
  let previousEntryHash = 'GENESIS';
  let lookaheadViolations = 0;

  scheduled.forEach(({ record, inputIndex, asOfMs }, index) => {
    let status = 'EVALUATED';
    let error = null;
    let decision = null;
    let synthesis = null;
    let referencePrice = null;
    let lookahead = {
      safe: false,
      asOf: Number.isFinite(asOfMs) ? new Date(asOfMs).toISOString() : null,
      maxDataAsOf: null,
      violations: [],
    };

    const reject = (code, message) => {
      status = 'REJECTED';
      error = { code, message };
      errors.push({ index, inputIndex, code, message });
    };

    if (!Number.isFinite(asOfMs)) {
      reject('MISSING_OR_INVALID_AS_OF', 'Record has no usable asOf timestamp.');
    } else if (seenAsOf.has(asOfMs)) {
      reject('DUPLICATE_AS_OF', `Duplicate asOf ${new Date(asOfMs).toISOString()}; ordering is ambiguous.`);
    } else {
      seenAsOf.add(asOfMs);
      const snapshot = buildRecordSnapshot(record, asOfMs);
      if (!snapshot) {
        reject('MISSING_SNAPSHOT', 'Record has neither snapshot nor panels.');
      } else {
        lookahead = auditSnapshotNoLookahead(snapshot, asOfMs, { toleranceMs });
        if (!lookahead.safe) {
          lookaheadViolations += 1;
          if (strictLookahead) {
            reject(
              'LOOKAHEAD_DETECTED',
              `Snapshot contains evidence newer than asOf: ${lookahead.violations.map((item) => item.source).join(', ')}.`,
            );
          }
        }
        if (status === 'EVALUATED') {
          try {
            decision = evaluateJiniDecision(snapshot, { now: asOfMs });
            synthesis = includeSynthesis
              ? synthesizeJiniDecision(decision, { now: asOfMs })
              : null;
            referencePrice = extractReferencePrice(snapshot);
          } catch (err) {
            reject('EVALUATION_ERROR', err?.message ? String(err.message) : String(err));
            decision = null;
            synthesis = null;
            referencePrice = null;
          }
        }
      }
    }

    const base = {
      index,
      inputIndex,
      asOf: Number.isFinite(asOfMs) ? asOfMs : null,
      asOfIso: Number.isFinite(asOfMs) ? new Date(asOfMs).toISOString() : null,
      status,
      error,
      lookaheadSafe: lookahead.safe === true,
      lookahead,
      referencePrice,
    };

    const entryHash = hashOf({
      ...base,
      decisionHash: decision?.evidenceHash ?? null,
      synthesisHash: synthesis?.evidenceHash ?? null,
      previousEntryHash,
    });

    entries.push({
      ...base,
      decision,
      synthesis,
      previousEntryHash,
      entryHash,
    });
    previousEntryHash = entryHash;
  });

  const decisionCounts = {};
  const integrityCounts = {};
  for (const entry of entries) {
    if (!entry.decision) continue;
    decisionCounts[entry.decision.preliminaryDecision] = (decisionCounts[entry.decision.preliminaryDecision] || 0) + 1;
    integrityCounts[entry.decision.dataQualityStatus] = (integrityCounts[entry.decision.dataQualityStatus] || 0) + 1;
  }

  const evaluated = entries.filter((entry) => entry.status === 'EVALUATED').length;
  const summary = {
    total: records.length,
    evaluated,
    rejected: entries.length - evaluated,
    errors: errors.length,
    lookaheadViolations,
    decisionCounts,
    integrityCounts,
  };

  const replayHash = hashOf(entries.map((entry) => ({
    index: entry.index,
    asOf: entry.asOf,
    status: entry.status,
    entryHash: entry.entryHash,
  })));

  return deepFreeze({
    replayContractVersion: REPLAY_CONTRACT_VERSION,
    entries,
    errors,
    summary,
    replayHash,
    flags: {
      entryPermission: false,
      executionAllowed: false,
      autoTrade: false,
      isSignal: false,
      strategyApproved: false,
    },
    limitations: [
      'Replay bersifat offline dan deterministik; tidak memanggil jaringan dan tidak mengirim order.',
      'Snapshot harus sudah tervalidasi; replay tidak mengarang sumber yang hilang.',
      'Look-ahead dicek dari timestamp sumber; toleransi timestamp kecil dapat dikonfigurasi.',
      'Replay tidak mengubah keputusan deterministic engine maupun bobot Tahap 3.',
    ],
  });
}

export default replayJiniHistory;
