import React from 'react';

/**
 * DemoAccountBar
 * Header strip displaying virtual Demo Account status ($5,000 initial balance),
 * mode switcher (DEMO vs LIVE XM), Balance, Equity, Margin, and Floating P/L,
 * with direct access to Trading Account Center & E-Wallet Deposit (DANA, OVO, GoPay).
 */
export default function DemoAccountBar({
  tradingMode = 'DEMO', // 'DEMO' | 'LIVE'
  onToggleMode,
  demoState,
  onResetDemo,
  onOpenAccountCenter,
  depositBalanceIdr = 0,
}) {
  const isDemo = tradingMode === 'DEMO';
  const balance = demoState?.balance ?? 5000;
  const equity = demoState?.equity ?? 5000;
  const floatingPl = demoState?.floatingPl ?? 0;
  const freeMargin = demoState?.freeMargin ?? 5000;
  const usedMargin = demoState?.usedMargin ?? 0;
  const openCount = demoState?.openPositions?.length ?? 0;

  const isPlPositive = floatingPl >= 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '7px 12px',
        background: isDemo
          ? 'linear-gradient(90deg, rgba(8, 28, 48, 0.95) 0%, rgba(4, 18, 34, 0.98) 100%)'
          : 'linear-gradient(90deg, rgba(40, 14, 24, 0.95) 0%, rgba(20, 6, 12, 0.98) 100%)',
        border: `1px solid ${isDemo ? 'rgba(0, 229, 255, 0.3)' : 'rgba(244, 63, 94, 0.4)'}`,
        borderRadius: 8,
        flexWrap: 'wrap',
        gap: 8,
        boxShadow: isDemo ? '0 0 15px rgba(0, 229, 255, 0.08)' : '0 0 15px rgba(244, 63, 94, 0.08)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Left: Mode Selector Pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', background: 'rgba(2, 6, 23, 0.8)', padding: 3, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => onToggleMode?.('DEMO')}
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 900,
              cursor: 'pointer',
              border: isDemo ? '1px solid #00e5ff' : 'none',
              background: isDemo ? 'rgba(0, 229, 255, 0.2)' : 'transparent',
              color: isDemo ? '#00e5ff' : '#64748b',
              transition: 'all 0.15s ease',
            }}
          >
            🎯 DEMO ($5,000)
          </button>
          <button
            onClick={() => onToggleMode?.('LIVE')}
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 900,
              cursor: 'pointer',
              border: !isDemo ? '1px solid #f43f5e' : 'none',
              background: !isDemo ? 'rgba(244, 63, 94, 0.2)' : 'transparent',
              color: !isDemo ? '#fb7185' : '#64748b',
              transition: 'all 0.15s ease',
            }}
          >
            ⚡ LIVE XM BROKER
          </button>
        </div>

        <div style={{ fontSize: 9.5, color: isDemo ? '#38bdf8' : '#fb7185', fontWeight: 800 }}>
          {isDemo ? (
            <span>Virtual Ledger • Tanpa Risiko</span>
          ) : (
            <span>XM MT5 Terminal • Akun Broker Riil</span>
          )}
        </div>
      </div>

      {/* Center: Account Metrics */}
      {isDemo ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 7.5, color: '#64748b', textTransform: 'uppercase' }}>Balance</div>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#f8fafc', fontFamily: 'monospace' }}>
              ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 7.5, color: '#64748b', textTransform: 'uppercase' }}>Equity</div>
            <div style={{ fontSize: 12, fontWeight: 900, color: isPlPositive ? '#34d399' : '#fb7185', fontFamily: 'monospace' }}>
              ${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 7.5, color: '#64748b', textTransform: 'uppercase' }}>Floating P/L</div>
            <div style={{ fontSize: 12, fontWeight: 900, color: isPlPositive ? '#34d399' : '#fb7185', fontFamily: 'monospace' }}>
              {isPlPositive ? '+' : ''}${floatingPl.toFixed(2)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 7.5, color: '#64748b', textTransform: 'uppercase' }}>Free Margin</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#cbd5e1', fontFamily: 'monospace' }}>
              ${freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 7.5, color: '#64748b', textTransform: 'uppercase' }}>Posisi Terbuka</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: openCount > 0 ? '#00e5ff' : '#64748b', fontFamily: 'monospace' }}>
              {openCount} order
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10, color: '#cbd5e1' }}>
          <span>Koneksi Broker: <strong style={{ color: '#34d399' }}>XM Global MT5</strong></span>
          <span>•</span>
          <span>Order dikirim langsung ke MT5</span>
        </div>
      )}

      {/* Right: Actions & Trading Account Center Deposit Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Trading Account Center & E-Wallet Deposit Button */}
        <button
          onClick={onOpenAccountCenter}
          title="Buka Trading Account Center (Deposit DANA / OVO / GoPay)"
          style={{
            padding: '4px 10px',
            borderRadius: 5,
            fontSize: 9.5,
            fontWeight: 900,
            cursor: 'pointer',
            border: '1px solid rgba(16, 185, 129, 0.45)',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(5, 150, 105, 0.28) 100%)',
            color: '#34d399',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            boxShadow: '0 0 12px rgba(16, 185, 129, 0.15)',
            transition: 'all 0.15s ease',
          }}
        >
          <span>💳</span>
          <span>DEPOSIT E-WALLET {depositBalanceIdr > 0 ? `(Rp ${depositBalanceIdr.toLocaleString('id-ID')})` : ''}</span>
        </button>

        {isDemo && (
          <button
            onClick={() => {
              if (window.confirm('Reset akun Demo kembali ke saldo awal $5,000.00? Semua posisi dan riwayat demo akan dihapus.')) {
                onResetDemo?.();
              }
            }}
            title="Reset saldo demo ke $5,000"
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 9,
              fontWeight: 800,
              cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(2, 6, 23, 0.6)',
              color: '#94a3b8',
              transition: 'all 0.15s ease',
            }}
          >
            ↻ Reset ($5,000)
          </button>
        )}
      </div>
    </div>
  );
}
