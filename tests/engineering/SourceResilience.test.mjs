/**
 * SourceResilience.test.mjs
 * Tests for the JIN PERSISTENT INTELLIGENCE & SOURCE RESILIENCE PROTOCOL.
 *
 * Golden rules asserted here:
 *   ONE FAILURE IS NOT A CONCLUSION.
 *   UNREACHABLE IS NOT THE SAME AS UNAVAILABLE.
 *   FIRST PAGE IS NOT THE WHOLE DATASET.
 *   NO DATA MUST NEVER BE REPLACED WITH FAKE DATA.
 *   JIN MUST KNOW WHY A RETRIEVAL FAILED BEFORE DECIDING WHAT TO TRY NEXT.
 */
import {
  classifyError, deriveHonestState, createPersistentEngine, detectPagination,
  FAILURE_TYPES, HONEST_STATES, SEARCH_STATES
} from '../../src/services/engineering/sourceResilienceEngine.js';

let failures = 0;
const pass = (label) => console.log(`  [PASS] ${label}`);
const fail = (label, msg) => { failures++; console.log(`  [FAIL] ${label}${msg ? ' — ' + msg : ''}`); };
const check = (cond, label, msg) => (cond ? pass(label) : fail(label, msg));

// ---------------------------------------------------------------
console.log('\n[1] Failure diagnosis engine — every failure is classified');
// ---------------------------------------------------------------
check(classifyError(new Error('fetch failed net ERR_INTERNET_DISCONNECTED')).type === FAILURE_TYPES.NETWORK_ERROR, 'network failure diagnosed', undefined);
check(classifyError({ code: 'AbortError' }).type === FAILURE_TYPES.TIMEOUT, 'timeout (abort) diagnosed', undefined);
check(classifyError(new Error('x'), 403).type === FAILURE_TYPES.HTTP_403, 'HTTP 403 diagnosed as blocked', undefined);
check(classifyError(new Error('x'), 404).type === FAILURE_TYPES.HTTP_404, 'HTTP 404 diagnosed as not-found → deepen, not "data absent"', undefined);
check(classifyError(new Error('x'), 429).type === FAILURE_TYPES.HTTP_429, 'HTTP 429 diagnosed as rate limited', undefined);
check(classifyError(new Error('x'), 503).type === FAILURE_TYPES.HTTP_5XX, 'HTTP 5xx diagnosed as temporary provider failure', undefined);
check(classifyError(new Error('unavailable in your region')).type === FAILURE_TYPES.GEOGRAPHIC_RESTRICTION, 'geo restriction diagnosed', undefined);
check('strategy' in classifyError(new Error('anything unknown')), 'every failure carries a next-action strategy', undefined);

// ---------------------------------------------------------------
console.log('\n[2] Honest data-state rules — NEVER fabricate LIVE');
// ---------------------------------------------------------------
// Live stream active AND within freshness → LIVE.
check(deriveHonestState({ liveStreamActive: true, freshnessMs: 10000, lastUpdate: Date.now() - 1000 }) === HONEST_STATES.LIVE, 'active stream + fresh → LIVE', undefined);
// No active stream (REST), even if fresh → NOT LIVE (SNAPSHOT).
check(deriveHonestState({ liveStreamActive: false, freshnessMs: 10000, lastUpdate: Date.now() - 1000, dataSource: 'SNAPSHOT' }) === HONEST_STATES.SNAPSHOT, 'no active stream → SNAPSHOT, never LIVE', undefined);
// Stream dead / stale → STALE, not LIVE.
check(deriveHonestState({ liveStreamActive: false, freshnessMs: 1000, lastUpdate: Date.now() - 50000, dataSource: 'SNAPSHOT' }) === HONEST_STATES.STALE, 'stale data → STALE, never LIVE', undefined);
check(deriveHonestState({ liveStreamActive: false, dataSource: 'CACHED' }) === HONEST_STATES.CACHED, 'cached → CACHED', undefined);
check(deriveHonestState({ liveStreamActive: false, freshnessMs: null }) === HONEST_STATES.UNKNOWN, 'no freshness → UNKNOWN (belum terverifikasi)', undefined);
// Pagination detection: first page indicator must flag more data.
check(detectPagination('Page 1 of 7') === true, 'pagination indicator "Page 1 of 7" detected', undefined);
check(detectPagination('article list') === false, 'no pagination indicator → not treated as more', undefined);

