import React, { useState, useEffect } from 'react';
import './simulator.css';
import UniverseCosmosBackground from './components/UniverseCosmosBackground.jsx';
import LiveHologramAvatar from './components/LiveHologramAvatar.jsx';
import LiveTickerPanel from './components/LiveTickerPanel.jsx';
import JINTickerConversation from './components/JINTickerConversation.jsx';
import HikamWisdomBanner from './components/HikamWisdomBanner.jsx';

import { useJinAvatar } from '../../hooks/useJinAvatar.js';
import { useAudioAnalyzer } from '../../hooks/useAudioAnalyzer.js';
import { frontendErrorObserver } from '../../services/engineering/FrontendErrorObserver.js';
import { uiStateResolverInstance } from '../../services/grounding/UIStateResolver.js';
import { conversationControllerInstance } from '../../services/conversation/ConversationController.js';

export default function ChatSimulator() {
  const [messageCount, setMessageCount] = useState(() => conversationControllerInstance.getSnapshot().messages.length);
  const [runtimeHealth, setRuntimeHealth] = useState({
    status: 'ACTIVE',
    model: 'HERMES3:8B',
    provider: 'OLLAMA',
    uptime: '--:--'
  });

  const { state: avatarState } = useJinAvatar();
  const audioMetrics = useAudioAnalyzer(avatarState);

  useEffect(() => {
    frontendErrorObserver.start();
    return () => frontendErrorObserver.stop();
  }, []);

  // Subscribe to conversation message count
  useEffect(() => {
    const unsub = conversationControllerInstance.subscribe(({ messages }) => {
      setMessageCount(messages.length);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('http://127.0.0.1:20200/health', { signal: AbortSignal.timeout(2500) });
        if (res.ok) {
          const data = await res.json();
          const uptimeSec = data.uptimeSeconds || 0;
          const mins = Math.floor(uptimeSec / 60);
          const secs = uptimeSec % 60;
          setRuntimeHealth({
            status: data.status || (data.gateway === 'ONLINE' ? 'ACTIVE' : 'DEGRADED'),
            model: (data.model || 'qwen3:8b').toUpperCase(),
            provider: (data.provider || 'ollama').toUpperCase(),
            uptime: `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
          });
        }
      } catch {}
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    uiStateResolverInstance.updateState({
      activeTab: 'CONVERSATION',
      activeApp: null,
      isSandboxRunning: false,
      activeModal: null
    });
  }, []);

  return (
    <div className="simulator-root w-screen h-screen bg-[#040711] text-slate-100 flex overflow-hidden font-sans relative">
      <UniverseCosmosBackground />
      <div className="scan-line-overlay" />
      <div className="hex-grid-overlay" />
      <div className="perspective-grid" />

      <div className="relative z-10 w-full h-full flex">
        {/* ═══ LEFT PANEL — HUD sidebar + Avatar (PRESERVED) ═══ */}
        <div className="h-full flex border-r border-[rgba(0,229,255,0.12)]" style={{ background: 'rgba(4,7,17,0.4)' }}>
          <div className="w-[215px] h-full flex flex-col border-r border-[rgba(0,229,255,0.08)] overflow-y-auto custom-scrollbar" style={{ flexShrink: 0 }}>
            {/* ═══ ULTIMATE AI BRANDING — VERY TOP OF LEFT PANEL ═══ */}
            <div className="px-3 pt-2 pb-1.5 border-b border-[rgba(0,229,255,0.12)] flex flex-col items-center justify-center" style={{ background: 'linear-gradient(180deg, rgba(0,229,255,0.05) 0%, rgba(4,7,17,0.3) 100%)' }}>
              <img
                src="/logo-ultimateAI-transparent.png"
                alt="UltimateAI Logo"
                className="w-full object-contain max-h-[52px] select-none transition-all duration-300 hover:brightness-110"
                style={{ filter: 'drop-shadow(0 0 10px rgba(0,229,255,0.3))' }}
              />
            </div>

            <div className="px-3 py-2 border-b border-[rgba(0,229,255,0.08)] text-center">
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: 'rgba(0,229,255,0.75)' }}>JIN::NEURAL INTERFACE</span>
            </div>

            <div className="hud-panel" style={{ margin: '6px 6px 0', flexShrink: 0 }}>
              <div className="hud-label">System</div>
              <div style={{ padding: '6px 10px' }}>
                <div className="flex justify-between items-center" style={{ fontSize: 10.5, marginBottom: 3 }}>
                  <span style={{ color: 'rgba(148,163,184,0.6)', fontWeight: 500 }}>STATUS</span>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>{runtimeHealth.status}</span>
                </div>
                <div className="flex justify-between items-center" style={{ fontSize: 10.5, marginBottom: 3 }}>
                  <span style={{ color: 'rgba(148,163,184,0.6)', fontWeight: 500 }}>MODEL</span>
                  <span style={{ color: '#00e5ff', fontWeight: 700 }}>{runtimeHealth.model}</span>
                </div>
                <div className="flex justify-between items-center" style={{ fontSize: 10.5, marginBottom: 3 }}>
                  <span style={{ color: 'rgba(148,163,184,0.6)', fontWeight: 500 }}>PROVIDER</span>
                  <span style={{ color: '#a78bfa', fontWeight: 700 }}>{runtimeHealth.provider}</span>
                </div>
                <div className="flex justify-between items-center" style={{ fontSize: 10.5 }}>
                  <span style={{ color: 'rgba(148,163,184,0.6)', fontWeight: 500 }}>UPTIME</span>
                  <span style={{ color: 'rgba(226,232,240,0.75)', fontFamily: 'monospace', fontWeight: 600 }}>{runtimeHealth.uptime}</span>
                </div>
              </div>
            </div>

            <div className="hud-panel" style={{ margin: '6px 6px 0', flexShrink: 0 }}>
              <div className="hud-label">Network</div>
              <div style={{ padding: '6px 10px' }}>
                <div className="flex justify-between items-center" style={{ fontSize: 10.5, marginBottom: 3 }}>
                  <span style={{ color: 'rgba(148,163,184,0.6)', fontWeight: 500 }}>ROUTER</span>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>ONLINE</span>
                </div>
                <div className="flex justify-between items-center" style={{ fontSize: 10.5 }}>
                  <span style={{ color: 'rgba(148,163,184,0.6)', fontWeight: 500 }}>PORT</span>
                  <span style={{ color: 'rgba(226,232,240,0.75)', fontFamily: 'monospace', fontWeight: 600 }}>:20200</span>
                </div>
              </div>
            </div>

            <div className="hud-panel" style={{ margin: '6px 6px 0', flexShrink: 0 }}>
              <div className="hud-label">Memory</div>
              <div style={{ padding: '6px 10px' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#00e5ff', lineHeight: 1 }}>{messageCount}</div>
                <div style={{ fontSize: 10.5, color: 'rgba(148,163,184,0.6)', marginTop: 4, fontWeight: 500 }}>Messages</div>
              </div>
            </div>

            <div className="hud-panel" style={{ margin: '6px 6px 0', flexShrink: 0 }}>
              <div className="hud-label">Tools</div>
              <div style={{ padding: '6px 10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {[['CODE', '#a78bfa'], ['WEB', '#38bdf8'], ['IMG', '#f472b6'], ['MEM', '#06b6d4']].map(([l, c]) => (
                    <div key={l} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: c, textAlign: 'center', padding: '4px 0', border: `1px solid ${c}30`, background: `${c}10` }}>{l}</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="hud-panel" style={{ margin: '6px 6px 0', flexShrink: 0 }}>
              <div className="hud-label">Status</div>
              <div style={{ padding: '6px 10px' }}>
                <div className="flex items-center gap-2" style={{ fontSize: 10.5, marginBottom: 4, fontWeight: 600 }}>
                  <span className="status-indicator status-online" />
                  <span style={{ color: 'rgba(226,232,240,0.75)' }}>NEURAL</span>
                </div>
                <div className="flex items-center gap-2" style={{ fontSize: 10.5, marginBottom: 4, fontWeight: 600 }}>
                  <span className="status-indicator status-online" />
                  <span style={{ color: 'rgba(226,232,240,0.75)' }}>MEMORY</span>
                </div>
                <div className="flex items-center justify-between" style={{ fontSize: 10.5, fontWeight: 600 }}>
                  <div className="flex items-center gap-2">
                    <span className={`status-indicator ${
                      avatarState === 'LISTENING'
                        ? 'status-warning animate-pulse'
                        : avatarState === 'SPEAKING'
                        ? 'status-online animate-pulse'
                        : avatarState === 'PROCESSING'
                        ? 'bg-purple-400 animate-pulse shadow-[0_0_8px_#c084fc]'
                        : 'status-online'
                    }`} />
                    <span style={{ color: 'rgba(226,232,240,0.75)' }}>EMBODIED</span>
                  </div>
                  <span style={{
                    fontSize: 9,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: avatarState === 'LISTENING' ? '#34d399' : avatarState === 'SPEAKING' ? '#c084fc' : avatarState === 'PROCESSING' ? '#e879f9' : '#38bdf8'
                  }}>
                    {avatarState === 'LISTENING' ? 'LISTENING' : avatarState === 'SPEAKING' ? 'SPEAKING' : avatarState === 'PROCESSING' ? 'ANALYZING' : 'READY'}
                  </span>
                </div>
              </div>
            </div>

            {/* ═══ BAGHDAD NIGHT + ALADDIN OVERLAY — BOTTOM OF LEFT PANEL ═══ */}
            <div className="mt-auto px-2 py-2 border-t border-[rgba(0,229,255,0.12)] flex flex-col items-center justify-center" style={{ background: 'linear-gradient(180deg, rgba(4,7,17,0.4) 0%, rgba(0,229,255,0.04) 100%)' }}>
              <div className="relative w-full h-[125px] rounded overflow-hidden border border-[rgba(0,229,255,0.22)] shadow-[0_0_12px_rgba(0,229,255,0.15)] group">
                {/* Background Layer: Baghdad Night */}
                <img
                  src="/baghdad-night.png"
                  alt="Baghdad Night"
                  className="absolute inset-0 w-full h-full object-cover select-none transition-transform duration-500 group-hover:scale-105"
                  style={{ filter: 'contrast(1.1) brightness(0.75)' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#040711]/70 via-transparent to-transparent pointer-events-none" />
                {/* Foreground Layer: Aladdin overlaying Baghdad */}
                <img
                  src="/aladin.png"
                  alt="Aladdin with Magic Lamp"
                  className="absolute inset-0 w-full h-full object-contain object-bottom-left select-none pointer-events-none transition-transform duration-500 group-hover:scale-105"
                  style={{ filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.85)) drop-shadow(0 0 8px rgba(251,191,36,0.35))' }}
                />
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center relative">
            {/* ═══ AL-HIKAM NEURAL WISDOM BANNER ═══ */}
            <HikamWisdomBanner />

            {/* ═══ SIGMA RULE BRANDING — ABOVE JIN TITLE ═══ */}
            <img
              src="/sigma.png"
              alt="Sigma Rule"
              className="max-w-[220px] max-h-[38px] object-contain mb-2 select-none transition-all duration-300 hover:brightness-110"
              style={{ filter: 'drop-shadow(0 0 12px rgba(0,229,255,0.45))' }}
            />
            <h1 style={{ fontSize: 42, fontWeight: 900, letterSpacing: '0.3em', color: '#00e5ff', textShadow: '0 0 20px rgba(0,229,255,0.5)', marginBottom: 6, fontFamily: 'monospace' }}>
              J I N
            </h1>
            <p style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(0,229,255,0.4)', marginBottom: 16, fontFamily: 'monospace' }}>
              JOINT INTELLIGENCE NEURAL-INTERFACE
            </p>
            <LiveHologramAvatar avatarState={avatarState} audioMetrics={audioMetrics} size="center" />
            <div className="absolute bottom-3 left-0 right-0 flex items-center justify-between px-4">
              <span style={{ fontSize: 8, color: 'rgba(148,163,184,0.25)', letterSpacing: '0.1em' }}>SYS::ACTIVE</span>
              <span style={{ fontSize: 8, color: 'rgba(148,163,184,0.25)', letterSpacing: '0.1em' }}>LATENCY::12ms</span>
              <span style={{ fontSize: 8, color: 'rgba(148,163,184,0.25)', letterSpacing: '0.1em' }}>SECURITY::TIER-READ</span>
              <span style={{ fontSize: 8, color: 'rgba(148,163,184,0.25)', letterSpacing: '0.1em' }}>BUILD::2.0.0</span>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT PANEL — JIN TICKER RESPONSE CONVERSATION (REBUILT) ═══ */}
        <div className="w-[42%] h-full flex flex-col border-r border-[rgba(0,229,255,0.1)]">
          <JINTickerConversation />
        </div>

        {/* ═══ FAR RIGHT PANEL — TELEMETRY TICKER (PRESERVED) ═══ */}
        <LiveTickerPanel />
      </div>
    </div>
  );
}
