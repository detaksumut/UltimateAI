import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X, ArrowRight, Sparkles, Sliders, Play, Download, Copy, Check,
  Code, Image as ImageIcon, FileText, BarChart3, Video, Brain,
  Cpu, Layers, Zap, Terminal, RefreshCw, Eye, Upload, HardDrive, CheckCircle2, BarChart2, Shield
} from 'lucide-react';
import Hologram3DCanvas from '../components/Hologram3DCanvas.jsx';
import OuterOrbitalDustCanvas from '../components/OuterOrbitalDustCanvas.jsx';
import AppSandboxRenderer from '../components/AppSandboxRenderer.jsx';
import { ContentExtractor } from '../../../services/analysis/ContentExtractor.js';

// Real-Time Typewriter Auto-Scrolling Data Telemetry Terminal Component
function DataTelemetryTerminal({ colorCss }) {
  const terminalRef = useRef(null);
  const telemetryLogs = [
    'âš¡ [00:00.12] INITIALIZING NEURAL DATA PIPELINE: Dataset ID #NX-9842',
    'ðŸ“¥ [00:00.38] INGESTING 48,290 RECORDS â€¢ VALIDATING SCHEMA (100% OK)',
    'ðŸ” [00:00.75] COMPUTING STATISTICAL DESCRIPTIVES (MEAN, STD, MEDIAN)',
    'ðŸ“ˆ [00:01.10] EXECUTING PEARSON CORRELATION MATRIX (r = 0.9412, p < 0.001)',
    'ðŸ§¬ [00:01.45] MULTI-DIMENSIONAL CLUSTERING: 6 OPTIMAL CLUSTERS FOUND',
    'ðŸ›¡ï¸ [00:01.82] RUNNING ISOLATION FOREST: 3 ANOMALIES RESOLVED (0.01%)',
    'ðŸ“Š [00:02.15] TIME-SERIES AUTOREGRESSION (ARIMA): +34.8% GROWTH DETECTED',
    'ðŸŽ¯ [00:02.50] CONFIDENCE INTERVAL: 99.85% (Z-SCORE: 3.12, Ïƒ = 0.04)',
    'ðŸ’¡ [00:02.85] EXECUTIVE SUMMARY: KEY CONVERSION DRIVERS IDENTIFIED',
    'âœ¨ [00:03.20] DATA PIPELINE COMPLETE â€¢ LIVE TELEMETRY CONTINUOUSLY SYNCED',
    'ðŸ”„ [00:03.60] STREAMING REAL-TIME QUANTUM TELEMETRY BUFFER (NODE-A1)...',
    'ðŸ“¡ [00:04.10] INGESTING LIVE TELEMETRY: Î” = +1.42% VOLATILITY STABLE',
    'âš¡ [00:04.65] NEURAL WEIGHTS ADAPTED â€¢ OPTIMAL ACCURACY REACHED: 99.88%'
  ];

  const [activeLogs, setActiveLogs] = useState([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);

  useEffect(() => {
    // Stream lines with typewriter rhythm
    const timer = setInterval(() => {
      setCurrentLineIndex((prev) => {
        const next = (prev + 1) % (telemetryLogs.length + 8);
        const displayIndex = next < telemetryLogs.length ? next : telemetryLogs.length - 1;
        setActiveLogs(telemetryLogs.slice(0, displayIndex + 1));
        return next;
      });
    }, 450);

    return () => clearInterval(timer);
  }, []);

  // Auto-scroll continuously upwards
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [activeLogs]);

  return (
    <div
      ref={terminalRef}
      className="relative w-full h-36 rounded-xl border border-teal-500/40 bg-slate-950/95 p-3 font-mono text-[10.5px] text-teal-300/90 overflow-y-auto custom-scrollbar shadow-inner flex flex-col gap-1 select-text"
      style={{
        boxShadow: 'inset 0 0 20px rgba(0, 229, 255, 0.12)'
      }}
    >
      <div className="text-[9px] text-teal-500/70 border-b border-teal-500/20 pb-1 mb-1 flex items-center justify-between">
        <span>â— JIN_RESEARCH_DATA_KERNEL v4.2</span>
        <span>STREAM: ACTIVE (60 FPS)</span>
      </div>

      {activeLogs.map((log, index) => (
        <div key={index} className="leading-relaxed flex items-start gap-1.5 animate-fadeIn">
          <span className="text-teal-400 font-bold">â€º</span>
          <span className={index === activeLogs.length - 1 ? 'text-white font-bold' : 'text-teal-200/90'}>
            {log}
          </span>
        </div>
      ))}

      {/* Live Blinking Typewriter Cursor */}
      <div className="flex items-center gap-1.5 text-teal-400 font-bold animate-pulse mt-0.5">
        <span>â€º</span>
        <span className="w-2 h-3.5 bg-teal-400 inline-block shadow-[0_0_8px_#00e5ff]" />
      </div>
    </div>
  );
}

