// src/App.jsx – Main application with routing
import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ChatSimulator from './ui/simulator/ChatSimulator';
import MyProjects from './pages/MyProjects';
import GeneratedApps from './pages/GeneratedApps';

function BackgroundMusic() {
  const audioRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [started, setStarted] = useState(false);

  // Start music on first user interaction (browser autoplay policy)
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
      // Start playing if not started yet
      if (!started) {
        audioRef.current.volume = 0.3;
        audioRef.current.play().catch(() => {});
        setStarted(true);
      }
    }
    setMuted(!muted);
  };

  return (
    <>
      <audio ref={audioRef} src="/onlyinmydreams.mp3" loop preload="auto" />
      <button
        onClick={toggleMute}
        title={muted ? 'Nyalakan musik' : 'Matikan musik'}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(21, 27, 43, 0.85)',
          backdropFilter: 'blur(8px)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
          transition: 'all 0.2s ease',
          color: 'white',
        }}
      >
        {muted ? '🔇' : '🎵'}
      </button>
    </>
  );
}

function App() {
  return (
    <Router>
      <BackgroundMusic />
      <Routes>
        <Route path="/" element={<Navigate to="/simulator" replace />} />
        <Route path="/simulator" element={<ChatSimulator />} />
        <Route path="/my-projects" element={<MyProjects />} />
        <Route path="/generated-apps" element={<GeneratedApps />} />
      </Routes>
    </Router>
  );
}

export default App;
