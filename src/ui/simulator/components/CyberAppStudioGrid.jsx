import React from 'react';
import { ArrowRight } from 'lucide-react';
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
      glowShadow: 'rgba(0, 242, 254, 0.45)',
      actionPrompt: 'Buatkan konsep gambar visual futuristik resolusi tinggi.'
    },
    {
      id: 'DOCUMENT_STUDIO',
      title: 'DOCUMENT STUDIO',
      description: 'General document reading, summarization, and text analysis',
      colorHex: 0xa855f7,
      colorCss: '#a855f7',
      glowShadow: 'rgba(168, 85, 247, 0.45)',
      actionPrompt: 'Analisis dan ringkas naskah dokumen umum.'
    },
    {
      id: 'DATA_LAB',
      title: 'RISET LAB',
      description: 'Research documents, statistics, and deep data analytics',
      colorHex: 0x00e5ff,
      colorCss: '#00e5ff',
      glowShadow: 'rgba(0, 229, 255, 0.45)',
      actionPrompt: 'Analisis dokumen riset dan kumpulan data statistik.'
    },
    {
      id: 'CODE_LAB',
      title: 'CODE LAB',
      description: 'Write, debug, and optimize code with AI assistance',
      colorHex: 0xf59e0b,
      colorCss: '#f59e0b',
      glowShadow: 'rgba(245, 158, 11, 0.45)',
      actionPrompt: 'Buatkan kode aplikasi interaktif lengkap yang siap dijalankan.'
    },
    {
      id: 'MEDIA_STUDIO',
      title: 'MEDIA STUDIO',
      description: 'Create, edit, and produce media content',
      colorHex: 0xec4899,
      colorCss: '#ec4899',
      glowShadow: 'rgba(236, 72, 153, 0.45)',
      actionPrompt: 'Tampilkan siaran live media berita dan streaming audio terkini.'
    },
    {
      id: 'KNOWLEDGE_LAB',
      title: 'NON RISET LAB',
      description: 'General document analysis: economic news, government decree (SK), policy & legal docs',
      colorHex: 0x00f2fe,
      colorCss: '#00f2fe',
      glowShadow: 'rgba(0, 242, 254, 0.45)',
      actionPrompt: 'Analisis dokumen general: berita ekonomi, SK Pemerintah, kebijakan, dan regulasi.'
    }
  ];

  return (
    <div className="w-full flex-1 flex flex-col justify-start items-center pt-1 px-3 select-none overflow-y-auto custom-scrollbar">
      {/* Top Banner Header */}
      <div className="w-full flex items-center justify-center gap-3 mb-1 flex-shrink-0">
        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-cyan-500/40 to-cyan-400"></div>
        <div className="px-4 py-0.5 rounded-full bg-gradient-to-r from-cyan-950/70 via-slate-900/80 to-cyan-950/70 border border-cyan-400/40 flex items-center gap-2 shadow-[0_0_15px_rgba(0,242,254,0.3),inset_0_1px_2px_rgba(255,255,255,0.3)] backdrop-blur-xl">
          <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f2fe] animate-pulse"></span>
          <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-cyan-200 uppercase drop-shadow-[0_0_8px_rgba(0,242,254,0.6)]">
            6 APPS AVAILABLE â€¢ 3D CYBER-CRYSTAL PODS
          </span>
        </div>
        <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-cyan-500/40 to-cyan-400"></div>
      </div>

      {/* 2x3 Grid of Exact Futuristic 3D Crystal Spheres (Bola Kristal - Top Aligned) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 sm:gap-x-14 lg:gap-x-16 gap-y-3 sm:gap-y-4 lg:gap-y-5 w-full max-w-[1550px] mx-auto items-center justify-center px-4 py-0.5">
        {apps.map((app) => (
          <button
            type="button"
            key={app.id}
            onClick={() => onSelectApp(app)}
            style={{
              '--hud-color': app.colorCss,
              '--hud-border-inner': `${app.colorCss}50`
            }}
            className="group relative w-full aspect-square max-w-[340px] sm:max-w-[380px] lg:max-w-[410px] mx-auto rounded-full flex flex-col items-center justify-between p-6 cursor-pointer transition-all duration-300 hover:scale-[1.06] active:scale-[0.98] bg-transparent border-none outline-none z-30"
          >
            {/* 1. Outer Holographic Crystal Ball Glass Sphere (Bola Kristal) */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none z-10 transition-all duration-300 group-hover:scale-105"
              style={{
                border: `2.5px solid ${app.colorCss}90`,
                boxShadow: `0 0 35px ${app.colorCss}60, inset 0 0 35px ${app.colorCss}25, 0 10px 40px rgba(0,0,0,0.8)`
              }}
            >
              {/* Secondary Outer Thin Glass Orbit Rim */}
              <div
                className="absolute inset-[-6px] rounded-full border border-dashed opacity-40 group-hover:opacity-75 transition-opacity duration-300"
                style={{ borderColor: app.colorCss }}
              />

              {/* Top-Left Specular Crystal Glare Reflection Arc */}
              <div className="absolute top-4 left-6 w-32 h-16 rounded-[50%] bg-gradient-to-b from-white/70 via-white/15 to-transparent rotate-[-30deg] filter blur-[1.5px] pointer-events-none" />

              {/* Top Sharp Hotspot Sparkle */}
              <div className="absolute top-7 left-10 w-4 h-4 rounded-full bg-white/90 filter blur-[2px] shadow-[0_0_12px_#ffffff]" />

              {/* Bottom Internal Light Refraction Arc */}
              <div
                className="absolute bottom-3 left-8 right-8 h-12 rounded-full opacity-60 filter blur-md"
                style={{ background: `radial-gradient(ellipse at center, ${app.colorCss} 0%, transparent 75%)` }}
              />

              {/* Spherical Inner Edge Shadow */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  boxShadow: `inset 0 0 30px rgba(0,0,0,0.6), inset 0 0 15px ${app.colorCss}30`
                }}
              />
            </div>

            {/* 2. Center Stage: Inside the Crystal Ball (Enlarged 3D Hologram & Floating WebGL Mesh) */}
            <div className="relative w-full h-[75%] flex items-center justify-center pointer-events-none z-20 my-auto scale-115">
              {/* Outer Quantum Sparks Dust */}
              <OuterOrbitalDustCanvas colorHex={app.colorCss} />

              {/* Hologram Base Projector Radial Glow Aura */}
              <div
                className="absolute bottom-1 w-40 h-10 rounded-full opacity-60 group-hover:opacity-90 transition-opacity duration-300 filter blur-lg"
                style={{ background: `radial-gradient(ellipse, ${app.glowShadow} 0%, transparent 70%)` }}
              />

              {/* 3D Interactive WebGL Holographic Stage & Crystal Mesh */}
              <div className="w-full h-full flex items-center justify-center pointer-events-none group-hover:brightness-125 transition-all duration-300">
                <Hologram3DCanvas type={app.id} colorHex={app.colorHex} />
              </div>
            </div>

            {/* 3. Pure Floating Text Label */}
            <div className="relative z-30 w-full text-center px-2 pointer-events-none mt-auto pb-1">
              <h3
                className="text-xs sm:text-[13px] font-mono font-black tracking-wider uppercase drop-shadow-[0_0_14px_currentColor]"
                style={{ color: app.colorCss }}
              >
                {app.title}
              </h3>
              <p className="text-[9px] sm:text-[10px] text-slate-300/80 font-sans truncate mt-0.5">
                {app.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
