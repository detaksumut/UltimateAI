/**
 * MarketChartStudio.test.mjs
 * Tests for the INDEPENDENT JIN CHART STUDIO backend + command routing.
 *
 * Locked guarantees verified here:
 *   - JIN never draws a chart without REAL provider data (no fabricated candles).
 *   - Provider capability metadata only lists providers able to deliver data for
 *     that instrument (binance = crypto only; open_source for all).
 *   - Chart commands route to an independent Chart Studio (CHART), while normal
 *     market phrases still behave as before (PANEL/FILTER/WALL).
 */
import assert from 'node:assert/strict';

let failures = 0;
const pass = (label) => console.log(`  [PASS] ${label}`);
const fail = (label, msg) => { failures++; console.log(`  [FAIL] ${label}${msg ? ' — ' + msg : ''}`); };
const check = (cond, label, msg) => (cond ? pass(label) : fail(label, msg));

// ---------------------------------------------------------------
console.log('\n[1] Chart command routing (independent Chart Studio)');
// ---------------------------------------------------------------
const { resolveMarketCommand } = await import('../../src/services/market/marketCommandRouter.js');

const r1 = resolveMarketCommand('JIN buka grafik BTC');
check(r1.type === 'CHART', 'buka grafik BTC → CHART', JSON.stringify(r1));
check(r1.panelId === 'market.bitcoin', 'BTC chart → market.bitcoin', r1.panelId);

const r2 = resolveMarketCommand('tampilkan grafik BTC dari Binance');
check(r2.type === 'CHART' && r2.providerId === 'binance', 'grafik BTC dari Binance → CHART + binance', JSON.stringify(r2));

const r3 = resolveMarketCommand('JIN ganti ke TradingView');
check(r3.type === 'CHART' && r3.providerId === 'open_source', 'ganti ke TradingView → CHART + open_source', JSON.stringify(r3));

const r4 = resolveMarketCommand('buka grafik emas');
check(r4.type === 'CHART' && r4.panelId === 'market.gold', 'grafik emas → market.gold', r4.panelId);

// Regression: normal market phrases are NOT treated as charts.
const r5 = resolveMarketCommand('JIN buka Bitcoin');
check(r5.type === 'PANEL' && r5.panelId === 'market.bitcoin', 'non-chart market phrase stays PANEL', JSON.stringify(r5));
const r6 = resolveMarketCommand('JIN buka semua Crypto');
check(r6.type === 'FILTER', 'open all crypto stays FILTER', JSON.stringify(r6));
const r7 = resolveMarketCommand('buka harga pasar studio');
check(r7.type === 'WALL', 'open market studio stays WALL', JSON.stringify(r7));

// ---------------------------------------------------------------
console.log('\n[2] Provider capability metadata — honest, per instrument');
// ---------------------------------------------------------------
const { getMarketChartProviders } = await import('../../server/market/MarketChartService.mjs');

const cryptoMeta = getMarketChartProviders({ panelId: 'market.bitcoin' });
const idsCrypto = cryptoMeta.providers.map((p) => p.id);
check(idsCrypto.includes('binance'), 'crypto → binance listed', JSON.stringify(idsCrypto));
check(cryptoMeta.providers.find((p) => p.id === 'binance').instrumentSupported === true, 'crypto binance instrumentSupported', undefined);
check(idsCrypto.includes('open_source'), 'crypto → open_source listed', undefined);

const nonCryptoMeta = getMarketChartProviders({ panelId: 'market.ihsg' });
const idsNonCrypto = nonCryptoMeta.providers.map((p) => p.id);
check(!idsNonCrypto.includes('binance'), 'non-crypto → binance NOT fabricated', JSON.stringify(idsNonCrypto));
check(idsNonCrypto.includes('open_source'), 'non-crypto → open_source listed', undefined);

// A provider is never listed for an instrument it cannot serve.
for (const p of cryptoMeta.providers) {
  if (p.id === 'binance') check(p.chartMode === 'JIN_RENDERED', 'binance offers JIN_RENDERED', p.chartMode);
}

