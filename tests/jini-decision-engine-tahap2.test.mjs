/**
 * tests/jini-decision-engine-tahap2.test.mjs
 * Tahap 2 — Full panel integration into JINI_TRADING_CONTEXT_SNAPSHOT.
 *
 * All market data below is deterministic synthetic FIXTURE, not live data.
 * The tests validate integration contracts, fail-closed behaviour, provenance,
 * and cross-source timing. They never claim market accuracy.
 */

import assert from 'node:assert/strict';
import {
  DATA_INTEGRITY_STATUS,
} from '../src/services/trading/decision/constants.js';
import {
  buildJiniTradingContextSnapshot,
  computeSnapshotEvidenceHash,
  validateSnapshotIntegrity,
} from '../src/services/trading/decision/JiniContextSnapshot.js';
import {
  buildJiniSnapshotFromPanels,
  buildXmInputsFromPayloads,
} from '../src/services/trading/decision/panelIntegration.js';
import { evaluateSourceTiming } from '../src/services/trading/decision/timing.js';
import { analyzeSupplyDemand } from '../src/services/trading/supplyDemand/SupplyDemandEngine.js';
import { buildScalpingM1Analysis } from '../src/services/trading/scalping/scalpingM1.js';

const NOW = Date.parse('2026-11-04T12:00:00.000Z');
const SYMBOL = 'XAUUSD';

const TF_MS = {
  M1: 60_000,
  M5: 300_000,
  M15: 900_000,
  H1: 3_600_000,
  H4: 14_400_000,
  D1: 86_400_000,
};

function iso(ms) {
  return new Date(ms).toISOString();
}

function makeSeries(timeframe, count = 60, { now = NOW, base = 4000 } = {}) {
  const ms = TF_MS[timeframe];
  const candles = [];
  for (let i = 0; i < count; i += 1) {
    const ts = now - (count - 1 - i) * ms;
    const open = base + i * 0.1;
    candles.push({
      symbol: SYMBOL,
      timeframe,
      open,
      high: open + 0.6,
      low: open - 0.6,
      close: open + 0.25,
      volume: 100 + i,
      source: 'MT5_LOCAL_BRIDGE',
      timestamp: iso(ts),
    });
  }
  return candles;
}

function makeTick(now = NOW) {
  return {
    bid: 4000.0,
    ask: 4000.4,
    timestamp: iso(now - 2000),
    source: 'MT5_LOCAL_BRIDGE',
  };
}

function makeXmMulti({ now = NOW, includeM1 = true } = {}) {
  const tick = makeTick(now);
  const payloads = {};
  for (const timeframe of ['M1', 'M5', 'M15', 'H1', 'H4', 'D1']) {
    if (timeframe === 'M1' && !includeM1) continue;
    const candles = makeSeries(timeframe, 60, { now });
    payloads[timeframe] = {
      source: 'MT5_LOCAL_BRIDGE',
      candles,
      tick,
      lastCandleAt: candles.at(-1).timestamp,
    };
  }
  return { ok: true, symbol: SYMBOL, payloads, failures: {} };
}

function enginePayloads(xmMulti) {
  const payloads = {};
  for (const timeframe of ['M1', 'M5', 'M15', 'H1', 'H4']) {
    const entry = xmMulti.payloads[timeframe];
    if (entry) payloads[timeframe] = entry;
  }
  return payloads;
}

function makeSupplyDemand(xmMulti = makeXmMulti()) {
  return analyzeSupplyDemand({
    symbol: SYMBOL,
    timeframes: ['M1', 'M5', 'M15', 'H1', 'H4'],
    payloads: enginePayloads(xmMulti),
    currentPrice: 4000.2,
    now: NOW,
  });
}

function makeScalping(xmMulti = makeXmMulti()) {
  return buildScalpingM1Analysis({
    symbol: SYMBOL,
    payloads: enginePayloads(xmMulti),
    now: NOW,
  });
}

