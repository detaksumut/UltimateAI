import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ChatSimulator from './ui/simulator/ChatSimulator';

const MyProjects = lazy(() => import('./pages/MyProjects'));
const GeneratedApps = lazy(() => import('./pages/GeneratedApps'));
const ResearchBuilder = lazy(() => import('./pages/ResearchBuilder'));
const TradingStudioModal = lazy(() => import('./components/trading/TradingStudioModal.jsx'));

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

function App() {
  return <Router>
    <BackgroundMusic />
    <Suspense fallback={<div className="min-h-screen bg-slate-900 text-slate-400 flex items-center justify-center font-mono text-sm">Memuat modul...</div>}>
      <Routes>
        <Route path="/" element={<Navigate to="/simulator" replace />} />
        <Route path="/simulator" element={<ChatSimulator />} />
        <Route path="/trading" element={<TradingStudioModal />} />
        <Route path="/my-projects" element={<MyProjects />} />
        <Route path="/generated-apps" element={<GeneratedApps />} />
        <Route path="/research-builder" element={<ResearchBuilder />} />
      </Routes>
    </Suspense>
  </Router>;
}
export default App;
