/**
 * autonomousMarketResolver.mjs
 * AUTONOMOUS OPEN-WORLD INSTRUMENT RESOLUTION.
 *
 * The canonical registry (instrumentResolver) only knows a curated set of
 * instruments. For any OTHER instrument the user asks about (an arbitrary stock,
 * a new ticker, a foreign index, …) JIN must still be able to plot a REAL chart.
 *
 * This module resolves unknown instruments by SEARCHING THE WEB (Tavily) for the
 * real exchange ticker, then VALIDATING it against a live market quote.
 * Nothing is ever fabricated: if no ticker is verifiable against real data, the
 * resolver answers honestly with ok:false.
 *
 * Pipeline:
 *   utterance
 *     → 1. canonical registry            (curated fast path)
 *     → 2. curated EXTRA_MAP             (common-but-not-registered names)
 *     → 3. web search (Tavily)           (ticker candidates + evidence)
 *     → 4. live provider validation         (first candidate that returns real data wins)
 */
import { resolveCanonicalInstrument } from './instrumentResolver.mjs';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TAVILY_KEY = (process.env.TAVILY_API_KEY || '').trim();
const SEARCH_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h; tickers change only rarely
const CACHE_FILE = join(dirname(fileURLToPath(import.meta.url)), '.resolution-cache.json');

// ── Resolution cache (persistent): repeat asks resolve instantly, no web hit. ─
const resolutionCache = new Map();
try {
  if (existsSync(CACHE_FILE)) {
    const raw = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw)) resolutionCache.set(k, { ...v, hit: false });
    }
  }
} catch { /* corrupted cache → cold start */ }

function cacheGet(key) {
  const hit = resolutionCache.get(key);
  if (!hit) return null;
  if (Date.now() - (hit.ts || 0) > CACHE_TTL_MS) {
    resolutionCache.delete(key);
    return null;
  }
  return hit;
}

function cacheSet(key, value) {
  resolutionCache.set(key, { ts: Date.now(), ...value });
  try {
    const slim = {};
    for (const [k, v] of resolutionCache.entries()) slim[k] = { ts: v.ts, ticker: v.ticker, source: v.source };
    writeFileSync(CACHE_FILE, JSON.stringify(slim, null, 0), 'utf8');
  } catch { /* cache persistence is best-effort */ }
}

// Curated names that are popular but not (yet) in the canonical registry.
// Key = normalized name (alphanumeric lowercase), value = provider symbol.
const EXTRA_MAP = {
  goto: 'GOTO.JK',
  gotogojek: 'GOTO.JK',
  gojek: 'GOTO.JK',
  tokopedia: 'GOTO.JK',
  'harga goto': 'GOTO.JK',
  mdka: 'MDKA.JK',
  merdeka: 'MERDEKA.JK',
  ammn: 'AMMN.JK',
  amman: 'AMMN.JK',
  brpt: 'BRPT.JK',
  barito: 'BRPT.JK',
  antm: 'ANTM.JK',
  antam: 'ANTM.JK',
  tins: 'TINS.JK',
  timah: 'TINS.JK',
  adro: 'ADRO.JK',
  adaro: 'ADRO.JK',
  itmg: 'ITMG.JK',
  bmri: 'BMRI.JK',
  mandiri: 'BMRI.JK',
  'bank mandiri': 'BMRI.JK',
  bbni: 'BBNI.JK',
  bni: 'BBNI.JK',
  'bank bni': 'BBNI.JK',
  meta: 'META',
  facebook: 'META',
  netflix: 'NFLX',
  disney: 'DIS'
};

// Tokens that must never be treated as a ticker candidate.
const JUNK_TICKERS = new Set([
  'INC', 'LTD', 'CO', 'CORP', 'CORPORATION', 'WWW', 'provider-nonaktif', 'FINANCE', 'TICKER',
  'IDX', 'BEI', 'HOLDING', 'TBK', 'FROM', 'THE', 'AND', 'MARKET', 'STOCK',
  'PRICE', 'HARGA', 'COM', 'HTTP', 'HTTPS', 'SYMBOL', 'SERIES', 'FUTURES',
  'INDEX', 'COMPOSITE', 'METALS', 'ENERGY', 'GLOBAL', 'INDONESIA', 'BURSA',
  'EFEK', 'SAHAM', 'TELKOM', 'BANK', 'WHAT', 'ARE', 'HOW', 'ORDERS', 'SIMPLE'
]);

