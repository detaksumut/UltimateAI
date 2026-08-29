import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function CyberAppStudioGrid({ onSelectApp }) {
  const apps = [
    {
      id: 'IMAGE_STUDIO',
      title: 'IMAGE STUDIO',
      description: 'Create, edit, and generate stunning images with AI',
      color: 'cyan',
      theme: {
        border: 'border-cyan-500/40',
        text: 'text-cyan-400',
        glow: 'rgba(0, 242, 254, 0.5)',
        btnBg: 'bg-cyan-950/60 hover:bg-cyan-900/80 border-cyan-400/50 text-cyan-300',
        badge: 'text-cyan-400'
      },
      actionPrompt: 'Buatkan konsep gambar visual futuristik resolusi tinggi.',
      svgArt: (
        <svg viewBox="0 0 200 160" className="w-full h-32 select-none pointer-events-none">
          <defs>
            <linearGradient id="grad-mountain" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#0052cc" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#00f2fe" stopOpacity="0.9" />
            </linearGradient>
            <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 3D Wireframe Mountain Peaks */}
          <polygon points="100,20 60,110 140,110" fill="url(#grad-mountain)" stroke="#00f2fe" strokeWidth="1.2" filter="url(#glow-cyan)" />
          <polygon points="100,20 100,110 140,110" fill="none" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3 3" />
          <polygon points="65,45 35,115 95,115" fill="none" stroke="#0284c7" strokeWidth="1" />
          <polygon points="135,45 105,115 165,115" fill="none" stroke="#00f2fe" strokeWidth="1" />
          
          {/* Internal Wireframe Grid Lines */}
          <line x1="100" y1="20" x2="80" y2="110" stroke="#38bdf8" strokeWidth="0.8" />
          <line x1="100" y1="20" x2="120" y2="110" stroke="#38bdf8" strokeWidth="0.8" />
          <line x1="80" y1="65" x2="120" y2="65" stroke="#00f2fe" strokeWidth="0.8" strokeDasharray="2 2" />
          <line x1="70" y1="90" x2="130" y2="90" stroke="#00f2fe" strokeWidth="0.8" strokeDasharray="2 2" />

          {/* Floating Neon Crystal Vertices */}
          <circle cx="100" cy="20" r="3" fill="#ffffff" filter="url(#glow-cyan)" />
          <circle cx="65" cy="45" r="2" fill="#00f2fe" />
          <circle cx="135" cy="45" r="2" fill="#00f2fe" />

          {/* Holographic Glowing Pedestal */}
          <ellipse cx="100" cy="125" rx="75" ry="14" fill="none" stroke="#00f2fe" strokeWidth="1.5" filter="url(#glow-cyan)" />
          <ellipse cx="100" cy="130" rx="60" ry="10" fill="rgba(0,242,254,0.12)" stroke="#38bdf8" strokeWidth="1" strokeDasharray="6 4" />
          <ellipse cx="100" cy="135" rx="40" ry="6" fill="none" stroke="#0052cc" strokeWidth="1.5" />
          <ellipse cx="100" cy="125" rx="20" ry="3" fill="#00f2fe" filter="url(#glow-cyan)" />
        </svg>
      )
    },
    {
      id: 'DOCUMENT_STUDIO',
      title: 'DOCUMENT STUDIO',
      description: 'Create, edit, and manage documents intelligently',
      color: 'purple',
      theme: {
        border: 'border-purple-500/40',
        text: 'text-purple-400',
        glow: 'rgba(168, 85, 247, 0.5)',
        btnBg: 'bg-purple-950/60 hover:bg-purple-900/80 border-purple-400/50 text-purple-300',
        badge: 'text-purple-400'
      },
      actionPrompt: 'Analisis dokumen penelitian dan ekstraksi poin-poin penting.',
      svgArt: (
        <svg viewBox="0 0 200 160" className="w-full h-32 select-none pointer-events-none">
          <defs>
            <linearGradient id="grad-doc" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#c084fc" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#6b21a8" stopOpacity="0.05" />
            </linearGradient>
            <filter id="glow-purple" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 3D Hologram Clipboard Document */}
          <rect x="68" y="24" width="64" height="85" rx="6" fill="url(#grad-doc)" stroke="#a855f7" strokeWidth="1.4" filter="url(#glow-purple)" />
          {/* Top Clipboard Clip */}
          <rect x="85" y="18" width="30" height="10" rx="3" fill="#3b0764" stroke="#c084fc" strokeWidth="1.2" />
          
          {/* Text and chart lines inside document */}
          <line x1="78" y1="38" x2="105" y2="38" stroke="#e9d5ff" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="78" y1="46" x2="122" y2="46" stroke="#c084fc" strokeWidth="1" strokeDasharray="3 2" />
          <line x1="78" y1="53" x2="118" y2="53" stroke="#c084fc" strokeWidth="1" strokeDasharray="3 2" />
          <line x1="78" y1="60" x2="110" y2="60" stroke="#c084fc" strokeWidth="1" strokeDasharray="3 2" />

          {/* Mini Bar Chart inside document */}
          <line x1="78" y1="88" x2="78" y2="78" stroke="#a855f7" strokeWidth="3" strokeLinecap="round" />
          <line x1="86" y1="88" x2="86" y2="72" stroke="#c084fc" strokeWidth="3" strokeLinecap="round" />
          <line x1="94" y1="88" x2="94" y2="68" stroke="#e9d5ff" strokeWidth="3" strokeLinecap="round" />
          <line x1="102" y1="88" x2="102" y2="75" stroke="#a855f7" strokeWidth="3" strokeLinecap="round" />
          <line x1="110" y1="88" x2="110" y2="82" stroke="#c084fc" strokeWidth="3" strokeLinecap="round" />

          {/* Floating Cyber Stylus Pen */}
          <line x1="140" y1="35" x2="115" y2="85" stroke="#c084fc" strokeWidth="2.5" strokeLinecap="round" filter="url(#glow-purple)" />
          <polygon points="113,88 116,84 119,87" fill="#ffffff" />

          {/* Holographic Glowing Pedestal */}
          <ellipse cx="100" cy="125" rx="75" ry="14" fill="none" stroke="#a855f7" strokeWidth="1.5" filter="url(#glow-purple)" />
          <ellipse cx="100" cy="130" rx="60" ry="10" fill="rgba(168,85,247,0.12)" stroke="#c084fc" strokeWidth="1" strokeDasharray="6 4" />
          <ellipse cx="100" cy="135" rx="40" ry="6" fill="none" stroke="#581c87" strokeWidth="1.5" />
          <ellipse cx="100" cy="125" rx="20" ry="3" fill="#a855f7" filter="url(#glow-purple)" />
        </svg>
      )
    },
    {
      id: 'DATA_LAB',
      title: 'DATA LAB',
      description: 'Analyze, visualize, and extract insights from any data',
      color: 'teal',
      theme: {
        border: 'border-emerald-500/40',
        text: 'text-emerald-400',
        glow: 'rgba(16, 185, 129, 0.5)',
        btnBg: 'bg-emerald-950/60 hover:bg-emerald-900/80 border-emerald-400/50 text-emerald-300',
        badge: 'text-emerald-400'
      },
      actionPrompt: 'Analisis kumpulan data statistik dan buatkan visualisasi metriknya.',
      svgArt: (
        <svg viewBox="0 0 200 160" className="w-full h-32 select-none pointer-events-none">
          <defs>
            <filter id="glow-teal" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 3D Holographic Bar Columns on Pedestal */}
          <rect x="70" y="65" width="10" height="45" rx="2" fill="rgba(16,185,129,0.3)" stroke="#10b981" strokeWidth="1.2" />
          <rect x="85" y="45" width="10" height="65" rx="2" fill="rgba(52,211,153,0.3)" stroke="#34d399" strokeWidth="1.2" />
          <rect x="100" y="30" width="10" height="80" rx="2" fill="rgba(16,185,129,0.45)" stroke="#6ee7b7" strokeWidth="1.4" filter="url(#glow-teal)" />
          <rect x="115" y="52" width="10" height="58" rx="2" fill="rgba(52,211,153,0.3)" stroke="#34d399" strokeWidth="1.2" />
          <rect x="130" y="38" width="10" height="72" rx="2" fill="rgba(16,185,129,0.35)" stroke="#10b981" strokeWidth="1.2" />

          {/* Floating Holographic Trend Graph Overlay */}
          <path d="M 68 70 Q 95 20, 110 35 T 142 32" fill="none" stroke="#a7f3d0" strokeWidth="1.8" filter="url(#glow-teal)" />
          <circle cx="110" cy="35" r="2.5" fill="#ffffff" />
          <circle cx="142" cy="32" r="2.5" fill="#ffffff" />

          {/* Floating Mini Pie Chart on Right */}
          <circle cx="145" cy="85" r="12" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="24 40" />
          <line x1="145" y1="85" x2="145" y2="73" stroke="#34d399" strokeWidth="1" />
          <line x1="145" y1="85" x2="155" y2="90" stroke="#34d399" strokeWidth="1" />

          {/* Holographic Glowing Pedestal */}
          <ellipse cx="100" cy="125" rx="75" ry="14" fill="none" stroke="#10b981" strokeWidth="1.5" filter="url(#glow-teal)" />
          <ellipse cx="100" cy="130" rx="60" ry="10" fill="rgba(16,185,129,0.12)" stroke="#34d399" strokeWidth="1" strokeDasharray="6 4" />
          <ellipse cx="100" cy="135" rx="40" ry="6" fill="none" stroke="#064e3b" strokeWidth="1.5" />
          <ellipse cx="100" cy="125" rx="20" ry="3" fill="#10b981" filter="url(#glow-teal)" />
        </svg>
      )
    },
    {
      id: 'CODE_LAB',
      title: 'CODE LAB',
      description: 'Write, debug, and optimize code with AI assistance',
      color: 'amber',
      theme: {
        border: 'border-amber-500/40',
        text: 'text-amber-400',
        glow: 'rgba(245, 158, 11, 0.5)',
        btnBg: 'bg-amber-950/60 hover:bg-amber-900/80 border-amber-400/50 text-amber-300',
        badge: 'text-amber-400'
      },
      actionPrompt: 'Buatkan kode aplikasi interaktif lengkap yang siap dijalankan.',
      svgArt: (
        <svg viewBox="0 0 200 160" className="w-full h-32 select-none pointer-events-none">
          <defs>
            <filter id="glow-amber" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 3D Isometric Code Editor Window */}
          <polygon points="50,45 130,25 155,75 75,100" fill="rgba(245,158,11,0.12)" stroke="#f59e0b" strokeWidth="1.4" filter="url(#glow-amber)" />
          
          {/* Top Window Dots */}
          <circle cx="62" cy="46" r="2" fill="#ef4444" />
          <circle cx="68" cy="44" r="2" fill="#eab308" />
          <circle cx="74" cy="42" r="2" fill="#22c55e" />

          {/* Syntax Highlighted Code Lines */}
          <line x1="60" y1="58" x2="95" y2="50" stroke="#fde047" strokeWidth="1.5" />
          <line x1="65" y1="66" x2="120" y2="52" stroke="#fb923c" strokeWidth="1.2" strokeDasharray="4 2" />
          <line x1="70" y1="74" x2="110" y2="64" stroke="#fbbf24" strokeWidth="1.2" strokeDasharray="3 2" />
          <line x1="75" y1="82" x2="135" y2="68" stroke="#fde047" strokeWidth="1.2" />

          {/* Floating Glowing Code Tag: </> */}
          <g filter="url(#glow-amber)">
            <text x="135" y="95" fill="#fef08a" fontSize="16" fontFamily="monospace" fontWeight="bold">
              {'</>'}
            </text>
          </g>

          {/* Holographic Glowing Pedestal */}
          <ellipse cx="100" cy="125" rx="75" ry="14" fill="none" stroke="#f59e0b" strokeWidth="1.5" filter="url(#glow-amber)" />
          <ellipse cx="100" cy="130" rx="60" ry="10" fill="rgba(245,158,11,0.12)" stroke="#fbbf24" strokeWidth="1" strokeDasharray="6 4" />
          <ellipse cx="100" cy="135" rx="40" ry="6" fill="none" stroke="#78350f" strokeWidth="1.5" />
          <ellipse cx="100" cy="125" rx="20" ry="3" fill="#f59e0b" filter="url(#glow-amber)" />
        </svg>
      )
    },
    {
      id: 'MEDIA_STUDIO',
      title: 'MEDIA STUDIO',
      description: 'Create, edit, and produce media content',
      color: 'pink',
      theme: {
        border: 'border-pink-500/40',
        text: 'text-pink-400',
        glow: 'rgba(236, 72, 153, 0.5)',
        btnBg: 'bg-pink-950/60 hover:bg-pink-900/80 border-pink-400/50 text-pink-300',
        badge: 'text-pink-400'
      },
      actionPrompt: 'Tampilkan siaran live media berita dan streaming audio terkini.',
      svgArt: (
        <svg viewBox="0 0 200 160" className="w-full h-32 select-none pointer-events-none">
          <defs>
            <filter id="glow-pink" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 3D Holographic Film Reel & Video Window */}
          {/* Film Reel */}
          <circle cx="125" cy="48" r="22" fill="rgba(236,72,153,0.15)" stroke="#ec4899" strokeWidth="1.4" filter="url(#glow-pink)" />
          <circle cx="125" cy="48" r="16" fill="none" stroke="#f472b6" strokeWidth="1" strokeDasharray="6 4" />
          <circle cx="125" cy="48" r="6" fill="#831843" stroke="#fbcfe8" strokeWidth="1" />

          {/* Reel Holes */}
          <circle cx="125" cy="36" r="2.5" fill="#f472b6" />
          <circle cx="125" cy="60" r="2.5" fill="#f472b6" />
          <circle cx="113" cy="48" r="2.5" fill="#f472b6" />
          <circle cx="137" cy="48" r="2.5" fill="#f472b6" />

          {/* Video Player Card Frame */}
          <rect x="60" y="55" width="65" height="42" rx="4" fill="rgba(236,72,153,0.1)" stroke="#f472b6" strokeWidth="1.2" />
          <line x1="68" y1="85" x2="110" y2="85" stroke="#ec4899" strokeWidth="1.5" strokeDasharray="2 2" />
          
          {/* Glowing Play Triangle */}
          <polygon points="140,82 155,90 140,98" fill="none" stroke="#ec4899" strokeWidth="1.8" filter="url(#glow-pink)" />

          {/* Holographic Glowing Pedestal */}
          <ellipse cx="100" cy="125" rx="75" ry="14" fill="none" stroke="#ec4899" strokeWidth="1.5" filter="url(#glow-pink)" />
          <ellipse cx="100" cy="130" rx="60" ry="10" fill="rgba(236,72,153,0.12)" stroke="#f472b6" strokeWidth="1" strokeDasharray="6 4" />
          <ellipse cx="100" cy="135" rx="40" ry="6" fill="none" stroke="#831843" strokeWidth="1.5" />
          <ellipse cx="100" cy="125" rx="20" ry="3" fill="#ec4899" filter="url(#glow-pink)" />
        </svg>
      )
    },
    {
      id: 'KNOWLEDGE_LAB',
      title: 'KNOWLEDGE LAB',
      description: 'Deep research, multi-agent memory, and verified insights',
      color: 'blue',
      theme: {
        border: 'border-cyan-500/40',
        text: 'text-cyan-400',
        glow: 'rgba(56, 189, 248, 0.5)',
        btnBg: 'bg-cyan-950/60 hover:bg-cyan-900/80 border-cyan-400/50 text-cyan-300',
        badge: 'text-cyan-400'
      },
      actionPrompt: 'Cari informasi dan telusuri sumber pengetahuan terverifikasi terkini.',
      svgArt: (
        <svg viewBox="0 0 200 160" className="w-full h-32 select-none pointer-events-none">
          <defs>
            <filter id="glow-blue" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 3D Holographic Wireframe Neural Cube */}
          {/* Front Face */}
          <polygon points="75,45 125,45 125,95 75,95" fill="rgba(14,165,233,0.12)" stroke="#0ea5e9" strokeWidth="1.2" />
          {/* Back Face */}
          <polygon points="95,25 145,25 145,75 95,75" fill="none" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3 2" />
          {/* Connecting Edges */}
          <line x1="75" y1="45" x2="95" y2="25" stroke="#38bdf8" strokeWidth="1" />
          <line x1="125" y1="45" x2="145" y2="25" stroke="#38bdf8" strokeWidth="1" />
          <line x1="125" y1="95" x2="145" y2="75" stroke="#38bdf8" strokeWidth="1" />
          <line x1="75" y1="95" x2="95" y2="75" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 2" />

          {/* Center Glowing Intelligence Symbol ? */}
          <g filter="url(#glow-blue)">
            <text x="102" y="76" fill="#38bdf8" fontSize="26" fontFamily="sans-serif" fontWeight="900" textAnchor="middle">
              ?
            </text>
          </g>

          {/* Holographic Glowing Pedestal */}
          <ellipse cx="100" cy="125" rx="75" ry="14" fill="none" stroke="#0ea5e9" strokeWidth="1.5" filter="url(#glow-blue)" />
          <ellipse cx="100" cy="130" rx="60" ry="10" fill="rgba(14,165,233,0.12)" stroke="#38bdf8" strokeWidth="1" strokeDasharray="6 4" />
          <ellipse cx="100" cy="135" rx="40" ry="6" fill="none" stroke="#0369a1" strokeWidth="1.5" />
          <ellipse cx="100" cy="125" rx="20" ry="3" fill="#0ea5e9" filter="url(#glow-blue)" />
        </svg>
      )
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
            6 APPS AVAILABLE
          </span>
        </div>
        <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-cyan-500/40 to-cyan-400"></div>
      </div>

      {/* 2x3 Grid of Cyber Hologram App Cards */}
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
              className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none rounded-2xl"
              style={{ background: `radial-gradient(circle at center, ${app.theme.glow} 0%, transparent 70%)` }}
            />

            {/* Top Text & Action */}
            <div className="z-10">
              <h3 className={`text-xs font-mono font-black tracking-wider ${app.theme.text} uppercase flex items-center justify-between`}>
                <span>{app.title}</span>
                <span className="text-[9px] opacity-60 font-sans tracking-normal">AI CORE</span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                {app.description}
              </p>
              
              <button
                className={`mt-2 px-2 py-0.5 rounded-md border text-[10px] font-mono flex items-center gap-1 ${app.theme.btnBg} transition-all duration-200 group-hover:scale-105 shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
              >
                <span>OPEN</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* 3D Holographic Visual Art on Glowing Pedestal */}
            <div className="w-full flex items-center justify-center mt-1 z-0 group-hover:brightness-110 transition-all duration-300">
              {app.svgArt}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
