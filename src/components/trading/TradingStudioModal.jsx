import React, { useEffect, useState } from 'react';
import AIAnalystPanel from './AIAnalystPanel.jsx';
import VisualChartCapturePanel from './VisualChartCapturePanel.jsx';
import GoldNewsModal from './GoldNewsModal.jsx';
import CrossAssetMonitor from './CrossAssetMonitor.jsx';

const instruments = [
  { value: 'OANDA:XAUUSD', label: 'XAUUSD (Gold)' },
  { value: 'TVC:DXY', label: 'DXY (US Dollar Index)' },
  { value: 'TVC:US10Y', label: 'US Treasury Yield 10Y' },
  { value: 'TVC:US02Y', label: 'US Treasury Yield 2Y' },
  { value: 'OANDA:USDJPY', label: 'USDJPY' },
  { value: 'OANDA:EURUSD', label: 'EURUSD' },
  { value: 'OANDA:USDCHF', label: 'USDCHF' },
  { value: 'TVC:USOIL', label: 'USOIL (WTI Crude Oil)' },
  { value: 'OANDA:XAGUSD', label: 'XAGUSD (Silver)' },
  { value: 'COMEX:HG1!', label: 'Copper Futures' },
  { value: 'CAPITALCOM:US500', label: 'S&P 500' },
  { value: 'BINANCE:BTCUSDT', label: 'BTCUSDT' },
  { value: 'BINANCE:ETHUSDT', label: 'ETHUSDT' },
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
  const [interval, setInterval] = useState('240');
  const [chartMode, setChartMode] = useState('normal');
  const [tradingViewMode, setTradingViewMode] = useState('widget');
  const [signal, setSignal] = useState(null);
  const [showGoldNews, setShowGoldNews] = useState(false);
  useEffect(() => {
    const onSignal = event => setSignal(event.detail || null);
    const onClear = () => setSignal(null);
    window.addEventListener('jin:signal-ready', onSignal);
    window.addEventListener('jin:signal-clear', onClear);
    return () => { window.removeEventListener('jin:signal-ready', onSignal); window.removeEventListener('jin:signal-clear', onClear); };
  }, []);
  const instrument = symbol.split(':').pop();
  const timeframe = ({ '5': 'M5', '15': 'M15', '30': 'M30', '60': 'H1', '240': 'H4', D: 'D1' })[interval] || 'H1';
  const isFullChart = chartMode === 'full';
  const gridColumns = 'repeat(2, minmax(0, 1fr))';

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
          <div role="group" aria-label="Mode TradingView" style={{ display: 'flex', gap: 4, padding: 3, border: '1px solid #164e63', borderRadius: 5, background: '#06101d' }}>
            <button type="button" onClick={() => window.open('https://id.tradingview.com/chart/W7kNYFdb/', '_blank', 'noopener,noreferrer')} aria-pressed={false} style={modeButtonStyle(false)} title="Buka chart TradingView tersimpan di tab baru">↗ Chart Lengkap</button>
            <button type="button" onClick={() => setTradingViewMode('widget')} aria-pressed={tradingViewMode === 'widget'} style={modeButtonStyle(tradingViewMode === 'widget')} title="Gunakan widget chart embed">▥ Widget</button>
          </div>
          <div role="group" aria-label="Ukuran chart" style={{ display: 'flex', gap: 4, padding: 3, border: '1px solid #164e63', borderRadius: 5, background: '#06101d' }}>
            <button type="button" onClick={() => setChartMode('compact')} aria-pressed={chartMode === 'compact'} style={modeButtonStyle(chartMode === 'compact')} title="Perkecil chart, perluas area analisis">▤ Compact</button>
            <button type="button" onClick={() => setChartMode('normal')} aria-pressed={chartMode === 'normal'} style={modeButtonStyle(chartMode === 'normal')} title="Tampilan chart dan AI normal">▥ Normal</button>
            <button type="button" onClick={() => setChartMode('full')} aria-pressed={chartMode === 'full'} style={modeButtonStyle(chartMode === 'full')} title="Perbesar chart, sembunyikan panel analisis sementara">⛶ Full Chart</button>
          </div>
          {onClose && <button type="button" onClick={onClose} style={closeStyle} aria-label="Tutup Trading Studio">✕</button>}
        </div>
      </header>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:8}}>
        <div style={{fontSize:9,color:"#94a3b8"}}>Chart TradingView · AI Technical Analysis, pemantauan lintas-instrumen D1/H4, dan penelusuran berita fundamental tersaji di bawah chart.</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <a href="https://id.tradingview.com/chart/W7kNYFdb/" target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",padding:"8px 10px",border:"1px solid #155e75",borderRadius:6,background:"#071827",color:"#bae6fd",fontSize:10,fontWeight:800,textDecoration:"none"}}>↗ BUKA CHART TERSIMPAN</a>
          <button type="button" onClick={()=>setShowGoldNews(true)} style={{padding:"9px 13px",border:"1px solid #0891b2",borderRadius:6,background:"#062333",color:"#67e8f9",fontWeight:900,cursor:"pointer"}}>✦ BERITA FUNDAMENTAL EMAS</button>
        </div>
      </div>
      
      <div className="jin-trading-grid" style={{ display: 'grid', gridTemplateColumns: gridColumns, gap: 10, minHeight: 'calc(100vh - 95px)', alignItems: 'start' }}>
        <section aria-label="TradingView live chart" style={{ position: 'relative', minWidth: 0, minHeight: isFullChart ? 'calc(100vh - 105px)' : 560, height: isFullChart ? 'calc(100vh - 105px)' : 'auto', border: '1px solid #164e63', borderRadius: 7, overflow: 'hidden', background: '#030812' }}>
          <iframe
            title={`TradingView ${instrument} ${timeframe}`}
            src={`https://www.tradingview.com/widgetembed/?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=030812&studies=[]&theme=dark&style=1&timezone=Asia%2FJakarta&withdateranges=1&hideideas=1`}
            style={{ width: '100%', height: '100%', minHeight: isFullChart ? 'calc(100vh - 105px)' : 560, border: 0, display: 'block' }}
            allowFullScreen
          />
          {signal && <div role="status" style={{ position: 'absolute', zIndex: 5, top: 58, right: 18, width: 220, padding: 10, borderRadius: 6, border: '1px solid ' + (signal.side === 'BUY' ? '#10b981' : signal.side === 'SELL' ? '#f43f5e' : '#f59e0b'), background: 'rgba(3,8,18,.94)', boxShadow: '0 4px 18px #0008', pointerEvents: 'none' }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: signal.side === 'BUY' ? '#34d399' : signal.side === 'SELL' ? '#fb7185' : '#fbbf24' }}>JIN SIGNAL · {signal.side}</div>
            <div style={{ fontSize: 10, color: '#e2e8f0', marginTop: 5 }}>Entry: {Number.isFinite(signal.entry) ? signal.entry.toFixed(2) : '—'}</div>
            <div style={{ fontSize: 10, color: '#e2e8f0' }}>SL: {Number.isFinite(signal.stopLoss) ? signal.stopLoss.toFixed(2) : '—'} · TP: {Number.isFinite(signal.takeProfit) ? signal.takeProfit.toFixed(2) : '—'}</div>
            <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 5 }}>{signal.reason}</div>
            <div style={{ fontSize: 8, color: '#64748b', marginTop: 5 }}>Dari pembacaan 4 TF · {signal.createdAt ? new Date(signal.createdAt).toLocaleTimeString() : ''}</div>
          </div>}
        </section>
        <section aria-label="AI Technical Analyst" style={{minWidth:0,minHeight:560,border:'1px solid #164e63',borderRadius:7,background:'#06101d',padding:12,boxSizing:'border-box'}}>
          <h2 style={{color:'#22d3ee',fontSize:12,letterSpacing:1,fontWeight:800,margin:'0 0 12px'}}>JIN GOLD TECHNICAL ANALYSIS</h2>
          <VisualChartCapturePanel instrument={instrument} timeframe={timeframe} onTimeframeChange={setInterval} />
          <AIAnalystPanel instrument={instrument} timeframe={timeframe} />
        </section>
      </div>
      
      <section aria-label="Fundamental news and cross-asset monitor" className="jin-fundamental-crossasset-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 12, alignItems: 'start', minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <GoldNewsModal open={true} onClose={() => {}} instrument={instrument} inline />
        </div>
        <div style={{ minWidth: 0 }}>
          <CrossAssetMonitor />
        </div>
      </section>
      <style>{'@media(max-width:900px){.jin-trading-grid,.jin-fundamental-crossasset-grid{grid-template-columns:1fr!important}.jin-trading-grid section[aria-label="TradingView live chart"]{height:auto!important;min-height:60vh!important}}'}</style>
    </main>
  );
}

const labelStyle = { display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 10, fontWeight: 700 };
const selectStyle = { padding: '6px 8px', background: '#071827', color: '#dbeafe', border: '1px solid #155e75', borderRadius: 4, fontSize: 11 };
const closeStyle = { width: 28, height: 28, border: '1px solid #ef4444', borderRadius: 4, background: '#220b12', color: '#f87171', fontWeight: 900, cursor: 'pointer' };
const modeButtonStyle = active => ({ padding: '6px 8px', border: active ? '1px solid #22d3ee' : '1px solid transparent', borderRadius: 4, background: active ? 'rgba(8,145,178,0.2)' : 'transparent', color: active ? '#67e8f9' : '#94a3b8', fontSize: 10, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' });
