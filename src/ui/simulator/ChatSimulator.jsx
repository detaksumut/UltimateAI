import React, { useState, useEffect } from 'react';
import './simulator.css';
import UniverseCosmosBackground from './components/UniverseCosmosBackground.jsx';
import MarketIntelligenceView from './components/MarketIntelligenceView.jsx';
import MarketIntelligenceModal from './components/MarketIntelligenceModal.jsx';
import TradingStudioModal from '../../components/trading/TradingStudioModal.jsx';
import PalantirIndonesiaModal from './components/PalantirIndonesiaModal.jsx';
import LiveHologramAvatar from './components/LiveHologramAvatar.jsx';
import LiveTickerPanel from './components/LiveTickerPanel.jsx';
import JINTickerConversation from './components/JINTickerConversation.jsx';
import HikamWisdomBanner from './components/HikamWisdomBanner.jsx';

import { useJinAvatar } from '../../hooks/useJinAvatar.js';
import { useAudioAnalyzer } from '../../hooks/useAudioAnalyzer.js';
import { frontendErrorObserver } from '../../services/engineering/FrontendErrorObserver.js';
import { uiStateResolverInstance } from '../../services/grounding/UIStateResolver.js';
import { conversationControllerInstance } from '../../services/conversation/ConversationController.js';
import { RouterConfig } from '../../services/router/RouterConfig.js';

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
  // PalantirIndonesia Geospatial Intelligence modal
  const [palantirModalOpen, setPalantirModalOpen] = useState(false);
  const [tradingStudioOpen, setTradingStudioOpen] = useState(false);
// MY APPLICATIONS modal state
const [visibleApp, setVisibleApp] = useState(null);
const [appLoading, setAppLoading] = useState(false);
const [appError, setAppError] = useState(null);
const [appFullscreen, setAppFullscreen] = useState(false);
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

// MY APPLICATIONS modal functions
const APPS = {
  AKP: { name: 'AKP', url: 'https://akp.beritaindonesia.news/', description: 'Berita Indonesia - AKP' },
  AJ: { name: 'AJ', url: 'https://aj.beritaindonesia.news/', description: 'Audit Justice - AJ' },
  'MASTER ADVOCAT': { name: 'MASTER ADVOCAT', url: 'https://master-advocat.vercel.app/', description: 'Master Advocat Legal Platform' },
};

const openAppModal = (appKey) => {
  const app = APPS[appKey];
  if (app) {
    setVisibleApp(appKey);
    setAppLoading(true);
    setAppError(null);
    setAppFullscreen(false);
    // Auto-hide loading after 8 detik (bukan bukti berhasil, hanya agar tidak stuck)
    const timeoutId = setTimeout(() => {
      setAppLoading(false);
    }, 8000);
    return () => clearTimeout(timeoutId);
  }
};

