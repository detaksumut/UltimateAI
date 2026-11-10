/**
 * tests/jini-decision-engine-tahap1.test.mjs
 * Comprehensive Unit & Contract Test Suite for JINI Gold Decision Engine — Tahap 1.
 *
 * Verifies:
 * 1. Aggressor percentage formula: Buy% = V_Buy / (V_Buy + V_Sell) * 100.
 * 2. Strict PAXG proxy attribution and COMEX GC UNAVAILABLE contract.
 * 3. XM OHLC and Tick normalization with market-aware weekend grace.
 * 4. Deep snapshot immutability (freezing) and cryptographic audit hash generation.
 * 5. Deterministic validation failures for corrupted data or constitutional violations.
 */

import assert from 'node:assert/strict';
import {
  ENGINE_VERSION,
  DATA_INTEGRITY_STATUS,
  COMEX_INTEGRITY_CONTRACT,
  PROXY_INTEGRITY_CONTRACT,
  EXECUTION_GATE_LIMITS,
} from '../src/services/trading/decision/constants.js';
import {
  calculateAggressorVolumeMetrics,
  isValidCandle,
  normalizeCandleSeries,
  normalizeTickData,
  normalizeOrderFlowSnapshot,
  normalizeMultiTimeframeCandles,
} from '../src/services/trading/decision/normalizer.js';
import {
  buildJiniTradingContextSnapshot,
  validateSnapshotIntegrity,
  deepFreeze,
  computeSnapshotEvidenceHash,
} from '../src/services/trading/decision/JiniContextSnapshot.js';

console.log('=== RUNNING JINI GOLD DECISION ENGINE — TAHAP 1 TEST SUITE ===\n');

// ── TEST 1: Aggressor Volume Formula Verification ──
console.log('Test 1: Memverifikasi formula persentase agresi (V_Buy + V_Sell sebagai penyebut)...');
{
  const m1 = calculateAggressorVolumeMetrics(650, 350);
  assert.equal(m1.buyVolume, 650);
  assert.equal(m1.sellVolume, 350);
  assert.equal(m1.totalVolume, 1000);
  assert.equal(m1.buyPercent, 65.0);
  assert.equal(m1.sellPercent, 35.0);
  assert.equal(m1.deltaVolume, 300);

  // Asymmetric test
  const m2 = calculateAggressorVolumeMetrics(120, 80);
  assert.equal(m2.totalVolume, 200);
  assert.equal(m2.buyPercent, 60.0);
  assert.equal(m2.sellPercent, 40.0);
  assert.equal(m2.deltaVolume, 40);

  // Zero-volume edge case (zero division protection)
  const mZero = calculateAggressorVolumeMetrics(0, 0);
  assert.equal(mZero.totalVolume, 0);
  assert.equal(mZero.buyPercent, 50.0);
  assert.equal(mZero.sellPercent, 50.0);
  assert.equal(mZero.deltaVolume, 0);
  console.log('  ✓ Formula matematis dominasi agresor terbukti akurat dan aman zero-division.');
}

// ── TEST 2: Candle Geometry & Sanitization ──
console.log('Test 2: Memverifikasi sanitasi geometri candlestick...');
{
  // Valid candle
  assert.equal(isValidCandle({ open: 2000, high: 2010, low: 1990, close: 2005, volume: 100, timestamp: '2026-11-06T12:00:00Z' }), true);

  // Invalid candle: high lower than open
  assert.equal(isValidCandle({ open: 2010, high: 2005, low: 1990, close: 2000, timestamp: '2026-11-06T12:00:00Z' }), false);

  // Invalid candle: low higher than close
  assert.equal(isValidCandle({ open: 2000, high: 2010, low: 2002, close: 2000, timestamp: '2026-11-06T12:00:00Z' }), false);

  // Invalid candle: zero or negative price
  assert.equal(isValidCandle({ open: 0, high: 2010, low: 1990, close: 2000, timestamp: '2026-11-06T12:00:00Z' }), false);
  assert.equal(isValidCandle({ open: 2000, high: 2010, low: -5, close: 2000, timestamp: '2026-11-06T12:00:00Z' }), false);

  // Candle series sorting & normalization
  const unsorted = [
    { open: 2005, high: 2015, low: 2000, close: 2010, volume: 10, timestamp: '2026-11-06T12:02:00Z' },
    { open: 2000, high: 2010, low: 1995, close: 2005, volume: 15, timestamp: '2026-11-06T12:00:00Z' },
  ];
  const normalizedSeries = normalizeCandleSeries(unsorted, 'M1');
  assert.equal(normalizedSeries.count, 2);
  assert.equal(normalizedSeries.candles[0].open, 2000);
  assert.equal(normalizedSeries.candles[1].open, 2005);
  console.log('  ✓ Geometri candlestick XM dan urutan kronologis terverifikasi.');
}

