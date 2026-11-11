import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RouterConfig } from '../../services/router/RouterConfig.js';

// ── Live quote wiring ─────────────────────────────────────────────────────────
// Factors that map to a real market instrument. Other factors are macro/news
// driven (CPI, Fed decisions, COT, geopolitics) and have no live price feed, so
// they intentionally show no price chip.
const FACTOR_LIVE_KEYS = {
  dxy_weak: ['dxy'],
  dxy_strong: ['dxy'],
  usd_demand: ['dxy'],
  fed_dovish: ['us10y'],
  fed_hawkish: ['us10y'],
  real_yields_neg: ['us10y'],
  real_yields_pos: ['us10y'],
  equitas_turun: ['spx'],
  risk_on: ['spx'],
  overbought: ['xauusd'],
};

const LIVE_LABEL = {
  dxy: 'DXY',
  us10y: 'US10Y',
  wti: 'WTI',
  spx: 'S&P 500',
  xauusd: 'XAUUSD',
};

const LIVE_STATUS_COLOR = {
  LIVE: '#34d399',
  REGULAR: '#34d399',
  DELAYED: '#fbbf24',
  STALE: '#fb7185',
  CLOSED: '#94a3b8',
  UNAVAILABLE: '#94a3b8',
};

function formatLiveValue(quote) {
  if (!quote || !Number.isFinite(quote.value)) return '—';
  if (quote.unit === 'percent') return `${quote.value.toFixed(2)}%`;
  if (quote.unit === 'usd_per_bbl' || quote.unit === 'usd_per_oz') {
    return `$${quote.value.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return quote.value.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

function formatLiveChange(quote) {
  if (!quote) return '—';
  if (Number.isFinite(quote.change) && quote.changeUnit === 'pp') {
    return `${quote.change > 0 ? '+' : ''}${quote.change.toFixed(2)} pp`;
  }
  if (Number.isFinite(quote.changePercent)) {
    return `${quote.changePercent > 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%`;
  }
  if (Number.isFinite(quote.change)) {
    return `${quote.change > 0 ? '+' : ''}${quote.change.toFixed(2)}`;
  }
  return '—';
}

async function loadQuotePayload(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Kuotasi pasar HTTP ${response.status}.`);
    const payload = await response.json();
    if (!Array.isArray(payload?.quotes)) throw new Error('Format kuotasi pasar tidak valid.');
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLiveQuotes() {
  // Relative first: in dev the Vite proxy and on Vercel the /api function both
  // serve this route same-origin. Absolute LocalRouter is the fallback for
  // Electron/LAN hosts that do not proxy /api.
  const urls = ['/api/trading/intermarket-quotes', RouterConfig.api('/trading/intermarket-quotes')];
  let payload = null;
  let lastError = null;
  for (const url of urls) {
    try {
      payload = await loadQuotePayload(url, 15000);
      break;
    } catch (e) {
      lastError = e;
    }
  }
  if (!payload) throw lastError || new Error('Kuotasi pasar tidak tersedia.');

  const map = {};
  for (const q of payload.quotes) {
    if (!Number.isFinite(q?.price)) continue;
    const key = String(q.symbol || '').toLowerCase();
    const isYield = key === 'us10y' || key === 'us02y';
    map[key] = {
      key,
      value: q.price,
      change: Number.isFinite(q.change) ? q.change : null,
      changePercent: !isYield && Number.isFinite(q.changePercent) ? q.changePercent : null,
      changeUnit: isYield ? 'pp' : 'price',
      unit: isYield ? 'percent'
        : key === 'xauusd' || key === 'xagusd' ? 'usd_per_oz'
          : key === 'wti' || key === 'brent' ? 'usd_per_bbl'
            : null,
      provider: q.source || 'Yahoo Finance',
      status: q.marketState && q.marketState !== 'UNKNOWN' ? q.marketState : 'DELAYED',
      updatedAt: q.quoteAt || null,
      label: LIVE_LABEL[key] || q.symbol,
    };
  }
  return map;
}

// ── Bullish Factors ────────────────────────────────────────────────────────────
const BULLISH_FACTORS = [
  {
    id: 'dxy_weak', icon: '📉', weight: 'SANGAT KUAT',
    wColor: '#10b981', wBg: 'rgba(16,185,129,0.1)', wBorder: 'rgba(16,185,129,0.3)',
    title: 'DXY Melemah (USD Lemah)',
    short: 'USD turun → Gold lebih murah bagi pembeli global → permintaan naik',
    detail: 'Korelasi negatif kuat antara DXY Index dan XAUUSD. Secara historis, DXY turun 1% berkorelasi dengan Gold naik ~0.8–1.2%. Pelemahan USD dipicu: Fed dovish, defisit fiskal membesar, atau mata uang lain menguat. Monitor DXY di TradingView (simbol: DXY).',
  },
  {
    id: 'inflation_high', icon: '🔥', weight: 'SANGAT KUAT',
    wColor: '#10b981', wBg: 'rgba(16,185,129,0.1)', wBorder: 'rgba(16,185,129,0.3)',
    title: 'Inflasi Tinggi / Real Rates Negatif',
    short: 'CPI/PCE tinggi → real interest rates negatif → Gold sebagai lindung nilai',
    detail: 'Real Rate = Nominal Rate – Inflasi. Ketika inflasi melebihi suku bunga nominal, real rate menjadi negatif dan memegang uang tunai berarti kehilangan daya beli. Gold sebagai "store of value" menjadi alternatif atraktif. Contoh klasik: 1970-an dan 2020–2022.',
  },
  {
    id: 'fed_dovish', icon: '🏦', weight: 'KUAT',
    wColor: '#34d399', wBg: 'rgba(52,211,153,0.08)', wBorder: 'rgba(52,211,153,0.25)',
    title: 'Fed Dovish / Rate Cut',
    short: 'Pemangkasan suku bunga / pause hiking → real yields turun → Gold diuntungkan',
    detail: 'Fed rate cut menurunkan opportunity cost memegang Gold (aset tanpa yield). Yield obligasi ikut turun, real yield menjadi lebih rendah. Bahkan ekspektasi rate cut ke depan (via Fed dots atau CME FedWatch) sudah cukup mendorong Gold. Rate cut 2024 memulai rally Gold ke ATH.',
  },
  {
    id: 'geopolitik', icon: '⚠️', weight: 'SITUASIONAL',
    wColor: '#fbbf24', wBg: 'rgba(251,191,36,0.08)', wBorder: 'rgba(251,191,36,0.25)',
    title: 'Geopolitik & Krisis Keuangan',
    short: 'Konflik bersenjata, krisis perbankan, ketidakpastian global → safe haven demand',
    detail: 'Gold adalah safe haven utama yang diakui secara universal. Dalam ketidakpastian geopolitik (perang, sanksi, eskalasi) atau krisis sistemik keuangan (banking failure, debt ceiling), investor global beralih ke Gold. Efeknya kuat namun sering temporer kecuali krisis berkepanjangan.',
  },
  {
    id: 'cot_long', icon: '📊', weight: 'MODERAT',
    wColor: '#fbbf24', wBg: 'rgba(251,191,36,0.08)', wBorder: 'rgba(251,191,36,0.25)',
    title: 'COT: Net Long Spekulatif Naik',
    short: 'Laporan CFTC menunjukkan institusi/spekulan meningkatkan posisi long Gold',
    detail: 'Commitment of Traders (COT) Report dari CFTC (tiap Jumat) menunjukkan posisi bersih spekulan (Non-Commercial) di Gold futures COMEX. Ketika net long meningkat secara konsisten dari minggu ke minggu, ini mencerminkan akumulasi institusional — sinyal bullish jangka menengah.',
  },
  {
    id: 'central_bank', icon: '🏛️', weight: 'KUAT',
    wColor: '#34d399', wBg: 'rgba(52,211,153,0.08)', wBorder: 'rgba(52,211,153,0.25)',
    title: 'Central Bank Gold Buying',
    short: 'Bank sentral global (China, India, Rusia, dll.) menambah cadangan Gold',
    detail: 'Pembelian Gold oleh bank sentral secara struktural mengurangi supply beredar. Sejak 2022, bank sentral global membeli Gold dalam jumlah rekor (>1.000 ton/tahun), terutama untuk mendiversifikasi dari USD. Ini faktor fundamental jangka panjang yang sangat kuat dan konsisten.',
  },
  {
    id: 'real_yields_neg', icon: '📉', weight: 'SANGAT KUAT',
    wColor: '#10b981', wBg: 'rgba(16,185,129,0.1)', wBorder: 'rgba(16,185,129,0.3)',
    title: 'Real Yields (TIPS) Turun / Negatif',
    short: 'US10Y TIPS yield turun / negatif → Gold lebih atraktif daripada obligasi',
    detail: 'TIPS yield (US10Y TIPS) adalah proxy paling langsung untuk real yield. Korelasi negatif antara TIPS yield dan Gold sangat kuat dan konsisten historis. Ketika TIPS yield turun atau negatif, Gold cenderung rally. Monitor di TradingView: simbol TVC:US10YTIPS.',
  },
  {
    id: 'equitas_turun', icon: '🔻', weight: 'SITUASIONAL',
    wColor: '#fbbf24', wBg: 'rgba(251,191,36,0.08)', wBorder: 'rgba(251,191,36,0.25)',
    title: 'Equitas Jatuh / Risk-Off Ekstrem',
    short: 'S&P500 jatuh tajam → capital rotasi ke Gold sebagai safe haven',
    detail: 'Dalam kondisi risk-off ekstrem (crash pasar saham, resesi fear, credit crunch), korelasi negatif Gold vs S&P500 meningkat tajam. Namun dalam crash awal (margin calls masif), semua aset termasuk Gold bisa turun sesaat sebelum rebound kuat ketika investor beralih ke safe haven.',
  },
];

// ── Bearish Factors ────────────────────────────────────────────────────────────
const BEARISH_FACTORS = [
  {
    id: 'dxy_strong', icon: '💪', weight: 'SANGAT KUAT',
    wColor: '#f43f5e', wBg: 'rgba(244,63,94,0.1)', wBorder: 'rgba(244,63,94,0.3)',
    title: 'DXY Menguat (USD Kuat)',
    short: 'USD kuat → Gold lebih mahal bagi pembeli non-USD → permintaan turun',
    detail: 'Ketika USD menguat, harga Gold dalam mata uang lain meningkat, menurunkan permintaan dari pembeli Asia (India, China) yang merupakan konsumen fisik terbesar dunia. Penguatan DXY biasanya terjadi saat Fed hawkish atau saat "flight to dollar" dalam krisis.',
  },
  {
    id: 'inflation_low', icon: '📊', weight: 'SANGAT KUAT',
    wColor: '#f43f5e', wBg: 'rgba(244,63,94,0.1)', wBorder: 'rgba(244,63,94,0.3)',
    title: 'Inflasi Melandai / Real Rates Positif',
    short: 'CPI turun → real rates menjadi positif → Gold kehilangan daya tarik lindung nilai',
    detail: 'Ketika Fed berhasil menekan inflasi dan real rates kembali positif, investor lebih memilih obligasi atau aset berbunga dibanding Gold. Periode 2022–2023: Fed hiking agresif + inflasi mulai turun → Gold tertekan dari $2.000 ke $1.620.',
  },
  {
    id: 'fed_hawkish', icon: '🏦', weight: 'KUAT',
    wColor: '#fb7185', wBg: 'rgba(251,113,133,0.08)', wBorder: 'rgba(251,113,133,0.25)',
    title: 'Fed Hawkish / Rate Hike Agresif',
    short: 'Kenaikan suku bunga → real yields naik → opportunity cost pegang Gold meningkat',
    detail: 'Siklus hiking agresif Fed langsung menekan Gold melalui dua jalur: (1) meningkatkan opportunity cost memegang Gold (aset tanpa yield), dan (2) memperkuat USD. Contoh paling jelas: siklus hiking 2022 menekan Gold dari $2.000 ke $1.620 dalam ~6 bulan.',
  },
  {
    id: 'risk_on', icon: '📈', weight: 'MODERAT',
    wColor: '#fbbf24', wBg: 'rgba(251,191,36,0.08)', wBorder: 'rgba(251,191,36,0.25)',
    title: 'Risk-On Sentiment',
    short: 'S&P500 bullish, VIX rendah → capital beralih dari Gold ke aset berisiko',
    detail: 'Ketika risk appetite tinggi (equitas naik, VIX di bawah 15, kredit spread menyempit), modal mengalir dari safe haven seperti Gold ke aset berisiko yang memberikan return lebih tinggi. Ini siklus yang berulang di setiap bull market equitas yang kuat.',
  },
  {
    id: 'cot_short', icon: '📉', weight: 'MODERAT',
    wColor: '#fbbf24', wBg: 'rgba(251,191,36,0.08)', wBorder: 'rgba(251,191,36,0.25)',
    title: 'COT: Net Long Berkurang / Short Naik',
    short: 'Spekulan mengurangi posisi long atau menambah short pada Gold futures (CFTC)',
    detail: 'Penurunan net long secara konsisten dalam laporan COT CFTC adalah warning sign bahwa momentum institusional berbalik. Jika speculative long mencapai all-time high diikuti penurunan tajam, biasanya terjadi profit-taking masif yang menekan harga Gold secara signifikan.',
  },
  {
    id: 'real_yields_pos', icon: '📈', weight: 'SANGAT KUAT',
    wColor: '#f43f5e', wBg: 'rgba(244,63,94,0.1)', wBorder: 'rgba(244,63,94,0.3)',
    title: 'Real Yields (TIPS) Naik',
    short: 'TIPS yield positif dan naik → oportunity cost pegang Gold meningkat tajam',
    detail: 'Real yield yang positif dan naik membuat obligasi inflasi-terlindungi (TIPS) lebih atraktif dari Gold. Investor rasional akan memilih TIPS dengan real yield +2% daripada Gold yang tidak memberikan yield apapun. Periode TIPS yield naik hampir selalu berkorelasi negatif dengan Gold.',
  },
  {
    id: 'usd_demand', icon: '💰', weight: 'KUAT',
    wColor: '#fb7185', wBg: 'rgba(251,113,133,0.08)', wBorder: 'rgba(251,113,133,0.25)',
    title: 'USD Global Demand Meningkat',
    short: 'Permintaan USD sebagai reserve/safe haven global naik → Gold tertekan',
    detail: 'USD dan Gold keduanya dianggap safe haven, tetapi dalam beberapa kondisi (terutama krisis kredit atau deflasi fear), investor memilih USD liquid daripada Gold. Ketika USD sendiri berfungsi sebagai safe haven utama, Gold bisa turun bersamaan dengan aset lainnya.',
  },
  {
    id: 'overbought', icon: '⚡', weight: 'TEKNIKAL',
    wColor: '#a78bfa', wBg: 'rgba(167,139,250,0.08)', wBorder: 'rgba(167,139,250,0.25)',
    title: 'Teknikal Overbought / Profit Taking',
    short: 'Setelah rally panjang, posisi speculative long padat → risiko profit taking masif',
    detail: 'Faktor teknikal murni: ketika Gold telah rally panjang dan RSI di level overbought (>70 pada TF besar), posisi long yang sangat padat rentan terhadap selling tekanan. Resistance kunci di all-time high sering memicu profit taking institusional dalam volume besar.',
  },
];

// ── Correlation Table Data ─────────────────────────────────────────────────────
const CORRELATIONS = [
  { label: 'DXY Index', formula: '↓ DXY → ↑ Gold', type: 'NEG', desc: 'Korelasi negatif kuat' },
  { label: 'Real Yields (TIPS)', formula: '↓ Yield → ↑ Gold', type: 'NEG', desc: 'Paling konsisten' },
  { label: 'Inflasi (CPI/PCE)', formula: '↑ CPI → ↑ Gold', type: 'POS', desc: 'Lindung nilai inflasi' },
  { label: 'Fed Funds Rate', formula: '↓ Rate → ↑ Gold', type: 'NEG', desc: 'Via opportunity cost' },
  { label: 'S&P500 (Risk-On)', formula: '↓ SPX → ↑ Gold', type: 'NEG', desc: 'Situasional (krisis)' },
  { label: 'VIX (Fear Index)', formula: '↑ VIX → ↑ Gold', type: 'POS', desc: 'Safe haven demand' },
];

// ── FactorCard ─────────────────────────────────────────────────────────────────
function FactorCard({ factor, live, expanded, onToggle }) {
  const delta = live ? (Number.isFinite(live.change) ? live.change : live.changePercent) : null;
  const direction = Number.isFinite(delta) ? Math.sign(delta) : 0;
  const trendColor = direction > 0 ? '#34d399' : direction < 0 ? '#fb7185' : '#94a3b8';
  const trendArrow = direction > 0 ? '▲' : direction < 0 ? '▼' : '■';
  const statusColor = LIVE_STATUS_COLOR[live?.status] || '#64748b';
  return (
    <div
      onClick={onToggle}
      style={{
        background: '#060f1e',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 8,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.2s ease',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 11px' }}>
        <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{factor.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 5, marginBottom: 3 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#e2e8f0', lineHeight: 1.3 }}>
              {factor.title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <span style={{
                fontSize: 7.5,
                fontWeight: 900,
                padding: '2px 5px',
                borderRadius: 4,
                background: factor.wBg,
                color: factor.wColor,
                border: `1px solid ${factor.wBorder}`,
                letterSpacing: '0.03em',
                whiteSpace: 'nowrap',
              }}>
                {factor.weight}
              </span>
              <span style={{ color: '#475569', fontSize: 9 }}>{expanded ? '▲' : '▼'}</span>
            </div>
          </div>
          <div style={{ fontSize: 9.5, color: '#94a3b8', lineHeight: 1.5 }}>{factor.short}</div>
          {live && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
              marginTop: 5, padding: '3px 7px',
              background: 'rgba(2,6,23,0.65)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 5,
              fontFamily: 'monospace',
            }}>
              <span style={{ fontSize: 8, fontWeight: 900, color: '#64748b', letterSpacing: '0.04em' }}>
                {live.label}
              </span>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#e2e8f0' }}>
                {formatLiveValue(live)}
              </span>
              <span style={{ fontSize: 9, fontWeight: 800, color: trendColor }}>
                {trendArrow} {formatLiveChange(live)}
              </span>
              {live.status && (
                <span style={{ fontSize: 7, fontWeight: 900, color: statusColor, letterSpacing: '0.05em', marginLeft: 'auto' }}>
                  {live.status}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {expanded && (
        <div style={{
          margin: '0 11px 11px 34px',
          padding: '9px 11px',
          fontSize: 9.5,
          color: '#7dd3fc',
          lineHeight: 1.75,
          background: 'rgba(0,0,0,0.3)',
          borderRadius: 6,
          border: '1px solid rgba(125,211,252,0.1)',
        }}>
          {factor.detail}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function GoldDriversPanel() {
  const [expandedId, setExpandedId] = useState(null);
  const [live, setLive] = useState({});
  const [liveUpdatedAt, setLiveUpdatedAt] = useState(null);
  const [liveError, setLiveError] = useState('');
  const [liveLoading, setLiveLoading] = useState(false);
  const liveInFlight = useRef(false);
  const mounted = useRef(true);

  const refreshLive = useCallback(async () => {
    if (liveInFlight.current) return;
    liveInFlight.current = true;
    setLiveLoading(true);
    setLiveError('');
    try {
      const quotes = await fetchLiveQuotes();
      if (!Object.keys(quotes).length) throw new Error('Provider tidak mengembalikan harga.');
      if (mounted.current) {
        setLive(quotes);
        setLiveUpdatedAt(new Date().toISOString());
      }
    } catch (e) {
      if (mounted.current) {
        setLiveError(e?.name === 'AbortError' ? 'Timeout menghubungi sumber harga.' : (e?.message || 'Live harga tidak tersedia.'));
      }
    } finally {
      liveInFlight.current = false;
      if (mounted.current) setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refreshLive();
    const timer = setInterval(refreshLive, 60000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [refreshLive]);

  const liveFor = id => {
    for (const key of FACTOR_LIVE_KEYS[id] || []) {
      if (live[key]) return live[key];
    }
    return null;
  };

  const toggle = id => setExpandedId(prev => prev === id ? null : id);
  const liveStatusColor = liveError ? '#fb7185' : liveUpdatedAt ? '#34d399' : '#64748b';
  const liveStatusText = liveError
    ? `Live harga belum tersedia: ${liveError}`
    : liveUpdatedAt
      ? `Live harga · ${new Date(liveUpdatedAt).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`
      : 'Menghubungkan ke sumber harga…';

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #071a2c 0%, #0a1a2e 100%)',
        border: '1px solid rgba(251,191,36,0.2)',
        borderRadius: 10,
        padding: '13px 15px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 11,
      }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>⚖️</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#fcd34d', letterSpacing: '0.04em', marginBottom: 4 }}>
            FAKTOR EKSTERNAL PENGGERAK HARGA GOLD (XAUUSD)
          </div>
          <div style={{ fontSize: 9.5, color: '#94a3b8', lineHeight: 1.65 }}>
            Gold dipengaruhi oleh faktor makroekonomi, kebijakan moneter, geopolitik, dan sentimen global. Klik tiap faktor untuk penjelasan mendalam. Gunakan panel ini bersama analisis teknikal 4-TF untuk keputusan entry yang lebih matang.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 7 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: liveStatusColor,
              boxShadow: `0 0 6px ${liveStatusColor}`,
            }} />
            <span style={{ fontSize: 8.5, color: '#64748b', fontFamily: 'monospace' }}>{liveStatusText}</span>
            <button
              type="button"
              onClick={refreshLive}
              disabled={liveLoading}
              style={{
                border: '1px solid rgba(103,232,249,0.25)',
                background: 'rgba(8,47,73,0.6)',
                color: '#a5f3fc',
                borderRadius: 4,
                padding: '2px 7px',
                fontSize: 8.5,
                fontWeight: 800,
                cursor: liveLoading ? 'wait' : 'pointer',
                fontFamily: 'monospace',
              }}
            >
              {liveLoading ? 'MEMUAT…' : '↻ REFRESH'}
            </button>
          </div>
        </div>
      </div>

      {/* Two-column factor grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Bullish column */}
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7,
            padding: '5px 9px',
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.22)',
            borderRadius: 6,
          }}>
            <span style={{ fontSize: 12 }}>📈</span>
            <span style={{ fontSize: 10, fontWeight: 900, color: '#34d399', letterSpacing: '0.03em' }}>
              FAKTOR BULLISH GOLD
            </span>
            <span style={{ fontSize: 8.5, color: '#6ee7b7', marginLeft: 'auto' }}>
              {BULLISH_FACTORS.length} faktor
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {BULLISH_FACTORS.map(f => (
              <FactorCard key={f.id} factor={f} live={liveFor(f.id)} expanded={expandedId === f.id} onToggle={() => toggle(f.id)} />
            ))}
          </div>
        </div>

        {/* Bearish column */}
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7,
            padding: '5px 9px',
            background: 'rgba(244,63,94,0.08)',
            border: '1px solid rgba(244,63,94,0.22)',
            borderRadius: 6,
          }}>
            <span style={{ fontSize: 12 }}>📉</span>
            <span style={{ fontSize: 10, fontWeight: 900, color: '#fb7185', letterSpacing: '0.03em' }}>
              FAKTOR BEARISH GOLD
            </span>
            <span style={{ fontSize: 8.5, color: '#fca5a5', marginLeft: 'auto' }}>
              {BEARISH_FACTORS.length} faktor
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {BEARISH_FACTORS.map(f => (
              <FactorCard key={f.id} factor={f} live={liveFor(f.id)} expanded={expandedId === f.id} onToggle={() => toggle(f.id)} />
            ))}
          </div>
        </div>
      </div>

      {/* Key correlations quick-reference */}
      <div style={{
        background: '#071224',
        border: '1px solid rgba(0,229,255,0.13)',
        borderRadius: 10,
        padding: '11px 13px',
      }}>
        <div style={{ fontSize: 9.5, fontWeight: 900, color: '#67e8f9', marginBottom: 9, letterSpacing: '0.03em' }}>
          📌 TABEL KORELASI KUNCI — REFERENSI CEPAT TRADER
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6 }}>
          {CORRELATIONS.map((item, i) => (
            <div key={i} style={{
              background: 'rgba(2,6,23,0.6)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 7,
              padding: '8px 10px',
            }}>
              <div style={{ fontSize: 8.5, color: '#64748b', marginBottom: 3 }}>{item.label}</div>
              <div style={{
                fontSize: 10.5, fontWeight: 800, fontFamily: 'monospace',
                color: item.type === 'NEG' ? '#f43f5e' : '#10b981',
              }}>
                {item.formula}
              </div>
              <div style={{ fontSize: 8.5, color: '#94a3b8', marginTop: 2 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ fontSize: 8.5, color: '#374151', lineHeight: 1.6, padding: '0 2px' }}>
        ⚠️ Harga live ditampilkan pada faktor yang punya instrumen pasar (DXY, US10Y, S&amp;P 500, XAUUSD) dan dapat tertunda. Faktor real yield/Fed memakai US10Y sebagai proxy likuid; TIPS 10Y dan US02Y ada di panel Faktor Up/Down Gold. Faktor rilis makro/berita (CPI, Fed, COT, geopolitik) mengikuti jadwal resmi karena tidak punya feed harga langsung. Gunakan tab <strong style={{ color: '#475569' }}>Research AI</strong> untuk membaca sumber data live dari Fed, BLS, BEA, dan Treasury.
      </div>
    </section>
  );
}