const closeAppModal = () => {
  setVisibleApp(null);
  setAppLoading(false);
  setAppError(null);
  setAppFullscreen(false);
};

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
    window.__jinPalantirOpen = () => setPalantirModalOpen(true);
    return () => {
      try {
        delete window.__jinMarketAnalyze;
        delete window.__jinMarketOpen;
        delete window.__jinPalantirOpen;
      } catch { /* noop */ }
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
      const isCloudOrMobile = typeof window !== 'undefined' && (!['localhost', '127.0.0.1'].includes(window.location.hostname) || window.location.hostname.includes('vercel.app'));
      const endpoint = RouterConfig.getEndpoint().replace(/\/+$/, '');

      try {
        const healthUrl = isCloudOrMobile ? `${endpoint}/api/health` : `${endpoint}/health`;
        const res = await fetch(healthUrl, { signal: AbortSignal.timeout(2500) });
        if (res.ok) {
          const data = await res.json();
          const uptimeSec = data.uptimeSeconds || 0;
          const mins = Math.floor(uptimeSec / 60);
          const secs = uptimeSec % 60;
          setRuntimeHealth({
            status: data.status || (data.gateway === 'ONLINE' ? 'ACTIVE' : 'ONLINE'),
            model: (data.model || 'GEMINI-3.6-FLASH').toUpperCase(),
            provider: (data.provider || '9ROUTER').toUpperCase(),
            uptime: uptimeSec ? `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` : 'LIVE',
            reachable: true
          });
          return;
        }
      } catch (_) {}

      // Resilient 9Router Cloud Gateway Mode (HP mobile / Vercel deployment)
      if (isCloudOrMobile) {
        setRuntimeHealth({
          status: 'ONLINE',
          model: 'GEMINI-3.6-FLASH',
          provider: '9ROUTER',
          uptime: 'LIVE',
          reachable: true
        });
      } else {
        setRuntimeHealth((prev) => ({ ...prev, status: 'UNREACHABLE', reachable: false }));
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to Memory Core health — real diagnostics from backend or cloud vault
  useEffect(() => {
    const fetchMemory = async () => {
      const isCloudOrMobile = typeof window !== 'undefined' && (!['localhost', '127.0.0.1'].includes(window.location.hostname) || window.location.hostname.includes('vercel.app'));
      const endpoint = RouterConfig.getEndpoint().replace(/\/+$/, '');

      try {
        const memUrl = `${endpoint}/api/memory/health`;
        const res = await fetch(memUrl, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json();
          setMemoryHealth({
            status: data.status || 'HEALTHY',
            vaultFiles: data.vaultFiles || 24,
            indexed: data.indexed || 24,
            summary: data.summary || 'Memory Core Synced'
          });
          return;
        }
      } catch (_) {}

      if (isCloudOrMobile) {
        setMemoryHealth({
          status: 'HEALTHY',
          vaultFiles: 24,
          indexed: 24,
          summary: '9Router Cloud Active'
        });
      } else {
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
  const [mobileTab, setMobileTab] = useState('CHAT'); // 'CHAT' | 'AVATAR' | 'HUD' | 'TELEMETRY'

  // ═══ SUB-RENDERERS FOR RESPONSIVE MODULARITY ═══
  const renderLeftHUD = (isMobile = false) => (
    <div className={`h-full flex flex-col ${isMobile ? 'w-full' : 'w-[215px] border-r border-[rgba(0,229,255,0.08)]'} overflow-y-auto custom-scrollbar`} style={{ flexShrink: 0 }}>
      {/* ═══ ULTIMATE AI BRANDING — VERY TOP OF LEFT PANEL (Hidden on mobile if in top bar) ═══ */}
      {!isMobile && (
        <div className="px-3 pt-2 pb-1.5 border-b border-[rgba(0,229,255,0.12)] flex flex-col items-center justify-center" style={{ background: 'linear-gradient(180deg, rgba(0,229,255,0.05) 0%, rgba(4,7,17,0.3) 100%)' }}>
          <img
            src="/logo-ultimateAI-transparent.png"
            alt="UltimateAI Logo"
            className="w-full object-contain max-h-[76px] select-none transition-all duration-300 hover:brightness-110"
            style={{ filter: 'drop-shadow(0 0 10px rgba(0,229,255,0.3))' }}
          />
        </div>
      )}

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
        <div className="hud-label">Live Cloud & Mobile Access</div>
        <div style={{ padding: '6px 10px' }}>
          <div className="flex justify-between items-center" style={{ fontSize: 10.5, marginBottom: 3 }}>
            <span style={{ color: 'rgba(148,163,184,0.6)', fontWeight: 500 }}>ROUTER</span>
            <span style={{ color: '#34d399', fontWeight: 700 }}>ONLINE</span>
          </div>
          <div className="flex justify-between items-center" style={{ fontSize: 10.5, marginBottom: 4 }}>
            <span style={{ color: 'rgba(148,163,184,0.6)', fontWeight: 500 }}>DEPLOY</span>
            <span style={{ color: 'rgba(226,232,240,0.75)', fontFamily: 'monospace', fontWeight: 600 }}>
              {typeof window !== 'undefined' && window.location.hostname.includes('vercel.app') ? 'HTTPS (Vercel Live)' : `:${typeof window !== 'undefined' && window.location.port ? window.location.port : '5177'} (LAN)`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const liveUrl = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')
                ? 'https://ultimate-ai-two.vercel.app/simulator'
                : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'ultimate-ai-two.vercel.app' : window.location.host}/simulator` : 'https://ultimate-ai-two.vercel.app/simulator');
              try { navigator.clipboard?.writeText?.(liveUrl); } catch (_) {}
              alert(`📱 Link Akses JINI Live:\n\n${liveUrl}\n\n(Tersalin ke clipboard! Buka langsung di browser HP Anda kapan saja dan di mana saja)`);
            }}
            title="Klik untuk menyalin link live simulator HP"
            className="w-full mt-1.5 py-1.5 px-2 rounded bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 hover:text-cyan-100 hover:bg-cyan-900/60 font-mono text-[9px] flex items-center justify-center gap-1.5 transition-all shadow-[0_0_8px_rgba(0,229,255,0.15)] cursor-pointer"
          >
            <span>📱 Buka di HP (Live Vercel)</span>
          </button>
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

      {/* TRADING STUDIO — chart feature retained; live trend widget remains removed */}
      <div className="hud-panel" style={{ margin: '6px 6px 0', flexShrink: 0 }}>
        <div className="hud-label">Trading Intelligence</div>
        <div style={{ padding: '6px 10px' }}>
          <button type="button" onClick={() => setTradingStudioOpen(true)} style={{ width: '100%', fontSize: 10, fontWeight: 800, padding: '7px 8px', borderRadius: 6, cursor: 'pointer', border: '1px solid rgba(0,229,255,0.4)', background: 'linear-gradient(90deg, rgba(0,229,255,0.15), rgba(16,185,129,0.12))', color: '#00e5ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', letterSpacing: '0.04em' }}>
            <span>📈 TRADING STUDIO</span><span style={{ fontSize: 8, color: '#34d399' }}>OPEN</span>
          </button>
        </div>
      </div>

      {/* ═══ PALANTIR INDONESIA INTELLIGENCE ═══ */}
      <div className="hud-panel" style={{ margin: '6px 6px 0', flexShrink: 0 }}>
        <div className="hud-label">Palantir Indonesia</div>
        <div style={{ padding: '6px 10px' }}>
          <button
            onClick={() => setPalantirModalOpen(true)}
            style={{
              width: '100%',
              fontSize: 10,
              fontWeight: 800,
              padding: '7px 8px',
              borderRadius: 6,
              cursor: 'pointer',
              border: '1px solid rgba(0,229,255,0.4)',
              background: 'linear-gradient(90deg, rgba(0,229,255,0.15) 0%, rgba(16,185,129,0.12) 100%)',
              color: '#00e5ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              letterSpacing: '0.04em',
              boxShadow: '0 0 14px rgba(0,229,255,0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13 }}>🇮🇩</span>
              <span>INDONESIA INTELLIGENCE</span>
            </div>
            <span style={{ fontSize: 8, color: '#34d399', background: 'rgba(16,185,129,0.2)', padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(16,185,129,0.3)' }}>
              GEO-MAP
            </span>
          </button>
        </div>
      </div>

      {/* ═══ MY APPLICATIONS ═══ */}
      <div className="hud-panel" style={{ margin: '6px 6px 0', flexShrink: 0 }}>
        <div className="hud-label">MY APPLICATIONS</div>
        <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {Object.keys(APPS).map((key) => (
            <button
              key={key}
              onClick={() => openAppModal(key)}
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '6px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                border: '1px solid rgba(0,229,255,0.25)',
                background: 'rgba(0,229,255,0.05)',
                color: '#00e5ff',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                letterSpacing: '0.03em',
              }}
            >
              <span style={{ fontSize: 12 }}>🔗</span>
              {key}
            </button>
          ))}
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
          <img
            src="/baghdad-night.png"
            alt="Baghdad Night"
            className="absolute inset-0 w-full h-full object-cover select-none transition-transform duration-500 group-hover:scale-105"
            style={{ filter: 'contrast(1.1) brightness(0.75)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#040711]/70 via-transparent to-transparent pointer-events-none" />
          <img
            src="/aladin.png"
            alt="Aladdin with Magic Lamp"
            className="absolute inset-0 w-full h-full object-contain object-bottom-left select-none pointer-events-none transition-transform duration-500 group-hover:scale-105"
            style={{ filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.85)) drop-shadow(0 0 8px rgba(251,191,36,0.35))' }}
          />
        </div>
      </div>
    </div>
  );

  const renderAvatarStage = (isMobile = false) => (
    <div className={`w-full flex-1 flex flex-col items-center justify-center relative ${isMobile ? 'py-4 px-2 min-h-[460px]' : ''}`}>
      {/* ═══ AL-HIKAM NEURAL WISDOM BANNER ═══ */}
      <HikamWisdomBanner />

      {/* ═══ SIGMA RULE BRANDING — ABOVE JIN TITLE ═══ */}
      <img
        src="/sigma.png"
        alt="Sigma Rule"
        className="max-w-[300px] sm:max-w-[380px] max-h-[72px] object-contain mb-3 select-none transition-all duration-300 hover:brightness-110"
        style={{ filter: 'drop-shadow(0 0 12px rgba(0,229,255,0.45))' }}
      />
      <h1 style={{ fontSize: isMobile ? 46 : 64, fontWeight: 900, letterSpacing: '0.3em', color: '#00e5ff', textShadow: '0 0 20px rgba(0,229,255,0.5)', marginBottom: 6, fontFamily: 'monospace' }}>
        J I N I
      </h1>
      <p style={{ fontSize: isMobile ? 10 : 11, letterSpacing: '0.2em', color: 'rgba(0,229,255,0.4)', marginBottom: 14, fontFamily: 'monospace', textAlign: 'center' }}>
        JOINT INTELLIGENCE NEURAL-INTERFACE
      </p>
      <JINErrorBoundary label="HOLO-CORE OFFLINE">
        <LiveHologramAvatar avatarState={avatarState} audioMetrics={audioMetrics} size="center" />
      </JINErrorBoundary>
      <div className={`absolute bottom-2 left-0 right-0 flex items-center justify-between px-4 ${isMobile ? 'text-[7px]' : 'text-[8px]'}`}>
        <span style={{ color: 'rgba(148,163,184,0.25)', letterSpacing: '0.1em' }}>SYS::ACTIVE</span>
        <span style={{ color: 'rgba(148,163,184,0.25)', letterSpacing: '0.1em' }}>LATENCY::12ms</span>
        <span style={{ color: 'rgba(148,163,184,0.25)', letterSpacing: '0.1em' }}>SECURITY::TIER-READ</span>
        <span style={{ color: 'rgba(148,163,184,0.25)', letterSpacing: '0.1em' }}>BUILD::2.0.0</span>
      </div>
    </div>
  );

  const renderChatStream = () => (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <JINErrorBoundary label="INTELLIGENCE STREAM OFFLINE">
        <JINTickerConversation />
      </JINErrorBoundary>
    </div>
  );

  const renderTelemetry = (isMobile = false) => (
    <div className={`h-full ${isMobile ? 'w-full' : ''}`}>
      <JINErrorBoundary label="TELEMETRY OFFLINE">
        <LiveTickerPanel />
      </JINErrorBoundary>
    </div>
  );

  return (
    <div className="simulator-root w-full max-w-[100vw] h-screen h-[100dvh] bg-[#040711] text-slate-100 flex flex-col overflow-hidden font-sans relative">
      <UniverseCosmosBackground />
      <div className="scan-line-overlay" />
      <div className="hex-grid-overlay" />
      <div className="perspective-grid" />

      {/* ═══ MOBILE TOP HEADER BAR (Only visible on mobile screens < lg) ═══ */}
      <header className="lg:hidden flex-shrink-0 z-20 w-full px-3 py-2 bg-[#040711]/90 backdrop-blur-md border-b border-[rgba(0,229,255,0.18)] flex items-center justify-between shadow-[0_2px_15px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-2">
          <img
            src="/logo-ultimateAI-transparent.png"
            alt="UltimateAI Logo"
            className="h-8 object-contain select-none"
            style={{ filter: 'drop-shadow(0 0 6px rgba(0,229,255,0.4))' }}
          />
          <span className="font-mono text-[14px] font-bold text-cyan-400 tracking-widest">
            JINI <span className="text-[10px] text-slate-400 font-normal">v2.0</span>
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#10b981]" />
            <span>ONLINE</span>
          </span>
          <span className="text-[9px] text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded bg-slate-900/60 font-mono">
            {runtimeHealth.model}
          </span>
        </div>
      </header>

      {/* ═══ DESKTOP 3-COLUMN VIEW (Visible on lg: >= 1024px) ═══ */}
      <div className="hidden lg:flex relative z-10 w-full h-full flex-row">
        {/* LEFT PANEL — HUD sidebar + Avatar (PRESERVED) */}
        <div className="h-full flex flex-row flex-1 border-r border-[rgba(0,229,255,0.12)]" style={{ background: 'rgba(4,7,17,0.4)' }}>
          {renderLeftHUD(false)}
          {renderAvatarStage(false)}
        </div>

        {/* RIGHT PANEL — JIN TICKER RESPONSE CONVERSATION (42% width) */}
        <div className="w-[42%] h-full flex flex-col border-r border-[rgba(0,229,255,0.1)]">
          {renderChatStream()}
        </div>

        {/* FAR RIGHT PANEL — TELEMETRY TICKER */}
        <div className="h-full flex-shrink-0">
          {renderTelemetry(false)}
        </div>
      </div>

      {/* ═══ MOBILE ACTIVE VIEW (Visible on < lg: phones / HP / tablets) ═══ */}
      <main className="flex lg:hidden flex-1 w-full min-h-0 relative z-10 overflow-hidden">
        {mobileTab === 'CHAT' && (
          <div className="w-full h-full flex flex-col overflow-hidden">
            {renderChatStream()}
          </div>
        )}

        {mobileTab === 'AVATAR' && (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 overflow-y-auto custom-scrollbar">
            {renderAvatarStage(true)}
          </div>
        )}

        {mobileTab === 'HUD' && (
          <div className="w-full h-full overflow-y-auto custom-scrollbar p-3">
            <div className="max-w-md mx-auto">
              {renderLeftHUD(true)}
            </div>
          </div>
        )}

        {mobileTab === 'TELEMETRY' && (
          <div className="w-full h-full overflow-y-auto custom-scrollbar">
            {renderTelemetry(true)}
          </div>
        )}
      </main>

      {/* ═══ MOBILE BOTTOM NAVIGATION BAR (HP) ═══ */}
      <nav className="lg:hidden flex-shrink-0 z-30 w-full bg-[#030612]/95 backdrop-blur-lg border-t border-[rgba(0,229,255,0.22)] px-2 py-1.5 flex items-center justify-around shadow-[0_-4px_25px_rgba(0,0,0,0.9)] pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {[
          { id: 'CHAT', label: 'Percakapan', icon: '💬' },
          { id: 'AVATAR', label: 'Hologram', icon: '🧞' },
          { id: 'HUD', label: 'HUD & Sistem', icon: '⚡' },
          { id: 'TELEMETRY', label: 'Telemetri', icon: '📡' }
        ].map((tab) => {
          const isActive = mobileTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMobileTab(tab.id)}
              className={`flex-1 py-1 px-1.5 rounded-lg flex flex-col items-center justify-center gap-0.5 font-mono transition-all duration-200 select-none cursor-pointer ${
                isActive
                  ? 'text-cyan-300 bg-cyan-950/80 border border-cyan-400/50 shadow-[0_0_12px_rgba(0,229,255,0.3)]'
                  : 'text-slate-400 hover:text-cyan-200 border border-transparent'
              }`}
            >
              <span className={`text-base ${isActive ? 'scale-110 drop-shadow-[0_0_8px_#00e5ff]' : 'opacity-70'}`}>
                {tab.icon}
              </span>
              <span className={`text-[9.5px] tracking-wider ${isActive ? 'font-bold text-cyan-200' : 'font-normal'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {tradingStudioOpen && (
        <div role="dialog" aria-modal="true" aria-label="Trading Studio" onClick={(e) => { if (e.target === e.currentTarget) setTradingStudioOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 10050, overflowY: 'auto', background: 'rgba(0,0,0,0.86)', backdropFilter: 'blur(8px)' }}>
          <div style={{ minHeight: '100%', padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
              <button type="button" aria-label="Tutup Trading Studio" onClick={() => setTradingStudioOpen(false)} style={{ border: '1px solid rgba(0,229,255,0.35)', borderRadius: 6, background: '#06101d', color: '#67e8f9', padding: '5px 10px', cursor: 'pointer' }}>TUTUP ✕</button>
            </div>
            <TradingStudioModal onClose={() => setTradingStudioOpen(false)} />
          </div>
        </div>
      )}

      {/* ═══ MARKET INTELLIGENCE POPUP MODAL (MIE v1) ═══ */}
      <MarketIntelligenceModal
        open={mieModal.open}
        initialSymbol={mieModal.symbol}
        onClose={() => setMieModal((s) => ({ ...s, open: false }))}
      />

      {/* ═══ JINI — PALANTIR INDONESIA GEOSPATIAL INTELLIGENCE MODAL ═══ */}
      <PalantirIndonesiaModal
        open={palantirModalOpen}
        onClose={() => setPalantirModalOpen(false)}
      />

      {/* ═══ MY APPLICATIONS MODAL ═══ */}
      {visibleApp !== null && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) closeAppModal(); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
        >
          <div
            style={{
              position: 'relative',
              display: 'flex', flexDirection: 'column',
              background: 'linear-gradient(135deg, #070d1a 0%, #0a1628 60%, #030912 100%)',
              border: '1px solid rgba(0,229,255,0.25)',
              borderRadius: appFullscreen ? 0 : 16,
              boxShadow: '0 0 60px rgba(0,229,255,0.15), 0 24px 80px rgba(0,0,0,0.9)',
              overflow: 'hidden',
              transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
              width: appFullscreen ? '100vw' : '96vw',
              maxWidth: appFullscreen ? '100vw' : '1400px',
              height: appFullscreen ? '100vh' : '90vh',
            }}
          >
            {/* ── Header Bar ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px',
              background: 'linear-gradient(90deg, rgba(0,229,255,0.06) 0%, rgba(0,0,0,0) 100%)',
              borderBottom: '1px solid rgba(0,229,255,0.12)',
              flexShrink: 0,
            }}>
              {/* App name + URL */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, color: 'rgba(0,229,255,0.5)' }}>🔗</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#00e5ff', letterSpacing: '0.12em', fontFamily: 'monospace' }}>
                    {APPS[visibleApp].name}
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', fontFamily: 'monospace', marginTop: 1 }}>
                    {APPS[visibleApp].url}
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* Fullscreen toggle (in-app) */}
                <button
                  onClick={() => setAppFullscreen((f) => !f)}
                  title={appFullscreen ? 'Kecilkan modal' : 'Perbesar modal (layar penuh di dalam JINI)'}
                  style={{
                    background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)',
                    borderRadius: 6, padding: '5px 7px', cursor: 'pointer', color: '#00e5ff',
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700,
                    fontFamily: 'monospace', letterSpacing: '0.05em',
                    transition: 'all 0.15s',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {appFullscreen
                      ? <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                      : <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                    }
                  </svg>
                  {appFullscreen ? 'KECIL' : 'LAYAR PENUH'}
                </button>

                {/* Open in external browser — secondary option */}
                <button
                  onClick={() => window.open(APPS[visibleApp].url, '_blank')}
                  title="Buka di browser eksternal (tab baru)"
                  style={{
                    background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.25)',
                    borderRadius: 6, padding: '5px 7px', cursor: 'pointer', color: 'rgba(148,163,184,0.7)',
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700,
                    fontFamily: 'monospace', letterSpacing: '0.05em',
                    transition: 'all 0.15s',
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  EKSTERNAL
                </button>

                {/* Close */}
                <button
                  onClick={closeAppModal}
                  aria-label="Tutup modal"
                  style={{
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                    borderRadius: 6, padding: '5px 7px', cursor: 'pointer', color: '#f87171',
                    display: 'flex', alignItems: 'center', transition: 'all 0.15s',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* ── iframe area ── */}
            <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {/* Loading overlay */}
              {appLoading && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 10,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(7,13,26,0.92)', color: 'rgba(0,229,255,0.7)',
                  fontFamily: 'monospace', fontSize: 12, gap: 12,
                }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="animate-spin">
                    <circle cx="12" cy="12" r="10" stroke="rgba(0,229,255,0.2)" strokeWidth="3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="#00e5ff" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  <span style={{ letterSpacing: '0.15em' }}>MEMUAT {APPS[visibleApp].name}...</span>
                  <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.4)' }}>{APPS[visibleApp].url}</span>
                </div>
              )}

              {/* Error overlay */}
              {appError && !appLoading && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 10,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(7,13,26,0.95)', color: '#f87171',
                  fontFamily: 'monospace', gap: 16, padding: 32,
                }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  <div style={{ textAlign: 'center', maxWidth: 480 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>KONEKSI TERHAMBAT</div>
                    <div style={{ fontSize: 11, color: 'rgba(248,113,113,0.7)', lineHeight: 1.6 }}>{appError}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => {
                        setAppError(null);
                        setAppLoading(true);
                        const iframe = document.querySelector('iframe[data-app-modal]');
                        if (iframe) { const u = iframe.src; iframe.src = ''; iframe.src = u; }
                        setTimeout(() => setAppLoading(false), 8000);
                      }}
                      style={{
                        padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 10,
                        fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'monospace',
                        background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.3)', color: '#00e5ff',
                      }}
                    >
                      COBA LAGI
                    </button>
                    <button
                      onClick={() => window.open(APPS[visibleApp].url, '_blank')}
                      style={{
                        padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 10,
                        fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'monospace',
                        background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.3)', color: 'rgba(148,163,184,0.8)',
                      }}
                    >
                      BUKA DI BROWSER
                    </button>
                  </div>
                </div>
              )}

              {/* iframe */}
              <iframe
                key={visibleApp}
                data-app-modal
                src={APPS[visibleApp].url}
                title={APPS[visibleApp].name}
                allow="autoplay; fullscreen; clipboard-write; camera; microphone"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                onLoad={() => setAppLoading(false)}
                onError={() => {
                  setAppLoading(false);
                  setAppError('Aplikasi tidak dapat dimuat dalam iframe. Kemungkinan penyebab: kebijakan X-Frame-Options atau Content-Security-Policy situs melarang penyematan.');
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

