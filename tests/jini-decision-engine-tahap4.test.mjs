/**
 * tests/jini-decision-engine-tahap4.test.mjs
 * Tahap 4 — AI Synthesis & Cognitive Market Reasoning.
 *
 * The synthesis layer is deterministic and rule-based: it interprets the
 * Tahap 3 decision without ever changing it. All market data here is
 * deterministic SYNTHETIC FIXTURES, not live data. These tests verify
 * interpretation, scenario and safety contracts — not market accuracy.
 */

import assert from 'node:assert/strict';
import { DATA_INTEGRITY_STATUS } from '../src/services/trading/decision/constants.js';
import {
  evaluateJiniDecision,
} from '../src/services/trading/decision/JiniDecisionEngine.js';
import {
  computeSynthesisEvidenceHash,
  synthesizeJiniDecision,
  validateSynthesis,
} from '../src/services/trading/decision/aiSynthesis.js';
import {
  NOW,
  allDirections,
  makeSnapshot,
} from './helpers/jini-decision-fixtures.mjs';

function evaluate(snapshot) {
  return evaluateJiniDecision(snapshot, { now: NOW });
}

function synthesize(snapshot) {
  const decision = evaluate(snapshot);
  const synthesis = synthesizeJiniDecision(decision, { now: NOW });
  return { decision, synthesis };
}

function conflictCodes(decision, kind = 'hard') {
  const list = kind === 'hard' ? decision.hardConflicts : decision.softConflicts;
  return list.map((item) => item.code);
}

