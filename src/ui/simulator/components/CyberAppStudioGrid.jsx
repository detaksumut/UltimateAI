import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import Hologram3DCanvas from './Hologram3DCanvas.jsx';
import OuterOrbitalDustCanvas from './OuterOrbitalDustCanvas.jsx';

export default function CyberAppStudioGrid({ onSelectApp }) {
  const apps = [
    {
      id: 'IMAGE_STUDIO',
      title: 'IMAGE STUDIO',
      description: 'Create, edit, and generate stunning images with AI',
      colorHex: 0x00f2fe,
      colorCss: '#00f2fe',
      theme: {
        orbBorder: 'border-cyan-400/50 group-hover:border-cyan-300',
        text: 'text-cyan-300',
        glow: 'rgba(0, 242, 254, 0.45)',
        ringColor: 'border-cyan-400/60',
        badge: 'text-cyan-300 bg-cyan-950/60 border-cyan-400/40',
        btnBg: 'bg-cyan-500/20 hover:bg-cyan-500/35 border-cyan-400/50 text-cyan-200 shadow-[0_0_15px_rgba(0,242,254,0.3)]'
      },
      actionPrompt: 'Buatkan konsep gambar visual futuristik resolusi tinggi.'
    },
    {
      id: 'DOCUMENT_STUDIO',
      title: 'DOCUMENT STUDIO',
      description: 'Create, edit, and manage documents intelligently',
      colorHex: 0xa855f7,
      colorCss: '#a855f7',
      theme: {
        orbBorder: 'border-purple-400/50 group-hover:border-purple-300',
        text: 'text-purple-300',
        glow: 'rgba(168, 85, 247, 0.45)',
        ringColor: 'border-purple-400/60',
        badge: 'text-purple-300 bg-purple-950/60 border-purple-400/40',
        btnBg: 'bg-purple-500/20 hover:bg-purple-500/35 border-purple-400/50 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
      },
      actionPrompt: 'Analisis dokumen penelitian dan ekstraksi poin-poin penting.'
    },
    {
      id: 'DATA_LAB',
      title: 'DATA LAB',
      description: 'Analyze, visualize, and extract insights from any data',
      colorHex: 0x10b981,
      colorCss: '#10b981',
      theme: {
        orbBorder: 'border-emerald-400/50 group-hover:border-emerald-300',
        text: 'text-emerald-300',
        glow: 'rgba(16, 185, 129, 0.45)',
        ringColor: 'border-emerald-400/60',
        badge: 'text-emerald-300 bg-emerald-950/60 border-emerald-400/40',
        btnBg: 'bg-emerald-500/20 hover:bg-emerald-500/35 border-emerald-400/50 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
      },
      actionPrompt: 'Analisis kumpulan data statistik dan buatkan visualisasi metriknya.'
    },
    {
      id: 'CODE_LAB',
      title: 'CODE LAB',
      description: 'Write, debug, and optimize code with AI assistance',
      colorHex: 0xf59e0b,
      colorCss: '#f59e0b',
      theme: {
        orbBorder: 'border-amber-400/50 group-hover:border-amber-300',
        text: 'text-amber-300',
        glow: 'rgba(245, 158, 11, 0.45)',
        ringColor: 'border-amber-400/60',
        badge: 'text-amber-300 bg-amber-950/60 border-amber-400/40',
        btnBg: 'bg-amber-500/20 hover:bg-amber-500/35 border-amber-400/50 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
      },
      actionPrompt: 'Buatkan kode aplikasi interaktif lengkap yang siap dijalankan.'
    },
    {
      id: 'MEDIA_STUDIO',
      title: 'MEDIA STUDIO',
      description: 'Create, edit, and produce media content',
      colorHex: 0xec4899,
      colorCss: '#ec4899',
      theme: {
        orbBorder: 'border-pink-400/50 group-hover:border-pink-300',
        text: 'text-pink-300',
        glow: 'rgba(236, 72, 153, 0.45)',
        ringColor: 'border-pink-400/60',
        badge: 'text-pink-300 bg-pink-950/60 border-pink-400/40',
        btnBg: 'bg-pink-500/20 hover:bg-pink-500/35 border-pink-400/50 text-pink-200 shadow-[0_0_15px_rgba(236,72,153,0.3)]'
      },
      actionPrompt: 'Tampilkan siaran live media berita dan streaming audio terkini.'
    },
    {
      id: 'KNOWLEDGE_LAB',
      title: 'KNOWLEDGE LAB',
      description: 'Deep research, multi-agent memory, and verified insights',
      colorHex: 0x0ea5e9,
      colorCss: '#0ea5e9',
      theme: {
        orbBorder: 'border-sky-400/50 group-hover:border-sky-300',
        text: 'text-sky-300',
        glow: 'rgba(14, 165, 233, 0.45)',
        ringColor: 'border-sky-400/60',
        badge: 'text-sky-300 bg-sky-950/60 border-sky-400/40',
        btnBg: 'bg-sky-500/20 hover:bg-sky-500/35 border-sky-400/50 text-sky-200 shadow-[0_0_15px_rgba(14,165,233,0.3)]'
      },
      actionPrompt: 'Cari informasi dan telusuri sumber pengetahuan terverifikasi terkini.'
    }
  ];

  return (
    <div className="w-full flex-1 flex flex-col justify-between py-1 px-3 select-none overflow-y-auto custom-scrollbar">
      {/* Top Banner Header: 6 APPS AVAILABLE */}
      <div className="w-full flex items-center justify-center gap-3 mb-2 flex-shrink-0">
        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-cyan-500/40 to-cyan-400"></div>
        <div className="px-4 py-1 rounded-full bg-gradient-to-r from-cyan-950/70 via-slate-900/80 to-cyan-950/70 border border-cyan-400/40 flex items-center gap-2 shadow-[0_0_15px_rgba(0,242,254,0.3),inset_0_1px_2px_rgba(255,255,255,0.3)] backdrop-blur-xl">
          <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f2fe] animate-pulse"></span>
          <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-cyan-200 uppercase drop-shadow-[0_0_8px_rgba(0,242,254,0.6)]">
            6 APPS AVAILABLE • 3D CRYSTAL ORBS
          </span>
        </div>
        <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-cyan-500/40 to-cyan-400"></div>
      </div>

      {/* 2x3 Grid of Luminous 3D Crystal Spheres with Swirling Outer Orbital Dust */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-5xl mx-auto flex-1">
        {apps.map((app) => (
          <div
            key={app.id}
            onClick={() => onSelectApp(app)}
            className="group relative flex flex-col items-center justify-between p-2 cursor-pointer transition-all duration-500 hover:scale-105"
          >
            {/* Top Text Header Badge */}
            <div className="w-full flex items-center justify-between px-2 z-10 flex-shrink-0">
              <h3 className={`text-xs font-mono font-black tracking-wider ${app.theme.text} uppercase drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]`}>
                {app.title}
              </h3>
              <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-full border backdrop-blur-md ${app.theme.badge}`}>
                CRYSTAL ORB
              </span>
            </div>

            {/* Main Spherical 3D Crystal Ball / Bola Kristal Container with Outer Orbital Dust */}
            <div className="relative w-44 h-44 sm:w-48 sm:h-48 my-1 flex items-center justify-center">
              {/* 3D Swirling Outer Orbital Dust Cloud Canvas */}
              <OuterOrbitalDustCanvas colorHex={app.colorCss} />

              {/* Outer Pulsing Orbital Halo */}
              <div
                className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-40 transition-opacity duration-500 pointer-events-none filter blur-xl"
                style={{ background: `radial-gradient(circle, ${app.theme.glow} 0%, transparent 70%)` }}
              />

              {/* Equatorial Cyber Ring around the Orb */}
              <div className={`absolute inset-[-6px] rounded-full border border-dashed ${app.theme.ringColor} opacity-50 group-hover:opacity-100 transition-all duration-700 animate-spin`} style={{ animationDuration: '20s' }}></div>
              <div className="absolute inset-[-12px] rounded-full border border-white/10 opacity-30 group-hover:opacity-60 transition-opacity"></div>

              {/* The Crystal Glass Sphere Body */}
              <div
                className={`relative w-full h-full rounded-full border-2 ${app.theme.orbBorder} bg-gradient-to-br from-white/15 via-slate-900/60 to-black/80 backdrop-blur-2xl shadow-[0_15px_45px_rgba(0,0,0,0.85),inset_0_6px_14px_rgba(255,255,255,0.45),inset_0_-8px_20px_rgba(0,0,0,0.8)] overflow-hidden flex items-center justify-center transition-all duration-500 z-10`}
              >
                {/* Spherical Glare Lens Specular Reflection (Top-Left Curved Light) */}
                <div className="absolute top-2 left-3 w-16 h-10 rounded-full bg-gradient-to-br from-white/70 via-white/20 to-transparent transform -rotate-45 pointer-events-none blur-[1px]"></div>
                {/* Secondary Lower Refraction Glow */}
                <div className="absolute bottom-2 right-4 w-12 h-6 rounded-full bg-gradient-to-tl from-white/30 via-white/5 to-transparent transform -rotate-15 pointer-events-none"></div>

                {/* Real 3D Interactive WebGL Hologram Suspended Inside the Crystal Orb */}
                <div className="w-full h-full flex items-center justify-center z-10 group-hover:brightness-125 transition-all duration-300">
                  <Hologram3DCanvas type={app.id} colorHex={app.colorHex} />
                </div>
              </div>
            </div>

            {/* Bottom Subtitle & Crystal Action Pill Button */}
            <div className="w-full flex flex-col items-center gap-1 z-10 flex-shrink-0 px-2 text-center">
              <p className="text-[10px] text-slate-300 leading-tight drop-shadow-sm font-sans line-clamp-1">
                {app.description}
              </p>

              <button
                className={`mt-1 px-4 py-1 rounded-full border ${app.theme.btnBg} text-[10px] font-mono font-bold flex items-center gap-1.5 backdrop-blur-md transition-all duration-300 group-hover:scale-105`}
              >
                <span>OPEN ORB</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
