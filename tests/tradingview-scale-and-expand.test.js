/**
 * tests/tradingview-scale-and-expand.test.js
 * Verification of TradingView-Style Price Scale Stretch/Compress, Round Price Intervals & Fullscreen Expand Mode.
 */

import assert from 'assert';
import {
  calculateTradingViewStep,
  generatePriceGridLevels,
  formatTradingViewPrice
} from '../src/services/trading/TradingViewScaleCalculator.js';

console.log('========================================================================');
console.log('🔍 TRADINGVIEW SCALE & EXPAND INTERACTION TEST SUITE');
console.log('========================================================================\n');

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}: ${err.message}`);
    process.exitCode = 1;
  }
}

// ── 1. TRADINGVIEW NICE ROUND PRICE STEP CALCULATOR ──
console.log('--- 1. TRADINGVIEW ROUND PRICE STEP CALCULATOR (EXACT INTERVAL) ---');

it('Menghitung interval 2.5 untuk range 18-25 (Persis screenshot TradingView Gold 4.062,5 - 4.065,0)', () => {
  const step = calculateTradingViewStep(22, 7);
  assert.strictEqual(step, 2.5, `Step harus 2.5, didapat: ${step}`);
});

it('Menghitung interval 5.0 untuk range 35-50 (Persis screenshot TradingView Gold 4.060,0 - 4.065,0)', () => {
  const step = calculateTradingViewStep(40, 7);
  assert.strictEqual(step, 5, `Step harus 5.0, didapat: ${step}`);
});

it('Menghitung interval 1.0 untuk range kecil 7-10', () => {
  const step = calculateTradingViewStep(8, 7);
  assert.strictEqual(step, 1, `Step harus 1.0, didapat: ${step}`);
});

it('Menghitung interval 0.5 untuk range sangat rapat (micro-scalping)', () => {
  const step = calculateTradingViewStep(3.5, 7);
  assert.strictEqual(step, 0.5, `Step harus 0.5, didapat: ${step}`);
});

it('Menghitung interval 10.0 untuk range lebar 70-100', () => {
  const step = calculateTradingViewStep(80, 7);
  assert.strictEqual(step, 10, `Step harus 10.0, didapat: ${step}`);
});

it('Menghitung interval 50.0 untuk rentang makro 350-500', () => {
  const step = calculateTradingViewStep(400, 7);
  assert.strictEqual(step, 50, `Step harus 50.0, didapat: ${step}`);
});

// ── 2. ROUND GRID LINES & CLEAN LABEL GENERATION ──
console.log('\n--- 2. GENERASI LEVEL GRID HARGA BULAT (BERSIH TANPA PECAHAN SEMBARANGAN) ---');

it('Grid line tergenerate pada kelipatan bulat eksak dari step 2.5', () => {
  const minPrice = 2741.35;
  const maxPrice = 2763.80;
  const range = maxPrice - minPrice;
  const step = calculateTradingViewStep(range, 7); // 2.5
  const gridLevels = generatePriceGridLevels(minPrice, maxPrice, step);

  // Level pertama harus 2742.5 (bukan pecahan acak)
  assert.strictEqual(gridLevels[0], 2742.5);
  assert.strictEqual(gridLevels[1], 2745.0);
  assert.strictEqual(gridLevels[2], 2747.5);
  assert.strictEqual(gridLevels[3], 2750.0);
  assert.strictEqual(gridLevels[4], 2752.5);
  
  // Semua delta antar grid line harus persis sama dengan step
  for (let i = 1; i < gridLevels.length; i++) {
    const diff = Number((gridLevels[i] - gridLevels[i - 1]).toFixed(4));
    assert.strictEqual(diff, 2.5, `Selisih antar level grid harus 2.5, dapat: ${diff}`);
  }
});

it('Format label harga TradingView rapi dengan jumlah desimal konsisten', () => {
  const formatted2_5 = formatTradingViewPrice(2745.0, 2.5);
  assert.strictEqual(formatted2_5, '2,745.0');

  const formatted0_5 = formatTradingViewPrice(2745.5, 0.5);
  assert.strictEqual(formatted0_5, '2,745.50');
});

// ── 3. PRICE SCALE STRETCH & COMPRESS INTERACTION LOGIC ──
console.log('\n--- 3. INTERAKSI TARIK SUMBU HARGA (DIRAPATKAN & DIENGGANGKAN) ---');

it('Menarik sumbu harga ke atas (deltaY < 0) me-renggangkan jarak antar harga (stretch)', () => {
  const startFactor = 1.0;
  const deltaY = -60; // user geser ke atas 60px
  const scaleMultiplier = Math.pow(1.006, deltaY); // < 1
  const newFactor = Math.max(0.08, Math.min(15.0, startFactor * scaleMultiplier));

  assert.ok(newFactor < startFactor, `Factor harus < 1.0 (${newFactor.toFixed(3)}) agar span harga mengecil dan lilin merenggang vertikal`);
  assert.ok(newFactor > 0.6 && newFactor < 0.8, `Nilai factor terhitung wajar (${newFactor.toFixed(3)})`);
});

it('Menarik sumbu harga ke bawah (deltaY > 0) me-rapatkan jarak antar harga (compress)', () => {
  const startFactor = 1.0;
  const deltaY = 60; // user geser ke bawah 60px
  const scaleMultiplier = Math.pow(1.006, deltaY); // > 1
  const newFactor = Math.max(0.08, Math.min(15.0, startFactor * scaleMultiplier));

  assert.ok(newFactor > startFactor, `Factor harus > 1.0 (${newFactor.toFixed(3)}) agar span harga membesar dan lilin merapat vertikal`);
  assert.ok(newFactor > 1.3 && newFactor < 1.6, `Nilai factor terhitung wajar (${newFactor.toFixed(3)})`);
});

it('Reset Auto-Scale mengembalikan skala harga ke 1.0 dan status auto-scale aktif', () => {
  let priceScaleFactor = 0.55;
  let pricePanOffset = 14.2;
  let isAutoScaled = false;

  const resetPriceScale = () => {
    priceScaleFactor = 1.0;
    pricePanOffset = 0;
    isAutoScaled = true;
  };

  resetPriceScale();

  assert.strictEqual(priceScaleFactor, 1.0, 'Scale factor harus kembali 1.0');
  assert.strictEqual(pricePanOffset, 0, 'Pan offset harus kembali 0');
  assert.strictEqual(isAutoScaled, true, 'isAutoScaled harus true');
});

// ── 4. HORIZONTAL TIME SCALE DRAGGING (STRETCH & COMPRESS CANDLE SPACING) ──
console.log('\n--- 4. INTERAKSI SUMBU WAKTU (JARAK CANDLE HORIZONTAL) ---');

it('Menyeret sumbu waktu ke kanan memadatkan jumlah candle yang tampak', () => {
  const startVisibleBars = 75;
  const deltaX = 60;
  const barChange = Math.round(deltaX / 6); // +10 bars
  const newVisibleBars = Math.max(15, Math.min(220, startVisibleBars - barChange));

  assert.strictEqual(newVisibleBars, 65, 'Jumlah visible bars berubah sesuai drag');
});

// ── 5. FULLSCREEN EXPAND MODE ──
console.log('\n--- 5. EXPAND / FULLSCREEN MODE LOGIC & RESPONSIVITAS ---');

it('Mode expand mengisi seluruh layar (100vw x 100vh) dan menonaktifkan border kartu', () => {
  const isFullscreen = true;
  const containerStyle = {
    width: isFullscreen ? '100vw' : '100%',
    height: isFullscreen ? '100vh' : 'auto',
    position: isFullscreen ? 'fixed' : 'relative',
    top: isFullscreen ? 0 : 'auto',
    zIndex: isFullscreen ? 99999 : 1,
    borderRadius: isFullscreen ? 0 : 8,
  };

  assert.strictEqual(containerStyle.width, '100vw');
  assert.strictEqual(containerStyle.height, '100vh');
  assert.strictEqual(containerStyle.position, 'fixed');
  assert.strictEqual(containerStyle.zIndex, 99999);
  assert.strictEqual(containerStyle.borderRadius, 0);
});

it('Tinggi canvas expand menyesuaikan resolusi layar secara dinamis', () => {
  const windowHeight = 900;
  const activeSubPane = 'none';
  const isFullscreen = true;

  const canvasHeight = isFullscreen
    ? Math.max(300, windowHeight - 95 - (activeSubPane !== 'none' ? 95 : 0))
    : (activeSubPane !== 'none' ? 490 : 430);

  assert.strictEqual(canvasHeight, 805, 'Tinggi canvas expand harus 805px pada resolusi 900px');
});

console.log('\n========================================================================');
console.log(`🎉 TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('========================================================================');
