/**
 * calibration.js
 * Tahap 5 — Weight calibration diagnostics (proposal-only).
 *
 * This module measures how each evidence category's direction agreed with the
 * realized forward direction, and how the leading evidence score behaved across
 * confidence buckets.
 *
 * NON-NEGOTIABLE:
 * - It NEVER mutates DECISION_WEIGHTS or any engine state.
 * - Every weight suggestion is a PROPOSAL ONLY: `applied=false` and
 *   `requiresApproval=true`. Changing weights still requires explicit approval.
 * - Scores are ordinal evidence, not probabilities; no Brier score or
 *   "probability of winning" is claimed.
 */

import crypto from 'crypto';
import { DECISION_WEIGHTS } from './weights.js';
import { deepFreeze, stableStringify } from './JiniContextSnapshot.js';

export const CALIBRATION_CONTRACT_VERSION = 'jini-calibration-v1';

export const DEFAULT_CALIBRATION_CONFIG = Object.freeze({
  minSamples: 30,
  splitRatio: 0.7,
  confidenceBoundaries: [50, 60, 70, 80, 90],
});

const DIRECTIONS = new Set(['BUY', 'SELL']);

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function hashOf(payload) {
  try {
    return crypto.createHash('sha256').update(stableStringify(payload)).digest('hex');
  } catch (_) {
    return 'CALIBRATION_HASH_GENERATION_FAILED';
  }
}

function verdictFor({ samples, hitRate, minSamples }) {
  if (samples < minSamples) {
    return { verdict: 'INSUFFICIENT_SAMPLE', proposedWeightMultiplier: null };
  }
  const edge = hitRate - 0.5;
  const proposedWeightMultiplier = round(clamp(1 + (edge * 0.5), 0.75, 1.25), 3);
  if (edge >= 0.05) return { verdict: 'EDGE_POSITIVE', proposedWeightMultiplier };
  if (edge <= -0.05) return { verdict: 'EDGE_NEGATIVE', proposedWeightMultiplier };
  return { verdict: 'NO_CLEAR_EDGE', proposedWeightMultiplier };
}

function buildCategoryCalibration(pairs, { minSamples, currentWeights }) {
  const result = [];
  for (const id of Object.keys(DECISION_WEIGHTS)) {
    let samples = 0;
    let hits = 0;
    let flat = 0;
    for (const pair of pairs) {
      const category = pair.entry.decision.weightedEvidence.find((item) => item.id === id);
      if (!category?.available || !DIRECTIONS.has(category.direction)) continue;
      samples += 1;
      if (pair.outcome.outcome === 'FLAT') {
        flat += 1;
      } else if (
        (category.direction === 'BUY' && pair.outcome.outcome === 'UP')
        || (category.direction === 'SELL' && pair.outcome.outcome === 'DOWN')
      ) {
        hits += 1;
      }
    }
    const hitRate = samples > 0 ? round(hits / samples, 4) : null;
    const { verdict, proposedWeightMultiplier } = hitRate == null
      ? { verdict: 'INSUFFICIENT_SAMPLE', proposedWeightMultiplier: null }
      : verdictFor({ samples, hitRate, minSamples });
    result.push({
      id,
      currentWeight: currentWeights[id],
      samples,
      hits,
      flat,
      hitRate,
      edgeVsCoinFlip: hitRate == null ? null : round(hitRate - 0.5, 4),
      verdict,
      proposedWeightMultiplier,
      applied: false,
      requiresApproval: true,
      status: 'PROPOSAL_ONLY',
      note: 'Usulan bobot wajib divalidasi out-of-sample dan disetujui manusia; tidak diterapkan otomatis.',
    });
  }
  return result;
}

function buildConfidenceBuckets(pairs, boundaries) {
  const safeBoundaries = boundaries
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  const ranges = [];
  let lower = 0;
  for (const upper of safeBoundaries) {
    if (upper > lower) {
      ranges.push({ label: `${lower}-${upper}`, min: lower, max: upper });
      lower = upper;
    }
  }
  ranges.push({ label: `${lower}-100`, min: lower, max: Number.POSITIVE_INFINITY });

  const buckets = ranges.map((range) => ({
    label: range.label,
    samples: 0,
    moved: 0,
    hits: 0,
    flat: 0,
    hitRate: null,
    hitRateOnMoved: null,
  }));

  for (const pair of pairs) {
    const decision = pair.entry.decision;
    const side = decision.preliminaryDecision;
    const leading = side === 'BUY_BIAS' ? finite(decision.buyEvidenceScore) : finite(decision.sellEvidenceScore);
    if (leading == null) continue;
    const score = clamp(leading, 0, 100);
    const bucket = buckets.find((item, index) => score >= ranges[index].min && score < ranges[index].max);
    if (!bucket) continue;
    bucket.samples += 1;
    const outcome = pair.outcome.outcome;
    if (outcome === 'FLAT') {
      bucket.flat += 1;
    } else {
      bucket.moved += 1;
      if ((side === 'BUY_BIAS' && outcome === 'UP') || (side === 'SELL_BIAS' && outcome === 'DOWN')) {
        bucket.hits += 1;
      }
    }
  }

  for (const bucket of buckets) {
    bucket.hitRate = bucket.samples > 0 ? round(bucket.hits / bucket.samples, 4) : null;
    bucket.hitRateOnMoved = bucket.moved > 0 ? round(bucket.hits / bucket.moved, 4) : null;
  }

  return {
    buckets,
    note: 'Bucket memakai leading evidence score sebagai skala ordinal. Ini bukan probabilitas kemenangan.',
  };
}

