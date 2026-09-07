/**
 * MarketIntentRouting.test.mjs
 * Tests for the MARKET_DATA intent-routing fix.
 *
 * Acceptance criteria:
 *   Market commands ("CEK HARGA BTC HARI INI", "TAMPILKAN GRAFIK BTC", "HARGA EMAS
 *   SEKARANG", "PERGERAKAN IHSG HARI INI") MUST route to the Market Data engine
 *   (ROUTER: MARKET_DATA_ENGINE / tool market.data) and MUST NEVER route to generic
 *   web.search / YouTube / video.
 *
 *   News/video requests (BERITA BTC, CARIKAN VIDEO ANALISIS BTC) and educational
 *   questions (APA ITU BITCOIN) must NOT be captured by the market override.
 */
import { classifyMarketIntent } from '../../server/market/marketIntentRouter.mjs';
import { SemanticIntentEngine } from '../../server/agent/SemanticIntentEngine.mjs';

let failures = 0;
const pass = (label) => console.log(`  [PASS] ${label}`);
const fail = (label, msg) => { failures++; console.log(`  [FAIL] ${label}${msg ? ' -> ' + msg : ''}`); };
const check = (cond, label, msg) => (cond ? pass(label) : fail(label, msg));

const engine = new SemanticIntentEngine();

// ---------------------------------------------------------------
console.log('\n[1] Router classifier: market commands -> MARKET_DATA_ENGINE');
// ---------------------------------------------------------------
const routerCases = [
  ['CEK HARGA BTC HARI INI', 'BTC'],
  ['TAMPILKAN GRAFIK BTC', 'BTC'],
  ['HARGA EMAS SEKARANG', 'XAU/USD'],
  ['PERGERAKAN IHSG HARI INI', 'IHSG']
];
for (const [utterance, instrument] of routerCases) {
  const r = classifyMarketIntent(utterance);
  check(Boolean(r && r.captured), `captured: '${utterance}'`, r && r.reason);
  check(r && r.intent === 'MARKET_DATA', `MARKET_DATA intent: '${utterance}'`);
  check(r && r.route && r.route.engine === 'MARKET_DATA_ENGINE', `router=MARKET_DATA_ENGINE: '${utterance}'`);
  check(r && r.instrument === instrument, `instrument=${instrument}: '${utterance}'`, r && r.instrument);
  check(r && Array.isArray(r.toolsNeeded) && !r.toolsNeeded.includes('web.search') && r.toolsNeeded.includes('market.data'), `tool=market.data (NOT web.search): '${utterance}'`, r && JSON.stringify(r.toolsNeeded));
  check(r && r.routingError === false, `no routing error: '${utterance}'`);
}

// ---------------------------------------------------------------
console.log('\n[2] Router classifier: news/video NOT captured as market');
// ---------------------------------------------------------------
const notMarket = classifyMarketIntent('CARIKAN VIDEO ANALISIS BTC');
check(Boolean(notMarket && notMarket.captured === false), 'video analysis BTC NOT captured as market');
check(Boolean(notMarket && notMarket.redirectedTo), 'redirects to a non-market engine', notMarket && notMarket.redirectedTo);
const notMarket2 = classifyMarketIntent('BERITA BTC TERBARU');
check(Boolean(notMarket2 && notMarket2.captured === false), 'news BTC NOT captured as market');
check(classifyMarketIntent('APA ITU BITCOIN') === null, 'educational question NOT routed to market');
check(classifyMarketIntent('JELASKAN TENTANG CRYPTO') === null, 'explain crypto NOT routed to market');

// ---------------------------------------------------------------
console.log('\n[3] Engine integration: interpret() honors MARKET_DATA override');
// ---------------------------------------------------------------
const outcome = await engine.interpret('CEK HARGA BTC HARI INI');
check(outcome.intent === 'MARKET_DATA', 'engine intent = MARKET_DATA', outcome.intent);
check(Array.isArray(outcome.toolsNeeded) && JSON.stringify(outcome.toolsNeeded).includes('market.data') && !JSON.stringify(outcome.toolsNeeded).includes('web.search'), 'engine tool = market.data, never web.search', JSON.stringify(outcome.toolsNeeded));
check(outcome.interpretationSource === 'MARKET_DATA_CLASSIFIER', 'interpretation source = MARKET_DATA_CLASSIFIER', outcome.interpretationSource);
check(outcome.instrument === 'BTC', 'engine instrument = BTC', outcome.instrument);

// Chart sub-intent must be preserved.
const chartOutcome = await engine.interpret('TAMPILKAN GRAFIK BTC');
check(chartOutcome.intent === 'MARKET_DATA' && chartOutcome.subIntent === 'chart', 'chart request -> MARKET_DATA/chart', `${chartOutcome.intent}/${chartOutcome.subIntent}`);

const emas = await engine.interpret('HARGA EMAS SEKARANG');
check(emas.intent === 'MARKET_DATA' && emas.instrument === 'XAU/USD', 'emas -> MARKET_DATA XAU/USD', `${emas.intent}/${emas.instrument}`);

const ihsg = await engine.interpret('PERGERAKAN IHSG HARI INI');
check(ihsg.intent === 'MARKET_DATA' && ihsg.instrument === 'IHSG', 'IHSG -> MARKET_DATA IHSG', `${ihsg.intent}/${ihsg.instrument}`);

// Video/news requests must NOT become MARKET_DATA through the engine.
const video = await engine.interpret('CARIKAN VIDEO ANALISIS BTC');
check(video.intent !== 'MARKET_DATA', 'video request NOT routed to MARKET_DATA', video.intent);
const berita = await engine.interpret('BERITA BTC TERBARU');
check(berita.intent !== 'MARKET_DATA', 'news request NOT routed to MARKET_DATA', berita.intent);

// Visible activity trace fields present on the routed decision.
check(Boolean(outcome.route && outcome.route.engine === 'MARKET_DATA_ENGINE'), 'decision carries ROUTER: MARKET_DATA_ENGINE');
check(Boolean(outcome.route && outcome.route.source), 'decision carries SOURCE label', outcome.route && outcome.route.source);

console.log(`\n================================================================`);
console.log(` RESULT: ${failures === 0 ? 'ALL PASSED' : failures + ' FAILED'}`);
console.log(`================================================================`);
process.exit(failures === 0 ? 0 : 1);