// ── TEST 3: XM Tick & Spread Gate ──
console.log('Test 3: Memverifikasi validasi tick dan batas spread XM...');
{
  // Valid tick within spread limit (spread 0.50 <= 1.50)
  const t1 = normalizeTickData({ bid: 2700.0, ask: 2700.5, timestamp: '2026-11-06T12:00:00Z' });
  assert.equal(t1.valid, true);
  assert.equal(t1.mid, 2700.25);
  assert.equal(t1.spreadPips, 0.50);
  assert.equal(t1.spreadAcceptable, true);

  // Spread too wide (spread 2.50 > 1.50)
  const tWide = normalizeTickData({ bid: 2700.0, ask: 2702.5, timestamp: '2026-11-06T12:00:00Z' });
  assert.equal(tWide.valid, true);
  assert.equal(tWide.spreadAcceptable, false);

  // Inverted tick (ask < bid) -> Invalid
  const tInverted = normalizeTickData({ bid: 2702.0, ask: 2700.0 });
  assert.equal(tInverted.valid, false);
  console.log('  ✓ Filter tick XM dan batas toleransi spread terverifikasi.');
}

// ── TEST 4: Data Integrity Attribution (PAXG vs COMEX) ──
console.log('Test 4: Memverifikasi pemisahan mutlak PAXG Proxy vs COMEX GC...');
{
  const rawOF = {
    tradesCount: 150,
    buyVolume: 450,
    sellVolume: 250,
    lastTradeAt: Date.now() - 10_000,
  };
  const normalizedOF = normalizeOrderFlowSnapshot(rawOF);
  assert.equal(normalizedOF.proxy.isProxy, true);
  assert.equal(normalizedOF.proxy.isComex, false);
  assert.equal(normalizedOF.comex.isComex, true);
  assert.equal(normalizedOF.comex.status, DATA_INTEGRITY_STATUS.UNAVAILABLE);
  assert.ok(normalizedOF.comex.reason.includes('feed belum terhubung'));
  console.log('  ✓ Aturan atribusi data: PAXG proxy dan COMEX unavailable terbukti dipatuhi.');
}

// ── TEST 5: Snapshot Aggregator & Deep Freeze ──
console.log('Test 5: Memverifikasi pembentukan snapshot utuh dan imutabilitas (deep freeze)...');
{
  // Generate dummy candles for D1, H4, M1
  const dummyD1 = [];
  for (let i = 0; i < 25; i++) {
    dummyD1.push({
      open: 2600 + i,
      high: 2610 + i,
      low: 2590 + i,
      close: 2605 + i,
      volume: 1000,
      timestamp: new Date(Date.now() - (25 - i) * 86400000).toISOString(),
    });
  }

  const dummyH4 = [];
  for (let i = 0; i < 20; i++) {
    dummyH4.push({
      open: 2650 + i,
      high: 2655 + i,
      low: 2645 + i,
      close: 2652 + i,
      volume: 500,
      timestamp: new Date(Date.now() - (20 - i) * 14400000).toISOString(),
    });
  }

  const dummyM1 = [];
  for (let i = 0; i < 60; i++) {
    dummyM1.push({
      open: 2700 + i * 0.1,
      high: 2701 + i * 0.1,
      low: 2699 + i * 0.1,
      close: 2700.5 + i * 0.1,
      volume: 50,
      timestamp: new Date(Date.now() - (60 - i) * 60000).toISOString(),
    });
  }

  const snapshot = buildJiniTradingContextSnapshot({
    rawXMCandles: { D1: dummyD1, H4: dummyH4, M1: dummyM1 },
    rawXMTick: { bid: 2705.0, ask: 2705.4, timestamp: new Date().toISOString() },
    rawOrderFlow: { tradesCount: 200, buyVolume: 500, sellVolume: 300, lastTradeAt: Date.now() - 5000 },
    rawIntermarket: { status: 'READY', macroBias: 'BULLISH', correlationWindowDays: 180 },
    rawSupplyDemand: { status: 'READY', currentPrice: 2705.2 },
    rawScalping: { status: 'READY', adx: 28, efficiencyRatio: 0.42, volatilityRegime: 'NORMAL' },
    now: Date.now(),
  });

  assert.ok(snapshot.snapshotId.startsWith('SNAP-XAUUSD-'));
  assert.equal(snapshot.engineVersion, ENGINE_VERSION);
  assert.ok(snapshot.evidenceHash.length === 64);
  assert.ok(Object.isFrozen(snapshot), 'Snapshot harus di-freeze');
  assert.ok(Object.isFrozen(snapshot.sources), 'Sub-objek snapshot harus di-freeze');

  // Verify mutation throws or fails
  assert.throws(() => {
    snapshot.asset = 'EURUSD';
  }, /Cannot assign to read only property/);

  // Validate integrity
  const validation = validateSnapshotIntegrity(snapshot);
  assert.equal(validation.valid, true, `Validation failed: ${validation.errors.join(', ')}`);
  console.log('  ✓ Snapshot imutabel terbentuk lengkap dengan cryptographic evidence hash.');
}

