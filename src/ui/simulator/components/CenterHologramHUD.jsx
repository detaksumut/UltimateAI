import React from 'react';
import { Bell, Settings, Download, Cpu, ShieldCheck, Volume2 } from 'lucide-react';
import StatusCards from './StatusCards.jsx';
import { textToSpeechInstance } from '../../../services/voice/TextToSpeech.js';

export default function CenterHologramHUD({ avatarState, audioMetrics, onSettingsClick, onNotificationClick, onOpenCertDashboard }) {
  const isSpeaking = avatarState === 'SPEAKING';
  const { spectrum = [] } = audioMetrics || {};

  const handleTestAudio = () => {
    textToSpeechInstance.testVoiceAudio();
  };

  return (
    <div className="relative flex-1 h-full flex flex-col items-center justify-between px-6 pt-3 pb-0 select-none overflow-hidden">
      {/* Top Header Bar with Grid to Prevent Any Text Overlapping */}
      <div className="w-full grid grid-cols-3 items-center z-20 px-2 py-1 border-b border-cyan-500/15 pb-2">
        {/* Left: System Badge */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-[10px] font-mono text-cyan-300">
            <Cpu className="w-3 h-3 text-cyan-400" />
            <span className="font-bold">9ROUTER v2.0</span>
          </span>
          <span className="hidden sm:inline-block text-[9px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
            ● ONLINE
          </span>
        </div>

        {/* Center: Clean Cyber Sub-Title */}
        <div className="text-center flex flex-col items-center justify-center">
          <div className="text-[11px] font-mono font-bold tracking-[0.35em] text-slate-300 uppercase">
            J . I . N &nbsp; C O R E
          </div>
          <div className="text-[8px] font-mono tracking-[0.2em] text-cyan-400/80 uppercase">
            AUTONOMOUS CYBER-HUD
          </div>
        </div>

        {/* Right: Top Controls & Direct Download Button */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2">
          {/* Test Suara Audio Speaker Button */}
          <button
            onClick={handleTestAudio}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-950/50 hover:bg-purple-900/70 border border-purple-500/40 text-purple-300 text-[10px] sm:text-[11px] font-mono font-bold shadow-[0_0_12px_rgba(168,85,247,0.2)] transition-all hover:scale-105"
            title="Klik untuk menguji speaker suara JIN secara langsung"
          >
            <Volume2 className="w-3 h-3 text-purple-400" />
            <span>TEST SUARA</span>
          </button>

          {/* Live System Status Diagnostic Button */}
          <button
            onClick={onOpenCertDashboard}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-950/50 hover:bg-cyan-900/70 border border-cyan-500/40 text-cyan-300 text-[10px] sm:text-[11px] font-mono font-bold shadow-[0_0_12px_rgba(0,229,255,0.2)] transition-all hover:scale-105"
            title="Buka Diagnostic Live Certification Dashboard"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>LIVE STATUS</span>
          </button>

          {/* Unduh Source ZIP Button */}
          <a
            href="/ultimateai-master-blueprint-source.zip"
            download="ultimateai-master-blueprint-source.zip"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 border border-blue-400/50 text-cyan-300 text-[11px] font-mono font-bold shadow-[0_0_12px_rgba(0,229,255,0.2)] transition-all hover:scale-105"
            title="Unduh seluruh source code proyek dalam format ZIP transparan"
          >
            <Download className="w-3 h-3 text-cyan-400" />
            <span className="hidden md:inline">SOURCE ZIP</span>
          </a>

          <button
            onClick={onNotificationClick}
            className="w-7 h-7 rounded-lg bg-slate-900/80 border border-slate-700/80 flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all"
            title="Live Activity Telemetry"
          >
            <Bell className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onSettingsClick}
            className="w-7 h-7 rounded-lg bg-slate-900/80 border border-slate-700/80 flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all"
            title="Control Center Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4 Status Cards HUD Overlay */}
      <StatusCards avatarState={avatarState} isSpeaking={isSpeaking} spectrum={spectrum} />

      {/* Main Cyber Command Telemetry & Intelligence Mission Control */}
      <div className="relative w-full max-w-2xl flex-1 flex flex-col items-center justify-center px-4 py-2">
        <div className="w-full bg-slate-950/40 border border-cyan-500/20 rounded-2xl p-4 sm:p-6 backdrop-blur-md shadow-[0_0_30px_rgba(0,229,255,0.06)] flex flex-col items-center justify-center text-center relative overflow-hidden">
          {/* Subtle Cyber Grid Background */}
          <div className="absolute inset-0 bg-[radial-gradient(#00e5ff_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none"></div>

          <div className="flex items-center gap-2 mb-2 z-10">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#00e5ff] animate-pulse"></span>
            <span className="text-xs font-mono font-bold tracking-[0.25em] text-cyan-300 uppercase">
              AUTONOMOUS MISSION CONTROL
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-wider text-white font-sans uppercase mb-2 z-10">
            UltimateAI Multi-Agent System
          </h2>

          <p className="text-xs text-slate-400 max-w-lg leading-relaxed z-10">
            Sistem orkestrasi kecerdasan terpadu dengan 9Router v2.0, deteksi instan dokumen 70+ halaman, dan pipeline data analitis visual. JIN aktif di pojok kanan atas.
          </p>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-md mt-4 z-10 text-[10px] font-mono">
            <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/30 flex flex-col items-center">
              <span className="text-slate-400">ROUTER</span>
              <span className="text-cyan-300 font-bold mt-0.5">9ROUTER v2.0</span>
            </div>
            <div className="p-2 rounded-lg bg-purple-950/30 border border-purple-500/30 flex flex-col items-center">
              <span className="text-slate-400">SPEECH GATE</span>
              <span className="text-purple-300 font-bold mt-0.5">ACTIVE</span>
            </div>
            <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30 flex flex-col items-center">
              <span className="text-slate-400">STATUS</span>
              <span className="text-emerald-300 font-bold mt-0.5">{avatarState || 'READY'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
