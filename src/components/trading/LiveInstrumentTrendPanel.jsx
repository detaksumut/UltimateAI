import React from 'react';

const instruments = [
  { symbol: 'TVC:DXY', label: 'DXY · US Dollar Index' },
  { symbol: 'TVC:US10Y', label: 'US 10Y Yield' },
  { symbol: 'TVC:USOIL', label: 'WTI Crude Oil' },
  { symbol: 'OANDA:XAGUSD', label: 'Silver · XAGUSD' },
  { symbol: 'OANDA:EURUSD', label: 'EURUSD' },
];

export default function LiveInstrumentTrendPanel() {
  return (
    <section aria-label="Trend Instrumen Live" style={{ border: '1px solid #164e63', borderRadius: 7, background: '#06101d', padding: 12, color: '#e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <h2 style={{ margin: 0, color: '#22d3ee', fontSize: 13, letterSpacing: 1, fontWeight: 900 }}>TREND INSTRUMEN LIVE</h2>
        <span style={{ color: '#94a3b8', fontSize: 10 }}>Widget TradingView · mengikuti ketersediaan penyedia</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
        {instruments.map(item => (
          <article key={item.symbol} style={{ minWidth: 0, border: '1px solid #164e63', borderRadius: 6, overflow: 'hidden', background: '#030812' }}>
            <div style={{ padding: '8px 10px', color: '#bae6fd', fontSize: 11, fontWeight: 800 }}>{item.label}</div>
            <iframe
              title={`TradingView live trend ${item.symbol}`}
              src={`https://www.tradingview.com/widgetembed/?symbol=${encodeURIComponent(item.symbol)}&interval=D&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=030812&studies=[]&theme=dark&style=1&timezone=Asia%2FJakarta&withdateranges=0&hideideas=1`}
              style={{ display: 'block', width: '100%', height: 190, border: 0 }}
              loading="lazy"
              allowFullScreen
            />
          </article>
        ))}
      </div>
      <p style={{ margin: '9px 0 0', color: '#64748b', fontSize: 10, lineHeight: 1.5 }}>
        Widget lintas-instrumen ini terpisah dari feed candle internal JIN. Harga, jeda pembaruan, dan ketersediaan simbol bergantung pada TradingView serta bursa terkait.
      </p>
    </section>
  );
}