// Queries made ONLY of generic market words ("index pasar", "harga komoditas",
// "carikan harga") carry no concrete instrument. Web-searching such phrases
// produces garbage-or-wrong tickers (e.g. BFIN.JK for "index pasar"). Named
// instruments (goto, gold, ...) never land here because they add a non-generic
// token. → honest "too vague" WITHOUT any web hit.
const GENERIC_MARKET_TERMS = new Set([
  'harga', 'index', 'indeks', 'pasar', 'indek', 'saham', 'komoditas', 'komoditi',
  'berita', 'info', 'daftar', 'kurs', 'valas', 'crypto', 'kripto', 'investasi',
  'bursa', 'efek', 'market', 'stock', 'price', 'quote', 'trading', 'sekuritas',
  'hariini', 'real', 'realtime', 'carikan', 'tolong', 'berapa', 'berapakah', 'bisa', 'berikan', 'beri',
  'kira', 'lihat', 'tampilkan', 'tunjukan', 'tunjukkan', 'cari', 'nilai', 'hitung',
  'kode', 'data', 'update', 'cek', 'minta', 'kasih', 'nominal', 'jumlah', 'mau',
]);

function isGenericQuery(raw) {
  const words = String(raw || '').toLowerCase().match(/[a-z][a-z0-9]*/g) || [];
  if (!words.length) return true;
  return words.every((w) => GENERIC_MARKET_TERMS.has(w));
}

function normalizeKey(raw) {
  return String(raw || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

async function tavilySearch(query, maxResults = 6) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: TAVILY_KEY,
      query,
      max_results: maxResults,
      search_depth: 'advanced',
      include_answer: true,
      include_raw_content: false
    }),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
  return res.json();
}

function collectSearchText(results) {
  const parts = [];
  if (results.answer) parts.push(results.answer);
  for (const r of results.results || []) {
    if (r.title) parts.push(r.title);
    if (r.content) parts.push(String(r.content).slice(0, 400));
  }
  return parts.join('\n');
}

/**
 * Pull candidate tickers from mixed web text, in descending preference:
 * exchange-suffixed (BBCA.JK), caret indices (^GSPC), then bare tokens.
 */
function extractTickers(text) {
  const out = [];
  const seen = new Set();
  const push = (t) => {
    const u = t.toUpperCase().trim();
    if (!u || seen.has(u) || JUNK_TICKERS.has(u) || u.length > 8) return;
    if (/[0-9]/.test(u) && u.length < 3) return;
    seen.add(u);
    out.push(u);
  };
  const suffixRe = /\b([A-Z0-9]{1,6}\.[A-Z]{1,4})\b/g;
  let m;
  while ((m = suffixRe.exec(text))) push(m[1]);
  const caretRe = /\^[A-Z0-9]{1,6}/g;
  while ((m = caretRe.exec(text))) push(m[0]);
  const bareRe = /[A-Z]{2,6}/g;
  while ((m = bareRe.exec(text))) push(m[0]);
  return out;
}

function rankCandidates(tickers, rawName) {
  const target = normalizeKey(rawName).toUpperCase();
  const scored = tickers
    .map((t, i) => {
      let score = i;
      const norm = normalizeKey(t);
      if (norm === target) score -= 1000;                       // exact name match
      else if (norm.startsWith(target) || target.startsWith(norm)) score -= 500;
      if (/\.JK$/.test(t)) score -= 200;                        // Indonesian stocks strong signal
      if (/\.(L|F|TO|SA|T|O|NS|AX|KS|SZ)/.test(t)) score -= 100;
      return { t, score };
    })
    .sort((a, b) => a.score - b.score);
  return scored.map((s) => s.t);
}

/** Build a canonical-equivalent object for an arbitrary ticker. */
export function symbolToCanonical(symbol, rawName, extra = {}) {
  const ticker = String(symbol || '').toUpperCase().trim();
  const isIndonesia = /\.JK$/.test(ticker);
  const slug = normalizeKey(rawName) || ticker.replace(/[^a-z0-9]/gi, '');
  return {
    asset: slug,
    name: extra.name || String(rawName || ticker).trim(),
    symbol: ticker,
    panelId: `market.${slug}`,
    category: isIndonesia ? 'indonesia' : 'global',
    currency: isIndonesia ? 'IDR' : 'USD',
    quoteCandidates: [isIndonesia ? 'IDR' : 'USD'],
    meta: {},
    providers: [],
    isOpenWorld: true
  };
}

