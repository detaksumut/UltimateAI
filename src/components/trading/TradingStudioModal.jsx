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

export default function TradingStudioModal({ onClose }) {
  return (
    <main
      aria-label="Live Oil and Silver Charts"
      style={{
        minHeight: '100%',
        width: '100%',
        boxSizing: 'border-box',
        padding: 8,
        background: '#030812',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 8,
      }}
    >
      {CHARTS.map(({ symbol, title }) => (
        <section
          key={symbol}
          aria-label={title}
          style={{
            minWidth: 0,
            height: 'min(68vh, 420px)',
            minHeight: 240,
            overflow: 'hidden',
            borderRadius: 6,
            background: '#030812',
          }}
        >
          <iframe
            title={title}
            src={chartUrl(symbol)}
            loading="lazy"
            style={{ display: 'block', width: '100%', height: '100%', border: 0 }}
            allowFullScreen
          />
        </section>
      ))}
      <style>{'@media(max-width:700px){main[aria-label="Live Oil and Silver Charts"]{grid-template-columns:1fr!important}main[aria-label="Live Oil and Silver Charts"] section{height:42vh!important;min-height:220px!important}}'}</style>
    </main>
  );
}
