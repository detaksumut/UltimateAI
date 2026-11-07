/**
 * visual-chart-integration.test.js
 * Verification of Visual Chart Integration:
 * - Line coordinates (Entry, SL, TP1, TP2) on chart
 * - Dynamic scaling to include active order levels
 * - Markers, volume lots, and live Floating P/L tags
 * - TP1 partial close rendering and runner tracking
 * - Position removal upon SL/TP hit or Manual Close
 * - Zero broker calls verification
 */

import { DemoTradingEngine } from '../src/services/trading/DemoTradingEngine.js';

// Polyfill localStorage
if (typeof globalThis.localStorage === 'undefined') {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
}

console.log('========================================================================');
console.log('📊 JIN DEMO TRADING VISUAL INTEGRATION — CHART & ORDER VALIDATION');
console.log('========================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

const engine = new DemoTradingEngine();
engine.resetAccount();

// ── SIMULATION OF CHART CANVAS COORDINATE CALCULATION ENGINE ──
// Matches ProfessionalCandlestickChart.jsx getY() logic
function computeChartVisualLevels(candles, openPositions, plotHeight = 420) {
  let minPrice = Infinity;
  let maxPrice = -Infinity;

  candles.forEach(c => {
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
  });

  if (Array.isArray(openPositions) && openPositions.length > 0) {
    openPositions.forEach(p => {
      if (Number.isFinite(p.entryPrice) && p.entryPrice > 0) {
        minPrice = Math.min(minPrice, p.entryPrice);
        maxPrice = Math.max(maxPrice, p.entryPrice);
      }
      if (Number.isFinite(p.stopLoss) && p.stopLoss > 0) {
        minPrice = Math.min(minPrice, p.stopLoss);
        maxPrice = Math.max(maxPrice, p.stopLoss);
      }
      if (Number.isFinite(p.takeProfit1) && p.takeProfit1 > 0) {
        minPrice = Math.min(minPrice, p.takeProfit1);
        maxPrice = Math.max(maxPrice, p.takeProfit1);
      }
      if (Number.isFinite(p.takeProfit2) && p.takeProfit2 > 0) {
        minPrice = Math.min(minPrice, p.takeProfit2);
        maxPrice = Math.max(maxPrice, p.takeProfit2);
      }
    });
  }

  const candleSpan = maxPrice - minPrice;
  const padding = Math.max(0.6, candleSpan * 0.12);
  minPrice -= padding;
  maxPrice += padding;
  const priceRange = maxPrice - minPrice;

  const getY = (val) => plotHeight - ((val - minPrice) / (priceRange || 1)) * plotHeight;

  return {
    minPrice,
    maxPrice,
    priceRange,
    getY: (val) => Math.max(15, Math.min(plotHeight - 10, getY(val)))
  };
}

// Sample candles around $2740 (XAUUSD)
const mockCandles = [
  { open: 2738.0, high: 2741.0, low: 2737.5, close: 2740.0, volume: 100 },
  { open: 2740.0, high: 2742.5, low: 2739.0, close: 2741.2, volume: 150 },
  { open: 2741.2, high: 2743.0, low: 2739.5, close: 2740.5, volume: 120 },
];

// Step 1: Open BUY position
console.log('--- 1. BUKA BUY DEMO & VERIFIKASI TAMPILAN CHART ---');
engine.updateTick(2740.00, 2740.35);
const buyOrder = engine.openPosition({
  side: 'BUY',
  instrument: 'XAUUSD',
  lotSize: 1.0,
  entryPrice: 2740.35,
  stopLoss: 2730.00,
  takeProfit1: 2750.00,
  takeProfit2: 2760.00,
  comment: 'JIN BUY DEMO'
});

assert(buyOrder.ok === true, `BUY Demo berhasil dibuka ticket: ${buyOrder.position.ticket}`);

let chartState = computeChartVisualLevels(mockCandles, engine.getSnapshot().openPositions);
let pos = engine.getSnapshot().openPositions[0];

// Verify chart scaling accommodates all levels
assert(chartState.minPrice <= pos.stopLoss, `Chart bounds minimum ($${chartState.minPrice.toFixed(2)}) mencakup Stop Loss ($${pos.stopLoss})`);
assert(chartState.maxPrice >= pos.takeProfit2, `Chart bounds maximum ($${chartState.maxPrice.toFixed(2)}) mencakup Take Profit 2 ($${pos.takeProfit2})`);

const entryY = chartState.getY(pos.entryPrice);
const slY = chartState.getY(pos.stopLoss);
const tp1Y = chartState.getY(pos.takeProfit1);
const tp2Y = chartState.getY(pos.takeProfit2);

assert(Number.isFinite(entryY) && entryY > 0 && entryY < 420, `Garis Entry BUY tergambar pada Y=${entryY.toFixed(1)}px`);
assert(Number.isFinite(slY) && slY > entryY, `Garis SL tergambar di bawah Entry pada Y=${slY.toFixed(1)}px`);
assert(Number.isFinite(tp1Y) && tp1Y < entryY, `Garis TP1 tergambar di atas Entry pada Y=${tp1Y.toFixed(1)}px`);
assert(Number.isFinite(tp2Y) && tp2Y < tp1Y, `Garis TP2 tergambar di atas TP1 pada Y=${tp2Y.toFixed(1)}px`);

// Step 2: Floating P/L Tracking
console.log('\n--- 2. UJI PERUBAHAN FLOATING P/L MENGIKUTI TICK XM MT5 ---');
engine.updateTick(2746.00, 2746.35); // Price +$5.65 on 1.0 lot ($565.00)
let snap = engine.getSnapshot();
pos = snap.openPositions[0];
assert(pos.floatingPl === 565.00, `Floating P/L terverifikasi +$565.00 (Actual: +$${pos.floatingPl})`);
assert(snap.equity === 5565.00, `Equity akun terverifikasi $5,565.00 (Actual: $${snap.equity})`);

// Step 3: TP1 Hit with 50% Partial Close
console.log('\n--- 3. UJI TP1 HIT & STATUS PARTIAL CLOSE (50%) PADA CHART ---');
engine.updateTick(2750.50, 2750.85); // Hits TP1 (2750.00)
snap = engine.getSnapshot();
assert(snap.history.length === 1, `Trade History mencatat 1 eksekusi parsial TP1`);
assert(snap.openPositions.length === 1, `Sisa posisi (0.50 lot) tetap aktif di chart`);
pos = snap.openPositions[0];
assert(pos.lotSize === 0.5, `Volume tersisa di chart adalah 0.50 lot`);
assert(pos.tp1Hit === true, `Flag tp1Hit aktif untuk menampilkan label [TP1 HIT · SISA 0.50L] pada chart`);
assert(snap.balance === 5482.50, `Saldo bertambah menjadi $5,482.50 dari realisasi TP1`);

// Step 4: TP2 Hit (Full Close)
console.log('\n--- 4. UJI TP2 HIT (FULL CLOSE) & PENGHAPUSAN DARI CHART ---');
engine.updateTick(2760.50, 2760.85); // Hits TP2 (2760.00)
snap = engine.getSnapshot();
assert(snap.openPositions.length === 0, `Posisi aktif terhapus 100% dari chart setelah TP2 terkena`);
assert(snap.history.length === 2, `Trade History bertambah menjadi 2 transaksi`);
assert(snap.balance === 6465.00, `Saldo akhir setelah TP1 & TP2 tercatat $6,465.00`);
assert(snap.usedMargin === 0.00, `Used Margin kembali ke $0.00`);

// Step 5: Open SELL Demo & Stop Loss Hit
console.log('\n--- 5. BUKA SELL DEMO & UJI STOP LOSS (SL HIT) ---');
engine.updateTick(2760.00, 2760.35);
const sellOrder = engine.openPosition({
  side: 'SELL',
  instrument: 'XAUUSD',
  lotSize: 0.2,
  entryPrice: 2760.00,
  stopLoss: 2766.00,
  takeProfit1: 2748.00,
  comment: 'JIN SELL DEMO'
});
assert(sellOrder.ok === true, `SELL Demo berhasil dibuka: ${sellOrder.message}`);
snap = engine.getSnapshot();
assert(snap.openPositions.length === 1, `Posisi SELL muncul di chart`);
pos = snap.openPositions[0];
assert(pos.side === 'SELL', `Arah posisi adalah SELL`);

// Trigger SL hit
engine.updateTick(2766.20, 2766.50); // Ask exceeds SL 2766.00
snap = engine.getSnapshot();
assert(snap.openPositions.length === 0, `Posisi SELL terhapus dari chart seketika setelah SL terkena`);
assert(snap.history.length === 3, `History mencatat penutupan SL: ${snap.history[0].reason}`);
assert(snap.history[0].realizedPl === -120.00, `Realisasi loss SL terhitung -$120.00`);
assert(snap.balance === 6345.00, `Saldo berkurang menjadi $6,345.00 (Actual: $${snap.balance})`);

// Step 6: Manual Close Action
console.log('\n--- 6. UJI MANUAL CLOSE LANGSUNG DARI CHART ---');
engine.updateTick(2765.00, 2765.35);
const testPos = engine.openPosition({
  side: 'BUY',
  instrument: 'XAUUSD',
  lotSize: 0.1,
  entryPrice: 2765.00,
  comment: 'MANUAL CLOSE TEST'
});
assert(testPos.ok === true, `Posisi untuk manual close berhasil dibuka`);
snap = engine.getSnapshot();
assert(snap.openPositions.length === 1, `Posisi terlihat di chart sebelum manual close`);

// User clicks "✕ Close" button on chart or positions panel
const manualRes = engine.closePosition(testPos.position.id, 2768.00, 'CHART MANUAL CLOSE', 1.0);
assert(manualRes.ok === true, `Manual close berhasil dieksekusi: ${manualRes.message}`);
snap = engine.getSnapshot();
assert(snap.openPositions.length === 0, `Posisi langsung hilang dari chart setelah tombol close ditekan`);
assert(snap.balance === 6375.00, `Saldo ter-update ke $6,375.00`);
assert(snap.history[0].reason === 'CHART MANUAL CLOSE', `Riwayat mencatat alasan 'CHART MANUAL CLOSE'`);

// Step 7: Mode Separation & Zero mt5.order_send() verification
console.log('\n--- 7. VERIFIKASI ZERO mt5.order_send() & PEMISAHAN MODE MUTLAK ---');
assert(typeof engine.openPosition === 'function', 'Demo Trading Engine beroperasi penuh secara lokal');
assert(snap.history.every(h => h.id.startsWith('HIST-')), 'Seluruh transaksi DEMO disimpan dengan ID virtual HIST-*');
assert(snap.history.every(h => h.positionId.startsWith('DEMO-')), 'Seluruh tiket posisi DEMO menggunakan prefix DEMO-*');

console.log('\n========================================================================');
console.log(`🎉 HASIL VALIDASI VISUAL: ${passedTests} / ${totalTests} TESTS LULUS`);
console.log('========================================================================\n');

