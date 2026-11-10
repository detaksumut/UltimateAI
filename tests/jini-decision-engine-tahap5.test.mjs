/**
 * tests/jini-decision-engine-tahap5.test.mjs
 * Tahap 5 — Historical Replay, Directional Backtesting & Calibration.
 *
 * All snapshots and forward candles are deterministic SYNTHETIC FIXTURES.
 * These tests verify replay ordering/no-look-ahead, forward-return mechanics,
 * source policy, calibration diagnostics and the "no weight mutation" contract.
 * They do not claim market accuracy or win probability.
 */

import assert from 'node:assert/strict';
import {
  auditSnapshotNoLookahead,
  replayJiniHistory,
} from '../src/services/trading/decision/historicalReplay.js';
import {
  classifyForwardReturn,
  computeBacktestMetrics,
  runDirectionalBacktest,
} from '../src/services/trading/decision/backtest.js';
import { runCalibration } from '../src/services/trading/decision/calibration.js';
import { DECISION_WEIGHTS } from '../src/services/trading/decision/weights.js';
import {
  NOW,
  allDirections,
  iso,
  makeSnapshot,
} from './helpers/jini-decision-fixtures.mjs';

const HORIZON_MS = 90_000;

const RECORDS = [
  { asOf: NOW + 30_000, snapshot: makeSnapshot() },
  {
    asOf: NOW + 90_000,
    snapshot: makeSnapshot({
      directions: allDirections('BEARISH'),
      at: 'SUPPLY',
      buyPercent: 30,
      intermarketBias: 'DOWN',
    }),
  },
  {
    asOf: NOW + 150_000,
    snapshot: makeSnapshot({
      directions: { ...allDirections('BULLISH'), H4: 'BEARISH' },
    }),
  },
  { asOf: NOW + 210_000, snapshot: makeSnapshot({ spread: 2.0 }) },
  { asOf: NOW + 215_000, snapshot: makeSnapshot() },
];

const OUT_OF_ORDER = [RECORDS[2], RECORDS[0], RECORDS[4], RECORDS[1], RECORDS[3]];

const FORWARD_CANDLES = [
  { timestamp: iso(NOW + 60_000), close: 4050, high: 4060, low: 4040, source: 'MT5_LOCAL_BRIDGE' },
  { timestamp: iso(NOW + 120_000), close: 4100, high: 4110, low: 4090, source: 'MT5_LOCAL_BRIDGE' },
  { timestamp: iso(NOW + 180_000), close: 3900, high: 3910, low: 3890, source: 'MT5_LOCAL_BRIDGE' },
  { timestamp: iso(NOW + 240_000), close: 4000, high: 4010, low: 3990, source: 'MT5_LOCAL_BRIDGE' },
];

function buildPipeline(records = RECORDS, config = {}) {
  const replay = replayJiniHistory(records);
  const backtest = runDirectionalBacktest({
    replay,
    forwardCandles: FORWARD_CANDLES,
    config: { horizonMs: HORIZON_MS, flatThresholdPct: 0.02, ...config },
  });
  const calibration = runCalibration({
    replay,
    backtest,
    config: { minSamples: 1, splitRatio: 0.7 },
  });
  return { replay, backtest, calibration };
}

function entryByDecision(replay, decision) {
  return replay.entries.find((entry) => entry.decision?.preliminaryDecision === decision);
}

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    throw error;
  }
}

console.log('=== JINI TAHAP 5 — HISTORICAL REPLAY, BACKTEST & CALIBRATION (FIXTURES) ===\n');

