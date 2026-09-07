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
 *     meta: { yahoo: 'BTC-USD', coingeckoId: 'bitcoin', binance: 'BTCUSDT' },
 *     providers: ['binance','coingecko','yahoo']   // ordered fallback chain
 *   }
 *
 * "BTC", "Bitcoin", "harga BTC", "harga Bitcoin hari ini", "BTC sekarang" and
 * "market.bitcoin" MUST ALL resolve to the same canonical object.
 */

// ── Canonical registry: the authoritative provider-identifier map ────────────
// meta.yahoo   → Yahoo Finance identifier          (e.g. BTC-USD, ^JKSE, GC=F, USDIDR=X)
// meta.coingeckoId → CoinGecko id (crypto only)
// meta.binance → Binance spot pair (crypto only)
// quoteCandidates → real quote currencies the instrument trades in
export const CANONICAL_INSTRUMENTS = [
  // ── Crypto (multi-provider) ──
  { asset: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', panelId: 'market.bitcoin', category: 'crypto', currency: 'USD', quoteCandidates: ['USD', 'USDT', 'IDR'], meta: { yahoo: 'BTC-USD', coingeckoId: 'bitcoin', binance: 'BTCUSDT' }, aliases: ['btc', 'bitcoin', 'bitcoin?'] },
  { asset: 'ethereum', name: 'Ethereum', symbol: 'ETH', panelId: 'market.ethereum', category: 'crypto', currency: 'USD', quoteCandidates: ['USD', 'USDT', 'IDR'], meta: { yahoo: 'ETH-USD', coingeckoId: 'ethereum', binance: 'ETHUSDT' }, aliases: ['eth', 'ethereum', 'ether'] },
  { asset: 'solana', name: 'Solana', symbol: 'SOL', panelId: 'market.solana', category: 'crypto', currency: 'USD', quoteCandidates: ['USD', 'USDT', 'IDR'], meta: { yahoo: 'SOL-USD', coingeckoId: 'solana', binance: 'SOLUSDT' }, aliases: ['solana', 'sol'] },
  { asset: 'ripple', name: 'XRP', symbol: 'XRP', panelId: 'market.xrp', category: 'crypto', currency: 'USD', quoteCandidates: ['USD', 'USDT', 'IDR'], meta: { yahoo: 'XRP-USD', coingeckoId: 'ripple', binance: 'XRPUSDT' }, aliases: ['xrp', 'ripple'] },
  { asset: 'cardano', name: 'Cardano', symbol: 'ADA', panelId: 'market.cardano', category: 'crypto', currency: 'USD', quoteCandidates: ['USD', 'USDT', 'IDR'], meta: { yahoo: 'ADA-USD', coingeckoId: 'cardano', binance: 'ADAUSDT' }, aliases: ['ada', 'cardano'] },
  { asset: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE', panelId: 'market.dogecoin', category: 'crypto', currency: 'USD', quoteCandidates: ['USD', 'USDT', 'IDR'], meta: { yahoo: 'DOGE-USD', coingeckoId: 'dogecoin', binance: 'DOGEUSDT' }, aliases: ['doge', 'dogecoin'] },
  { asset: 'binancecoin', name: 'BNB', symbol: 'BNB', panelId: 'market.bnb', category: 'crypto', currency: 'USD', quoteCandidates: ['USD', 'USDT', 'IDR'], meta: { yahoo: 'BNB-USD', coingeckoId: 'binancecoin', binance: 'BNBUSDT' }, aliases: ['bnb', 'binance coin'] },
  { asset: 'chainlink', name: 'Chainlink', symbol: 'LINK', panelId: 'market.chainlink', category: 'crypto', currency: 'USD', quoteCandidates: ['USD', 'USDT', 'IDR'], meta: { yahoo: 'LINK-USD', coingeckoId: 'chainlink', binance: 'LINKUSDT' }, aliases: ['chainlink', 'link'] },

  // ── Global / US stocks & indices (Yahoo) ──
  { asset: 'apple', name: 'Apple', symbol: 'AAPL', panelId: 'market.apple', category: 'global', currency: 'USD', quoteCandidates: ['USD'], meta: { yahoo: 'AAPL' }, aliases: ['apeple', 'appl', 'apple', 'aapl'] },
  { asset: 'microsoft', name: 'Microsoft', symbol: 'MSFT', panelId: 'market.microsoft', category: 'global', currency: 'USD', quoteCandidates: ['USD'], meta: { yahoo: 'MSFT' }, aliases: ['msft', 'microsoft'] },
  { asset: 'nvidia', name: 'NVIDIA', symbol: 'NVDA', panelId: 'market.nvidia', category: 'global', currency: 'USD', quoteCandidates: ['USD'], meta: { yahoo: 'NVDA' }, aliases: ['nvda', 'nvidia'] },
  { asset: 'tesla', name: 'Tesla', symbol: 'TSLA', panelId: 'market.tesla', category: 'global', currency: 'USD', quoteCandidates: ['USD'], meta: { yahoo: 'TSLA' }, aliases: ['tesla', 'tsla'] },
  { asset: 'alphabet', name: 'Alphabet', symbol: 'GOOGL', panelId: 'market.alphabet', category: 'global', currency: 'USD', quoteCandidates: ['USD'], meta: { yahoo: 'GOOGL' }, aliases: ['alphabet', 'googl', 'google'] },
  { asset: 'amazon', name: 'Amazon', symbol: 'AMZN', panelId: 'market.amazon', category: 'global', currency: 'USD', quoteCandidates: ['USD'], meta: { yahoo: 'AMZN' }, aliases: ['amazon', 'amzn'] },
  { asset: 'sp500', name: 'S&P 500', symbol: 'SPX', panelId: 'market.sp500', category: 'global', currency: 'USD', quoteCandidates: ['USD'], meta: { yahoo: '^GSPC' }, aliases: ['sp500', 's&p 500', 'spx', 's&p'] },
  { asset: 'nasdaq', name: 'NASDAQ', symbol: 'IXIC', panelId: 'market.nasdaq', category: 'global', currency: 'USD', quoteCandidates: ['USD'], meta: { yahoo: '^IXIC' }, aliases: ['nasdaq', 'ixic'] },
  { asset: 'dow', name: 'Dow Jones', symbol: 'DJI', panelId: 'market.dow', category: 'global', currency: 'USD', quoteCandidates: ['USD'], meta: { yahoo: '^DJI' }, aliases: ['dow jones', 'dow', 'dji'] },
  { asset: 'vix', name: 'VIX', symbol: 'VIX', panelId: 'market.vix', category: 'global', currency: 'INDEX', quoteCandidates: ['USD'], meta: { yahoo: '^VIX' }, aliases: ['vix'] },

  // ── Indonesia (Yahoo) ──
  { asset: 'ihsg', name: 'IHSG', symbol: 'IHSG', panelId: 'market.ihsg', category: 'indonesia', currency: 'IDX', quoteCandidates: ['IDX', 'IDR'], meta: { yahoo: '^JKSE' }, aliases: ['ihsg', 'idx composite', 'jkse', 'bursa efek indonesia'] },
  { asset: 'lq45', name: 'LQ45', symbol: 'LQ45', panelId: 'market.lq45', category: 'indonesia', currency: 'IDX', quoteCandidates: ['IDX', 'IDR'], meta: { yahoo: '^JKLQ45' }, aliases: ['lq45', 'lq 45'] },
  { asset: 'idx30', name: 'IDX30', symbol: 'IDX30', panelId: 'market.idx30', category: 'indonesia', currency: 'IDX', quoteCandidates: ['IDX', 'IDR'], meta: { yahoo: 'IDX30.JK' }, aliases: ['idx30', 'idx 30'] },
  { asset: 'bbca', name: 'Bank BCA', symbol: 'BBCA', panelId: 'market.bbca', category: 'indonesia', currency: 'IDR', quoteCandidates: ['IDR'], meta: { yahoo: 'bbca.JK' }, aliases: ['bbca', 'bank bca', 'bca'] },
  { asset: 'bbri', name: 'Bank BRI', symbol: 'BBRI', panelId: 'market.bbri', category: 'indonesia', currency: 'IDR', quoteCandidates: ['IDR'], meta: { yahoo: 'bbri.JK' }, aliases: ['bbri', 'bank bri', 'bri'] },
  { asset: 'tlkm', name: 'Telkom', symbol: 'TLKM', panelId: 'market.tlkm', category: 'indonesia', currency: 'IDR', quoteCandidates: ['IDR'], meta: { yahoo: 'tlkm.JK' }, aliases: ['tlkm', 'telkom'] },
  { asset: 'asii', name: 'Astra', symbol: 'ASII', panelId: 'market.asii', category: 'indonesia', currency: 'IDR', quoteCandidates: ['IDR'], meta: { yahoo: 'asii.JK' }, aliases: ['asii', 'astra'] },

  // ── Asia / global indices (Yahoo) ──
  { asset: 'nikkei', name: 'Nikkei 225', symbol: 'N225', panelId: 'market.nikkei', category: 'asia', currency: 'JPY', quoteCandidates: ['JPY'], meta: { yahoo: '^N225' }, aliases: ['nikkei', 'n225'] },
  { asset: 'hangseng', name: 'Hang Seng', symbol: 'HSI', panelId: 'market.hangseng', category: 'asia', currency: 'HKD', quoteCandidates: ['HKD'], meta: { yahoo: '^HSI' }, aliases: ['hang seng', 'hsi'] },
  { asset: 'shanghai', name: 'Shanghai Composite', symbol: 'SSEC', panelId: 'market.shanghai', category: 'asia', currency: 'CNY', quoteCandidates: ['CNY'], meta: { yahoo: '000001.SS' }, aliases: ['shanghai', 'ssec'] },
  { asset: 'kospi', name: 'KOSPI', symbol: 'KS11', panelId: 'market.kospi', category: 'asia', currency: 'KRW', quoteCandidates: ['KRW'], meta: { yahoo: '^KS11' }, aliases: ['kospi', 'ks11'] },
  { asset: 'dax', name: 'DAX', symbol: 'DAX', panelId: 'market.dax', category: 'global', currency: 'EUR', quoteCandidates: ['EUR'], meta: { yahoo: '^GDAXI' }, aliases: ['dax'] },
  { asset: 'ftse', name: 'FTSE 100', symbol: 'FTSE', panelId: 'market.ftse', category: 'global', currency: 'GBP', quoteCandidates: ['GBP'], meta: { yahoo: '^FTSE' }, aliases: ['ftse', 'ftse 100'] },

  // ── Metals (Yahoo) ──
  { asset: 'gold', name: 'Emas (Gold)', symbol: 'XAU/USD', panelId: 'market.gold', category: 'metals', currency: 'USD', quoteCandidates: ['USD', 'IDR'], meta: { yahoo: 'GC=F' }, aliases: ['emas', 'gold', 'xau', 'logam mulia'] },
  { asset: 'silver', name: 'Perak (Silver)', symbol: 'XAG/USD', panelId: 'market.silver', category: 'metals', currency: 'USD', quoteCandidates: ['USD'], meta: { yahoo: 'SI=F' }, aliases: ['perak', 'silver', 'xag'] },
  { asset: 'copper', name: 'Tembaga (Copper)', symbol: 'COPPER', panelId: 'market.copper', category: 'metals', currency: 'USD', quoteCandidates: ['USD'], meta: { yahoo: 'HG=F' }, aliases: ['tembaga', 'copper'] },
  { asset: 'platinum', name: 'Platinum', symbol: 'PLATINUM', panelId: 'market.platinum', category: 'metals', currency: 'USD', quoteCandidates: ['USD'], meta: { yahoo: 'PL=F' }, aliases: ['platinum'] },

  // ── Energy (Yahoo) ──
  { asset: 'wti', name: 'Minyak WTI', symbol: 'WTI', panelId: 'market.wti', category: 'energy', currency: 'USD', quoteCandidates: ['USD'], meta: { yahoo: 'CL=F' }, aliases: ['minyak wti', 'wti', 'minyak mentah'] },
  { asset: 'brent', name: 'Brent', symbol: 'BRENT', panelId: 'market.brent', category: 'energy', currency: 'USD', quoteCandidates: ['USD'], meta: { yahoo: 'BZ=F' }, aliases: ['brent', 'minyak brent'] },
  { asset: 'natgas', name: 'Gas Alam', symbol: 'NG', panelId: 'market.natgas', category: 'energy', currency: 'USD', quoteCandidates: ['USD'], meta: { yahoo: 'NG=F' }, aliases: ['gas alam', 'natgas', 'natural gas'] },

  // ── Agriculture (Yahoo) ──
  { asset: 'wheat', name: 'Wheat', symbol: 'WHEAT', panelId: 'market.wheat', category: 'agriculture', currency: 'USD', quoteCandidates: ['USD'], meta: { yahoo: 'ZW=F' }, aliases: ['wheat', 'gandum'] },
  { asset: 'corn', name: 'Corn', symbol: 'CORN', panelId: 'market.corn', category: 'agriculture', currency: 'USD', quoteCandidates: ['USD'], meta: { yahoo: 'ZC=F' }, aliases: ['corn', 'jagung'] },
  { asset: 'soybean', name: 'Soybean', symbol: 'SOYBEAN', panelId: 'market.soybean', category: 'agriculture', currency: 'USD', quoteCandidates: ['USD'], meta: { yahoo: 'ZS=F' }, aliases: ['soybean', 'kedelai'] },

  // ── Currency (Yahoo) ──
  { asset: 'usd_idr', name: 'USD/IDR', symbol: 'USD/IDR', panelId: 'market.usd_idr', category: 'currency', currency: 'IDR', quoteCandidates: ['IDR'], meta: { yahoo: 'USDIDR=X' }, aliases: ['usd/idr', 'dolar ke rupiah', 'kurs dolar', 'usd idr'] },
  { asset: 'eur_idr', name: 'EUR/IDR', symbol: 'EUR/IDR', panelId: 'market.eur_idr', category: 'currency', currency: 'IDR', quoteCandidates: ['IDR'], meta: { yahoo: 'EURIDR=X' }, aliases: ['eur/idr', 'euro rupiah', 'eur idr'] },
  { asset: 'gbp_idr', name: 'GBP/IDR', symbol: 'GBP/IDR', panelId: 'market.gbp_idr', category: 'currency', currency: 'IDR', quoteCandidates: ['IDR'], meta: { yahoo: 'GBPIDR=X' }, aliases: ['gbp/idr', 'pound rupiah', 'gbp idr'] },
  { asset: 'sgd_idr', name: 'SGD/IDR', symbol: 'SGD/IDR', panelId: 'market.sgd_idr', category: 'currency', currency: 'IDR', quoteCandidates: ['IDR'], meta: { yahoo: 'SGDIDR=X' }, aliases: ['sgd/idr', 'sgd idr'] },
  { asset: 'jpy_idr', name: 'JPY/IDR', symbol: 'JPY/IDR', panelId: 'market.jpy_idr', category: 'currency', currency: 'IDR', quoteCandidates: ['IDR'], meta: { yahoo: 'JPYIDR=X' }, aliases: ['jpy/idr', 'yen rupiah', 'jpy idr'] },
  { asset: 'aud_idr', name: 'AUD/IDR', symbol: 'AUD/IDR', panelId: 'market.aud_idr', category: 'currency', currency: 'IDR', quoteCandidates: ['IDR'], meta: { yahoo: 'AUDIDR=X' }, aliases: ['aud/idr', 'aud idr'] },
  { asset: 'eur_usd', name: 'EUR/USD', symbol: 'EUR/USD', panelId: 'market.eur_usd', category: 'currency', currency: 'USD', quoteCandidates: ['USD'], meta: { yahoo: 'EURUSD=X' }, aliases: ['eur/usd', 'euro dolar', 'eur usd'] },
  { asset: 'gbp_usd', name: 'GBP/USD', symbol: 'GBP/USD', panelId: 'market.gbp_usd', category: 'currency', currency: 'USD', quoteCandidates: ['USD'], meta: { yahoo: 'GBPUSD=X' }, aliases: ['gbp/usd', 'pound dolar', 'gbp usd'] },
  { asset: 'usd_jpy', name: 'USD/JPY', symbol: 'USD/JPY', panelId: 'market.usd_jpy', category: 'currency', currency: 'JPY', quoteCandidates: ['JPY'], meta: { yahoo: 'USDJPY=X' }, aliases: ['usd/jpy', 'dolar yen', 'usd jpy'] },
  { asset: 'aud_usd', name: 'AUD/USD', symbol: 'AUD/USD', panelId: 'market.aud_usd', category: 'currency', currency: 'USD', quoteCandidates: ['USD'], meta: { yahoo: 'AUDUSD=X' }, aliases: ['aud/usd', 'aud usd'] },

  // ── Bonds (Yahoo) ──
  { asset: 'us10y', name: 'US 10Y Yield', symbol: 'US10Y', panelId: 'market.us10y', category: 'bonds', currency: 'PERCENT', quoteCandidates: ['PERCENT'], meta: { yahoo: '^TNX' }, aliases: ['us10y', '10y yield', 'us 10 year'] },
  { asset: 'us5y', name: 'US 5Y Yield', symbol: 'US5Y', panelId: 'market.us5y', category: 'bonds', currency: 'PERCENT', quoteCandidates: ['PERCENT'], meta: { yahoo: '^FVX' }, aliases: ['us5y', '5y yield'] },
  { asset: 'us30y', name: 'US 30Y Yield', symbol: 'US30Y', panelId: 'market.us30y', category: 'bonds', currency: 'PERCENT', quoteCandidates: ['PERCENT'], meta: { yahoo: '^TYX' }, aliases: ['us30y', '30y yield'] },
  { asset: 'us2y', name: 'US 2Y Yield', symbol: 'US2Y', panelId: 'market.us2y', category: 'bonds', currency: 'PERCENT', quoteCandidates: ['PERCENT'], meta: { yahoo: '^IRX' }, aliases: ['us2y', '2y yield'] }
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
 * Binance → CoinGecko → Yahoo for crypto; Yahoo for everything else (Yahoo is the
 * real provider for stocks/indices/commodities/valas/bonds).
 */
export function providerChainFor(canonical) {
  if (canonical && canonical.category === 'crypto') return ['binance', 'coingecko', 'yahoo'];
  return ['yahoo'];
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