import React from 'react';
import { 
  Brain, Mic, MessageSquare, Globe, BarChart2, Share2, 
  Sparkles, Database, Activity, Settings, ChevronRight, User, Zap
} from 'lucide-react';

export default function LeftSidebarHUD({ activeTab, setActiveTab, onActionClick }) {
  return (
    <aside className="w-64 flex-shrink-0 h-full flex flex-col justify-between p-4 glass-hud-panel border-r border-cyan-500/20 text-slate-300 select-none">
      <div className="flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-1">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-1 pt-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500/30 to-purple-500/30 border border-cyan-400/40 flex items-center justify-center shadow-[0_0_15px_rgba(0,229,255,0.35)]">
            <Brain className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide text-white leading-tight">
              Ultimate<span className="text-cyan-400">AI</span>
            </h1>
            <p className="text-[9px] tracking-widest text-cyan-400/80 font-mono font-medium">
              INTELLIGENCE BEYOND LIMITS
            </p>
          </div>
        </div>

        {/* Section: JIN CORE */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-cyan-400/70 tracking-wider uppercase px-2 mb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#00e5ff]"></span>
            JIN CORE
          </span>
          
          <button
            onClick={() => { setActiveTab('talk_to_jin'); onActionClick?.('talk'); }}
            className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all duration-200 ${
              activeTab === 'talk_to_jin'
                ? 'bg-gradient-to-r from-blue-600/80 to-cyan-600/60 border border-cyan-400/50 text-white shadow-[0_0_18px_rgba(0,102,255,0.45)]'
                : 'hover:bg-slate-800/60 hover:text-white border border-transparent'
            }`}
          >
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-cyan-300">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold">TALK TO JIN</div>
              <div className="text-[10px] text-slate-400">Voice conversation</div>
            </div>
          </button>

          <button
            onClick={() => { setActiveTab('chat_with_jin'); onActionClick?.('chat'); }}
            className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all duration-200 ${
              activeTab === 'chat_with_jin'
                ? 'bg-gradient-to-r from-blue-600/80 to-cyan-600/60 border border-cyan-400/50 text-white shadow-[0_0_18px_rgba(0,102,255,0.45)]'
                : 'hover:bg-slate-800/60 hover:text-white border border-transparent'
            }`}
          >
            <div className="w-7 h-7 rounded-lg bg-slate-700/40 border border-slate-600/30 flex items-center justify-center text-slate-300">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold">CHAT WITH JIN</div>
              <div className="text-[10px] text-slate-400">Text conversation</div>
            </div>
          </button>
        </div>

        {/* Section: INTELLIGENCE */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-cyan-400/70 tracking-wider uppercase px-2 mb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]"></span>
            INTELLIGENCE
          </span>

          <button
            onClick={() => { setActiveTab('global_search'); onActionClick?.('search'); }}
            className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-all ${
              activeTab === 'global_search' ? 'bg-cyan-500/20 border border-cyan-400/40 text-white' : 'hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-xs font-medium">GLOBAL SEARCH</div>
              <div className="text-[10px] text-slate-400">Search anything</div>
            </div>
          </button>

          <button
            onClick={() => { setActiveTab('analyze_data'); onActionClick?.('analyze'); }}
            className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-all ${
              activeTab === 'analyze_data' ? 'bg-cyan-500/20 border border-cyan-400/40 text-white' : 'hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <BarChart2 className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-xs font-medium">ANALYZE DATA</div>
              <div className="text-[10px] text-slate-400">Upload & analyze files</div>
            </div>
          </button>

          <button
            onClick={() => { setActiveTab('deep_analysis'); onActionClick?.('deep_analysis'); }}
            className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-all ${
              activeTab === 'deep_analysis' ? 'bg-cyan-500/20 border border-cyan-400/40 text-white' : 'hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <Share2 className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-xs font-medium">DEEP ANALYSIS</div>
              <div className="text-[10px] text-slate-400">Multi-source reasoning</div>
            </div>
          </button>

          <button
            onClick={() => { setActiveTab('create_generate'); onActionClick?.('generate'); }}
            className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-all ${
              activeTab === 'create_generate' ? 'bg-cyan-500/20 border border-cyan-400/40 text-white' : 'hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-cyan-300" />
            <div>
              <div className="text-xs font-medium">CREATE & GENERATE</div>
              <div className="text-[10px] text-slate-400">Images, reports, content</div>
            </div>
          </button>
        </div>

        {/* Section: MEMORY & ACTIVITY */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-cyan-400/70 tracking-wider uppercase px-2 mb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_#c084fc]"></span>
            MEMORY & ACTIVITY
          </span>

          <button
            onClick={() => { setActiveTab('memory_vault'); onActionClick?.('vault'); }}
            className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-all ${
              activeTab === 'memory_vault' ? 'bg-cyan-500/20 border border-cyan-400/40 text-white' : 'hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <Database className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-xs font-medium">MEMORY VAULT</div>
              <div className="text-[10px] text-slate-400">Saved knowledge</div>
            </div>
          </button>

          <button
            onClick={() => { setActiveTab('activity_feed'); onActionClick?.('feed'); }}
            className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-all ${
              activeTab === 'activity_feed' ? 'bg-cyan-500/20 border border-cyan-400/40 text-white' : 'hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-xs font-medium">ACTIVITY FEED</div>
              <div className="text-[10px] text-slate-400">Live system activity</div>
            </div>
          </button>
        </div>

        {/* Section: SYSTEM */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-cyan-400/70 tracking-wider uppercase px-2 mb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            SYSTEM
          </span>

          <button
            onClick={() => { setActiveTab('connections'); onActionClick?.('connections'); }}
            className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-all ${
              activeTab === 'connections' ? 'bg-cyan-500/20 border border-cyan-400/40 text-white' : 'hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-xs font-medium">CONNECTIONS</div>
              <div className="text-[10px] text-slate-400">Antigravity OAuth (7 slots)</div>
            </div>
          </button>

          <button
            onClick={() => { setActiveTab('control_center'); onActionClick?.('control'); }}
            className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-all ${
              activeTab === 'control_center' ? 'bg-cyan-500/20 border border-cyan-400/40 text-white' : 'hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4 text-purple-400" />
            <div>
              <div className="text-xs font-medium">CONTROL CENTER</div>
              <div className="text-[10px] text-slate-400">System & preferences</div>
            </div>
          </button>
        </div>
      </div>

      {/* User Profile Footer */}
      <div className="pt-3 border-t border-cyan-500/20 flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-800 to-blue-900 border border-cyan-400/40 flex items-center justify-center shadow-[0_0_10px_rgba(0,229,255,0.3)]">
            <User className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <div className="text-xs font-bold text-white tracking-wide">RAHMAN</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-slate-400">Enterprise Plan</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-600/40 text-purple-300 border border-purple-500/40 font-bold uppercase">
                ADMIN
              </span>
            </div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-500" />
      </div>
    </aside>
  );
}
