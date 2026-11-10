/**
 * tests/jini-decision-engine-tahap3.test.mjs
 * Tahap 3 — Deterministic Conflict Gate + Weighted Evidence Engine.
 *
 * All prices are deterministic SYNTHETIC FIXTURES (not live data). These tests
 * verify decision policy, conflict handling and traceability; they do not claim
 * market accuracy or win probability.
 */

import assert from 'node:assert/strict';
import { DATA_INTEGRITY_STATUS } from '../src/services/trading/decision/constants.js';
import {
  buildJiniSnapshotFromPanels,
} from '../src/services/trading/decision/panelIntegration.js';
import {
  computeDecisionEvidenceHash,
  evaluateJiniDecision,
  validateDecision,
} from '../src/services/trading/decision/JiniDecisionEngine.js';
import { buildScalpingM1Analysis } from '../src/services/trading/scalping/scalpingM1.js';

const NOW = Date.parse('2026-11-04T12:00:00.000Z');
const SYMBOL = 'XAUUSD';
const PRICE = 4000;
const TF_MS = {
  M1: 60_000,
  M5: 300_000,
  M15: 900_000,
  H1: 3_600_000,
  H4: 14_400_000,
  D1: 86_400_000,
};
const WAVE = [0, 1.2, 2.4, 3.0, 2.4, 1.2, 0, -1.2, -2.4, -3.0, -2.4, -1.2];

function iso(ms) {
  return new Date(ms).toISOString();
}

function makeWaveSeries(timeframe, direction, {
  count = 60,
  price = PRICE,
  phaseOffset = 0,
} = {}) {
  const drift = direction === 'BULLISH' ? 1 : (direction === 'BEARISH' ? -1 : 0);
  const ms = TF_MS[timeframe];
  const raw = [];
  for (let i = 0; i < count; i += 1) {
    raw.push((drift * i) + WAVE[(i + phaseOffset) % WAVE.length]);
  }
  const lastRaw = raw[raw.length - 1];
  const shift = price - lastRaw;

  return raw.map((value, i) => {
    const open = value + shift;
    const close = open + (drift * 0.4);
    return {
      symbol: SYMBOL,
      timeframe,
      open,
      high: Math.max(open, close) + 0.8,
      low: Math.min(open, close) - 0.8,
      close,
      volume: 100 + i,
      source: 'MT5_LOCAL_BRIDGE',
      timestamp: iso(NOW - ((count - 1 - i) * ms)),
    };
  });
}

function makeFlatM1({ count = 60, price = PRICE } = {}) {
  const candles = [];
  for (let i = 0; i < count; i += 1) {
    candles.push({
      symbol: SYMBOL,
      timeframe: 'M1',
      open: price,
      high: price + 0.8,
      low: price - 0.8,
      close: price,
      volume: 100 + i,
      source: 'MT5_LOCAL_BRIDGE',
      timestamp: iso(NOW - ((count - 1 - i) * 60_000)),
    });
  }
  return candles;
}

function makeTick({ spread = 0.4 } = {}) {
  return {
    bid: PRICE,
    ask: PRICE + spread,
    timestamp: iso(NOW - 2000),
    source: 'MT5_LOCAL_BRIDGE',
  };
}

function makeXmMulti({
  directions = {},
  spread = 0.4,
  omit = [],
} = {}) {
  const payloads = {};
  const tick = makeTick({ spread });
  for (const timeframe of ['M1', 'M5', 'M15', 'H1', 'H4', 'D1']) {
    if (omit.includes(timeframe)) continue;
    const direction = directions[timeframe] || 'NEUTRAL';
    let candles;
    if (timeframe === 'M1' && direction === 'NEUTRAL') {
      candles = makeFlatM1();
    } else {
      const phaseOffset = timeframe === 'M1'
        ? (direction === 'BULLISH' ? 2 : (direction === 'BEARISH' ? 11 : 0))
        : 0;
      candles = makeWaveSeries(timeframe, direction, { phaseOffset });
    }
    payloads[timeframe] = {
      source: 'MT5_LOCAL_BRIDGE',
      candles,
      tick,
      lastCandleAt: candles[candles.length - 1].timestamp,
    };
  }
  return { ok: true, symbol: SYMBOL, payloads, failures: {} };
}

