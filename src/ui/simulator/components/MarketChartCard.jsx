import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveMarketCommand } from '../../../services/market/marketCommandRouter.js';

const ENDPOINT = 'http://127.0.0.1:20200';
const RANGES = ['1D', '5D', '1M', '3M'];

// A user request is only treated as a market request when it ACTUALLY talks about
// market data. This prevents unrelated asks (e.g. a song lyric request) from being
// pushed through the open-world resolver and producing a nonsense card.
const MARKET_INTENT_RE = /(grafik|chart|candlestick|pergerakan|ticker|quote|berapakah\s+harga|harga|harga\s+pasar|pasar\s+saham|kurs|nilai\s+tukar|kode\s+saham)\b|\b(ihsg|jkse|lq45|idx\d*|saham|emas|perak|bitcoin|btc|ethereum|eth|solana|solo\b|xrp|doge|bnb|dolar|mata\s+uang|reksa\s+dana|obligasi|nikkei|brent|minyak|wti|dow|nasdaq|sp500|usd)\b/i;

function stripInstrumentNoise(s) {
  return String(s || '')
    .replace(/^(jin\s+)?(tolong\s+|bisa\s+|bisa\s+kamu\s+|buatkan\s+|tampilkan\s+|lihat\s+|buka\s+|tunjuk(kan|in)?\s+|perlihatkan\s+|carikan\s+)?/i, '')
    .replace(/\b(grafik|chart|candlestick|pergerakan|harga|saham|ticker|quote|sekarang|hari\s+ini|dari|semua|crypto|kripto)\b/gi, ' ')
    .replace(/["'\\[\](){},;:!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CATEGORY_LABEL = {
  indonesia: 'Indonesia',
  emas: 'Komoditas',
  crypto: 'Kripto',
  energy: 'Energi',
  currency: 'Valas',
  global: 'Global'
};

const ARROW_UP = '\u25B2';
const ARROW_DOWN = '\u25BC';
const EM_DASH = '\u2014';
const ELLIPSIS = '\u2026';

function instrumentNameFromPanel(panelId) {
  return String(panelId || '').replace(/^market\./, '').toUpperCase();
}

function fmtPrice(value, currency) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return EM_DASH;
  const n = Number(value);
  const s = n >= 1 ? n.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : n.toPrecision(4);
  return currency && currency !== 'PERCENT' ? `${s} ${currency}` : s;
}

function fmtTime(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    }) + ' WIB';
  } catch {
    return '';
  }
}

