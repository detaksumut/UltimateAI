import React, { useState } from 'react';

/**
 * DemoPositionsPanel
 * Displays active virtual open positions and trade history ledger.
 * Supports manual close and 50% partial close on open positions.
 */
export default function DemoPositionsPanel({
  demoState,
  onClosePosition,
}) {
  const [activeTab, setActiveTab] = useState('open'); // 'open' | 'history'

  const openPositions = demoState?.openPositions || [];
  const history = demoState?.history || [];

  return (
    <div
      style={{
        background: '#06101d',
        border: '1px solid rgba(0, 229, 255, 0.15)',
        borderRadius: 8,
        padding: '10px 14px',
        color: '#dbeafe',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Header Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setActiveTab('open')}
            style={{
              padding: '4px 10px',
              borderRadius: 5,
              fontSize: 10,
              fontWeight: 800,
              cursor: 'pointer',
              border: activeTab === 'open' ? '1px solid #00e5ff' : 'none',
              background: activeTab === 'open' ? 'rgba(0, 229, 255, 0.15)' : 'transparent',
              color: activeTab === 'open' ? '#00e5ff' : '#64748b',
            }}
          >
            📋 Posisi Terbuka ({openPositions.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '4px 10px',
              borderRadius: 5,
              fontSize: 10,
              fontWeight: 800,
              cursor: 'pointer',
              border: activeTab === 'history' ? '1px solid #00e5ff' : 'none',
              background: activeTab === 'history' ? 'rgba(0, 229, 255, 0.15)' : 'transparent',
              color: activeTab === 'history' ? '#00e5ff' : '#64748b',
            }}
          >
            📜 Riwayat Transaksi Demo ({history.length})
          </button>
        </div>

        <div style={{ fontSize: 9, color: '#64748b' }}>
          Virtual Ledger Engine • Spread & Quote XM MT5
        </div>
      </div>

      {/* Tab 1: Open Positions */}
      {activeTab === 'open' && (
        <div>
          {openPositions.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: 11 }}>
              Tidak ada posisi demo yang sedang berjalan. Tekan tombol BUY atau SELL untuk membuka posisi virtual.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr style={{ color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>Tiket</th>
                    <th style={{ padding: '6px 8px' }}>Arah</th>
                    <th style={{ padding: '6px 8px' }}>Volume</th>
                    <th style={{ padding: '6px 8px' }}>Entry</th>
                    <th style={{ padding: '6px 8px' }}>Harga Saat Ini</th>
                    <th style={{ padding: '6px 8px' }}>SL / TP</th>
                    <th style={{ padding: '6px 8px' }}>Floating P/L</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {openPositions.map(pos => {
                    const isBuy = pos.side === 'BUY';
                    const isProfit = pos.floatingPl >= 0;
                    return (
                      <tr key={pos.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#94a3b8' }}>
                          {pos.ticket}
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <span style={{
                            padding: '2px 6px', borderRadius: 4, fontSize: 8.5, fontWeight: 900,
                            background: isBuy ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)',
                            color: isBuy ? '#34d399' : '#fb7185',
                            border: `1px solid ${isBuy ? 'rgba(16,185,129,0.4)' : 'rgba(244,63,94,0.4)'}`
                          }}>
                            {pos.side}
                          </span>
                        </td>
                        <td style={{ padding: '6px 8px', fontWeight: 800, fontFamily: 'monospace' }}>
                          {pos.lotSize} lot
                          {pos.tp1Hit && (
                            <span style={{ display: 'block', fontSize: 7.5, color: '#38bdf8', fontWeight: 900 }}>
                              ✓ TP1 HIT (50% CLOSED)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>
                          ${pos.entryPrice?.toFixed(2)}
                        </td>
                        <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#00e5ff' }}>
                          ${pos.currentPrice?.toFixed(2)}
                        </td>
                        <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 9, color: '#94a3b8' }}>
                          SL: {pos.stopLoss ? `$${pos.stopLoss.toFixed(2)}` : '—'} <br/>
                          TP: {pos.takeProfit1 ? `$${pos.takeProfit1.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 11, fontWeight: 900, color: isProfit ? '#34d399' : '#fb7185' }}>
                          {isProfit ? '+' : ''}${pos.floatingPl?.toFixed(2)}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 4 }}>
                            {pos.lotSize >= 0.02 && (
                              <button
                                onClick={() => onClosePosition?.(pos.id, null, 'PARTIAL CLOSE (50%)', 0.5)}
                                style={{
                                  padding: '3px 6px', borderRadius: 4, fontSize: 8.5, fontWeight: 800,
                                  background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.4)',
                                  color: '#fbbf24', cursor: 'pointer'
                                }}
                                title="Tutup 50% lot posisi ini"
                              >
                                ½ Close
                              </button>
                            )}
                            <button
                              onClick={() => onClosePosition?.(pos.id, null, 'MANUAL CLOSE', 1.0)}
                              style={{
                                padding: '3px 8px', borderRadius: 4, fontSize: 8.5, fontWeight: 900,
                                background: 'rgba(244, 63, 94, 0.2)', border: '1px solid rgba(244, 63, 94, 0.4)',
                                color: '#fb7185', cursor: 'pointer'
                              }}
                              title="Tutup penuh posisi ini"
                            >
                              ✕ Close
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Trade History */}
      {activeTab === 'history' && (
        <div>
          {history.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: 11 }}>
              Belum ada riwayat transaksi demo yang selesai.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 220, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9.5 }}>
                <thead>
                  <tr style={{ color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'left' }}>
                    <th style={{ padding: '5px 8px' }}>Waktu Selesai</th>
                    <th style={{ padding: '5px 8px' }}>Arah</th>
                    <th style={{ padding: '5px 8px' }}>Volume</th>
                    <th style={{ padding: '5px 8px' }}>Entry</th>
                    <th style={{ padding: '5px 8px' }}>Exit</th>
                    <th style={{ padding: '5px 8px' }}>Alasan Tutup</th>
                    <th style={{ padding: '5px 8px', textAlign: 'right' }}>Realized P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(item => {
                    const isProfit = item.realizedPl >= 0;
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '5px 8px', color: '#64748b' }}>
                          {item.closedAt ? new Date(item.closedAt).toLocaleTimeString('id-ID') : '—'}
                        </td>
                        <td style={{ padding: '5px 8px', fontWeight: 800, color: item.side === 'BUY' ? '#34d399' : '#fb7185' }}>
                          {item.side}
                        </td>
                        <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>
                          {item.lotSize} lot
                        </td>
                        <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>
                          ${item.entryPrice?.toFixed(2)}
                        </td>
                        <td style={{ padding: '5px 8px', fontFamily: 'monospace', color: '#00e5ff' }}>
                          ${item.closePrice?.toFixed(2)}
                        </td>
                        <td style={{ padding: '5px 8px', color: '#94a3b8' }}>
                          {item.reason}
                        </td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, color: isProfit ? '#34d399' : '#fb7185' }}>
                          {isProfit ? '+' : ''}${item.realizedPl?.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

