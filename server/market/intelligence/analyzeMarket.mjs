/**
 * analyzeMarket.mjs - MIE v1 orkestrator analysis (makro LIVE)
 *
 * DATA: Yahoo (harga/seri) + FRED & BLS (makro AS live) - semua real, tanpa mock.
 * FLOW: Foreign flow IDX tidak punya sumber live gratis (idx.co.id 403) ->
 *       tetap MANUAL_SNAPSHOT. TIDAK PERNAH dikarang.
 * JUJUR: consensus tidak tersedia -> selalu null + flag.
 */
import { rsi, sma, atrFromCloses, bollinger, swingLevels, momentumLabel, trendLabel } from './TechnicalEngine.mjs';
import { buildScenarios, detectMarketState } from './ScenarioEngine.mjs';
import { loadMacroSnapshot } from './MacroStore.mjs';
import { fetchLiveMacro } from './MacroLiveEngine.mjs';
import { scoreMacro, buildScores } from './TransmissionEngine.mjs';
import { MIE_BASKET, fetchYahooCloses } from './MarketIntelligenceEngine.mjs';

const chg = (q) => (q.ok && q.last != null && q.prev ? ((q.last - q.prev) / q.prev) * 100 : null);
const quote = (q, label) => ({
  label, ok: q.ok, last: q.last ?? null, changePct: chg(q),
  currency: q.currency || null, source: q.ok ? q.source : null,
  sourceUrl: q.ok ? q.sourceUrl : null,
  dataStatus: q.ok ? (q.marketState === 'REGULAR' ? 'LIVE' : 'SNAPSHOT') : 'UNAVAILABLE',
  error: q.ok ? null : q.error
});

