import React from 'react';

/**
 * JINIAITradingAnalystCard
 * Top right card showing JINI AI Trading Analyst profile with avatar,
 * status indicator, and prompt capabilities.
 */
export default function JINIAITradingAnalystCard({
  status = 'ONLINE',
  onAskJINI = null
}) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #071224 0%, #0c1a36 100%)',
        border: '1px solid rgba(0, 229, 255, 0.25)',
        borderRadius: 10,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Decorative ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(0, 229, 255, 0.15)',
          filter: 'blur(20px)',
          pointerEvents: 'none'
        }}
      />

      {/* 3D Robot Avatar Box */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #0284c7 0%, #3b82f6 100%)',
          border: '1px solid rgba(0, 229, 255, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 26,
          boxShadow: '0 0 15px rgba(0, 229, 255, 0.35)',
          flexShrink: 0
        }}
      >
        🤖
      </div>

      {/* Title & Status */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '0.06em',
              fontFamily: 'monospace'
            }}
          >
            JINI
          </div>
          <div
            style={{
              fontSize: 8.5,
              fontWeight: 800,
              color: '#34d399',
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              padding: '1px 6px',
              borderRadius: 4
            }}
          >
            {status}
          </div>
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#38bdf8',
            marginTop: 2,
            letterSpacing: '0.02em'
          }}
        >
          AI Trading Analyst
        </div>
      </div>

      {onAskJINI && (
        <button
          onClick={onAskJINI}
          style={{
            background: 'rgba(0, 229, 255, 0.1)',
            border: '1px solid rgba(0, 229, 255, 0.3)',
            borderRadius: 6,
            color: '#00e5ff',
            fontSize: 10,
            fontWeight: 800,
            padding: '5px 8px',
            cursor: 'pointer'
          }}
          title="Tanya pandangan JINI"
        >
          💬 Tanya
        </button>
      )}
    </div>
  );
}
