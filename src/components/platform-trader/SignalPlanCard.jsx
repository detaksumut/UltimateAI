import React from 'react';

/**
 * SignalPlanCard
 * Displays validated trade signal with Entry, Stop Loss, Take Profit 1 & 2,
 * computed Risk/Reward ratio, and confidence metric.
 * Strictly blocks publication of mock BUY/SELL setups when criteria are not met.
 */
export default function SignalPlanCard({
  signal = null,
  instrument = 'XAUUSD',
  tradingMode = 'DEMO',
  demoAutoMode = false,
  onToggleAutoMode = null,
  onExecuteDemo = null,
  onLogJournal = null,
  compact = false
}) {
  const side = signal?.side || 'WAIT';
  const isValid = (side === 'BUY' || side === 'SELL') && signal?.isValid === true && Number.isFinite(signal?.entry);
  const isBuy = side === 'BUY' && isValid;
  const isSell = side === 'SELL' && isValid;

  const entry = isValid && Number.isFinite(signal?.entry) ? signal.entry.toFixed(2) : '—';
  const entryRange = isValid && signal?.entryRange ? signal.entryRange : (isValid ? entry : '—');
  const stopLoss = isValid && Number.isFinite(signal?.stopLoss) ? signal.stopLoss.toFixed(2) : '—';
  const tp1 = isValid && Number.isFinite(signal?.takeProfit1) ? signal.takeProfit1.toFixed(2) : '—';
  const tp2 = isValid && Number.isFinite(signal?.takeProfit2) ? signal.takeProfit2.toFixed(2) : '—';
  const rrRatio = isValid && signal?.riskReward ? signal.riskReward : '—';
  const confidence = isValid && Number.isFinite(signal?.confidence) ? `${signal.confidence}%` : '—';

  const badgeBg = isBuy
    ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.25) 0%, rgba(6, 78, 59, 0.4) 100%)'
    : isSell
    ? 'linear-gradient(90deg, rgba(225, 29, 72, 0.35) 0%, rgba(136, 19, 55, 0.45) 100%)'
    : 'linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, rgba(120, 53, 15, 0.2) 100%)';

  const badgeBorder = isBuy
    ? '1px solid rgba(16, 185, 129, 0.5)'
    : isSell
    ? '1px solid rgba(244, 63, 94, 0.6)'
    : '1px solid rgba(245, 158, 11, 0.3)';

  const badgeColor = isBuy ? '#34d399' : isSell ? '#fca5a5' : '#fcd34d';

  return (
    <div
      style={{
        background: '#071224',
        border: '1px solid rgba(0, 229, 255, 0.15)',
        borderRadius: 10,
        padding: compact ? '10px' : '14px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 6 : 12
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 4 : 6 }}>
          <span style={{ fontSize: 14 }}>🎯</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#f1f5f9', letterSpacing: '0.04em' }}>
            Sinyal & Rencana
          </span>
        </div>
        {onLogJournal && isValid && (
          <button
            onClick={onLogJournal}
            style={{
              background: 'rgba(0, 229, 255, 0.1)',
              border: '1px solid rgba(0, 229, 255, 0.3)',
              borderRadius: 4,
              color: '#00e5ff',
              fontSize: 9,
              fontWeight: 700,
              padding: compact ? '2px 5px' : '3px 7px',
              cursor: 'pointer'
            }}
            title="Catat setup tervalidasi ini ke Prediction Journal"
          >
            + Jurnal
          </button>
        )}
      </div>

      {/* Main Signal Badge */}
      <div
        style={{
          background: badgeBg,
          border: badgeBorder,
          borderRadius: 8,
          padding: compact ? '7px 8px' : '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: compact ? 4 : 8,
          boxShadow: isSell
            ? '0 0 15px rgba(225, 29, 72, 0.25)'
            : isBuy
            ? '0 0 15px rgba(16, 185, 129, 0.25)'
            : 'none'
        }}
      >
        <span style={{ fontSize: compact ? 12 : 18 }}>{isBuy ? '🐂' : isSell ? '🐻' : '⏳'}</span>
        <span
          style={{
            fontSize: compact ? 10.5 : 13,
            fontWeight: 900,
            color: badgeColor,
            letterSpacing: compact ? '0.02em' : '0.06em',
            textTransform: 'uppercase',
            lineHeight: 1.25
          }}
        >
          {isValid ? `${side} (Setup Valid)` : 'WAIT (Menunggu Konfirmasi Valid)'}
        </span>
      </div>

      {/* Structured Signal Table */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact ? '74px 1fr' : '110px 1fr',
          gap: compact ? '5px 8px' : '6px 8px',
          fontSize: 11,
          background: 'rgba(2, 6, 23, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: 6,
          padding: compact ? '8px 10px' : '10px 12px'
        }}
      >
        <div style={{ color: '#94a3b8', fontWeight: 600 }}>Entry</div>
        <div style={{ color: '#f1f5f9', fontWeight: 700, fontFamily: 'monospace' }}>: {entryRange}</div>

        <div style={{ color: '#94a3b8', fontWeight: 600 }}>Stop Loss</div>
        <div style={{ color: '#fb7185', fontWeight: 700, fontFamily: 'monospace' }}>: {stopLoss}</div>

        <div style={{ color: '#94a3b8', fontWeight: 600 }}>Take Profit 1</div>
        <div style={{ color: '#34d399', fontWeight: 700, fontFamily: 'monospace' }}>: {tp1}</div>

        <div style={{ color: '#94a3b8', fontWeight: 600 }}>Take Profit 2</div>
        <div style={{ color: '#34d399', fontWeight: 700, fontFamily: 'monospace' }}>: {tp2}</div>

        <div style={{ color: '#94a3b8', fontWeight: 600 }}>Risk/Reward</div>
        <div style={{ color: '#00e5ff', fontWeight: 700, fontFamily: 'monospace' }}>: {rrRatio}</div>

        <div style={{ color: '#94a3b8', fontWeight: 600 }}>Confidence</div>
        <div style={{ color: '#a78bfa', fontWeight: 700, fontFamily: 'monospace' }}>: {confidence}</div>
      </div>

      {signal?.reason && (
        <div
          style={{
            fontSize: 9.5,
            color: '#94a3b8',
            lineHeight: 1.4,
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            paddingTop: 6
          }}
        >
          {signal.reason}
        </div>
      )}

      {/* Demo Action & Auto-Execution Controls */}
      {(!compact || (isValid && !!onExecuteDemo)) && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 4 : 6, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: compact ? 6 : 8 }}>
        {!compact && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9.5, color: '#94a3b8', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={demoAutoMode}
                onChange={(e) => onToggleAutoMode?.(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: '#00e5ff' }}
              />
              <span>Mode Auto Eksekusi Demo</span>
            </label>
            <span style={{ fontSize: 8.5, color: demoAutoMode ? '#00e5ff' : '#64748b', fontWeight: 800, whiteSpace: 'nowrap' }}>
              {demoAutoMode ? '● AUTO ON' : '○ MANUAL'}
            </span>
          </div>
        )}

        {isValid && onExecuteDemo && (
          <button
            onClick={() => onExecuteDemo(signal)}
            style={{
              padding: compact ? '6px 8px' : '8px 12px',
              borderRadius: 6,
              background: isBuy
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
              border: 'none',
              color: '#ffffff',
              fontSize: compact ? 10.5 : 11,
              fontWeight: 900,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              boxShadow: isBuy ? '0 0 14px rgba(16,185,129,0.4)' : '0 0 14px rgba(244,63,94,0.4)',
              transition: 'all 0.15s ease'
            }}
          >
            ⚡ Eksekusi Sinyal Demo ({side})
          </button>
        )}
      </div>
      )}

      {signal?.calculatedAt && (
        <div style={{ fontSize: 8.5, color: '#64748b', textAlign: 'right', fontFamily: 'monospace' }}>
          Dianalisis: {new Date(signal.calculatedAt).toLocaleTimeString('id-ID')}
        </div>
      )}
    </div>
  );
}