export async function analyzeMarket({ symbol = 'IHSG' } = {}) {
  const key = String(symbol || 'IHSG').toUpperCase();
  const target = MIE_BASKET[key] ? key : 'IHSG';
  const startedAt = new Date().toISOString();
  const [main, usdidr, dxy, us10y, wti, gold, btc, macroLive] = await Promise.all([
    fetchYahooCloses(MIE_BASKET[target].yahoo),
    fetchYahooCloses(MIE_BASKET.USDIDR.yahoo, '1mo'),
    fetchYahooCloses(MIE_BASKET.DXY.yahoo, '1mo'),
    fetchYahooCloses(MIE_BASKET.US10Y.yahoo, '1mo'),
    fetchYahooCloses(MIE_BASKET.WTI.yahoo, '1mo'),
    fetchYahooCloses(MIE_BASKET.GOLD.yahoo, '1mo'),
    fetchYahooCloses(MIE_BASKET.BTC.yahoo, '1mo'),
    fetchLiveMacro()
  ]);
  const closes = Array.isArray(main.closes) ? main.closes : [];
  const lastClose = main.ok ? main.last : null;
  const rsi14 = closes.length >= 15 ? rsi(closes) : null;
  const sma20v = closes.length >= 20 ? sma(closes, 20) : null;
  const sma50v = closes.length >= 50 ? sma(closes, 50) : null;
  const atr = closes.length >= 15 ? atrFromCloses(closes) : null;
  const bb = closes.length >= 20 ? bollinger(closes) : null;
  const { support, resistance } = swingLevels(closes);
  const usdidrChg = chg(usdidr);
  const rupiahMenguat = usdidrChg != null ? usdidrChg < 0 : null;

  // Makro LIVE -> transmisi -> dampak ke IHSG (bukan aturan "PCE turun = IHSG naik")
  const transmission = scoreMacro(macroLive, {
    dxyChangePct: chg(dxy),
    usdIdrChangePct: usdidrChg,
    us10yChangePct: chg(us10y)
  });

  // Foreign flow tetap manual: tidak ada sumber live gratis yang sah (idx.co.id 403)
  const flowSnap = loadMacroSnapshot();
  const flowDir = String(flowSnap?.foreignFlow?.direction || 'UNKNOWN').toUpperCase();
  const scenarios = buildScenarios({
    lastClose, support, resistance, rsi14,
    fxTailwind: rupiahMenguat === true,
    flowDirection: flowDir
  });
  const marketState = detectMarketState({ lastClose, sma20: sma20v, rsi14, support, resistance });

  const technical = {
    rsi14, sma20: sma20v, sma50: sma50v, atr, bollinger: bb,
    momentum: momentumLabel(rsi14),
    trend: trendLabel(lastClose, sma20v, sma50v),
    support, resistance,
    dataStatus: closes.length >= 15 ? 'COMPUTED_FROM_LIVE_SERIES' : 'UNAVAILABLE',
    note: closes.length >= 15
      ? `Dihitung dari ${closes.length} close harian Yahoo (real).`
      : 'Series tidak cukup.'
  };

  const scores = buildScores({
    macroScore: transmission.macroScore,
    technical,
    flow: { direction: flowDir },
    state: marketState
  });

  return {
    service: 'MARKET_INTELLIGENCE',
    engine: 'MIE_v1_live_macro',
    symbol: target,
    timestamp: startedAt,
    price: {
      last: lastClose,
      changePct: main.ok && main.prev ? ((main.last - main.prev) / main.prev) * 100 : null,
      currency: main.currency || MIE_BASKET[target].currency,
      dataStatus: main.ok ? (main.marketState === 'REGULAR' ? 'LIVE' : 'SNAPSHOT') : 'UNAVAILABLE',
      source: main.ok ? main.source : null,
      sourceUrl: main.ok ? main.sourceUrl : null,
      error: main.ok ? null : main.error
    },

    // Blok 1 & 2 infografik: DATA MAKRO AS + EFEK KE IHSG
    macro: {
      provider: macroLive.provider,
      dataStatus: macroLive.liveCount === macroLive.totalCount ? 'LIVE'
        : macroLive.liveCount > 0 ? 'PARTIAL' : 'UNAVAILABLE',
      retrievedAt: macroLive.retrievedAt,
      liveCount: macroLive.liveCount,
      totalCount: macroLive.totalCount,
      degraded: macroLive.degraded,
      asOf: macroLive.asOf,
      items: macroLive.items,
      consensusAvailable: false,
      consensusNote: 'Konsensus/ekspektasi tidak tersedia di sumber live gratis - TIDAK dikarang.',
      transmission
    },

    // Blok 3 infografik: RUPIAH
    fx: {
      usdidr: quote(usdidr, 'USD/IDR'),
      dxy: quote(dxy, 'DXY'),
      rupiahMenguat,
      transmissionPath: 'DXY & minyak melemah -> Rupiah menguat -> tekanan foreign flow berkurang -> katalis eksternal positif IHSG'
    },
    rates: { us10y: quote(us10y, 'US 10Y Yield') },
    commodities: { wti: quote(wti, 'WTI'), gold: quote(gold, 'Gold') },
    crypto: { btc: quote(btc, 'BTC') },

    // Blok 4 infografik: struktur teknikal
    technical,

    flow: {
      direction: flowDir,
      valueRpMiliar: flowSnap?.foreignFlow?.valueRpMiliar ?? null,
      dataStatus: flowDir !== 'UNKNOWN' ? 'MANUAL_SNAPSHOT' : 'UNAVAILABLE',
      honestNote: 'idx.co.id membalas 403 (Cloudflare). Tidak ada sumber live gratis yang sah untuk foreign flow - diisi manual, bukan live.',
      source: flowSnap?.foreignFlow?.source || null,
      sourceUrl: flowSnap?.foreignFlow?.sourceUrl || null
    },

    // Blok 5 infografik: SKENARIO
    scenarios,

    // Blok 6 infografik: MONITORING + CONFIRMATION
    confirmation: {
      macro: transmission.verdict,
      fx: rupiahMenguat === true ? 'SUPPORTIVE' : rupiahMenguat === false ? 'PRESSURE' : 'UNKNOWN',
      flow: flowDir,
      technical: rsi14 != null && rsi14 <= 30 ? 'OVERSOLD_BUT_UNCONFIRMED' : 'NOT_CONFIRMED',
      priceAction: marketState,
      scores,
      gate: 'BULLISH hanya jika: reclaim resistance pertama + volume naik + foreign net buy + USD/IDR menguat.',
      rule: 'Makro membaik TIDAK otomatis bullish. Butuh reclaim + volume + net buy.'
    },

    marketState,
    monitorList: buildMonitorList({ usdidr, usdidrChg, flowDir, resistance, support, lastClose })
  };
}

/** Blok 6 infografik: "yang perlu dipantau". */
function buildMonitorList({ usdidr, usdidrChg, flowDir, resistance, support, lastClose }) {
  const n = (v) => (v == null ? '—' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: 2 }));
  const r1 = Array.isArray(resistance) ? resistance[0] : null;
  const s1 = Array.isArray(support) ? support[0] : null;
  const items = [{
    no: 1,
    topic: 'USD/IDR',
    condition: 'kalau Rupiah terus menguat',
    current: usdidr?.ok ? `${usdidrChg >= 0 ? '+' : ''}${usdidrChg.toFixed(2)}%` : 'tidak tersedia',
    sourceUrl: usdidr?.sourceUrl || null
  }, {
    no: 2,
    topic: 'Foreign Flow',
    condition: 'kalau asing mulai net buy',
    current: flowDir,
    honest: flowDir === 'UNKNOWN'
  }, {
    no: 3,
    topic: 'Level IHSG',
    condition: r1 != null
      ? `reclaim ${n(r1)} dengan volume meningkat`
      : 'reclaim resistance pertama dengan volume meningkat',
    current: n(lastClose)
  }];
  if (s1 != null) {
    items.push({
      no: 4,
      topic: 'Risiko downside',
      condition: `jebol support ${n(s1)}`,
      current: 'BELUM'
    });
  }
  return items;
}

export default { analyzeMarket };
