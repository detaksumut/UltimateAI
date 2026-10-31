import React, { useEffect, useMemo, useState } from 'react';
import { marketDataServiceInstance } from '../../services/trading/MarketDataService.js';

const ASSETS = [
  { symbol: 'XAUUSD', label: 'GOLD · XAUUSD', group: 'ACUAN UTAMA' },
  { symbol: 'DXY', label: 'US Dollar Index (DXY)', group: 'USD / SUKU BUNGA' },
  { symbol: 'US10Y', label: 'US Treasury Yield 10Y', group: 'USD / SUKU BUNGA' },
  { symbol: 'US02Y', label: 'US Treasury Yield 2Y', group: 'USD / SUKU BUNGA' },
  { symbol: 'USDJPY', label: 'USDJPY', group: 'MATA UANG' },
  { symbol: 'EURUSD', label: 'EURUSD', group: 'MATA UANG' },
  { symbol: 'USDCHF', label: 'USDCHF', group: 'MATA UANG' },
  { symbol: 'USOIL', label: 'WTI Crude Oil', group: 'KOMODITAS' },
  { symbol: 'XAGUSD', label: 'Silver · XAGUSD', group: 'KOMODITAS' },
  { symbol: 'HG', label: 'Copper', group: 'KOMODITAS' },
  { symbol: 'SPX500', label: 'S&P 500', group: 'RISK SENTIMENT' },
  { symbol: 'BTCUSDT', label: 'Bitcoin · BTCUSDT', group: 'RISK SENTIMENT' },
];
const fmtPrice = v => Number.isFinite(v) ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—';
const emptyReading = symbol => ({ symbol, trend: 'MEMUAT DATA…', price: null, date: null, source: null, error: null });

function summarizeCandles(symbol, input) {
  const valid = (Array.isArray(input) ? input : []).filter(c =>
    c && [Number(c.open), Number(c.high), Number(c.low), Number(c.close)].every(Number.isFinite) &&
    Number(c.high) >= Math.max(Number(c.open), Number(c.close), Number(c.low)) &&
    Number(c.low) <= Math.min(Number(c.open), Number(c.close), Number(c.high)) &&
    c.isSimulated !== true
  ).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp);
  if (valid.length < 20) return {
    symbol, trend: 'DATA BELUM CUKUP', price: valid.length ? Number(valid.at(-1).close) : null,
    date: valid.at(-1)?.timestamp || null, source: valid.at(-1)?.source || null,
    error: `Hanya ${valid.length} candle D1 valid; diperlukan minimal 20.`
  };
  const closes = valid.map(c => Number(c.close));
  const recent = closes.slice(-5).reduce((s, v) => s + v, 0) / 5;
  const prior = closes.slice(-20, -5).reduce((s, v) => s + v, 0) / 15;
  return {
    symbol,
    trend: recent > prior * 1.001 ? 'BULLISH' : recent < prior * 0.999 ? 'BEARISH' : 'SIDEWAYS',
    price: closes.at(-1), date: valid.at(-1)?.timestamp || null,
    source: valid.at(-1)?.source || null, error: null,
  };
}

async function fetchDaily(symbol) {
  const response = await fetch(`/api/trading/ohlc?symbol=${encodeURIComponent(symbol)}&timeframe=D1&limit=60`, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok || !data?.ok || !Array.isArray(data.candles)) {
    throw new Error(data?.error || data?.message || `OHLC HTTP ${response.status}`);
  }
  const candles = data.candles.map(c => ({
    ...c,
    open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close),
    timestamp: c.timestamp || c.time || c.date || c.datetime,
    source: c.source || data.source || 'UNKNOWN',
    isSimulated: c.isSimulated ?? data.isSimulated ?? false,
  }));
  return { data, candles, reading: summarizeCandles(symbol, candles) };
}

