import React from 'react';

const instruments = [
  { symbol: 'TVC:USOIL', label: 'WTI OIL USD' },
  { symbol: 'TVC:UKOIL', label: 'BRENT OIL USD' },
  { symbol: 'OANDA:XAGUSD', label: 'SILVER XAGUSD' },
];

export default function LiveInstrumentTrendPanel() {
  return (
    <section aria-label="Live Oil and Silver Charts" style={{ width: '100%', boxSizing: 'border-box', background: '#030812', padding: 4, color: '#e2e8f0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4 }}>
        {instruments.map(item => (
          <article key={item.symbol} aria-label={item.label} style={{ minWidth: 0, height: 'clamp(220px, 34vh, 360px)', overflow: 'hidden', background: '#030812' }}>
            <iframe
              title={item.label}
              src={`https://www.tradingview.com/widgetembed/?symbol=${encodeURIComponent(item.symbol)}&interval=D&hidesidetoolbar=1&hide_side_toolbar=1&hide_top_toolbar=1&symboledit=0&saveimage=0&toolbarbg=030812&studies=[]&theme=dark&style=1&timezone=Asia%2FJakarta&withdateranges=0&hideideas=1&hide_legend=1&hide_volume=1&details=0&hotlist=0&calendar=0`}
              style={{ display: 'block', width: '100%', height: '100%', border: 0 }}
              loading="eager"
              allowFullScreen
            />
          </article>
        ))}
      </div>
      <style>{'@media(max-width:700px){section[aria-label="Live Oil and Silver Charts"]>div{grid-template-columns:1fr!important}section[aria-label="Live Oil and Silver Charts"] article{height:40vh!important;min-height:220px!important}}'}</style>
    </section>
  );
}
