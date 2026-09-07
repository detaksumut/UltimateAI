/**
 * MarketRetrieval.test.mjs
 * Acceptance tests for the REAL data-retrieval layer (the "CEK HARGA BTC HARI INI"
 * blocker). The expected behaviour at the retrieval layer is:
 *
 *   - A common instrument like BTC is NEVER zeroed out because one provider failed
 *     or one internal route (symbol mapping/provider/endpoint) failed.
 *   - Provider fallback: crypto → Binance → CoinGecko → Yahoo; non-crypto → Yahoo.
 *   - Each provider knows its OWN symbol format (BTCUSDT / bitcoin / BTC-USD).
 *   - Output is normalized to the common schema (price alone is sufficient; high/low/
 *     volume are optional and never required to accept a valid result).
 *   - Failure diagnostics are reported BEFORE concluding EXHAUSTED.
 *   - EXHAUSTED is only produced after canonical resolution succeeded AND every
 *     configured provider was attempted and failed.
 *   - No price is ever fabricated; unresolvable instruments return an honest "no".
 */
import { retrieveMarketData } from '../../server/market/marketRetrievalRouter.mjs';
import { resolveCanonicalInstrument } from '../../server/market/instrumentResolver.mjs';

let failures = 0;
let assertions = 0;
const pass = (label) => { assertions++; console.log(`  [PASS] ${label}`); };
const fail = (label, msg) => { failures++; assertions++; console.log(`  [FAIL] ${label}${msg ? ' -> ' + msg : ''}`); };
const check = (cond, label, msg) => (cond ? pass(label) : fail(label, msg));

// ---------------------------------------------------------------
console.log('\n[1] Canonical resolution: many identifiers -> ONE canonical BTC');
// ---------------------------------------------------------------
const idents = ['CEK HARGA BTC HARI INI', 'BTC', 'Bitcoin', 'harga BTC sekarang',
  'market.bitcoin', 'BITCOIN', 'btc', 'harga bitcoin hari ini'];
let firstCanonical = null;
for (const id of idents) {
  const c = resolveCanonicalInstrument(id);
  check(Boolean(c && c.asset === 'bitcoin' && c.symbol === 'BTC'),
    `resolves '${id}' -> {asset:bitcoin, symbol:BTC}`, c && (c.asset + ':' + c.symbol));
  if (!firstCanonical) firstCanonical = c;
  else check(c && firstCanonical && c.asset === firstCanonical.asset && c.meta.binance === firstCanonical.meta.binance,
    `same canonical for '${id}'`);
}

// ---------------------------------------------------------------
console.log('\n[2] REAL RETRIEVAL: "CEK HARGA BTC HARI INI" returns real BTC data');
// ---------------------------------------------------------------
const btc = await retrieveMarketData('CEK HARGA BTC HARI INI');
check(Boolean(btc.ok && btc.result), 'ok=true with a result', !btc.ok && btc.message);
check(btc.result && btc.result.asset === 'bitcoin' && btc.result.symbol === 'BTC', 'asset/symbol = bitcoin/BTC');
check(btc.result && typeof btc.result.price === 'number' && btc.result.price > 0, 'real price (>0) present', btc.result && `price=${btc.result.price}`);
check(Boolean(btc.result && btc.result.source && btc.result.sourceUrl), 'source + real sourceUrl present', btc.result && btc.result.source + ' | ' + btc.result.sourceUrl);
check(Boolean(btc.result && btc.result.retrievedAt), 'retrievedAt present');
check(btc.result && btc.result.verificationStatus === 'VERIFIED', 'verificationStatus = VERIFIED', btc.result && btc.result.verificationStatus);
check(btc.providerUsed === 'binance', 'route started with a real provider (binance)');
check(Array.isArray(btc.diagnostics) && btc.diagnostics.length > 0, 'diagnostics recorded');

// ---------------------------------------------------------------
console.log('\n[3] FALLBACK CONTINUES after one provider fails');
// ---------------------------------------------------------------
// Binance symbol is invalid (HTTP 400 on ALL binance hosts); the chain MUST still
// reach CoinGecko and return REAL data instead of zeroing out.
const craft = { asset: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', category: 'crypto', currency: 'USD',
  meta: { yahoo: 'BTC-USD', coingeckoId: 'bitcoin', binance: 'UNREALBTCUSDT' } };
