import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import ChatSimulator from './ui/simulator/ChatSimulator';

// Vite dev server can transiently fail a dynamic import (optimize-deps restart,
// HMR invalidation, or a 504 "Outdated Optimize Dep"). Without a retry that
// rejection unmounts the whole React tree and leaves a blank dark page until a
// manual refresh, so retry once before giving up.
const CHUNK_ERROR_RE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk \d+ failed|ChunkLoadError|Outdated Optimize Dep|Importing a module script failed/i;

function isChunkLoadError(error) {
  return CHUNK_ERROR_RE.test(`${error?.name || ''} ${error?.message || ''}`);
}

function retryImport(loader, attempts = 2) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      loader()
        .then(resolve)
        .catch((error) => {
          if (remaining <= 1 || !isChunkLoadError(error)) {
            reject(error);
            return;
          }
          setTimeout(() => attempt(remaining - 1), 600);
        });
    };
    attempt(attempts);
  });
}

const lazyRoute = (loader) => lazy(() => retryImport(loader));

const MyProjects = lazyRoute(() => import('./pages/MyProjects'));
const GeneratedApps = lazyRoute(() => import('./pages/GeneratedApps'));
const ResearchBuilder = lazyRoute(() => import('./pages/ResearchBuilder'));
const TradingStudioModal = lazyRoute(() => import('./components/trading/TradingStudioModal.jsx'));
const PlatformTrader = lazyRoute(() => import('./pages/PlatformTrader.jsx'));
const BrokerWorkspace = lazyRoute(() => import('./pages/BrokerWorkspace.jsx'));
const ResearchGold = lazyRoute(() => import('./pages/ResearchGold.jsx'));

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[RouteErrorBoundary]', error, info?.componentStack);
    if (!isChunkLoadError(error)) return;
    // Auto-recover from transient chunk/import failures, but never loop.
    let lastReload = 0;
    try {
      lastReload = Number(sessionStorage.getItem('jin:chunk-reload-at') || 0);
    } catch {}
    if (Date.now() - lastReload < 10000) return;
    try {
      sessionStorage.setItem('jin:chunk-reload-at', String(Date.now()));
    } catch {}
    window.location.reload();
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: 24,
          background: '#030814',
          color: '#e2e8f0',
          fontFamily: 'Inter, system-ui, sans-serif',
          textAlign: 'center'
        }}
      >
        <strong style={{ fontSize: 16, color: '#f87171' }}>Halaman gagal dimuat</strong>
        <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', maxWidth: 560, lineHeight: 1.6 }}>
          Modul halaman tidak berhasil diambil (biasanya karena dev server baru restart atau
          sedang re-optimasi dependency). Muat ulang halaman untuk mencoba lagi.
        </p>
        <code style={{ fontSize: 11, color: '#64748b', maxWidth: 560, wordBreak: 'break-word' }}>
          {String(this.state.error?.message || this.state.error)}
        </code>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 4,
            padding: '8px 18px',
            borderRadius: 6,
            border: '1px solid #38bdf8',
            background: 'rgba(56, 189, 248, 0.15)',
            color: '#38bdf8',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          Muat Ulang Halaman
        </button>
      </div>
    );
  }
}

function BackgroundMusic() {
  const audioRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const startAudio = () => {
      if (!started && audioRef.current) {
        audioRef.current.volume = 0.3;
        audioRef.current.play().catch(() => {});
        setStarted(true);
      }
    };
    document.addEventListener('click', startAudio, { once: true });
    document.addEventListener('keydown', startAudio, { once: true });
    return () => {
      document.removeEventListener('click', startAudio);
      document.removeEventListener('keydown', startAudio);
    };
  }, [started]);
  const toggleMute = (e) => {
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.muted = !muted;
      if (!started) {
        audioRef.current.volume = 0.3;
        audioRef.current.play().catch(() => {});
        setStarted(true);
      }
    }
    setMuted(!muted);
  };
  return <>
    <audio ref={audioRef} src="/onlyinmydreams.mp3" loop preload="auto" />
    <button onClick={toggleMute} title={muted ? 'Nyalakan musik' : 'Matikan musik'} style={{ position:'fixed', bottom:20, right:20, zIndex:9999, width:40, height:40, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.15)', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, boxShadow:'0 4px 15px rgba(0,0,0,0.4)', color:'white' }}>{muted ? '🔇' : '🎵'}</button>
  </>;
}

function DesktopDeepLinkBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    const bridge = window.ultimateAI?.app;
    if (!bridge) return undefined;

    const handleLink = (payload) => {
      if (!payload || payload.ok === false) return;
      const brokerId = payload.brokerId || 'xm';
      const platformId = payload.platformId || 'xm-web';
      const params = new URLSearchParams({ broker: brokerId, platform: platformId });
      navigate(`/broker-workspace?${params.toString()}`);
    };

    const unsubscribe = typeof bridge.onDeepLink === 'function'
      ? bridge.onDeepLink(handleLink)
      : undefined;

    if (typeof bridge.getPendingDeepLink === 'function') {
      bridge.getPendingDeepLink()
        .then((pending) => {
          if (pending) handleLink(pending);
        })
        .catch(() => {});
    }

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [navigate]);
  return null;
}

function App() {
  // Warm the heaviest route chunks during idle time so the first navigation does
  // not stall (in dev it can take seconds while Vite transforms the module graph).
  useEffect(() => {
    const timer = setTimeout(() => {
      import('./pages/PlatformTrader.jsx').catch(() => {});
      import('./pages/BrokerWorkspace.jsx').catch(() => {});
      import('./pages/ResearchGold.jsx').catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return <Router>
    <BackgroundMusic />
    <DesktopDeepLinkBridge />
    <RouteErrorBoundary>
      <Suspense fallback={<div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#030814', color: '#94a3b8', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13 }}>Memuat modul...</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/simulator" replace />} />
          <Route path="/simulator" element={<ChatSimulator />} />
          <Route path="/trading" element={<TradingStudioModal />} />
          <Route path="/platform-trader" element={<PlatformTrader />} />
          <Route path="/broker-workspace" element={<BrokerWorkspace />} />
          <Route path="/research-gold" element={<ResearchGold />} />
          <Route path="/my-projects" element={<MyProjects />} />
          <Route path="/generated-apps" element={<GeneratedApps />} />
          <Route path="/research-builder" element={<ResearchBuilder />} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  </Router>;
}
export default App;
