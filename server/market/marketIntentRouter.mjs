/**
 * marketIntentRouter.mjs
 * MARKET_DATA intent classifier for the server-side SemanticIntentEngine.
 *
 * The problem it solves: market-data phrases ("cek harga BTC hari ini", "tampilkan
 * grafik BTC", "harga emas sekarang", "pergerakan IHSG") used to fall through to the
 * generic EXTERNAL_DATA → web.search path, which then resolved to YouTube/video/news
 * content instead of the Market Data engine.
 *
 * This router is the HIGHEST-PRIORITY market classifier: it detects a known market
 * instrument combined with a market-data intent and routes to the Market Data engine
 * (ROUTER: MARKET_DATA_ENGINE / SOURCE: live market feed) — NEVER to generic web/search
 * or video. It deliberately does NOT grab news or video requests, so those still reach
 * their proper engines.
 *
 * This module is PURE (no I/O) so it can be unit-tested deterministically.
 */

// ── Instrument registry: keyword/synonym → canonical instrument + panelId ──────────
// Mirrors server/market/MarketDataService.mjs asset list (panelIds are authoritative).
// Each entry: synonyms searched case-insensitively against the raw utterance.
export const INSTRUMENTS = [
  // Crypto
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', panelId: 'market.bitcoin', category: 'crypto', synonyms: ['btc', 'bitcoin', 'bitcoin?'] },
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', panelId: 'market.ethereum', category: 'crypto', synonyms: ['eth', 'ethereum', 'ether'] },
  { id: 'solana', name: 'Solana', symbol: 'SOL', panelId: 'market.solana', category: 'crypto', synonyms: ['solana', 'sol'] },
  { id: 'ripple', name: 'XRP', symbol: 'XRP', panelId: 'market.xrp', category: 'crypto', synonyms: ['xrp', 'ripple'] },
  { id: 'cardano', name: 'Cardano', symbol: 'ADA', panelId: 'market.cardano', category: 'crypto', synonyms: ['ada', 'cardano'] },
  { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE', panelId: 'market.dogecoin', category: 'crypto', synonyms: ['doge', 'dogecoin'] },
  { id: 'bnb', name: 'BNB', symbol: 'BNB', panelId: 'market.bnb', category: 'crypto', synonyms: ['bnb'] },
  // Metals
  { id: 'gold', name: 'Emas (Gold)', symbol: 'XAU/USD', panelId: 'market.gold', category: 'metals', synonyms: ['emas', 'gold', 'xau', 'logam mulia', 'anta'] },
  { id: 'silver', name: 'Perak (Silver)', symbol: 'XAG/USD', panelId: 'market.silver', category: 'metals', synonyms: ['perak', 'silver', 'xag'] },
  { id: 'copper', name: 'Tembaga (Copper)', symbol: 'COPPER', panelId: 'market.copper', category: 'metals', synonyms: ['tembaga', 'copper', 'tembaga'] },
  { id: 'platinum', name: 'Platinum', symbol: 'PLATINUM', panelId: 'market.platinum', category: 'metals', synonyms: ['platinum', 'platinum'] },
  // Energy
  { id: 'wti', name: 'Minyak WTI', symbol: 'WTI', panelId: 'market.wti', category: 'energy', synonyms: ['minyak wti', 'wti', 'minyak mentah'] },
  { id: 'brent', name: 'Brent', symbol: 'BRENT', panelId: 'market.brent', category: 'energy', synonyms: ['brent', 'minyak brent'] },
  { id: 'natgas', name: 'Gas Alam', symbol: 'NG', panelId: 'market.natgas', category: 'energy', synonyms: ['gas alam', 'natgas', 'natural gas'] },
  // Indonesia / indices
  { id: 'ihsg', name: 'IHSG', symbol: 'IHSG', panelId: 'market.ihsg', category: 'indonesia', synonyms: ['ihsg', 'idx composite', 'bursa efek indonesia', 'jakarta composite'] },
  { id: 'lq45', name: 'LQ45', symbol: 'LQ45', panelId: 'market.lq45', category: 'indonesia', synonyms: ['lq45', 'lq 45'] },
  { id: 'idxx30', name: 'IDX30', symbol: 'IDX30', panelId: 'market.idx30', category: 'indonesia', synonyms: ['idx30', 'idx 30'] },
  { id: 'sp500', name: 'S&P 500', symbol: 'SPX', panelId: 'market.sp500', category: 'global', synonyms: ['sp500', 's&p 500', 'spx'] },
  { id: 'nasdaq', name: 'NASDAQ', symbol: 'IXIC', panelId: 'market.nasdaq', category: 'global', synonyms: ['nasdaq', 'ixic'] },
  { id: 'dow', name: 'Dow Jones', symbol: 'DJI', panelId: 'market.dow', category: 'global', synonyms: ['dow jones', 'dow', 'dji'] },
  { id: 'dax', name: 'DAX', symbol: 'DAX', panelId: 'market.dax', category: 'global', synonyms: ['dax'] },
  { id: 'nikkei', name: 'Nikkei 225', symbol: 'N225', panelId: 'market.nikkei', category: 'asia', synonyms: ['nikkei', 'n225'] },
  { id: 'hangseng', name: 'Hang Seng', symbol: 'HSI', panelId: 'market.hangseng', category: 'asia', synonyms: ['hang seng', 'hsi'] },
  // Currency / forex
  { id: 'usd_idr', name: 'USD/IDR', symbol: 'USD/IDR', panelId: 'market.usd_idr', category: 'currency', synonyms: ['usd/idr', 'dolar ke rupiah', 'kurs dolar'] },
  { id: 'eur_usd', name: 'EUR/USD', symbol: 'EUR/USD', panelId: 'market.eur_usd', category: 'currency', synonyms: ['eur/usd', 'euro dolar'] },
  { id: 'usd_jpy', name: 'USD/JPY', symbol: 'USD/JPY', panelId: 'market.usd_jpy', category: 'currency', synonyms: ['usd/jpy'] }
];

export const CATEGORY_LABEL = {
  crypto: 'CRYPTO',
  metals: 'METALS',
  energy: 'ENERGY',
  indonesia: 'INDONESIA',
  global: 'GLOBAL',
  asia: 'ASIA',
  currency: 'FOREX'
};

// Non-market intent gate: if the user explicitly asks about news/video/analysis of an
// instrument, it must NOT be captured by MARKET_DATA — those belong to News / Video engines.
const NON_MARKET_OVERRIDE = /(berita|artikel|kabar|warta|wawancara|ulasan|review|pendapat|opini|video\s*(tentang|mengenai|soal)?|youtube|vlog|podcast)/i;

// Generic market *vocabulary* — a "market anchor" word that, combined with an instrument,
// confirms market-data intent even when the instrument word alone is ambiguous.
const MARKET_ANCHORS = /harga|market|pasar|grafik|chart|candlestick|kapitalisasi|pergerakan|naik|turun|open|high|low|close|volume|bid|ask|nilai|valuasi|profit|loss|streak|trend|wti|emas|saham indeks/i;

// Challenge-name style: "CEK HARGA BTC HARI INI" / "TAMPILKAN GRAFIK BTC" / "PRICE BTC".
const STRONG_PRICE_PATTERN = /(?:ce*k|tampilkan|lihat|beri|tunjukkan)?\s*harga\s+([a-z0-9&/\.]+)|(?:grafik|chart)\s+([a-z0-9&/\.]+)|(?:pergerakan|gerakan)\s+([a-z0-9&/\.]+)/i;

/**
 * Resolve any known instrument whose synonyms appear in the utterance.
 * Returns the matched instrument object + the exact synonym hit, or null.
 */
export function resolveInstrument(raw) {
  const text = ` ${raw.toLowerCase()} `;
  for (const inst of INSTRUMENTS) {
    for (const syn of inst.synonyms) {
      // word-boundary match for multi-char synonyms to avoid false positives
      if (new RegExp(`\\b${syn.replace(/[/]/g, '\\/')}\\b`, 'i').test(text)) {
        return { instrument: inst, matched: syn };
      }
    }
  }
  return null;
}

/**
 * High-priority MARKET_DATA classifier.
 *
 * Rules (in order):
 *  1. If the request is explicitly news/video about an instrument → NOT market data.
 *  2. Find a known instrument in the utterance.
 *  3. Require a market-intent anchor (price/chart/overview vocabulary) OR a strong
 *     pattern like "harga BTC" / "grafik BTC" so we don't steal generic utterances.
 *
 * @param {string} raw trimmed user input
 * @returns {object|null} market intent plan, or null if not a market-data request
 */
export function classifyMarketIntent(raw) {
  if (!raw || !raw.trim()) return null;
  const r = raw.trim();

  // Gate 1: explicit non-market requests (news / video / analysis) are NOT captured.
  if (NON_MARKET_OVERRIDE.test(r)) {
    const newsVideo = /berita|artikel|kabar|warta|wawancara|vlog|podcast/i.test(r) ? 'news' : 'video';
    return {
      domain: 'market',
      captured: false,
      redirectedTo: newsVideo === 'news' ? 'NEWS_ENGINE' : 'VIDEO_ENGINE',
      reason: 'Explicit non-market intent (news/video) takes precedence over market-data routing.',
      routingError: false
    };
  }

  // Gate 2: must reference a known market instrument.
  const resolved = resolveInstrument(r);
  if (!resolved) return null;

  // Gate 3: must carry a market intent signal.
  //   - strong pattern "harga <inst>" / "grafik <inst>" / "pergerakan <inst>"
  //   - or a market anchor word alongside the known instrument
  const strong = STRONG_PRICE_PATTERN.test(r);
  const anchored = MARKET_ANCHORS.test(r);

  let intent = null;
  if (/\b(grafik|chart|candlestick)\b/i.test(r) || /grafik|chart|candlestick/i.test(r)) {
    intent = 'chart';
  } else if (/open\s+high\s+low\s+close|ohlc|volume/i.test(r)) {
    intent = 'quote';
  } else if (/kapitalisasi\s+pasar/i.test(r)) {
    intent = 'overview';
  } else {
    intent = 'current_price';
  }

  if (!strong && !anchored) return null;

  return {
    domain: 'market',
    captured: true,
    intent: 'MARKET_DATA',
    subIntent: intent,
    instrument: resolved.instrument.symbol,
    instrumentId: resolved.instrument.id,
    instrumentName: resolved.instrument.name,
    panelId: resolved.instrument.panelId,
    category: resolved.instrument.category,
    categoryLabel: CATEGORY_LABEL[resolved.instrument.category] || resolved.instrument.category.toUpperCase(),
    toolsNeeded: ['market.data'],
    toolReason: 'Market instrument + market intent detected → Market Data engine (never generic web/video search).',
    route: { engine: 'MARKET_DATA_ENGINE', source: 'market_feed', live: true },
    routingError: false,
    reason: 'Deterministic MARKET_DATA override (highest priority before generic EXTERNAL_DATA / web.search).',
    interpretationSource: 'MARKET_DATA_CLASSIFIER',
    transportUsed: 'LOCAL_REASONING',
    fallbackUsed: false
  };
}

export default { INSTRUMENTS, resolveInstrument, classifyMarketIntent, CATEGORY_LABEL };