function enginePayloads(xmMulti) {
  const payloads = {};
  for (const timeframe of ['M1', 'M5', 'M15', 'H1', 'H4']) {
    if (xmMulti.payloads[timeframe]) payloads[timeframe] = xmMulti.payloads[timeframe];
  }
  return payloads;
}

function makeZone(side, low, high, extra = {}) {
  return {
    id: `${side}-ZONE`,
    timeframe: 'H4',
    side,
    low,
    high,
    proximal: side === 'DEMAND' ? high : low,
    distal: side === 'DEMAND' ? low : high,
    score: 82,
    lifecycle: side === 'DEMAND' ? 'TESTED' : 'FRESH',
    active: true,
    testCount: 1,
    heldRetestCount: 1,
    ...extra,
  };
}

function makeSupplyDemand({
  at = 'DEMAND',
  price = PRICE + 0.2,
  generatedAt = NOW,
} = {}) {
  let demand;
  let supply;
  if (at === 'DEMAND') {
    demand = makeZone('DEMAND', price - 6, price + 0.8);
    supply = makeZone('SUPPLY', price + 10, price + 16);
  } else if (at === 'SUPPLY') {
    demand = makeZone('DEMAND', price - 16, price - 10);
    supply = makeZone('SUPPLY', price - 0.8, price + 6);
  } else {
    demand = makeZone('DEMAND', price - 26, price - 20);
    supply = makeZone('SUPPLY', price + 20, price + 26);
  }

  return {
    ok: true,
    dataStatus: 'READY',
    dataAvailable: true,
    symbol: SYMBOL,
    generatedAt: iso(generatedAt),
    lastUpdate: iso(generatedAt - 30_000),
    currentPrice: price,
    source: 'MT5_LOCAL_BRIDGE',
    isXmValidated: true,
    nearestDemand: demand,
    nearestSupply: supply,
    strongest: demand,
    confluence: [],
    lifecycleCounts: { FRESH: 1, TESTED: 1, WEAKENED: 0, INVALID: 0 },
    activeZones: [demand, supply],
    zones: [demand, supply],
    warnings: [],
    timeframes: {},
  };
}

function makeOrderFlow({
  buyPercent = 70,
  lastTradeAt = NOW - 5000,
  absorption = null,
  trades = 150,
} = {}) {
  const buyBase = buyPercent * 10;
  const sellBase = (100 - buyPercent) * 10;
  return {
    ok: true,
    status: 'LIVE',
    classification: 'EXCHANGE_AGGRESSOR',
    window: {
      trades,
      firstTradeAt: iso(lastTradeAt - 60_000),
      lastTradeAt: iso(lastTradeAt),
    },
    volume: { buyBase, sellBase, totalBase: 1000 },
    percentages: { buy: buyPercent, sell: 100 - buyPercent, neutral: 0 },
    delta: buyBase - sellBase,
    imbalance: (buyPercent - 50) / 50,
    cvd: (buyBase - sellBase) * 1.2,
    absorption,
    source: {
      provider: 'Binance Spot',
      endpoint: '/api/v3/aggTrades',
      symbol: 'PAXGUSDT',
      apiKeysRequired: false,
    },
  };
}

function makeInstrument(id, symbol, status = 'LIVE', latest = 100) {
  return {
    id,
    symbol,
    label: symbol,
    kind: id.includes('us') ? 'yield' : 'price',
    unit: 'index',
    role: id === 'dxy' || id === 'us10y_real' ? 'CORE' : 'CONFIRMATION',
    influenceGroup: id === 'wti' ? 'OIL' : 'USD',
    provider: id === 'us02y' || id === 'us10y_real' ? 'fred' : 'yahoo',
    status,
    latest,
    change: id === 'dxy' ? -0.2 : 0.01,
    changeUnit: id.includes('us') ? 'pp' : 'price',
    changePercent: id.includes('us') ? null : -0.2,
    updatedAt: iso(NOW - 120_000),
  };
}

