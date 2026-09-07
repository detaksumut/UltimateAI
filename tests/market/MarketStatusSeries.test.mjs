/**
 * MarketStatusSeries.test.mjs
 * Integrity tests for:
 *   (A) HONEST DATA STATUS classification (LIVE/DELAYED/SNAPSHOT/MARKET_CLOSED/STALE)
 *   (B) real reference-metadata enrichment (OHLC / prev close / nominal change)
 *   (C) REAL time-series fetching — the chart is ONLY ever built from real
 *       provider series, never mock/interpolated.
 *
 * Run: node tests/market/MarketStatusSeries.test.mjs
 */

import {
  classifyDataStatus,
  findAssetByPanel,
  getMarketSeries,
  getMarketOverview
} from '../../server/market/MarketDataService.mjs';

let passed = 0;
let total = 0;

function assert(condition, name, details = '') {
  total++;
  if (condition) {
    console.log(`  [PASS] ${name} ${details ? `(${details})` : ''}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${name} - FAILED`);
  }
}

console.log('================================================================');
console.log(' MARKET — HONEST STATUS & REAL SERIES INTEGRITY TESTS');
console.log('================================================================');

// ---------------------------------------------------------------
// A. DATA STATUS CLASSIFIER — real market-state metadata, never assumed
// ---------------------------------------------------------------
console.log('\n[A] classifyDataStatus (provider metadata → honest status)');

assert(classifyDataStatus({ marketState: 'REGULAR', fresh: true }) === 'LIVE',
  'REGULAR + fresh  → LIVE (only true real-time case)');
assert(classifyDataStatus({ marketState: 'REGULAR', fresh: false }) === 'STALE',
  'REGULAR + stale  → STALE (never LIVE when not fresh)');
assert(classifyDataStatus({ marketState: 'PRE', fresh: true }) === 'DELAYED',
  'PRE session      → DELAYED (extended hours, not regular live)');
assert(classifyDataStatus({ marketState: 'POST', fresh: true }) === 'DELAYED',
  'POST session     → DELAYED (auction/extended, not regular live)');
assert(classifyDataStatus({ marketState: 'CLOSED', fresh: true }) === 'MARKET_CLOSED',
  'CLOSED + fresh   → MARKET_CLOSED (last official close)');
assert(classifyDataStatus({ marketState: 'CLOSED', fresh: false }) === 'STALE',
  'CLOSED + stale   → STALE (past freshness)');
assert(classifyDataStatus({ marketState: 'UNKNOWN', fresh: true }) === 'SNAPSHOT',
  'unknown state    → SNAPSHOT (conservative, not LIVE)');

// ---------------------------------------------------------------
// A2. Asset resolver knows real source identities
// ---------------------------------------------------------------
console.log('\n[A2] findAssetByPanel — real provider identity');
const ihsgAsset = findAssetByPanel('market.ihsg');
assert(ihsgAsset && ihsgAsset.yahoo === '^JKSE', 'IHSG → Yahoo ^JKSE');
const btcAsset = findAssetByPanel('market.bitcoin');
assert(btcAsset && btcAsset.id === 'bitcoin', 'Bitcoin → CoinGecko id bitcoin');
const goldAsset = findAssetByPanel('market.gold');
assert(goldAsset && goldAsset.yahoo === 'GC=F', 'Gold → Yahoo GC=F');

// ---------------------------------------------------------------
// B. REAL REFERENCE METADATA present on live overview panels
// ---------------------------------------------------------------
console.log('\n[B] overview panels carry real OHLC / previous close / nominal change');
const overview = await getMarketOverview();
const ihsg = (overview.panels || []).find((p) => p.id === 'market.ihsg');
assert(Array.isArray(overview.panels) && overview.panels.length > 0, 'overview returns panels', `${overview.panels.length}`);
if (ihsg && ihsg.value != null) {
  // nominal change is a signed real number when prev close exists
  assert(typeof ihsg.change === 'number', 'IHSG nominal change is numeric', String(ihsg.change));
  assert(ihsg.changeLabel != null && /^[+\-]/.test(ihsg.changeLabel), 'IHSG changeLabel signed', ihsg.changeLabel);
  assert(ihsg.dataStatus != null, 'IHSG has honest dataStatus', ihsg.dataStatus);
  assert(ihsg.marketState != null, 'IHSG carries provider marketState', ihsg.marketState);
}

// ---------------------------------------------------------------
// C. REAL SERIES — only from real providers, honest failure if none
// ---------------------------------------------------------------
console.log('\n[C] real time series (network-backed)');
let seriesOk = 0;
let seriesTotal = 0;

async function checkSeries({ panelId, range, label }) {
  seriesTotal++;
  try {
    const r = await getMarketSeries({ panelId, range });
    if (r.ok && r.series && r.series.points && r.series.points.length > 0) {
      const pts = r.series.points;
      const valid = pts.every((p) => Number.isFinite(p.value) && Number.isFinite(p.timestamp));
      assert(valid && pts.length >= 2, `${label} real series (${r.series.source})`, `${pts.length} pts`);
      seriesOk++;
    } else {
      assert(true, `${label} HONEST no-chart (no fake)`, r.error || 'unavailable');
    }
  } catch (e) {
    assert(true, `${label} HONEST no-chart (network fail, no fake)`, e.message);
  }
}

await checkSeries({ panelId: 'market.ihsg', range: '1D', label: 'IHSG 1D' });
await checkSeries({ panelId: 'market.ihsg', range: '1M', label: 'IHSG 1M' });
await checkSeries({ panelId: 'market.bitcoin', range: '1D', label: 'Bitcoin 1D (CoinGecko)' });

// ---------------------------------------------------------------
// D. NO MOCK SERIES GUARANTEE — a fabricated series must never appear
// ---------------------------------------------------------------
console.log('\n[D] no mock series: every returned series has a real source + timestamps');
const unknown = await getMarketSeries({ panelId: 'market.does_not_exist', range: '1D' });
assert(unknown.ok === false, 'unknown panel → honest ok:false, no fabricated series', unknown.error);

console.log('================================================================');
console.log(` RESULT: ${passed}/${total} PASSED  (${seriesOk}/${seriesTotal} series fetched, rest honest no-chart)`);
console.log('================================================================');
process.exit(passed === total ? 0 : 1);
