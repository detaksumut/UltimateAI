import React from 'react';

/**
 * AnalysisSummaryCard
 * Displays structured bullet points for analysis summary, support/resistance levels,
 * and continuation scenarios derived purely from actual candle calculations.
 * Never outputs hardcoded mock levels.
 */
export default function AnalysisSummaryCard({
  instrument = 'XAUUSD',
  timeframe = 'H1',
  summaryBullets = [],
  resistance = null,
  support = null,
  trend = 'UNKNOWN',
  lastPrice = null,
  dataStatus = 'WAITING'
}) {
  const hasData = Number.isFinite(lastPrice) && summaryBullets && summaryBullets.length > 0;

  const bullets = hasData
    ? summaryBullets
    : [
        `Menunggu data candle valid untuk instrumen ${instrument} timeframe ${timeframe}.`,
        Number.isFinite(resistance) && Number.isFinite(support)
          ? `Level terhitung: Resistance 20-bar di ${Number(resistance).toFixed(2)}, Support di ${Number(support).toFixed(2)}.`
          : 'Level support & resistance akan dihitung dari high/low 20-candle terakhir setelah data diterima.',
        'Skenario trading dan validasi tren hanya diproses dari feed data riil (tanpa asumsi statis).'
      ];

  return (
    <div
      style={{
        background: '#071224',
        border: '1px solid rgba(0, 229, 255, 0.15)',
        borderRadius: 10,
        padding: '14px 16px',
        flex: 1,
        minWidth: 260,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#00e5ff', fontSize: 13 }}>ℹ️</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#f1f5f9', letterSpacing: '0.04em' }}>
            Ringkasan Analisis
          </span>
        </div>
        <span style={{ fontSize: 9, fontFamily: 'monospace', color: hasData ? '#38bdf8' : '#94a3b8' }}>
          {hasData ? `${instrument} · ${timeframe}` : dataStatus}
        </span>
      </div>

      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: '#cbd5e1', lineHeight: 1.6 }}>
        {bullets.map((bullet, idx) => (
          <li key={idx} style={{ marginBottom: 4 }}>
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  );
}
