/**
 * MarketIntelligenceModal.jsx - MIE v1: POPUP MODAL hasil analisis (6 blok infografik)
 *
 * Dibuka dari:
 *  - Panel kiri JIN -> tombol "MARKET INTELLIGENCE"
 *  - Voice -> "Mama Jin, analisis IHSG" -> window.__jinMarketAnalyze('IHSG')
 *
 * Prinsip: SEMUA angka berasal dari engine (JSON), bukan karangan LLM.
 * Data yang tidak live diberi label jujur (MANUAL / UNAVAILABLE).
 */
import { useEffect, useState } from 'react';
import { getMarketAnalysis } from '../../../services/market/marketIntelligenceService.js';

export const MI_SYMBOLS = ['IHSG', 'USDIDR', 'DXY', 'US10Y', 'GOLD', 'WTI', 'BTC'];

const fmt = (v, d = 2) => (v == null || !Number.isFinite(Number(v))
  ? '—'
  : Number(v).toLocaleString('id-ID', { maximumFractionDigits: d }));

const pct = (v) => (v == null || !Number.isFinite(Number(v))
  ? '—' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`);

function StatusTag({ status }) {
  const s = String(status || '').toUpperCase();
  const color = s === 'LIVE' || s === 'COMPUTED_FROM_LIVE_SERIES' || s === 'PARTIAL'
    ? '#34d399'
    : (s === 'SNAPSHOT' || s === 'MANUAL_SNAPSHOT') ? '#fbbf24'
      : s === 'UNAVAILABLE' ? '#64748b' : '#94a3b8';
  return (
    <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 99, border: `1px solid ${color}`, color, whiteSpace: 'nowrap' }}>
      {s || '—'}
    </span>
  );
}

function Dot({ impact }) {
  const map = { POSITIVE: '#34d399', NEGATIVE: '#f87171', NEUTRAL: '#fbbf24', UNKNOWN: '#64748b' };
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: map[String(impact || '').toUpperCase()] || '#64748b' }} />;
}

const block = {
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: 8, background: 'rgba(15,23,42,0.5)'
};
const blockTitle = { fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: '#00e5ff', marginBottom: 5 };

function Row({ label, value, change, status }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, padding: '2px 0' }}>
      <span style={{ color: '#cbd5e1' }}>{label}</span>
      <span style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
        {value}
        {change != null && (
          <span style={{ fontSize: 9, marginLeft: 5, color: change >= 0 ? '#34d399' : '#f87171' }}>{pct(change)}</span>
        )}
        <span style={{ marginLeft: 5 }}><StatusTag status={status} /></span>
      </span>
    </div>
  );
}

export default function MarketIntelligenceModal({ open, onClose, initialSymbol = 'IHSG' }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async (sym) => {
    setLoading(true);
    setError('');
    const res = await getMarketAnalysis(sym);
    if (res && res.symbol) setData(res);
    else setError(res?.error || 'Gagal memuat analisis');
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    const up = String(initialSymbol || 'IHSG').toUpperCase();
    const pick = MI_SYMBOLS.includes(up) ? up : 'IHSG';
    setSymbol(pick);
    load(pick);
  }, [open, initialSymbol]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const t = data?.technical;
  const tr = data?.macro?.transmission;
  const scores = data?.confirmation?.scores;
  const macroItems = (data?.macro?.items || []).filter((i) => i.dataStatus === 'LIVE');

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(2,6,23,0.82)', backdropFilter: 'blur(3px)', padding: 16
      }}
    >
      <div style={{
        width: 'min(980px, 96vw)', maxHeight: '92vh', overflowY: 'auto', background: '#0b1220',
        border: '1px solid rgba(0,229,255,0.3)', borderRadius: 12, padding: 14,
        fontSize: 11, color: '#e2e8f0', fontFamily: 'system-ui, sans-serif',
        boxShadow: '0 0 40px rgba(0,229,255,0.15)'
      }}>
        <ModalHeader data={data} symbol={symbol} onClose={onClose} />
        <SymbolPicker
          symbol={symbol}
          loading={loading}
          onPick={(s) => { setSymbol(s); load(s); }}
          onRefresh={() => load(symbol)}
        />
        {error && (
          <div style={{ ...block, borderColor: 'rgba(248,113,113,0.4)', color: '#f87171', marginBottom: 8 }}>
            {error}
          </div>
        )}
        {data && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8 }}>
            <MacroBlock data={data} macroItems={macroItems} />
            <ImpactBlock tr={tr} />
            <RupiahBlock data={data} />
            <TechnicalBlock data={data} t={t} />
            <ScenarioBlock sc={data.scenarios} />
            <MonitorBlock data={data} />
            <ConclusionBlock data={data} scores={scores} />
          </div>
        )}
      </div>
    </div>
  );

function ModalHeader({ data, symbol, onClose }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.06em' }}>
          ANALISIS MAKRO &amp; TEKNIKAL — {data?.symbol || symbol}
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
          {data?.marketState
            ? <>State: <b style={{ color: '#00e5ff' }}>{data.marketState}</b></>
            : 'Mengambil data live...'}
          {data?.timestamp && (
            <span style={{ marginLeft: 8, color: '#64748b' }}>
              {new Date(data.timestamp).toLocaleString('id-ID')}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onClose}
        title="Tutup"
        style={{
          fontSize: 16, lineHeight: 1, padding: '4px 9px', borderRadius: 6, cursor: 'pointer',
          border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#e2e8f0'
        }}
      >×</button>
    </div>
  );
}

function SymbolPicker({ symbol, loading, onPick, onRefresh }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
      {MI_SYMBOLS.map((s) => (
        <button
          key={s}
          onClick={() => onPick(s)}
          style={{
            fontSize: 9, padding: '3px 7px', borderRadius: 6, cursor: 'pointer',
            border: `1px solid ${s === symbol ? '#00e5ff' : 'rgba(255,255,255,0.15)'}`,
            background: s === symbol ? 'rgba(0,229,255,0.12)' : 'transparent',
            color: '#e2e8f0'
          }}
        >{s}</button>
      ))}
      <button
        onClick={onRefresh}
        style={{
          fontSize: 9, padding: '3px 7px', borderRadius: 6, cursor: 'pointer',
          border: '1px solid #34d399', background: 'transparent', color: '#34d399'
        }}
      >
        {loading ? 'MEMUAT...' : 'REFRESH LIVE'}
      </button>
    </div>
  );
}


function MacroBlock({ data, macroItems }) {
  return (
    <div style={block}>
      <div style={blockTitle}>1. DATA MAKRO AS (LIVE) <StatusTag status={data.macro?.dataStatus} /></div>
      {macroItems.length === 0 && <div style={{ color: '#94a3b8' }}>Makro live tidak tersedia.</div>}
      {macroItems.map((i) => (
        <div
          key={i.indicator}
          style={{
            display: 'flex', justifyContent: 'space-between', gap: 6, padding: '2px 0',
            borderBottom: '1px solid rgba(255,255,255,0.05)'
          }}
        >
          <span style={{ color: '#cbd5e1' }}>
            {i.label}
            {i.displayMode === 'YOY' && <span style={{ color: '#64748b' }}> (YoY)</span>}
          </span>
          <span style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
            {fmt(i.actual)}{i.unit === 'PERCENT' || i.unit === 'PERCENT_YOY' ? '%' : ''}
            {i.changeVsPrev != null && (
              <span style={{ color: i.changeVsPrev < 0 ? '#34d399' : '#f87171', fontSize: 9 }}>
                {' '}({i.changeVsPrev >= 0 ? '+' : ''}{fmt(i.changeVsPrev)})
              </span>
            )}
          </span>
        </div>
      ))}
      <div style={{ fontSize: 9, color: '#fbbf24', marginTop: 4 }}>{data.macro?.consensusNote}</div>
    </div>
  );
}

function ImpactBlock({ tr }) {
  const vColor = tr?.verdict === 'POSITIVE' ? '#34d399' : tr?.verdict === 'NEGATIVE' ? '#f87171' : '#fbbf24';
  return (
    <div style={block}>
      <div style={blockTitle}>2. EFEK KE PASAR <StatusTag status={tr?.dataStatus} /></div>
      <div style={{ marginBottom: 5 }}>Verdict: <b style={{ color: vColor }}>{tr?.verdict || '—'}</b></div>
      {(tr?.factors || []).map((f) => (
        <div key={f.factor} style={{ display: 'flex', gap: 5, alignItems: 'flex-start', padding: '3px 0' }}>
          <span style={{ marginTop: 3 }}><Dot impact={f.impact} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10 }}>
              <b>{f.factor}</b>
              <span style={{ color: '#64748b', fontSize: 9, marginLeft: 4 }}>
                {f.impact} · strength {fmt(f.strength)} · conf {fmt(f.confidence)}
              </span>
            </div>
            {f.reasoning && (
              <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.35 }}>{f.reasoning}</div>
            )}
          </div>
        </div>
      ))}
      <div style={{ fontSize: 9, color: '#fbbf24', marginTop: 4 }}>{tr?.rule}</div>
    </div>
  );
}


function RupiahBlock({ data }) {
  return (
    <div style={block}>
      <div style={blockTitle}>3. RUPIAH &amp; GLOBAL</div>
      <Row label="USD/IDR" value={fmt(data.fx?.usdidr?.last, 0)} change={data.fx?.usdidr?.changePct} status={data.fx?.usdidr?.dataStatus} />
      <Row label="DXY" value={fmt(data.fx?.dxy?.last)} change={data.fx?.dxy?.changePct} status={data.fx?.dxy?.dataStatus} />
      <Row label="US 10Y" value={fmt(data.rates?.us10y?.last)} change={data.rates?.us10y?.changePct} status={data.rates?.us10y?.dataStatus} />
      <Row label="WTI" value={fmt(data.commodities?.wti?.last)} change={data.commodities?.wti?.changePct} status={data.commodities?.wti?.dataStatus} />
      <Row label="Gold" value={fmt(data.commodities?.gold?.last)} change={data.commodities?.gold?.changePct} status={data.commodities?.gold?.dataStatus} />
      <div style={{ fontSize: 9, color: data.fx?.rupiahMenguat ? '#34d399' : '#94a3b8', marginTop: 4 }}>
        {data.fx?.rupiahMenguat
          ? 'Rupiah menguat'
          : data.fx?.rupiahMenguat === false ? 'Rupiah melemah' : 'Arah Rupiah belum dapat dipastikan'}
      </div>
      <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>{data.fx?.transmissionPath}</div>
    </div>
  );
}

function TechnicalBlock({ data, t }) {
  return (
    <div style={block}>
      <div style={blockTitle}>4. KONDISI {data.symbol} <StatusTag status={data.price?.dataStatus} /></div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>
        {fmt(data.price?.last)}
        <span style={{ fontSize: 11, marginLeft: 6, color: (data.price?.changePct ?? 0) >= 0 ? '#34d399' : '#f87171' }}>
          {pct(data.price?.changePct)}
        </span>
      </div>
      <div style={{ fontSize: 10, marginTop: 4 }}>
        RSI14 <b>{fmt(t?.rsi14, 1)}</b> ({t?.momentum}) · Trend <b>{t?.trend}</b>
      </div>
      <div style={{ fontSize: 10, marginTop: 4, color: '#f87171' }}>
        Resistance: {(t?.resistance || []).map((v) => fmt(v)).join(' / ') || '—'}
      </div>
      <div style={{ fontSize: 10, color: '#34d399' }}>
        Support: {(t?.support || []).map((v) => fmt(v)).join(' / ') || '—'}
      </div>
      <div style={{ fontSize: 9, color: '#64748b', marginTop: 4 }}>{t?.note}</div>
    </div>
  );
}


function ScenarioBlock({ sc }) {
  const rows = [
    ['BULLISH', sc?.bullish, '#34d399'],
    ['SIDEWAYS', sc?.sideways, '#fbbf24'],
    ['BEARISH', sc?.bearish, '#f87171']
  ];
  return (
    <div style={block}>
      <div style={blockTitle}>5. SKENARIO</div>
      {rows.map(([lbl, s, c]) => (
        <div key={lbl} style={{ marginBottom: 5 }}>
          <b style={{ color: c, fontSize: 10 }}>{lbl}</b>
          {s?.trigger && <div style={{ fontSize: 9, color: '#cbd5e1' }}>{s.trigger}</div>}
          {Array.isArray(s?.path) && s.path.length > 0 && (
            <div style={{ fontSize: 9, color: '#64748b' }}>Target: {s.path.map((v) => fmt(v)).join(' → ')}</div>
          )}
          {Array.isArray(s?.range) && s.range.length > 0 && (
            <div style={{ fontSize: 9, color: '#64748b' }}>Range: {s.range.map((v) => fmt(v)).join(' – ')}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function MonitorBlock({ data }) {
  const flowColor = data.flow?.direction === 'BUY' ? '#34d399'
    : data.flow?.direction === 'SELL' ? '#f87171' : '#fbbf24';
  return (
    <div style={block}>
      <div style={blockTitle}>6. YANG PERLU DIPANTAU</div>
      {(data.monitorList || []).map((m) => (
        <div key={m.no} style={{ display: 'flex', gap: 6, padding: '2px 0' }}>
          <span style={{ color: '#64748b', fontFamily: 'monospace' }}>{m.no}.</span>
          <div>
            <b style={{ fontSize: 10 }}>{m.topic}</b>
            <div style={{ fontSize: 9, color: '#94a3b8' }}>{m.condition}</div>
            <div style={{ fontSize: 9, color: m.honest ? '#fbbf24' : '#64748b' }}>sekarang: {m.current}</div>
          </div>
        </div>
      ))}
      <div style={{ fontSize: 9, color: '#64748b', marginTop: 4 }}>
        Flow: <b style={{ color: flowColor }}>{data.flow?.direction}</b>{' '}
        <StatusTag status={data.flow?.dataStatus} />
      </div>
      <div style={{ fontSize: 8, color: '#64748b', marginTop: 2 }}>{data.flow?.honestNote}</div>
    </div>
  );
}


function ConclusionBlock({ data, scores }) {
  const macro = data.confirmation?.macro;
  const macroImpact = macro === 'POSITIVE' ? 'POSITIVE' : macro === 'NEGATIVE' ? 'NEGATIVE' : 'NEUTRAL';
  const scoreRows = Object.entries(scores || {})
    .filter(([, v]) => v && typeof v === 'object' && v.score != null);
  return (
    <div style={{ ...block, gridColumn: '1 / -1', borderColor: 'rgba(0,229,255,0.3)' }}>
      <div style={blockTitle}>KESIMPULAN + CONFIRMATION</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        <span>Macro <Dot impact={macroImpact} /> <b>{macro}</b></span>
        <span>FX <b>{data.confirmation?.fx}</b></span>
        <span>Flow <b>{data.confirmation?.flow}</b></span>
        <span>Technical <b>{data.confirmation?.technical}</b></span>
        <span>Price Action <b>{data.confirmation?.priceAction}</b></span>
      </div>
      {scoreRows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 5, marginBottom: 6 }}>
          {scoreRows.map(([k, v]) => (
            <div key={k} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: 4 }}>
              <div style={{ fontSize: 8, color: '#94a3b8' }}>{k}</div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{v.score}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 9, color: '#fbbf24' }}>{data.confirmation?.gate}</div>
      <div style={{ fontSize: 10, marginTop: 4, fontStyle: 'italic', color: '#cbd5e1' }}>
        Makro global memberikan bahan untuk rebound — tetapi rebound ≠ otomatis reversal trend.
      </div>
      <div style={{ fontSize: 8, color: '#64748b', marginTop: 4 }}>
        Sumber harga: {data.price?.source} · Makro: {data.macro?.provider} · Level dihitung dari seri harga, bukan ditulis manual.
      </div>
    </div>
  );
}

}