function buildPairs(entries, outcomes) {
  const missing = [];
  const byIndex = new Map(entries.map((entry) => [entry.index, entry]));
  const pairs = [];
  for (const outcome of outcomes) {
    if (!['UP', 'DOWN', 'FLAT'].includes(outcome?.outcome)) continue;
    if (!['BUY_BIAS', 'SELL_BIAS'].includes(outcome?.decision)) continue;
    const entry = byIndex.get(outcome.index);
    if (!entry?.decision) {
      missing.push(outcome.index);
      continue;
    }
    pairs.push({ entry, outcome });
  }
  pairs.sort((a, b) => a.outcome.index - b.outcome.index);
  return { pairs, missing };
}

/**
 * Runs calibration diagnostics over replay + backtest results.
 *
 * @param {object} input
 * @param {object} [input.replay] Output of replayJiniHistory (uses `.entries`).
 * @param {object} [input.backtest] Output of runDirectionalBacktest (uses `.outcomes`).
 * @param {Array} [input.entries] Direct replay entries (alternative to replay).
 * @param {Array} [input.outcomes] Direct backtest outcomes (alternative to backtest).
 * @param {object} [input.config]
 * @param {number|null} [input.now]
 */
export function runCalibration({
  replay = null,
  backtest = null,
  entries = null,
  outcomes = null,
  config = {},
  now = null,
} = {}) {
  const resolvedEntries = entries ?? replay?.entries;
  const resolvedOutcomes = outcomes ?? backtest?.outcomes;

  if (!Array.isArray(resolvedEntries)) {
    throw new TypeError('runCalibration expects replay.entries or entries.');
  }
  if (!Array.isArray(resolvedOutcomes)) {
    throw new TypeError('runCalibration expects backtest.outcomes or outcomes.');
  }

  const settings = {
    ...DEFAULT_CALIBRATION_CONFIG,
    ...(config || {}),
  };
  settings.minSamples = Math.max(1, Number(settings.minSamples) || DEFAULT_CALIBRATION_CONFIG.minSamples);
  settings.splitRatio = clamp(Number(settings.splitRatio) || DEFAULT_CALIBRATION_CONFIG.splitRatio, 0.1, 0.9);
  settings.confidenceBoundaries = Array.isArray(settings.confidenceBoundaries)
    ? settings.confidenceBoundaries.slice()
    : DEFAULT_CALIBRATION_CONFIG.confidenceBoundaries.slice();

  const currentWeights = { ...DECISION_WEIGHTS };
  const { pairs, missing } = buildPairs(resolvedEntries, resolvedOutcomes);

  const devCount = Math.floor(pairs.length * settings.splitRatio);
  const devPairs = pairs.slice(0, devCount);
  const testPairs = pairs.slice(devCount);

  const fullCategories = buildCategoryCalibration(pairs, {
    minSamples: settings.minSamples,
    currentWeights,
  });
  const devCategories = buildCategoryCalibration(devPairs, {
    minSamples: settings.minSamples,
    currentWeights,
  });
  const testCategories = buildCategoryCalibration(testPairs, {
    minSamples: settings.minSamples,
    currentWeights,
  });

  const moved = pairs.filter((pair) => pair.outcome.outcome === 'UP' || pair.outcome.outcome === 'DOWN');
  const hits = moved.filter((pair) => pair.outcome.hit === true).length;

  const recommendations = fullCategories
    .filter((item) => item.verdict === 'EDGE_POSITIVE' || item.verdict === 'EDGE_NEGATIVE')
    .map((item) => ({
      id: item.id,
      currentWeight: item.currentWeight,
      verdict: item.verdict,
      proposedWeightMultiplier: item.proposedWeightMultiplier,
      applied: false,
      requiresApproval: true,
      status: 'PROPOSAL_ONLY',
    }));

  const report = {
    calibrationContractVersion: CALIBRATION_CONTRACT_VERSION,
    generatedAt: now == null ? null : new Date(now).toISOString(),
    config: settings,
    replayHash: replay?.replayHash ?? null,
    backtestHash: backtest?.backtestHash ?? null,
    sample: {
      outcomes: resolvedOutcomes.length,
      directionalPairs: pairs.length,
      moved: moved.length,
      hits,
      hitRate: moved.length > 0 ? round(hits / moved.length, 4) : null,
      missingEntries: missing,
    },
    categories: fullCategories,
    dev: {
      sampleCount: devPairs.length,
      categories: devCategories,
    },
    test: {
      sampleCount: testPairs.length,
      categories: testCategories,
    },
    confidenceBuckets: buildConfidenceBuckets(pairs, settings.confidenceBoundaries),
    recommendations,
    weightsUnchanged: true,
    currentWeights,
    flags: {
      weightsApplied: false,
      autoTune: false,
      requiresApproval: true,
      entryPermission: false,
      executionAllowed: false,
      autoTrade: false,
    },
    note: 'Kalibrasi ini diagnostik. Tidak ada bobot yang diubah dan tidak ada saran entry.',
    limitations: [
      'Hit rate adalah kecocokan arah pada sampel, bukan probabilitas kemenangan.',
      'Sampel kecil dan in-sample dapat menyesatkan; validasi out-of-sample wajib.',
      'Skor bukti bersifat ordinal, sehingga Brier score tidak dihitung.',
      'Split dev/test bersifat kronologis, bukan jaminan bebas overfitting.',
      'Usulan bobot tidak diterapkan otomatis dan memerlukan persetujuan eksplisit.',
    ],
  };
  report.calibrationHash = hashOf(report);
  return deepFreeze(report);
}

export default runCalibration;
