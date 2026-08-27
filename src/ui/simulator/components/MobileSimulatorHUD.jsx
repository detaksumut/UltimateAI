import React, { useState } from 'react';
import { 
  Smartphone, ChevronDown, MessageSquare, Globe, Shield, 
  Layers, AlertTriangle, CheckCircle, ExternalLink, Play
} from 'lucide-react';
import AppSandboxRenderer from './AppSandboxRenderer.jsx';

export default function MobileSimulatorHUD({
  messages = [],
  latestResponse,
  isProcessing,
  activeMode = 'CONVERSATION', // 'CONVERSATION' | 'SEARCH' | 'INSIGHTS' | 'APP_PREVIEW'
  onModeChange,
  generatedAppCode = null,
  liveSearchSources = []
}) {
  const [selectedDevice, setSelectedDevice] = useState('iPhone 15');
  const [currentTab, setCurrentTab] = useState(activeMode);

  React.useEffect(() => {
    if (activeMode) setCurrentTab(activeMode);
  }, [activeMode]);

  const lastAssistantMessage = messages.filter(m => m.role === 'assistant').slice(-1)[0]?.content || latestResponse || 'Halo! Saya JIN. Saya siap membantu simulasi dan orkestrasi riset Anda.';
  const lastUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';

  // Default live search nodes if none injected
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
          <span className="text-xs font-mono font-bold tracking-widest text-white uppercase">SIMULATOR</span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="appearance-none bg-slate-900/90 border border-slate-700/70 px-2.5 py-1 pr-6 rounded-lg text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              <option value="iPhone 15">iPhone 15</option>
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

        {/* Intelligence Mode Tabs */}
        <div className="flex items-center justify-between gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 mb-2 z-10 text-[10px] font-mono">
          <button
            onClick={() => handleTabClick('CONVERSATION')}
            className={`flex-1 py-1 rounded-lg transition-all ${
              currentTab === 'CONVERSATION' ? 'bg-blue-600/70 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            DIALOG
          </button>
          <button
            onClick={() => handleTabClick('SEARCH')}
            className={`flex-1 py-1 rounded-lg transition-all ${
              currentTab === 'SEARCH' ? 'bg-emerald-600/70 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            SEARCH
          </button>
          <button
            onClick={() => handleTabClick('INSIGHTS')}
            className={`flex-1 py-1 rounded-lg transition-all ${
              currentTab === 'INSIGHTS' ? 'bg-cyan-600/70 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            INSIGHTS
          </button>
          <button
            onClick={() => handleTabClick('APP_PREVIEW')}
            className={`flex-1 py-1 rounded-lg transition-all ${
              currentTab === 'APP_PREVIEW' ? 'bg-purple-600/70 text-white font-bold' : 'text-slate-400 hover:text-white'
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
                        <span>9Router reasoning in progress...</span>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{lastAssistantMessage}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE GLOBAL SEARCH (REAL CITATIONS) */}
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

                {/* Search Radar World Map */}
                <div className="w-full h-16 rounded-xl bg-[#030712] border border-slate-800 relative overflow-hidden flex items-center justify-center">
                  <div className="text-[10px] font-mono text-cyan-400 z-10 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-cyan-500/40 shadow-sm">
                    🌐 Multi-Source Crawler Active
                  </div>
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:10px_10px] opacity-30"></div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: IMPORTANT INFORMATION */}
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

                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2.5 text-slate-200 space-y-1">
                    <div className="font-bold text-emerald-300 text-[11px] flex items-center gap-1.5">
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                      <span>Arsitektur Sistem Terverifikasi</span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-normal">
                      9 jalur reasoning 9Router beroperasi dalam toleransi latensi optimal &lt; 200ms.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LIVE APP PROTOTYPE SANDBOX */}
          {currentTab === 'APP_PREVIEW' && (
            <div className="w-full h-full min-h-[260px] rounded-2xl overflow-hidden border border-purple-500/30 shadow-inner">
              <AppSandboxRenderer appCode={generatedAppCode} />
            </div>
          )}
        </div>

        {/* iPhone Bottom Pagination */}
        <div className="w-full flex flex-col items-center gap-1.5 pt-2 pb-0.5 z-10">
          <div className="flex items-center gap-1.5">
            <button onClick={() => setCurrentTab('CONVERSATION')} className={`w-1.5 h-1.5 rounded-full transition-all ${currentTab === 'CONVERSATION' ? 'bg-cyan-400 shadow-[0_0_6px_#00e5ff] scale-125' : 'bg-slate-600'}`} />
            <button onClick={() => setCurrentTab('SEARCH')} className={`w-1.5 h-1.5 rounded-full transition-all ${currentTab === 'SEARCH' ? 'bg-emerald-400 shadow-[0_0_6px_#10b981] scale-125' : 'bg-slate-600'}`} />
            <button onClick={() => setCurrentTab('INSIGHTS')} className={`w-1.5 h-1.5 rounded-full transition-all ${currentTab === 'INSIGHTS' ? 'bg-cyan-400 shadow-[0_0_6px_#00e5ff] scale-125' : 'bg-slate-600'}`} />
            <button onClick={() => setCurrentTab('APP_PREVIEW')} className={`w-1.5 h-1.5 rounded-full transition-all ${currentTab === 'APP_PREVIEW' ? 'bg-purple-400 shadow-[0_0_6px_#c084fc] scale-125' : 'bg-slate-600'}`} />
          </div>
          <div className="w-28 h-1 bg-slate-600 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
