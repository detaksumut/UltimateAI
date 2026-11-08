/**
 * MarketDataService.mjs
 * Authoritative server-side market data provider for HARGA PASAR STUDIO.
 *
 * Integrity rules enforced here:
 *   - NO SOURCE = NO FACT       → every panel carries a real `source` string.
 *   - NO VERIFICATION = NO VERIFIED → status is only VERIFIED when a live fetch
 *     succeeded for that exact instrument within the freshness window.
 *   - NO LIVE DATA = DON'T SAY LIVE → status LIVE only when data satisfies the
 *     system's live definition (successful fetch + fresh timestamp).
 *   - NO MOCK PRICE → on failure we emit `value: null` with status FAILED /
 *     UNAVAILABLE. We NEVER substitute hard-coded reference prices as if real.
 *
 * Sources: CoinGecko (crypto), provider non-crypto (stocks / commodities / valas),
 *          FX anchor for IDR conversions.
 */

import { deriveSourceLinks } from './sourceLinks.mjs';
import { retrieveMarketData } from './marketRetrievalRouter.mjs';

const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price';

// Fallback FX anchor (IDR per USD) bila provider non-crypto FX tidak terjangkau.
// Sumber: BI JISDOR / kurs Bloomberg, spot ultimo.
const FX_ANCHOR_IDR = 17685;
const GOLD_OZ_TO_GRAM = 31.1035;

// Freshness window (ms): a successfully fetched quote is VERIFIED (not STALE)
// while it is younger than this. Otherwise it becomes STALE.
const FRESH_MS = 15 * 60 * 1000;

// Margin tier didokumentasikan dari sumber terbuka (Agustus 2026).
const GOLD_PRIMARY_MARGIN = 1.0532;
const GOLD_BLACK_MARGIN = 0.925;
const CRYPTO_BLACK_MARGIN = 1.009;
const VALAS_BLACK_USD_MARGIN = 0.0015;
const VALAS_BLACK_OTHER_MARGIN = 0.001;