// ── TEST 6: Constitutional Violation Rejection ──
console.log('Test 6: Memverifikasi penolakan konstitusional jika COMEX diklaim palsu...');
{
  // Manually construct snapshot with fake comex claim
  const corruptSnapshot = {
    sources: {
      xmPrice: {
        tick: { valid: true },
        candles: { D1: { count: 30 }, H4: { count: 20 } },
      },
      orderFlow: {
        isComex: true, // VIOLATION!
        isProxy: false,
      },
    },
  };
  const val = validateSnapshotIntegrity(corruptSnapshot);
  assert.equal(val.valid, false);
  assert.ok(val.errors.some(e => e.includes('Constitutional violation')));
  console.log('  ✓ Upaya memalsukan tape COMEX berhasil ditolak oleh contract verifier.');
}

// ── TEST 7: Evidence Hash Sensitivity & Tamper Detection ──
console.log('Test 7: Memverifikasi evidence hash peka terhadap isi bersarang dan mendeteksi tampering...');
{
  // Regression: nested evidence must change the hash (old replacer-array bug
  // produced identical hashes for different nested payloads).
  const hashA = computeSnapshotEvidenceHash({ snapshotId: 'X', sources: { tick: { bid: 1 } } });
  const hashB = computeSnapshotEvidenceHash({ snapshotId: 'X', sources: { tick: { bid: 999 } } });
  assert.notEqual(hashA, hashB, 'Hash berbeda wajib dihasilkan untuk bukti bersarang yang berbeda');

  const dummyD1 = Array.from({ length: 25 }, (_, i) => ({
    open: 2600 + i, high: 2610 + i, low: 2590 + i, close: 2605 + i, volume: 1000,
    timestamp: new Date(Date.now() - (25 - i) * 86400000).toISOString(),
  }));
  const dummyH4 = Array.from({ length: 20 }, (_, i) => ({
    open: 2650 + i, high: 2655 + i, low: 2645 + i, close: 2652 + i, volume: 500,
    timestamp: new Date(Date.now() - (20 - i) * 14400000).toISOString(),
  }));
  const live = buildJiniTradingContextSnapshot({
    rawXMCandles: { D1: dummyD1, H4: dummyH4 },
    rawXMTick: { bid: 2705.0, ask: 2705.4, timestamp: new Date().toISOString() },
    now: Date.now(),
  });

  const tampered = JSON.parse(JSON.stringify(live));
  tampered.sources.xmPrice.tick.bid = 9999.99;
  const tamperedValidation = validateSnapshotIntegrity(tampered);
  assert.equal(tamperedValidation.valid, false);
  assert.ok(tamperedValidation.errors.some((e) => e.includes('Evidence hash mismatch')));
  console.log('  ✓ Hash menolak manipulasi bukti dan lod audit trail dapat diverifikasi ulang.');
}

