import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * PlatformTraderSidebar
 * Left navigation panel matching the reference screenshot design:
 * - UltimateAI JINI logo at the top using /logo-ultimateAI.png
 * - OS Workspace category
 * - Navigation links (Beranda, Chat AI, Trading OS, Platform Trader, Broker Workspace, Market Intelligence, etc.)
 * - Document Studio, Image Studio, Data Lab, Code Lab, Knowledge Lab
 * - Pengaturan (Settings) at the bottom
 */
export default function PlatformTraderSidebar({
  activeMenu = 'Platform Trader',
  onSelectMenu = null,
  onOpenJournal = null,
  onOpenTradingStudio = null
}) {
  const navigate = useNavigate();

  const handleMenuClick = (item) => {
    if (item.name === 'Beranda' || item.name === 'Chat AI') {
      navigate('/simulator');
      return;
    }
    if (item.name === 'Trading OS') {
      if (onOpenTradingStudio) {
        onOpenTradingStudio();
      } else {
        navigate('/trading');
      }
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
    if (item.name === 'Prediction Journal') {
      if (onOpenJournal) onOpenJournal();
      return;
    }
    if (onSelectMenu) {
      onSelectMenu(item.name);
    }
  };

  const mainMenuItems = [
    { name: 'Beranda', icon: '🏠' },
    { name: 'Chat AI', icon: '💬' },
    { name: 'Trading OS', icon: '🎛️' },
    { name: 'Platform Trader', icon: '📊' },
    { name: 'Broker Workspace', icon: '🏛️', badge: 'LIVE XM' },
    { name: 'Market Intelligence', icon: '🌐' },
    { name: 'Strategy Lab', icon: '🎯' },
    { name: 'Prediction Journal', icon: '📅' },
  ];

  const studioItems = [
    { name: 'Document Studio', icon: '📄', isParent: true },
    { name: 'Image Studio', icon: '🖼️' },
    { name: 'Data Lab', icon: '💾' },
    { name: 'Code Lab', icon: '</>' },
    { name: 'Knowledge Lab', icon: '📖' },
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
        padding: '14px 10px',
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
            padding: '4px 6px 14px',
            cursor: 'pointer',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            marginBottom: 12
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

        {/* Section Header: OS Workspace */}
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: '#f8fafc',
            letterSpacing: '0.04em',
            padding: '4px 8px 8px'
          }}
        >
          OS Workspace
        </div>

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
                  padding: '8px 12px',
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

        {/* Divider & Document Studio Group */}
        <div
          style={{
            margin: '14px 0 8px',
            paddingTop: 10,
            borderTop: '1px solid rgba(255, 255, 255, 0.06)'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {studioItems.map((item) => (
              <button
                key={item.name}
                onClick={() => handleMenuClick(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  width: '100%',
                  padding: '7px 12px',
                  borderRadius: 6,
                  fontSize: 11.5,
                  fontWeight: 500,
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'color 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, width: 18, textAlign: 'center', color: '#64748b' }}>
                    {item.icon}
                  </span>
                  <span>{item.name}</span>
                </div>
                {item.isParent && <span style={{ fontSize: 10, color: '#64748b' }}>›</span>}
              </button>
            ))}
          </div>
        </div>
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