const fb = await retrieveMarketData(craft);
check(Boolean(fb.ok && fb.result), 'returns ok despite Binance failing', !fb.ok && fb.exhaustedReason);
check(fb.providerUsed === 'coingecko', 'fell through to CoinGecko after Binance failed', fb.providerUsed);
check(Array.isArray(fb.attempted) && fb.attempted.includes('binance') && fb.attempted.includes('coingecko'), 'attempted [binance, coingecko]', JSON.stringify(fb.attempted));
check(fb.result && typeof fb.result.price === 'number' && fb.result.price > 0, 'real fallback price (>0)', fb.result && `price=${fb.result.price}`);
check(fb.diagnostics && fb.diagnostics.some(d => d.provider === 'coingecko' && d.status === 'OK'), 'diagnostics show coingecko OK');
const binFailDiag = fb.diagnostics.filter(d => d.provider === 'binance');
check(binFailDiag.length >= 3, 'diagnostics list every binance host failure (' + binFailDiag.length + ')');

// ---------------------------------------------------------------
console.log('\n[4] OPTIONAL FIELDS: price alone is enough, never reject valid result');
// ---------------------------------------------------------------
// Real result from CoinGecko -- verify the schema allows optional high/low/volume.
const schema = btc.result;
check('price' in schema && typeof schema.price === 'number', 'price required & present');
check('asset' in schema && 'symbol' in schema && 'currency' in schema, 'identity fields present');
['high24h', 'low24h', 'volume24h'].forEach(f => {
  if (schema[f] != null) pass(`optional field '${f}' present as ${typeof schema[f]}`);
  else pass(`optional field '${f}' may be absent (price-only still valid)`);
});

// ---------------------------------------------------------------
console.log('\n[5] HONEST EXHAUSTED: only after canonical resolution + all providers attempted');
// ---------------------------------------------------------------
// (a) Unresolvable instrument -> honest NO DATA EXISTS, distinct from provider failure.
const unknown = await retrieveMarketData('harga gadget zzz-unknown');
check(Boolean(!unknown.ok && unknown.exhausted && unknown.exhaustedReason === 'CANONICAL_UNRESOLVED'),
  'unresolvable -> CANONICAL_UNRESOLVED (NO DATA EXISTS)', unknown.exhaustedReason);
check(unknown.result === null, 'no fabricated result for unknown instrument');

// (b) Canonical resolves but EVERY provider fails -> ALL_PROVIDERS_FAILED, all attempted.
const allFail = { asset: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', category: 'crypto', currency: 'USD',
  meta: { yahoo: 'ZZZZ-NOPE', coingeckoId: 'unreal-coin-XYZ', binance: 'UNREALBTCUSDT' } };
const af = await retrieveMarketData(allFail);
check(Boolean(!af.ok && af.exhausted && af.exhaustedReason === 'ALL_PROVIDERS_FAILED'),
  'all-fail -> ALL_PROVIDERS_FAILED', af.exhaustedReason);
check(Array.isArray(af.attempted) && af.attempted.length >= 3, 'all providers attempted, none skipped', JSON.stringify(af.attempted));
check(af.result === null, 'no fabricated result on EXHAUSTED');
check(Array.isArray(af.diagnostics) && af.diagnostics.some(d => d.status === 'FAILED'), 'failure diagnostics present before EXHAUSTED');

// ---------------------------------------------------------------
console.log('\n[6] NON-CRYPTO: IHSG / emas via Yahoo (if reachable)');
// ---------------------------------------------------------------
const ihsg = await retrieveMarketData('PERGERAKAN IHSG HARI INI');
check(ihsg.ok === true || ihsg.exhaustedReason === 'ALL_PROVIDERS_FAILED',
  'IHSG either real data (yahoo) or all-providers-exhausted (never zero-with-no-diagnostics)', ihsg.ok ? 'real' : ihsg.exhaustedReason);

// ---------------------------------------------------------------
console.log(`\nMarketRetrieval result: ${assertions - failures}/${assertions} passed` + (failures ? `, ${failures} FAILED` : ', ALL PASSED'));
process.exit(failures ? 1 : 0);