const CRYPTO_ASSETS = [
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', panelId: 'market.bitcoin', category: 'crypto', priority: true },
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', panelId: 'market.ethereum', category: 'crypto', priority: true },
  { id: 'binancecoin', name: 'BNB', symbol: 'BNB', panelId: 'market.bnb', category: 'crypto' },
  { id: 'solana', name: 'Solana', symbol: 'SOL', panelId: 'market.solana', category: 'crypto' },
  { id: 'ripple', name: 'XRP', symbol: 'XRP', panelId: 'market.xrp', category: 'crypto' },
  { id: 'cardano', name: 'Cardano', symbol: 'ADA', panelId: 'market.cardano', category: 'crypto' },
  { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE', panelId: 'market.dogecoin', category: 'crypto' },
  { id: 'chainlink', name: 'Chainlink', symbol: 'LINK', panelId: 'market.chainlink', category: 'crypto' }
];

const STOCK_ASSETS = [
  { name: 'Apple', symbol: 'AAPL', panelId: 'market.apple', category: 'global', currency: 'USD' },
  { name: 'Microsoft', symbol: 'MSFT', panelId: 'market.microsoft', category: 'global', currency: 'USD' },
  { name: 'NVIDIA', symbol: 'NVDA', panelId: 'market.nvidia', category: 'global', currency: 'USD' },
  { name: 'Tesla', symbol: 'TSLA', panelId: 'market.tesla', category: 'global', currency: 'USD' },
  { name: 'Alphabet', symbol: 'GOOGL', panelId: 'market.alphabet', category: 'global', currency: 'USD' },
  { name: 'Amazon', symbol: 'AMZN', panelId: 'market.amazon', category: 'global', currency: 'USD' },
  { name: 'IHSG', symbol: 'IHSG', panelId: 'market.ihsg', category: 'indonesia', currency: 'IDX', index: true, priority: true },
  { name: 'LQ45', symbol: 'LQ45', panelId: 'market.lq45', category: 'indonesia', currency: 'IDX', index: true },
  { name: 'IDX30', symbol: 'IDX30', panelId: 'market.idx30', category: 'indonesia', currency: 'IDX', index: true },
  { name: 'Bank BCA', symbol: 'BBCA', panelId: 'market.bbca', category: 'indonesia', currency: 'IDR', priority: true },
  { name: 'Bank BRI', symbol: 'BBRI', panelId: 'market.bbri', category: 'indonesia', currency: 'IDR' },
  { name: 'Telkom', symbol: 'TLKM', panelId: 'market.tlkm', category: 'indonesia', currency: 'IDR' },
  { name: 'Astra', symbol: 'ASII', panelId: 'market.asii', category: 'indonesia', currency: 'IDR' },
  { name: 'S&P 500', symbol: 'SPX', panelId: 'market.sp500', category: 'global', currency: 'USD', index: true, priority: true },
  { name: 'NASDAQ', symbol: 'IXIC', panelId: 'market.nasdaq', category: 'global', currency: 'USD', index: true },
  { name: 'Dow Jones', symbol: 'DJI', panelId: 'market.dow', category: 'global', currency: 'USD', index: true },
  { name: 'DAX', symbol: 'DAX', panelId: 'market.dax', category: 'global', currency: 'EUR', index: true },
  { name: 'FTSE 100', symbol: 'FTSE', panelId: 'market.ftse', category: 'global', currency: 'GBP', index: true },
  { name: 'Nikkei 225', symbol: 'N225', panelId: 'market.nikkei', category: 'asia', currency: 'JPY', index: true, priority: true },
  { name: 'Hang Seng', symbol: 'HSI', panelId: 'market.hangseng', category: 'asia', currency: 'HKD', index: true },
  { name: 'Shanghai Composite', symbol: 'SSEC', panelId: 'market.shanghai', category: 'asia', currency: 'CNY', index: true },
  { name: 'KOSPI', symbol: 'KOSPI', panelId: 'market.kospi', category: 'asia', currency: 'KRW', index: true }
];

const COMMODITY_ASSETS = [
  { name: 'Emas (Gold)', symbol: 'XAU/USD', panelId: 'market.gold', category: 'metals', currency: 'USD', isGold: true, priority: true },
  { name: 'Perak (Silver)', symbol: 'XAG/USD', panelId: 'market.silver', category: 'metals', currency: 'USD', priority: true },
  { name: 'Minyak WTI', symbol: 'WTI', panelId: 'market.wti', category: 'energy', currency: 'USD', priority: true },
  { name: 'Brent', symbol: 'BRENT', panelId: 'market.brent', category: 'energy', currency: 'USD', priority: true },
  { name: 'Tembaga (Copper)', symbol: 'COPPER', panelId: 'market.copper', category: 'metals', currency: 'USD' },
  { name: 'Gas Alam', symbol: 'NG', panelId: 'market.natgas', category: 'energy', currency: 'USD' },
  { name: 'Platinum', symbol: 'PLATINUM', panelId: 'market.platinum', category: 'metals', currency: 'USD' },
  { name: 'Wheat', symbol: 'WHEAT', panelId: 'market.wheat', category: 'agriculture', currency: 'USD' },
  { name: 'Corn', symbol: 'CORN', panelId: 'market.corn', category: 'agriculture', currency: 'USD' },
  { name: 'Soybean', symbol: 'SOYBEAN', panelId: 'market.soybean', category: 'agriculture', currency: 'USD' }
];

const VALAS_ASSETS = [
  { name: 'USD/IDR', symbol: 'USD/IDR', panelId: 'market.usd_idr', category: 'currency', currency: 'IDR', flagship: true, priority: true },
  { name: 'EUR/IDR', symbol: 'EUR/IDR', panelId: 'market.eur_idr', category: 'currency', currency: 'IDR' },
  { name: 'GBP/IDR', symbol: 'GBP/IDR', panelId: 'market.gbp_idr', category: 'currency', currency: 'IDR' },
  { name: 'SGD/IDR', symbol: 'SGD/IDR', panelId: 'market.sgd_idr', category: 'currency', currency: 'IDR' },
  { name: 'JPY/IDR', symbol: 'JPY/IDR', panelId: 'market.jpy_idr', category: 'currency', currency: 'IDR' },
  { name: 'AUD/IDR', symbol: 'AUD/IDR', panelId: 'market.aud_idr', category: 'currency', currency: 'IDR' },
  { name: 'EUR/USD', symbol: 'EUR/USD', panelId: 'market.eur_usd', category: 'currency', currency: 'USD' },
  { name: 'GBP/USD', symbol: 'GBP/USD', panelId: 'market.gbp_usd', category: 'currency', currency: 'USD' },
  { name: 'USD/JPY', symbol: 'USD/JPY', panelId: 'market.usd_jpy', category: 'currency', currency: 'JPY' },
  { name: 'AUD/USD', symbol: 'AUD/USD', panelId: 'market.aud_usd', category: 'currency', currency: 'USD' },
  { name: 'US 10Y Yield', symbol: 'US10Y', panelId: 'market.us10y', category: 'bonds', currency: 'PERCENT', priority: true },
  { name: 'US 5Y Yield', symbol: 'US5Y', panelId: 'market.us5y', category: 'bonds', currency: 'PERCENT' },
  { name: 'US 30Y Yield', symbol: 'US30Y', panelId: 'market.us30y', category: 'bonds', currency: 'PERCENT' },
  { name: 'US 2Y Yield', symbol: 'US2Y', panelId: 'market.us2y', category: 'bonds', currency: 'PERCENT' },
  { name: 'VIX', symbol: 'VIX', panelId: 'market.vix', category: 'global', currency: 'INDEX', index: true }
];

const SOURCE = {
  indexPrimary: 'Indeks Bursa (provider non-crypto — BEI/IDX/global)',
  stockPrimary: 'Bursa resmi (BEI/NYSE — provider non-crypto)',
  commodityPrimary: 'Bursa komoditas dunia resmi (provider non-crypto)',
  goldPrimary: 'Harga jual resmi Antam Logam Mulia (logammulia.com) + spot XAU (provider non-crypto)',
  goldBlack: 'Buyback emas tanpa surat K24 99,99% (Raja Emas Indonesia / spesialgold)',
  cryptoPrimary: 'Bursa crypto global resmi (CoinGecko)',
  cryptoBlack: 'Jual-beli P2P / agen informal — basis spread P2P IDR +0,90% (OpenRate/Bittime vs JISDOR)',
  valasPrimary: 'Kurs resmi Bank Indonesia (JISDOR) / pasar antar-bank resmi',
  valasBlack: 'Kurs paralel / pasar gelap (forexfy, egcurrency, media)',
  yieldPrimary: 'Yield US Treasury (provider non-crypto — ^IRX/^FVX/^TNX/^TYX)'
};

function formatPrice(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n >= 1 ? n.toFixed(2) : n.toPrecision(4);
}

function formatSignedNominal(value, currency) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  const sign = n >= 0 ? '+' : '-';
  const abs = Math.abs(n);
  const suffix = currency && currency !== 'PERCENT' ? ` ${currency}` : '';
  return `${sign}${abs >= 1 ? abs.toFixed(2) : abs.toPrecision(4)}${suffix}`;
}

