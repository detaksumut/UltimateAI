import React from 'react';
import {
  Brain, Mic, MessageSquare, Globe, BarChart2, Share2,
  Sparkles, Database, Activity, Settings, ChevronRight, User, Zap
} from 'lucide-react';
import CyberHUDVoiceBar from './CyberHUDVoiceBar.jsx';

const ACTIVE_CLASS = 'bg-cyan-500/20 border border-cyan-400/70 text-white shadow-[0_0_15px_rgba(0,229,255,0.35),inset_0_1.5px_3px_rgba(255,255,255,0.35)]';
const HOVER_CLASS = 'border border-transparent hover:border-white/20 hover:bg-white/[0.08] text-slate-300 hover:text-white';

const NavItem = React.memo(function NavItem({ id, icon: Icon, iconColor = 'text-cyan-300', label, sub, isActive, onClick }) {
  return (
    <button
      type="button"
      id={`btn-nav-${id}`}
      onClick={onClick}
      className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center gap-2.5 transition-transform duration-100 relative z-40 cursor-pointer active:scale-[0.96] hover:scale-[1.01] pointer-events-auto select-none ${
        isActive ? ACTIVE_CLASS : HOVER_CLASS
      }`}
    >
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 pointer-events-none transition-colors ${iconColor} ${
          isActive ? 'bg-cyan-500/25 border border-cyan-400/40 shadow-[0_0_8px_rgba(0,229,255,0.3)]' : 'bg-white/[0.05] border border-white/10'
        }`}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="overflow-hidden pointer-events-none">
        <div className="text-xs font-semibold tracking-wide truncate">{label}</div>
        {sub && <div className="text-[9px] text-slate-400 font-mono truncate">{sub}</div>}
      </div>
    </button>
  );
});

const SectionLabel = React.memo(function SectionLabel({ dot, color, children }) {
  return (
    <span className="text-[9px] font-bold text-cyan-400/80 tracking-widest uppercase px-2 mb-0.5 flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} style={{ boxShadow: `0 0 6px ${color}` }}></span>
      {children}
    </span>
  );
});