function makeIntermarket({
  bias = 'UP',
  generatedAt = NOW - 120_000,
  staleInstruments = [],
} = {}) {
  return {
    ok: true,
    generatedAt: iso(generatedAt),
    providerSummary: { priceSeries: 'Yahoo Finance', noSimulatedData: true },
    gold: { id: 'gold', symbol: SYMBOL, latest: PRICE + 0.2, status: 'LIVE' },
    instruments: [
      makeInstrument('dxy', 'DXY'),
      makeInstrument('us10y', 'US10Y'),
      makeInstrument('us10y_real', 'US10Y_REAL'),
      makeInstrument('us02y', 'US02Y'),
      makeInstrument('wti', 'WTI'),
    ],
    analysis: {
      status: 'OK',
      bias,
      strength: 'MODERATE',
      score: bias === 'DOWN' ? -0.3 : (bias === 'UP' ? 0.3 : 0),
      confirmationCount: 3,
      conflictCount: 1,
      independentConfirmationCount: 2,
      independentConflictCount: 1,
      dominantFactor: { id: 'dxy', symbol: 'DXY', direction: 1 },
      dataCompleteness: {
        available: 5,
        required: 5,
        staleInstruments,
        missing: [],
        correlationWindow: 180,
      },
      factorMetrics: [],
      conflicts: [],
      generatedAt: iso(generatedAt),
      calcVersion: 'test-fixture',
    },
    integrity: { noSimulatedData: true },
  };
}

function makeTerminal({
  connected = true,
  platformReady = true,
  fatalError = false,
} = {}) {
  return {
    brokerId: 'xm',
    platformId: 'xm',
    platformLabel: 'XM Global',
    url: 'https://www.xm.com/terminal/index.html?token=secret',
    title: 'XM Terminal',
    connected,
    platformReady,
    loginRequired: false,
    chartNoData: false,
    fatalError,
    error: fatalError ? 'Terminal crash' : null,
    sessionPersistent: true,
    capabilities: { chartCanvas: true },
    diagnostics: {
      websocket: { state: 'open', frames: 120, lastFrameAt: iso(NOW - 1000) },
      chart: { canvasCount: 1, noDataVisible: false },
      lastProbeAt: iso(NOW - 3000),
    },
    updatedAt: iso(NOW - 10_000),
  };
}

function makeBridge({ online = true } = {}) {
  return {
    ok: online,
    online,
    source: online ? 'MT5_LOCAL_BRIDGE' : null,
    symbol: SYMBOL,
    endpoint: 'http://127.0.0.1:20200',
    timeframes: online ? { M1: { count: 60, freshness: 'FRESH' } } : {},
    tick: makeTick(),
    updatedAt: iso(NOW - 5000),
    message: online ? null : 'Bridge offline',
  };
}

function allDirections(direction) {
  return {
    M1: direction,
    M5: direction,
    M15: direction,
    H1: direction,
    H4: direction,
    D1: direction,
  };
}

function makeSnapshot(overrides = {}) {
  const directions = overrides.directions || allDirections('BULLISH');
  const spread = overrides.spread ?? 0.4;
  const xmMulti = overrides.xmMulti || makeXmMulti({ directions, spread, omit: overrides.omit || [] });
  const price = PRICE + (spread / 2);

  const scalping = overrides.scalping !== undefined
    ? overrides.scalping
    : buildScalpingM1Analysis({ payloads: enginePayloads(xmMulti), now: NOW });

  const orderFlow = 'orderFlow' in overrides
    ? overrides.orderFlow
    : makeOrderFlow({
      buyPercent: overrides.buyPercent ?? 70,
      lastTradeAt: overrides.orderFlowLastTradeAt ?? (NOW - 5000),
      absorption: overrides.absorption ?? null,
    });

  const intermarket = 'intermarket' in overrides
    ? overrides.intermarket
    : makeIntermarket({
      bias: overrides.intermarketBias ?? 'UP',
      generatedAt: overrides.intermarketGeneratedAt ?? (NOW - 120_000),
      staleInstruments: overrides.intermarketStaleInstruments ?? [],
    });

  return buildJiniSnapshotFromPanels({
    xmMulti,
    supplyDemand: 'supplyDemand' in overrides
      ? overrides.supplyDemand
      : makeSupplyDemand({
        at: overrides.at ?? 'DEMAND',
        price,
        generatedAt: overrides.supplyDemandGeneratedAt ?? NOW,
      }),
    scalping,
    orderFlow,
    intermarket,
    terminal: makeTerminal(),
    bridge: makeBridge(),
    now: NOW,
  });
}

function evaluate(snapshot) {
  return evaluateJiniDecision(snapshot, { now: NOW });
}