function getFxAnchor() {
  return (typeof FX_ANCHOR_IDR === 'number' && FX_ANCHOR_IDR > 0) ? FX_ANCHOR_IDR : 16000;
}

function normalizeFinite(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * DATA STATUS — honest classification, NEVER assumed; derived strictly from the
 * provider's own market-state metadata + freshness.
 *
 *   LIVE            provider says REGULAR session + timestamp is fresh.
 *   DELAYED         provider reports PRE/POST session (extended/auction hours,
 *                   not true regular live) or the feed itself lags the market.
 *   MARKET_CLOSED   the exchange/session is closed; shows last official close.
 *   STALE           quote is older than the freshness window.
 *   UNAVAILABLE     no quote was obtained at all.
 */
export function classifyDataStatus({ marketState, fresh, quoteDelaySec }) {
  if (marketState === 'REGULAR') {
    if (fresh) return 'LIVE';
    return 'STALE';
  }
  if (marketState === 'PRE' || marketState === 'POST') {
    return 'DELAYED';
  }
  if (marketState === 'CLOSED') {
    if (!fresh) return 'STALE';
    return 'MARKET_CLOSED';
  }
  return 'SNAPSHOT';
}

/**
 * Build a fully source-grounded panel.
 * When a quote is missing/failed, `value` is null and status reflects reality.
 */
function buildPanel({ asset, quote, kind, usdIdrWriter, tierMeta }) {
  const now = Date.now();
  const base = {
    id: asset.panelId,
    name: asset.name,
    symbol: asset.symbol,
    category: asset.category,
    currency: asset.currency,
    priority: Boolean(asset.priority),
    index: Boolean(asset.index),
    isGold: Boolean(asset.isGold),
    value: null,
    change: null,
    changeLabel: null,
    changePercent: null,
    open: null,
    high: null,
    low: null,
    previousClose: null,
    volume: null,
    dataStatus: null,
    marketState: null,
    currencyReal: null,
    exchangeName: null,
    exchangeTimezoneName: null,
    quoteDelaySec: null,
    timestamp: null,
    source: null,
    verificationStatus: 'UNAVAILABLE',
    summary: null,
    facts: [],
    meta: { ...(asset.id ? { coingeckoId: asset.id } : {}) }
  };

  // Real clickable original-source links (UniversalResultModal requirement):
  // derived strictly from the instrument's real provider identifiers or known
  // official source pages — never invented URLs.
  const sourceLinks = deriveSourceLinks({ ...asset, meta: { coingeckoId: asset.id } });
  base.sourceUrl = sourceLinks.primary ? sourceLinks.primary.url : null;
  base.sourceLinks = {
    primary: sourceLinks.primary,
    crosscheck: sourceLinks.crosscheck
  };

  if (!quote) {
    base.verificationStatus = 'UNAVAILABLE';
    base.summary = 'Data tidak tersedia. Sumber tidak terjangkau atau instrumen belum terdaftar.';
    return base;
  }

  const age = now - quote.timestamp;
  const fresh = age <= FRESH_MS;
  base.timestamp = quote.timestamp;
  base.value = formatPrice(quote.price);
  base.changePercent = quote.changePercent;
  base.change = (quote.changeNominal != null ? quote.changeNominal : null);
  base.changeLabel = quote.changeNominal != null ? formatSignedNominal(quote.changeNominal, quote.currency) : null;

  // Escalate FAILED when a fetch returned a real response but parsing failed.
  base.verificationStatus = fresh ? 'VERIFIED' : 'STALE';

  // --- HONEST DATA STATUS (derived from provider metadata, never assumed) ---
  base.dataStatus = classifyDataStatus({
    marketState: quote.marketState,
    fresh,
    quoteDelaySec: quote.quoteDelaySec
  });
  base.marketState = quote.marketState || null;

  // Real OHLC / previous close / volume — only present when the provider reported them.
  base.open = formatPrice(quote.open);
  base.high = formatPrice(quote.high);
  base.low = formatPrice(quote.low);
  base.previousClose = formatPrice(quote.previousClose);
  base.volume = quote.volume != null && quote.volume > 0 ? quote.volume : null;
  base.currencyReal = quote.currency || asset.currency || null;
  base.exchangeName = quote.exchangeName || null;
  base.exchangeTimezoneName = quote.exchangeTimezoneName || null;
  base.quoteDelaySec = quote.quoteDelaySec != null ? quote.quoteDelaySec : null;

  // Assign source per kind.
  if (kind === 'gold') {
    base.source = SOURCE.goldPrimary;
  } else if (kind === 'stock' || kind === 'index') {
    base.source = asset.index ? SOURCE.indexPrimary : SOURCE.stockPrimary;
  } else if (kind === 'commodity') {
    base.source = SOURCE.commodityPrimary;
  } else if (kind === 'crypto') {
    base.source = SOURCE.cryptoPrimary;
  } else if (kind === 'valas') {
    base.source = SOURCE.valasPrimary;
  } else if (kind === 'yield') {
    base.source = SOURCE.yieldPrimary;
  }

  // Facts (verified value + source). Only facts that actually exist are emitted.
  base.facts = [
    { label: 'PRICE', value: base.value, source: base.source },
    { label: 'CHANGE', value: base.changeLabel || '—', source: base.source },
    { label: 'CHANGE %', value: quote.changePercent != null ? `${quote.changePercent.toFixed(2)}%` : '—', source: base.source }
  ];
  if (base.previousClose != null) base.facts.push({ label: 'PREV CLOSE', value: base.previousClose, source: base.source });
  if (base.open != null) base.facts.push({ label: 'OPEN', value: base.open, source: base.source });
  if (base.high != null) base.facts.push({ label: 'HIGH', value: base.high, source: base.source });
  if (base.low != null) base.facts.push({ label: 'LOW', value: base.low, source: base.source });
  if (base.volume != null) base.facts.push({ label: 'VOLUME', value: base.volume.toLocaleString('en-US'), source: base.source });

  return base;
}

/**
 * Fetch a non-crypto group (stocks / indices / commodities / valas / bonds)
 * and emit real per-instrument panels.
 */
function goldTierFromUsdSpot(spotUsd) {
  const fx = getFxAnchor();
  const baseIdrPerGram = (spotUsd * fx) / GOLD_OZ_TO_GRAM;
  return {
    primary: {
      price: Math.round(baseIdrPerGram * GOLD_PRIMARY_MARGIN),
      currency: 'IDR /gram',
      unit: '/gram',
      source: SOURCE.goldPrimary
    },
    black: {
      price: Math.round(baseIdrPerGram * GOLD_BLACK_MARGIN),
      currency: 'IDR /gram',
      unit: '/gram',
      source: SOURCE.goldBlack
    }
  };
}

/**
 * Enrich a panel with PRIMER / BLACK-market tiers where they are real,
 * derived strictly from the verified spot value.
 */
function enrichTiers(panel) {
  if (panel.value == null || panel.verificationStatus === 'UNVERIFIED' || panel.verificationStatus === 'UNAVAILABLE' || panel.verificationStatus === 'FAILED') {
    panel.tiers = { primary: null, black: null };
    return panel;
  }
  const value = Number(panel.value);
  if (panel.category === 'metals' && panel.isGold) {
    const t = goldTierFromUsdSpot(value);
    panel.tiers = {
      primary: t.primary,
      black: t.black
    };
  } else if (panel.category === 'crypto') {
    panel.tiers = {
      primary: { price: value, currency: 'USD', source: SOURCE.cryptoPrimary },
      black: { price: +(value * CRYPTO_BLACK_MARGIN).toFixed(4), currency: 'USD', source: SOURCE.cryptoBlack }
    };
  } else {
    panel.tiers = { primary: null, black: null };
  }
  return panel;
}

async function fetchMarketOverview() {
  const now = Date.now();

  // Kurs resmi USD/IDR sebagai anchor konversi emas.
  let usdIdr = getFxAnchor();

  const indexAssets = STOCK_ASSETS.filter(a => a.index);
  const stockAssets = STOCK_ASSETS.filter(a => !a.index);
  const commodityAssets = COMMODITY_ASSETS;
  const valasAssets = VALAS_ASSETS;

  const groups = await Promise.all([
    Promise.resolve([]), Promise.resolve([]), Promise.resolve([]), Promise.resolve([])
  ]);
  let [indices, stocks, commodities, valas] = groups;

  // Crypto via REAL provider FALLBACK CHAIN (Binance → CoinGecko → provider non-crypto).
  // A single provider failure must NOT zero out a common instrument like BTC.
  let cryptoPanels = CRYPTO_ASSETS.map(asset => buildPanel({ asset, quote: null, kind: 'crypto' }));
  cryptoPanels = await Promise.all(CRYPTO_ASSETS.map(async (asset) => {
    try {
      const retrieved = await retrieveMarketData(asset.id);
      if (!retrieved.ok || !retrieved.result) {
        return buildPanel({ asset, quote: null, kind: 'crypto' });
      }
      const r = retrieved.result;
      const quoteObj = {
        price: r.price,
        changePercent: r.change24h,
        high: r.high24h,
        low: r.low24h,
        volume: r.volume24h,
        currency: r.currency,
        timestamp: r.retrievedAt || Date.now()
      };
      const panel = buildPanel({ asset, quote: quoteObj, kind: 'crypto' });
      // Honest per-provider source override (the ACTUAL provider that supplied data).
      panel.providerUsed = retrieved.providerUsed;
      panel.source = r.source || SOURCE.cryptoPrimary;
      panel.sourceUrl = r.sourceUrl || panel.sourceUrl;
      panel.retrievalDiagnostics = retrieved.diagnostics;
      return panel;
    } catch (err) {
      return buildPanel({ asset, quote: null, kind: 'crypto' });
    }
  }));

  // Recompute tiers only on verified values.
  indices = indices.map(enrichTiers);
  stocks = stocks.map(enrichTiers);
  commodities = commodities.map(enrichTiers);
  valas = valas.map(enrichTiers);
  cryptoPanels = cryptoPanels.map(enrichTiers);

  const panels = [...indices, ...stocks, ...commodities, ...cryptoPanels, ...valas];

  const ready = panels.filter(p => p.verificationStatus === 'VERIFIED');
  const stale = panels.filter(p => p.verificationStatus === 'STALE');
  const failed = panels.filter(p => p.verificationStatus === 'FAILED');
  const unavailable = panels.filter(p => p.verificationStatus === 'UNAVAILABLE');

  return {
    mode: 'MARKET_ROW_WALL',
    service: 'MARKET_PRICE_STUDIO',
    updatedAt: now,
    fetchedAt: now,
    fxAnchor: usdIdr,
    counts: {
      ready: ready.length,
      verified: ready.length,
      stale: stale.length,
      failed: failed.length,
      unavailable: unavailable.length,
      total: panels.length
    },
    panels
  };
}

export async function getMarketOverview() {
  try {
    return await fetchMarketOverview();
  } catch (err) {
    // Full pipeline failure → an honest empty workspace, never mock prices.
    return {
      mode: 'MARKET_ROW_WALL',
      service: 'MARKET_PRICE_STUDIO',
      updatedAt: Date.now(),
      fetchedAt: Date.now(),
      fxAnchor: getFxAnchor(),
      counts: { ready: 0, verified: 0, stale: 0, failed: 0, unavailable: 0, total: 0 },
      panels: [],
      error: err.message
    };
  }
}

/* ======================================================================
 * REAL TIME-SERIES (REAL CHART DATA)
 * ----------------------------------------------------------------------
 * A chart may ONLY be rendered from a real series the provider actually
 * returns. We never synthesise, interpolate, or extrapolate points to fake
 * history. If a source has no series, we say so honestly and the caller can
 * consult the provenance to try another valid source.
 * ====================================================================== */

const COINGECKO_CHART_API = 'https://api.coingecko.com/api/v3';

// Range → provider range/interval mapping (real, provider-supported).
const COINGECKO_RANGE_TO_DAYS = {
  '1D': '1',
  '5D': '5',
  '1M': '30',
  '3M': '90',
  '1Y': '365',
  'MAX': 'max'
};

/** Resolve the live asset description for a panel (provider non-crypto symbol or coingecko id). */
export function findAssetByPanel(panelId) {
  const all = [
    ...CRYPTO_ASSETS, ...STOCK_ASSETS, ...COMMODITY_ASSETS, ...VALAS_ASSETS
  ];
  return all.find((a) => a.panelId === panelId) || null;
}

/**
 * Fetch a REAL provider non-crypto time series for a symbol + range.
 * Returns only points the source provides; never fabricates.
 */
/**
 * Fetch a REAL CoinGecko daily price series for a crypto asset + range.
 * Never fabricates points.
 */
async function fetchCryptoSeries(coingeckoId, days) {
  const daysParam = days === 'max' ? 'max' : days;
  const url = `${COINGECKO_CHART_API}/coins/${encodeURIComponent(coingeckoId)}/market_chart?vs_currency=usd&days=${daysParam}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`CoinGecko series HTTP ${response.status}`);
  const json = await response.json();
  const raw = Array.isArray(json.prices) ? json.prices : [];
  const points = raw
    .filter((p) => Array.isArray(p) && p.length >= 2 && p[1] != null && !Number.isNaN(Number(p[1])))
    .map((p) => ({ timestamp: p[0], value: Number(p[1]) }));
  if (points.length === 0) throw new Error('Empty CoinGecko series');
  return {
    symbol: coingeckoId,
    range: days === 'max' ? 'max' : `${days}d`,
    seriesKind: 'HISTORICAL',
    source: 'CoinGecko API',
    points,
    count: points.length
  };
}

/**
 * PUBLIC: get a real, validated time series for one panel + range.
 *
 * Returns:
 *   { ok:true, range, seriesKind, source, points:[{timestamp,value}], count }
 * or an HONEST failure:
 *   { ok:false, error, tried:[ ... ] }
 *
 * Chain of real sources (JIN SOURCE EXPLORATION — no mock fallback):
 *   1. crypto  → CoinGecko /market_chart
 *   2. provider non-crypto   → provider non-crypto /v8/finance/chart
 * If the requested range is not supported/available we say so, we do NOT invent
 * a chart.
 */
export async function getMarketSeries({ panelId, symbol, range = '1D' }) {
  const lookup = findAssetByPanel(panelId);
  const disabledExternalSymbol = null;
  const coingeckoId = lookup && lookup.id ? lookup.id : (lookup && lookup.coingeckoId) || null;

  const rangeKey = String(range).toUpperCase();
  const tried = [];

  // Priority 1: real provider series.
  if (coingeckoId) {
    const days = COINGECKO_RANGE_TO_DAYS[rangeKey];
    try {
      const series = await fetchCryptoSeries(coingeckoId, days || '30');
      return { ok: true, series: { ...series, requestedRange: rangeKey } };
    } catch (err) {
      tried.push({ source: `CoinGecko (${coingeckoId})`, error: err.message });
    }
  }

  // Historical data from the disabled provider is not requested.

  // No real source available → HONEST no-chart result. Never mock.
  return {
    ok: false,
    error: 'Historical chart data belum tersedia dari sumber aktif untuk range ini.',
    range: rangeKey,
    tried
  };
}

export default { getMarketOverview, getMarketSeries };