// ── TEST 8: Fail-Closed Default Integrity ──
console.log('Test 8: Memverifikasi status default fail-closed saat panel opsional tidak tersedia...');
{
  const dummyD1 = Array.from({ length: 25 }, (_, i) => ({
    open: 2600 + i, high: 2610 + i, low: 2590 + i, close: 2605 + i, volume: 1000,
    timestamp: new Date(Date.now() - (25 - i) * 86400000).toISOString(),
  }));
  const dummyH4 = Array.from({ length: 20 }, (_, i) => ({
    open: 2650 + i, high: 2655 + i, low: 2645 + i, close: 2652 + i, volume: 500,
    timestamp: new Date(Date.now() - (20 - i) * 14400000).toISOString(),
  }));
  const snapshot = buildJiniTradingContextSnapshot({
    rawXMCandles: { D1: dummyD1, H4: dummyH4 },
    rawXMTick: { bid: 2705.0, ask: 2705.4, timestamp: new Date().toISOString() },
    now: Date.now(),
  });

  assert.equal(snapshot.sources.intermarket.status, DATA_INTEGRITY_STATUS.UNAVAILABLE);
  assert.equal(snapshot.sources.intermarket.macroBias, 'INSUFFICIENT_DATA');
  assert.equal(snapshot.sources.supplyDemand.status, DATA_INTEGRITY_STATUS.UNAVAILABLE);
  assert.equal(snapshot.sources.scalpingM1.status, DATA_INTEGRITY_STATUS.UNAVAILABLE);
  assert.equal(snapshot.overallIntegrity, DATA_INTEGRITY_STATUS.DEGRADED);
  assert.ok(snapshot.optionalSourcesMissing.includes('ORDER_FLOW_TAPE'));
  assert.ok(snapshot.optionalSourcesMissing.includes('INTERMARKET'));
  console.log('  ✓ Ketiadaan data tidak pernah dilaporkan READY (fail-closed).');
}

// ── TEST 9: Provider-Shape Order Flow Normalization ──
console.log('Test 9: Memverifikasi normalizer membaca keluaran provider goldOrderFlow.mjs...');
{
  const now = Date.now();
  const normalized = normalizeOrderFlowSnapshot({
    ok: true,
    window: { trades: 120, lastTradeAt: now - 5000 },
    volume: { buyBase: 650, sellBase: 350 },
    cvd: 300,
    absorption: { status: 'DETECTED', side: 'BUY' },
  }, now);

  assert.equal(normalized.tradesCount, 120);
  assert.equal(normalized.metrics.buyPercent, 65);
  assert.equal(normalized.metrics.sellPercent, 35);
  assert.equal(normalized.freshness, DATA_INTEGRITY_STATUS.READY);
  assert.equal(normalized.status, DATA_INTEGRITY_STATUS.READY);
  assert.equal(normalized.cvd, 300);
  assert.equal(normalized.absorptionDetected, true);
  console.log('  ✓ Shape provider riil (window/volume/cvd/absorption) terpetakan dengan benar.');
}

// ── TEST 10: Missing Timestamp Fails Closed ──
console.log('Test 10: Memverifikasi tape tanpa timestamp tidak dianggap segar...');
{
  const normalized = normalizeOrderFlowSnapshot({
    ok: true,
    window: { trades: 120 },
    volume: { buyBase: 100, sellBase: 50 },
  });
  assert.equal(normalized.freshness, DATA_INTEGRITY_STATUS.UNAVAILABLE);
  assert.equal(normalized.status, DATA_INTEGRITY_STATUS.UNAVAILABLE);
  assert.equal(normalized.lastTradeAt, null);
  console.log('  ✓ Freshness tak terverifikasi ditolak (tidak ada asumsi segar).');
}

// ── TEST 11: Zero CVD Is Preserved ──
console.log('Test 11: Memverifikasi CVD bernilai 0 tidak diganti delta...');
{
  const now = Date.now();
  const normalized = normalizeOrderFlowSnapshot({
    ok: true,
    window: { trades: 100, lastTradeAt: now - 5000 },
    volume: { buyBase: 120, sellBase: 80 },
    cvd: 0,
  }, now);
  assert.equal(normalized.metrics.deltaVolume, 40);
  assert.equal(normalized.cvd, 0);
  console.log('  ✓ Nilai nol yang sah tidak tertimpa fallback (nullish handling).');
}

console.log('\n======================================================');
console.log('✅ SELURUH TEST TAHAP 1 BERHASIL LOLOS 100% (11/11)');
console.log('======================================================\n');