function conflictCodes(decision, kind = 'hard') {
  const list = kind === 'hard' ? decision.hardConflicts : decision.softConflicts;
  return list.map((item) => item.code);
}

function category(decision, id) {
  return decision.weightedEvidence.find((item) => item.id === id);
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

console.log('=== JINI TAHAP 3 — CONFLICT GATE & WEIGHTED EVIDENCE (FIXTURES) ===\n');

// 1
console.log('Test 1: D1/H4 bullish -> BUY_BIAS');
check('D1/H4 bullish', () => {
  const decision = evaluate(makeSnapshot());
  assert.equal(decision.dailyBias, 'BULLISH');
  assert.equal(decision.higherTimeframeAlignment.aligned, true);
  assert.equal(decision.preliminaryDecision, 'BUY_BIAS');
  assert.ok(decision.buyEvidenceScore > decision.sellEvidenceScore);
  assert.equal(decision.hardConflicts.length, 0);
  assert.equal(decision.entryPermission, false);
  assert.equal(validateDecision(decision).valid, true);
});

// 2
console.log('Test 2: D1/H4 bearish -> SELL_BIAS');
check('D1/H4 bearish', () => {
  const decision = evaluate(makeSnapshot({
    directions: allDirections('BEARISH'),
    at: 'SUPPLY',
    buyPercent: 30,
    intermarketBias: 'DOWN',
  }));
  assert.equal(decision.dailyBias, 'BEARISH');
  assert.equal(decision.preliminaryDecision, 'SELL_BIAS');
  assert.ok(decision.sellEvidenceScore > decision.buyEvidenceScore);
  assert.equal(decision.hardConflicts.length, 0);
});

// 3
console.log('Test 3: D1 versus H4 conflict -> WAIT');
check('D1/H4 conflict', () => {
  const decision = evaluate(makeSnapshot({
    directions: { ...allDirections('BULLISH'), H4: 'BEARISH' },
  }));
  assert.equal(decision.preliminaryDecision, 'WAIT');
  assert.ok(conflictCodes(decision).includes('D1_H4_CONFLICT'));
  assert.equal(decision.higherTimeframeAlignment.conflict, true);
});

// 4
console.log('Test 4: M1 melawan Daily Trend -> WAIT + hard conflict');
check('M1 vs daily trend', () => {
  const decision = evaluate(makeSnapshot({
    directions: { ...allDirections('BULLISH'), M1: 'BEARISH' },
  }));
  assert.equal(decision.preliminaryDecision, 'WAIT');
  assert.ok(conflictCodes(decision).includes('ENTRY_TRIGGER_VS_TREND_CONFLICT'));
});

// 5
console.log('Test 5: Bullish absorption di Demand -> bukti tersertifikasi');
check('bullish absorption', () => {
  const decision = evaluate(makeSnapshot({
    at: 'DEMAND',
    buyPercent: 30,
    absorption: { status: 'DETECTED', side: 'SELL', note: 'Sell aggression absorbed' },
  }));
  assert.equal(decision.diagnostics.orderFlowRead.absorption.direction, 'BULLISH');
  assert.equal(decision.diagnostics.orderFlowRead.absorption.pattern, 'SELL_AGGRESSION_ABSORBED_AT_DEMAND');
  assert.equal(decision.preliminaryDecision, 'BUY_BIAS');
  assert.ok(!conflictCodes(decision).includes('AGGRESSIVE_SELL_WITHOUT_PRICE_DECLINE'));
});

// 6
console.log('Test 6: Bearish absorption di Supply -> bukti tersertifikasi');
check('bearish absorption', () => {
  const decision = evaluate(makeSnapshot({
    directions: allDirections('BEARISH'),
    at: 'SUPPLY',
    buyPercent: 70,
    intermarketBias: 'DOWN',
    absorption: { status: 'DETECTED', side: 'BUY', note: 'Buy aggression absorbed' },
  }));
  assert.equal(decision.diagnostics.orderFlowRead.absorption.direction, 'BEARISH');
  assert.equal(decision.diagnostics.orderFlowRead.absorption.pattern, 'BUY_AGGRESSION_ABSORBED_AT_SUPPLY');
  assert.equal(decision.preliminaryDecision, 'SELL_BIAS');
});

// 7
console.log('Test 7: Aggressive Buy tanpa kenaikan harga -> WAIT');
check('aggressive buy no response', () => {
  const decision = evaluate(makeSnapshot({
    directions: { ...allDirections('BULLISH'), M1: 'NEUTRAL' },
    at: 'DEMAND',
    buyPercent: 75,
  }));
  assert.equal(decision.diagnostics.priceResponse.direction, 'FLAT');
  assert.equal(decision.preliminaryDecision, 'WAIT');
  assert.ok(conflictCodes(decision).includes('AGGRESSIVE_BUY_WITHOUT_PRICE_RESPONSE'));
});

// 8
console.log('Test 8: Aggressive Sell tanpa penurunan harga -> WAIT');
check('aggressive sell no response', () => {
  const decision = evaluate(makeSnapshot({
    directions: { ...allDirections('BEARISH'), M1: 'NEUTRAL' },
    at: 'SUPPLY',
    buyPercent: 25,
    intermarketBias: 'DOWN',
  }));
  assert.equal(decision.diagnostics.priceResponse.direction, 'FLAT');
  assert.equal(decision.preliminaryDecision, 'WAIT');
  assert.ok(conflictCodes(decision).includes('AGGRESSIVE_SELL_WITHOUT_PRICE_DECLINE'));
});

// 9
console.log('Test 9: Order Flow unavailable -> bobot dikeluarkan + cap');
check('order flow unavailable', () => {
  const decision = evaluate(makeSnapshot({ orderFlow: null }));
  assert.equal(category(decision, 'ORDER_FLOW').available, false);
  assert.equal(category(decision, 'ORDER_FLOW').contribution.buy, 0);
  assert.equal(category(decision, 'ORDER_FLOW').contribution.sell, 0);
  assert.ok(conflictCodes(decision, 'soft').includes('ORDER_FLOW_UNAVAILABLE'));
  assert.ok(decision.confidenceCap.capPercent <= 70);
  assert.ok(decision.preliminaryDecision === 'BUY_BIAS' || decision.preliminaryDecision === 'WAIT');
});

// 10
console.log('Test 10: Order Flow stale -> tidak dipakai sebagai bukti');
check('order flow stale', () => {
  const decision = evaluate(makeSnapshot({
    orderFlowLastTradeAt: NOW - (10 * 60_000),
  }));
  assert.equal(category(decision, 'ORDER_FLOW').available, false);
  assert.ok(conflictCodes(decision, 'soft').includes('ORDER_FLOW_STALE'));
  assert.ok(decision.confidenceCap.capPercent <= 60);
  assert.ok(decision.preliminaryDecision !== 'BUY_BIAS');
});

// 11
console.log('Test 11: Intermarket unavailable -> dikeluarkan, bukan diisi');
check('intermarket unavailable', () => {
  const decision = evaluate(makeSnapshot({ intermarket: null }));
  assert.equal(category(decision, 'INTERMARKET').available, false);
  assert.ok(conflictCodes(decision, 'soft').includes('INTERMARKET_UNAVAILABLE'));
  assert.ok(decision.confidenceCap.capPercent <= 80);
  assert.ok(decision.missingEvidence.some((item) => item.id === 'INTERMARKET'));
});

// 12
console.log('Test 12: Spread terlalu tinggi -> NO_TRADE');
check('spread too high', () => {
  const decision = evaluate(makeSnapshot({ spread: 2.0 }));
  assert.equal(decision.executionFeasibility.status, 'WIDE_SPREAD');
  assert.ok(conflictCodes(decision).includes('EXECUTION_SPREAD_TOO_WIDE'));
  assert.equal(decision.preliminaryDecision, 'NO_TRADE');
});

// 13
console.log('Test 13: Major timestamp skew -> WAIT');
check('major timestamp skew', () => {
  const decision = evaluate(makeSnapshot({
    supplyDemandGeneratedAt: NOW - (30 * 60_000),
  }));
  assert.equal(decision.diagnostics.zoneContext.available, true);
  assert.ok(conflictCodes(decision).includes('MAJOR_TIMESTAMP_SKEW'));
  assert.equal(decision.preliminaryDecision, 'WAIT');
});

// 14
console.log('Test 14: Missing critical data -> NO_TRADE');
check('missing critical data', () => {
  const decision = evaluate(makeSnapshot({ omit: ['D1'] }));
  assert.equal(decision.dataQualityStatus, DATA_INTEGRITY_STATUS.UNAVAILABLE);
  assert.ok(conflictCodes(decision).includes('CRITICAL_DATA_UNAVAILABLE'));
  assert.equal(decision.preliminaryDecision, 'NO_TRADE');
});

// 15
console.log('Test 15: Dua sumber bertentangan (trend vs structure) -> WAIT');
check('trend vs structure', () => {
  const decision = evaluate(makeSnapshot({
    directions: { ...allDirections('BULLISH'), H1: 'BEARISH' },
  }));
  assert.equal(decision.diagnostics.structure.direction, 'BEARISH');
  assert.ok(conflictCodes(decision).includes('TREND_VS_STRUCTURE_CONFLICT'));
  assert.equal(decision.preliminaryDecision, 'WAIT');
});

// 16
console.log('Test 16: Perubahan payload mengubah evaluasi & hash');
check('payload change alters evaluation', () => {
  const bullish = evaluate(makeSnapshot());
  const conflict = evaluate(makeSnapshot({
    directions: { ...allDirections('BULLISH'), H4: 'BEARISH' },
  }));
  assert.equal(bullish.preliminaryDecision, 'BUY_BIAS');
  assert.equal(conflict.preliminaryDecision, 'WAIT');
  assert.notEqual(bullish.evidenceHash, conflict.evidenceHash);

  const repeat = evaluate(makeSnapshot());
  assert.equal(repeat.preliminaryDecision, bullish.preliminaryDecision);
  assert.equal(repeat.evidenceHash, bullish.evidenceHash);
  assert.equal(computeDecisionEvidenceHash(repeat), repeat.evidenceHash);
});

console.log('\n=== TAMBAHAN: KONTRAK KEAMANAN & BOBOT ===');
check('BUY_BIAS/SELL_BIAS bukan izin entry', () => {
  const decision = evaluate(makeSnapshot());
  assert.equal(decision.preliminaryDecision, 'BUY_BIAS');
  assert.equal(decision.entryPermission, false);
  assert.equal(decision.executionAllowed, false);
  assert.equal(decision.autoTrade, false);
  assert.equal(decision.isSignal, false);
  assert.equal(decision.strategyApproved, false);
});

check('normalisasi bobot hanya atas kategori tersedia', () => {
  const decision = evaluate(makeSnapshot({ orderFlow: null, intermarket: null }));
  const total = decision.weightNormalization.totalAvailableWeight;
  assert.equal(total, 75); // 30 + 20 + 15 + 5 + 5
  const available = decision.weightedEvidence.filter((item) => item.available);
  const sum = available.reduce((acc, item) => acc + item.normalizedWeight, 0);
  assert.ok(Math.abs(sum - 100) < 0.2);
  assert.equal(decision.weightedEvidence.find((item) => item.id === 'ORDER_FLOW').normalizedWeight, 0);
});

check('absorption provider bertentangan dengan lokasi -> WAIT', () => {
  const decision = evaluate(makeSnapshot({
    at: 'SUPPLY',
    buyPercent: 50,
    absorption: { status: 'DETECTED', side: 'SELL', note: 'Bullish claim at supply' },
  }));
  assert.ok(conflictCodes(decision).includes('ABSORPTION_VS_ZONE_CONFLICT'));
  assert.equal(decision.preliminaryDecision, 'WAIT');
});

check('COMEX tetap UNAVAILABLE dan PAXG tetap proxy', () => {
  const decision = evaluate(makeSnapshot());
  assert.equal(decision.diagnostics.orderFlowRead.available, true);
  // Order flow contract is owned by the snapshot; re-check through the engine input.
  const snapshot = makeSnapshot();
  assert.equal(snapshot.sourceIntegrity.ORDER_FLOW.isProxy, true);
  assert.equal(snapshot.sourceIntegrity.ORDER_FLOW.isComex, false);
  assert.equal(snapshot.sourceIntegrity.ORDER_FLOW.comex.status, DATA_INTEGRITY_STATUS.UNAVAILABLE);
});

console.log(`\n======================================================`);
console.log(`✅ SELURUH TEST TAHAP 3 BERHASIL LOLOS (${passed}/${passed})`);
console.log('======================================================\n');
