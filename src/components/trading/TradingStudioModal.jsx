import React, { useState } from 'react';
import AIAnalystPanel from './AIAnalystPanel.jsx';
import VisualChartCapturePanel from './VisualChartCapturePanel.jsx';
import JINLiveSignalChart from './JINLiveSignalChart.jsx';

const instruments = [
  { value: 'OANDA:XAUUSD', label: 'XAUUSD (Gold)' },
  { value: 'BINANCE:BTCUSDT', label: 'BTCUSDT' },
  { value: 'BINANCE:ETHUSDT', label: 'ETHUSDT' },
  { value: 'OANDA:EURUSD', label: 'EURUSD' },
  { value: 'OANDA:GBPUSD', label: 'GBPUSD' },
  { value: 'CAPITALCOM:US30', label: 'US30' },
];
const intervals = [
  { value: '5', label: 'M5' },
  { value: '15', label: 'M15' },
  { value: '30', label: 'M30' },
  { value: '60', label: 'H1' },
  { value: '240', label: 'H4' },
  { value: 'D', label: 'D1' },
];

export default function TradingStudioModal({ onClose }) {
  const [symbol, setSymbol] = useState('OANDA:XAUUSD');
  const [interval, setInterval] = useState('60');
  const [chartMode, setChartMode] = useState('normal');
  const instrument = symbol.split(':').pop();
  const timeframe = ({ '5': 'M5', '15': 'M15', '30': 'M30', '60': 'H1', '240': 'H4', D: 'D1' })[interval] || 'H1';
  const isFullChart = chartMode === 'full';
  const gridColumns = isFullChart ? 'minmax(0, 1fr)' : chartMode === 'compact' ? 'minmax(280px, 0.85fr) minmax(360px, 1.4fr)' : 'minmax(0, 1.65fr) minmax(300px, 1fr)';

  return (
    <main style={{ minHeight: 'calc(100vh - 24px)', background: '#030812', color: '#e2e8f0', padding: 10, fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ color: '#22d3ee', fontSize: 11, letterSpacing: 1.6, fontWeight: 800 }}>JIN TRADING INTELLIGENCE STUDIO</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label style={labelStyle}>Instrumen
            <select value={symbol} onChange={e => setSymbol(e.target.value)} style={selectStyle}>
              {instruments.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Timeframe
            <select value={interval} onChange={e => setInterval(e.target.value)} style={selectStyle}>
              {intervals.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </label>
          <div role="group" aria-label="Ukuran chart" style={{ display: 'flex', gap: 4, padding: 3, border: '1px solid #164e63', borderRadius: 5, background: '#06101d' }}>
            <button type="button" onClick={() => setChartMode('compact')} aria-pressed={chartMode === 'compact'} style={modeButtonStyle(chartMode === 'compact')} title="Perkecil chart, perluas area analisis">▤ Compact</button>
            <button type="button" onClick={() => setChartMode('normal')} aria-pressed={chartMode === 'normal'} style={modeButtonStyle(chartMode === 'normal')} title="Tampilan chart dan AI normal">▥ Normal</button>
            <button type="button" onClick={() => setChartMode('full')} aria-pressed={chartMode === 'full'} style={modeButtonStyle(chartMode === 'full')} title="Perbesar chart, sembunyikan panel analisis sementara">⛶ Full Chart</button>
          </div>
          {onClose && <button type="button" onClick={onClose} style={closeStyle} aria-label="Tutup Trading Studio">✕</button>}
        </div>
      </header>

      <div className="jin-trading-grid" style={{ display: 'grid', gridTemplateColumns: gridColumns, gap: 10, minHeight: 'calc(100vh - 95px)', alignItems: 'stretch' }}>
        <section aria-label="JIN live candlestick chart" style={{ minWidth: 0, minHeight: isFullChart ? 'calc(100vh - 105px)' : 560, height: isFullChart ? 'calc(100vh - 105px)' : 'auto', border: '1px solid #164e63', borderRadius: 7, overflow: 'hidden', background: '#030812' }}>
          <JINLiveSignalChart symbol={instrument} interval={interval} />
        </section>
        {!isFullChart && <section aria-label="AI Technical Analyst" style={{ minWidth: 0, border: '1px solid #164e63', borderRadius: 7, background: '#06101d', padding: 12, overflowY: 'auto' }}>
          <h2 style={{ color: '#22d3ee', fontSize: 12, letterSpacing: 1, fontWeight: 800, margin: '0 0 12px' }}>AI TECHNICAL ANALYST</h2>
          <VisualChartCapturePanel instrument={instrument} timeframe={timeframe} onTimeframeChange={setInterval} />
          <AIAnalystPanel instrument={instrument} timeframe={timeframe} />
        </section>}
      </div>
      <style>{'@media(max-width:850px){.jin-trading-grid{grid-template-columns:1fr!important}.jin-trading-grid section[aria-label="TradingView live chart"]{height:auto!important;min-height:60vh!important}}'}</style>
    </main>
  );
}

const labelStyle = { display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 10, fontWeight: 700 };
const selectStyle = { padding: '6px 8px', background: '#071827', color: '#dbeafe', border: '1px solid #155e75', borderRadius: 4, fontSize: 11 };
const closeStyle = { width: 28, height: 28, border: '1px solid #ef4444', borderRadius: 4, background: '#220b12', color: '#f87171', fontWeight: 900, cursor: 'pointer' };
const modeButtonStyle = active => ({ padding: '6px 8px', border: active ? '1px solid #22d3ee' : '1px solid transparent', borderRadius: 4, background: active ? 'rgba(8,145,178,0.2)' : 'transparent', color: active ? '#67e8f9' : '#94a3b8', fontSize: 10, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' });
