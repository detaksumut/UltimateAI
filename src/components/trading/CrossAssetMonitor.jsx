import React, { useCallback, useEffect, useRef, useState } from 'react';

const SYMBOLS = [
  ['DXY', 'US Dollar Index'], ['US10Y', 'US Treasury 10Y'],
  ['WTI', 'WTI Crude'], ['BRENT', 'Brent Crude'],
  ['XAGUSD', 'Silver'], ['COPPER', 'Copper'],
  ['SPX', 'S&P 500'], ['USDJPY', 'USD/JPY']
];

const number = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
  ? Number(value).toLocaleString('en-US', { maximumFractionDigits: 3 })
  : '—';

export default function CrossAssetMonitor() {
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
      const response = await fetch('/api/trading/intermarket-quotes', { cache: 'no-store', signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !data?.success || !Array.isArray(data.quotes)) {
        throw new Error(data?.error || 'Kuotasi cross-asset belum tersedia');
      }
      if (mounted.current) {
        setQuotes(data.quotes);
        setUpdatedAt(data.fetchedAt || new Date().toISOString());
      }
    } catch (err) {
      if (mounted.current) setError(err?.name === 'AbortError' ? 'Permintaan kuotasi timeout' : (err?.message || 'Gagal memuat kuotasi'));
    } finally {
      window.clearTimeout(timeout);
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60000);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, [refresh]);

  const bySymbol = Object.fromEntries(quotes.map(q => [q.symbol, q]));

  return <section aria-label="Cross asset market monitor" style={{ background: '#071321', border: '1px solid #164e63', borderRadius: 7, color: '#dbeafe', overflow: 'hidden', fontFamily: 'Inter,system-ui,sans-serif' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 14px', borderBottom: '1px solid #164e63' }}>
      <div>
        <strong style={{ color: '#67e8f9', fontSize: 12, letterSpacing: 1 }}>CROSS-ASSET MONITOR</strong>
        <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 4 }}>Indikator pendukung XAUUSD · Yahoo Finance · data dapat tertunda</div>
      </div>
      <button type="button" onClick={() => void refresh()} disabled={loading} style={{ border: '1px solid #155e75', background: '#061827', color: '#a5f3fc', borderRadius: 4, padding: '6px 9px', cursor: loading ? 'wait' : 'pointer', fontSize: 10, fontWeight: 800 }}>{loading ? 'MEMUAT…' : '↻ REFRESH'}</button>
    </header>
    {error && <div role="status" style={{ padding: 10, color: '#fca5a5', fontSize: 11 }}>{error}</div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))' }}>
      {SYMBOLS.map(([symbol, label]) => {
        const q = bySymbol[symbol];
        const pct = q?.changePercent;
        const validPct = pct !== null && pct !== undefined && Number.isFinite(Number(pct));
        const positive = validPct && Number(pct) > 0;
        const negative = validPct && Number(pct) < 0;
        return <article key={symbol} style={{ padding: 12, minWidth: 0, borderRight: '1px solid #122d40', borderBottom: '1px solid #122d40' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}>
            <strong style={{ fontSize: 12 }}>{symbol}</strong>
            <span style={{ color: q?.price != null ? '#34d399' : '#f87171', fontSize: 9 }}>{q?.price != null ? '● LIVE FEED' : '● NO DATA'}</span>
          </div>
          <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 3 }}>{label}</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 9 }}>{number(q?.price)}</div>
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 5, color: positive ? '#34d399' : negative ? '#f87171' : '#94a3b8' }}>{validPct ? (positive ? '+' : '') + number(pct) + '%' : 'Perubahan —'}</div>
        </article>;
      })}
    </div>
    <footer style={{ padding: '8px 12px', color: '#64748b', fontSize: 10 }}>Diperbarui: {updatedAt ? new Date(updatedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB' : 'belum tersedia'} · Pembaruan otomatis 60 detik. Feed ini bukan jaminan real-time bursa.</footer>
  </section>;
}
