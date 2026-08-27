import React from 'react';
import { Bell, Settings, Download } from 'lucide-react';
import StatusCards from './StatusCards.jsx';
import LiveHologramAvatar from './LiveHologramAvatar.jsx';

export default function CenterHologramHUD({ avatarState, audioMetrics, onSettingsClick, onNotificationClick, onOpenCertDashboard }) {
  const isSpeaking = avatarState === 'SPEAKING';
  const { spectrum = [] } = audioMetrics || {};

  return (
    <div className="relative flex-1 h-full flex flex-col items-center justify-between px-8 pt-3 pb-0 select-none overflow-hidden">
      {/* Top Center Title HUD */}
      <div className="w-full flex items-center justify-between z-20 px-2">
        <div className="w-16"></div>
        <div className="text-center">
          <h2 className="text-sm font-bold tracking-[0.45em] text-slate-200 uppercase font-mono">
            J . A . R . V . I . S
          </h2>
          <p className="text-[9px] tracking-[0.25em] text-cyan-400/90 font-mono font-semibold mt-0.5">
            JUST A REALLY VERY INTELLIGENT SYSTEM
          </p>
        </div>
        {/* Top Controls & Direct Download Button */}
        <div className="absolute top-4 right-6 flex items-center gap-2 z-20">
          {/* Live System Status Diagnostic Button */}
          <button
            onClick={onOpenCertDashboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold shadow-[0_0_15px_rgba(0,229,255,0.2)] transition-all hover:scale-105"
            title="Buka Diagnostic Live Certification Dashboard"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>LIVE STATUS</span>
          </button>

          {/* Unduh Source ZIP Button */}
          <a
            href="/ultimateai-master-blueprint-source.zip"
            download="ultimateai-master-blueprint-source.zip"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 border border-blue-400/50 text-cyan-300 text-xs font-mono font-bold shadow-[0_0_15px_rgba(0,229,255,0.2)] transition-all hover:scale-105"
            title="Unduh seluruh source code proyek dalam format ZIP transparan"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>UNDUH SOURCE ZIP</span>
          </a>

          <button
            onClick={onNotificationClick}
            className="w-8 h-8 rounded-xl bg-slate-900/80 border border-slate-700/80 flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all"
            title="Live Activity Telemetry"
          >
            <Bell className="w-4 h-4" />
          </button>

          <button
            onClick={onSettingsClick}
            className="w-8 h-8 rounded-xl bg-slate-900/80 border border-slate-700/80 flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all"
            title="Control Center Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4 Status Cards HUD Overlay */}
      <StatusCards avatarState={avatarState} isSpeaking={isSpeaking} spectrum={spectrum} />

      {/* Main Holographic Centerpiece */}
      <div className="relative w-full max-w-xl flex-1 flex flex-col items-center justify-center -mt-2">
        {/* Hologram Header Title */}
        <div className="text-center mb-1 z-10">
          <h2 className="text-3xl font-black tracking-[0.25em] text-cyan-400 font-sans uppercase drop-shadow-[0_0_20px_rgba(0,229,255,0.9)]">
            J I N
          </h2>
          <p className="text-[10px] tracking-[0.3em] text-cyan-300/90 font-mono font-bold">
            ULTIMATE AI INTELLIGENCE
          </p>
        </div>

        {/* Live Hologram Avatar (Canvas Particles + SVG Orbit + genie-bg.png + Audio Reactive Pulse) */}
        <LiveHologramAvatar avatarState={avatarState} audioMetrics={audioMetrics} />
      </div>
    </div>
  );
}
