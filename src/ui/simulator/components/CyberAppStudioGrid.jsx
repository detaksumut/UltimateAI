import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import Hologram3DCanvas from './Hologram3DCanvas.jsx';

export default function CyberAppStudioGrid({ onSelectApp }) {
  const apps = [
    {
      id: 'IMAGE_STUDIO',
      title: 'IMAGE STUDIO',
      description: 'Create, edit, and generate stunning images with AI',
      colorHex: 0x00f2fe,
      theme: {
        border: 'hover:border-cyan-400/90 group-hover:shadow-[0_0_30px_rgba(0,242,254,0.35)]',
        text: 'text-cyan-300',
        glow: 'rgba(0, 242, 254, 0.4)',
        cornerColor: 'border-cyan-400',
        badge: 'text-cyan-300 bg-cyan-950/60 border-cyan-400/40',
        btnBg: 'bg-cyan-500/15 hover:bg-cyan-500/30 border-cyan-400/50 text-cyan-200'
      },
      actionPrompt: 'Buatkan konsep gambar visual futuristik resolusi tinggi.'
    },
    {
      id: 'DOCUMENT_STUDIO',
      title: 'DOCUMENT STUDIO',
      description: 'Create, edit, and manage documents intelligently',
      colorHex: 0xa855f7,
      theme: {
        border: 'hover:border-purple-400/90 group-hover:shadow-[0_0_30px_rgba(168,85,247,0.35)]',
        text: 'text-purple-300',
        glow: 'rgba(168, 85, 247, 0.4)',
        cornerColor: 'border-purple-400',
        badge: 'text-purple-300 bg-purple-950/60 border-purple-400/40',
        btnBg: 'bg-purple-500/15 hover:bg-purple-500/30 border-purple-400/50 text-purple-200'
      },
      actionPrompt: 'Analisis dokumen penelitian dan ekstraksi poin-poin penting.'
    },
    {
      id: 'DATA_LAB',
      title: 'DATA LAB',
      description: 'Analyze, visualize, and extract insights from any data',
      colorHex: 0x10b981,
      theme: {
        border: 'hover:border-emerald-400/90 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.35)]',
        text: 'text-emerald-300',
        glow: 'rgba(16, 185, 129, 0.4)',
        cornerColor: 'border-emerald-400',
        badge: 'text-emerald-300 bg-emerald-950/60 border-emerald-400/40',
        btnBg: 'bg-emerald-500/15 hover:bg-emerald-500/30 border-emerald-400/50 text-emerald-200'
      },
      actionPrompt: 'Analisis kumpulan data statistik dan buatkan visualisasi metriknya.'
    },
    {
      id: 'CODE_LAB',
      title: 'CODE LAB',
      description: 'Write, debug, and optimize code with AI assistance',
      colorHex: 0xf59e0b,
      theme: {
        border: 'hover:border-amber-400/90 group-hover:shadow-[0_0_30px_rgba(245,158,11,0.35)]',
        text: 'text-amber-300',
        glow: 'rgba(245, 158, 11, 0.4)',
        cornerColor: 'border-amber-400',
        badge: 'text-amber-300 bg-amber-950/60 border-amber-400/40',
        btnBg: 'bg-amber-500/15 hover:bg-amber-500/30 border-amber-400/50 text-amber-200'
      },
      actionPrompt: 'Buatkan kode aplikasi interaktif lengkap yang siap dijalankan.'
    },
    {
      id: 'MEDIA_STUDIO',
      title: 'MEDIA STUDIO',
      description: 'Create, edit, and produce media content',
      colorHex: 0xec4899,
      theme: {
        border: 'hover:border-pink-400/90 group-hover:shadow-[0_0_30px_rgba(236,72,153,0.35)]',
        text: 'text-pink-300',
        glow: 'rgba(236, 72, 153, 0.4)',
        cornerColor: 'border-pink-400',
        badge: 'text-pink-300 bg-pink-950/60 border-pink-400/40',
        btnBg: 'bg-pink-500/15 hover:bg-pink-500/30 border-pink-400/50 text-pink-200'
      },
      actionPrompt: 'Tampilkan siaran live media berita dan streaming audio terkini.'
    },
    {
      id: 'KNOWLEDGE_LAB',
      title: 'KNOWLEDGE LAB',
      description: 'Deep research, multi-agent memory, and verified insights',
      colorHex: 0x0ea5e9,
      theme: {
        border: 'hover:border-sky-400/90 group-hover:shadow-[0_0_30px_rgba(14,165,233,0.35)]',
        text: 'text-sky-300',
        glow: 'rgba(14, 165, 233, 0.4)',
        cornerColor: 'border-sky-400',
        badge: 'text-sky-300 bg-sky-950/60 border-sky-400/40',
        btnBg: 'bg-sky-500/15 hover:bg-sky-500/30 border-sky-400/50 text-sky-200'
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
            6 APPS AVAILABLE • 3D CRYSTAL STUDIO
          </span>
        </div>
        <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-cyan-500/40 to-cyan-400"></div>
      </div>

      {/* 2x3 Grid of Ultra-Luxurious Crystal Faceted 3D Hologram Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 w-full max-w-5xl mx-auto flex-1">
        {apps.map((app) => (
          <div
            key={app.id}
            onClick={() => onSelectApp(app)}
            className={`group relative rounded-2xl bg-gradient-to-br from-white/[0.12] via-slate-900/50 to-slate-950/80 border border-white/20 ${app.theme.border} p-3.5 flex flex-col justify-between transition-all duration-500 hover:scale-[1.03] hover:-translate-y-1 cursor-pointer backdrop-blur-3xl shadow-[0_12px_40px_rgba(0,0,0,0.65),inset_0_1.5px_2px_rgba(255,255,255,0.35),inset_0_-1.5px_2px_rgba(0,0,0,0.5)] overflow-hidden`}
          >
            {/* Prismatic Crystal Sheen Diagonal Reflection Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.03)_35%,transparent_65%)] pointer-events-none rounded-2xl"></div>
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/70 to-transparent pointer-events-none"></div>

            {/* Faceted Crystal Corner Brackets */}
            <div className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-white/60 group-hover:${app.theme.cornerColor} transition-colors rounded-tl-md shadow-[0_0_8px_rgba(255,255,255,0.4)]`}></div>
            <div className={`absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-white/60 group-hover:${app.theme.cornerColor} transition-colors rounded-tr-md shadow-[0_0_8px_rgba(255,255,255,0.4)]`}></div>
            <div className={`absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-white/40 group-hover:${app.theme.cornerColor} transition-colors rounded-bl-md`}></div>
            <div className={`absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-white/40 group-hover:${app.theme.cornerColor} transition-colors rounded-br-md`}></div>

            {/* Ambient Internal Crystal Glow on Hover */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-35 transition-opacity duration-500 pointer-events-none rounded-2xl"
              style={{ background: `radial-gradient(circle at center, ${app.theme.glow} 0%, transparent 75%)` }}
            />

            {/* Top Text Header & Crystal Action Button */}
            <div className="z-10 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className={`text-xs font-mono font-black tracking-wider ${app.theme.text} uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]`}>
                  {app.title}
                </h3>
                <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border backdrop-blur-md ${app.theme.badge}`}>
                  3D CRYSTAL
                </span>
              </div>

              <p className="text-[10px] text-slate-300 mt-1 leading-snug drop-shadow-sm font-sans">
                {app.description}
              </p>
              
              <button
                className={`mt-2 px-2.5 py-1 rounded-lg border border-white/30 ${app.theme.btnBg} text-[10px] font-mono font-bold flex items-center gap-1.5 backdrop-blur-md shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.4)] transition-all duration-300 group-hover:scale-105`}
              >
                <span>OPEN STUDIO</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Real 3D Interactive WebGL Hologram Canvas Inside Crystal Box */}
            <div className="w-full flex items-center justify-center mt-1 z-0 group-hover:brightness-125 transition-all duration-300">
              <Hologram3DCanvas type={app.id} colorHex={app.colorHex} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
