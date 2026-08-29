import React from 'react';
import { ArrowRight } from 'lucide-react';
import Hologram3DCanvas from './Hologram3DCanvas.jsx';

export default function CyberAppStudioGrid({ onSelectApp }) {
  const apps = [
    {
      id: 'IMAGE_STUDIO',
      title: 'IMAGE STUDIO',
      description: 'Create, edit, and generate stunning images with AI',
      colorHex: 0x00f2fe,
      theme: {
        border: 'border-cyan-500/40',
        text: 'text-cyan-400',
        glow: 'rgba(0, 242, 254, 0.5)',
        btnBg: 'bg-cyan-950/60 hover:bg-cyan-900/80 border-cyan-400/50 text-cyan-300'
      },
      actionPrompt: 'Buatkan konsep gambar visual futuristik resolusi tinggi.'
    },
    {
      id: 'DOCUMENT_STUDIO',
      title: 'DOCUMENT STUDIO',
      description: 'Create, edit, and manage documents intelligently',
      colorHex: 0xa855f7,
      theme: {
        border: 'border-purple-500/40',
        text: 'text-purple-400',
        glow: 'rgba(168, 85, 247, 0.5)',
        btnBg: 'bg-purple-950/60 hover:bg-purple-900/80 border-purple-400/50 text-purple-300'
      },
      actionPrompt: 'Analisis dokumen penelitian dan ekstraksi poin-poin penting.'
    },
    {
      id: 'DATA_LAB',
      title: 'DATA LAB',
      description: 'Analyze, visualize, and extract insights from any data',
      colorHex: 0x10b981,
      theme: {
        border: 'border-emerald-500/40',
        text: 'text-emerald-400',
        glow: 'rgba(16, 185, 129, 0.5)',
        btnBg: 'bg-emerald-950/60 hover:bg-emerald-900/80 border-emerald-400/50 text-emerald-300'
      },
      actionPrompt: 'Analisis kumpulan data statistik dan buatkan visualisasi metriknya.'
    },
    {
      id: 'CODE_LAB',
      title: 'CODE LAB',
      description: 'Write, debug, and optimize code with AI assistance',
      colorHex: 0xf59e0b,
      theme: {
        border: 'border-amber-500/40',
        text: 'text-amber-400',
        glow: 'rgba(245, 158, 11, 0.5)',
        btnBg: 'bg-amber-950/60 hover:bg-amber-900/80 border-amber-400/50 text-amber-300'
      },
      actionPrompt: 'Buatkan kode aplikasi interaktif lengkap yang siap dijalankan.'
    },
    {
      id: 'MEDIA_STUDIO',
      title: 'MEDIA STUDIO',
      description: 'Create, edit, and produce media content',
      colorHex: 0xec4899,
      theme: {
        border: 'border-pink-500/40',
        text: 'text-pink-400',
        glow: 'rgba(236, 72, 153, 0.5)',
        btnBg: 'bg-pink-950/60 hover:bg-pink-900/80 border-pink-400/50 text-pink-300'
      },
      actionPrompt: 'Tampilkan siaran live media berita dan streaming audio terkini.'
    },
    {
      id: 'KNOWLEDGE_LAB',
      title: 'KNOWLEDGE LAB',
      description: 'Deep research, multi-agent memory, and verified insights',
      colorHex: 0x0ea5e9,
      theme: {
        border: 'border-cyan-500/40',
        text: 'text-cyan-400',
        glow: 'rgba(56, 189, 248, 0.5)',
        btnBg: 'bg-cyan-950/60 hover:bg-cyan-900/80 border-cyan-400/50 text-cyan-300'
      },
      actionPrompt: 'Cari informasi dan telusuri sumber pengetahuan terverifikasi terkini.'
    }
  ];

  return (
    <div className="w-full flex-1 flex flex-col justify-between py-1 px-3 select-none overflow-y-auto custom-scrollbar">
      {/* Top Banner Header: 6 APPS AVAILABLE */}
      <div className="w-full flex items-center justify-center gap-3 mb-2 flex-shrink-0">
        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-cyan-500/40 to-cyan-400"></div>
        <div className="px-3 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/40 flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,242,254,0.25)]">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
          <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-cyan-300 uppercase">
            6 APPS AVAILABLE (REAL 3D HOLOGRAPHIC)
          </span>
        </div>
        <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-cyan-500/40 to-cyan-400"></div>
      </div>

      {/* 2x3 Grid of Interactive 3D WebGL Hologram Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-5xl mx-auto flex-1">
        {apps.map((app) => (
          <div
            key={app.id}
            onClick={() => onSelectApp(app)}
            className={`group relative rounded-2xl bg-[#080d1a]/85 border ${app.theme.border} p-3 flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] hover:bg-[#0b1326] cursor-pointer backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.6)] overflow-hidden`}
          >
            {/* Cyber Corner Accents */}
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-400/80 rounded-tl-sm"></div>
            <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan-400/80 rounded-tr-sm"></div>
            <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-400/80 rounded-bl-sm"></div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-400/80 rounded-br-sm"></div>

            {/* Ambient Background Energy Glow on Hover */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-25 transition-opacity duration-500 pointer-events-none rounded-2xl"
              style={{ background: `radial-gradient(circle at center, ${app.theme.glow} 0%, transparent 70%)` }}
            />

            {/* Top Text & Action */}
            <div className="z-10 flex-shrink-0">
              <h3 className={`text-xs font-mono font-black tracking-wider ${app.theme.text} uppercase flex items-center justify-between`}>
                <span>{app.title}</span>
                <span className="text-[9px] opacity-60 font-sans tracking-normal">3D CORE</span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                {app.description}
              </p>
              
              <button
                className={`mt-1.5 px-2 py-0.5 rounded-md border text-[10px] font-mono flex items-center gap-1 ${app.theme.btnBg} transition-all duration-200 group-hover:scale-105 shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
              >
                <span>OPEN</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Real 3D Interactive WebGL Hologram Canvas on Glowing Pedestal */}
            <div className="w-full flex items-center justify-center mt-1 z-0 group-hover:brightness-125 transition-all duration-300">
              <Hologram3DCanvas type={app.id} colorHex={app.colorHex} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
