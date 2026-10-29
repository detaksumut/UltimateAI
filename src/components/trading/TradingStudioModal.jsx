import React, { useEffect, useState } from 'react';
import AIAnalystPanel from './AIAnalystPanel.jsx';
import { marketDataServiceInstance, TIMEFRAMES } from '../../services/trading/MarketDataService.js';

const instruments = [
  { value: 'XAUUSD', label: 'Gold (XAUUSD)' },
  { value: 'BTCUSDT', label: 'Bitcoin (BTCUSDT)' },
  { value: 'ETHUSDT', label: 'Ethereum (ETHUSDT)' },
];

export default function TradingStudioModal({ onClose }) {
  const [instrument, setInstrument] = useState('XAUUSD');
  const [timeframe, setTimeframe] = useState(TIMEFRAMES?.M15 || 'M15');
  const [tick, setTick] = useState(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (alive) setTick(marketDataServiceInstance.getTick(instrument) || null);
    };
    refresh();
    const unsubscribe = marketDataServiceInstance.subscribe(refresh);
    const timer = window.setInterval(refresh, 5000);
    return () => {
      alive = false;
      window.clearInterval(timer);
      unsubscribe?.();
    };
  }, [instrument]);

  const price = Number.isFinite(tick?.bid) ? tick.bid : Number.isFinite(tick?.price) ? tick.price : null;
  const fmt = (n) => Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 }) : 'Menunggu feed';

  return (
    <main style={{ minHeight: '100vh', background: '#07111f', color: '#e2e8f0', padding: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div><div style={{ color: '#22d3ee', fontSize: 11, letterSpacing: 2 }}>ULTIMATEAI • MARKET INTELLIGENCE</div><h1 style={{ fontSize: 26, margin: '6px 0' }}>Trading Studio</h1><div style={{ color: '#94a3b8', fontSize: 12 }}>Analisis teknikal berbasis data; bukan jaminan hasil transaksi.</div></div>
        {onClose && <button onClick={onClose} style={buttonStyle}>Tutup</button>}
      </header>
      <section style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: 14, border: '1px solid #1e3a52', borderRadius: 10, background: '#0b1b2c', marginBottom: 16 }}>
        <label>Instrumen <select value={instrument} onChange={e => setInstrument(e.target.value)} style={selectStyle}>{instruments.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
        <label>Timeframe <select value={timeframe} onChange={e => setTimeframe(e.target.value)} style={selectStyle}>{['M5','M15','M30','H1','H4','D1'].map(x => <option key={x}>{x}</option>)}</select></label>
        <div style={{ marginLeft: 'auto' }}><div style={{ color: '#94a3b8', fontSize: 11 }}>Harga feed terakhir</div><strong style={{ fontSize: 20 }}>{fmt(price)}</strong></div>
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
        <section style={panelStyle}><h2 style={headingStyle}>AI Technical Analyst</h2><AIAnalystPanel instrument={instrument} timeframe={timeframe} /></section>
        <section style={panelStyle}><h2 style={headingStyle}>Status Feed & Aturan</h2><p style={mutedStyle}>Instrumen: <b>{instrument}</b></p><p style={mutedStyle}>Timeframe analisis: <b>{timeframe}</b></p><p style={mutedStyle}>Feed: <b style={{ color: price == null ? '#fbbf24' : '#34d399' }}>{price == null ? 'Belum ada tick' : 'Tick tersedia'}</b></p><p style={mutedStyle}>Sinyal ditahan jika data historis kurang dari 20 candle atau feed sudah usang.</p><p style={mutedStyle}>Verifikasi sumber harga, spread, dan waktu candle sebelum keputusan transaksi.</p></section>
      </div>
    </main>
  );
}

const buttonStyle = { padding: '9px 14px', border: '1px solid #334155', borderRadius: 8, background: '#13263a', color: '#e2e8f0', cursor: 'pointer' };
const selectStyle = { display: 'block', marginTop: 5, padding: '8px 10px', background: '#102338', color: '#e2e8f0', border: '1px solid #34506b', borderRadius: 6 };
const panelStyle = { minWidth: 0, padding: 14, borderRadius: 10, border: '1px solid #1e3a52', background: '#0b1726' };
const headingStyle = { fontSize: 14, color: '#22d3ee', margin: '0 0 12px' };
const mutedStyle = { color: '#cbd5e1', fontSize: 13, lineHeight: 1.6 };
