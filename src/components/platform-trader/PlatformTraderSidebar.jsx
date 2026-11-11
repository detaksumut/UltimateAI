import React from 'react';
import { useNavigate } from 'react-router-dom';
import SidebarMarketPulse from './SidebarMarketPulse.jsx';
import SignalPlanCard from './SignalPlanCard.jsx';

/**
 * PlatformTraderSidebar
 * Left navigation panel matching the reference screenshot design:
 * - UltimateAI JINI logo at the top using /logo-ultimateAI.png
 * - OS Workspace category
 * - Navigation links (Beranda, Chat AI, Trading OS, Platform Trader, Broker Workspace, Riset Gold, Prediction Journal)
 * - Live inverse-factor pulse (DXY, US10Y, TIPS, US02Y, WTI)
 * - Pengaturan (Settings) at the bottom
 */
export default function PlatformTraderSidebar({
  activeMenu = 'Platform Trader',
  onSelectMenu = null,
  onOpenJournal = null,
  onOpenTradingStudio = null,
  signalCardProps = null
}) {
  const navigate = useNavigate();

  const handleMenuClick = (item) => {
    if (item.name === 'Chat AI') {
      navigate('/simulator');
      return;
    }
    if (item.name === 'Platform Trader') {
      navigate('/platform-trader');
      return;
    }
    if (item.name === 'Broker Workspace') {
      navigate('/broker-workspace');
      return;
    }
    if (item.name === 'Riset Gold') {
      navigate('/research-gold');
      return;
    }
    if (item.name === 'Prediction Journal') {
      if (onOpenJournal) onOpenJournal();
      else navigate('/platform-trader?journal=1');
      return;
    }
    if (onSelectMenu) {
      onSelectMenu(item.name);
    }
  };

  const mainMenuItems = [
    { name: 'Riset Gold', icon: '🧭' },
  ];

  return (
    <aside
      style={{
        width: 220,
        minWidth: 220,
        height: '100%',
        minHeight: '100vh',
        background: '#040916',
        borderRight: '1px solid rgba(0, 229, 255, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '10px 10px',
        boxSizing: 'border-box',
        overflowY: 'auto'
      }}
    >
      <div>
        {/* UltimateAI JINI Logo Bar */}
        <div
          onClick={() => navigate('/simulator')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '2px 6px 10px',
            cursor: 'pointer',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            marginBottom: 8
          }}
        >
          <img
            src="/logo-ultimateAI.png"
            alt="UltimateAI JINI Logo"
            style={{
              height: 38,
              maxWidth: 175,
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 10px rgba(0, 229, 255, 0.4))'
            }}
          />
        </div>

        {/* Live inverse-factor pulse above the menu */}
        <div
          style={{
            paddingBottom: 8,
            marginBottom: 8,
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
          }}
        >
          <SidebarMarketPulse />
        </div>

        {signalCardProps && (
          <div style={{ marginBottom: 8 }}>
            <SignalPlanCard {...signalCardProps} compact />
          </div>
        )}

        {/* Main Menu List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {mainMenuItems.map((item) => {
            const isActive = activeMenu === item.name;
            return (
              <button
                key={item.name}
                onClick={() => handleMenuClick(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '7px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: isActive ? 800 : 500,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  border: isActive
                    ? '1px solid rgba(139, 92, 246, 0.6)'
                    : '1px solid transparent',
                  background: isActive
                    ? 'linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%)'
                    : 'transparent',
                  color: isActive ? '#ffffff' : '#cbd5e1',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: isActive ? '0 4px 15px rgba(139, 92, 246, 0.4)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontSize: 13, width: 18, textAlign: 'center' }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.name}</span>
                {item.badge && (
                  <span
                    style={{
                      fontSize: 8.5,
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: 3,
                      background: 'rgba(0, 229, 255, 0.15)',
                      color: '#38bdf8',
                      border: '1px solid rgba(0, 229, 255, 0.3)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Genie decorative backdrop in the empty sidebar space */}
      <div
        aria-hidden="true"
        style={{
          flex: 1,
          minHeight: 40,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          pointerEvents: 'none',
          paddingTop: 4
        }}
      >
        <img
          src="/uploads/genie-bg.png"
          alt=""
          style={{
            width: '100%',
            maxWidth: 190,
            maxHeight: '100%',
            objectFit: 'contain',
            opacity: 0.9,
            filter: 'drop-shadow(0 0 16px rgba(99, 102, 241, 0.45))'
          }}
        />
      </div>

      {/* Settings at Bottom */}
      <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: 10 }}>
        <button
          onClick={() => handleMenuClick({ name: 'Pengaturan' })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <span style={{ fontSize: 14 }}>⚙️</span>
          <span>Pengaturan</span>
        </button>
      </div>
    </aside>
  );
}