// 1
console.log('Test 1: Replay mengurutkan kronologis dan mengevaluasi deterministik');
check('replay chronological ordering', () => {
  const replay = replayJiniHistory(OUT_OF_ORDER);

  assert.equal(replay.summary.total, 5);
  assert.equal(replay.summary.evaluated, 5);
  assert.equal(replay.summary.rejected, 0);
  assert.equal(replay.summary.lookaheadViolations, 0);

  const asOfList = replay.entries.map((entry) => entry.asOf);
  assert.deepEqual(asOfList, [30, 90, 150, 210, 215].map((offset) => NOW + (offset * 1000)));
  assert.equal(replay.entries[0].inputIndex, 1);
  assert.equal(replay.entries[2].inputIndex, 0);

  assert.equal(replay.summary.decisionCounts.BUY_BIAS, 2);
  assert.equal(replay.summary.decisionCounts.SELL_BIAS, 1);
  assert.equal(replay.summary.decisionCounts.WAIT, 1);
  assert.equal(replay.summary.decisionCounts.NO_TRADE, 1);

  for (const entry of replay.entries) {
    assert.equal(entry.status, 'EVALUATED');
    assert.equal(entry.lookaheadSafe, true);
    assert.equal(entry.synthesis.finalDecision, entry.decision.preliminaryDecision);
    assert.equal(entry.synthesis.decisionLocked, true);
  }

  assert.equal(replay.flags.entryPermission, false);
  assert.equal(replay.flags.executionAllowed, false);
  assert.equal(replay.flags.autoTrade, false);
});

// 2
console.log('Test 2: Look-ahead ditolak fail-closed');
check('no-lookahead guard', () => {
  const safe = auditSnapshotNoLookahead(makeSnapshot(), NOW + 30_000);
  assert.equal(safe.safe, true);
  assert.equal(safe.violations.length, 0);

  const leak = auditSnapshotNoLookahead(makeSnapshot(), NOW - 60_000);
  assert.equal(leak.safe, false);
  assert.ok(leak.violations.length > 0);
  assert.ok(leak.violations.some((item) => item.source === 'XM_TICK' || item.source === 'XM_M1'));

  const replay = replayJiniHistory([{ asOf: NOW - 60_000, snapshot: makeSnapshot() }]);
  assert.equal(replay.summary.lookaheadViolations, 1);
  assert.equal(replay.entries[0].status, 'REJECTED');
  assert.equal(replay.entries[0].error.code, 'LOOKAHEAD_DETECTED');
  assert.equal(replay.entries[0].decision, null);
  assert.equal(replay.summary.evaluated, 0);

  const lenient = replayJiniHistory([{ asOf: NOW - 60_000, snapshot: makeSnapshot() }], {
    strictLookahead: false,
  });
  assert.equal(lenient.entries[0].status, 'EVALUATED');
  assert.equal(lenient.entries[0].lookaheadSafe, false);
  assert.ok(lenient.entries[0].decision);
});

// 3
console.log('Test 3: asOf duplikat / tidak valid ditolak');
check('duplicate and missing asOf', () => {
  const duplicate = replayJiniHistory([
    { asOf: NOW + 30_000, snapshot: makeSnapshot() },
    { asOf: NOW + 30_000, snapshot: makeSnapshot() },
  ]);
  assert.equal(duplicate.summary.evaluated, 1);
  assert.equal(duplicate.summary.rejected, 1);
  assert.ok(duplicate.errors.some((item) => item.code === 'DUPLICATE_AS_OF'));

  const missing = replayJiniHistory([{ snapshot: { priceData: {}, sourceFreshness: {} } }]);
  assert.equal(missing.entries[0].status, 'REJECTED');
  assert.equal(missing.entries[0].error.code, 'MISSING_OR_INVALID_AS_OF');
});

// 4
console.log('Test 4: Replay hash deterministik dan sensitif terhadap isi');
check('replay hash determinism', () => {
  const first = replayJiniHistory(RECORDS);
  const second = replayJiniHistory(RECORDS);
  assert.equal(first.replayHash, second.replayHash);
  assert.equal(first.entries[0].entryHash, second.entries[0].entryHash);

  const changed = RECORDS.map((record) => ({ ...record }));
  changed[0] = {
    asOf: RECORDS[0].asOf,
    snapshot: makeSnapshot({
      at: 'DEMAND',
      buyPercent: 30,
      absorption: { status: 'DETECTED', side: 'SELL', note: 'different evidence' },
    }),
  };
  const altered = replayJiniHistory(changed);
  assert.equal(altered.summary.evaluated, first.summary.evaluated);
  assert.notEqual(altered.replayHash, first.replayHash);
});

// 5
console.log('Test 5: Klasifikasi forward return');
check('forward return classification', () => {
  assert.equal(classifyForwardReturn(0.5, 0.02), 'UP');
  assert.equal(classifyForwardReturn(-0.5, 0.02), 'DOWN');
  assert.equal(classifyForwardReturn(0.01, 0.02), 'FLAT');
  assert.equal(classifyForwardReturn(-0.01, 0.02), 'FLAT');
  assert.equal(classifyForwardReturn(Number.NaN, 0.02), 'UNKNOWN');
});