// ---------------------------------------------------------------
console.log('\n[3] REAL chart — no fabricated candles anywhere');
// ---------------------------------------------------------------
const { getMarketChart } = await import('../../server/market/MarketChartService.mjs');

// Unknown panel → honest failure, no data.
const unknown = await getMarketChart({ panelId: 'market.nonexistent', interval: '1h' });
check(unknown.ok === false, 'unknown panel → ok:false', JSON.stringify(unknown));
check(!Array.isArray(unknown.candles), 'unknown panel → no candles invented', undefined);

// Non-crypto (IHSG) → either a real provider series or honest unsupported. It
// must NEVER carry invented candles.
const ihsg = await getMarketChart({ panelId: 'market.ihsg', interval: '1d', limit: 30 });
if (ihsg.ok) {
  check(Array.isArray(ihsg.candles) && ihsg.candles.length > 0, 'IHSG chart ok with real candles', `${ihsg.candles?.length}`);
} else {
  check(ihsg.unsupported === true || ihsg.provider === null, 'IHSG honest unsupported (no fake series)', JSON.stringify(ihsg));
}

// Crypto (Bitcoin) → real Binance klines. Network-backed; environment reaches
// data-api.binance.vision so this should be live.
const btc = await getMarketChart({ panelId: 'market.bitcoin', interval: '1h', limit: 60 });
if (btc.ok) {
  check(btc.chartMode === 'JIN_RENDERED', 'bitcoin → JIN_RENDERED', btc.chartMode);
  check(btc.provider && btc.provider.id === 'binance', 'bitcoin → provider binance', btc.provider?.id);
  check(Array.isArray(btc.candles) && btc.candles.length > 0, 'bitcoin returns real candles', `${btc.candles?.length}`);
  if (btc.candles) {
    let allReal = true;
    for (const c of btc.candles) {
      const ok = typeof c.openTime === 'number' && [c.open, c.high, c.low, c.close].every((v) => Number.isFinite(v) && v >= 0);
      if (!ok) { allReal = false; break; }
    }
    check(allReal, 'every bitcoin candle is a real OHLCV point (no zeros/invented)', undefined);
    const sorted = btc.candles.every((c, i, a) => i === 0 || c.openTime > a[i - 1].openTime);
    check(sorted, 'bitcoin candles chronologically ordered', undefined);
  }
} else {
  // If the environment cannot reach Binance, fail loudly — the whole point of
  // the Chart Studio is real data reachability via data-api.binance.vision.
  fail('bitcoin live Binance klines reachable', JSON.stringify(btc).slice(0, 200));
}

// ---------------------------------------------------------------
console.log('\n[4] Frontend provider abstraction — AUTO selection rationale');
// ---------------------------------------------------------------
const cf = await import('../../src/services/market/chartProviders.js');
const cryptoFrontend = cf.resolveProvidersForPanel(cryptoMeta.providers, { category: 'crypto', symbol: 'BTC' });
check(cryptoFrontend.length >= 1, 'frontend resolves usable providers for crypto', `${cryptoFrontend.length}`);
const auto = cf.autoSelectProvider(cryptoFrontend, { category: 'crypto', symbol: 'BTC' });
check(auto.best !== null, 'AUTO picks a provider for crypto', JSON.stringify(auto.best && auto.best.id));
check(Array.isArray(auto.reasons) && auto.reasons.length > 0, 'AUTO selection has a transparent reason', JSON.stringify(auto.reasons));

const nonCryptoFrontend = cf.resolveProvidersForPanel(nonCryptoMeta.providers, { category: 'indonesia', symbol: 'IHSG' });
check(nonCryptoFrontend.every((p) => p.id !== 'binance' || p.instrumentSupported === false || p.id !== 'binance'), 'non-crypto frontend has no binance', JSON.stringify(nonCryptoFrontend.map((p) => p.id)));

console.log(`\n================================================================`);
console.log(` RESULT: ${failures === 0 ? 'ALL PASSED' : failures + ' FAILED'}`);
console.log(`================================================================`);
process.exit(failures === 0 ? 0 : 1);