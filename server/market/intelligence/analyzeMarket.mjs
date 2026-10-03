/**
 * analyzeMarket.mjs — MIE v1 Tahap 1 (orkestrator, part 2/2)
 */
import { rsi, sma, atrFromCloses, bollinger, swingLevels, momentumLabel, trendLabel } from './TechnicalEngine.mjs';
import { buildScenarios, detectMarketState } from './ScenarioEngine.mjs';
import { loadMacroSnapshot, macroImpact } from './MacroStore.mjs';
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
  const [main, usdidr, dxy, us10y, wti, gold, btc] = await Promise.all([
    fetchYahooCloses(MIE_BASKET[target].yahoo),
    fetchYahooCloses(MIE_BASKET.USDIDR.yahoo, '1mo'),
    fetchYahooCloses(MIE_BASKET.DXY.yahoo, '1mo'),
    fetchYahooCloses(MIE_BASKET.US10Y.yahoo, '1mo'),
    fetchYahooCloses(MIE_BASKET.WTI.yahoo, '1mo'),
    fetchYahooCloses(MIE_BASKET.GOLD.yahoo, '1mo'),
    fetchYahooCloses(MIE_BASKET.BTC.yahoo, '1mo')
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
  const macroSnap = loadMacroSnapshot();
  const macro = macroImpact(macroSnap);
  const flowDir = macroSnap?.foreignFlow?.direction || 'UNKNOWN';
  const scenarios = buildScenarios({ lastClose, support, resistance, rsi14, fxTailwind: rupiahMenguat === true, flowDirection: flowDir });
  const marketState = detectMarketState({ lastClose, sma20: sma20v, rsi14, support, resistance });
  return {
    service: 'MARKET_INTELLIGENCE', engine: 'MIE_v1_tahap1', symbol: target, timestamp: startedAt,
    price: {
      last: lastClose,
      changePct: main.ok && main.prev ? ((main.last - main.prev) / main.prev) * 100 : null,
      currency: main.currency || MIE_BASKET[target].currency,
      dataStatus: main.ok ? (main.marketState === 'REGULAR' ? 'LIVE' : 'SNAPSHOT') : 'UNAVAILABLE',
      source: main.ok ? main.source : null, sourceUrl: main.ok ? main.sourceUrl : null,
      error: main.ok ? null : main.error
    },
    fx: { usdidr: quote(usdidr, 'USD/IDR'), dxy: quote(dxy, 'DXY'), rupiahMenguat },
    rates: { us10y: quote(us10y, 'US 10Y Yield') },
    commodities: { wti: quote(wti, 'WTI'), gold: quote(gold, 'Gold') },
    crypto: { btc: quote(btc, 'BTC') },
    technical: {
      rsi14, sma20: sma20v, sma50: sma50v, atr, bollinger: bb,
      momentum: momentumLabel(rsi14), trend: trendLabel(lastClose, sma20v, sma50v),
      support, resistance,
      dataStatus: closes.length >= 15 ? 'COMPUTED_FROM_LIVE_SERIES' : 'UNAVAILABLE',
      note: closes.length >= 15 ? `Dihitung dari ${closes.length} close harian Yahoo (real).` : 'Series tidak cukup.'
    },
    macro: {
      items: macro, snapshot: macroSnap,
      dataStatus: macroSnap.updatedAt ? 'MANUAL_SNAPSHOT' : 'UNAVAILABLE',
      note: macroSnap.updatedAt ? `Input manual ${macroSnap.updatedAt}. Bukan live.` : 'PCE/NFP/Flow belum diinput.'
    },
    flow: { direction: flowDir, valueRpMiliar: macroSnap?.foreignFlow?.valueRpMiliar ?? null, dataStatus: macroSnap.updatedAt ? 'MANUAL_SNAPSHOT' : 'UNAVAILABLE' },
    scenarios, marketState,
    confirmation: {
      macro: macro.every((m) => m.impact === 'POSITIVE') ? 'POSITIVE' : macro.some((m) => m.impact === 'UNKNOWN') ? 'WAITING_DATA' : 'MIXED',
      fx: rupiahMenguat === true ? 'SUPPORTIVE' : rupiahMenguat === false ? 'PRESSURE' : 'UNKNOWN',
      flow: flowDir, priceAction: marketState,
      technical: rsi14 != null && rsi14 <= 30 ? 'OVERSOLD_BUT_UNCONFIRMED' : 'NOT_CONFIRMED',
      rule: 'Makro membaik TIDAK otomatis bullish. Butuh reclaim + volume + net buy.'
    }
  };
}

export default { analyzeMarket };
