/**
 * instrumentResolver.mjs
 * CANONICAL MARKET INSTRUMENT RESOLUTION.
 *
 * The UniversalResultModal + retrieval layers must NOT use a UI/internal key like
 * `market.bitcoin` as the retrieval identity. Every request resolves to a canonical
 * instrument object that carries the REAL provider identifiers each adapter needs:
 *
 *   {
 *     asset: 'bitcoin',
 *     name: 'Bitcoin',
 *     symbol: 'BTC',
 *     panelId: 'market.bitcoin',
 *     category: 'crypto',
 *     currency: 'USD',
 *     quoteCandidates: ['USD','USDT','IDR'],
 *     meta: { coingeckoId: 'bitcoin', binance: 'BTCUSDT' },
 *     providers: ['binance','coingecko','disabled provider']   // ordered fallback chain
 *   }
 *
 * "BTC", "Bitcoin", "harga BTC", "harga Bitcoin hari ini", "BTC sekarang" and
 * "market.bitcoin" MUST ALL resolve to the same canonical object.
 */

// ── Canonical registry: the authoritative provider-identifier map ────────────
// meta.disabledProviderSymbol   → disabled provider identifier          (e.g. BTC-USD, ^JKSE, GC=F, USDIDR=X)
// meta.coingeckoId → CoinGecko id (crypto only)
// meta.binance → Binance spot pair (crypto only)
// quoteCandidates → real quote currencies the instrument trades in
export const CANONICAL_INSTRUMENTS = [
  // ── Crypto (multi-provider) ──
  { asset: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', panelId: 'market.bitcoin', category: 'crypto', currency: 'USD', quoteCandidates: ['USD', 'USDT', 'IDR'], meta: { coingeckoId: 'bitcoin', binance: 'BTCUSDT' }, aliases: ['btc', 'bitcoin', 'bitcoin?'] },
  { asset: 'ethereum', name: 'Ethereum', symbol: 'ETH', panelId: 'market.ethereum', category: 'crypto', currency: 'USD', quoteCandidates: ['USD', 'USDT', 'IDR'], meta: { coingeckoId: 'ethereum', binance: 'ETHUSDT' }, aliases: ['eth', 'ethereum', 'ether'] },
  { asset: 'solana', name: 'Solana', symbol: 'SOL', panelId: 'market.solana', category: 'crypto', currency: 'USD', quoteCandidates: ['USD', 'USDT', 'IDR'], meta: { coingeckoId: 'solana', binance: 'SOLUSDT' }, aliases: ['solana', 'sol'] },
  { asset: 'ripple', name: 'XRP', symbol: 'XRP', panelId: 'market.xrp', category: 'crypto', currency: 'USD', quoteCandidates: ['USD', 'USDT', 'IDR'], meta: { coingeckoId: 'ripple', binance: 'XRPUSDT' }, aliases: ['xrp', 'ripple'] },
  { asset: 'cardano', name: 'Cardano', symbol: 'ADA', panelId: 'market.cardano', category: 'crypto', currency: 'USD', quoteCandidates: ['USD', 'USDT', 'IDR'], meta: { coingeckoId: 'cardano', binance: 'ADAUSDT' }, aliases: ['ada', 'cardano'] },
  { asset: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE', panelId: 'market.dogecoin', category: 'crypto', currency: 'USD', quoteCandidates: ['USD', 'USDT', 'IDR'], meta: { coingeckoId: 'dogecoin', binance: 'DOGEUSDT' }, aliases: ['doge', 'dogecoin'] },
  { asset: 'binancecoin', name: 'BNB', symbol: 'BNB', panelId: 'market.bnb', category: 'crypto', currency: 'USD', quoteCandidates: ['USD', 'USDT', 'IDR'], meta: { coingeckoId: 'binancecoin', binance: 'BNBUSDT' }, aliases: ['bnb', 'binance coin'] },
  { asset: 'chainlink', name: 'Chainlink', symbol: 'LINK', panelId: 'market.chainlink', category: 'crypto', currency: 'USD', quoteCandidates: ['USD', 'USDT', 'IDR'], meta: { coingeckoId: 'chainlink', binance: 'LINKUSDT' }, aliases: ['chainlink', 'link'] },

  // ── Global / US stocks & indices (disabled provider) ──
  { asset: 'apple', name: 'Apple', symbol: 'AAPL', panelId: 'market.apple', category: 'global', currency: 'USD', quoteCandidates: ['USD'], meta: { }, aliases: ['apeple', 'appl', 'apple', 'aapl'] },
  { asset: 'microsoft', name: 'Microsoft', symbol: 'MSFT', panelId: 'market.microsoft', category: 'global', currency: 'USD', quoteCandidates: ['USD'], meta: { }, aliases: ['msft', 'microsoft'] },
  { asset: 'nvidia', name: 'NVIDIA', symbol: 'NVDA', panelId: 'market.nvidia', category: 'global', currency: 'USD', quoteCandidates: ['USD'], meta: { }, aliases: ['nvda', 'nvidia'] },
  { asset: 'tesla', name: 'Tesla', symbol: 'TSLA', panelId: 'market.tesla', category: 'global', currency: 'USD', quoteCandidates: ['USD'], meta: { }, aliases: ['tesla', 'tsla'] },
  { asset: 'alphabet', name: 'Alphabet', symbol: 'GOOGL', panelId: 'market.alphabet', category: 'global', currency: 'USD', quoteCandidates: ['USD'], meta: { }, aliases: ['alphabet', 'googl', 'google'] },
  { asset: 'amazon', name: 'Amazon', symbol: 'AMZN', panelId: 'market.amazon', category: 'global', currency: 'USD', quoteCandidates: ['USD'], meta: { }, aliases: ['amazon', 'amzn'] },
  { asset: 'sp500', name: 'S&P 500', symbol: 'SPX', panelId: 'market.sp500', category: 'global', currency: 'USD', quoteCandidates: ['USD'], meta: { }, aliases: ['sp500', 's&p 500', 'spx', 's&p'] },
  { asset: 'nasdaq', name: 'NASDAQ', symbol: 'IXIC', panelId: 'market.nasdaq', category: 'global', currency: 'USD', quoteCandidates: ['USD'], meta: { }, aliases: ['nasdaq', 'ixic'] },
  { asset: 'dow', name: 'Dow Jones', symbol: 'DJI', panelId: 'market.dow', category: 'global', currency: 'USD', quoteCandidates: ['USD'], meta: { }, aliases: ['dow jones', 'dow', 'dji'] },
  { asset: 'vix', name: 'VIX', symbol: 'VIX', panelId: 'market.vix', category: 'global', currency: 'INDEX', quoteCandidates: ['USD'], meta: { }, aliases: ['vix'] },

  // ── Indonesia (disabled provider) ──
  { asset: 'ihsg', name: 'IHSG', symbol: 'IHSG', panelId: 'market.ihsg', category: 'indonesia', currency: 'IDX', quoteCandidates: ['IDX', 'IDR'], meta: { }, aliases: ['ihsg', 'idx composite', 'jkse', 'bursa efek indonesia'] },
  { asset: 'lq45', name: 'LQ45', symbol: 'LQ45', panelId: 'market.lq45', category: 'indonesia', currency: 'IDX', quoteCandidates: ['IDX', 'IDR'], meta: { }, aliases: ['lq45', 'lq 45'] },
  { asset: 'idx30', name: 'IDX30', symbol: 'IDX30', panelId: 'market.idx30', category: 'indonesia', currency: 'IDX', quoteCandidates: ['IDX', 'IDR'], meta: { }, aliases: ['idx30', 'idx 30'] },
  { asset: 'bbca', name: 'Bank BCA', symbol: 'BBCA', panelId: 'market.bbca', category: 'indonesia', currency: 'IDR', quoteCandidates: ['IDR'], meta: { }, aliases: ['bbca', 'bank bca', 'bca'] },
  { asset: 'bbri', name: 'Bank BRI', symbol: 'BBRI', panelId: 'market.bbri', category: 'indonesia', currency: 'IDR', quoteCandidates: ['IDR'], meta: { }, aliases: ['bbri', 'bank bri', 'bri'] },
  { asset: 'tlkm', name: 'Telkom', symbol: 'TLKM', panelId: 'market.tlkm', category: 'indonesia', currency: 'IDR', quoteCandidates: ['IDR'], meta: { }, aliases: ['tlkm', 'telkom'] },
  { asset: 'asii', name: 'Astra', symbol: 'ASII', panelId: 'market.asii', category: 'indonesia', currency: 'IDR', quoteCandidates: ['IDR'], meta: { }, aliases: ['asii', 'astra'] },

  // ── Asia / global indices (disabled provider) ──
  { asset: 'nikkei', name: 'Nikkei 225', symbol: 'N225', panelId: 'market.nikkei', category: 'asia', currency: 'JPY', quoteCandidates: ['JPY'], meta: { }, aliases: ['nikkei', 'n225'] },
  { asset: 'hangseng', name: 'Hang Seng', symbol: 'HSI', panelId: 'market.hangseng', category: 'asia', currency: 'HKD', quoteCandidates: ['HKD'], meta: { }, aliases: ['hang seng', 'hsi'] },
  { asset: 'shanghai', name: 'Shanghai Composite', symbol: 'SSEC', panelId: 'market.shanghai', category: 'asia', currency: 'CNY', quoteCandidates: ['CNY'], meta: { }, aliases: ['shanghai', 'ssec'] },
  { asset: 'kospi', name: 'KOSPI', symbol: 'KS11', panelId: 'market.kospi', category: 'asia', currency: 'KRW', quoteCandidates: ['KRW'], meta: { }, aliases: ['kospi', 'ks11'] },
  { asset: 'dax', name: 'DAX', symbol: 'DAX', panelId: 'market.dax', category: 'global', currency: 'EUR', quoteCandidates: ['EUR'], meta: { }, aliases: ['dax'] },
  { asset: 'ftse', name: 'FTSE 100', symbol: 'FTSE', panelId: 'market.ftse', category: 'global', currency: 'GBP', quoteCandidates: ['GBP'], meta: { }, aliases: ['ftse', 'ftse 100'] },

  // ── Metals (disabled provider) ──
  { asset: 'gold', name: 'Emas (Gold)', symbol: 'XAU/USD', panelId: 'market.gold', category: 'metals', currency: 'USD', quoteCandidates: ['USD', 'IDR'], meta: { }, aliases: ['emas', 'gold', 'xau', 'logam mulia'] },
  { asset: 'silver', name: 'Perak (Silver)', symbol: 'XAG/USD', panelId: 'market.silver', category: 'metals', currency: 'USD', quoteCandidates: ['USD'], meta: { }, aliases: ['perak', 'silver', 'xag'] },
  { asset: 'copper', name: 'Tembaga (Copper)', symbol: 'COPPER', panelId: 'market.copper', category: 'metals', currency: 'USD', quoteCandidates: ['USD'], meta: { }, aliases: ['tembaga', 'copper'] },
  { asset: 'platinum', name: 'Platinum', symbol: 'PLATINUM', panelId: 'market.platinum', category: 'metals', currency: 'USD', quoteCandidates: ['USD'], meta: { }, aliases: ['platinum'] },

  // ── Energy (disabled provider) ──
  { asset: 'wti', name: 'Minyak WTI', symbol: 'WTI', panelId: 'market.wti', category: 'energy', currency: 'USD', quoteCandidates: ['USD'], meta: { }, aliases: ['minyak wti', 'wti', 'minyak mentah'] },
  { asset: 'brent', name: 'Brent', symbol: 'BRENT', panelId: 'market.brent', category: 'energy', currency: 'USD', quoteCandidates: ['USD'], meta: { }, aliases: ['brent', 'minyak brent'] },
  { asset: 'natgas', name: 'Gas Alam', symbol: 'NG', panelId: 'market.natgas', category: 'energy', currency: 'USD', quoteCandidates: ['USD'], meta: { }, aliases: ['gas alam', 'natgas', 'natural gas'] },

  // ── Agriculture (disabled provider) ──
  { asset: 'wheat', name: 'Wheat', symbol: 'WHEAT', panelId: 'market.wheat', category: 'agriculture', currency: 'USD', quoteCandidates: ['USD'], meta: { }, aliases: ['wheat', 'gandum'] },
  { asset: 'corn', name: 'Corn', symbol: 'CORN', panelId: 'market.corn', category: 'agriculture', currency: 'USD', quoteCandidates: ['USD'], meta: { }, aliases: ['corn', 'jagung'] },
  { asset: 'soybean', name: 'Soybean', symbol: 'SOYBEAN', panelId: 'market.soybean', category: 'agriculture', currency: 'USD', quoteCandidates: ['USD'], meta: { }, aliases: ['soybean', 'kedelai'] },

  // ── Currency (disabled provider) ──
  { asset: 'usd_idr', name: 'USD/IDR', symbol: 'USD/IDR', panelId: 'market.usd_idr', category: 'currency', currency: 'IDR', quoteCandidates: ['IDR'], meta: { }, aliases: ['usd/idr', 'dolar ke rupiah', 'kurs dolar', 'usd idr'] },
  { asset: 'eur_idr', name: 'EUR/IDR', symbol: 'EUR/IDR', panelId: 'market.eur_idr', category: 'currency', currency: 'IDR', quoteCandidates: ['IDR'], meta: { }, aliases: ['eur/idr', 'euro rupiah', 'eur idr'] },
  { asset: 'gbp_idr', name: 'GBP/IDR', symbol: 'GBP/IDR', panelId: 'market.gbp_idr', category: 'currency', currency: 'IDR', quoteCandidates: ['IDR'], meta: { }, aliases: ['gbp/idr', 'pound rupiah', 'gbp idr'] },
  { asset: 'sgd_idr', name: 'SGD/IDR', symbol: 'SGD/IDR', panelId: 'market.sgd_idr', category: 'currency', currency: 'IDR', quoteCandidates: ['IDR'], meta: { }, aliases: ['sgd/idr', 'sgd idr'] },
  { asset: 'jpy_idr', name: 'JPY/IDR', symbol: 'JPY/IDR', panelId: 'market.jpy_idr', category: 'currency', currency: 'IDR', quoteCandidates: ['IDR'], meta: { }, aliases: ['jpy/idr', 'yen rupiah', 'jpy idr'] },
  { asset: 'aud_idr', name: 'AUD/IDR', symbol: 'AUD/IDR', panelId: 'market.aud_idr', category: 'currency', currency: 'IDR', quoteCandidates: ['IDR'], meta: { }, aliases: ['aud/idr', 'aud idr'] },
  { asset: 'eur_usd', name: 'EUR/USD', symbol: 'EUR/USD', panelId: 'market.eur_usd', category: 'currency', currency: 'USD', quoteCandidates: ['USD'], meta: { }, aliases: ['eur/usd', 'euro dolar', 'eur usd'] },
  { asset: 'gbp_usd', name: 'GBP/USD', symbol: 'GBP/USD', panelId: 'market.gbp_usd', category: 'currency', currency: 'USD', quoteCandidates: ['USD'], meta: { }, aliases: ['gbp/usd', 'pound dolar', 'gbp usd'] },
  { asset: 'usd_jpy', name: 'USD/JPY', symbol: 'USD/JPY', panelId: 'market.usd_jpy', category: 'currency', currency: 'JPY', quoteCandidates: ['JPY'], meta: { }, aliases: ['usd/jpy', 'dolar yen', 'usd jpy'] },
  { asset: 'aud_usd', name: 'AUD/USD', symbol: 'AUD/USD', panelId: 'market.aud_usd', category: 'currency', currency: 'USD', quoteCandidates: ['USD'], meta: { }, aliases: ['aud/usd', 'aud usd'] },

  // ── Bonds (disabled provider) ──
  { asset: 'us10y', name: 'US 10Y Yield', symbol: 'US10Y', panelId: 'market.us10y', category: 'bonds', currency: 'PERCENT', quoteCandidates: ['PERCENT'], meta: { }, aliases: ['us10y', '10y yield', 'us 10 year'] },
  { asset: 'us5y', name: 'US 5Y Yield', symbol: 'US5Y', panelId: 'market.us5y', category: 'bonds', currency: 'PERCENT', quoteCandidates: ['PERCENT'], meta: { }, aliases: ['us5y', '5y yield'] },
  { asset: 'us30y', name: 'US 30Y Yield', symbol: 'US30Y', panelId: 'market.us30y', category: 'bonds', currency: 'PERCENT', quoteCandidates: ['PERCENT'], meta: { }, aliases: ['us30y', '30y yield'] },
  { asset: 'us2y', name: 'US 2Y Yield', symbol: 'US2Y', panelId: 'market.us2y', category: 'bonds', currency: 'PERCENT', quoteCandidates: ['PERCENT'], meta: { }, aliases: ['us2y', '2y yield'] }
];

const lowercaseAliasIndex = new Map();
for (const inst of CANONICAL_INSTRUMENTS) {
  const keys = new Set([inst.asset, inst.symbol, inst.panelId, ...(inst.aliases || [])]);
  for (const k of keys) {
    const lk = String(k).toLowerCase();
    if (!lowercaseAliasIndex.has(lk)) lowercaseAliasIndex.set(lk, []);
    lowercaseAliasIndex.get(lk).push(inst);
  }
}

/**
 * Provider fallback order per category (attempted in this order).
 * Binance → CoinGecko → disabled provider for crypto; disabled provider for everything else (disabled provider is the
 * real provider for stocks/indices/commodities/valas/bonds).
 */
export function providerChainFor(canonical) {
  if (canonical && canonical.category === 'crypto') return ['binance', 'coingecko', 'disabled provider'];
  return ['disabled provider'];
}

/**
 * Canonical resolution from ANY identifier: symbol, asset, alias, panelId, or a
 * full utterance ("harga BTC hari ini"). Always returns the same canonical shape.
 * @returns {object|null} canonical instrument or null when unresolvable
 */
export function resolveCanonicalInstrument(input) {
  if (!input) return null;
  const raw = String(input).trim();

  // PanelId or code or symbol exact match first.
  const exact = raw.toLowerCase();
  const exactHits = lowercaseAliasIndex.get(exact);
  if (exactHits && exactHits.length) return withDefaults(exactHits[0]);

  // Single token (symbol/alias) — tokenize and match any token.
  const tokens = raw.split(/[\s,;:/&._-]+/).filter(Boolean);
  for (const tok of tokens) {
    const hits = lowercaseAliasIndex.get(tok.toLowerCase());
    if (hits && hits.length) return withDefaults(resolveFavoured(hits, tok));
  }

  // Word-boundary scan over aliases inside a longer utterance.
  const lowered = ` ${raw.toLowerCase()} `;
  for (const inst of CANONICAL_INSTRUMENTS) {
    for (const alias of (inst.aliases || [])) {
      if (new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lowered)) {
        return withDefaults(inst);
      }
    }
  }
  return null;
}

/** pick exact symbol matches first when multiple instruments share a token */
function resolveFavoured(hits, token) {
  const sym = token.toLowerCase();
  const exactSym = hits.find((h) => String(h.symbol).toLowerCase() === sym);
  return exactSym || hits[0];
}

/** Add resolved provider chain + normalized quoteCandidates. */
function withDefaults(inst) {
  return {
    asset: inst.asset,
    name: inst.name,
    symbol: inst.symbol,
    panelId: inst.panelId,
    category: inst.category,
    currency: inst.currency,
    quoteCandidates: inst.quoteCandidates || [inst.currency],
    meta: { ...inst.meta },
    aliases: inst.aliases || [],
    providers: providerChainFor(inst)
  };
}

export default { CANONICAL_INSTRUMENTS, resolveCanonicalInstrument, providerChainFor };