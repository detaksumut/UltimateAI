import React from 'react';
import { 
  Brain, Mic, MessageSquare, Globe, BarChart2, Share2, 
  Sparkles, Database, Activity, Settings, ChevronRight, User, Zap
} from 'lucide-react';

export default function LeftSidebarHUD({ activeTab, setActiveTab, onActionClick }) {
  const activeClass = 'border border-cyan-400/50 text-white shadow-[0_0_14px_rgba(0,229,255,0.35),inset_0_1px_3px_rgba(255,255,255,0.25)]';
  const hoverClass = 'border border-transparent hover:border-white/20 hover:text-white hover:shadow-[0_0_8px_rgba(0,229,255,0.15),inset_0_1px_2px_rgba(255,255,255,0.12)]';
  const activeBg = 'rgba(0,229,255,0.12)';
  const hoverBg = 'rgba(255,255,255,0.05)';

  const NavItem = ({ id, icon: Icon, iconColor = 'text-cyan-300', label, sub, onClick }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={onClick}
        className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all duration-200 ${isActive ? activeClass : hoverClass}`}
        style={{
          background: isActive ? activeBg : 'transparent',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = hoverBg; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
      >
        {/* Crystal Icon Box */}
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColor}`}
          style={{
            background: isActive
              ? 'linear-gradient(135deg, rgba(0,229,255,0.25), rgba(100,200,255,0.10))'
              : 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))',
            border: isActive ? '1px solid rgba(0,229,255,0.50)' : '1px solid rgba(255,255,255,0.18)',
            boxShadow: isActive
              ? 'inset 0 1px 2px rgba(255,255,255,0.40), 0 0 8px rgba(0,229,255,0.30)'
              : 'inset 0 1px 2px rgba(255,255,255,0.20)',
          }}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs font-semibold tracking-wide">{label}</div>
          {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
        </div>
      </button>
    );
  };

  const SectionLabel = ({ dot, color, children }) => (
    <span className="text-[10px] font-bold text-cyan-400/70 tracking-widest uppercase px-2 mb-1 flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} style={{ boxShadow: `0 0 6px ${color}` }}></span>
      {children}
    </span>
  );

  return (
    <aside
      className="w-64 flex-shrink-0 h-full flex flex-col justify-between p-4 text-slate-300 select-none relative my-1 ml-2 rounded-3xl border-2 border-white/25"
      style={{
        background: 'transparent',
        boxShadow: '0 0 40px rgba(0,242,254,0.15), 0 0 80px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.30), inset 0 -2px 4px rgba(0,0,0,0.2)'
      }}
    >
      {/* Crystal Top Specular Rim */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none rounded-t-3xl"></div>
      {/* Crystal Prismatic Sheen Top-Left */}
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.01)_30%,transparent_55%)] pointer-events-none rounded-3xl"></div>

      {/* Thick Crystal Faceted Corner Brackets */}
      <div className="absolute top-1 left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-cyan-400/80 rounded-tl-lg pointer-events-none shadow-[0_0_8px_#00f2fe]"></div>
      <div className="absolute top-1 right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-cyan-400/80 rounded-tr-lg pointer-events-none shadow-[0_0_8px_#00f2fe]"></div>
      <div className="absolute bottom-1 left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-cyan-400/60 rounded-bl-lg pointer-events-none"></div>
      <div className="absolute bottom-1 right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-cyan-400/60 rounded-br-lg pointer-events-none"></div>

      <div className="flex flex-col gap-5 overflow-y-auto custom-scrollbar pr-1 z-10">

        {/* Brand Header */}
        <div className="flex items-center gap-3 px-1 pt-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(0,229,255,0.20), rgba(168,85,247,0.15))',
              border: '1.5px solid rgba(0,229,255,0.55)',
              boxShadow: 'inset 0 1.5px 3px rgba(255,255,255,0.40), 0 0 16px rgba(0,229,255,0.30)'
            }}
          >
            <Brain className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide text-white leading-tight drop-shadow-[0_0_8px_rgba(0,229,255,0.6)]">
              Ultimate<span className="text-cyan-400">AI</span>
            </h1>
            <p className="text-[9px] tracking-widest text-cyan-400/80 font-mono font-medium">
              INTELLIGENCE BEYOND LIMITS
            </p>
          </div>
        </div>

        {/* Thin crystal divider */}
        <div className="h-[1px] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent mx-1"></div>

        {/* Section: JIN CORE */}
        <div className="flex flex-col gap-1">
          <SectionLabel dot="bg-cyan-400" color="#00e5ff">JIN CORE</SectionLabel>
          <NavItem
            id="talk_to_jin"
            icon={Mic}
            iconColor="text-cyan-300"
            label="TALK TO JIN"
            sub="Voice conversation"
            onClick={() => { setActiveTab('talk_to_jin'); onActionClick?.('talk'); }}
          />
          <NavItem
            id="chat_with_jin"
            icon={MessageSquare}
            iconColor="text-slate-300"
            label="CHAT WITH JIN"
            sub="Text conversation"
            onClick={() => { setActiveTab('chat_with_jin'); onActionClick?.('chat'); }}
          />
        </div>

        {/* Section: INTELLIGENCE */}
        <div className="flex flex-col gap-1">
          <SectionLabel dot="bg-emerald-400" color="#10b981">INTELLIGENCE</SectionLabel>
          <NavItem
            id="global_search"
            icon={Globe}
            iconColor="text-emerald-400"
            label="GLOBAL SEARCH"
            sub="Search anything"
            onClick={() => { setActiveTab('global_search'); onActionClick?.('search'); }}
          />
          <NavItem
            id="analyze_data"
            icon={BarChart2}
            iconColor="text-cyan-400"
            label="ANALYZE DATA"
            sub="Upload & analyze files"
            onClick={() => { setActiveTab('analyze_data'); onActionClick?.('analyze'); }}
          />
          <NavItem
            id="deep_analysis"
            icon={Share2}
            iconColor="text-cyan-400"
            label="DEEP ANALYSIS"
            sub="Multi-source reasoning"
            onClick={() => { setActiveTab('deep_analysis'); onActionClick?.('deep_analysis'); }}
          />
          <NavItem
            id="create_generate"
            icon={Sparkles}
            iconColor="text-cyan-300"
            label="CREATE & GENERATE"
            sub="Images, reports, content"
            onClick={() => { setActiveTab('create_generate'); onActionClick?.('generate'); }}
          />
        </div>

        {/* Section: MEMORY & ACTIVITY */}
        <div className="flex flex-col gap-1">
          <SectionLabel dot="bg-purple-400" color="#c084fc">MEMORY &amp; ACTIVITY</SectionLabel>
          <NavItem
            id="memory_vault"
            icon={Database}
            iconColor="text-purple-400"
            label="MEMORY VAULT"
            sub="Saved knowledge"
            onClick={() => { setActiveTab('memory_vault'); onActionClick?.('vault'); }}
          />
          <NavItem
            id="activity_feed"
            icon={Activity}
            iconColor="text-emerald-400"
            label="ACTIVITY FEED"
            sub="Live system activity"
            onClick={() => { setActiveTab('activity_feed'); onActionClick?.('feed'); }}
          />
        </div>

        {/* Section: SYSTEM */}
        <div className="flex flex-col gap-1">
          <SectionLabel dot="bg-blue-400" color="#60a5fa">SYSTEM</SectionLabel>
          <NavItem
            id="connections"
            icon={Zap}
            iconColor="text-cyan-400"
            label="CONNECTIONS"
            sub="Antigravity OAuth (7 slots)"
            onClick={() => { setActiveTab('connections'); onActionClick?.('connections'); }}
          />
          <NavItem
            id="control_center"
            icon={Settings}
            iconColor="text-purple-400"
            label="CONTROL CENTER"
            sub="System & preferences"
            onClick={() => { setActiveTab('control_center'); onActionClick?.('control'); }}
          />
        </div>
      </div>

      {/* Crystal Divider */}
      <div className="h-[1px] bg-gradient-to-r from-transparent via-cyan-400/25 to-transparent my-3"></div>

      {/* User Profile Footer - Crystal */}
      <div
        className="flex items-center justify-between px-2 py-2.5 rounded-xl z-10"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))',
          border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.20), 0 0 10px rgba(0,242,254,0.08)'
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(0,100,200,0.15))',
              border: '1.5px solid rgba(0,229,255,0.40)',
              boxShadow: 'inset 0 1.5px 3px rgba(255,255,255,0.35), 0 0 10px rgba(0,229,255,0.25)'
            }}
          >
            <User className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <div className="text-xs font-bold text-white tracking-wide drop-shadow-[0_0_6px_rgba(0,229,255,0.5)]">RAHMAN</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-slate-400">Enterprise Plan</span>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide"
                style={{
                  background: 'rgba(168,85,247,0.20)',
                  border: '1px solid rgba(168,85,247,0.45)',
                  color: '#c084fc',
                  boxShadow: '0 0 8px rgba(168,85,247,0.25)'
                }}
              >
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
