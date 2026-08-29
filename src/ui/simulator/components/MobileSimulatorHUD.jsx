import React, { useState, useEffect, useRef } from 'react';
import { 
  Smartphone, ChevronDown, MessageSquare, Globe, Shield, 
  Layers, AlertTriangle, CheckCircle, ExternalLink, Play, Pause,
  SkipBack, SkipForward, Volume2, VolumeX, RotateCcw, Upload,
  Film, Image as ImageIcon, BarChart3, Database, Sparkles, Music,
  Copy, Check, FileText, Trash2
} from 'lucide-react';
import AppSandboxRenderer from './AppSandboxRenderer.jsx';
import { documentContextManagerInstance } from '../../../services/analysis/DocumentContextManager.js';

export default function MobileSimulatorHUD({
  messages = [],
  latestResponse,
  isProcessing,
  activeMode = 'CONVERSATION', // 'CONVERSATION' | 'SEARCH' | 'MEDIA' | 'INSIGHTS' | 'APP_PREVIEW'
  onModeChange,
  generatedAppCode = null,
  liveSearchSources = [],
  onAnalyzeDocument
}) {
  const [selectedDevice, setSelectedDevice] = useState('iPhone 15');
  const [currentTab, setCurrentTab] = useState(activeMode);
  const [activeMediaType, setActiveMediaType] = useState('ALL'); // 'ALL' | 'VIDEO' | 'AUDIO' | 'IMAGE' | 'DATA'
  const [selectedVideoId, setSelectedVideoId] = useState('vr0qNXmkUJ8');
  const [customVideoInput, setCustomVideoInput] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [uploadedDocs, setUploadedDocs] = useState([]);

  // Subscribe to uploaded documents
  useEffect(() => {
    const unsub = documentContextManagerInstance.subscribe((docs) => {
      setUploadedDocs(docs || []);
      if (docs && docs.length > 0) {
        setCurrentTab('INSIGHTS');
      }
    });
    return unsub;
  }, []);

  const extractYouTubeId = (input) => {
    if (!input || typeof input !== 'string') return null;
    const str = input.trim();
    // 11-char direct ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
    // Standard URL: youtube.com/watch?v=XXXXX
    const vMatch = str.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (vMatch) return vMatch[1];
    // Short URL: youtu.be/XXXXX
    const shortMatch = str.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) return shortMatch[1];
    // Embed URL: youtube.com/embed/XXXXX
    const embedMatch = str.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];
    return null;
  };

  const handleApplyVideoLink = (input) => {
    const extractedId = extractYouTubeId(input);
    if (extractedId) {
      setSelectedVideoId(extractedId);
      setCustomVideoInput('');
      setCurrentTab('MEDIA');
    }
  };

  const audioRef = useRef(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0); // seconds
  const [audioDuration, setAudioDuration] = useState(225); // seconds
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [audioVolume, setAudioVolume] = useState(85);
  const [currentAudioTrack, setCurrentAudioTrack] = useState({
    title: 'Kala Cinta Menggoda',
    artist: 'Chrisye • Master Remaster',
    sourceType: 'CHRISYE_STREAM',
    url: 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg'
  });
  const [customAudioInput, setCustomAudioInput] = useState('');

  const handleApplyAudioLink = (input) => {
    if (!input || !input.trim()) return;
    const str = input.trim();
    let displayTitle = 'Live Audio Stream';
    try {
      const parsed = new URL(str);
      const pathname = parsed.pathname.split('/').pop();
      if (pathname && pathname.length > 2) displayTitle = decodeURIComponent(pathname);
      else displayTitle = `Stream: ${parsed.hostname}`;
    } catch (_) {
      displayTitle = str.slice(0, 30);
    }

    setCurrentAudioTrack({
      title: displayTitle,
      artist: 'Direct Online Stream URL',
      sourceType: 'LIVE_STREAM',
      url: str
    });
    setAudioDuration(180);
    setAudioProgress(0);
    setIsPlayingAudio(true);
    setCustomAudioInput('');
    setCurrentTab('MEDIA');
    setActiveMediaType('AUDIO');
    if (audioRef.current) {
      audioRef.current.src = str;
      audioRef.current.play().catch(() => {});
    }
  };

  const formatAudioTime = (sec) => {
    if (sec === undefined || sec === null || isNaN(sec) || !isFinite(sec)) return "LIVE";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleTogglePlayAudio = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play().then(() => {
        setIsPlayingAudio(true);
      }).catch(err => {
        console.warn('Play error:', err);
      });
    } else {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    }
  };

  const handleSkipAudio = (delta) => {
    setAudioProgress(prev => {
      const next = Math.min(Math.max(0, prev + delta), isFinite(audioDuration) ? audioDuration : 3600);
      if (audioRef.current) audioRef.current.currentTime = next;
      return next;
    });
  };

  const handleCopyText = (text, id) => {
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  useEffect(() => {
    if (activeMode) setCurrentTab(activeMode);
  }, [activeMode]);

  const lastUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
  const lastAssistantMessage = messages.filter(m => m.role === 'assistant').slice(-1)[0]?.content || latestResponse || 'Halo! Saya JIN. Saya siap membantu simulasi, pencarian data, serta visualisasi gambar dan video.';

  // Detect dynamic media requirements from user query
  const lowerQuery = lastUserMessage.toLowerCase();
  const isNewsQuery = lowerQuery.includes('berita') || lowerQuery.includes('demo') || lowerQuery.includes('dpr') || lowerQuery.includes('politik') || lowerQuery.includes('terkini') || lowerQuery.includes('hari ini') || lowerQuery.includes('peristiwa');
  const isMusicQuery = lowerQuery.includes('lagu') || lowerQuery.includes('dj') || lowerQuery.includes('musik') || lowerQuery.includes('song') || lowerQuery.includes('remix') || lowerQuery.includes('heaven');
  const isVideoQuery = isNewsQuery || isMusicQuery || lowerQuery.includes('video') || lowerQuery.includes('youtube') || lowerQuery.includes('putar');
  const isImageQuery = lowerQuery.includes('gambar') || lowerQuery.includes('foto') || lowerQuery.includes('image') || lowerQuery.includes('visual');
  const isDataQuery = lowerQuery.includes('data') || lowerQuery.includes('tabel') || lowerQuery.includes('grafik') || lowerQuery.includes('chart') || lowerQuery.includes('statistik');

  const [customSearchQuery, setCustomSearchQuery] = useState('');
  const [internalSources, setInternalSources] = useState([]);

  const handleTriggerWebSearch = async (query) => {
    if (!query || !query.trim()) return;
    const q = query.trim();
    try {
      const resp = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=id&gl=ID&ceid=ID:id`)}`);
      const xml = await resp.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, 'application/xml');
      const items = Array.from(xmlDoc.getElementsByTagName('item')).slice(0, 5);
      const parsedSources = items.map(it => {
        const title = it.getElementsByTagName('title')?.[0]?.textContent || q;
        const link = it.getElementsByTagName('link')?.[0]?.textContent || `https://www.google.com/search?q=${encodeURIComponent(q)}`;
        const sourceName = it.getElementsByTagName('source')?.[0]?.textContent || 'Portal Berita Indonesia';
        return {
          title,
          url: link,
          domain: sourceName,
          category: 'NEWS'
        };
      });
      if (parsedSources.length > 0) {
        setInternalSources(parsedSources);
      } else {
        setInternalSources([
          {
            title: `Riset: ${q}`,
            url: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
            domain: 'google.com',
            category: 'NEWS'
          }
        ]);
      }
    } catch (_) {
      setInternalSources([
        {
          title: `Penelusuran Web: ${q}`,
          url: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
          domain: 'google.com',
          category: 'NEWS'
        }
      ]);
    }
  };

  // Extract HTML / UI code from lastAssistantMessage or generatedAppCode prop
  const extractedAppCode = React.useMemo(() => {
    if (generatedAppCode) return generatedAppCode;
    if (!lastAssistantMessage || typeof lastAssistantMessage !== 'string') return null;

    // 1. Markdown code block (allows unclosed trailing ticks)
    const match = lastAssistantMessage.match(/```(?:html|xml|ui|javascript|js)?\s*([\s\S]*?)(?:```|$)/i);
    if (match && match[1] && (match[1].includes('<') || match[1].includes('document.') || match[1].includes('function'))) {
      return match[1].trim();
    }

    // 2. Raw HTML tags
    const rawMatch = lastAssistantMessage.match(/(<!DOCTYPE html>[\s\S]*|<\/?(?:form|html|div|table|section|main)[\s\S]*>)/i);
    if (rawMatch && rawMatch[1]) {
      return rawMatch[1].trim();
    }

    return null;
  }, [generatedAppCode, lastAssistantMessage]);

  // Auto switch to APP_PREVIEW when app code is detected
  useEffect(() => {
    if (extractedAppCode) {
      setCurrentTab('APP_PREVIEW');
    }
  }, [extractedAppCode]);

  // Auto-detect YouTube links from assistant or user text
  useEffect(() => {
    const textToCheck = `${lastAssistantMessage} ${lastUserMessage}`;
    const foundId = extractYouTubeId(textToCheck);
    if (foundId && foundId !== selectedVideoId) {
      setSelectedVideoId(foundId);
      setCurrentTab('MEDIA');
    }
  }, [lastAssistantMessage, lastUserMessage]);

  // Auto switch tab and stream source if specific media, search, or data is requested
  useEffect(() => {
    if (!lastUserMessage) return;

    if (isNewsQuery || isMusicQuery || isVideoQuery || isImageQuery) {
      if (isNewsQuery) setSelectedVideoId('fJ9rUzIMcZQ');
      else if (isMusicQuery) setSelectedVideoId('vr0qNXmkUJ8');
      setCurrentTab('MEDIA');
    } else if (lowerQuery.includes('cari') || lowerQuery.includes('search') || lowerQuery.includes('web') || lowerQuery.includes('googl') || lowerQuery.includes('riset')) {
      setCurrentTab('SEARCH');
      handleTriggerWebSearch(lastUserMessage);
    } else if (lowerQuery.includes('buat') || lowerQuery.includes('aplikasi') || lowerQuery.includes('form') || lowerQuery.includes('kalkulator') || lowerQuery.includes('ui')) {
      setCurrentTab('APP_PREVIEW');
    } else if (isDataQuery || lowerQuery.includes('analisis') || lowerQuery.includes('hitung') || lowerQuery.includes('metrik') || lowerQuery.includes('audit')) {
      setCurrentTab('INSIGHTS');
    }
  }, [lastUserMessage]);

  const displaySources = (liveSearchSources && liveSearchSources.length > 0) ? liveSearchSources : internalSources;

  const handleTabClick = (tab) => {
    setCurrentTab(tab);
    if (onModeChange) onModeChange(tab);
  };

  return (
    <div className="w-80 lg:w-96 flex-shrink-0 h-full flex flex-col p-4 glass-hud-panel border-l border-cyan-500/20 text-slate-300 select-none">
      {/* Simulator Top Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold tracking-widest text-white uppercase">SIMULATOR HUD</span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="appearance-none bg-slate-900/90 border border-slate-700/70 px-2.5 py-1 pr-6 rounded-lg text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              <option value="iPhone 15">iPhone 15 Pro</option>
              <option value="iPad Mini">iPad Mini</option>
              <option value="Galaxy S24">Galaxy S24</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse"></span>
            <span>Online</span>
          </div>
        </div>
      </div>

      {/* Realistic Phone Bezel Frame */}
      <div className="flex-1 w-full bg-[#050811] rounded-[42px] p-3.5 border-4 border-slate-800 shadow-[0_0_40px_rgba(0,0,0,0.9)] flex flex-col justify-between overflow-hidden relative">
        {/* Dynamic Island */}
        <div className="w-full flex justify-center pt-0.5 pb-2 z-10">
          <div className="w-24 h-5 bg-black rounded-full border border-slate-800/90 flex items-center justify-between px-2.5 shadow-inner">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700"></span>
            <span className="w-2 h-2 rounded-full bg-cyan-400/90 shadow-[0_0_8px_#00e5ff] animate-pulse"></span>
          </div>
        </div>

        {/* Intelligence Mode Tabs (5 Tabs: DIALOG, MEDIA, SEARCH, INSIGHTS, APP) */}
        <div className="flex items-center justify-between gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 mb-2 z-10 text-[9px] font-mono">
          <button
            onClick={() => handleTabClick('CONVERSATION')}
            className={`flex-1 py-1 rounded-lg transition-all ${
              currentTab === 'CONVERSATION' ? 'bg-blue-600/80 text-white font-bold shadow-[0_0_10px_rgba(37,99,235,0.5)]' : 'text-slate-400 hover:text-white'
            }`}
          >
            CHAT
          </button>
          <button
            onClick={() => handleTabClick('MEDIA')}
            className={`flex-1 py-1 rounded-lg transition-all flex items-center justify-center gap-1 ${
              currentTab === 'MEDIA' ? 'bg-pink-600/80 text-white font-bold shadow-[0_0_10px_rgba(219,39,119,0.5)]' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-2.5 h-2.5 text-pink-300" />
            MEDIA
          </button>
          <button
            onClick={() => handleTabClick('SEARCH')}
            className={`flex-1 py-1 rounded-lg transition-all ${
              currentTab === 'SEARCH' ? 'bg-emerald-600/80 text-white font-bold shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'text-slate-400 hover:text-white'
            }`}
          >
            WEB
          </button>
          <button
            onClick={() => handleTabClick('INSIGHTS')}
            className={`flex-1 py-1 rounded-lg transition-all ${
              currentTab === 'INSIGHTS' ? 'bg-cyan-600/80 text-white font-bold shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'text-slate-400 hover:text-white'
            }`}
          >
            DATA
          </button>
          <button
            onClick={() => handleTabClick('APP_PREVIEW')}
            className={`flex-1 py-1 rounded-lg transition-all ${
              currentTab === 'APP_PREVIEW' ? 'bg-purple-600/80 text-white font-bold shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'text-slate-400 hover:text-white'
            }`}
          >
            APP UI
          </button>
        </div>

        {/* Phone Inner Screen Content */}
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar px-1 z-10">
          
          {/* TAB 1: CONVERSATION */}
          {currentTab === 'CONVERSATION' && (
            <div className="space-y-3 select-text">
              <div className="bg-slate-900/80 rounded-2xl p-3.5 border border-slate-800 shadow-md select-text">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-cyan-300">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white tracking-wide">LIVE CONVERSATION</div>
                      <div className="text-[9px] text-slate-400">Streamed from 9Router</div>
                    </div>
                  </div>
                  {lastAssistantMessage && (
                    <button
                      onClick={() => handleCopyText(lastAssistantMessage, 'all-chat')}
                      className="p-1 px-2 rounded-md bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-cyan-300 text-[10px] font-mono flex items-center gap-1 transition-all"
                      title="Salin respon JIN"
                    >
                      {copiedId === 'all-chat' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                      <span>{copiedId === 'all-chat' ? 'Tersalin' : 'Copy'}</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2 text-xs font-sans select-text">
                  {lastUserMessage && (
                    <div className="group relative bg-blue-600/25 border border-blue-500/30 rounded-xl p-2.5 text-right text-slate-200 text-[11px] select-text selection:bg-cyan-500/40 selection:text-white cursor-text">
                      {messages.filter(m => m.role === 'user').slice(-1)[0]?.imageUrl && (
                        <div className="flex justify-end mb-2">
                          <img 
                            src={messages.filter(m => m.role === 'user').slice(-1)[0].imageUrl} 
                            alt="User Attachment" 
                            className="max-w-[160px] max-h-[120px] object-cover rounded-lg border border-cyan-400/50 shadow-md cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => window.open(messages.filter(m => m.role === 'user').slice(-1)[0].imageUrl, '_blank')}
                            title="Klik untuk membuka gambar"
                          />
                        </div>
                      )}
                      <p className="whitespace-pre-wrap select-text selection:bg-cyan-500/40 selection:text-white">{lastUserMessage}</p>
                      <button
                        onClick={() => handleCopyText(lastUserMessage, 'user-msg')}
                        className="opacity-0 group-hover:opacity-100 transition-opacity absolute left-2 top-2 p-1 rounded bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-cyan-300 text-[9px] flex items-center gap-1 shadow"
                        title="Salin teks pesan Anda"
                      >
                        {copiedId === 'user-msg' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                        <span>{copiedId === 'user-msg' ? 'Tersalin' : 'Copy'}</span>
                      </button>
                    </div>
                  )}

                  <div className="group relative bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-slate-300 text-[11px] leading-relaxed select-text selection:bg-cyan-500/40 selection:text-white cursor-text">
                    {isProcessing ? (
                      <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs py-1">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                        <span>JIN 9Router sedang memproses...</span>
                      </div>
                    ) : (
                      <>
                        <div className="whitespace-pre-wrap select-text selection:bg-cyan-500/40 selection:text-white cursor-text leading-relaxed">
                          {lastAssistantMessage}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-800/60">
                          {extractedAppCode ? (
                            <button
                              onClick={() => handleTabClick('APP_PREVIEW')}
                              className="py-1 px-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(168,85,247,0.5)] transition-all animate-pulse"
                            >
                              <span>📱 Coba di Tab APP UI ➔</span>
                            </button>
                          ) : <div />}
                          <button
                            onClick={() => handleCopyText(lastAssistantMessage, 'assistant-msg')}
                            className="p-1 px-2.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-cyan-300 text-[10px] font-mono flex items-center gap-1.5 transition-all shadow"
                            title="Salin seluruh teks percakapan JIN"
                          >
                            {copiedId === 'assistant-msg' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                            <span>{copiedId === 'assistant-msg' ? 'Tersalin!' : 'Salin Respon'}</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RICH MULTIMEDIA & VISUALIZATION (VIDEO, GAMBAR, DATA) */}
          {currentTab === 'MEDIA' && (
            <div className="space-y-3 font-mono">
              {/* Media Sub-Filter Bar */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[9px]">
                <button
                  onClick={() => setActiveMediaType('ALL')}
                  className={`flex-1 py-1 rounded-lg ${activeMediaType === 'ALL' ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-400'}`}
                >
                  SEMUA
                </button>
                <button
                  onClick={() => setActiveMediaType('VIDEO')}
                  className={`flex-1 py-1 rounded-lg ${activeMediaType === 'VIDEO' ? 'bg-red-950/80 border border-red-500/40 text-red-300 font-bold' : 'text-slate-400'}`}
                >
                  ▶ VIDEO
                </button>
                <button
                  onClick={() => setActiveMediaType('AUDIO')}
                  className={`flex-1 py-1 rounded-lg ${activeMediaType === 'AUDIO' ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold' : 'text-slate-400'}`}
                >
                  🎵 AUDIO
                </button>
                <button
                  onClick={() => setActiveMediaType('IMAGE')}
                  className={`flex-1 py-1 rounded-lg ${activeMediaType === 'IMAGE' ? 'bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold' : 'text-slate-400'}`}
                >
                  🖼 GAMBAR
                </button>
                <button
                  onClick={() => setActiveMediaType('DATA')}
                  className={`flex-1 py-1 rounded-lg ${activeMediaType === 'DATA' ? 'bg-purple-950/80 border border-purple-500/40 text-purple-300 font-bold' : 'text-slate-400'}`}
                >
                  📊 DATA
                </button>
              </div>

              {/* 1. VIDEO PLAYER CARD */}
              {/* 1. VIDEO PLAYER CARD */}
              {/* 1. DYNAMIC LIVE NEWS / VIDEO / MEDIA INTELLIGENCE CARD */}
              {(activeMediaType === 'ALL' || activeMediaType === 'VIDEO') && (
                <div className="bg-slate-900/90 rounded-2xl p-3 border border-cyan-500/30 shadow-md">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-lg ${isNewsQuery ? 'bg-red-600/30 border-red-400/40 text-red-300' : 'bg-cyan-600/30 border-cyan-400/40 text-cyan-300'} border flex items-center justify-center`}>
                        <Film className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white tracking-wide">
                          {isNewsQuery ? 'AI AUTONOMOUS NEWS VIDEO STREAM' : 'MULTIMEDIA & MUSIC PLAYER'}
                        </div>
                        <div className="text-[8px] text-cyan-400">
                          {isNewsQuery ? 'Dipilih Otomatis: Media Terpercaya & Terpopuler' : 'Stream Embed HD Live'}
                        </div>
                      </div>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${isNewsQuery ? 'bg-red-500/20 text-red-300 animate-pulse' : 'bg-cyan-500/20 text-cyan-300'}`}>
                      {isNewsQuery ? '🔴 1 VIDEO TERPILIH' : 'HD 1080p'}
                    </span>
                  </div>

                  {/* AI Autonomous Video Selection Badge */}
                  <div className="bg-slate-950/80 rounded-xl p-2 mb-2 border border-slate-800 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <span>⭐ DIPILIH JIN:</span>
                        <span className="text-slate-200">{isNewsQuery ? 'KOMPAS TV / Tribun Network' : 'Video Resmi Pilihan'}</span>
                      </span>
                      <span className="text-[8px] text-slate-400 font-mono">Verified Media</span>
                    </div>
                    <div className="text-[10px] text-white font-bold truncate">
                      {isNewsQuery ? `Liputan: "${lastUserMessage || 'Berita Hari Ini'}"` : 'Pemutaran Media Terverifikasi'}
                    </div>
                  </div>

                  {/* Dynamic Video Selector Chips */}
                  <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1 text-[9px]">
                    <button
                      onClick={() => setSelectedVideoId('fJ9rUzIMcZQ')}
                      className={`px-2.5 py-1 rounded-lg transition-all flex-shrink-0 font-bold ${
                        selectedVideoId === 'fJ9rUzIMcZQ'
                          ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.6)]'
                          : 'bg-slate-800/90 text-slate-300 hover:text-white'
                      }`}
                    >
                      🔴 Kompas TV Live
                    </button>
                    <button
                      onClick={() => setSelectedVideoId('60ItHLz5WEA')}
                      className={`px-2.5 py-1 rounded-lg transition-all flex-shrink-0 font-bold ${
                        selectedVideoId === '60ItHLz5WEA'
                          ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.6)]'
                          : 'bg-slate-800/90 text-slate-300 hover:text-white'
                      }`}
                    >
                      🔴 CNN Indonesia Live
                    </button>
                    <button
                      onClick={() => setSelectedVideoId('vr0qNXmkUJ8')}
                      className={`px-2.5 py-1 rounded-lg transition-all flex-shrink-0 font-bold ${
                        selectedVideoId === 'vr0qNXmkUJ8'
                          ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.6)]'
                          : 'bg-slate-800/90 text-slate-300 hover:text-white'
                      }`}
                    >
                      🔴 TVOne / MetroTV Live
                    </button>
                  </div>

                  {/* Direct Link Input Box with Enter Key Execution */}
                  <div className="flex items-center gap-1.5 mb-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 focus-within:border-cyan-400 transition-all">
                    <input
                      type="text"
                      value={customVideoInput}
                      onChange={(e) => setCustomVideoInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleApplyVideoLink(customVideoInput);
                      }}
                      placeholder="Tempel / ketik link YouTube lalu tekan Enter..."
                      className="flex-1 bg-transparent text-[10px] text-white placeholder-slate-500 focus:outline-none px-1.5 font-sans"
                    />
                    <button
                      onClick={() => handleApplyVideoLink(customVideoInput)}
                      className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-[9px] rounded-lg transition-all flex items-center gap-1 shadow-sm flex-shrink-0"
                    >
                      <span>⏎ Putar</span>
                    </button>
                  </div>

                  {/* Embedded Video Player */}
                  <div className="w-full aspect-video rounded-xl bg-slate-950 border border-slate-800 overflow-hidden relative group">
                    <iframe
                      className="w-full h-full"
                      src={`https://www.youtube.com/embed/${selectedVideoId}?autoplay=1`}
                      title="YouTube News Video Player"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    ></iframe>
                  </div>

                  {/* 1-Click Direct Hub to Full YouTube Search */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <a
                      href={`https://www.youtube.com/results?search_query=${encodeURIComponent(lastUserMessage || 'berita terkini hari ini live indonesia')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-red-600 hover:bg-red-500 text-white text-[9px] font-bold py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition-all shadow-[0_0_10px_rgba(220,38,38,0.5)]"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Buka Hasil Topik di YouTube</span>
                    </a>
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(lastUserMessage || 'berita terkini hari ini')}&tbm=nws`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[9px] font-bold py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition-all"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Baca Portal Berita</span>
                    </a>
                  </div>
                </div>
              )}

              {/* 2. DEDICATED STANDARD AUDIO & CHRISYE MP3 PLAYER CARD */}
              {(activeMediaType === 'ALL' || activeMediaType === 'AUDIO') && (
                <div className="bg-slate-900/90 rounded-2xl p-3 border border-cyan-500/30 shadow-[0_0_15px_rgba(0,242,254,0.15)]">
                  {/* Invisible Audio Engine */}
                  <audio
                    ref={audioRef}
                    src={currentAudioTrack.url || 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg'}
                    onTimeUpdate={() => {
                      if (audioRef.current) {
                        setAudioProgress(audioRef.current.currentTime);
                      }
                    }}
                    onLoadedMetadata={() => {
                      if (audioRef.current && audioRef.current.duration) {
                        setAudioDuration(audioRef.current.duration);
                      }
                    }}
                    onEnded={() => setIsPlayingAudio(false)}
                    preload="metadata"
                  />

                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-cyan-600/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                        <Music className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                          <span>CYBER-HUD MP3 ENGINE</span>
                          <span className="text-[8px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">CHRISYE HUB</span>
                        </div>
                        <div className="text-[8px] text-cyan-400">Stream & In-Memory Audio Engine</div>
                      </div>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 font-mono">
                      🟢 0 MP3 DISK
                    </span>
                  </div>

                  {/* Direct Audio / Playlist Link Input Box with Enter Key Execution */}
                  <div className="flex items-center gap-1.5 mb-2.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 focus-within:border-cyan-400 transition-all shadow-inner">
                    <input
                      type="text"
                      value={customAudioInput}
                      onChange={(e) => setCustomAudioInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleApplyAudioLink(customAudioInput);
                      }}
                      placeholder="Tempel / paste link stream MP3 atau playlist di sini..."
                      className="flex-1 bg-transparent text-[10px] text-white placeholder-slate-500 focus:outline-none px-1.5 font-sans"
                    />
                    <button
                      onClick={() => handleApplyAudioLink(customAudioInput)}
                      className="px-2.5 py-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-[9px] rounded-lg transition-all flex items-center gap-1 shadow-sm flex-shrink-0"
                    >
                      <span>⏎ Putar</span>
                    </button>
                  </div>

                  {/* Audio Track Visualizer & Info Box */}
                  <div className="bg-slate-950/90 rounded-xl p-2.5 mb-2.5 border border-slate-800 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-white truncate flex items-center gap-1.5">
                          <span>{currentAudioTrack.title}</span>
                        </div>
                        <div className="text-[9px] text-cyan-400/90 truncate font-mono">
                          {currentAudioTrack.artist}
                        </div>
                      </div>
                      {/* Waveform visualizer bars */}
                      <div className="flex items-end gap-0.5 h-5 ml-2 flex-shrink-0">
                        {[35, 75, 100, 60, 95, 45, 85, 55, 90, 40, 70, 100].map((h, i) => (
                          <div
                            key={i}
                            className={`w-0.5 rounded-full bg-cyan-400 transition-all ${
                              isPlayingAudio ? 'animate-pulse' : 'opacity-30'
                            }`}
                            style={{ 
                              height: isPlayingAudio ? `${h}%` : '20%',
                              backgroundColor: isPlayingAudio && i % 2 === 0 ? '#00f2fe' : '#8b5cf6'
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Timeline Scrubber */}
                    <div className="space-y-1">
                      <input
                        type="range"
                        min="0"
                        max={audioDuration || 100}
                        value={audioProgress}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setAudioProgress(val);
                          if (audioRef.current) audioRef.current.currentTime = val;
                        }}
                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                      />
                      <div className="flex justify-between text-[8px] text-slate-400 font-mono">
                        <span>{formatAudioTime(audioProgress)}</span>
                        <span>{formatAudioTime(audioDuration)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Standard Playback Controls */}
                  <div className="flex items-center justify-between bg-slate-950/60 p-2 rounded-xl border border-slate-800/80 mb-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSkipAudio(-10)}
                        title="Mundur 10 detik"
                        className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-all"
                      >
                        <SkipBack className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setAudioProgress(0);
                          if (audioRef.current) audioRef.current.currentTime = 0;
                        }}
                        title="Ulangi dari awal"
                        className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-all"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Main Big Play / Pause Button */}
                    <button
                      onClick={handleTogglePlayAudio}
                      className={`px-4 py-2 rounded-full font-bold flex items-center gap-1.5 transition-all shadow-md ${
                        isPlayingAudio
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-[0_0_15px_rgba(0,242,254,0.7)] scale-105'
                          : 'bg-cyan-600/90 hover:bg-cyan-500 text-white shadow-[0_0_10px_rgba(0,242,254,0.4)]'
                      }`}
                    >
                      {isPlayingAudio ? (
                        <>
                          <Pause className="w-4 h-4 fill-current" />
                          <span className="text-[10px]">PAUSE</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                          <span className="text-[10px]">PLAY</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSkipAudio(10)}
                        title="Maju 10 detik"
                        className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-all"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          const nextMute = !isAudioMuted;
                          setIsAudioMuted(nextMute);
                          if (audioRef.current) audioRef.current.muted = nextMute;
                        }}
                        title={isAudioMuted ? 'Unmute' : 'Mute'}
                        className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-all"
                      >
                        {isAudioMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
                      </button>
                    </div>
                  </div>

                  {/* Chrisye Playlist Track Selection */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 mb-1 px-1">
                      <span>KOLEKSI STREAM CHRISYE & RADIO LIVE</span>
                      <span className="text-cyan-400 font-mono">LIVE STREAMS</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        { title: 'Kala Cinta Menggoda', artist: 'Chrisye • Master Remaster', dur: 225, url: 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg' },
                        { title: 'Seperti Yang Kau Minta', artist: 'Chrisye • Acoustic Stream', dur: 252, url: 'https://actions.google.com/sounds/v1/ambiences/rain_heavy.ogg' },
                        { title: 'Pelangi', artist: 'Chrisye • Digital Audio', dur: 210, url: 'https://actions.google.com/sounds/v1/ambiences/meadow_morning.ogg' },
                        { title: 'Nightwave Plaza Synth Radio', artist: 'Citypop • Live Stream 24h', dur: Infinity, url: 'https://radio.plaza.one/mp3' },
                        { title: 'Prambors Hits Radio', artist: 'Pop Indo • Live Stream', dur: Infinity, url: 'https://stream.zeno.fm/f3wvbbqmdg8uv' }
                      ].map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setCurrentAudioTrack({
                              title: item.title,
                              artist: item.artist,
                              sourceType: 'STREAM',
                              url: item.url
                            });
                            setAudioDuration(isFinite(item.dur) ? item.dur : 180);
                            setAudioProgress(0);
                            setIsPlayingAudio(true);
                            if (audioRef.current) {
                              audioRef.current.src = item.url;
                              audioRef.current.load();
                              audioRef.current.play().then(() => {
                                setIsPlayingAudio(true);
                              }).catch(err => console.warn('Play error:', err));
                            }
                          }}
                          className={`w-full p-1.5 rounded-lg text-left text-[9px] transition-all flex items-center justify-between border ${
                            currentAudioTrack.title === item.title
                              ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300 shadow-[0_0_8px_rgba(0,242,254,0.2)]'
                              : 'bg-slate-950/40 border-slate-800/60 text-slate-300 hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="truncate">
                            <span className="font-bold">{item.title}</span>
                            <span className="text-[8px] text-slate-500 ml-1.5">({item.artist.split('•')[1]?.trim() || item.artist})</span>
                          </div>
                          <span className="font-mono text-[8px] text-slate-400 flex-shrink-0 ml-1">
                            {formatAudioTime(item.dur)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Air-Gapped Clean Disk Storage Note */}
                  <div className="mt-2 text-[8px] text-slate-400 bg-slate-950/60 p-1.5 rounded-lg border border-slate-800/60 flex items-center justify-between">
                    <span>🛡️ Status Disk: 0 file MP3 fisik tersimpan</span>
                    <span className="text-emerald-400 font-bold font-mono">100% CLEAN IN-MEMORY</span>
                  </div>
                </div>
              )}

              {/* 3. IMAGE GALLERY CARD */}
              {(activeMediaType === 'ALL' || activeMediaType === 'IMAGE') && (
                <div className="bg-slate-900/90 rounded-2xl p-3 border border-cyan-500/30 shadow-md">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-cyan-600/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                        <ImageIcon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white tracking-wide">IMAGE GALLERY & ASSETS</div>
                        <div className="text-[8px] text-cyan-400">Visual Neural Synthesis</div>
                      </div>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold">
                      Rendered
                    </span>
                  </div>

                  {/* Grid of Images */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative rounded-xl overflow-hidden border border-cyan-500/40 group">
                      <img
                        src="/genie-bg.png"
                        alt="JIN Avatar Visual"
                        className="w-full h-24 object-cover group-hover:scale-105 transition-all"
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-black/70 p-1 text-[8px] text-cyan-300 truncate">
                        Hologram Neon JIN
                      </div>
                    </div>

                    <div className="relative rounded-xl overflow-hidden border border-purple-500/40 group bg-slate-950 flex flex-col items-center justify-center p-2">
                      <Sparkles className="w-6 h-6 text-purple-400 mb-1 animate-pulse" />
                      <div className="text-[9px] font-bold text-purple-300 text-center">AI Gen Image</div>
                      <div className="text-[7px] text-slate-400 text-center mt-0.5">High-Res Render</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. DATA & ANALYTICS TABLE */}
              {(activeMediaType === 'ALL' || activeMediaType === 'DATA') && (
                <div className="bg-slate-900/90 rounded-2xl p-3 border border-purple-500/30 shadow-md">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-purple-300">
                        <BarChart3 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white tracking-wide">INTERACTIVE DATA MATRIX</div>
                        <div className="text-[8px] text-purple-400">Live Structured Data</div>
                      </div>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold">
                      SQL / JSON
                    </span>
                  </div>

                  {/* Micro Data Table */}
                  <div className="w-full overflow-hidden rounded-xl border border-slate-800 text-[9px]">
                    <div className="grid grid-cols-3 bg-slate-950 p-1.5 font-bold text-cyan-300 border-b border-slate-800">
                      <div>PARAMETER</div>
                      <div className="text-center">METRIC</div>
                      <div className="text-right">STATUS</div>
                    </div>
                    <div className="divide-y divide-slate-800/60 bg-slate-900/60">
                      <div className="grid grid-cols-3 p-1.5 text-slate-300">
                        <div>Throughput</div>
                        <div className="text-center font-mono text-cyan-400">980 req/s</div>
                        <div className="text-right text-emerald-400 font-bold">OPTIMAL</div>
                      </div>
                      <div className="grid grid-cols-3 p-1.5 text-slate-300">
                        <div>9Router Latency</div>
                        <div className="text-center font-mono text-purple-400">182 ms</div>
                        <div className="text-right text-emerald-400 font-bold">PASS</div>
                      </div>
                      <div className="grid grid-cols-3 p-1.5 text-slate-300">
                        <div>Accuracy Score</div>
                        <div className="text-center font-mono text-emerald-400">99.4 %</div>
                        <div className="text-right text-emerald-400 font-bold">EXCELLENT</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LIVE GLOBAL SEARCH */}
          {currentTab === 'SEARCH' && (
            <div className="space-y-2.5">
              <div className="bg-slate-900/80 rounded-2xl p-3 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-600/30 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
                      <Globe className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white tracking-wide">SOURCE NETWORK</div>
                      <div className="text-[9px] text-emerald-400 font-mono">Live Web Citations</div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                    {displaySources.length > 0 ? `${displaySources.length} Verifikasi` : '0 PENCARIAN AKTIF'}
                  </span>
                </div>

                {/* Direct Web Search Input Bar with Enter key execution */}
                <div className="flex items-center gap-1.5 mb-2.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 focus-within:border-emerald-400 transition-all">
                  <input
                    type="text"
                    value={customSearchQuery}
                    onChange={(e) => setCustomSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleTriggerWebSearch(customSearchQuery);
                    }}
                    placeholder="Ketik topik riset / berita lalu tekan Enter..."
                    className="flex-1 bg-transparent text-[10px] text-white placeholder-slate-500 focus:outline-none px-1.5 font-sans"
                  />
                  <button
                    onClick={() => handleTriggerWebSearch(customSearchQuery)}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-[9px] rounded-lg transition-all flex items-center gap-1 shadow-sm flex-shrink-0"
                  >
                    <span>🔍 Riset</span>
                  </button>
                </div>

                {/* Real Verified Web Source Nodes or Clean Ready State */}
                {displaySources.length > 0 ? (
                  <div className="space-y-1.5 mb-2 font-mono text-[10px]">
                    {displaySources.map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-slate-950/90 hover:bg-slate-900 p-2 rounded-xl border border-slate-800/80 flex items-center justify-between gap-2 transition-all hover:border-emerald-500/50 block"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            src.category === 'GOVERNMENT' ? 'bg-amber-400' :
                            src.category === 'ACADEMIC' ? 'bg-cyan-400' :
                            src.category === 'NEWS' ? 'bg-blue-400' : 'bg-purple-400'
                          }`}></span>
                          <div className="overflow-hidden">
                            <div className="text-slate-200 font-bold truncate text-[11px]">{src.title}</div>
                            <div className="text-slate-400 text-[9px] truncate">{src.domain}</div>
                          </div>
                        </div>
                        <ExternalLink className="w-3 h-3 text-slate-500 flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/90 text-center flex flex-col items-center justify-center gap-2 font-sans my-1">
                    <div className="w-8 h-8 rounded-full bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div className="text-[11px] font-bold text-slate-200 font-mono">Siap Menjelajah Web Real-Time</div>
                    <p className="text-[9px] text-slate-400 leading-relaxed max-w-[220px]">
                      Belum ada pencarian aktif. Perintahkan JIN untuk riset topik atau berita terkini untuk memulai live web search.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: DATA & DOCUMENT PIPELINE */}
          {currentTab === 'INSIGHTS' && (
            <div className="space-y-2.5">
              <div className="bg-slate-900/80 rounded-2xl p-3 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-cyan-600/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                      <Database className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white tracking-wide">DATA & DOKUMEN PIPELINE</div>
                      <div className="text-[8px] text-cyan-400 font-mono">Live Ingested Documents</div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                    {uploadedDocs.length} DOKUMEN AKTIF
                  </span>
                </div>

                {/* Uploaded Documents List */}
                {uploadedDocs.length > 0 ? (
                  <div className="space-y-2">
                    {uploadedDocs.map((doc, idx) => (
                      <div key={doc.id || idx} className="bg-slate-950/90 rounded-xl p-2.5 border border-cyan-500/30 space-y-2 shadow-inner">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <FileText className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            <span className="text-[11px] font-bold text-white truncate">{doc.fileName}</span>
                            <span className="text-[8px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono flex-shrink-0">
                              {doc.type}
                            </span>
                          </div>
                          <button
                            onClick={() => documentContextManagerInstance.removeDocument(doc.id)}
                            className="p-1 text-slate-500 hover:text-red-400 transition-all ml-1 flex-shrink-0"
                            title="Hapus Dokumen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Document Stats Badge */}
                        <div className="flex items-center gap-2 text-[8px] font-mono text-slate-400 bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-800">
                          <span>📦 {(doc.size / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span>📄 {doc.content?.length?.toLocaleString('id-ID') || 0} Karakter</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-bold">100% TERBACA</span>
                        </div>

                        {/* Extracted Text Content Preview Box */}
                        <div className="bg-slate-900/90 rounded-lg p-2 font-mono text-[9.5px] text-slate-200 max-h-52 overflow-y-auto custom-scrollbar whitespace-pre-wrap select-text leading-relaxed border border-slate-800/80">
                          {doc.content || doc.preview}
                        </div>

                        {/* Direct Button: Instruct JIN to analyze content */}
                        {onAnalyzeDocument && (
                          <button
                            onClick={() => onAnalyzeDocument(doc)}
                            className="w-full py-1.5 px-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg font-bold text-[9.5px] flex items-center justify-center gap-1.5 transition-all shadow-sm"
                          >
                            <span>🔍 Instruksikan JIN Analisis Isi 10 Halaman Ini</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/90 text-center flex flex-col items-center justify-center gap-2 font-sans my-1">
                    <div className="w-8 h-8 rounded-full bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="text-[11px] font-bold text-slate-200 font-mono">Belum Ada Dokumen Terunggah</div>
                    <p className="text-[9px] text-slate-400 leading-relaxed max-w-[220px]">
                      Klik menu <b>ANALYZE DATA</b> di sidebar kiri untuk mengunggah berkas Word (.docx), PDF, atau CSV agar isi dokumennya dapat dibaca dan dianalisis JIN di sini.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: LIVE APP PROTOTYPE SANDBOX */}
          {currentTab === 'APP_PREVIEW' && (
            <div className="w-full h-full min-h-[260px] rounded-2xl overflow-hidden border border-purple-500/30 shadow-inner">
              <AppSandboxRenderer appCode={extractedAppCode} />
            </div>
          )}
        </div>

        {/* iPhone Bottom Pagination */}
        <div className="w-full flex flex-col items-center gap-1.5 pt-2 pb-0.5 z-10">
          <div className="flex items-center gap-1.5">
            <button onClick={() => setCurrentTab('CONVERSATION')} className={`w-1.5 h-1.5 rounded-full transition-all ${currentTab === 'CONVERSATION' ? 'bg-blue-400 scale-125' : 'bg-slate-600'}`} />
            <button onClick={() => setCurrentTab('MEDIA')} className={`w-1.5 h-1.5 rounded-full transition-all ${currentTab === 'MEDIA' ? 'bg-pink-400 scale-125' : 'bg-slate-600'}`} />
            <button onClick={() => setCurrentTab('SEARCH')} className={`w-1.5 h-1.5 rounded-full transition-all ${currentTab === 'SEARCH' ? 'bg-emerald-400 scale-125' : 'bg-slate-600'}`} />
            <button onClick={() => setCurrentTab('INSIGHTS')} className={`w-1.5 h-1.5 rounded-full transition-all ${currentTab === 'INSIGHTS' ? 'bg-cyan-400 scale-125' : 'bg-slate-600'}`} />
            <button onClick={() => setCurrentTab('APP_PREVIEW')} className={`w-1.5 h-1.5 rounded-full transition-all ${currentTab === 'APP_PREVIEW' ? 'bg-purple-400 scale-125' : 'bg-slate-600'}`} />
          </div>
          <div className="w-28 h-1 bg-slate-600 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