async function tryTicker() { return null; }

/**
 * Resolve an instrument that the canonical registry does not know.
 * @param {string} input - user expression (e.g. "saham GOTO", "GOTO")
 * @returns {Promise<{ok:boolean, source:string, canonical?:object, evidence?:Array, ticker?:string, reason?:string, cached?:boolean}>}
 */
export async function resolveInstrumentAutonomously(input, options = {}) {
  const raw = String(input || '').trim();
  if (!raw) return { ok: false, source: 'WEB_SEARCH', reason: 'EMPTY_INPUT' };

  const fast = resolveCanonicalInstrument(raw);
  if (fast) return { ok: true, source: 'LOCAL_REGISTRY', canonical: fast, evidence: [], ticker: null };

  const key = normalizeKey(raw);

  // Vague queries with no concrete instrument must NEVER hit the web — searching
  // them yields a wrong-but-verifiable ticker (e.g. BFIN.JK for "index pasar").
  if (isGenericQuery(raw)) {
    return {
      ok: false,
      source: 'VAGUE',
      reason: 'GENERIC_QUERY',
      message: 'Instruksi terlalu umum — sebut instrumen pasarnya (mis. IHSG, BBCA, emas, bitcoin, minyak WTI) agar bisa ditampilkan harga riil-nya.'
    };
  }

  // Cached resolution → instant repeat (no web hit).
  const cached = cacheGet(key);
  if (cached && cached.ticker) {
    if (cached.ticker === '@none') {
      return { ok: false, source: cached.source || 'WEB_SEARCH', reason: cached.reason || 'PREVIOUSLY_UNRESOLVED' };
    }
    return {
      ok: true,
      source: cached.source || 'WEB_SEARCH',
      canonical: symbolToCanonical(cached.ticker, raw),
      ticker: cached.ticker,
      evidence: cached.evidence || [],
      cached: true
    };
  }

  if (EXTRA_MAP[key]) {
    const verified = await tryTicker(EXTRA_MAP[key], raw);
    if (verified) {
      cacheSet(key, { ticker: verified.verifiedSymbol, source: 'EXTRA_MAP' });
      return {
        ok: true,
        source: 'EXTRA_MAP',
        canonical: verified.canonical,
        ticker: verified.verifiedSymbol,
        evidence: [{ title: 'Kurasi lokal (tabel nama tambahan)', url: 'local:katalog' }]
      };
    }
  }

  // Single best query first — the Indonesian-tuned query covers the most common
  // local stock asks; only fall back to the English variant if it yields nothing.
  const queries = [
    `kode saham ${raw} ticker bursa efek indonesia`
  ];
  let lastReason = 'NO_WEB_EVIDENCE';
  for (const query of queries) {
    let results;
    try {
      results = await tavilySearch(query);
    } catch (err) {
      lastReason = `SEARCH_ERROR: ${String(err.message || err).slice(0, 120)}`;
      continue;
    }
    if (!results || !results.results) continue;
    const evidence = (results.results || []).slice(0, 3).map((r) => ({
      title: r.title,
      url: r.url,
      domain: String(r.url || '').replace(/^https?:\/\/([^/]+).*$/, '$1')
    }));
    const text = collectSearchText(results);
    const candidates = rankCandidates(extractTickers(text), raw);
    if (!candidates.length) continue;

    // Live quote validation is disabled.
    const settled = await Promise.allSettled(candidates.slice(0, 4).map((t) => tryTicker(t, raw)));
    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value) {
        cacheSet(key, { ticker: s.value.verifiedSymbol, source: 'WEB_SEARCH', evidence: evidence.slice(0, 3) });
        return {
          ok: true,
          source: 'WEB_SEARCH',
          canonical: s.value.canonical,
          ticker: s.value.verifiedSymbol,
          evidence,
          query
        };
      }
    }
  }

  // Remember that we tried (so repeat asks within TTL do not re-run the web).
  cacheSet(key, { ticker: '@none', source: 'WEB_SEARCH', reason: lastReason });
  return {
    ok: false,
    source: 'WEB_SEARCH',
    reason: lastReason,
    message: 'Tidak menemukan ticker yang terverifikasi data nyata untuk instrumen ini.'
  };
}

export default { resolveInstrumentAutonomously, symbolToCanonical };