// ---------------------------------------------------------------
console.log('\n[3] Scenario 1+4 — pagination: first page is NOT the whole dataset');
// ---------------------------------------------------------------
// Target 35. First accessor returns 5 (page 1), second returns 30 (page 2).
let engine1 = createPersistentEngine({ label: '35 articles' });
let r1 = await engine1.search({
  target: 'Temukan 35 artikel',
  expectedCount: 35,
  accessors: [
    { id: 'p1', name: 'Page 1', run: async () => Array.from({ length: 5 }) },
    { id: 'p2', name: 'Page 2', run: async () => Array.from({ length: 30 }) }
  ],
  validate: (d) => Array.isArray(d),
  extract: (d) => ({ payload: d, count: d.length })
});
check(r1.complete === true, 'continues past page 1 to reach 35/35', `${r1.foundCount}/35`);
check(r1.foundCount === 35, 'foundCount = 35 after both pages', `${r1.foundCount}`);
check(r1.report.sourcesAttempted.length === 2, 'both pages traversed (no stop at page 1)', `${r1.report.sourcesAttempted.length}`);
check(r1.sourcesAttempted.some((s) => s.ok && s.validated), 'page 2 reached & validated', JSON.stringify(r1.sourcesAttempted));

// Only 5 available → JIN must NOT declare COMPLETE; reports honest partial 5/35.
let engine2 = createPersistentEngine({ label: 'partial' });
let r2 = await engine2.search({
  target: 'Temukan 35 artikel',
  expectedCount: 35,
  accessors: [
    { id: 'p1', name: 'Page 1', run: async () => Array.from({ length: 5 }) },
    { id: 'p2', name: 'Page 2', run: async () => { throw new Error('no more pages (404)'); } },
    { id: 'p3', name: 'Page 3', run: async () => { throw new Error('fetch failed'); } }
  ],
  validate: (d) => Array.isArray(d),
  extract: (d) => ({ payload: d, count: d.length })
});
check(r2.complete === false, 'does NOT declare complete at 5/35', `${r2.foundCount}/35`);
check(r2.foundCount === 5, 'honest partial count 5/35 reported', `${r2.foundCount}`);
check(r2.partial === true, 'partial flag set (incomplete target)', undefined);
check(/belum terpenuhi/.test(r2.report.whyStopped), 'whyStopped says target incomplete, not "data absent"', r2.report.whyStopped);

// No expected count + first valid page → completes with that page (leaf result).
let engine3 = createPersistentEngine({});
let r3 = await engine3.search({
  target: 'single lookup',
  accessors: [{ id: 'a', name: 'Primary', run: async () => 'ok' }],
  validate: () => true,
  extract: (d) => d
});
check(r3.complete === true && r3.found === 'ok', 'no-target leaf lookup completes', undefined);

// ---------------------------------------------------------------
console.log('\n[4] Scenario 2+5 — primary fails → diagnose → resilient alternative');
// ---------------------------------------------------------------
// Primary blocked (403), alternative credible succeeds. JIN must not say "not found".
let engine4 = createPersistentEngine({ label: 'market' });
let r4 = await engine4.search({
  target: 'harga emas hari ini',
  accessors: [
    { id: 'a', name: 'Primary (binance)', run: async () => { const e = new Error('Forbidden'); e.status = 403; throw e; } },
    { id: 'b', name: 'Alternative credible', run: async () => ({ price: '4485.90', source: 'Yahoo' }) }
  ],
  validate: (d) => !!d && d.source,
  extract: (d) => d,
  summaryOfFound: (d) => `harga emas ${d.price} (${d.source})`
});
check(r4.complete === true, 'primary 403 did not end the search — alternative delivered', undefined);
check(r4.sourcesAttempted[0].ok === false && r4.sourcesAttempted[0].diagnosis.type === FAILURE_TYPES.HTTP_403, 'primary failure was diagnosed as 403/blocked', JSON.stringify(r4.sourcesAttempted[0].diagnosis));
check(r4.sourcesAttempted[1].ok === true && r4.sourcesAttempted[1].validated, 'alternative was reached & validated', undefined);
check(r4.networkFallbackUsed === false, 'no network profile needed here', undefined);

// ALL paths genuinely fail → honest EXHAUSTED with what/why/next (never "not found").
let engine5 = createPersistentEngine({ label: 'exhausted' });
let r5 = await engine5.search({
  target: 'data yang tidak ada di mana pun',
  accessors: [
    { id: 'a', name: 'Primary', run: async () => { throw new Error('fetch failed'); } },
    { id: 'b', name: 'Alt host', run: async () => { throw new Error('HTTP 503'); } },
    { id: 'c', name: 'Deep search', run: async () => { throw new Error('404 not found'); } }
  ],
  validate: () => true,
  extract: (d) => d,
  summaryOfMissing: 'tidak dapat diverifikasi',
  suggestNext: 'periksa sumber kredensial lain / coba lagi nanti'
});
check(r5.exhausted === true, 'all paths exhausted → EXHAUSTED', undefined);
check(r5.found === null, 'exhausted → no fabricated payload (no mock)', undefined);
check(r5.report.sourcesAttempted.length === 3, 'reports every path attempted', `${r5.report.sourcesAttempted.length}`);
check(r5.report.whatWasNotFound && /tidak dapat diverifikasi/.test(r5.report.whatWasNotFound), 'distinguishes "not found" as honestly unverified', r5.report.whatWasNotFound);
check(!!r5.report.whyStopped && !!r5.report.nextAction, 'final report has whyStopped + nextAction (protocol XV)', undefined);

