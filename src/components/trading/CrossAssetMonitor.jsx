import React, { useEffect, useMemo, useState } from 'react';
import { marketDataServiceInstance } from '../../services/trading/MarketDataService.js';
import { getChartCandles } from '../../services/trading/ChartReader.js';

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

function summarize(symbol) {
  const result = getChartCandles(symbol, 'D1', 200);
  const candles = (result.candles || []).filter(c => Number.isFinite(c.close));
  if (candles.length < 20) return { symbol, trend: 'DATA BELUM CUKUP', price: null, date: null };
  const closes = candles.map(c => c.close);
  const last = closes.at(-1);
  const recent = closes.slice(-5).reduce((s, v) => s + v, 0) / 5;
  const prior = closes.slice(-20, -5).reduce((s, v) => s + v, 0) / 15;
  return {
    symbol,
    trend: recent > prior * 1.001 ? 'BULLISH' : recent < prior * 0.999 ? 'BEARISH' : 'SIDEWAYS',
    price: last,
    date: candles.at(-1)?.timestamp || null,
  };
}

function summarizeGold(candles) {
  const valid = (Array.isArray(candles) ? candles : [])
    .filter(c => c && [c.open, c.high, c.low, c.close].every(Number.isFinite) &&
      c.high >= Math.max(c.open, c.close, c.low) &&
      c.low <= Math.min(c.open, c.close, c.high) &&
      c.isSimulated !== true &&
      ['GOLDPRICE_DEV', 'MT5_LOCAL_BRIDGE'].includes(c.source))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  if (valid.length < 20) return { symbol: 'XAUUSD', trend: 'DATA BELUM CUKUP', price: valid.at(-1)?.close ?? null, date: valid.at(-1)?.timestamp ?? null };
  const closes = valid.map(c => c.close);
  const last = closes.at(-1);
  const recent = closes.slice(-5).reduce((s, v) => s + v, 0) / 5;
  const prior = closes.slice(-20, -5).reduce((s, v) => s + v, 0) / 15;
  return {
    symbol: 'XAUUSD',
    trend: recent > prior * 1.001 ? 'BULLISH' : recent < prior * 0.999 ? 'BEARISH' : 'SIDEWAYS',
    price: last,
    date: valid.at(-1)?.timestamp || null,
  };
}

export default function CrossAssetMonitor() {
  const [revision, setRevision] = useState(0);
  const [gold, setGold] = useState({ symbol: 'XAUUSD', trend: 'MEMUAT DATA…', price: null, date: null });
  const [goldError, setGoldError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(false);

  const refreshGold = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/trading/ohlc?symbol=XAUUSD&timeframe=D1&limit=30', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data?.ok || !Array.isArray(data.candles)) {
        throw new Error(data?.error || data?.message || `OHLC HTTP ${response.status}`);
      }
      const candles = data.candles;
      const nextGold = summarizeGold(candles);
      setGold(nextGold);
      setGoldError(nextGold.trend === 'DATA BELUM CUKUP' ? 'Riwayat candle D1 valid belum cukup untuk menghitung tren.' : '');
      setUpdatedAt(new Date().toISOString());
      const marketCandles = candles.filter(c => c && Number.isFinite(c.close)).map(c => ({
        ...c, symbol: 'XAUUSD', timeframe: 'D1', source: c.source || data.source || 'GOLDPRICE_DEV', isSimulated: c.isSimulated === true,
      }));
      if (marketCandles.length) {
        marketDataServiceInstance.addBatchCandles(marketCandles);
        marketDataServiceInstance.setStatus('CONNECTED', { source: data.source || 'GOLDPRICE_DEV', isSimulated: false });
      }
    } catch (error) {
      setGoldError(error?.message || 'Gagal mengambil data D1');
      setGold(current => ({ ...current, trend: 'DATA TIDAK TERSEDIA' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = marketDataServiceInstance.subscribe(() => setRevision(v => v + 1));
    const timer = setInterval(() => setRevision(v => v + 1), 30000);
    refreshGold();
    const goldTimer = setInterval(refreshGold, 30000);
    return () => {
      if (typeof unsub === 'function') unsub();
      clearInterval(timer);
      clearInterval(goldTimer);
    };
  }, []);

  const rows = useMemo(() => ASSETS.map(asset => ({
    ...asset,
    reading: asset.symbol === 'XAUUSD' ? gold : summarize(asset.symbol),
  })), [revision, gold]);

  const pill = value => ({
    display: 'inline-block',
    padding: '4px 7px',
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 900,
    border: '1px solid ' + (value === 'BULLISH' ? '#166534' : value === 'BEARISH' ? '#9f1239' : '#334155'),
    color: value === 'BULLISH' ? '#4ade80' : value === 'BEARISH' ? '#fb7185' : '#cbd5e1',
    background: value === 'BULLISH' ? '#052e16' : value === 'BEARISH' ? '#4c0519' : '#0f172a',
  });

  return <section style={{ marginTop: 12, padding: 12, border: '1px solid #164e63', borderRadius: 8, background: '#06101d', color: '#dbeafe', fontFamily: 'Inter,system-ui,sans-serif' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ margin: 0, color: '#67e8f9', fontSize: 14, letterSpacing: '.06em' }}>JIN CROSS-ASSET GOLD MONITOR</h2>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 5 }}>Tren harian D1 · data diperbarui otomatis setiap 30 detik</div>
      </div>
      <button onClick={() => { setRevision(v => v + 1); refreshGold(); }} disabled={loading} style={{ padding: '7px 10px', background: '#082f49', border: '1px solid #0e7490', borderRadius: 5, color: '#67e8f9', fontWeight: 800, cursor: loading ? 'wait' : 'pointer' }}>{loading ? 'MEMUAT…' : '↻ REFRESH DATA'}</button>
    </header>
    {goldError && <div role="status" style={{ marginTop: 8, color: '#fbbf24', fontSize: 10 }}>Gold D1: {goldError}</div>}
    <div style={{ marginTop: 10, overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 360, borderCollapse: 'collapse', fontSize: 10 }}>
        <thead><tr>{['INSTRUMEN', 'D1 TREND'].map(h => <th key={h} style={{ padding: 8, textAlign: 'left', color: '#94a3b8', borderBottom: '1px solid #164e63', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map(asset => <tr key={asset.symbol}>
          <td style={{ padding: 8, borderBottom: '1px solid #12283a', fontWeight: 800, color: asset.symbol === 'XAUUSD' ? '#67e8f9' : '#e2e8f0' }}>
            {asset.label}<div style={{ fontSize: 8, color: '#64748b', marginTop: 3 }}>{asset.group}</div>
          </td>
          <td style={{ padding: 8, borderBottom: '1px solid #12283a', whiteSpace: 'nowrap' }}>
            <span style={pill(asset.reading.trend)}>{asset.reading.trend}</span>
            {asset.symbol === 'XAUUSD' && asset.reading.price != null && <div style={{ fontSize: 9, color: '#cbd5e1', marginTop: 4 }}>{fmtPrice(asset.reading.price)}{asset.reading.date ? ` · ${new Date(asset.reading.date).toLocaleDateString()}` : ''}</div>}
          </td>
        </tr>)}</tbody>
      </table>
    </div>
    <div style={{ marginTop: 8, fontSize: 9, color: '#64748b' }}>
      {updatedAt ? `Pembaruan terakhir: ${new Date(updatedAt).toLocaleTimeString()} · ` : ''}Tren Gold dihitung dari candle D1 valid yang diterima. Data paket gratis dapat tertunda; bukan harga real-time.
    </div>
  </section>;
}