export default function CrystalAppStudioModal({
  isOpen,
  onClose,
  app,
  messages = [],
  generatedAppCode = null,
  generatedImageUrl = null,
  lastAssistantMessage = '',
  onExecutePrompt,
  onAnalyzeResearchDoc,
  onAnalyzeNonResearchDoc
}) {
  const [copied, setCopied] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [activeTab, setActiveTab] = useState('WORKSPACE');

  // Custom states per studio type
  const [imageStyle, setImageStyle] = useState('CYBERPUNK');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [customImageUrl, setCustomImageUrl] = useState(null);
  const [imageSeed, setImageSeed] = useState(12345);
  const [isImgLoading, setIsImgLoading] = useState(false);
  const [codeLang, setCodeLang] = useState('javascript');
  const [sampleCode, setSampleCode] = useState(
`// UltimateAI Autonomous Neural Agent Script
async function initializeQuantumCore() {
  const kernel = new QuantumKernel({ nodes: 12, mode: 'HYPER_PARALLEL' });
  await kernel.syncNeuralWeights();
  console.log("JIN Core is Live.");
  return kernel.executePipeline();
}`
  );

  const fileInputRef = useRef(null);

  // Extract HTML / UI / Canvas code from messages or generatedAppCode prop
  const extractedAppCode = useMemo(() => {
    if (generatedAppCode) return generatedAppCode;

    // Find the latest assistant message containing code
    const textsToCheck = [
      lastAssistantMessage,
      ...(messages || []).slice().reverse().map(m => m.role === 'assistant' ? m.content : '')
    ];

    for (const textToCheck of textsToCheck) {
      if (!textToCheck || typeof textToCheck !== 'string') continue;

      // 1. Markdown code block
      const match = textToCheck.match(/```(?:html|xml|ui|javascript|js)?\s*([\s\S]*?)(?:```|$)/i);
      if (match && match[1] && (match[1].includes('<') || match[1].includes('document.') || match[1].includes('function') || match[1].includes('canvas'))) {
        return match[1].trim();
      }

      // 2. Raw HTML tags
      const rawMatch = textToCheck.match(/(<!DOCTYPE html>[\s\S]*|<\/?(?:form|html|div|table|section|main|canvas)[\s\S]*>)/i);
      if (rawMatch && rawMatch[1]) {
        return rawMatch[1].trim();
      }
    }

    return null;
  }, [generatedAppCode, lastAssistantMessage, messages]);

  // Sync prompt when app changes
  useEffect(() => {
    if (app && app.actionPrompt) {
      setPromptText(app.actionPrompt);
      setImageSeed(Date.now());
      setIsImgLoading(true);
    }
  }, [app]);

  if (!isOpen || !app) return null;

  const colorCss = app.colorCss || '#00f2fe';
  const colorHex = app.colorHex || 0x00f2fe;

  // Clean prompt by removing conversational wrappers
  const effectivePrompt = (promptText || app.actionPrompt || 'deep cosmic galaxy antariksa').trim();
  const cleanedKeywords = effectivePrompt
    .replace(/^(?:jin|tolong|coba|generatekan|generate|buatkan|buat|bikin|gambar|image|foto|lukis)\b/gi, '')
    .replace(/jangan kau ambil dari internet/gi, '')
    .trim() || effectivePrompt;

  // Topic-tailored high-res fallback image library
  const getThemedImageUrl = (keyword) => {
    const k = (keyword || '').toLowerCase();
    if (k.includes('antariksa') || k.includes('galaxy') || k.includes('space') || k.includes('bintang') || k.includes('planet') || k.includes('cosmos')) {
      return 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=85';
    }
    if (k.includes('kekasih') || k.includes('couple') || k.includes('cinta') || k.includes('pasangan') || k.includes('romantic')) {
      return 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=1200&q=85';
    }
    if (k.includes('robot') || k.includes('ai') || k.includes('cyber') || k.includes('futuristik') || k.includes('tech')) {
      return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=85';
    }
    if (k.includes('gunung') || k.includes('mountain') || k.includes('alam') || k.includes('nature') || k.includes('hutan')) {
      return 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85';
    }
    if (k.includes('kota') || k.includes('city') || k.includes('building') || k.includes('arsitektur')) {
      return 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=85';
    }
    return 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&q=85';
  };

  const currentImageUrl = customImageUrl || getThemedImageUrl(cleanedKeywords);

  const handleCustomUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomImageUrl(url);
    }
  };

  const handleRegenerateImage = () => {
    setCustomImageUrl(null);
    setIsImgLoading(true);
    setImageSeed(Date.now());
  };

  const handleCopyPrompt = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendToJIN = (overridePrompt) => {
    const textToSend = overridePrompt || promptText || app.actionPrompt || `Jalankan operasi untuk ${app.title}`;
    onClose();
    if (onExecutePrompt) {
      onExecutePrompt(textToSend);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
      {/* 100% Completely Transparent Click Backdrop (Zero Alteration to Background) */}
      <div className="absolute inset-0 bg-transparent pointer-events-auto" onClick={onClose} />

      {/* The Floating Thick Crystal Glass Box Modal */}
      <div
        className="cyber-hud-card pointer-events-auto relative z-10 w-full max-w-3xl max-h-[86vh] flex flex-col justify-between p-5 sm:p-6 overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_35px_var(--hud-color)]"
        style={{
          '--hud-color': colorCss,
          '--hud-border-inner': `${colorCss}50`
        }}
      >
        {/* 100% Sharp Chamfered Cyber SVG Frame */}
        <svg
          className="cyber-hud-card-border w-full h-full pointer-events-none"
          viewBox="0 0 800 560"
          preserveAspectRatio="none"
          fill="none"
        >
          {/* Outer Chamfered Neon Path */}
          <path
            d="M 40 8 L 760 8 L 792 40 L 792 510 L 760 552 L 40 552 L 8 520 L 8 40 Z"
            stroke={colorCss}
            strokeWidth="2.2"
            strokeOpacity="0.95"
            style={{ filter: `drop-shadow(0 0 14px ${colorCss})` }}
          />

          {/* Inner Chamfered Accent Track */}
          <path
            d="M 46 16 L 754 16 L 784 46 L 784 502 L 754 544 L 46 544 L 16 514 L 16 46 Z"
            stroke={colorCss}
            strokeWidth="1.2"
            strokeOpacity="0.4"
            strokeDasharray="24 8 12 6"
          />

          {/* Corner Cyber Cutout Marks */}
          <line x1="8" y1="40" x2="40" y2="8" stroke={colorCss} strokeWidth="4" />
          <line x1="760" y1="552" x2="792" y2="520" stroke={colorCss} strokeWidth="4" />
          <circle cx="774" cy="26" r="3" fill={colorCss} />
          <circle cx="26" cy="534" r="3" fill={colorCss} />
        </svg>

        {/* Top Specular Glare Reflection */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-white/12 via-white/2 to-transparent pointer-events-none z-10" />

        {/* 1. Modal Header Bar */}
        <div className="relative z-20 flex items-center justify-between pb-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center border shadow-lg"
              style={{
                borderColor: `${colorCss}80`,
                backgroundColor: `${colorCss}20`,
                color: colorCss
              }}
            >
              {app.id === 'IMAGE_STUDIO' && <ImageIcon className="w-5 h-5" />}
              {app.id === 'DOCUMENT_STUDIO' && <FileText className="w-5 h-5" />}
              {app.id === 'DATA_LAB' && <BarChart3 className="w-5 h-5" />}
              {app.id === 'CODE_LAB' && <Code className="w-5 h-5" />}
              {app.id === 'MEDIA_STUDIO' && <Video className="w-5 h-5" />}
              {app.id === 'KNOWLEDGE_LAB' && <Brain className="w-5 h-5" />}
              {app.id === 'CONNECTIONS' && <Zap className="w-5 h-5" />}
              {app.id === 'CONTROL_CENTER' && <Settings className="w-5 h-5" />}
              {app.id === 'MEMORY_VAULT' && <Database className="w-5 h-5" />}
              {app.id === 'ACTIVITY_FEED' && <Activity className="w-5 h-5" />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2
                  className="text-lg sm:text-xl font-mono font-black tracking-wider uppercase drop-shadow-[0_0_12px_currentColor]"
                  style={{ color: colorCss }}
                >
                  {app.title}
                </h2>
                <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border bg-black/40 text-slate-300 border-white/20">
                  CRYSTAL POD v2.0
                </span>
              </div>
              <p className="text-xs text-slate-300/80 font-sans mt-0.5">
                {app.description}
              </p>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-900/80 hover:bg-red-950/80 border border-slate-700 hover:border-red-500/50 flex items-center justify-center text-slate-300 hover:text-red-400 transition-all shadow-md group"
            title="Tutup Kotak Kaca Kristal"
          >
            <X className="w-5 h-5 transition-transform group-hover:rotate-90" />
          </button>
        </div>

        {/* 2. Main Crystal Box Content */}
        {app.id === 'IMAGE_STUDIO' ? (
          /* FULL-SIZE DISPLAY FOR REAL JIN GENERATED ARTWORK */
          <div className="relative z-20 flex flex-col items-center justify-between gap-3 my-3 flex-1 overflow-hidden">
            {/* Full-Width Generated AI Image Canvas */}
            <div className="relative w-full h-[450px] sm:h-[500px] rounded-2xl border-2 border-cyan-500/50 overflow-hidden bg-slate-950/90 flex items-center justify-center shadow-[0_0_30px_rgba(0,242,254,0.25)]">
              {/* AI image: prefer generatedImageUrl prop, then fall back to themed Unsplash */}
              {generatedImageUrl ? (
                <img
                  key={generatedImageUrl}
                  src={generatedImageUrl}
                  alt={effectivePrompt}
                  onLoad={() => setIsImgLoading(false)}
                  onError={() => setIsImgLoading(false)}
                  className={`w-full h-full object-contain sm:object-cover transition-all duration-700 ${isImgLoading ? 'opacity-20 blur-md' : 'opacity-100 blur-0'}`}
                />
              ) : (
                /* Generatingâ€¦ show spinner + fallback themed image underneath */
                <>
                  <img
                    src={currentImageUrl}
                    alt="Loading placeholder"
                    className="w-full h-full object-cover opacity-30 blur-sm"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-30 gap-3">
                    <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin" />
                    <span className="text-sm font-mono text-cyan-200 font-bold tracking-wider">
                      JIN SEDANG MEMBUAT GAMBAR...
                    </span>
                    <span className="text-xs font-mono text-slate-400">{effectivePrompt}</span>
                  </div>
                </>
              )}

              {/* Bottom Glass Overlay Bar with Prompt and Download Action */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex items-center justify-between pointer-events-auto z-20">
                <div className="flex flex-col gap-0.5 max-w-[70%]">
                  <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    HASIL GENERATE JIN AI â€¢ MASTER 4K
                    {generatedImageUrl && (
                      <span className="ml-2 text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                        â— SELESAI
                      </span>
                    )}
                  </span>
                  <p className="text-xs sm:text-sm font-sans font-medium text-slate-100 truncate">
                    "{effectivePrompt}"
                  </p>
                </div>

                <a
                  href={generatedImageUrl || currentImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2.5 rounded-xl bg-cyan-500/30 hover:bg-cyan-500/60 border border-cyan-400 text-xs sm:text-sm font-mono font-bold text-white flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(0,242,254,0.4)] hover:scale-105"
                >
                  <Download className="w-4 h-4" />
                  <span>UNDUH GAMBAR</span>
                </a>
              </div>
            </div>
          </div>
        ) : app.id === 'CODE_LAB' ? (
          /* CODE LAB â€” renders actual app/code output from JIN in the sandbox */
          <div className="relative z-20 flex flex-col gap-3 my-2 flex-1 overflow-hidden">
            <div className="w-full flex-1 rounded-2xl border-2 overflow-hidden" style={{ borderColor: `${colorCss}60` }}>
              {extractedAppCode ? (
                <AppSandboxRenderer appCode={extractedAppCode} appName={effectivePrompt} />
              ) : (
                <div className="w-full h-full bg-[#080d1a] p-6 text-slate-200 flex flex-col items-center justify-center text-center select-none min-h-[380px]">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-lg"
                    style={{ background: `${colorCss}20`, border: `1px solid ${colorCss}50` }}>
                    <Code className="w-7 h-7" style={{ color: colorCss }} />
                  </div>
                  <div className="text-sm font-bold font-mono tracking-wide mb-2" style={{ color: colorCss }}>
                    CODE LAB â€” SIAP
                  </div>
                  <p className="text-xs text-slate-400 max-w-[280px] leading-relaxed">
                    Ketik perintah coding di chat: <span className="text-amber-300 font-mono">"buatkan kalkulator"</span>, <span className="text-amber-300 font-mono">"buat aplikasi todo"</span>, <span className="text-amber-300 font-mono">"debug kode ini"</span>.
                    Hasil kode JIN AI akan langsung dirender di sini.
                  </p>
                  {lastAssistantMessage && (
                    <div className="mt-4 w-full max-h-40 overflow-y-auto custom-scrollbar bg-slate-950/80 rounded-xl p-3 text-left font-mono text-[11px] text-amber-200/80 border border-amber-500/20">
                      {lastAssistantMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : app.id === 'DATA_LAB' ? (
          /* RISET LAB (DATA_LAB) â€” Upload Dokumen Riset, Ekstraksi, & Analisis Mendalam JIN */
          <ResearchDocumentWorkbench
            app={app}
            colorCss={colorCss}
            onAnalyzeResearchDoc={onAnalyzeResearchDoc}
            onExecutePrompt={onExecutePrompt}
            lastAssistantMessage={lastAssistantMessage}
            onClose={onClose}
          />
        ) : (
          /* DOCUMENT STUDIO, KNOWLEDGE LAB, MEDIA STUDIO: live analysis workbench */
          <DocumentLiveAnalysisWorkbench
            app={app}
            colorCss={colorCss}
            onExecutePrompt={onExecutePrompt}
            onAnalyzeNonResearchDoc={onAnalyzeNonResearchDoc}
            lastAssistantMessage={lastAssistantMessage}
            messages={messages}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

// Dedicated Live Typewriter & Auto-Scrolling Document Analysis Component
function DocumentLiveAnalysisWorkbench({
  app,
  colorCss,
  onExecutePrompt,
  onAnalyzeNonResearchDoc,
  lastAssistantMessage,
  messages = [],
  onClose
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [extractedDoc, setExtractedDoc] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lines, setLines] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);
  const terminalScrollRef = useRef(null);

  // 1. Sync real assistant response streamed from JIN AI
  useEffect(() => {
    if (lastAssistantMessage && lastAssistantMessage.length > 0) {
      const splitLines = lastAssistantMessage
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

      if (splitLines.length > 0) {
        setLines(splitLines);
        setIsAnalyzing(false);
      }
    }
  }, [lastAssistantMessage]);

  // 2. Continuous auto-scrolling upward
  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [lines]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');
    setSelectedFile(file);
    setIsExtracting(true);

    try {
      const extracted = await ContentExtractor.extractFromFile(file);
      setExtractedDoc(extracted);
      setLines([
        `âš¡ [00:00.10] MEMUAT DOKUMEN: ${file.name} (${(file.size / 1024).toFixed(1)} KB)...`,
        `ðŸ“‚ [00:00.35] BERHASIL DIEKSTRAKSI: ${(extracted.content || extracted.preview || '').length.toLocaleString()} karakter terbaca.`,
        `âœ¨ [00:00.75] DOKUMEN SIAP DIANALISIS & DIREKAM KE DRIVE F:\\UltimateAI_NonResearch_Reports...`
      ]);
    } catch (err) {
      setErrorMsg(err.message || 'Gagal mengekstrak dokumen.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleTriggerNonResearchAnalysis = () => {
    if (!extractedDoc && !selectedFile) return;
    setIsAnalyzing(true);
    if (onAnalyzeNonResearchDoc) {
      onAnalyzeNonResearchDoc(extractedDoc || { fileName: selectedFile.name, content: '' }, selectedFile);
    } else if (onExecutePrompt) {
      const docContent = extractedDoc?.content || extractedDoc?.preview || '';
      onExecutePrompt(
        `Berikut adalah dokumen non-riset (SK/Regulasi/Ekonomi/Umum) "${selectedFile.name}" yang saya unggah:\n\n` +
        `=== KONTEN DOKUMEN ===\n` +
        `${docContent}\n` +
        `=== AKHIR DOKUMEN ===\n\n` +
        `Tolong analisis isi, pasal/ketentuan, konteks regulasi/ekonomi, dan sajikan ringkasan serta poin keputusannya.`
      );
    }
    if (onClose) onClose();
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setExtractedDoc(null);
    setLines([]);
    setIsAnalyzing(false);
    setErrorMsg('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="relative z-20 flex flex-col gap-3 my-2 flex-1 overflow-hidden">
      {/* 1. Document Upload Placeholder Bar */}
      <div className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950/80 border border-purple-500/40 backdrop-blur-md shadow-lg flex-shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.csv,.xlsx,.json,.md"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Upload Trigger Area */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-dashed border-purple-400/50 hover:border-purple-400 bg-purple-950/25 hover:bg-purple-950/45 cursor-pointer transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-400/60 flex items-center justify-center text-purple-300 group-hover:scale-110 transition-transform flex-shrink-0">
            <Upload className="w-4 h-4" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-mono font-bold text-purple-200 group-hover:text-purple-100 flex items-center gap-1.5 truncate">
              <span>{selectedFile ? selectedFile.name : 'KLIK ATAU TARIK DOKUMEN NON-RISET KE SINI (SK, HUKUM, EKONOMI, DLL)'}</span>
              {extractedDoc && <span className="text-[10px] text-emerald-400 font-bold font-mono">â— DIEKSTRAKSI (100% OK)</span>}
            </span>
            <span className="text-[10px] font-sans text-slate-400 truncate">
              {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB â€¢ Siap dianalisis & direkam ke Drive F:` : 'Format yang didukung: PDF, DOCX, CSV, TXT, XLSX, JSON, MD'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        {selectedFile && (
          <button
            onClick={handleClearFile}
            className="px-3.5 py-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md flex-shrink-0"
            title="Hapus dan ganti dokumen"
          >
            <X className="w-3.5 h-3.5" />
            <span>HAPUS DOKUMEN</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-2 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs font-mono">
          âš ï¸ {errorMsg}
        </div>
      )}

      {/* 2. Live Typewriter & Auto-Scrolling Terminal Screen */}
      <div
        ref={terminalScrollRef}
        className="relative w-full flex-1 min-h-[220px] max-h-[320px] rounded-2xl border-2 border-purple-500/40 bg-slate-950/95 p-4 sm:p-5 font-mono text-[11px] sm:text-[12px] text-purple-200/90 overflow-y-auto custom-scrollbar shadow-inner flex flex-col gap-1.5 select-text"
        style={{
          boxShadow: 'inset 0 0 35px rgba(168, 85, 247, 0.15), 0 0 25px rgba(0,0,0,0.8)'
        }}
      >
        {/* Terminal Header */}
        <div className="text-[9.5px] text-purple-400/80 border-b border-purple-500/30 pb-2 mb-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${selectedFile ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-purple-400 shadow-[0_0_8px_#a855f7]'} animate-pulse`} />
            <span className="font-bold tracking-wider uppercase">JIN NEURAL DOCUMENT ANALYZER (NON-RISET)</span>
          </div>
          <span className={`px-2 py-0.5 rounded border text-[9px] ${selectedFile ? 'text-emerald-400 bg-emerald-950/50 border-emerald-500/30' : 'text-slate-400 bg-slate-900 border-slate-700'}`}>
            {selectedFile ? (isExtracting ? 'â— MENGEKSTRAKSI...' : isAnalyzing ? 'â— SEDANG MENGANALISIS DOKUMEN' : 'â— SIAP DIANALISIS') : 'â—‹ MENUNGGU DOKUMEN'}
          </span>
        </div>

        {/* Empty State Instructions */}
        {!selectedFile && (
          <div className="flex flex-col items-center justify-center flex-1 py-10 text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-lg">
              <FileText className="w-7 h-7" />
            </div>
            <div className="flex flex-col gap-1 max-w-sm">
              <span className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider">
                UNGGAH DOKUMEN NON-RISET (SK / HUKUM / EKONOMI / REGULASI)
              </span>
              <p className="text-[11px] font-sans text-slate-400">
                Pilih atau tarik file dokumen Anda pada kotak unggah di atas untuk memulai analisis cerdas oleh JIN AI dan merekam hasilnya ke Drive F:.
              </p>
            </div>
          </div>
        )}

        {/* Live Typewritten Lines */}
        {selectedFile && lines.map((line, index) => (
          <div key={index} className="leading-relaxed flex items-start gap-2 animate-fadeIn">
            <span className="text-purple-400 font-bold flex-shrink-0">â€º</span>
            <span className={`break-words ${line.startsWith('ðŸ“‘') || line.startsWith('ðŸ“Š') || line.startsWith('ðŸ’¡') || line.startsWith('ðŸŽ¯') ? 'text-cyan-300 font-bold text-xs sm:text-[13px] pt-1' : line.startsWith('âœ¨') ? 'text-emerald-300 font-bold' : line.startsWith('â”') ? 'text-purple-500/50' : 'text-slate-200'}`}>
              {line}
            </span>
          </div>
        ))}

        {/* Active Blinking Typewriter Cursor */}
        {selectedFile && isAnalyzing && (
          <div className="flex items-center gap-2 text-purple-400 font-bold animate-pulse mt-1">
            <span>â€º</span>
            <span className="w-2.5 h-4 bg-purple-400 inline-block shadow-[0_0_10px_#a855f7]" />
            <span className="text-[10px] text-purple-300 italic">JIN sedang membaca dan menganalisis {selectedFile.name}...</span>
          </div>
        )}
      </div>

      {/* 3. Action Bar: Execute Non-Research Analysis & Record to Drive F: */}
      <div className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-950/90 border border-purple-500/30 shadow-lg flex-shrink-0">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
          <HardDrive className="w-4 h-4 text-emerald-400" />
          <span>Hasil analisis akan direkam otomatis ke <span className="text-purple-300 font-bold">Drive F:\UltimateAI_NonResearch_Reports\</span></span>
        </div>

        <button
          onClick={handleTriggerNonResearchAnalysis}
          disabled={!selectedFile || isExtracting || isAnalyzing}
          className={`px-5 py-2.5 rounded-xl font-mono text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shadow-lg ${
            selectedFile && !isExtracting
              ? 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white shadow-[0_0_20px_rgba(168,85,247,0.5)] cursor-pointer hover:scale-105'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
          }`}
        >
          {isExtracting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
              <span>MENGEKSTRAKSI DOKUMEN...</span>
            </>
          ) : isAnalyzing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
              <span>JIN SEDANG MENGANALISIS...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-white" />
              <span>ANALISIS NON-RISET & REKAM KE DRIVE F: âž”</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Dedicated High-Tech Research Document Workbench for RISET LAB (DATA_LAB)
function ResearchDocumentWorkbench({
  app,
  colorCss = '#00e5ff',
  onAnalyzeResearchDoc,
  onExecutePrompt,
  lastAssistantMessage,
  onClose
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [extractedDoc, setExtractedDoc] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileProcess = async (file) => {
    if (!file) return;
    setErrorMsg('');
    setSelectedFile(file);
    setIsExtracting(true);

    try {
      const extracted = await ContentExtractor.extractFromFile(file);
      setExtractedDoc(extracted);
    } catch (err) {
      setErrorMsg(err.message || 'Gagal mengekstrak dokumen riset.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleTriggerAnalysis = () => {
    if (!extractedDoc) return;
    setIsAnalyzing(true);
    if (onAnalyzeResearchDoc) {
      onAnalyzeResearchDoc(extractedDoc, selectedFile);
    } else if (onExecutePrompt) {
      const docContent = extractedDoc.content || extractedDoc.preview || '';
      onExecutePrompt(
        `Berikut adalah dokumen riset "${extractedDoc.fileName}" (${extractedDoc.type}) yang saya unggah ke Riset Lab:\n\n` +
        `=== KONTEN DOKUMEN RISET ===\n` +
        `${docContent}\n` +
        `=== AKHIR DOKUMEN ===\n\n` +
        `Lakukan analisis riset komprehensif, temukan poin penting, metodologi, temuan kunci, dan sajikan laporannya.`
      );
    }
    if (onClose) onClose();
  };

  const handleClear = () => {
    setSelectedFile(null);
    setExtractedDoc(null);
    setIsAnalyzing(false);
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="relative z-20 flex flex-col gap-3 my-2 flex-1 overflow-hidden">
      {/* 1. Upload & Dropzone Area */}
      <div className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950/90 border border-cyan-500/40 backdrop-blur-md shadow-lg flex-shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt,.csv,.xlsx,.json,.md"
          onChange={(e) => {
            if (e.target.files?.[0]) handleFileProcess(e.target.files[0]);
          }}
          className="hidden"
        />

        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed cursor-pointer transition-all group ${
            dragActive
              ? 'border-cyan-400 bg-cyan-950/60 scale-[1.01]'
              : 'border-cyan-500/50 hover:border-cyan-400 bg-cyan-950/25 hover:bg-cyan-950/45'
          }`}
        >
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center text-cyan-300 group-hover:scale-110 transition-transform flex-shrink-0 shadow-[0_0_12px_rgba(0,229,255,0.3)]">
            <Upload className="w-5 h-5" />
          </div>

          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-mono font-bold text-cyan-200 group-hover:text-cyan-100 flex items-center gap-2 truncate">
              <span>{selectedFile ? selectedFile.name : 'UNGGAH DOKUMEN RISET (KLIK / TARIK FILE KE SINI)'}</span>
              {extractedDoc && (
                <span className="text-[10px] text-emerald-400 font-bold font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40">
                  â— DIEKSTRAKSI (100% OK)
                </span>
              )}
            </span>
            <span className="text-[10px] font-sans text-slate-400 truncate">
              {selectedFile
                ? `${(selectedFile.size / 1024).toFixed(1)} KB â€¢ Format: ${selectedFile.name.split('.').pop()?.toUpperCase()} â€¢ Siap dianalisis & direkam ke Drive F:`
                : 'Format yang didukung: PDF, DOCX, CSV, XLSX, TXT, JSON, MD (Maksimal 25MB)'}
            </span>
          </div>
        </div>

        {selectedFile && (
          <button
            onClick={handleClear}
            className="px-3.5 py-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md flex-shrink-0"
            title="Hapus dokumen"
          >
            <X className="w-3.5 h-3.5" />
            <span>HAPUS</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs font-mono">
          âš ï¸ {errorMsg}
        </div>
      )}

      {/* 2. Extraction Preview / Telemetry Terminal */}
      {extractedDoc ? (
        <div className="relative w-full flex-1 min-h-[220px] max-h-[300px] rounded-2xl border-2 border-cyan-500/40 bg-slate-950/95 p-4 font-mono text-[11px] text-cyan-200/90 overflow-y-auto custom-scrollbar shadow-inner flex flex-col gap-2 select-text">
          <div className="text-[9.5px] text-cyan-400/80 border-b border-cyan-500/30 pb-2 mb-1 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse" />
              <span className="font-bold tracking-wider uppercase">PREVIEW KONTEN DOKUMEN RISET</span>
            </div>
            <span className="text-slate-400">Karakter: {(extractedDoc.content || extractedDoc.preview || '').length.toLocaleString()} chars</span>
          </div>

          <div className="whitespace-pre-wrap leading-relaxed text-slate-300 text-[11px]">
            {extractedDoc.content?.slice(0, 1500) || extractedDoc.preview?.slice(0, 1500) || 'Dokumen kosong.'}
            {(extractedDoc.content?.length || 0) > 1500 && (
              <div className="text-cyan-400/80 mt-2 font-bold">
                ... [{(extractedDoc.content.length - 1500).toLocaleString()} karakter lainnya siap diproses oleh JIN]
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center">
          <DataTelemetryTerminal colorCss={colorCss} />
        </div>
      )}

      {/* 3. Action Bar: Execute Analysis & Record to Drive F: */}
      <div className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-950/90 border border-cyan-500/30 shadow-lg flex-shrink-0">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
          <HardDrive className="w-4 h-4 text-emerald-400" />
          <span>Hasil analisis akan direkam otomatis ke <span className="text-cyan-300 font-bold">Drive F:\</span></span>
        </div>

        <button
          onClick={handleTriggerAnalysis}
          disabled={!extractedDoc || isExtracting || isAnalyzing}
          className={`px-5 py-2.5 rounded-xl font-mono text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shadow-lg ${
            extractedDoc && !isExtracting
              ? 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 shadow-[0_0_20px_rgba(0,229,255,0.5)] cursor-pointer hover:scale-105'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
          }`}
        >
          {isExtracting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
              <span>MENGEKSTRAKSI DOKUMEN...</span>
            </>
          ) : isAnalyzing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
              <span>JIN SEDANG MENGANALISIS...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>ANALISIS RISET & REKAM KE DRIVE F: âž”</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
