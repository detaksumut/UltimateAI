import React from 'react';

/**
 * MarketSentimentGauge
 * Displays a semi-circular gauge meter showing calculated market sentiment.
 * If data is unavailable or insufficient, displays 'BELUM TERSEDIA' without cosmetic numbers.
 */
export default function MarketSentimentGauge({ sentiment = 'BELUM TERSEDIA', confidence = null }) {
  const hasConfidence = Number.isFinite(confidence);
  const isBearish = /bear/i.test(sentiment);
  const isBullish = /bull/i.test(sentiment);
  
  const radius = 58;
  const circumference = Math.PI * radius; // ≈ 182.2
  const percentage = hasConfidence ? Math.min(100, Math.max(0, confidence)) : 0;
  const dashOffset = hasConfidence ? circumference - (percentage / 100) * circumference : circumference;

  const color = !hasConfidence
    ? '#64748b'
    : isBearish
    ? '#f43f5e'
    : isBullish
    ? '#10b981'
    : '#f59e0b';

  const trackColor = 'rgba(255, 255, 255, 0.08)';

  return (
    <div
      style={{
        background: '#071224',
        border: '1px solid rgba(0, 229, 255, 0.15)',
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 150,
        position: 'relative',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
      }}
    >
      <div
        style={{
          width: '100%',
          textAlign: 'left',
          fontSize: 11,
          fontWeight: 700,
          color: '#94a3b8',
          marginBottom: 4,
          letterSpacing: '0.04em'
        }}
      >
        Sentimen Pasar
      </div>

      <div style={{ position: 'relative', width: 140, height: 75, display: 'flex', justifyContent: 'center' }}>
        <svg width="140" height="75" viewBox="0 0 140 75" style={{ overflow: 'visible' }}>
          {/* Background Track Arc */}
          <path
            d="M 12 70 A 58 58 0 0 1 128 70"
            fill="none"
            stroke={trackColor}
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Filled Sentiment Arc (only if confidence is valid) */}
          {hasConfidence && (
            <path
              d="M 12 70 A 58 58 0 0 1 128 70"
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{
                transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.3s ease',
                filter: `drop-shadow(0 0 6px ${color}88)`
              }}
            />
          )}
        </svg>

        {/* Center icon & text inside arc */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>
            {!hasConfidence ? '⚖️' : isBearish ? '🐻' : isBullish ? '🐂' : '⚖️'}
          </span>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#f1f5f9', marginTop: 2 }}>
            {sentiment}
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, color, fontFamily: 'monospace', lineHeight: 1.1 }}>
            {hasConfidence ? `${percentage}%` : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}