// ---------------------------------------------------------------
console.log('\n[5] Network fallback — on-demand, temporary, transparent');
// ---------------------------------------------------------------
// Configured alternate network: primary geo-blocked → temporary alternate route.
let engine6 = createPersistentEngine({
  label: 'geo',
  networkProfiles: { enabled: ['DIRECT', 'ALTERNATE_NETWORK'], order: ['DIRECT', 'ALTERNATE_NETWORK'], active: 'DIRECT' }
});
let r6 = await engine6.search({
  target: 'geo-block feature',
  accessors: [
    {
      id: 'a', name: 'Primary',
      // Direct route is geo-blocked; the temporary alternate network route succeeds.
      run: (() => { let calls = 0; return async () => { calls += 1; if (calls === 1) { const e = new Error('unavailable in your region'); throw e; } return 'metric-bandwidth-ok'; }; })()
    }
  ],
  validate: (d) => !!d,
  extract: (d) => d
});
check(r6.networkFallbackUsed === true, 'alternate-network fallback triggered on geo-block', undefined);
check(/alternate network/.test(r6.sourcesAttempted.map((s) => s.name).join(' ')), 'temporary alternate route activated & logged', JSON.stringify(r6.sourcesAttempted.map((s) => s.name)));
check(r6.complete === true, 'geo-block resolved via temporary alternate network', undefined);

// Without a configured fallback, geo-block does NOT silently succeed.
let engine7 = createPersistentEngine({ label: 'geo-no-profile' });
let r7 = await engine7.search({
  target: 'geo-block with no profile',
  accessors: [{ id: 'a', name: 'Primary', run: async () => { const e = new Error('unavailable in your region'); throw e; } }],
  validate: () => true,
  extract: (d) => d
});
check(r7.exhausted === true && r7.found === null, 'no configured profile → honest exhaustion (no fake bypass)', undefined);

// ---------------------------------------------------------------
console.log('\n[6] Progress transparency — real state-machine steps recorded');
// ---------------------------------------------------------------
let stepStates1 = (r1.steps || []).map((s) => s.state);
check(stepStates1.includes(SEARCH_STATES.UNDERSTANDING_REQUEST), 'state machine reached UNDERSTANDING_REQUEST', undefined);
check(stepStates1.includes(SEARCH_STATES.DISCOVERING_SOURCES), 'state machine reached DISCOVERING_SOURCES', undefined);
check(stepStates1.includes(SEARCH_STATES.ACCESSING_PRIMARY), 'state machine reached ACCESSING_PRIMARY', undefined);
check(stepStates1.includes(SEARCH_STATES.VALIDATING), 'state machine reached VALIDATING', undefined);
check(stepStates1.includes(SEARCH_STATES.DEEP_SEARCHING), 'state machine reached DEEP_SEARCHING (pagination continued)', undefined);
check(stepStates1.includes(SEARCH_STATES.COMPLETE), 'state machine reached COMPLETE', undefined);

// ---------------------------------------------------------------
console.log('\n[7] Real-data persistent market path (no mock, honest labels)');
// ---------------------------------------------------------------
const { getResilientMarketChart } = await import('../../server/market/persistentMarket.mjs');
const btc = await getResilientMarketChart({ panelId: 'market.bitcoin', interval: '1h', limit: 40 });
check(btc.ok === true, 'BTC resilient chart ok', undefined);
check(btc.chart && Array.isArray(btc.chart.candles) && btc.chart.candles.length > 0, 'BTC returns real candles', `${btc.chart?.candles?.length}`);
check(btc.chart.dataState === HONEST_STATES.SNAPSHOT, 'BTC honest label SNAPSHOT (REST, not LIVE)', btc.chart?.dataState);
check(btc.report && Array.isArray(btc.report.sourcesAttempted) && btc.report.sourcesAttempted.length > 0, 'report lists real sources attempted', `${btc.report.sourcesAttempted.length}`);

const ihsg = await getResilientMarketChart({ panelId: 'market.ihsg', interval: '1d' });
check(ihsg.ok === false && ihsg.chart === null, 'non-crypto → no fabricated chart (mock prevented)', undefined);
check(ihsg.report && ihsg.report.report && ihsg.report.report.nextAction, 'IHSG report gives a next action (OPEN SOURCE)', undefined);

const unknown = await getResilientMarketChart({ panelId: 'market.nonexistent' });
check(unknown.ok === false && unknown.chart === null, 'unknown panel → honest empty, no chart', undefined);

console.log(`\n================================================================`);
console.log(` RESULT: ${failures === 0 ? 'ALL PASSED' : failures + ' FAILED'}`);
console.log(`================================================================`);
process.exit(failures === 0 ? 0 : 1);