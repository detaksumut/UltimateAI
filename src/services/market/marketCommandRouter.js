/**
 * marketCommandRouter.js
 * Single command router for HARGA PASAR STUDIO panel navigation.
 *
 * CLICK and VOICE both funnel into this router so they resolve to the SAME
 * `market.<id>` panel. The keyword → panel mapping below is deliberately the
 * same table used for direct clicks.
 *
 * Returns:
 *   - { type: 'PANEL', panelId: 'market.gold' }
 *   - { type: 'WALL' }                        → open the full Market Row Wall
 *   - { type: 'FILTER', filterId: 'crypto' }  → open wall scoped to a category
 *   - { type: 'NONE' }
 */

const ALIASES = [
  { keywords: ['emas', 'gold', 'xau'], panelId: 'market.gold' },
  { keywords: ['perak', 'silver', 'xag'], panelId: 'market.silver' },
  { keywords: ['bitcoin', 'btc'], panelId: 'market.bitcoin' },
  { keywords: ['ethereum', 'eth'], panelId: 'market.ethereum' },
  { keywords: ['bnb'], panelId: 'market.bnb' },
  { keywords: ['solana', 'sol'], panelId: 'market.solana' },
  { keywords: ['xrp', 'ripple'], panelId: 'market.xrp' },
  { keywords: ['ihsg', 'jkse', 'idx composite'], panelId: 'market.ihsg' },
  { keywords: ['lq45'], panelId: 'market.lq45' },
  { keywords: ['idx30'], panelId: 'market.idx30' },
  { keywords: ['bank central asia', 'bank bca', 'bbca'], panelId: 'market.bbca' },
  { keywords: ['bank rakyat', 'bri', 'bbri'], panelId: 'market.bbri' },
  { keywords: ['telkom', 'tlkm'], panelId: 'market.tlkm' },
  { keywords: ['astra', 'asii'], panelId: 'market.asii' },
  { keywords: ['usd idr', 'usd/idr', 'dolar rupiah', 'dolar indonesia', 'kurs dolar'], panelId: 'market.usd_idr' },
  { keywords: ['s&p 500', 'sp500', 's&p', 'spx'], panelId: 'market.sp500' },
  { keywords: ['nasdaq', 'ixic'], panelId: 'market.nasdaq' },
  { keywords: ['dow jones', 'dow', 'dji'], panelId: 'market.dow' },
  { keywords: ['dax'], panelId: 'market.dax' },
  { keywords: ['ftse'], panelId: 'market.ftse' },
  { keywords: ['nikkei', 'n225'], panelId: 'market.nikkei' },
  { keywords: ['hang seng', 'hangseng', 'hsi'], panelId: 'market.hangseng' },
  { keywords: ['shanghai', 'ssec'], panelId: 'market.shanghai' },
  { keywords: ['kospi'], panelId: 'market.kospi' },
  { keywords: ['minyak wti', 'wti', 'crude'], panelId: 'market.wti' },
  { keywords: ['brent'], panelId: 'market.brent' },
  { keywords: ['gas alam', 'natural gas', 'natgas'], panelId: 'market.natgas' },
  { keywords: ['tembaga', 'copper'], panelId: 'market.copper' },
  { keywords: ['platinum'], panelId: 'market.platinum' },
  { keywords: ['gandum', 'wheat'], panelId: 'market.wheat' },
  { keywords: ['jagung', 'corn'], panelId: 'market.corn' },
  { keywords: ['kedelai', 'soybean'], panelId: 'market.soybean' },
  { keywords: ['us10y', 'us 10y', 'ten tahun us', 'yield 10'], panelId: 'market.us10y' },
  { keywords: ['us2y', 'us 2y'], panelId: 'market.us2y' },
  { keywords: ['us5y', 'us 5y'], panelId: 'market.us5y' },
  { keywords: ['us30y', 'us 30y'], panelId: 'market.us30y' },
  { keywords: ['vix'], panelId: 'market.vix' },
  { keywords: ['bank indonesia', 'bi rate', 'suku bunga bi'], panelId: 'market.bi_rate' }
];

const WALL_KEYWORDS = ['harga pasar', 'market price', 'semua harga', 'harga pasar studio', 'pasar saham', 'market wall', 'row wall'];

// Category names → filter id (opening the wall scoped to a row).
const CATEGORY_ALIASES = [
  { keywords: ['crypto', 'kripto', 'cryptocurrency'], filterId: 'crypto' },
  { keywords: ['pasar indonesia', 'indonesia', 'ihsg semua'], filterId: 'indonesia' },
  { keywords: ['emas semua', 'metals', 'logam'], filterId: 'metals' },
  { keywords: ['energi', 'energy'], filterId: 'energy' },
  { keywords: ['forex', 'valas', 'currency'], filterId: 'currency' },
  { keywords: ['global', 'amerika'], filterId: 'global' },
  { keywords: ['asia'], filterId: 'asia' },
  { keywords: ['pertanian', 'agriculture'], filterId: 'agriculture' },
  { keywords: ['obligasi', 'bonds', 'surat utang'], filterId: 'bonds' }
];

function normalize(text) {
  return (text || '').toLowerCase().replace(/[.,;!?]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function resolveMarketCommand(text) {
  const t = normalize(text);
  if (!t) return { type: 'NONE' };

  // 0. CHART intent — "JIN buka grafik BTC", "tampilkan grafik BTC dari Binance",
  //    "JIN ganti ke TradingView". Resolves to an independent Chart Studio.
  const chartWordIntent = /(grafik|chart|candlestick|kandil|chart studio|line chart|garis harga|pergerakan harga)/.test(t);
  const sourceSwitchIntent = /(ganti ke|switch to|ubah ke|pindah ke|gunakan|pakai|set ke)/.test(t)
    && /(binance|tradingview|open source|sumber|provider)/.test(t);
  if (chartWordIntent || sourceSwitchIntent) {
    let providerId = null;
    if (/(open source|tradingview|sumber asli|sumber unit)/.test(t)) {
      providerId = 'open_source';
    } else if (/binance/.test(t)) {
      providerId = 'binance';
    }
    for (const alias of ALIASES) {
      for (const kw of alias.keywords) {
        if (t.includes(kw)) {
          return { type: 'CHART', panelId: alias.panelId, providerId };
        }
      }
    }
    return { type: 'CHART', panelId: null, providerId };
  }

  // 1. Exact panel alias.
  for (const alias of ALIASES) {
    for (const kw of alias.keywords) {
      if (t.includes(kw)) {
        return { type: 'PANEL', panelId: alias.panelId };
      }
    }
  }

  // 2. Category-scoped wall ("buka semua crypto", "tampilkan pasar indonesia").
  for (const alias of CATEGORY_ALIASES) {
    const opensWall = /buka|buat|tampilkan|tunjuk|lihat|semua|all/.test(t);
    for (const kw of alias.keywords) {
      if (t.includes(kw) && /buka|buat|tampilkan|tunjuk|lihat|semua|all/.test(t)) {
        return { type: 'FILTER', filterId: alias.filterId };
      }
      if (opensWall && t.includes(kw) && (t.includes('semua') || t.includes('all'))) {
        return { type: 'FILTER', filterId: alias.filterId };
      }
    }
  }

  // 3. Whole wall.
  for (const kw of WALL_KEYWORDS) {
    if (t.includes(kw)) return { type: 'WALL' };
  }

  return { type: 'NONE' };
}

export default { resolveMarketCommand };