const LeftSidebarHUD = React.memo(function LeftSidebarHUD({
  activeTab,
  onActionClick
}) {

  return (
    /* Outer Crystal Panel Frame - exactly identical to Right Panel */
    <div
      className="w-72 lg:w-80 flex-shrink-0 h-full flex flex-col p-3.5 my-1 ml-2 rounded-3xl border-2 border-white/25 text-slate-300 select-none overflow-y-auto custom-scrollbar relative z-30"
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

      {/* ========================================================================= */}
      {/* 1. TOP LEFT BRAND HEADER CRYSTAL VAULT (Symmetric to JIN top box)        */}
      {/* ========================================================================= */}
      <div
        className="w-full flex flex-col items-center justify-center pt-2.5 pb-2 px-3 border-2 border-cyan-400/40 rounded-2xl mb-3 relative overflow-hidden flex-shrink-0"
        style={{
          background: 'transparent',
          boxShadow: 'inset 0 2px 5px rgba(255,255,255,0.30), inset 0 -2px 4px rgba(0,242,254,0.10), 0 0 20px rgba(0,242,254,0.18)'
        }}
      >
        {/* Crystal Bevel Top Highlight */}
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-300 to-transparent pointer-events-none"></div>

        {/* Brand Header Title & Icon */}
        <div className="flex items-center justify-center gap-2.5 z-10">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(0,229,255,0.25), rgba(168,85,247,0.15))',
              border: '1.5px solid rgba(0,229,255,0.60)',
              boxShadow: 'inset 0 1.5px 3px rgba(255,255,255,0.40), 0 0 10px rgba(0,229,255,0.30)'
            }}
          >
            <Brain className="w-4 h-4 text-cyan-300" />
          </div>
          <div>
            <div className="text-xs font-bold text-white tracking-widest font-mono drop-shadow-[0_0_8px_rgba(0,229,255,0.6)]">
              UltimateAI
            </div>
            <div className="text-[8px] text-cyan-300/80 font-mono tracking-wider">
              INTELLIGENCE BEYOND LIMITS
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MIDDLE NAVIGATION MENU CRYSTAL VAULT                                   */}
      {/* ========================================================================= */}
      <div
        className="flex-1 w-full relative z-30 flex flex-col p-2 rounded-2xl border-2 border-white/30 mb-3 overflow-hidden pointer-events-auto"
        style={{
          background: 'transparent',
          boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.35), inset 0 -2px 5px rgba(0,0,0,0.3), 0 0 20px rgba(0,242,254,0.12)'
        }}
      >
        {/* Crystal Bevel Top & Side highlights */}
        <div className="absolute top-0 left-4 right-4 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none"></div>
        <div className="absolute top-4 bottom-4 left-0 w-[2px] bg-gradient-to-b from-white/60 to-transparent pointer-events-none"></div>

        {/* Scrollable Navigation List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-0.5 space-y-3.5 relative z-30 pointer-events-auto">

          {/* Section: JIN CORE */}
          <div className="flex flex-col gap-1">
            <SectionLabel dot="bg-cyan-400" color="#00e5ff">JIN CORE</SectionLabel>
            <NavItem
              id="talk_to_jin"
              icon={Mic}
              iconColor="text-cyan-300"
              label="TALK TO JIN"
              sub="Voice conversation"
              isActive={activeTab === 'talk_to_jin'}
              onClick={() => onActionClick?.('talk')}
            />
            <NavItem
              id="chat_with_jin"
              icon={MessageSquare}
              iconColor="text-slate-300"
              label="CHAT WITH JIN"
              sub="Text conversation"
              isActive={activeTab === 'chat_with_jin'}
              onClick={() => onActionClick?.('chat')}
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
              isActive={activeTab === 'memory_vault'}
              onClick={() => onActionClick?.('vault')}
            />
            <NavItem
              id="activity_feed"
              icon={Activity}
              iconColor="text-emerald-400"
              label="ACTIVITY FEED"
              sub="Live system activity"
              isActive={activeTab === 'activity_feed'}
              onClick={() => onActionClick?.('feed')}
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
              isActive={activeTab === 'connections'}
              onClick={() => onActionClick?.('connections')}
            />
            <NavItem
              id="control_center"
              icon={Settings}
              iconColor="text-purple-400"
              label="CONTROL CENTER"
              sub="System & preferences"
              isActive={activeTab === 'control_center'}
              onClick={() => onActionClick?.('control')}
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. BOTTOM USER PROFILE CRYSTAL VAULT                                      */}
      {/* ========================================================================= */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onActionClick?.('control');
        }}
        className="w-full flex items-center justify-between p-2.5 rounded-2xl border-2 border-cyan-400/35 relative z-30 flex-shrink-0 cursor-pointer hover:border-cyan-400/80 transition-all hover:scale-[1.02] active:scale-[0.98] pointer-events-auto"
        style={{
          background: 'transparent',
          boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.30), 0 0 15px rgba(0,242,254,0.15)'
        }}
      >
        {/* Crystal Bevel Top Highlight */}
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent pointer-events-none"></div>

        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(0,229,255,0.25), rgba(59,130,246,0.15))',
              border: '1.5px solid rgba(0,229,255,0.50)',
              boxShadow: 'inset 0 1.5px 3px rgba(255,255,255,0.40), 0 0 10px rgba(0,229,255,0.25)'
            }}
          >
            <User className="w-4 h-4 text-cyan-300" />
          </div>
          <div>
            <div className="text-xs font-bold text-white tracking-wide drop-shadow-[0_0_6px_rgba(0,229,255,0.5)]">RAHMAN</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] text-slate-400">Enterprise Plan</span>
              <span
                className="text-[8px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wide"
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
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  );
});

export default LeftSidebarHUD;
