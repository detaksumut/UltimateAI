import React from 'react';
import { 
  Brain, Mic, MessageSquare, Globe, BarChart2, Share2, 
  Sparkles, Database, Activity, Settings, ChevronRight, User, Zap
} from 'lucide-react';

export default function LeftSidebarHUD({ activeTab, setActiveTab, onActionClick }) {
  const activeClass = 'border border-cyan-400/70 text-white shadow-[0_4px_16px_rgba(0,229,255,0.4),inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.4)] translate-x-1';
  const hoverClass = 'border border-white/10 hover:border-cyan-400/40 hover:text-white hover:shadow-[0_4px_12px_rgba(0,229,255,0.2),inset_0_1.5px_3px_rgba(255,255,255,0.25)] hover:translate-x-0.5';
  const activeBg = 'linear-gradient(135deg, rgba(0,229,255,0.18) 0%, rgba(168,85,247,0.08) 100%)';
  const hoverBg = 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(0,229,255,0.03) 100%)';

  const NavItem = ({ id, icon: Icon, iconColor = 'text-cyan-300', label, sub, onClick }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={onClick}
        className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all duration-300 relative group ${isActive ? activeClass : hoverClass}`}
        style={{
          background: isActive ? activeBg : 'rgba(255,255,255,0.02)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = hoverBg; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
      >
        {/* 3D Active Indicator Light Bar on the left */}
        {isActive && (
          <div className="absolute -left-1 top-2 bottom-2 w-1.5 rounded-r-full bg-cyan-400 shadow-[0_0_10px_#00f2fe,0_0_20px_#00e5ff]"></div>
        )}

        {/* 3D Crystal Icon Block */}
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 ${iconColor}`}
          style={{
            background: isActive
              ? 'linear-gradient(135deg, rgba(0,229,255,0.35) 0%, rgba(100,200,255,0.12) 50%, rgba(255,255,255,0.2) 100%)'
              : 'linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.03) 100%)',
            border: isActive ? '1.5px solid rgba(0,229,255,0.7)' : '1px solid rgba(255,255,255,0.25)',
            boxShadow: isActive
              ? 'inset 0 2px 4px rgba(255,255,255,0.6), inset 0 -2px 3px rgba(0,0,0,0.5), 0 0 12px rgba(0,229,255,0.45)'
              : 'inset 0 1.5px 3px rgba(255,255,255,0.35), inset 0 -1.5px 2px rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.2)',
          }}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs font-semibold tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{label}</div>
          {sub && <div className="text-[10px] text-slate-400 font-mono tracking-tight">{sub}</div>}
        </div>
      </button>
    );
  };

  const SectionLabel = ({ dot, color, children }) => (
    <span className="text-[10px] font-bold text-cyan-400/80 tracking-widest uppercase px-2 mb-1 flex items-center gap-1.5 drop-shadow-[0_0_6px_rgba(0,229,255,0.4)]">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} style={{ boxShadow: `0 0 8px ${color}` }}></span>
      {children}
    </span>
  );

  return (
    <aside
      className="w-64 flex-shrink-0 h-full flex flex-col justify-between p-4 text-slate-300 select-none relative my-1 ml-2 rounded-3xl"
      style={{
        filter: 'drop-shadow(12px 0 30px rgba(0,0,0,0.85)) drop-shadow(0 15px 40px rgba(0,0,0,0.9)) drop-shadow(0 0 45px rgba(0,242,254,0.3))',
      }}
    >
      {/* 1. Main Ultra-Thick 3D Crystal Body Shell */}
      <div 
        className="absolute inset-0 rounded-3xl pointer-events-none"
        style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.01) 35%, rgba(180,220,255,0.04) 100%)',
          border: '2.5px solid rgba(255,255,255,0.55)',
          boxShadow: [
            /* 3D Top-Left Specular Lighting (Heavy Glass Reflection) */
            'inset 0 4px 10px rgba(255,255,255,0.75)',
            'inset 4px 0 10px rgba(255,255,255,0.45)',
            /* 3D Right & Bottom Heavy Slab Depth Extrusions */
            'inset -7px 0 16px rgba(0,0,0,0.80)',
            'inset 0 -7px 18px rgba(0,0,0,0.85)',
            /* Intermediate Prismatic Glow */
            'inset -3px 0 8px rgba(0,242,254,0.35)',
            /* Ambient Inset Luminescence */
            'inset 0 0 35px rgba(0,242,254,0.12)',
            /* Outer Edge Bevel Rim */
            '0 0 30px rgba(0,242,254,0.25)'
          ].join(',')
        }}
      />

      {/* 2. Inner Chamfer Rim - Double Crystal Layer */}
      <div 
        className="absolute inset-[3px] rounded-[22px] pointer-events-none border border-cyan-400/25"
        style={{
          boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.3), inset -2px 0 4px rgba(0,0,0,0.4)'
        }}
      />

      {/* 3. Massive 3D Slab Extrusion - Right Edge Thickness (Heavy 3D Crystal Block) */}
      <div 
        className="absolute top-3 bottom-3 right-[-5px] w-[6px] rounded-r-full pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.9) 0%, rgba(0,242,254,0.7) 40%, rgba(168,85,247,0.5) 80%, rgba(0,242,254,0.3) 100%)',
          boxShadow: '2px 0 14px rgba(0,242,254,0.6), inset -1px 0 2px rgba(255,255,255,0.8)'
        }}
      />

      {/* 4. Massive 3D Slab Extrusion - Bottom Edge Thickness */}
      <div 
        className="absolute bottom-[-4px] left-6 right-6 h-[5px] rounded-b-full pointer-events-none"
        style={{
          background: 'linear-gradient(to right, transparent 0%, rgba(0,242,254,0.5) 30%, rgba(168,85,247,0.6) 70%, transparent 100%)',
          boxShadow: '0 3px 12px rgba(0,242,254,0.4)'
        }}
      />

      {/* 5. 3D Specular Light Ridge - Left Edge */}
      <div 
        className="absolute top-5 bottom-5 left-0 w-[4px] rounded-l-full pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.5) 60%, transparent 100%)',
          boxShadow: '0 0 10px rgba(255,255,255,0.6)'
        }}
      />

      {/* 6. Crystal Top Specular Prism Rim with High Luminance */}
      <div className="absolute top-0 left-4 right-4 h-[2.5px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none rounded-t-3xl shadow-[0_0_12px_#ffffff,0_0_24px_rgba(0,242,254,0.6)]"></div>

      {/* 7. Diagonal Prismatic Light Flare Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.01)_35%,transparent_60%)] pointer-events-none rounded-3xl"></div>

      {/* 8. Chunky 3D Crystal Corner Brackets with Heavy Glow */}
      <div className="absolute top-1 left-1 w-5 h-5 border-t-[3px] border-l-[3px] border-cyan-300 rounded-tl-xl pointer-events-none shadow-[0_0_15px_#00f2fe,inset_0_1px_2px_#fff]"></div>
      <div className="absolute top-1 right-1 w-5 h-5 border-t-[3px] border-r-[3px] border-cyan-300 rounded-tr-xl pointer-events-none shadow-[0_0_15px_#00f2fe,inset_0_1px_2px_#fff]"></div>
      <div className="absolute bottom-1 left-1 w-5 h-5 border-b-[3px] border-l-[3px] border-cyan-400/80 rounded-bl-xl pointer-events-none shadow-[0_0_10px_#00f2fe]"></div>
      <div className="absolute bottom-1 right-1 w-5 h-5 border-b-[3px] border-r-[3px] border-cyan-400/80 rounded-br-xl pointer-events-none shadow-[0_0_10px_#00f2fe]"></div>

      {/* Content Area */}
      <div className="flex flex-col gap-5 overflow-y-auto custom-scrollbar pr-1 z-10 relative">

        {/* Brand Header - 3D Crystal Header Card */}
        <div className="flex items-center gap-3 px-1 pt-1">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(0,229,255,0.3) 0%, rgba(168,85,247,0.2) 100%)',
              border: '2px solid rgba(0,229,255,0.7)',
              boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.6), inset 0 -2px 3px rgba(0,0,0,0.5), 0 0 20px rgba(0,229,255,0.45)'
            }}
          >
            <Brain className="w-5 h-5 text-cyan-300 drop-shadow-[0_0_8px_#00e5ff]" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wide text-white leading-tight drop-shadow-[0_0_12px_rgba(0,229,255,0.8)]">
              Ultimate<span className="text-cyan-400">AI</span>
            </h1>
            <p className="text-[9px] tracking-widest text-cyan-300 font-mono font-bold drop-shadow-[0_0_6px_rgba(0,229,255,0.5)]">
              INTELLIGENCE BEYOND LIMITS
            </p>
          </div>
        </div>

        {/* 3D Crystal Divider */}
        <div className="h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent mx-1 shadow-[0_0_6px_rgba(0,229,255,0.3)]"></div>

        {/* Section: JIN CORE */}
        <div className="flex flex-col gap-1.5">
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
        <div className="flex flex-col gap-1.5">
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
        <div className="flex flex-col gap-1.5">
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
        <div className="flex flex-col gap-1.5">
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

      {/* 3D Crystal Divider */}
      <div className="h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent my-3 shadow-[0_0_6px_rgba(0,229,255,0.3)]"></div>

      {/* User Profile Footer - 3D Crystal Beveled Card */}
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-2xl z-10 relative transition-transform duration-300 hover:scale-[1.02]"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.02) 100%)',
          border: '1.5px solid rgba(255,255,255,0.28)',
          boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.35), inset 0 -2px 3px rgba(0,0,0,0.4), 0 4px 15px rgba(0,0,0,0.3), 0 0 15px rgba(0,242,254,0.15)'
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(0,229,255,0.25) 0%, rgba(59,130,246,0.2) 100%)',
              border: '1.5px solid rgba(0,229,255,0.6)',
              boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5), 0 0 12px rgba(0,229,255,0.35)'
            }}
          >
            <User className="w-5 h-5 text-cyan-300 drop-shadow-[0_0_6px_#00e5ff]" />
          </div>
          <div>
            <div className="text-xs font-bold text-white tracking-wide drop-shadow-[0_0_8px_rgba(0,229,255,0.6)]">RAHMAN</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-slate-400">Enterprise Plan</span>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide"
                style={{
                  background: 'linear-gradient(135deg, rgba(168,85,247,0.3) 0%, rgba(147,51,234,0.15) 100%)',
                  border: '1px solid rgba(168,85,247,0.6)',
                  color: '#e9d5ff',
                  boxShadow: '0 0 10px rgba(168,85,247,0.4), inset 0 1px 2px rgba(255,255,255,0.3)'
                }}
              >
                ADMIN
              </span>
            </div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-cyan-400/80 drop-shadow-[0_0_6px_rgba(0,229,255,0.4)]" />
      </div>
    </aside>
  );
}