function makeOrderFlow({ now = NOW, lastTradeAt = now - 5000 } = {}) {
  return {
    ok: true,
    status: 'LIVE',
    classification: 'EXCHANGE_AGGRESSOR',
    window: {
      trades: 150,
      firstTradeAt: iso(lastTradeAt - 60_000),
      lastTradeAt: iso(lastTradeAt),
    },
    volume: { buyBase: 650, sellBase: 350, totalBase: 1000 },
    percentages: { buy: 65, sell: 35, neutral: 0 },
    delta: 300,
    imbalance: 0.3,
    cvd: 420,
    absorption: { status: 'DETECTED', side: 'BUY', note: 'Penjual agresif diserap di demand.' },
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
  generatedAt = NOW - 120_000,
  bias = 'UP',
  staleInstruments = [],
} = {}) {
  return {
    ok: true,
    generatedAt: iso(generatedAt),
    providerSummary: { priceSeries: 'Yahoo Finance', noSimulatedData: true },
    gold: { id: 'gold', symbol: 'XAUUSD', latest: 4000.2, status: 'LIVE' },
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
      score: 0.3,
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
  updatedAt = NOW - 10_000,
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
    updatedAt: iso(updatedAt),
  };
}

function makeBridge({ online = true, updatedAt = NOW - 5000 } = {}) {
  return {
    ok: online,
    online,
    source: online ? 'MT5_LOCAL_BRIDGE' : null,
    symbol: SYMBOL,
    endpoint: 'http://127.0.0.1:20200',
    timeframes: online ? { M1: { count: 60, freshness: 'FRESH' } } : {},
    tick: makeTick(),
    updatedAt: iso(updatedAt),
    message: online ? null : 'Bridge offline',
  };
}