function LineChartSvg({ points, up }) {
  const w = 580;
  const h = 150;
  const [width, height] = [w, h];

  if (!points || points.length < 2) return null;

  const values = points.map(p => Number(p.value));
  let min = Math.min(...values);
  let max = Math.max(...values);
  const pad = (max - min) * 0.12 || (max * 0.01 || 1);
  min -= pad;
  max += pad;

  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (width - 8) + 4;
    const y = height - 6 - ((Number(p.value) - min) / (max - min)) * (height - 12);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const area = `${path} L${width - 4},${height - 4} L4,${height - 4} Z`;
  const stroke = up ? '#34d399' : '#f87171';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Grafik">
      <defs>
        <linearGradient id="mccFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#mccFill)" />
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/**
 * MarketChartCard — REAL market data rendered inline in the JIN conversation.
 *
 * Two resolution modes:
 *  - panelId: a known canonical panel (e.g. market.bbca) — fetched directly.
 *  - name:    an OPEN-WORLD instrument (anything the user asked). Resolved
 *             autonomously via /api/market/resolve (web search + live Yahoo
 *             verification), then the verified ticker is used for quote+series.
 */
export default function MarketChartCard({ panelId, name, title }) {
  const [range, setRange] = useState('1D');
  const [quote, setQuote] = useState(null);
  const [series, setSeries] = useState(null);
  const [resolved, setResolved] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!panelId && !name) return;
    setLoading(true);
    setError('');
    setResolved(null);

    const load = async () => {
      try {
        let quoteQ = null;
        let quoteSymbol = '';
        let seriesUrl = null;
        let pendingResolution = null;

        if (panelId) {
          quoteQ = instrumentNameFromPanel(panelId);
          seriesUrl = `${ENDPOINT}/api/market/series?panelId=${encodeURIComponent(panelId)}&range=${encodeURIComponent(range)}`;
        } else if (name) {
          const resolveRes = await fetch(`${ENDPOINT}/api/market/resolve?q=${encodeURIComponent(name)}`);
          let resolveData = null;
          try { resolveData = await resolveRes.json(); } catch { /* ignore */ }
          if (resolveData && resolveData.ok && resolveData.ticker) {
            const ticker = resolveData.ticker;
            pendingResolution = {
              name: (resolveData.canonical && resolveData.canonical.name) || name,
              ticker,
              source: resolveData.source,
              evidence: resolveData.evidence || null
            };
            quoteQ = name;
            quoteSymbol = ticker;
            seriesUrl = `${ENDPOINT}/api/market/series?symbol=${encodeURIComponent(ticker)}&range=${encodeURIComponent(range)}`;
          } else {
            setError(resolveData && resolveData.message
              ? resolveData.message
              : `Tidak dapat mengidentifikasi instrumen "${name}" ke instrumen pasar nyata yang terverifikasi.`);
          }
        }

        if (!seriesUrl || !quoteQ) return;

        const quoteUrl = quoteSymbol
          ? `${ENDPOINT}/api/market/quote?q=${encodeURIComponent(quoteQ)}&symbol=${encodeURIComponent(quoteSymbol)}`
          : `${ENDPOINT}/api/market/quote?q=${encodeURIComponent(quoteQ)}`;
        const [qData, sData] = await Promise.all([
          fetch(quoteUrl).then(r => r.json()),
          fetch(seriesUrl).then(r => r.json())
        ]);
        if (!mountedRef.current) return;

        if (pendingResolution) setResolved(pendingResolution);

        if (qData && qData.ok && qData.result) {
          setQuote(qData.result);
        } else {
          setQuote(null);
          if (qData && qData.message) setError(qData.message);
        }

        if (sData && sData.ok && sData.series && Array.isArray(sData.series.points)) {
          setSeries(sData.series);
        } else {
          setSeries(null);
        }
      } catch (e) {
        if (mountedRef.current) {
          setQuote(null);
          setSeries(null);
          setError(String(e && e.message ? e.message : e));
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    load();
  }, [panelId, name, range]);

  const change = quote && quote.changePercent != null ? Number(quote.changePercent) : null;
  const up = change != null ? change >= 0 : null;
  const changeLabel = change != null
    ? `${change >= 0 ? '+' : ''}${change.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`
    : '';

  const points = useMemo(() => (series && series.points) || null, [series]);
  const displayName = title || (resolved && resolved.name) || (quote && quote.asset) || panelId || name || 'Pasar';
  const webSource = resolved && resolved.source === 'WEB_SEARCH' ? resolved : null;

  return (
    <div className="my-2 rounded-xl border border-cyan-500/25 bg-[#02060e]/95 shadow-lg shadow-cyan-950/40 overflow-hidden">
      <div className="px-3 py-2 border-b border-cyan-500/20 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse flex-shrink-0" />
          <span className="font-bold text-[11px] text-cyan-100 tracking-wider uppercase truncate">
            {displayName}
          </span>
          {quote && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${up ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
              {up ? ARROW_UP : ARROW_DOWN} {changeLabel || EM_DASH}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {webSource && (
            <span className="text-[8px] px-1.5 py-0.5 rounded font-mono bg-blue-500/15 text-blue-300 mr-1 truncate max-w-[140px]">
              via pencarian web
            </span>
          )}
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ${range === r ? 'bg-cyan-500/25 text-cyan-200' : 'text-slate-400 hover:text-cyan-300'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 py-2">
        {loading ? (
          <div className="text-[10px] text-slate-400 font-mono py-6 text-center">{`Memuat data pasar real${ELLIPSIS}`}</div>
        ) : error ? (
          <div className="text-[10px] text-red-300/80 font-mono py-4 break-words">{error}</div>
        ) : (
          <>
            <div className="flex items-baseline gap-2 flex-wrap mb-1">
              <span className="text-xl font-bold text-slate-100 font-mono tabular-nums">
                {quote ? fmtPrice(quote.price, quote.currency) : (series && series.points && series.points.length ? fmtPrice(series.points[series.points.length - 1].value) : EM_DASH)}
              </span>
              {series && series.source && (
                <span className="text-[9px] text-slate-500 font-mono">sumber: {series.source}</span>
              )}
            </div>

            {points && points.length >= 2 ? (
              <LineChartSvg points={points} up={up === null ? true : up} />
            ) : (
              <div className="text-[10px] text-slate-400 font-mono py-4 text-center">
                Data seri belum tersedia untuk rentang ini.
              </div>
            )}

            {(quote && quote.marketState) || (webSource && webSource.ticker) ? (
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                {quote && quote.marketState && (
                  <span className={`text-[8px] px-1 py-0.5 rounded font-mono ${
                    quote.marketState === 'REGULAR' ? 'bg-emerald-500/15 text-emerald-300'
                      : quote.marketState === 'CLOSED' ? 'bg-slate-500/15 text-slate-300' : 'bg-amber-500/15 text-amber-300'
                  }`}>
                    {quote.marketState}
                  </span>
                )}
                {webSource && webSource.ticker && (
                  <span className="text-[8px] px-1 py-0.5 rounded font-mono bg-blue-500/10 text-blue-300">
                    ticker: {webSource.ticker}
                  </span>
                )}
                {quote && quote.regularMarketTime && (
                  <span className="text-[9px] text-slate-500 font-mono">{fmtTime(quote.regularMarketTime)}</span>
                )}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Extracts the market identity to render from assistant content / user request.
 * Priority:
 * 0. The USER's own request is the strongest signal — if it resolves to a known
 *    panel, it always wins. This prevents an abbreviated/hallucinated marker from
 *    the model (e.g. `[Grafik Pasar: BMA]` for Bank Mandiri) hijacking the chart.
 * 1. Any `[Grafik Pasar: NAMA]` markers in the assistant reply that resolve to a
 *    known panel (deterministic router).
 * 2. Open-world markers → passed through as {name} so the card resolves them
 *    autonomously (web search + live Yahoo verification).
 * 3. Fallback: the user's request itself (known or open-world). Guarantees the
 *    card shows even when the model forgets the marker completely.
 * @returns {{panelId?:string, name?:string}|null}
 */
export function extractMarketPanel(content, requestText = '') {
  const markerRe = /\[Grafik Pasar:\s*([^\]]+)\]/gi;
  const markers = [];
  let m;
  while ((m = markerRe.exec(content || ''))) markers.push(m[1].trim());

  const req = String(requestText || '');
  const reqResolved = resolveMarketCommand('grafik ' + req);
  const isChart = (r) => r && (r.type === 'CHART' || r.type === 'PANEL');

  // The user's own words are intent. Explicit market vocabulary counts; so does a
  // SHORT utterance (≤3 words) that hits a known instrument alias ("BCA", "emas").
  const reqIntent = MARKET_INTENT_RE.test(req)
    || (isChart(reqResolved) && reqResolved.panelId && req.trim().split(/\s+/).filter(Boolean).length <= 3);

  if (reqIntent && isChart(reqResolved) && reqResolved.panelId) return { panelId: reqResolved.panelId };

  for (const markerName of markers) {
    const r = resolveMarketCommand('grafik ' + markerName);
    if (isChart(r) && r.panelId) return { panelId: r.panelId };
  }

  if (markers.length) return { name: markers[0] };

  // Open-world fallback — ONLY when the wording is genuinely about market data
  // (never a lyric/YT/casual chat). Pass the cleaned instrument token, not the
  // raw sentence, so the autonomous resolver isn't fed a paragraph.
  if (isChart(reqResolved) && MARKET_INTENT_RE.test(req)) {
    const name = stripInstrumentNoise(req).split(/\s+/).slice(0, 3).join(' ');
    if (name) return { name };
  }
  return null;
}