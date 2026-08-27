import React from 'react';
import { Zap, Volume2, Brain, Network, ShieldCheck } from 'lucide-react';

export default function BottomStatusToolbar({ onQuickCommand, onVoiceSettings }) {
  return (
    <div className="w-full flex items-center justify-center gap-3 py-2 z-20 overflow-x-auto select-none px-2">
      {/* 1. Quick Commands */}
      <button
        onClick={onQuickCommand}
        className="glass-hud-card hover:border-cyan-400/50 px-3 py-1.5 rounded-xl flex items-center gap-2 text-slate-300 hover:text-white transition-all text-xs font-mono"
      >
        <Zap className="w-3.5 h-3.5 text-cyan-400" />
        <div className="text-left">
          <div className="text-[9px] text-slate-400 leading-none">QUICK</div>
          <div className="text-[10px] font-bold tracking-wider">COMMANDS</div>
        </div>
      </button>

      {/* 2. Voice Settings */}
      <button
        onClick={onVoiceSettings}
        className="glass-hud-card hover:border-cyan-400/50 px-3 py-1.5 rounded-xl flex items-center gap-2 text-slate-300 hover:text-white transition-all text-xs font-mono"
      >
        <Volume2 className="w-3.5 h-3.5 text-blue-400" />
        <div className="text-left">
          <div className="text-[9px] text-slate-400 leading-none">VOICE</div>
          <div className="text-[10px] font-bold tracking-wider">SETTINGS</div>
        </div>
      </button>

      {/* 3. AI Mode */}
      <div className="glass-hud-card px-3 py-1.5 rounded-xl flex items-center gap-2 text-slate-300 text-xs font-mono">
        <Brain className="w-3.5 h-3.5 text-purple-400" />
        <div className="text-left">
          <div className="text-[9px] text-slate-400 leading-none">AI MODE</div>
          <div className="text-[10px] font-bold tracking-wider text-purple-300">ADAPTIVE</div>
        </div>
      </div>

      {/* 4. Router Status */}
      <div className="glass-hud-card px-3 py-1.5 rounded-xl flex items-center gap-2 text-slate-300 text-xs font-mono">
        <Network className="w-3.5 h-3.5 text-emerald-400" />
        <div className="text-left">
          <div className="text-[9px] text-slate-400 leading-none">ROUTER STATUS</div>
          <div className="text-[10px] font-bold tracking-wider text-emerald-400">9ROUTER ACTIVE</div>
        </div>
      </div>

      {/* 5. Security */}
      <div className="glass-hud-card px-3 py-1.5 rounded-xl flex items-center gap-2 text-slate-300 text-xs font-mono">
        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
        <div className="text-left">
          <div className="text-[9px] text-slate-400 leading-none">SECURITY</div>
          <div className="text-[10px] font-bold tracking-wider text-cyan-400">ENCRYPTED</div>
        </div>
      </div>
    </div>
  );
}
