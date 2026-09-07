/**
 * MarketRowWallIntegrity.test.mjs
 * Integrity + routing test for the HARGA PASAR STUDIO MARKET INTELLIGENCE ROW WALL.
 *
 * Guards the core rule: SOURCE → DATA → VERIFICATION → FACTS → JIN SUMMARY → PANEL.
 * Never AI → fake number → fake VERIFIED.
 *
 * Run: node tests/market/MarketRowWallIntegrity.test.mjs
 */

import { resolveMarketCommand } from '../../src/services/market/marketCommandRouter.js';
import { arrangeRows, filterPanels, ROW_DEFS } from '../../src/services/market/MarketPanelRegistry.js';

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
console.log(' MARKET ROW WALL — INTEGRITY & ROUTING TESTS');
console.log('================================================================');

// ---------------------------------------------------------------
// 1. VOICE / CLICK share the SAME command router → same market.<id>
// ---------------------------------------------------------------
console.log('\n[1] Command router: voice === click destination');
const routerCases = [
  ['JIN buka Harga Emas', 'market.gold'],
  ['JIN buka Bitcoin', 'market.bitcoin'],
  ['JIN buka Bank Indonesia', 'market.bi_rate'],
  ['JIN buka IHSG', 'market.ihsg'],
  ['JIN buka USD/IDR', 'market.usd_idr'],
  ['click Gold', 'market.gold'],
  ['click Bitcoin', 'market.bitcoin']
];
routerCases.forEach(([input, expected]) => {
  const r = resolveMarketCommand(input);
  assert(r.type === 'PANEL' && r.panelId === expected, `"${input}" → market.<id>`, `got ${r.panelId}`);
});

// WALL / FILTER routes
const filterCase = resolveMarketCommand('JIN buka semua Crypto');
assert(filterCase.type === 'FILTER' && filterCase.filterId === 'crypto', 'open all crypto → wall filter crypto');
const wallCase = resolveMarketCommand('buka harga pasar studio');
assert(wallCase.type === 'WALL', 'open harga pasar studio → wall');

// ---------------------------------------------------------------
// 2. Integrity: a panel must NEVER carry a value without a source
// ---------------------------------------------------------------
console.log('\n[2] NO SOURCE = NO FACT (registry/arrange contract)');
const samplePanels = [
  { id: 'market.gold', name: 'Gold', symbol: 'XAU/USD', category: 'metals', priority: true, verificationStatus: 'VERIFIED', value: '4485.90', source: 'Yahoo' },
  { id: 'market.bitcoin', name: 'Bitcoin', symbol: 'BTC', category: 'crypto', priority: true, verificationStatus: 'VERIFIED', value: '78655', source: 'CoinGecko' },
  { id: 'market.usd_idr', name: 'USD/IDR', symbol: 'USD/IDR', category: 'currency', priority: true, verificationStatus: 'UNAVAILABLE', value: null, source: null },
  { id: 'market.ihsg', name: 'IHSG', symbol: 'IHSG', category: 'indonesia', priority: true, verificationStatus: 'VERIFIED', value: '6578', source: 'Yahoo' },
  { id: 'market.copper', name: 'Copper', symbol: 'COPPER', category: 'metals', priority: false, verificationStatus: 'UNAVAILABLE', value: null, source: null },
  { id: 'market.wti', name: 'WTI', symbol: 'WTI', category: 'energy', priority: true, verificationStatus: 'VERIFIED', value: '86.71', source: 'Yahoo' }
];
samplePanels.forEach((p) => {
  assert(!(p.value != null && !p.source), `value⇒source invariant for ${p.id}`);
  assert(!(p.verificationStatus === 'VERIFIED' && (p.value == null || !p.source)), `VERIFIED completeness for ${p.id}`);
  assert(!(p.verificationStatus === 'UNAVAILABLE' && p.value != null), `UNAVAILABLE must not carry a fake value for ${p.id}`);
});

// ---------------------------------------------------------------
// 3. Row arrangement — Indonesia Vitals prioritized, no fabricated rows
// ---------------------------------------------------------------
console.log('\n[3] Row arrangement & filters');
const rows = arrangeRows(samplePanels);
assert(rows[0].id === 'indonesia', 'Indonesia Vitals is first/highest priority row', `got ${rows[0].id}`);
const indonesiaRow = rows.find((r) => r.id === 'indonesia');
assert(indonesiaRow && indonesiaRow.members.some((m) => m.id === 'market.ihsg'), 'IHSG present in Indonesia Vitals');
const priorityRow = rows.find((r) => r.id === 'priority');
assert(priorityRow && priorityRow.members.length === 5, 'Priority row lists exactly priority instruments', `${priorityRow?.members.length}`);
assert(filterPanels(samplePanels, 'crypto').length === 1, 'crypto filter returns only crypto', `${filterPanels(samplePanels, 'crypto').length}`);
assert(ROW_DEFS.length >= 9, 'at least 9 named rows defined', `${ROW_DEFS.length}`);

// ---------------------------------------------------------------
// 4. Server service integrity (live source, no mock price)
// ---------------------------------------------------------------
console.log('\n[4] Server MarketDataService — source-grounded, no mock numbers');
const svc = await import('../../server/market/MarketDataService.mjs');
const ov = await svc.getMarketOverview();
assert(ov.service === 'MARKET_PRICE_STUDIO', 'service flag is MARKET_PRICE_STUDIO');
assert(Array.isArray(ov.panels), 'returns panels array');
assert(ov.counts.total === ov.panels.length, 'counts.total matches panels length', `${ov.counts.total}/${ov.panels.length}`);
let violations = 0;
for (const p of ov.panels) {
  if (p.value != null && !p.source) violations++;
  if (p.verificationStatus === 'VERIFIED' && (p.value == null || !p.source)) violations++;
  if ((p.verificationStatus === 'UNAVAILABLE' || p.verificationStatus === 'FAILED') && p.value != null) violations++;
}
assert(violations === 0, 'zero integrity violations across all live panels', `${violations}`);
const uniqueIds = new Set(ov.panels.map((p) => p.id)).size;
assert(uniqueIds === ov.panels.length, 'all panel ids unique', `${uniqueIds}/${ov.panels.length}`);
assert(ov.counts.verified === ov.counts.ready, 'verified === ready count semantics');

console.log('================================================================');
console.log(` RESULT: ${passed}/${total} passed`);
console.log('================================================================');
if (passed !== total) process.exit(1);
