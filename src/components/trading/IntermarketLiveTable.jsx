import React, { useCallback, useEffect, useState } from 'react';

const SYMBOLS = [
  ['DXY', 'US Dollar Index'], ['US10Y', 'US Treasury 10Y'],
  ['WTI', 'Crude Oil'], ['BRENT', 'Brent Crude Oil'],
  ['XAGUSD', 'Silver'], ['COPPER', 'Copper'],
  ['SPX', 'S&P 500'], ['USDJPY', 'USD/JPY']
];
const fmt = (v, digits = 3) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v).toLocaleString('id-ID', { maximumFractionDigits: digits }) : '—';
function Sparkline({ points = [], positive }) {
  const values = points.map(Number).filter(Number.isFinite);
  if (values.length < 2) return <span style={{ color: '#64748b' }}>—</span>;
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const path = values.map((v, i) => `${i ? 'L' : 'M'}${(i / (values.length - 1) * 88).toFixed(1)},${(28 - (v - min) / range * 24).toFixed(1)}`).join(' ');
  const color = positive ? '#10b981' : '#f87171';
  return <svg viewBox="0 0 90 30" width="90" height="30" role="img" aria-label="Grafik tren mini"><path d={path} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" /></svg>;
}
export default function IntermarketLiveTable() {
  const [quotes, setQuotes] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (loading) return;
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/trading/intermarket-quotes', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
      const data = await response.json();
      if (!response.ok || !data.success || !Array.isArray(data.quotes)) throw new Error(data.error || 'Data pasar belum tersedia');
      setQuotes(data.quotes); setUpdatedAt(data.fetchedAt || new Date().toISOString());
    } catch (e) { setError(e?.message || 'Gagal memperbarui kuotasi'); }
    finally { setLoading(false); }
  }, [loading]);
  useEffect(() => { refresh(); const id = window.setInterval(refresh, 60000); return () => window.clearInterval(id); }, []);
  const bySymbol = Object.fromEntries(quotes.map(q => [q.symbol, q]));
  return <section style={{ background: '#111315', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden', color: '#f3f4f6', fontFamily: 'Inter,system-ui,sans-serif' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', gap: 10, flexWrap: 'wrap', borderBottom: '1px solid #30363d' }}>
      <div><strong style={{ fontSize: 14, letterSpacing: '.04em' }}>INTERMARKET LIVE</strong><div style={{ color: '#9ca3af', fontSize: 10, marginTop: 3 }}>Sumber: Yahoo Finance · kuotasi dapat tertunda · refresh 60 detik</div></div>
      <button onClick={refresh} disabled={loading} style={{ background: 'transparent', border: '1px solid #4b5563', color: '#e5e7eb', borderRadius: 5, padding: '6px 10px', cursor: 'pointer' }}>{loading ? 'MEMUAT…' : '↻ REFRESH'}</button>
    </div>
    {error && <div style={{ padding: 10, color: '#fca5a5', fontSize: 11 }}>{error}. Harga lama tidak dianggap sebagai pembaruan baru.</div>}
    <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: 12 }}>
      <thead><tr style={{ color: '#9ca3af', textAlign: 'left', background: '#151719' }}>{['Simbol','Bid','Ask','Spread','Perubahan','Perubahan %','Tren'].map(h => <th key={h} style={{ padding: '10px 9px', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
      <tbody>{SYMBOLS.map(([symbol,label]) => {
        const q = bySymbol[symbol], price = q?.price, bid = q?.bid, ask = q?.ask;
        const change = q?.change, pct = q?.changePercent, up = Number(pct) > 0, down = Number(pct) < 0;
        return <tr key={symbol} style={{ borderTop: '1px solid #30363d' }}>
          <td style={{ padding: '8px 9px', minWidth: 160 }}><div style={{ fontWeight: 800 }}>{symbol} <span style={{ color: q?.price != null ? '#f59e0b' : '#ef4444', fontSize: 9 }}>●</span></div><div style={{ color: '#9ca3af', fontSize: 10, marginTop: 2 }}>{label}</div><div style={{ color: '#6b7280', fontSize: 9, marginTop: 2 }}>{q?.marketState || 'NO DATA'}{q?.delayed ? ' · DELAYED' : ''}</div></td>
          <td style={{ padding: '8px 9px', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(bid)}</td>
          <td style={{ padding: '8px 9px', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(ask)}</td>
          <td style={{ padding: '8px 9px', whiteSpace: 'nowrap' }}>{bid != null && ask != null && Number.isFinite(Number(bid)) && Number.isFinite(Number(ask)) ? fmt(Number(ask)-Number(bid), 4) : '—'}</td>
          <td style={{ padding: '8px 9px', color: down ? '#f87171' : up ? '#34d399' : '#e5e7eb', fontWeight: 700, whiteSpace: 'nowrap' }}>{q?.change == null ? '—' : (Number(q.change)>0?'+':'')+fmt(q.change)}</td>
          <td style={{ padding: '8px 9px', color: down ? '#f87171' : up ? '#34d399' : '#e5e7eb', fontWeight: 700, whiteSpace: 'nowrap' }}>{pct == null ? '—' : (Number(pct)>0?'+':'')+fmt(pct,2)+'%'}</td>
          <td style={{ padding: '5px 9px' }}><Sparkline points={q?.sparkline || []} positive={up || (!down && Number(q?.change) >= 0)} /></td>
        </tr>;
      })}</tbody>
    </table></div>
    <div style={{ padding: '9px 12px', color: '#9ca3af', fontSize: 10, borderTop: '1px solid #30363d' }}>Harga yang tidak disediakan provider ditampilkan sebagai —; grafik mini hanya dibentuk dari titik historis yang diterima, bukan data rekaan. Update terakhir: {updatedAt ? new Date(updatedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB' : 'belum tersedia'}.</div>
  </section>;
}
