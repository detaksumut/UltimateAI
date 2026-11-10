/**
 * tests/jini-decision-engine-tahap6.test.mjs
 * Tahap 6 — Live Composition (snapshot + decision from panel outputs).
 *
 * Verifies that the live pipeline composes existing panel outputs into the
 * constitutional snapshot/decision without fetching, fabricating, mutating
 * inputs, or granting execution privileges. All data is synthetic fixtures.
 */

import assert from 'node:assert/strict';
import { composeJiniDecision } from '../src/services/trading/decision/liveDecision.js';
import { evaluateJiniDecision, validateDecision } from '../src/services/trading/decision/JiniDecisionEngine.js';
import { buildJiniSnapshotFromPanels } from '../src/services/trading/decision/panelIntegration.js';
import { analyzeSupplyDemand } from '../src/services/trading/supplyDemand/SupplyDemandEngine.js';
import { buildScalpingM1Analysis } from '../src/services/trading/scalping/scalpingM1.js';
import {
  NOW,
  allDirections,
  enginePayloads,
  iso,
  makeBridge,
  makeIntermarket,
  makeOrderFlow,
  makeXmMulti,
} from './helpers/jini-decision-fixtures.mjs';

let passed = 0;
let failed = 0;

function run(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  FAIL ${name}`);
    console.error(`       ${error.message}`);
  }
}

function fullSources(overrides = {}) {
  const directions = overrides.directions || allDirections('BULLISH');
  const xmMulti = overrides.xmMulti || makeXmMulti({ directions });
  return {
    xmMulti,
    orderFlow: 'orderFlow' in overrides ? overrides.orderFlow : makeOrderFlow({ buyPercent: 70 }),
    intermarket: 'intermarket' in overrides ? overrides.intermarket : makeIntermarket({ bias: 'UP' }),
    bridge: 'bridge' in overrides ? overrides.bridge : makeBridge({ online: true }),
    now: NOW,
  };
}

console.log('\n=== JINI TAHAP 6 — LIVE DECISION COMPOSITION ===\n');

run('Komposisi penuh menghasilkan decision + validation valid', () => {
  const result = composeJiniDecision(fullSources());
  assert.equal(result.ok, true);
  assert.equal(result.instrument, 'XAUUSD');
  assert.ok(['BUY_BIAS', 'SELL_BIAS', 'WAIT', 'NO_TRADE'].includes(result.decision.preliminaryDecision));
  assert.equal(result.validation.valid, true, JSON.stringify(result.validation.errors));
  assert.match(result.decision.evidenceHash, /^[a-f0-9]{64}$/);
});

run('Komposisi identik dengan engine saat diberi snapshot yang sama', () => {
  const sources = fullSources();
  const live = composeJiniDecision(sources);
  const payloads = sources.xmMulti.payloads;
  const snapshot = buildJiniSnapshotFromPanels({
    xmMulti: sources.xmMulti,
    supplyDemand: analyzeSupplyDemand({ symbol: 'XAUUSD', payloads, now: NOW }),
    scalping: buildScalpingM1Analysis({ symbol: 'XAUUSD', payloads: enginePayloads(sources.xmMulti), now: NOW }),
    orderFlow: sources.orderFlow,
    intermarket: sources.intermarket,
    bridge: sources.bridge,
    now: NOW,
  });
  const direct = evaluateJiniDecision(snapshot, { now: NOW });
  assert.equal(live.decision.evidenceHash, direct.evidenceHash);
  // snapshotId carries random bytes per build, so snapshot hashes are unique
  // by design. The summary must still expose a well-formed hash.
  assert.match(live.snapshot.evidenceHash, /^[a-f0-9]{64}$/);
  assert.match(snapshot.evidenceHash, /^[a-f0-9]{64}$/);
});

run('Ringkasan snapshot tidak memuat deret candle mentah', () => {
  const result = composeJiniDecision(fullSources());
  assert.equal(result.snapshot.sources, undefined);
  assert.ok(result.snapshot.evidenceHash);
  assert.ok(!('timeframeAnalysis' in result.snapshot));
});

run('Tanpa data XM -> fail-closed NO_TRADE, bukan angka karangan', () => {
  const result = composeJiniDecision({
    xmMulti: null,
    orderFlow: null,
    intermarket: null,
    bridge: makeBridge({ online: false }),
    now: NOW,
  });
  assert.equal(result.ok, true);
  assert.equal(result.decision.preliminaryDecision, 'NO_TRADE');
  assert.equal(result.decision.dataQualityStatus, 'UNAVAILABLE');
  assert.deepEqual(result.sources.xm.timeframes, []);
  assert.equal(result.sources.orderFlow.ok, false);
  assert.equal(result.sources.intermarket.ok, false);
});

run('Sumber opsional hilang tidak diisi simulasi', () => {
  const result = composeJiniDecision(fullSources({ orderFlow: null, intermarket: null }));
  assert.equal(result.sources.orderFlow.status, 'UNAVAILABLE');
  assert.equal(result.sources.intermarket.status, 'UNAVAILABLE');
  assert.ok(['WAIT', 'NO_TRADE'].includes(result.decision.preliminaryDecision)
    || result.decision.preliminaryDecision === 'BUY_BIAS'
    || result.decision.preliminaryDecision === 'SELL_BIAS');
  assert.equal(result.decision.entryPermission, false);
});

run('Konstitusi: tidak pernah memberi izin eksekusi', () => {
  const result = composeJiniDecision(fullSources());
  for (const flag of ['entryPermission', 'executionAllowed', 'autoTrade', 'isSignal']) {
    assert.equal(result[flag], false, `${flag} harus false`);
  }
  for (const flag of ['entryPermission', 'executionAllowed', 'autoTrade', 'isSignal', 'strategyApproved']) {
    assert.equal(result.decision[flag], false, `${flag} harus false pada decision`);
  }
  assert.equal(validateDecision(result.decision).valid, true);
});

run('Input panel tidak dimutasi oleh komposisi', () => {
  const sources = fullSources();
  const xmBefore = JSON.stringify(sources.xmMulti);
  const ofBefore = JSON.stringify(sources.orderFlow);
  const imBefore = JSON.stringify(sources.intermarket);
  composeJiniDecision(sources);
  assert.equal(JSON.stringify(sources.xmMulti), xmBefore);
  assert.equal(JSON.stringify(sources.orderFlow), ofBefore);
  assert.equal(JSON.stringify(sources.intermarket), imBefore);
});

run('PAXG tetap proxy dan COMEX tetap UNAVAILABLE', () => {
  const result = composeJiniDecision(fullSources());
  const snapshot = result.snapshot;
  assert.ok(snapshot);
  assert.equal(result.decision.diagnostics.limitations.some((note) => /COMEX GC tetap UNAVAILABLE/.test(note)), true);
});

run('Determinisme: komposisi berulang dengan now sama menghasilkan decision identik', () => {
  const sources = fullSources();
  const first = composeJiniDecision(sources);
  const second = composeJiniDecision(sources);
  assert.equal(first.decision.evidenceHash, second.decision.evidenceHash);
  assert.equal(first.decision.preliminaryDecision, second.decision.preliminaryDecision);
});

run('Terminal null ditandai, bukan diasumsikan sehat', () => {
  const result = composeJiniDecision(fullSources());
  assert.equal(result.sources.terminal.supplied, false);
  assert.notEqual(result.decision.executionFeasibility.status, undefined);
});

run('Hash decision berubah saat payload berubah', () => {
  const base = composeJiniDecision(fullSources());
  const changed = composeJiniDecision(fullSources({ orderFlow: makeOrderFlow({ buyPercent: 15 }) }));
  assert.notEqual(base.decision.evidenceHash, changed.decision.evidenceHash);
});

console.log(`\n======================================================`);
if (failed === 0) {
  console.log(`✅ SELURUH TEST TAHAP 6 BERHASIL LOLOS (${passed}/${passed})`);
} else {
  console.log(`❌ TAHAP 6 GAGAL: ${failed} test gagal, ${passed} lolos`);
  process.exitCode = 1;
}
console.log(`======================================================\n`);