function assertLocked(decision, synthesis) {
  const validation = validateSynthesis(synthesis, decision);
  assert.equal(validation.valid, true, `synthesis invalid: ${validation.errors.join('; ')}`);
  assert.equal(synthesis.finalDecision, decision.preliminaryDecision);
  assert.equal(synthesis.decisionLocked, true);
  assert.equal(synthesis.finalDecisionSource, 'DETERMINISTIC_ENGINE');
  assert.equal(synthesis.decisionConsistency.matches, true);
  assert.equal(synthesis.decisionConsistency.aiMayOverride, false);
  assert.equal(synthesis.inputDecisionHash, decision.evidenceHash);
  assert.equal(synthesis.engineVersion, decision.engineVersion);
  assert.equal(synthesis.instrument, decision.instrument);

  assert.equal(synthesis.entryPermission, false);
  assert.equal(synthesis.executionAllowed, false);
  assert.equal(synthesis.autoTrade, false);
  assert.equal(synthesis.isSignal, false);
  assert.equal(synthesis.strategyApproved, false);

  for (const key of ['primaryScenario', 'alternativeScenario', 'invalidationScenario']) {
    assert.equal(synthesis[key].entryPermission, false, `${key} must not permit entry`);
    assert.equal(synthesis[key].executable, false, `${key} must not be executable`);
  }

  assert.ok(typeof synthesis.marketNarrative === 'string' && synthesis.marketNarrative.length > 0);
  assert.ok(Array.isArray(synthesis.supportingEvidence));
  assert.ok(Array.isArray(synthesis.contradictingEvidence));
  assert.ok(Array.isArray(synthesis.missingEvidence));
  assert.equal(typeof synthesis.riskAssessment.level, 'string');
  assert.ok(Array.isArray(synthesis.marketAnswers) && synthesis.marketAnswers.length === 9);
  assert.equal(computeSynthesisEvidenceHash(synthesis), synthesis.evidenceHash);
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

console.log('=== JINI TAHAP 4 — AI SYNTHESIS & COGNITIVE REASONING (FIXTURES) ===\n');

// 1
console.log('Test 1: Bullish trend + bullish absorption di Demand');
check('bullish trend + bullish absorption', () => {
  const { decision, synthesis } = synthesize(makeSnapshot({
    at: 'DEMAND',
    buyPercent: 30,
    absorption: { status: 'DETECTED', side: 'SELL', note: 'Sell aggression absorbed' },
  }));

  assert.equal(decision.preliminaryDecision, 'BUY_BIAS');
  assert.equal(decision.diagnostics.orderFlowRead.absorption.direction, 'BULLISH');

  assert.equal(synthesis.absorptionInterpretation.detected, true);
  assert.equal(synthesis.absorptionInterpretation.direction, 'BULLISH');
  assert.equal(synthesis.conceptDistinctions.bullishAbsorption.detected, true);
  assert.equal(synthesis.conceptDistinctions.bearishAbsorption.detected, false);
  assert.equal(synthesis.conceptDistinctions.buyEntry.allowed, false);
  assert.equal(synthesis.conceptDistinctions.aggressiveSell.detected, true);

  assert.equal(synthesis.primaryScenario.bias, 'BUY_BIAS');
  assert.equal(synthesis.primaryScenario.status, 'BIAS_ONLY');
  assert.equal(synthesis.primaryScenario.name, 'BULLISH_CONTINUATION');
  assert.ok(synthesis.dailyTrendInterpretation.aligned);
  assertLocked(decision, synthesis);
});

// 2
console.log('Test 2: Bearish trend + bearish absorption di Supply');
check('bearish trend + bearish absorption', () => {
  const { decision, synthesis } = synthesize(makeSnapshot({
    directions: allDirections('BEARISH'),
    at: 'SUPPLY',
    buyPercent: 70,
    intermarketBias: 'DOWN',
    absorption: { status: 'DETECTED', side: 'BUY', note: 'Buy aggression absorbed' },
  }));

  assert.equal(decision.preliminaryDecision, 'SELL_BIAS');
  assert.equal(decision.diagnostics.orderFlowRead.absorption.direction, 'BEARISH');

  assert.equal(synthesis.absorptionInterpretation.detected, true);
  assert.equal(synthesis.absorptionInterpretation.direction, 'BEARISH');
  assert.equal(synthesis.conceptDistinctions.bearishAbsorption.detected, true);
  assert.equal(synthesis.conceptDistinctions.bullishAbsorption.detected, false);
  assert.equal(synthesis.conceptDistinctions.sellEntry.allowed, false);

  assert.equal(synthesis.primaryScenario.bias, 'SELL_BIAS');
  assert.equal(synthesis.primaryScenario.name, 'BEARISH_CONTINUATION');
  assertLocked(decision, synthesis);
});

// 3
console.log('Test 3: Aggressive Buy tanpa kenaikan harga');
check('aggressive buy without price rise', () => {
  const { decision, synthesis } = synthesize(makeSnapshot({
    directions: { ...allDirections('BULLISH'), M1: 'NEUTRAL' },
    at: 'DEMAND',
    buyPercent: 75,
  }));

  assert.equal(decision.diagnostics.priceResponse.direction, 'FLAT');
  assert.equal(decision.preliminaryDecision, 'WAIT');
  assert.ok(conflictCodes(decision).includes('AGGRESSIVE_BUY_WITHOUT_PRICE_RESPONSE'));

  assert.equal(synthesis.conceptDistinctions.aggressiveBuy.detected, true);
  assert.equal(synthesis.conceptDistinctions.aggressiveBuy.confirmedByPrice, false);
  assert.equal(synthesis.conceptDistinctions.aggressiveBuy.status, 'AGGRESSION_WITHOUT_PRICE_RESPONSE');
  assert.equal(synthesis.conceptDistinctions.buyEntry.allowed, false);
  assert.ok(synthesis.orderFlowInterpretation.text.includes('tidak diikuti pergerakan harga'));

  assert.equal(synthesis.primaryScenario.bias, 'WAIT');
  assert.equal(synthesis.primaryScenario.name, 'WAIT_FOR_RESOLUTION');
  assert.ok(synthesis.hardGateSnapshot.hardConflicts.includes('AGGRESSIVE_BUY_WITHOUT_PRICE_RESPONSE'));
  assertLocked(decision, synthesis);
});

// 4
console.log('Test 4: Aggressive Sell tanpa penurunan harga');
check('aggressive sell without price decline', () => {
  const { decision, synthesis } = synthesize(makeSnapshot({
    directions: { ...allDirections('BEARISH'), M1: 'NEUTRAL' },
    at: 'SUPPLY',
    buyPercent: 25,
    intermarketBias: 'DOWN',
  }));

  assert.equal(decision.diagnostics.priceResponse.direction, 'FLAT');
  assert.equal(decision.preliminaryDecision, 'WAIT');
  assert.ok(conflictCodes(decision).includes('AGGRESSIVE_SELL_WITHOUT_PRICE_DECLINE'));

  assert.equal(synthesis.conceptDistinctions.aggressiveSell.detected, true);
  assert.equal(synthesis.conceptDistinctions.aggressiveSell.confirmedByPrice, false);
  assert.equal(synthesis.conceptDistinctions.aggressiveSell.status, 'AGGRESSION_WITHOUT_PRICE_RESPONSE');
  assert.equal(synthesis.conceptDistinctions.sellEntry.allowed, false);

  assert.equal(synthesis.primaryScenario.bias, 'WAIT');
  assert.ok(synthesis.hardGateSnapshot.hardConflicts.includes('AGGRESSIVE_SELL_WITHOUT_PRICE_DECLINE'));
  assertLocked(decision, synthesis);
});

// 5
console.log('Test 5: Trend bullish dengan Order Flow bearish');
check('bullish trend with bearish order flow', () => {
  const { decision, synthesis } = synthesize(makeSnapshot({
    directions: { ...allDirections('BULLISH'), M1: 'BEARISH' },
    at: 'NONE',
    buyPercent: 15,
  }));

  assert.equal(decision.higherTimeframeAlignment.anchorDirection, 'BUY');
  assert.equal(decision.diagnostics.orderFlowRead.direction, 'SELL');
  assert.equal(decision.diagnostics.orderFlowRead.sellPercent, 85);
  assert.equal(decision.preliminaryDecision, 'WAIT');
  assert.ok(conflictCodes(decision).includes('ENTRY_TRIGGER_VS_TREND_CONFLICT'));

  assert.equal(synthesis.conceptDistinctions.aggressiveSell.detected, true);
  assert.equal(synthesis.orderFlowInterpretation.available, true);
  assert.equal(synthesis.orderFlowInterpretation.sellPercent, 85);
  assert.equal(synthesis.orderFlowInterpretation.aggressionDirection, 'SELL');
  assert.ok(synthesis.hardGateSnapshot.softConflicts.includes('ORDER_FLOW_VS_TREND'));
  assert.equal(synthesis.finalDecision, 'WAIT');
  assertLocked(decision, synthesis);
});

// 6
console.log('Test 6: Trend bearish dengan Order Flow bullish');
check('bearish trend with bullish order flow', () => {
  const { decision, synthesis } = synthesize(makeSnapshot({
    directions: { ...allDirections('BEARISH'), M1: 'BULLISH' },
    at: 'NONE',
    buyPercent: 85,
    intermarketBias: 'DOWN',
  }));

  assert.equal(decision.higherTimeframeAlignment.anchorDirection, 'SELL');
  assert.equal(decision.diagnostics.orderFlowRead.direction, 'BUY');
  assert.equal(decision.diagnostics.orderFlowRead.buyPercent, 85);
  assert.equal(decision.preliminaryDecision, 'WAIT');
  assert.ok(conflictCodes(decision).includes('ENTRY_TRIGGER_VS_TREND_CONFLICT'));

  assert.equal(synthesis.conceptDistinctions.aggressiveBuy.detected, true);
  assert.equal(synthesis.orderFlowInterpretation.available, true);
  assert.equal(synthesis.orderFlowInterpretation.buyPercent, 85);
  assert.equal(synthesis.orderFlowInterpretation.aggressionDirection, 'BUY');
  assert.ok(synthesis.hardGateSnapshot.softConflicts.includes('ORDER_FLOW_VS_TREND'));
  assert.equal(synthesis.finalDecision, 'WAIT');
  assertLocked(decision, synthesis);
});

// 7
console.log('Test 7: Intermarket bertentangan dengan arah utama');
check('contradicting intermarket', () => {
  const { decision, synthesis } = synthesize(makeSnapshot({
    intermarketBias: 'DOWN',
  }));

  assert.equal(decision.higherTimeframeAlignment.anchorDirection, 'BUY');
  assert.equal(decision.diagnostics.intermarketRead.direction, 'SELL');
  assert.ok(conflictCodes(decision, 'soft').includes('INTERMARKET_VS_TREND'));

  assert.equal(synthesis.intermarketInterpretation.available, true);
  assert.equal(synthesis.intermarketInterpretation.relationToAnchor, 'OPPOSES');
  assert.ok(synthesis.hardGateSnapshot.softConflicts.includes('INTERMARKET_VS_TREND'));
  assert.ok(synthesis.riskAssessment.risks.some((item) => item.id === 'SOFT_INTERMARKET_VS_TREND'));
  assert.equal(synthesis.finalDecision, decision.preliminaryDecision);
  assert.notEqual(synthesis.finalDecision, 'SELL_BIAS');
  assertLocked(decision, synthesis);
});

// 8
console.log('Test 8: Order Flow tidak tersedia');
check('order flow unavailable', () => {
  const { decision, synthesis } = synthesize(makeSnapshot({ orderFlow: null }));

  assert.equal(decision.diagnostics.orderFlowRead.available, false);
  assert.ok(conflictCodes(decision, 'soft').includes('ORDER_FLOW_UNAVAILABLE'));

  assert.equal(synthesis.orderFlowInterpretation.available, false);
  assert.equal(synthesis.absorptionInterpretation.detected, false);
  assert.equal(synthesis.conceptDistinctions.aggressiveBuy.detected, false);
  assert.equal(synthesis.conceptDistinctions.aggressiveSell.detected, false);
  assert.equal(synthesis.conceptDistinctions.bullishAbsorption.detected, false);
  assert.equal(synthesis.conceptDistinctions.bearishAbsorption.detected, false);

  const dominance = synthesis.marketAnswers.find((item) => item.id === 'DOMINANCE');
  assert.ok(/tidak diketahui/i.test(dominance.answer));
  assert.equal(synthesis.supportingEvidence.concat(synthesis.contradictingEvidence)
    .some((item) => item.id === 'ORDER_FLOW' && item.direction), false);
  assertLocked(decision, synthesis);
});

// 9
console.log('Test 9: Data XM stale');
check('xm data stale', () => {
  const { decision, synthesis } = synthesize(makeSnapshot({
    tickAgeMs: 10 * 60_000,
  }));

  assert.equal(decision.dataQualityStatus, DATA_INTEGRITY_STATUS.DEGRADED);
  assert.ok(conflictCodes(decision).includes('CRITICAL_DATA_STALE'));
  assert.equal(decision.preliminaryDecision, 'NO_TRADE');

  assert.ok(synthesis.hardGateSnapshot.hardConflicts.includes('CRITICAL_DATA_STALE'));
  assert.ok(synthesis.riskAssessment.risks.some((item) => item.id === 'HARD_CRITICAL_DATA_STALE'));
  assert.equal(synthesis.primaryScenario.bias, 'NO_TRADE');
  assert.equal(synthesis.primaryScenario.name, 'CAPITAL_PROTECTION');
  assert.equal(synthesis.riskAssessment.level, 'BLOCKED');
  assert.equal(synthesis.finalDecision, 'NO_TRADE');
  assertLocked(decision, synthesis);
});

// 10
console.log('Test 10: Konflik D1 vs H4');
check('d1 h4 conflict', () => {
  const { decision, synthesis } = synthesize(makeSnapshot({
    directions: { ...allDirections('BULLISH'), H4: 'BEARISH' },
  }));

  assert.equal(decision.higherTimeframeAlignment.conflict, true);
  assert.ok(conflictCodes(decision).includes('D1_H4_CONFLICT'));
  assert.equal(decision.preliminaryDecision, 'WAIT');

  assert.equal(synthesis.dailyTrendInterpretation.conflict, true);
  assert.ok(synthesis.dailyTrendInterpretation.text.includes('bertentangan'));
  assert.equal(synthesis.primaryScenario.bias, 'WAIT');
  assert.equal(synthesis.finalDecision, 'WAIT');
  assertLocked(decision, synthesis);
});

// 11
console.log('Test 11: Spread terlalu lebar');
check('spread too high', () => {
  const { decision, synthesis } = synthesize(makeSnapshot({ spread: 2.0 }));

  assert.equal(decision.executionFeasibility.status, 'WIDE_SPREAD');
  assert.ok(conflictCodes(decision).includes('EXECUTION_SPREAD_TOO_WIDE'));
  assert.equal(decision.preliminaryDecision, 'NO_TRADE');

  assert.equal(synthesis.primaryScenario.bias, 'NO_TRADE');
  assert.equal(synthesis.primaryScenario.name, 'CAPITAL_PROTECTION');
  assert.equal(synthesis.primaryScenario.status, 'BLOCKED');
  assert.equal(synthesis.riskAssessment.level, 'BLOCKED');
  assert.equal(synthesis.finalDecision, 'NO_TRADE');
  assertLocked(decision, synthesis);
});

// 12
console.log('Test 12: Skenario tanpa entry trigger');
check('scenario without entry trigger', () => {
  const { decision, synthesis } = synthesize(makeSnapshot({ omit: ['M1'] }));

  assert.equal(decision.diagnostics.entryRead.available, false);
  assert.ok(conflictCodes(decision, 'soft').includes('ENTRY_TRIGGER_UNAVAILABLE'));

  assert.equal(synthesis.entrySetupInterpretation.entryDirection, null);
  assert.equal(synthesis.entrySetupInterpretation.entryRelation, 'UNDEFINED');
  for (const key of ['primaryScenario', 'alternativeScenario', 'invalidationScenario']) {
    assert.equal(synthesis[key].entryPermission, false);
    assert.equal(synthesis[key].executable, false);
    assert.ok(Array.isArray(synthesis[key].triggerConditions));
  }
  assert.ok(synthesis.primaryScenario.triggerConditions.some((item) => /M1/i.test(item)));
  assert.equal(synthesis.conceptDistinctions.buyEntry.allowed, false);
  assert.equal(synthesis.conceptDistinctions.sellEntry.allowed, false);
  assertLocked(decision, synthesis);
});

console.log('\n=== TAMBAHAN: KONTRAK KEAMANAN & DETERMINISME ===');

check('aggressive buy, bullish absorption dan BUY entry tetap berbeda', () => {
  const { decision, synthesis } = synthesize(makeSnapshot({
    at: 'DEMAND',
    buyPercent: 30,
    absorption: { status: 'DETECTED', side: 'SELL', note: 'Sell aggression absorbed' },
  }));
  assert.equal(synthesis.conceptDistinctions.aggressiveSell.detected, true);
  assert.equal(synthesis.conceptDistinctions.bullishAbsorption.detected, true);
  assert.equal(synthesis.conceptDistinctions.buyEntry.allowed, false);
  assert.notEqual(
    synthesis.conceptDistinctions.aggressiveSell.status,
    synthesis.conceptDistinctions.bullishAbsorption.status,
  );
  assert.equal(decision.preliminaryDecision, 'BUY_BIAS');
  assertLocked(decision, synthesis);
});

check('hash synthesis stabil dan mengabaikan generatedAt', () => {
  const decision = evaluate(makeSnapshot());
  const first = synthesizeJiniDecision(decision, { now: NOW });
  const second = synthesizeJiniDecision(decision, { now: NOW + 60_000 });
  assert.equal(first.evidenceHash, second.evidenceHash);
  assert.notEqual(first.generatedAt, second.generatedAt);
  assert.equal(computeSynthesisEvidenceHash(first), first.evidenceHash);
});

check('tampering keputusan akhir terdeteksi validator', () => {
  const { decision, synthesis } = synthesize(makeSnapshot());
  assert.notEqual(synthesis.finalDecision, 'NO_TRADE');
  const tampered = { ...synthesis, finalDecision: 'NO_TRADE' };
  const result = validateSynthesis(tampered, decision);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => /decision/i.test(item)));
});

