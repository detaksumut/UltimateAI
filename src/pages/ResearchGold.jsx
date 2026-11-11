import React, { useState } from 'react';
import PlatformTraderSidebar from '../components/platform-trader/PlatformTraderSidebar.jsx';
import FaktorUpDownGoldPanel from '../components/broker-workspace/FaktorUpDownGoldPanel.jsx';
import CrossAssetMonitor from '../components/trading/CrossAssetMonitor.jsx';
import EconomicCalendarPanel from '../components/platform-trader/EconomicCalendarPanel.jsx';

const TABS = [
  { id: 'factors', label: 'Faktor Invers', icon: '⚖️' },
  { id: 'cross', label: 'Cross-Asset', icon: '🌐' },
  { id: 'calendar', label: 'Kalender Ekonomi', icon: '🗓️' },
];

function TabButton({ tab, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '7px 13px',
        borderRadius: 7,
        border: active ? '1px solid #38bdf8' : '1px solid transparent',
        background: active ? 'linear-gradient(135deg, #1d4ed8 0%, #4f46e5 100%)' : 'rgba(255,255,255,0.03)',
        color: active ? '#ffffff' : '#64748b',
        fontSize: 11,
        fontWeight: 800,
        cursor: 'pointer',
        boxShadow: active ? '0 0 12px rgba(59,130,246,0.35)' : 'none',
        transition: 'all 0.15s ease',
      }}
    >
      <span style={{ fontSize: 13 }}>{tab.icon}</span>
      {tab.label}
    </button>
  );
}

export default function ResearchGold() {
  const [tab, setTab] = useState('factors');

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        background: '#030814',
        color: '#e2e8f0',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      <PlatformTraderSidebar activeMenu="Riset Gold" />

      <main
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          padding: '12px 16px',
          boxSizing: 'border-box',
          gap: 12,
        }}
      >
        <header
          style={{
            background: 'linear-gradient(135deg, #071a2c 0%, #0a1a2e 100%)',
            border: '1px solid rgba(251,191,36,0.2)',
            borderRadius: 10,
            padding: '13px 15px',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 900, color: '#fcd34d', letterSpacing: '0.04em', marginBottom: 4 }}>
            RISET GOLD — FAKTOR INVERS &amp; INTERMARKET
          </div>
          <div style={{ fontSize: 9.5, color: '#94a3b8', lineHeight: 1.65 }}>
            Faktor yang berlawanan dengan Gold (DXY, yield, S&amp;P 500, oil, silver, copper) dengan harga live, korelasi, dan bias.
            Gunakan untuk konfirmasi arah, bukan sinyal entry otomatis.
          </div>
        </header>

        <div
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            padding: '8px 10px',
            background: '#060f1e',
            border: '1px solid rgba(0,229,255,0.12)',
            borderRadius: 9,
            flexWrap: 'wrap',
          }}
        >
          {TABS.map(item => (
            <TabButton
              key={item.id}
              tab={item}
              active={tab === item.id}
              onClick={() => setTab(item.id)}
            />
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 9, color: '#334155' }}>
            Instrumen: <span style={{ color: '#475569' }}>XAUUSD</span>
          </div>
        </div>

        {tab === 'factors' && <FaktorUpDownGoldPanel />}
        {tab === 'cross' && <CrossAssetMonitor />}
        {tab === 'calendar' && <EconomicCalendarPanel instrument="XAUUSD" />}
      </main>
    </div>
  );
}
