import React from 'react';

/**
 * PlatformTraderHeader
 * Displays top title navigation bar and honest instrument status bar.
 * Never displays hardcoded dummy prices or fake LIVE indicators.
 */
export default function PlatformTraderHeader({
  instrument = 'XAUUSD',
  onSelectInstrument = null,
  currentPrice = null,
  priceChange = null,
  priceChangePercent = null,
  spread = '—',
  source = 'MT5 Canvas',
  isLive = false,
  statusLabel = 'OFFLINE / MENUNGGU MT5',
  lastUpdated = '—',
  onToggleSidebar = null,
  accountBar = null
}) {
  const hasValidPrice = Number.isFinite(currentPrice) && currentPrice > 0;
  const hasChange = Number.isFinite(priceChange) && Number.isFinite(priceChangePercent);
  const isNegative = hasChange && priceChange < 0;
  const changeColor = hasChange ? (isNegative ? '#f43f5e' : '#10b981') : '#94a3b8';

  const changeFormatted = hasChange
    ? `${isNegative ? '' : '+'}${priceChange.toFixed(2)} (${isNegative ? '' : '+'}${priceChangePercent.toFixed(2)}%)`
    : '—';

  const instrumentsList = ['XAUUSD', 'BTCUSDT', 'EURUSD', 'USOIL', 'US30'];

  const statusBg = isLive
    ? 'rgba(16, 185, 129, 0.2)'
    : statusLabel.includes('STALE')
    ? 'rgba(245, 158, 11, 0.2)'
    : 'rgba(239, 68, 68, 0.2)';

  const statusBorder = isLive
    ? 'rgba(16, 185, 129, 0.5)'
    : statusLabel.includes('STALE')
    ? 'rgba(245, 158, 11, 0.5)'
    : 'rgba(239, 68, 68, 0.5)';

  const statusColor = isLive
    ? '#34d399'
    : statusLabel.includes('STALE')
    ? '#fbbf24'
    : '#f87171';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* ── Top Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '6px 12px',
          background: 'rgba(7, 18, 36, 0.65)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(0, 229, 255, 0.12)',
          borderRadius: 8,
          flexWrap: 'wrap'
        }}
      >
        {/* Left: Hamburger & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: 16,
                display: 'flex',
                alignItems: 'center',
                padding: 4
              }}
              title="Toggle Menu"
            >
              ☰
            </button>
          )}
        </div>

        {/* Center: Account Bar */}
        <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex' }}>
          {accountBar}
        </div>

      </div>

      {/* ── Instrument Price & Status Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: '#071224',
          border: '1px solid rgba(0, 229, 255, 0.18)',
          borderRadius: 8,
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        {/* Instrument & Price */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Instrument Dropdown */}
          <select
            value={instrument}
            onChange={(e) => onSelectInstrument && onSelectInstrument(e.target.value)}
            style={{
              background: '#040a17',
              border: '1px solid rgba(0, 229, 255, 0.35)',
              borderRadius: 6,
              color: '#f1f5f9',
              fontSize: 14,
              fontWeight: 900,
              fontFamily: 'monospace',
              padding: '4px 10px',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {instrumentsList.map(item => (
              <option key={item} value={item} style={{ background: '#040a17', color: '#fff' }}>
                {item}
              </option>
            ))}
          </select>

          {/* Live Price or Awaiting Feed */}
          <span
            style={{
              fontSize: 18,
              fontWeight: 900,
              fontFamily: 'monospace',
              color: hasValidPrice ? '#ffffff' : '#94a3b8',
              letterSpacing: '0.04em'
            }}
          >
            {hasValidPrice ? Number(currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
          </span>

          {/* Price Change */}
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              fontFamily: 'monospace',
              color: changeColor
            }}
          >
            {changeFormatted}
          </span>

          {/* Verification Status Badge */}
          <div
            style={{
              background: statusBg,
              border: `1px solid ${statusBorder}`,
              color: statusColor,
              padding: '3px 8px',
              borderRadius: 12,
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: '0.08em',
              display: 'flex',
              alignItems: 'center',
              gap: 5
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: statusColor,
                boxShadow: isLive ? '0 0 6px #10b981' : 'none'
              }}
            />
            {statusLabel}
          </div>
        </div>

        {/* Metadata: Spread, Source, Timestamp */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', fontSize: 11 }}>
          <div>
            <span style={{ color: '#64748b', marginRight: 4 }}>Spread</span>
            <span style={{ color: '#f1f5f9', fontWeight: 700, fontFamily: 'monospace' }}>{spread}</span>
          </div>

          <div>
            <span style={{ color: '#64748b', marginRight: 4 }}>Sumber:</span>
            <span style={{ color: '#38bdf8', fontWeight: 700 }}>{source}</span>
          </div>

          <div>
            <span style={{ color: '#64748b', marginRight: 4 }}>Update:</span>
            <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{lastUpdated}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