check('sintesis tidak pernah memberi izin eksekusi', () => {
  for (const snapshot of [
    makeSnapshot(),
    makeSnapshot({ directions: allDirections('BEARISH'), at: 'SUPPLY', buyPercent: 30, intermarketBias: 'DOWN' }),
    makeSnapshot({ spread: 2.0 }),
    makeSnapshot({ orderFlow: null }),
    makeSnapshot({ omit: ['M1'] }),
  ]) {
    const { decision, synthesis } = synthesize(snapshot);
    assertLocked(decision, synthesis);
  }
});

check('PAXG tetap proxy dan COMEX tidak diklaim pada sintesis', () => {
  const { decision, synthesis } = synthesize(makeSnapshot());
  assert.equal(decision.diagnostics.orderFlowRead.available, true);
  assert.ok(synthesis.orderFlowInterpretation.limitations
    .some((item) => /PAXG\/USDT adalah proxy/.test(item)));
  assert.ok(!/COMEX GC (?:feed|dianggap|adalah) (?:aktif|tersedia)/i.test(synthesis.marketNarrative));
  assertLocked(decision, synthesis);
});

console.log(`\n======================================================`);
console.log(`✅ SELURUH TEST TAHAP 4 BERHASIL LOLOS (${passed}/${passed})`);
console.log('======================================================\n');
