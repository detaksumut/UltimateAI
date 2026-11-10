import React, { useState } from 'react';

export default function SupplyDemandScalpPanel({
  m1Zones = null,
  m5Zones = null,
  currentPrice = null,
  onSelectSetup = null,
}) {
  const [activeTab, setActiveTab] = useState('M1'); // 'M1' | 'M5'

  const activeData = activeTab === 'M1' ? m1Zones : m5Zones;
  const currentTfPrice = currentPrice || activeData?.currentPrice || null;

  const renderZoneRow = (zone, isSupply) => {
    const isFresh = zone.status === 'FRESH';
    const bg = isSupply
      ? isFresh ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)'
      : isFresh ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.08)';

    const border = isSupply
      ? isFresh ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.2)'
      : isFresh ? 'rgba(34, 197, 94, 0.4)' : 'rgba(34, 197, 94, 0.2)';

    const badgeColor = isSupply ? '#fca5a5' : '#86efac';

    const dist = currentTfPrice
      ? Math.abs(currentTfPrice - zone.mid).toFixed(2)
      : '—';

    return (
      <div
        key={`${zone.type}-${zone.high}-${zone.low}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 6,
          padding: '6px 8px',
          gap: 6,
          fontSize: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 900, color: badgeColor }}>
            {isSupply ? '🔴 SUPPLY' : '🟢 DEMAND'}
          </span>
          <span style={{
            fontSize: 8,
            padding: '1px 4px',
            borderRadius: 3,
            background: isFresh ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0,0,0,0.2)',
            color: isFresh ? '#fef08a' : '#94a3b8',
            fontWeight: 800
          }}>
            {zone.status}
          </span>
        </div>

        <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f1f5f9' }}>
          ${zone.low.toFixed(2)} – ${zone.high.toFixed(2)}
        </div>

        <div style={{ fontSize: 8.5, color: '#94a3b8' }}>
          Jarak: <span style={{ color: '#38bdf8', fontWeight: 700 }}>${dist}</span>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        background: '#071224',
        border: '1px solid rgba(0, 229, 255, 0.18)',
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
    >
      {/* Header with TF Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13 }}>🎯</span>
          <span style={{ fontSize: 11, fontWeight: 900, color: '#f1f5f9', letterSpacing: '0.04em' }}>
            ZONA SUPPLY & DEMAND (SCALPING)
          </span>
        </div>

        <div style={{ display: 'flex', gap: 4, background: 'rgba(2,6,23,0.8)', padding: 2, borderRadius: 6 }}>
          {['M1', 'M5'].map(tf => (
            <button
              key={tf}
              onClick={() => setActiveTab(tf)}
              style={{
                border: 'none',
                background: activeTab === tf ? '#0284c7' : 'transparent',
                color: activeTab === tf ? '#ffffff' : '#94a3b8',
                fontSize: 9.5,
                fontWeight: 900,
                padding: '3px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              TF {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Real-time Scalp Signal Prompt if inside or near a zone */}
      {activeData?.scalpSignal && (
        <div
          style={{
            background: activeData.scalpSignal.side === 'BUY'
              ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.25) 0%, rgba(6, 78, 59, 0.4) 100%)'
              : 'linear-gradient(90deg, rgba(225, 29, 72, 0.25) 0%, rgba(136, 19, 55, 0.4) 100%)',
            border: activeData.scalpSignal.side === 'BUY'
              ? '1px solid rgba(16, 185, 129, 0.6)'
              : '1px solid rgba(244, 63, 94, 0.6)',
            borderRadius: 7,
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            animation: 'pulse 2s infinite',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              fontSize: 10,
              fontWeight: 900,
              color: activeData.scalpSignal.side === 'BUY' ? '#34d399' : '#fca5a5'
            }}>
              ⚡ PELUANG SCALPING {activeTab}: {activeData.scalpSignal.side}
            </span>
            <span style={{ fontSize: 9, color: '#fef08a', fontWeight: 800, fontFamily: 'monospace' }}>
              R:R 1:{activeData.scalpSignal.riskReward}
            </span>
          </div>

          <div style={{ fontSize: 9, color: '#e2e8f0', lineHeight: 1.4 }}>
            {activeData.scalpSignal.note}
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 4,
            fontSize: 8.5,
            color: '#cbd5e1'
          }}>
            <span>SL: <strong style={{ color: '#fb7185' }}>${activeData.scalpSignal.stopLoss.toFixed(2)}</strong></span>
            <span>TP: <strong style={{ color: '#34d399' }}>${activeData.scalpSignal.takeProfit.toFixed(2)}</strong></span>
            {onSelectSetup && (
              <button
                onClick={() => onSelectSetup(activeData.scalpSignal)}
                style={{
                  background: activeData.scalpSignal.side === 'BUY' ? '#059669' : '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 8.5,
                  fontWeight: 900,
                  padding: '3px 7px',
                  cursor: 'pointer'
                }}
              >
                PILIH SETUP
              </button>
            )}
          </div>
        </div>
      )}

      {/* Nearest Supply & Demand Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {/* Nearest Supply Card */}
        <div style={{
          background: 'rgba(239, 68, 68, 0.06)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: 8,
          padding: '8px 10px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 8.5, fontWeight: 900, color: '#fca5a5' }}>SUPPLY TERDEKAT (SELL)</span>
            {activeData?.nearestSupply && (
              <span style={{ fontSize: 7.5, color: '#f87171', fontWeight: 700 }}>
                {activeData.nearestSupply.status}
              </span>
            )}
          </div>
          {activeData?.nearestSupply ? (
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#ffffff', fontFamily: 'monospace' }}>
                ${activeData.nearestSupply.low.toFixed(2)} - ${activeData.nearestSupply.high.toFixed(2)}
              </div>
              <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 2 }}>
                Plafon sell institusi · Target pantulan
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 9, color: '#64748b' }}>Belum terdeteksi supply baru</div>
          )}
        </div>

        {/* Nearest Demand Card */}
        <div style={{
          background: 'rgba(34, 197, 94, 0.06)',
          border: '1px solid rgba(34, 197, 94, 0.25)',
          borderRadius: 8,
          padding: '8px 10px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 8.5, fontWeight: 900, color: '#86efac' }}>DEMAND TERDEKAT (BUY)</span>
            {activeData?.nearestDemand && (
              <span style={{ fontSize: 7.5, color: '#4ade80', fontWeight: 700 }}>
                {activeData.nearestDemand.status}
              </span>
            )}
          </div>
          {activeData?.nearestDemand ? (
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#ffffff', fontFamily: 'monospace' }}>
                ${activeData.nearestDemand.low.toFixed(2)} - ${activeData.nearestDemand.high.toFixed(2)}
              </div>
              <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 2 }}>
                Lantai buy institusi · Target pantulan
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 9, color: '#64748b' }}>Belum terdeteksi demand baru</div>
          )}
        </div>
      </div>

      {/* List of active zones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ fontSize: 8, color: '#64748b', fontWeight: 700, letterSpacing: '0.04em' }}>
          ZONA AKTIF TERDETEKSI ({activeTab})
        </div>
        {activeData?.supply?.map(z => renderZoneRow(z, true))}
        {activeData?.demand?.map(z => renderZoneRow(z, false))}
        {(!activeData?.supply?.length && !activeData?.demand?.length) && (
          <div style={{ fontSize: 9, color: '#64748b', textAlign: 'center', padding: '6px 0' }}>
            Sedang membaca struktur candle {activeTab}...
          </div>
        )}
      </div>

    </div>
  );
}

