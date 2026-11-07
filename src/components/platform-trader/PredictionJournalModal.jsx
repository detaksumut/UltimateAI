import React from 'react';

/**
 * PredictionJournalModal
 * Modal to display and record historical prediction journals, analysis outcomes,
 * and track AI prediction performance.
 */
export default function PredictionJournalModal({
  open = false,
  onClose = null,
  journalEntries = [],
  onClearJournal = null
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10090,
        background: 'rgba(3, 7, 18, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div
        style={{
          width: '95%',
          maxWidth: 900,
          maxHeight: '85vh',
          background: '#071224',
          border: '1px solid rgba(0, 229, 255, 0.3)',
          borderRadius: 12,
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid rgba(0, 229, 255, 0.15)',
            background: 'rgba(0, 229, 255, 0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>📅</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', letterSpacing: '0.04em' }}>
                PREDICTION JOURNAL & RIWAYAT ANALISIS
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>
                Catatan integritas sinyal trading, target, dan hasil evaluasi AI
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {journalEntries.length > 0 && onClearJournal && (
              <button
                onClick={onClearJournal}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 4,
                  color: '#f87171',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '4px 8px',
                  cursor: 'pointer'
                }}
              >
                Hapus Riwayat
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1',
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Content Table */}
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
          {journalEntries.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#64748b',
                fontSize: 12
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
              <div>Belum ada riwayat jurnal tersimpan.</div>
              <div style={{ fontSize: 10, marginTop: 4 }}>
                Klik tombol "+ Jurnal" pada kartu Sinyal & Rencana untuk menyimpan setup ke riwayat.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(0, 229, 255, 0.2)', textAlign: 'left', color: '#94a3b8' }}>
                    <th style={{ padding: '8px' }}>WAKTU</th>
                    <th style={{ padding: '8px' }}>INSTRUMEN</th>
                    <th style={{ padding: '8px' }}>TF</th>
                    <th style={{ padding: '8px' }}>SINYAL</th>
                    <th style={{ padding: '8px' }}>ENTRY</th>
                    <th style={{ padding: '8px' }}>STOP LOSS</th>
                    <th style={{ padding: '8px' }}>TARGET 1</th>
                    <th style={{ padding: '8px' }}>R:R</th>
                    <th style={{ padding: '8px' }}>CONFIDENCE</th>
                    <th style={{ padding: '8px' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {journalEntries.map((item, idx) => {
                    const isBuy = item.side === 'BUY';
                    const isSell = item.side === 'SELL';
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '8px', color: '#94a3b8', fontFamily: 'monospace' }}>
                          {item.timestamp ? new Date(item.timestamp).toLocaleString('id-ID') : '—'}
                        </td>
                        <td style={{ padding: '8px', fontWeight: 800, color: '#f8fafc' }}>
                          {item.instrument}
                        </td>
                        <td style={{ padding: '8px', fontFamily: 'monospace', color: '#38bdf8' }}>
                          {item.timeframe || 'H1'}
                        </td>
                        <td style={{ padding: '8px' }}>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: 9.5,
                              fontWeight: 900,
                              background: isBuy ? 'rgba(16, 185, 129, 0.2)' : isSell ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)',
                              color: isBuy ? '#34d399' : isSell ? '#f87171' : '#cbd5e1',
                              border: `1px solid ${isBuy ? 'rgba(16, 185, 129, 0.4)' : isSell ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255,255,255,0.1)'}`
                            }}
                          >
                            {item.side}
                          </span>
                        </td>
                        <td style={{ padding: '8px', fontFamily: 'monospace', color: '#f1f5f9' }}>
                          {item.entry != null ? Number(item.entry).toFixed(2) : '—'}
                        </td>
                        <td style={{ padding: '8px', fontFamily: 'monospace', color: '#fb7185' }}>
                          {item.stopLoss != null ? Number(item.stopLoss).toFixed(2) : '—'}
                        </td>
                        <td style={{ padding: '8px', fontFamily: 'monospace', color: '#34d399' }}>
                          {item.takeProfit != null ? Number(item.takeProfit).toFixed(2) : '—'}
                        </td>
                        <td style={{ padding: '8px', fontFamily: 'monospace', color: '#00e5ff' }}>
                          {item.riskReward || '—'}
                        </td>
                        <td style={{ padding: '8px', fontFamily: 'monospace', color: '#a78bfa' }}>
                          {item.confidence ? `${item.confidence}%` : '—'}
                        </td>
                        <td style={{ padding: '8px' }}>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              color: '#38bdf8',
                              background: 'rgba(56, 189, 248, 0.1)',
                              border: '1px solid rgba(56, 189, 248, 0.25)',
                              padding: '2px 5px',
                              borderRadius: 4
                            }}
                          >
                            TERCATAT
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
