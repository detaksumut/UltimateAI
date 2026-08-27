import React, { useState, useEffect } from 'react';
import { 
  Smartphone, ChevronDown, MessageSquare, Globe, Shield, 
  Layers, AlertTriangle, CheckCircle, ExternalLink, Play,
  Film, Image as ImageIcon, BarChart3, Database, Sparkles, Music
} from 'lucide-react';
import AppSandboxRenderer from './AppSandboxRenderer.jsx';

export default function MobileSimulatorHUD({
  messages = [],
  latestResponse,
  isProcessing,
  activeMode = 'CONVERSATION', // 'CONVERSATION' | 'SEARCH' | 'MEDIA' | 'INSIGHTS' | 'APP_PREVIEW'
  onModeChange,
  generatedAppCode = null,
  liveSearchSources = []
}) {
  const [selectedDevice, setSelectedDevice] = useState('iPhone 15');
  const [currentTab, setCurrentTab] = useState(activeMode);
  const [activeMediaType, setActiveMediaType] = useState('ALL'); // 'ALL' | 'VIDEO' | 'IMAGE' | 'DATA'

  useEffect(() => {
    if (activeMode) setCurrentTab(activeMode);
  }, [activeMode]);

  const lastUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
  const lastAssistantMessage = messages.filter(m => m.role === 'assistant').slice(-1)[0]?.content || latestResponse || 'Halo! Saya JIN. Saya siap membantu simulasi, pencarian data, serta visualisasi gambar dan video.';

  // Detect dynamic media requirements from user query
  const lowerQuery = lastUserMessage.toLowerCase();
  const isVideoQuery = lowerQuery.includes('video') || lowerQuery.includes('youtube') || lowerQuery.includes('lagu') || lowerQuery.includes('musik') || lowerQuery.includes('putar');
  const isImageQuery = lowerQuery.includes('gambar') || lowerQuery.includes('foto') || lowerQuery.includes('image') || lowerQuery.includes('visual');
  const isDataQuery = lowerQuery.includes('data') || lowerQuery.includes('tabel') || lowerQuery.includes('grafik') || lowerQuery.includes('chart') || lowerQuery.includes('statistik');

  // Auto switch tab if specific media is requested
  useEffect(() => {
    if (isVideoQuery || isImageQuery || isDataQuery) {
      setCurrentTab('MEDIA');
    }
  }, [lastUserMessage]);

  const displaySources = liveSearchSources.length > 0 ? liveSearchSources : [
    { id: '1', category: 'GOVERNMENT', title: 'Kominfo AI Framework', domain: 'kominfo.go.id', url: 'https://kominfo.go.id' },
    { id: '2', category: 'ACADEMIC', title: 'ArXiv CS AI Repository', domain: 'arxiv.org', url: 'https://arxiv.org' },
    { id: '3', category: 'NEWS', title: 'TechInAsia AI Trends', domain: 'techinasia.com', url: 'https://techinasia.com' },
    { id: '4', category: 'INDUSTRY', title: 'GitHub Open Models', domain: 'github.com', url: 'https://github.com' }
  ];

  const handleTabClick = (tab) => {
    setCurrentTab(tab);
    if (onModeChange) onModeChange(tab);
  };

  return (
    <div className="w-80 lg:w-96 flex-shrink-0 h-full flex flex-col p-4 glass-hud-panel border-l border-cyan-500/20 text-slate-300 select-none">
      {/* Simulator Top Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold tracking-widest text-white uppercase">SIMULATOR HUD</span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="appearance-none bg-slate-900/90 border border-slate-700/70 px-2.5 py-1 pr-6 rounded-lg text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              <option value="iPhone 15">iPhone 15 Pro</option>
              <option value="iPad Mini">iPad Mini</option>
              <option value="Galaxy S24">Galaxy S24</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse"></span>
            <span>Online</span>
          </div>
        </div>
      </div>

      {/* Realistic Phone Bezel Frame */}
      <div className="flex-1 w-full bg-[#050811] rounded-[42px] p-3.5 border-4 border-slate-800 shadow-[0_0_40px_rgba(0,0,0,0.9)] flex flex-col justify-between overflow-hidden relative">
        {/* Dynamic Island */}
        <div className="w-full flex justify-center pt-0.5 pb-2 z-10">
          <div className="w-24 h-5 bg-black rounded-full border border-slate-800/90 flex items-center justify-between px-2.5 shadow-inner">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700"></span>
            <span className="w-2 h-2 rounded-full bg-cyan-400/90 shadow-[0_0_8px_#00e5ff] animate-pulse"></span>
          </div>
        </div>

        {/* Intelligence Mode Tabs (5 Tabs: DIALOG, MEDIA, SEARCH, INSIGHTS, APP) */}
        <div className="flex items-center justify-between gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 mb-2 z-10 text-[9px] font-mono">
          <button
            onClick={() => handleTabClick('CONVERSATION')}
            className={`flex-1 py-1 rounded-lg transition-all ${
              currentTab === 'CONVERSATION' ? 'bg-blue-600/80 text-white font-bold shadow-[0_0_10px_rgba(37,99,235,0.5)]' : 'text-slate-400 hover:text-white'
            }`}
          >
            CHAT
          </button>
          <button
            onClick={() => handleTabClick('MEDIA')}
            className={`flex-1 py-1 rounded-lg transition-all flex items-center justify-center gap-1 ${
              currentTab === 'MEDIA' ? 'bg-pink-600/80 text-white font-bold shadow-[0_0_10px_rgba(219,39,119,0.5)]' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-2.5 h-2.5 text-pink-300" />
            MEDIA
          </button>
          <button
            onClick={() => handleTabClick('SEARCH')}
            className={`flex-1 py-1 rounded-lg transition-all ${
              currentTab === 'SEARCH' ? 'bg-emerald-600/80 text-white font-bold shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'text-slate-400 hover:text-white'
            }`}
          >
            WEB
          </button>
          <button
            onClick={() => handleTabClick('INSIGHTS')}
            className={`flex-1 py-1 rounded-lg transition-all ${
              currentTab === 'INSIGHTS' ? 'bg-cyan-600/80 text-white font-bold shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'text-slate-400 hover:text-white'
            }`}
          >
            DATA
          </button>
          <button
            onClick={() => handleTabClick('APP_PREVIEW')}
            className={`flex-1 py-1 rounded-lg transition-all ${
              currentTab === 'APP_PREVIEW' ? 'bg-purple-600/80 text-white font-bold shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'text-slate-400 hover:text-white'
            }`}
          >
            APP UI
          </button>
        </div>

        {/* Phone Inner Screen Content */}
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar px-1 z-10">
          
          {/* TAB 1: CONVERSATION */}
          {currentTab === 'CONVERSATION' && (
            <div className="space-y-3">
              <div className="bg-slate-900/80 rounded-2xl p-3.5 border border-slate-800 shadow-md">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-cyan-300">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white tracking-wide">LIVE CONVERSATION</div>
                    <div className="text-[9px] text-slate-400">Streamed from 9Router</div>
                  </div>
                </div>

                <div className="space-y-2 text-xs font-sans">
                  {lastUserMessage && (
                    <div className="bg-blue-600/25 border border-blue-500/30 rounded-xl p-2.5 text-right text-slate-200 text-[11px]">
                      {lastUserMessage}
                    </div>
                  )}

                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-slate-300 text-[11px] leading-relaxed">
                    {isProcessing ? (
                      <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs py-1">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                        <span>JIN 9Router sedang memproses...</span>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{lastAssistantMessage}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RICH MULTIMEDIA & VISUALIZATION (VIDEO, GAMBAR, DATA) */}
          {currentTab === 'MEDIA' && (
            <div className="space-y-3 font-mono">
              {/* Media Sub-Filter Bar */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[9px]">
                <button
                  onClick={() => setActiveMediaType('ALL')}
                  className={`flex-1 py-1 rounded-lg ${activeMediaType === 'ALL' ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-400'}`}
                >
                  SEMUA
                </button>
                <button
                  onClick={() => setActiveMediaType('VIDEO')}
                  className={`flex-1 py-1 rounded-lg ${activeMediaType === 'VIDEO' ? 'bg-red-950/80 border border-red-500/40 text-red-300 font-bold' : 'text-slate-400'}`}
                >
                  ▶ VIDEO
                </button>
                <button
                  onClick={() => setActiveMediaType('IMAGE')}
                  className={`flex-1 py-1 rounded-lg ${activeMediaType === 'IMAGE' ? 'bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold' : 'text-slate-400'}`}
                >
                  🖼 GAMBAR
                </button>
                <button
                  onClick={() => setActiveMediaType('DATA')}
                  className={`flex-1 py-1 rounded-lg ${activeMediaType === 'DATA' ? 'bg-purple-950/80 border border-purple-500/40 text-purple-300 font-bold' : 'text-slate-400'}`}
                >
                  📊 DATA
                </button>
              </div>

              {/* 1. VIDEO PLAYER CARD */}
              {(activeMediaType === 'ALL' || activeMediaType === 'VIDEO') && (
                <div className="bg-slate-900/90 rounded-2xl p-3 border border-red-500/30 shadow-md">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-red-600/30 border border-red-400/40 flex items-center justify-center text-red-300">
                        <Film className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white tracking-wide">YOUTUBE & MEDIA PLAYER</div>
                        <div className="text-[8px] text-red-400">Stream Embed Live</div>
                      </div>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-bold">
                      HD 1080p
                    </span>
                  </div>

                  {/* Embedded Video Card */}
                  <div className="w-full aspect-video rounded-xl bg-slate-950 border border-slate-800 overflow-hidden relative group">
                    <iframe
                      className="w-full h-full"
                      src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0"
                      title="YouTube video player"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>

                  <div className="mt-2 text-[10px] text-slate-300 flex items-center justify-between">
                    <span className="text-red-400 font-bold truncate">🎵 Bryan Adams - Heaven (Official Music Video)</span>
                    <a
                      href="https://www.youtube.com/results?search_query=lagu+heaven"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] text-cyan-400 hover:underline flex items-center gap-1 flex-shrink-0"
                    >
                      Buka YouTube <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              )}

              {/* 2. IMAGE GALLERY CARD */}
              {(activeMediaType === 'ALL' || activeMediaType === 'IMAGE') && (
                <div className="bg-slate-900/90 rounded-2xl p-3 border border-cyan-500/30 shadow-md">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-cyan-600/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                        <ImageIcon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white tracking-wide">IMAGE GALLERY & ASSETS</div>
                        <div className="text-[8px] text-cyan-400">Visual Neural Synthesis</div>
                      </div>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold">
                      Rendered
                    </span>
                  </div>

                  {/* Grid of Images */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative rounded-xl overflow-hidden border border-cyan-500/40 group">
                      <img
                        src="/genie-bg.png"
                        alt="JIN Avatar Visual"
                        className="w-full h-24 object-cover group-hover:scale-105 transition-all"
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-black/70 p-1 text-[8px] text-cyan-300 truncate">
                        Hologram Neon JIN
                      </div>
                    </div>

                    <div className="relative rounded-xl overflow-hidden border border-purple-500/40 group bg-slate-950 flex flex-col items-center justify-center p-2">
                      <Sparkles className="w-6 h-6 text-purple-400 mb-1 animate-pulse" />
                      <div className="text-[9px] font-bold text-purple-300 text-center">AI Gen Image</div>
                      <div className="text-[7px] text-slate-400 text-center mt-0.5">High-Res Render</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. DATA & ANALYTICS TABLE */}
              {(activeMediaType === 'ALL' || activeMediaType === 'DATA') && (
                <div className="bg-slate-900/90 rounded-2xl p-3 border border-purple-500/30 shadow-md">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-purple-300">
                        <BarChart3 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white tracking-wide">INTERACTIVE DATA MATRIX</div>
                        <div className="text-[8px] text-purple-400">Live Structured Data</div>
                      </div>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold">
                      SQL / JSON
                    </span>
                  </div>

                  {/* Micro Data Table */}
                  <div className="w-full overflow-hidden rounded-xl border border-slate-800 text-[9px]">
                    <div className="grid grid-cols-3 bg-slate-950 p-1.5 font-bold text-cyan-300 border-b border-slate-800">
                      <div>PARAMETER</div>
                      <div className="text-center">METRIC</div>
                      <div className="text-right">STATUS</div>
                    </div>
                    <div className="divide-y divide-slate-800/60 bg-slate-900/60">
                      <div className="grid grid-cols-3 p-1.5 text-slate-300">
                        <div>Throughput</div>
                        <div className="text-center font-mono text-cyan-400">980 req/s</div>
                        <div className="text-right text-emerald-400 font-bold">OPTIMAL</div>
                      </div>
                      <div className="grid grid-cols-3 p-1.5 text-slate-300">
                        <div>9Router Latency</div>
                        <div className="text-center font-mono text-purple-400">182 ms</div>
                        <div className="text-right text-emerald-400 font-bold">PASS</div>
                      </div>
                      <div className="grid grid-cols-3 p-1.5 text-slate-300">
                        <div>Accuracy Score</div>
                        <div className="text-center font-mono text-emerald-400">99.4 %</div>
                        <div className="text-right text-emerald-400 font-bold">EXCELLENT</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LIVE GLOBAL SEARCH */}
          {currentTab === 'SEARCH' && (
            <div className="space-y-2.5">
              <div className="bg-slate-900/80 rounded-2xl p-3 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-600/30 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
                      <Globe className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white tracking-wide">SOURCE NETWORK</div>
                      <div className="text-[9px] text-emerald-400 font-mono">Live Web Citations</div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                    {displaySources.length} Verifikasi
                  </span>
                </div>

                {/* Real Verified Web Source Nodes */}
                <div className="space-y-1.5 mb-2 font-mono text-[10px]">
                  {displaySources.map((src, i) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-slate-950/90 hover:bg-slate-900 p-2 rounded-xl border border-slate-800/80 flex items-center justify-between gap-2 transition-all hover:border-emerald-500/50 block"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          src.category === 'GOVERNMENT' ? 'bg-amber-400' :
                          src.category === 'ACADEMIC' ? 'bg-cyan-400' :
                          src.category === 'NEWS' ? 'bg-blue-400' : 'bg-purple-400'
                        }`}></span>
                        <div className="overflow-hidden">
                          <div className="text-slate-200 font-bold truncate text-[11px]">{src.title}</div>
                          <div className="text-slate-400 text-[9px] truncate">{src.domain}</div>
                        </div>
                      </div>
                      <ExternalLink className="w-3 h-3 text-slate-500 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CRITICAL INSIGHTS */}
          {currentTab === 'INSIGHTS' && (
            <div className="space-y-3">
              <div className="bg-slate-900/80 rounded-2xl p-3.5 border border-slate-800">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-6 h-6 rounded-lg bg-cyan-600/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                    <Shield className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white tracking-wide">CRITICAL INSIGHTS</div>
                    <div className="text-[9px] text-amber-400 font-mono">⚠ HIGH PRIORITY FINDINGS</div>
                  </div>
                </div>

                <div className="space-y-2 text-xs font-sans">
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-slate-200 space-y-1">
                    <div className="font-bold text-amber-300 text-[11px] flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      <span>Inkonsistensi Data Terdeteksi</span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-normal">
                      Ditemukan variansi 4.2% pada parameter dataset riset yang memerlukan validasi ulang.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: LIVE APP PROTOTYPE SANDBOX */}
          {currentTab === 'APP_PREVIEW' && (
            <div className="w-full h-full min-h-[260px] rounded-2xl overflow-hidden border border-purple-500/30 shadow-inner">
              <AppSandboxRenderer appCode={generatedAppCode} />
            </div>
          )}
        </div>

        {/* iPhone Bottom Pagination */}
        <div className="w-full flex flex-col items-center gap-1.5 pt-2 pb-0.5 z-10">
          <div className="flex items-center gap-1.5">
            <button onClick={() => setCurrentTab('CONVERSATION')} className={`w-1.5 h-1.5 rounded-full transition-all ${currentTab === 'CONVERSATION' ? 'bg-blue-400 scale-125' : 'bg-slate-600'}`} />
            <button onClick={() => setCurrentTab('MEDIA')} className={`w-1.5 h-1.5 rounded-full transition-all ${currentTab === 'MEDIA' ? 'bg-pink-400 scale-125' : 'bg-slate-600'}`} />
            <button onClick={() => setCurrentTab('SEARCH')} className={`w-1.5 h-1.5 rounded-full transition-all ${currentTab === 'SEARCH' ? 'bg-emerald-400 scale-125' : 'bg-slate-600'}`} />
            <button onClick={() => setCurrentTab('INSIGHTS')} className={`w-1.5 h-1.5 rounded-full transition-all ${currentTab === 'INSIGHTS' ? 'bg-cyan-400 scale-125' : 'bg-slate-600'}`} />
            <button onClick={() => setCurrentTab('APP_PREVIEW')} className={`w-1.5 h-1.5 rounded-full transition-all ${currentTab === 'APP_PREVIEW' ? 'bg-purple-400 scale-125' : 'bg-slate-600'}`} />
          </div>
          <div className="w-28 h-1 bg-slate-600 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