// 6
console.log('Test 6: Backtest mengukur arah, abstain, dan censored');
check('directional backtest mechanics', () => {
  const { replay, backtest } = buildPipeline();

  assert.equal(backtest.ok, true);
  assert.equal(backtest.dataLabel, 'XM MT5 bridge only');
  assert.equal(backtest.replayHash, replay.replayHash);
  assert.equal(backtest.forwardData.candles, 4);
  assert.deepEqual(backtest.forwardData.sources, ['MT5_LOCAL_BRIDGE']);

  const buy = backtest.outcomes.find((item) => item.decision === 'BUY_BIAS' && item.outcome === 'UP');
  assert.ok(buy);
  assert.equal(buy.hit, true);
  assert.ok(buy.forwardReturnPct > 0);
  assert.ok(Number.isFinite(buy.mfePct));
  assert.ok(Number.isFinite(buy.maePct));

  const sell = backtest.outcomes.find((item) => item.decision === 'SELL_BIAS' && item.outcome === 'DOWN');
  assert.ok(sell);
  assert.equal(sell.hit, true);
  assert.ok(sell.forwardReturnPct < 0);

  const wait = backtest.outcomes.find((item) => item.decision === 'WAIT');
  assert.equal(wait.outcome, 'ABSTAIN');
  assert.equal(wait.hit, null);

  const noTrade = backtest.outcomes.find((item) => item.decision === 'NO_TRADE');
  assert.equal(noTrade.outcome, 'ABSTAIN');

  const censored = backtest.outcomes.find((item) => item.outcome === 'CENSORED');
  assert.ok(censored);
  assert.equal(censored.reason, 'TARGET_BEYOND_DATA');

  assert.equal(backtest.metrics.directional, 3);
  assert.equal(backtest.metrics.moved, 2);
  assert.equal(backtest.metrics.hits, 2);
  assert.equal(backtest.metrics.hitRate, 1);
  assert.equal(backtest.metrics.censored, 1);
  assert.equal(backtest.metrics.abstentions, 2);
  assert.equal(backtest.flags.entryPermission, false);
  assert.equal(backtest.flags.executionAllowed, false);
  assert.equal(backtest.flags.autoTrade, false);
});

// 7
console.log('Test 7: Kebijakan sumber forward candle');
check('forward source policy', () => {
  const replay = replayJiniHistory(RECORDS);
  const nonXm = FORWARD_CANDLES.map((candle) => ({ ...candle, source: 'SIMULATED' }));

  const rejected = runDirectionalBacktest({
    replay,
    forwardCandles: nonXm,
    config: { horizonMs: HORIZON_MS },
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, 'NON_XM_FORWARD_DATA');
  assert.equal(rejected.outcomes.length, 0);

  const lab = runDirectionalBacktest({
    replay,
    forwardCandles: nonXm,
    config: { horizonMs: HORIZON_MS, allowNonXmSource: true },
  });
  assert.equal(lab.ok, true);
  assert.equal(lab.dataLabel, 'NON-XM LAB');

  const missing = runDirectionalBacktest({ replay, forwardCandles: [] });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, 'FORWARD_DATA_UNAVAILABLE');
});

// 8
console.log('Test 8: Metrik hit rate tidak mencampur flat dan censored');
check('metrics separation', () => {
  const metrics = computeBacktestMetrics([
    { decision: 'BUY_BIAS', side: 'BUY', outcome: 'UP', hit: true, forwardReturnPct: 1 },
    { decision: 'BUY_BIAS', side: 'BUY', outcome: 'DOWN', hit: false, forwardReturnPct: -1 },
    { decision: 'SELL_BIAS', side: 'SELL', outcome: 'FLAT', hit: null, forwardReturnPct: 0 },
    { decision: 'SELL_BIAS', side: 'SELL', outcome: 'CENSORED', hit: null, forwardReturnPct: null },
    { decision: 'WAIT', side: null, outcome: 'ABSTAIN', hit: null, forwardReturnPct: null },
  ]);
  assert.equal(metrics.directional, 4);
  assert.equal(metrics.moved, 2);
  assert.equal(metrics.hits, 1);
  assert.equal(metrics.hitRate, 0.5);
  assert.equal(metrics.hitRateIncludingFlat, 0.3333);
  assert.equal(metrics.flat, 1);
  assert.equal(metrics.censored, 1);
  assert.equal(metrics.abstentions, 1);
});

