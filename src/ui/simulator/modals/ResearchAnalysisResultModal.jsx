import React, { useState } from 'react';
import {
  X, Sparkles, Download, Copy, Check, FileText,
  HardDrive, CheckCircle2, RefreshCw, BarChart2, Shield
} from 'lucide-react';

export default function ResearchAnalysisResultModal({
  isOpen,
  onClose,
  category = 'RESEARCH', // 'RESEARCH' | 'NON_RESEARCH'
  documentTitle = 'Dokumen',
  documentSize = '',
  analysisContent = '',
  savedPath = 'F:\\UltimateAI_Reports',
  isRecording = false,
  onReanalyze
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isNonResearch = category === 'NON_RESEARCH';
  const colorCss = isNonResearch ? '#22d3ee' : '#00e5ff';

  const handleCopy = () => {
    navigator.clipboard.writeText(analysisContent || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([analysisContent || ''], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const prefix = isNonResearch ? 'Hasil_Analisis_NonRiset' : 'Hasil_Analisis_Riset';
    a.download = `${prefix}_${(documentTitle || 'Dokumen').replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      {/* Background click to close */}
      <div className="absolute inset-0 bg-transparent" onClick={onClose} />

      {/* Cyber Glass Modal Container */}
      <div
        className="cyber-hud-card relative z-10 w-full max-w-4xl max-h-[88vh] flex flex-col justify-between p-5 sm:p-6 overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(0,229,255,0.35)] rounded-3xl border-2 border-cyan-400/50 bg-[#070d1a]/95 select-text"
        style={{
          '--hud-color': colorCss,
          '--hud-border-inner': `${colorCss}40`
        }}
      >
        {/* Top Glare Specular Reflection */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-cyan-400/10 via-white/5 to-transparent pointer-events-none z-10" />

        {/* 1. Modal Header */}
        <div className="relative z-20 flex items-center justify-between pb-4 border-b border-cyan-500/30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(0,229,255,0.4)]">
              {isNonResearch ? <FileText className="w-6 h-6" /> : <BarChart2 className="w-6 h-6" />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-mono font-black tracking-wider uppercase text-cyan-300 drop-shadow-[0_0_10px_#00e5ff]">
                  {isNonResearch ? 'HASIL ANALISIS DOKUMEN GENERAL (NON-RISET)' : 'HASIL ANALISIS RISET JIN AI'}
                </h2>
                <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border bg-cyan-950/80 text-cyan-200 border-cyan-400/40">
                  {isNonResearch ? 'NON-RISET KNOWLEDGE CORE' : 'AUTONOMOUS RESEARCH CORE'}
                </span>
              </div>
              <p className="text-xs text-slate-300/90 font-sans mt-0.5 flex items-center gap-2">
                <span className="font-semibold text-white">Dokumen: {documentTitle}</span>
                {documentSize && <span className="text-slate-400 font-mono">({documentSize})</span>}
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-cyan-300">
                  {isNonResearch ? 'Kategori: Non-Riset' : 'Kategori: Riset'}
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-900/90 hover:bg-red-950/80 border border-slate-700 hover:border-red-500/50 flex items-center justify-center text-slate-300 hover:text-red-400 transition-all shadow-md group"
            title="Tutup Hasil Analisis"
          >
            <X className="w-5 h-5 transition-transform group-hover:rotate-90" />
          </button>
        </div>

        {/* 2. Recording Status Banner (Drive F:\ Status) */}
        <div className="relative z-20 my-3 p-3 rounded-2xl bg-slate-950/90 border border-cyan-500/40 flex items-center justify-between gap-3 shadow-inner flex-shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 flex-shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                STATUS: TEREKAM OTOMATIS KE DRIVE F:
              </span>
              <span className="text-[11px] font-mono text-slate-300 truncate" title={savedPath}>
                Lokasi: <span className="text-cyan-300">{savedPath}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin!' : 'Salin Teks'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500/30 hover:bg-cyan-500/50 border border-cyan-400 text-cyan-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(0,229,255,0.3)] hover:scale-105"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh .MD</span>
            </button>
          </div>
        </div>

        {/* 3. Main Analysis Content Viewport */}
        <div className="relative z-20 flex-1 min-h-[300px] max-h-[50vh] overflow-y-auto custom-scrollbar p-5 rounded-2xl bg-slate-950/95 border-2 border-cyan-500/30 font-sans text-slate-200 text-xs sm:text-sm leading-relaxed shadow-inner select-text">
          {analysisContent ? (
            <div className="space-y-4 whitespace-pre-wrap selection:bg-cyan-500/40 selection:text-white">
              {analysisContent}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
              <p className="font-mono text-xs text-cyan-300 font-bold">
                JIN SEDANG MEMBEDAH DAN MENGANALISIS DOKUMEN RISET...
              </p>
            </div>
          )}
        </div>

        {/* 4. Bottom Action Footer */}
        <div className="relative z-20 pt-4 mt-2 border-t border-white/10 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>ENCRYPTED & VERIFIED BY ULTIMATEAI 9ROUTER NEURAL CORE</span>
          </div>

          <div className="flex items-center gap-3">
            {onReanalyze && (
              <button
                onClick={onReanalyze}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Analisis Dokumen Baru</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-cyan-500/40 hover:bg-cyan-500/70 border border-cyan-400 text-white text-xs font-mono font-bold transition-all shadow-[0_0_15px_rgba(0,229,255,0.4)]"
            >
              Selesai / Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
