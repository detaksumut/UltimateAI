import React, { useCallback, useEffect, useRef, useState } from 'react';

const SYMBOLS = [
  ['DXY', 'US Dollar Index'], ['US10Y', 'US Treasury 10Y'],
  ['WTI', 'Crude Oil'], ['BRENT', 'Brent Crude Oil'],
  ['XAGUSD', 'Silver'], ['COPPER', 'Copper'],
  ['SPX', 'S&P 500'], ['USDJPY', 'USD/JPY']
];

const fmt = (value, digits = 3) =>
  value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
    ? Number(value).toLocaleString('id-ID', { maximumFractionDigits: digits })
    : '—';

function Sparkline({ points = [], positive }) {
  const values = points.map(Number).filter(Number.isFinite);
  if (values.length < 2) return <span style={{ color: '#64748b' }}>—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const path = values.map((value, index) =>
    `${index ? 'L' : 'M'}${(index / (values.length - 1) * 88).toFixed(1)},${(28 - (value - min) / range * 24).toFixed(1)}`
  ).join(' ');
  return <svg viewBox="0 0 90 30" width="90" height="30" role="img" aria-label="Grafik tren mini">
    <path d={path} fill="none" stroke={positive ? '#10b981' : '#f87171'} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
  </svg>;
}

export default function IntermarketLiveTable() {
  const [quotes, setQuotes] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const mounted = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (mounted.current) {
      setLoading(true);
      setError('');
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('/api/trading/intermarket-quotes', {
        cache: 'no-store',
        signal: controller.signal
      });
      const data = await response.json();
      if (!response.ok || !data?.success || !Array.isArray(data.quotes)) {
        throw new Error(data?.error || 'Data pasar belum tersedia');
      }
      if (mounted.current) {
        setQuotes(data.quotes);
        setUpdatedAt(data.fetchedAt || new Date().toISOString());
      }
    } catch (cause) {
      if (mounted.current) {
        setError(cause?.name === 'AbortError'
          ? 'Permintaan kuotasi melewati batas waktu'
          : (cause?.message || 'Gagal memperbarui kuotasi'));
      }
    } finally {
      window.clearTimeout(timeout);
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const id = window.setInterval(() => void refresh(), 60000);
    return () => {
      mounted.current = false;
      window.clearInterval(id);
    };
  }, [refresh]);

  const bySymbol = Object.fromEntries(quotes.map(quote => [quote.symbol, quote]));

  return <section style={{ background: '#111315', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden', color: '#f3f4f6', fontFamily: 'Inter,system-ui,sans-serif' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', gap: 10, flexWrap: 'wrap', borderBottom: '1px solid #30363d' }}>
      <div>
        <strong style={{ fontSize: 14, letterSpacing: '.04em' }}>INTERMARKET LIVE</strong>
        <div style={{ color: '#9ca3af', fontSize: 10, marginTop: 3 }}>Sumber: Yahoo Finance · kuotasi dapat tertunda · refresh 60 detik</div>
      </div>
      <button onClick={() => void refresh()} disabled={loading} style={{ background: 'transparent', border: '1px solid #4b5563', color: '#e5e7eb', borderRadius: 5, padding: '6px 10px', cursor: loading ? 'wait' : 'pointer' }}>
        {loading ? 'MEMUAT…' : '↻ REFRESH'}
      </button>
    </div>
    {error && <div role="status" style={{ padding: 10, color: '#fca5a5', fontSize: 11 }}>{error}. Harga lama tidak dianggap sebagai pembaruan baru.</div>}
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr style={{ color: '#9ca3af', textAlign: 'left', background: '#151719' }}>
          {['Simbol', 'Bid', 'Ask', 'Spread', 'Perubahan', 'Perubahan %', 'Tren'].map(heading =>
            <th key={heading} style={{ padding: '10px 9px', fontWeight: 500, whiteSpace: 'nowrap' }}>{heading}</th>
          )}
        </tr></thead>
        <tbody>{SYMBOLS.map(([symbol, label]) => {
          const quote = bySymbol[symbol];
          const bid = quote?.bid;
          const ask = quote?.ask;
          const percent = quote?.changePercent;
          const up = Number.isFinite(Number(percent)) && Number(percent) > 0;
          const down = Number.isFinite(Number(percent)) && Number(percent) < 0;
          const hasPercent = percent !== null && percent !== undefined && Number.isFinite(Number(percent));
          return <tr key={symbol} style={{ borderTop: '1px solid #30363d' }}>
            <td style={{ padding: '8px 9px', minWidth: 160 }}>
              <div style={{ fontWeight: 800 }}>{symbol} <span aria-label={quote?.price != null ? 'data tersedia' : 'data tidak tersedia'} style={{ color: quote?.price != null ? '#f59e0b' : '#ef4444', fontSize: 9 }}>●</span></div>
              <div style={{ color: '#9ca3af', fontSize: 10, marginTop: 2 }}>{label}</div>
              <div style={{ color: '#6b7280', fontSize: 9, marginTop: 2 }}>{quote?.marketState || 'NO DATA'}{quote?.delayed ? ' · DELAYED' : ''}</div>
            </td>
            <td style={{ padding: '8px 9px', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(bid)}</td>
            <td style={{ padding: '8px 9px', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(ask)}</td>
            <td style={{ padding: '8px 9px', whiteSpace: 'nowrap' }}>
              {bid != null && ask != null && Number.isFinite(Number(bid)) && Number.isFinite(Number(ask)) ? fmt(Number(ask) - Number(bid), 4) : '—'}
            </td>
            <td style={{ padding: '8px 9px', color: down ? '#f87171' : up ? '#34d399' : '#e5e7eb', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {quote?.change == null ? '—' : (Number(quote.change) > 0 ? '+' : '') + fmt(quote.change)}
            </td>
            <td style={{ padding: '8px 9px', color: down ? '#f87171' : up ? '#34d399' : '#e5e7eb', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {!hasPercent ? '—' : (Number(percent) > 0 ? '+' : '') + fmt(percent, 2) + '%'}
            </td>
            <td style={{ padding: '5px 9px' }}><Sparkline points={quote?.sparkline || []} positive={up || (!down && Number(quote?.change) >= 0)} /></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <div style={{ padding: '9px 12px', color: '#9ca3af', fontSize: 10, borderTop: '1px solid #30363d' }}>
      Harga yang tidak disediakan provider ditampilkan sebagai —; grafik mini hanya dibentuk dari titik historis yang diterima, bukan data rekaan.
      {' '}Update terakhir: {updatedAt ? new Date(updatedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB' : 'belum tersedia'}.
    </div>
  </section>;
}
