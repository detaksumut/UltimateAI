import React, { useState, useEffect } from 'react';
import './simulator.css';
import UniverseCosmosBackground from './components/UniverseCosmosBackground.jsx';
import MarketIntelligenceView from './components/MarketIntelligenceView.jsx';
import MarketIntelligenceModal from './components/MarketIntelligenceModal.jsx';
import LiveHologramAvatar from './components/LiveHologramAvatar.jsx';
import LiveTickerPanel from './components/LiveTickerPanel.jsx';
import JINTickerConversation from './components/JINTickerConversation.jsx';
import HikamWisdomBanner from './components/HikamWisdomBanner.jsx';

import { useJinAvatar } from '../../hooks/useJinAvatar.js';
import { useAudioAnalyzer } from '../../hooks/useAudioAnalyzer.js';
import { frontendErrorObserver } from '../../services/engineering/FrontendErrorObserver.js';
import { uiStateResolverInstance } from '../../services/grounding/UIStateResolver.js';
import { conversationControllerInstance } from '../../services/conversation/ConversationController.js';

// CONTAINMENT boundary: a render crash in any child (avatar engine, ticker
// stream, market chart, telemetry frames) must NEVER unmount the whole app.
// It shows a localized error tile instead of wiping the canvas & restarting.
class JINErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error(`[JINErrorBoundary:${this.props.label || 'unknown'}]`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-full w-full flex items-center justify-center p-4">
          <div className="rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-3 text-red-200 font-mono text-[11px] max-w-[420px]">
            <div className="font-bold tracking-widest mb-1">[{this.props.label || 'KOMONEN MENGALAMI GANGGUAN'}]</div>
            <div className="text-red-300/80 break-all">
              {String((this.state.error && this.state.error.message) || this.state.error)}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ChatSimulator() {
  const [leftTab, setLeftTab] = useState('JIN');
  // MIE popup modal: dibuka lewat tombol panel kiri ATAU voice "Mama Jin, analisis IHSG"
  const [mieModal, setMieModal] = useState({ open: false, symbol: 'IHSG' });
  const [messageCount, setMessageCount] = useState(() => conversationControllerInstance.getSnapshot().messages.length);
  // Honest defaults: these are "unknown" until the live probes answer. The old
  // values ('QWEN3:8B' / 'OLLAMA') described a runtime that is not installed.
  const [runtimeHealth, setRuntimeHealth] = useState({
    status: 'CHECKING',
    model: '--',
    provider: '--',
    uptime: '--:--',
    reachable: false
  });
  const [memoryHealth, setMemoryHealth] = useState({
    status: 'CHECKING',
    vaultFiles: 0,
    indexed: 0,
    summary: ''
  });

  const { state: avatarState } = useJinAvatar();
  const audioMetrics = useAudioAnalyzer(avatarState);

  useEffect(() => {
    frontendErrorObserver.start();
    return () => frontendErrorObserver.stop();
  }, []);

  // Voice bridge: "Jin, tampilkan data Indeks Saham" -> buka MIE popup modal.
  // MarketIntelligencePanel tidak boleh menimpa bridge ini.
  // Normalisasi simbol eksternal (mis. XAU/USD) -> key basket yang dipahami modal.
  useEffect(() => {
    const toBasketKey = (raw) => {
      const s = String(raw || 'IHSG').toUpperCase();
      if (/^(XAU|GC=F|GOLD)/.test(s)) return 'GOLD';
      if (/^(XAG|SILVER)/.test(s)) return 'GOLD';
      if (/^(CL|BZ|BRENT|WTI|OIL)/.test(s)) return 'WTI';
      if (/^(BTC|BITCOIN|XBT)/.test(s)) return 'BTC';
      if (/^(ETH|ETHEREUM)/.test(s)) return 'BTC';
      if (/^(DX|DXY)/.test(s)) return 'DXY';
      if (/^(TNX|US10Y|UST10Y)/.test(s)) return 'US10Y';
      if (/^(IDR|USDIDR|USD\/IDR)/.test(s)) return 'USDIDR';
      return s;
    };
    window.__jinMarketAnalyze = (sym) => {
      setMieModal({ open: true, symbol: toBasketKey(sym) });
      return true;
    };
    window.__jinMarketOpen = (sym) => setMieModal({ open: true, symbol: toBasketKey(sym || 'IHSG') });
    return () => {
      try { delete window.__jinMarketAnalyze; delete window.__jinMarketOpen; } catch { /* noop */ }
    };
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
            uptime: `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`,
            reachable: true
          });
        }
      } catch {
        // Surface real unreachability instead of leaving stale optimistic values.
        setRuntimeHealth((prev) => ({ ...prev, status: 'UNREACHABLE', reachable: false }));
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to Memory Core health — real diagnostics from the backend
  // (Drive F / Vault / SQLite index / bridge / backup), cached 30s server-side.
  useEffect(() => {
    const fetchMemory = async () => {
      try {
        const res = await fetch('http://127.0.0.1:20200/api/memory/health', { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const data = await res.json();
          setMemoryHealth({
            status: data.status || 'UNKNOWN',
            vaultFiles: data.vaultFiles || 0,
            indexed: data.indexed || 0,
            summary: data.summary || ''
          });
        }
      } catch {
        setMemoryHealth({ status: 'UNREACHABLE', vaultFiles: 0, indexed: 0, summary: '' });
      }
    };
    fetchMemory();
    const interval = setInterval(fetchMemory, 30000);
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
                  <span style={{
                    color: runtimeHealth.reachable === false ? '#f87171' : (/DEGRADED/i.test(runtimeHealth.status) ? '#fbbf24' : '#34d399'),
                    fontWeight: 700
                  }}>{runtimeHealth.status}</span>
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
              <div className="hud-label">Panel</div>
              <div style={{ padding: '6px 10px', display: 'flex', gap: 4 }}>
                {['JIN', 'MARKET'].map((t) => (
                  <button key={t} onClick={() => setLeftTab(t)}
                    style={{ flex: 1, fontSize: 10, fontWeight: 800, padding: '5px 0', borderRadius: 6, cursor: 'pointer',
                      border: `1px solid ${leftTab === t ? '#00e5ff' : 'rgba(255,255,255,0.15)'}`,
                      background: leftTab === t ? 'rgba(0,229,255,0.12)' : 'transparent', color: leftTab === t ? '#00e5ff' : '#94a3b8' }}>{t}</button>
                ))}
              </div>
            </div>

            {/* ═══ MARKET INTELLIGENCE — fungsi khusus panel kiri (popup modal) ═══ */}
            <div className="hud-panel" style={{ margin: '6px 6px 0', flexShrink: 0 }}>
              <div className="hud-label">Market Intelligence</div>
              <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <button
                  onClick={() => setMieModal({ open: true, symbol: 'IHSG' })}
                  style={{
                    fontSize: 10, fontWeight: 800, padding: '7px 0', borderRadius: 6, cursor: 'pointer',
                    border: '1px solid rgba(0,229,255,0.5)', background: 'rgba(0,229,255,0.1)', color: '#00e5ff'
                  }}
                >
                  JIN, TAMPILKAN DATA INDEKS SAHAM
                </button>
                <div style={{ fontSize: 8, color: '#64748b', textAlign: 'center' }}>
                  atau ucapkan: &ldquo;Jin, tampilkan data Indeks Saham&rdquo;
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
                  {[['LOKAL', '#34d399'], ['GLOBAL', '#38bdf8'], ['KOMODITAS', '#f59e0b'], ['CRYPTO', '#c084fc']].map(([l, c]) => (
                    <button key={l} onClick={() => setMieModal({ open: true, symbol: l === 'LOKAL' ? 'IHSG' : l === 'CRYPTO' ? 'BTC' : l === 'KOMODITAS' ? 'GOLD' : 'DXY' })}
                      title={`${l} — buka analisis`}
                      style={{ fontSize: 7.5, fontWeight: 800, padding: '4px 0', borderRadius: 4, cursor: 'pointer',
                        border: `1px solid ${c}44`, background: `${c}11`, color: c, letterSpacing: '0.02em' }}>{l}</button>
                  ))}
                </div>
              </div>
            </div>

            {leftTab === 'MARKET' ? (
              <div className="hud-panel" style={{ margin: '6px 6px 0', flex: '1 1 auto', overflowY: 'auto', minHeight: 0 }}>
                <div className="hud-label">Market Intelligence — LIVE</div>
                <MarketIntelligenceView />
              </div>
            ) : (
            <>
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
                <div className="flex items-center justify-between" style={{ fontSize: 10.5, marginBottom: 4, fontWeight: 600 }}>
                  <div className="flex items-center gap-2">
                    <span className={`status-indicator ${
                      runtimeHealth.reachable === false
                        ? 'status-critical animate-pulse'
                        : /DEGRADED/i.test(runtimeHealth.status)
                        ? 'status-warning'
                        : 'status-online'
                    }`} />
                    <span style={{ color: 'rgba(226,232,240,0.75)' }}>NEURAL</span>
                  </div>
                  <span style={{
                    fontSize: 8.5,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: runtimeHealth.reachable === false ? '#f87171' : (/DEGRADED/i.test(runtimeHealth.status) ? '#fbbf24' : '#34d399')
                  }}>
                    {runtimeHealth.reachable === false ? 'OFFLINE' : runtimeHealth.provider}
                  </span>
                </div>
                <div className="flex items-center justify-between" style={{ fontSize: 10.5, marginBottom: 4, fontWeight: 600 }}>
                  <div className="flex items-center gap-2">
                    <span className={`status-indicator ${
                      memoryHealth.status === 'HEALTHY'
                        ? 'status-online'
                        : memoryHealth.status === 'CRITICAL'
                        ? 'status-critical animate-pulse'
                        : memoryHealth.status === 'DEGRADED'
                        ? 'status-warning'
                        : 'status-warning animate-pulse'
                    }`} />
                    <span style={{ color: 'rgba(226,232,240,0.75)' }}>MEMORY</span>
                  </div>
                  <span style={{
                    fontSize: 8.5,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: memoryHealth.status === 'HEALTHY' ? '#34d399' : (memoryHealth.status === 'CRITICAL' ? '#f87171' : '#fbbf24')
                  }}>
                    {memoryHealth.status === 'HEALTHY'
                      ? `${memoryHealth.vaultFiles}V/${memoryHealth.indexed}I`
                      : memoryHealth.status}
                  </span>
                </div>
                <div className="flex items-center justify-between" style={{ fontSize: 10.5, fontWeight: 600 }}>
                  <div className="flex items-center gap-2">
                    <span className={`status-indicator ${
                      avatarState === 'ERROR'
                        ? 'status-critical animate-pulse'
                        : avatarState === 'INTERRUPTED'
                        ? 'status-warning animate-pulse'
                        : avatarState === 'LISTENING'
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
                    color: avatarState === 'ERROR'
                      ? '#f87171'
                      : avatarState === 'INTERRUPTED'
                      ? '#fbbf24'
                      : avatarState === 'LISTENING'
                      ? '#34d399'
                      : avatarState === 'SPEAKING'
                      ? '#c084fc'
                      : avatarState === 'PROCESSING'
                      ? '#e879f9'
                      : '#38bdf8'
                  }}>
                    {avatarState === 'ERROR'
                      ? 'FAULT'
                      : avatarState === 'INTERRUPTED'
                      ? 'BARGE-IN'
                      : avatarState === 'LISTENING'
                      ? 'LISTENING'
                      : avatarState === 'SPEAKING'
                      ? 'SPEAKING'
                      : avatarState === 'PROCESSING'
                      ? 'ANALYZING'
                      : 'READY'}
                  </span>
                </div>
              </div>
            </div>
            </>
            )}

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
              J I N I
            </h1>
            <p style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(0,229,255,0.4)', marginBottom: 16, fontFamily: 'monospace' }}>
              JOINT INTELLIGENCE NEURAL-INTERFACE
            </p>
            <JINErrorBoundary label="HOLO-CORE OFFLINE">
              <LiveHologramAvatar avatarState={avatarState} audioMetrics={audioMetrics} size="center" />
            </JINErrorBoundary>
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
          <JINErrorBoundary label="INTELLIGENCE STREAM OFFLINE">
            <JINTickerConversation />
          </JINErrorBoundary>
        </div>

        {/* ═══ FAR RIGHT PANEL — TELEMETRY TICKER (PRESERVED) ═══ */}
        <JINErrorBoundary label="TELEMETRY OFFLINE">
        <LiveTickerPanel />
      </JINErrorBoundary>
      </div>

      {/* ═══ MARKET INTELLIGENCE POPUP MODAL (MIE v1) ═══ */}
      <MarketIntelligenceModal
        open={mieModal.open}
        initialSymbol={mieModal.symbol}
        onClose={() => setMieModal((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}
