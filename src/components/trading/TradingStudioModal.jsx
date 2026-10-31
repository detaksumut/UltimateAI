import React from 'react';

const CHARTS = [
  { symbol: 'TVC:USOIL', title: 'WTI OIL USD' },
  { symbol: 'OANDA:XAGUSD', title: 'SILVER XAGUSD' },
];

function chartUrl(symbol) {
  const params = new URLSearchParams({
    symbol,
    interval: 'D',
    theme: 'dark',
    style: '1',
    timezone: 'Asia/Jakarta',
    hide_top_toolbar: '1',
    hide_legend: '1',
    hide_volume: '1',
    hidesidetoolbar: '1',
    symboledit: '0',
    saveimage: '0',
    withdateranges: '0',
    hideideas: '1',
    toolbarbg: '030812',
    details: '0',
    hotlist: '0',
    calendar: '0',
  });
  return `https://www.tradingview.com/widgetembed/?${params.toString()}`;
}

export default function TradingStudioModal() {
  return (
    <main
      aria-label="Live Oil and Silver Charts"
      style={{
        width: '100%',
        height: '100vh',
        minHeight: '100vh',
        boxSizing: 'border-box',
        padding: 8,
        margin: 0,
        background: '#030812',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gridTemplateRows: 'minmax(0, 1fr)',
        alignItems: 'stretch',
        gap: 8,
        overflow: 'hidden',
      }}
    >
      {CHARTS.map(({ symbol, title }) => (
        <section
          key={symbol}
          aria-label={title}
          style={{
            minWidth: 0,
            minHeight: 0,
            height: '100%',
            overflow: 'hidden',
            borderRadius: 4,
            background: '#030812',
          }}
        >
          <iframe
            title={title}
            src={chartUrl(symbol)}
            loading="eager"
            style={{ display: 'block', width: '100%', height: '100%', minHeight: 0, border: 0 }}
            allowFullScreen
          />
        </section>
      ))}
      <style>{'@media(max-width:700px){main[aria-label="Live Oil and Silver Charts"]{height:100vh!important;grid-template-columns:1fr!important;grid-template-rows:repeat(2,minmax(0,1fr))!important;overflow:auto!important}main[aria-label="Live Oil and Silver Charts"] section{height:calc(50vh - 12px)!important;min-height:220px!important}}'}</style>
    </main>
  );
}
