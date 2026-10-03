/**
 * MarketIntelligenceEngine.mjs — MIE v1 Tahap 1 (orkestrator, part 1/2)
 * ONE function: analyzeMarket({ symbol }) -> JSON mirip infografik.
 * LIVE: IHSG/USDIDR/DXY/US10Y/WTI/GOLD/BTC via Yahoo. RSI/SMA/S/R real.
 * Macro PCE/NFP/Flow: MANUAL_SNAPSHOT jujur. TIDAK PERNAH mock.
 */
import { rsi, sma, atrFromCloses, bollinger, swingLevels, momentumLabel, trendLabel } from './TechnicalEngine.mjs';
import { buildScenarios, detectMarketState } from './ScenarioEngine.mjs';
import { loadMacroSnapshot, macroImpact } from './MacroStore.mjs';

export const MIE_BASKET = {
  IHSG: { yahoo: '^JKSE', currency: 'IDX' },
  USDIDR: { yahoo: 'USDIDR=X', currency: 'IDR' },
  DXY: { yahoo: 'DX-Y.NYB', currency: 'INDEX' },
  US10Y: { yahoo: '^TNX', currency: 'PERCENT' },
  WTI: { yahoo: 'CL=F', currency: 'USD' },
  GOLD: { yahoo: 'GC=F', currency: 'USD' },
  BTC: { yahoo: 'BTC-USD', currency: 'USD' }
};

const YAHOO_HOSTS = [
  'https://query1.finance.yahoo.com/v8/finance/chart',
  'https://query2.finance.yahoo.com/v8/finance/chart'
];

export async function fetchYahooCloses(ysymbol, range = '3mo', interval = '1d') {
  let lastErr = null;
  for (const host of YAHOO_HOSTS) {
    try {
      const url = `${host}/${encodeURIComponent(ysymbol)}?range=${range}&interval=${interval}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'JIN-Market-Intelligence/1.0', Accept: 'application/json' }
      });
      if (!res.ok) { lastErr = new Error(`Yahoo HTTP ${res.status} untuk ${ysymbol}`); continue; }
      const json = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result?.meta) throw new Error(`Yahoo meta kosong untuk ${ysymbol}`);
      const closes = result?.indicators?.quote?.[0]?.close?.filter((v) => Number.isFinite(v)) || [];
      const meta = result.meta;
      const last = Number(meta.regularMarketPrice);
      // PENTING: meta.chartPreviousClose adalah close SEBELUM RANGE (bukan kemarin),
      // jadi untuk range 1mo/3mo nilai itu menghasilkan perubahan bulanan, bukan harian.
      // Prioritaskan closes[-2] (session sebelumnya yang benar-benar ada di seri).
      const seriesPrev = closes.length >= 2 ? closes[closes.length - 2] : null;
      const prev = Number.isFinite(seriesPrev)
        ? seriesPrev
        : (Number.isFinite(Number(meta.chartPreviousClose)) ? Number(meta.chartPreviousClose) : NaN);
      return {
        ok: true, symbol: ysymbol,
        last: Number.isFinite(last) ? last : closes[closes.length - 1] ?? null,
        prev,
        prevBasis: Number.isFinite(seriesPrev) ? 'PREVIOUS_SESSION_CLOSE' : 'CHART_PREVIOUS_CLOSE',
        closes, currency: meta.currency || null, marketState: meta.marketState || null,
        source: 'Yahoo Finance',
        sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(ysymbol)}`,
        retrievedAt: Date.now()
      };
    } catch (err) { lastErr = err; }
  }
  return { ok: false, symbol: ysymbol, error: lastErr ? String(lastErr.message || lastErr) : 'unreachable' };
}
