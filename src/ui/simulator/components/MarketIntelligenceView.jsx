/**
 * MarketIntelligenceView.jsx — MIE v1 Tahap 1 (part 2/2: render + macro input)
 */
import { useState } from 'react';
import { saveMacroSnapshot } from '../../../services/market/marketIntelligenceService.js';
import { MI_SYMBOLS, fmt, Badge, numOrNull, inp, useMarketIntelligence } from './MarketIntelligencePanel.jsx';

export default function MarketIntelligenceView() {
  const { symbol, setSymbol, data, loading, error, macro, setMacro, load } = useMarketIntelligence();
  const [form, setForm] = useState({ pceActual: '', pceForecast: '', nfpActual: '', nfpForecast: '', flowDir: 'UNKNOWN', flowVal: '', source: '' });
  const t = data?.technical;
  const sc = data?.scenarios;
  const saveMacro = async () => {
    const patch = {
      pce: { actual: numOrNull(form.pceActual), forecast: numOrNull(form.pceForecast), sourceUrl: form.source || undefined },
      nfp: { actual: numOrNull(form.nfpActual), forecast: numOrNull(form.nfpForecast), sourceUrl: form.source || undefined },
      foreignFlow: { direction: form.flowDir, valueRpMiliar: numOrNull(form.flowVal), sourceUrl: form.source || undefined }
    };
    const res = await saveMacroSnapshot(patch);
    if (res?.ok) { setMacro(res); load(symbol); }
  };
  return (
    <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11, color: '#e2e8f0' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {MI_SYMBOLS.map((s) => (
          <button key={s} onClick={() => { setSymbol(s); load(s); }}
            style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, border: `1px solid ${s === symbol ? '#00e5ff' : 'rgba(255,255,255,0.15)'}`, background: s === symbol ? 'rgba(0,229,255,0.12)' : 'transparent', color: '#e2e8f0', cursor: 'pointer' }}>{s}</button>
        ))}
        <button onClick={() => load(symbol)} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, border: '1px solid #34d399', background: 'transparent', color: '#34d399', cursor: 'pointer' }}>{loading ? '...' : 'REFRESH LIVE'}</button>
      </div>
      {error && <div style={{ color: '#f87171', fontSize: 10 }}>{error}</div>}
      {data && (<>
        <div style={{ border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, padding: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <b>{data.symbol} — {fmt(data?.price?.last)} {data?.price?.currency || ''}</b>
            <Badge status={data?.price?.dataStatus} />
          </div>
          <div style={{ color: '#94a3b8', fontSize: 10 }}>State: <b style={{ color: '#00e5ff' }}>{data.marketState}</b></div>
          {data?.price?.sourceUrl && <a href={data.price.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 9, color: '#60a5fa' }}>Sumber: {data.price.source}</a>}
          {data?.price?.error && <div style={{ color: '#f87171', fontSize: 10 }}>{data.price.error}</div>}
        </div>
        <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: 8 }}>
          <b>TEKNIKAL (real)</b> <Badge status={t?.dataStatus} />
          <div>RSI14: <b>{t?.rsi14 != null ? fmt(t.rsi14, 1) : '—'}</b> ({t?.momentum}) • {t?.trend}</div>
          <div style={{ color: '#f87171' }}>R: {(t?.resistance || []).map((v) => fmt(v)).join(' / ') || '—'}</div>
          <div style={{ color: '#34d399' }}>S: {(t?.support || []).map((v) => fmt(v)).join(' / ') || '—'}</div>
        </div>
        <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: 8 }}>
          <b>MAKRO + FX</b>
          <div>USD/IDR {fmt(data?.fx?.usdidr?.last, 0)} <Badge status={data?.fx?.usdidr?.dataStatus} /></div>
          <div>DXY {fmt(data?.fx?.dxy?.last)} • US10Y {fmt(data?.rates?.us10y?.last)}</div>
          <div>WTI {fmt(data?.commodities?.wti?.last)} • Gold {fmt(data?.commodities?.gold?.last)} • BTC {fmt(data?.crypto?.btc?.last, 0)}</div>
          <div>PCE {macro?.pce?.actual ?? '—'}/{macro?.pce?.forecast ?? '—'} • NFP {macro?.nfp?.actual ?? '—'}/{macro?.nfp?.forecast ?? '—'} • Flow {data?.flow?.direction} <Badge status={data?.macro?.dataStatus} /></div>
        </div>
        {sc && (<div style={{ border: '1px solid rgba(52,211,153,0.3)', borderRadius: 8, padding: 8 }}>
          <b>SKENARIO</b>
          <div>Bullish: {sc.bullish?.trigger}</div>
          <div>Sideways: {sc.sideways?.trigger}</div>
          <div>Bearish: {sc.bearish?.trigger}</div>
          <div style={{ color: '#fbbf24', fontSize: 10 }}>{data?.confirmation?.rule}</div>
        </div>)}
        <div style={{ border: '1px dashed rgba(251,191,36,0.4)', borderRadius: 8, padding: 8 }}>
          <b>MACRO INPUT (manual)</b>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 4 }}>
            <input placeholder="PCE actual" value={form.pceActual} onChange={(e) => setForm({ ...form, pceActual: e.target.value })} style={inp} />
            <input placeholder="PCE forecast" value={form.pceForecast} onChange={(e) => setForm({ ...form, pceForecast: e.target.value })} style={inp} />
            <input placeholder="NFP actual" value={form.nfpActual} onChange={(e) => setForm({ ...form, nfpActual: e.target.value })} style={inp} />
            <input placeholder="NFP forecast" value={form.nfpForecast} onChange={(e) => setForm({ ...form, nfpForecast: e.target.value })} style={inp} />
          </div>
          <button onClick={saveMacro} style={{ marginTop: 6, fontSize: 10, padding: '4px 8px', borderRadius: 6, border: '1px solid #fbbf24', background: 'transparent', color: '#fbbf24', cursor: 'pointer' }}>SIMPAN</button>
        </div>
      </>)}
    </div>
  );
}