function makeFullSnapshot(overrides = {}) {
  const xmMulti = overrides.xmMulti || makeXmMulti();
  return buildJiniSnapshotFromPanels({
    xmMulti,
    supplyDemand: 'supplyDemand' in overrides ? overrides.supplyDemand : makeSupplyDemand(xmMulti),
    scalping: 'scalping' in overrides ? overrides.scalping : makeScalping(xmMulti),
    orderFlow: 'orderFlow' in overrides ? overrides.orderFlow : makeOrderFlow(),
    intermarket: 'intermarket' in overrides ? overrides.intermarket : makeIntermarket(),
    terminal: 'terminal' in overrides ? overrides.terminal : makeTerminal(),
    bridge: 'bridge' in overrides ? overrides.bridge : makeBridge(),
    now: overrides.now || NOW,
  });
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

console.log('=== JINI TAHAP 2 — PANEL INTEGRATION TEST SUITE (FIXTURES) ===\n');

// ── 1. All sources available ──
console.log('Test 1: Seluruh sumber tersedia -> snapshot utuh & traceable');
check('semua sumber terintegrasi', () => {
  const snapshot = makeFullSnapshot();

  assert.equal(snapshot.snapshotContractVersion, 'jini-context-snapshot-v2');
  assert.equal(snapshot.instrument, 'XAUUSD');
  assert.equal(snapshot.overallIntegrity, DATA_INTEGRITY_STATUS.READY);
  assert.deepEqual(snapshot.criticalSourcesMissing, []);
  assert.deepEqual(snapshot.optionalSourcesMissing, []);
  assert.equal(snapshot.supplyDemandEvidence.status, DATA_INTEGRITY_STATUS.READY);
  assert.equal(snapshot.scalpingEvidence.status, DATA_INTEGRITY_STATUS.READY);
  assert.equal(snapshot.orderFlowEvidence.status, DATA_INTEGRITY_STATUS.READY);
  assert.equal(snapshot.intermarketEvidence.status, DATA_INTEGRITY_STATUS.READY);
  assert.equal(snapshot.terminalStatus.status, DATA_INTEGRITY_STATUS.READY);
  assert.equal(snapshot.crossSourceTiming.skewStatus, 'SYNCED');
  assert.equal(snapshot.evidenceHash.length, 64);
  assert.equal(validateSnapshotIntegrity(snapshot).valid, true);

  for (const timeframe of ['M1', 'M5', 'M15', 'H1', 'H4', 'D1']) {
    assert.equal(snapshot.timeframeAnalysis[timeframe].count, 60);
    assert.equal(snapshot.sourceFreshness[`XM_${timeframe}`].status, DATA_INTEGRITY_STATUS.READY);
  }
});

// ── 2. Order Flow unavailable ──
console.log('Test 2: Order Flow unavailable -> tidak ada angka palsu');
check('order flow unavailable fail-honest', () => {
  const snapshot = makeFullSnapshot({ orderFlow: null });
  const of = snapshot.orderFlowEvidence;

  assert.equal(of.status, DATA_INTEGRITY_STATUS.UNAVAILABLE);
  assert.equal(of.aggressiveBuy, null);
  assert.equal(of.aggressiveSell, null);
  assert.equal(of.buyPercent, null);
  assert.equal(of.delta, null);
  assert.equal(of.cvd, null);
  assert.ok(snapshot.optionalSourcesMissing.includes('ORDER_FLOW_TAPE'));
  assert.equal(validateSnapshotIntegrity(snapshot).valid, true);
});

// ── 3. Intermarket stale ──
console.log('Test 3: Intermarket stale -> freshness jujur & skew terdeteksi');
check('intermarket stale', () => {
  const snapshot = makeFullSnapshot({
    intermarket: makeIntermarket({
      generatedAt: NOW - (45 * 60_000),
      staleInstruments: ['DXY'],
    }),
  });

  assert.equal(snapshot.intermarketEvidence.status, DATA_INTEGRITY_STATUS.DEGRADED);
  assert.ok(snapshot.intermarketEvidence.staleInstruments.includes('DXY'));
  assert.equal(snapshot.sourceFreshness.INTERMARKET.status, DATA_INTEGRITY_STATUS.STALE);
  assert.equal(snapshot.crossSourceTiming.skewStatus, 'MAJOR_SKEW');
  assert.ok(snapshot.crossSourceTiming.affectedSources.includes('INTERMARKET'));
  assert.ok(snapshot.degradedSources.includes('INTERMARKET'));
  assert.equal(snapshot.overallIntegrity, DATA_INTEGRITY_STATUS.DEGRADED);
});

// ── 4. S&D produced no zones ──
console.log('Test 4: S&D belum menghasilkan zona -> tidak dikarang');
check('s&d tanpa zona', () => {
  const emptySd = {
    dataStatus: 'READY',
    dataAvailable: true,
    isXmValidated: true,
    generatedAt: iso(NOW),
    lastUpdate: iso(NOW - 60_000),
    currentPrice: 4000.2,
    timeframes: {},
    zones: [],
    activeZones: [],
    nearestDemand: null,
    nearestSupply: null,
    confluence: [],
    lifecycleCounts: {},
    warnings: [],
  };
  const snapshot = makeFullSnapshot({ supplyDemand: emptySd });

  assert.equal(snapshot.supplyDemandEvidence.status, DATA_INTEGRITY_STATUS.READY);
  assert.equal(snapshot.supplyDemandEvidence.activeZoneCount, 0);
  assert.equal(snapshot.supplyDemandEvidence.nearestDemand, null);
  assert.equal(snapshot.supplyDemandEvidence.nearestSupply, null);
  assert.equal(snapshot.supplyDemandEvidence.strongest, null);
  assert.ok(!snapshot.criticalSourcesMissing.includes('SUPPLY_DEMAND'));
});

// ── 5. M1 empty ──
console.log('Test 5: Data M1 kosong -> ditandai, bukan diisi');
check('m1 kosong', () => {
  const snapshot = makeFullSnapshot({
    xmMulti: makeXmMulti({ includeM1: false }),
    scalping: null,
    supplyDemand: null,
  });

  assert.equal(snapshot.timeframeAnalysis.M1.count, 0);
  assert.equal(snapshot.timeframeAnalysis.M1.ready, false);
  assert.ok(snapshot.optionalSourcesMissing.includes('XM_OHLC_M1'));
  assert.equal(snapshot.scalpingEvidence.status, DATA_INTEGRITY_STATUS.UNAVAILABLE);
  assert.equal(snapshot.overallIntegrity, DATA_INTEGRITY_STATUS.DEGRADED);
});

// ── 6. XM bridge disconnected ──
console.log('Test 6: XM bridge terputus -> status operasional jujur');
check('bridge offline', () => {
  const snapshot = makeFullSnapshot({
    terminal: makeTerminal({ connected: false, platformReady: false, fatalError: true }),
    bridge: makeBridge({ online: false }),
  });

  assert.equal(snapshot.terminalStatus.status, DATA_INTEGRITY_STATUS.UNAVAILABLE);
  assert.equal(snapshot.terminalStatus.connectionQuality, 'OFFLINE');
  assert.equal(snapshot.terminalStatus.bridge.online, false);
  assert.ok(snapshot.optionalSourcesMissing.includes('JINI_MONITOR'));
  assert.ok(snapshot.optionalSourcesMissing.includes('MT5_BRIDGE'));
  // Price candles remain independently validated; monitor outage does not fake prices.
  assert.equal(snapshot.priceData.valid, true);
  assert.equal(snapshot.overallIntegrity, DATA_INTEGRITY_STATUS.DEGRADED);
});

// ── 7. Cross-source timestamps out of sync ──
console.log('Test 7: Timestamp antarsumber tidak sinkron -> dilaporkan eksplisit');
check('skew order flow', () => {
  const snapshot = makeFullSnapshot({
    orderFlow: makeOrderFlow({ lastTradeAt: NOW - (10 * 60_000) }),
  });

  assert.equal(snapshot.orderFlowEvidence.status, DATA_INTEGRITY_STATUS.STALE);
  assert.equal(snapshot.crossSourceTiming.skewStatus, 'MAJOR_SKEW');
  assert.ok(snapshot.crossSourceTiming.affectedSources.includes('ORDER_FLOW'));
  const flag = snapshot.crossSourceTiming.flags.find((item) => item.source === 'ORDER_FLOW');
  assert.ok(flag);
  assert.equal(flag.code, 'ORDER_FLOW_LAGS_PRICE');
  assert.ok(snapshot.crossSourceTiming.policy.includes('tidak pernah dianggap satu kondisi pasar'));
  assert.ok(snapshot.degradedSources.includes('ORDER_FLOW_TAPE'));
  assert.equal(snapshot.overallIntegrity, DATA_INTEGRITY_STATUS.DEGRADED);
});

// ── 8. Payload change changes the evidence hash ──
console.log('Test 8: Perubahan payload mengubah evidence hash');
check('hash sensitif payload', () => {
  const a = computeSnapshotEvidenceHash({ orderFlowEvidence: { delta: 300, cvd: 420 } });
  const b = computeSnapshotEvidenceHash({ orderFlowEvidence: { delta: 301, cvd: 420 } });
  assert.notEqual(a, b);

  const original = makeFullSnapshot();
  const tampered = JSON.parse(JSON.stringify(original));
  tampered.orderFlowEvidence.delta = 999999;
  assert.notEqual(computeSnapshotEvidenceHash(tampered), original.evidenceHash);
  assert.equal(validateSnapshotIntegrity(tampered).valid, false);
});

// ── 9. Snapshot rejects data that fails validation ──
console.log('Test 9: Data tidak valid tidak diterima sebagai bukti');
check('invalid data rejected', () => {
  const xmMulti = makeXmMulti();
  xmMulti.payloads.M1.candles = [
    { open: 4000, high: 3990, low: 4005, close: 4000, volume: 10, timestamp: iso(NOW - 60_000) },
  ];
  const snapshot = makeFullSnapshot({ xmMulti, scalping: null, supplyDemand: null });
  assert.equal(snapshot.timeframeAnalysis.M1.count, 0);
  assert.equal(snapshot.timeframeAnalysis.M1.lastOhlc, null);
  assert.ok(snapshot.optionalSourcesMissing.includes('XM_OHLC_M1'));

  const invalidTickSnapshot = buildJiniTradingContextSnapshot({
    rawXMCandles: {
      D1: makeSeries('D1', 60),
      H4: makeSeries('H4', 60),
      M1: makeSeries('M1', 60),
    },
    rawXMTick: { bid: 4001, ask: 4000, timestamp: iso(NOW) },
    now: NOW,
  });
  assert.equal(invalidTickSnapshot.priceData.valid, false);
  assert.ok(invalidTickSnapshot.criticalSourcesMissing.includes('XM_TICK'));
  assert.equal(invalidTickSnapshot.overallIntegrity, DATA_INTEGRITY_STATUS.UNAVAILABLE);

  // Valid prices without a broker timestamp cannot be proven fresh -> fail-closed.
  const untimestampedTickSnapshot = buildJiniTradingContextSnapshot({
    rawXMCandles: {
      D1: makeSeries('D1', 60),
      H4: makeSeries('H4', 60),
      M1: makeSeries('M1', 60),
    },
    rawXMTick: { bid: 4000.0, ask: 4000.4 },
    now: NOW,
  });
  assert.equal(untimestampedTickSnapshot.priceData.rawTimestampProvided, false);
  assert.equal(untimestampedTickSnapshot.priceData.timestampVerified, false);
  assert.equal(untimestampedTickSnapshot.sourceFreshness.XM_TICK.status, DATA_INTEGRITY_STATUS.UNAVAILABLE);
  assert.ok(untimestampedTickSnapshot.criticalSourcesMissing.includes('XM_TICK'));
  assert.equal(untimestampedTickSnapshot.overallIntegrity, DATA_INTEGRITY_STATUS.UNAVAILABLE);

  const unavailableSd = makeFullSnapshot({
    supplyDemand: { dataStatus: 'DATA_UNAVAILABLE', dataAvailable: false, isXmValidated: false },
  });
  assert.equal(unavailableSd.supplyDemandEvidence.status, DATA_INTEGRITY_STATUS.UNAVAILABLE);
  assert.equal(unavailableSd.supplyDemandEvidence.nearestDemand, null);
  assert.ok(unavailableSd.optionalSourcesMissing.includes('SUPPLY_DEMAND'));
});

// ── 10. Traceability to original providers ──
console.log('Test 10: Seluruh sumber dapat ditelusuri ke provider asli');
check('provenance', () => {
  const snapshot = makeFullSnapshot();

  for (const [sourceId, entry] of Object.entries(snapshot.sourceIntegrity)) {
    if (entry.level !== DATA_INTEGRITY_STATUS.UNAVAILABLE) {
      assert.ok(entry.attribution, `Source ${sourceId} harus punya attribution`);
    }
  }

  assert.equal(snapshot.sourceIntegrity.ORDER_FLOW.isProxy, true);
  assert.equal(snapshot.sourceIntegrity.ORDER_FLOW.isComex, false);
  assert.equal(snapshot.sourceIntegrity.ORDER_FLOW.attribution.provider, 'Binance Spot');
  assert.equal(snapshot.sourceIntegrity.ORDER_FLOW.attribution.symbol, 'PAXGUSDT');
  assert.equal(snapshot.sourceIntegrity.ORDER_FLOW.comex.status, DATA_INTEGRITY_STATUS.UNAVAILABLE);

  assert.equal(snapshot.orderFlowEvidence.venue, 'BINANCE_SPOT_PAXG_PROXY');
  assert.equal(snapshot.orderFlowEvidence.comex.isComex, true);

  assert.ok(snapshot.intermarketEvidence.coverage.notProvided.includes('silver'));
  assert.ok(snapshot.intermarketEvidence.coverage.notProvided.includes('copper'));
  assert.ok(snapshot.intermarketEvidence.coverage.notProvided.includes('sp500'));

  // URL must be sanitized (no query/token leak)
  assert.equal(snapshot.terminalStatus.xmTerminal.url, 'https://www.xm.com/terminal/index.html');
  assert.equal(snapshot.sourceIntegrity.XM_D1.attribution.provider, 'XM Global MT5 (MT5_LOCAL_BRIDGE)');
});

// ── 11. Timing helper behaviour ──
console.log('Test 11: evaluateSourceTiming memisahkan age dan skew');
check('timing helper', () => {
  const { sourceFreshness, crossSourceTiming } = evaluateSourceTiming({
    now: NOW,
    entries: [
      { id: 'XM_TICK', dataAsOf: iso(NOW - 1000), slaMs: 180_000 },
      { id: 'ORDER_FLOW', dataAsOf: iso(NOW - 400_000), slaMs: 300_000, status: 'STALE' },
    ],
  });
  assert.equal(sourceFreshness.XM_TICK.status, DATA_INTEGRITY_STATUS.READY);
  assert.equal(sourceFreshness.ORDER_FLOW.status, DATA_INTEGRITY_STATUS.STALE);
  assert.equal(crossSourceTiming.referenceSource, 'XM_TICK');
  assert.ok(crossSourceTiming.flags.some((flag) => flag.source === 'ORDER_FLOW'));
});

// ── 12. Panel unwrapping keeps D1 + tick ──
console.log('Test 12: buildXmInputsFromPayloads membawa D1 dan tick');
check('panel unwrap', () => {
  const xmMulti = makeXmMulti();
  const { rawXMCandles, rawXMTick } = buildXmInputsFromPayloads(xmMulti);
  assert.equal(rawXMCandles.D1.candles.length, 60);
  assert.equal(rawXMCandles.M1.source, 'MT5_LOCAL_BRIDGE');
  assert.equal(rawXMTick.bid, 4000.0);
});

console.log(`\n======================================================`);
console.log(`✅ SELURUH TEST TAHAP 2 BERHASIL LOLOS (${passed}/12)`);
console.log('======================================================\n');