// 9
console.log('Test 9: Kalibrasi kategori dan bobot tidak berubah');
check('calibration diagnostics', () => {
  const weightsBefore = JSON.stringify(DECISION_WEIGHTS);
  const { backtest, calibration } = buildPipeline();

  assert.equal(JSON.stringify(DECISION_WEIGHTS), weightsBefore);
  assert.equal(calibration.weightsUnchanged, true);
  assert.deepEqual(calibration.currentWeights, DECISION_WEIGHTS);
  assert.equal(calibration.flags.weightsApplied, false);
  assert.equal(calibration.flags.autoTune, false);
  assert.equal(calibration.flags.requiresApproval, true);
  assert.equal(calibration.flags.entryPermission, false);
  assert.equal(calibration.flags.executionAllowed, false);
  assert.equal(calibration.flags.autoTrade, false);
  assert.equal(calibration.backtestHash, backtest.backtestHash);

  assert.equal(calibration.sample.directionalPairs, 2);
  assert.equal(calibration.sample.moved, 2);
  assert.equal(calibration.sample.hits, 2);
  assert.equal(calibration.sample.hitRate, 1);

  assert.equal(calibration.categories.length, 7);
  const trend = calibration.categories.find((item) => item.id === 'TREND_ALIGNMENT');
  assert.equal(trend.samples, 2);
  assert.equal(trend.hits, 2);
  assert.equal(trend.hitRate, 1);
  assert.equal(trend.verdict, 'EDGE_POSITIVE');
  assert.equal(trend.applied, false);
  assert.equal(trend.requiresApproval, true);

  for (const category of calibration.categories) {
    assert.equal(category.applied, false);
    assert.equal(category.requiresApproval, true);
    assert.equal(category.status, 'PROPOSAL_ONLY');
  }
  for (const recommendation of calibration.recommendations) {
    assert.equal(recommendation.applied, false);
    assert.equal(recommendation.requiresApproval, true);
    assert.equal(recommendation.status, 'PROPOSAL_ONLY');
  }

  assert.equal(calibration.confidenceBuckets.buckets.length, 6);
});

// 10
console.log('Test 10: Sample kecil ditahan (INSUFFICIENT_SAMPLE)');
check('calibration sample gating', () => {
  const replay = replayJiniHistory(RECORDS);
  const backtest = runDirectionalBacktest({
    replay,
    forwardCandles: FORWARD_CANDLES,
    config: { horizonMs: HORIZON_MS },
  });
  const calibration = runCalibration({ replay, backtest }); // default minSamples = 30

  for (const category of calibration.categories) {
    assert.equal(category.verdict, 'INSUFFICIENT_SAMPLE');
    assert.equal(category.proposedWeightMultiplier, null);
  }
  assert.equal(calibration.recommendations.length, 0);
});

// 11
console.log('Test 11: Hash kalibrasi deterministik');
check('calibration hash determinism', () => {
  const first = buildPipeline();
  const second = buildPipeline();
  assert.equal(first.calibration.calibrationHash, second.calibration.calibrationHash);
  assert.equal(first.backtest.backtestHash, second.backtest.backtestHash);
});

// 12
console.log('Test 12: Tidak ada jalur eksekusi di seluruh pipeline');
check('pipeline never allows execution', () => {
  const { replay, backtest, calibration } = buildPipeline();
  for (const holder of [replay.flags, backtest.flags, calibration.flags]) {
    assert.equal(holder.entryPermission, false);
    assert.equal(holder.executionAllowed, false);
    assert.equal(holder.autoTrade, false);
  }
  assert.equal(backtest.flags.isSignal, false);
  assert.equal(backtest.flags.strategyApproved, false);
});

console.log(`\n======================================================`);
console.log(`✅ SELURUH TEST TAHAP 5 BERHASIL LOLOS (${passed}/${passed})`);
console.log('======================================================\n');