export default function CrossAssetMonitor() {
  const [revision, setRevision] = useState(0);
  const [readings, setReadings] = useState(() => Object.fromEntries(ASSETS.map(a => [a.symbol, emptyReading(a.symbol)])));
  const [errors, setErrors] = useState({});
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(false);

  const refreshAll = async () => {
    setLoading(true);
    const results = await Promise.allSettled(ASSETS.map(asset => fetchDaily(asset.symbol)));
    const nextReadings = {};
    const nextErrors = {};
    const allCandles = [];
    results.forEach((result, index) => {
      const symbol = ASSETS[index].symbol;
      if (result.status === 'fulfilled') {
        const { reading, candles, data } = result.value;
        nextReadings[symbol] = reading;
        if (reading.error) nextErrors[symbol] = reading.error;
        allCandles.push(...candles.map(c => ({ ...c, symbol, timeframe: 'D1' })));
        if (reading.trend === 'DATA BELUM CUKUP') nextErrors[symbol] = reading.error;
      } else {
        const message = String(result.reason?.message || result.reason || 'Data tidak tersedia');
        nextReadings[symbol] = { ...emptyReading(symbol), trend: 'DATA TIDAK TERSEDIA', error: message };
        nextErrors[symbol] = message;
      }
    });
    setReadings(current => ({ ...current, ...nextReadings }));
    setErrors(nextErrors);
    setUpdatedAt(new Date().toISOString());
    if (allCandles.length) {
      marketDataServiceInstance.addBatchCandles(allCandles);
      marketDataServiceInstance.setStatus('CONNECTED', { source: 'YAHOO_FINANCE', isSimulated: false });
    }
    setRevision(v => v + 1);
    setLoading(false);
  };

  useEffect(() => {
    let alive = true;
    const run = async () => { if (alive) await refreshAll(); };
    run();
    const timer = setInterval(run, 60000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  const rows = useMemo(() => ASSETS.map(asset => ({
    ...asset, reading: readings[asset.symbol] || emptyReading(asset.symbol),
  })), [readings, revision]);

  const pill = value => ({
    display: 'inline-block', padding: '4px 7px', borderRadius: 4, fontSize: 9, fontWeight: 900,
    border: '1px solid ' + (value === 'BULLISH' ? '#166534' : value === 'BEARISH' ? '#9f1239' : '#334155'),
    color: value === 'BULLISH' ? '#4ade80' : value === 'BEARISH' ? '#fb7185' : '#cbd5e1',
    background: value === 'BULLISH' ? '#052e16' : value === 'BEARISH' ? '#4c0519' : '#0f172a',
  });

  return <section style={{ marginTop: 12, padding: 12, border: '1px solid #164e63', borderRadius: 8, background: '#06101d', color: '#dbeafe', fontFamily: 'Inter,system-ui,sans-serif' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ margin: 0, color: '#67e8f9', fontSize: 14, letterSpacing: '.06em' }}>JIN CROSS-ASSET GOLD MONITOR</h2>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 5 }}>Tren harian D1 · pembaruan otomatis setiap 60 detik · data publik dapat tertunda</div>
      </div>
      <button onClick={refreshAll} disabled={loading} style={{ padding: '7px 10px', background: '#082f49', border: '1px solid #0e7490', borderRadius: 5, color: '#67e8f9', fontWeight: 800, cursor: loading ? 'wait' : 'pointer' }}>{loading ? 'MEMUAT DATA…' : '↻ REFRESH DATA'}</button>
    </header>
    {Object.keys(errors).length > 0 && <div role="status" style={{ marginTop: 8, color: '#fbbf24', fontSize: 10 }}>{Object.keys(errors).length} instrumen bermasalah atau belum memiliki 20 candle D1 valid. Rincian tersedia saat mengarahkan kursor ke status instrumen.</div>}
    <div style={{ marginTop: 10, overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 360, borderCollapse: 'collapse', fontSize: 10 }}>
        <thead><tr>{['INSTRUMEN', 'D1 TREND'].map(h => <th key={h} style={{ padding: 8, textAlign: 'left', color: '#94a3b8', borderBottom: '1px solid #164e63', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map(asset => <tr key={asset.symbol}>
          <td style={{ padding: 8, borderBottom: '1px solid #12283a', fontWeight: 800, color: asset.symbol === 'XAUUSD' ? '#67e8f9' : '#e2e8f0' }}>
            {asset.label}<div style={{ fontSize: 8, color: '#64748b', marginTop: 3 }}>{asset.group}</div>
          </td>
          <td style={{ padding: 8, borderBottom: '1px solid #12283a', whiteSpace: 'nowrap' }} title={errors[asset.symbol] || asset.reading.error || `Sumber: ${asset.reading.source || 'menunggu data'}`}>
            <span style={pill(asset.reading.trend)}>{asset.reading.trend}</span>
            {asset.reading.price != null && <div style={{ fontSize: 9, color: '#cbd5e1', marginTop: 4 }}>{fmtPrice(asset.reading.price)}{asset.reading.date ? ` · ${new Date(asset.reading.date).toLocaleDateString()}` : ''}</div>}
          </td>
        </tr>)}</tbody>
      </table>
    </div>
    <div style={{ marginTop: 8, fontSize: 9, color: '#64748b' }}>
      {updatedAt ? `Pembaruan terakhir: ${new Date(updatedAt).toLocaleTimeString()} · ` : ''}Sumber: Yahoo Finance (data publik, dapat tertunda). XAUUSD memakai proksi futures emas GC=F, bukan kuotasi spot MT5. Tren memakai 20 candle D1 valid; bukan rekomendasi transaksi.
    </div>
  </section>;
}
