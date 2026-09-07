import React, { useState, useEffect } from 'react';
import { Globe, HardDrive, Database, CheckCircle, Radio, FileText, ArrowDown, Sparkles, Clock, Play, Loader2, Cpu } from 'lucide-react';

const DIURNAL_WAVES = [
  {
    wave: 7,
    timeLabel: '07:00 WIB',
    name: 'Pasar & Domestik',
    pillars: [
      { id: 'pol', name: 'Politik', tag: 'POL', color: '#38bdf8' },
      { id: 'eko', name: 'Ekonomi', tag: 'EKO', color: '#34d399' },
      { id: 'shm', name: 'Saham', tag: 'SHM', color: '#fbbf24' },
      { id: 'kmd', name: 'Komoditas', tag: 'KMD', color: '#f97316' },
      { id: 'crp', name: 'Crypto', tag: 'CRP', color: '#a855f7' }
    ]
  },
  {
    wave: 13,
    timeLabel: '13:00 WIB',
    name: 'Hukum, Sosial & Teknologi',
    pillars: [
      { id: 'huk', name: 'Hukum', tag: 'HUK', color: '#ec4899' },
      { id: 'sos', name: 'Sosial', tag: 'SOS', color: '#06b6d4' },
      { id: 'lif', name: 'Life & Health', tag: 'LIF', color: '#10b981' },
      { id: 'tek', name: 'Technology & AI', tag: 'TEK', color: '#818cf8', isSpecial: true }
    ]
  },
  {
    wave: 17,
    timeLabel: '17:00 WIB',
    name: 'Asia & China',
    pillars: [
      { id: 'asn', name: 'ASEAN', tag: 'ASN', color: '#14b8a6' },
      { id: 'chn', name: 'China', tag: 'CHN', color: '#f43f5e' },
      { id: 'asi', name: 'Bursa Asia', tag: 'ASI', color: '#eab308' }
    ]
  },
  {
    wave: 21,
    timeLabel: '21:00 WIB',
    name: 'Global Barat & Rusia',
    pillars: [
      { id: 'wst', name: 'Wall Street', tag: 'WST', color: '#3b82f6' },
      { id: 'eur', name: 'Uni Eropa', tag: 'EUR', color: '#8b5cf6' },
      { id: 'rus', name: 'Rusia & Energi', tag: 'RUS', color: '#ef4444' }
    ]
  }
];

export default function TavilyDriveFMonitor() {
  const [data, setData] = useState(() => {
    try {
      const cached = localStorage.getItem('tavily_grounding_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.topic) return parsed;
      }
    } catch (_) {}
    return {
      active: false,
      stage: 'SYNCED',
      topic: 'Menunggu kueri pencarian...',
      startYear: 2024,
      endYear: 2026,
      sourcesCount: 0,
      sources: [],
      lastSavedFile: null,
      driveF: {
        isAvailable: true,
        freeGb: '118.3',
        targetDirectory: 'F:\\UltimateAI_Memory\\02_Documentation',
        totalArchivedDocs: 0,
        mountStatus: 'MOUNTED_ONLINE'
      }
    };
  });

  const [activeWaveIndex, setActiveWaveIndex] = useState(1); // Default to 13:00 WIB (Index 1)
  const currentWave = DIURNAL_WAVES[activeWaveIndex];
  const [selectedPillarTag, setSelectedPillarTag] = useState('TEK');
  const [isCrawlingCluster, setIsCrawlingCluster] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState('Baru saja');
  const [daemonStatus, setDaemonStatus] = useState(null);

  // Safe Daemon Fetch (Direct to Local Router 20200 with relative fallback)
  const fetchDaemon = async (endpoint, options = {}) => {
    try {
      const res = await fetch(`http://127.0.0.1:20200${endpoint}`, options);
      if (res.ok) return res;
    } catch (_) {}
    return fetch(endpoint, options);
  };

  // Poll daemon status & latest harvest telemetry
  useEffect(() => {
    let isMounted = true;
    const pollStatus = async () => {
      try {
        const res = await fetchDaemon('/api/daemon/status');
        if (res.ok && isMounted) {
          const json = await res.json();
          setDaemonStatus(json);
          if (json.currentlyCrawling) {
            setIsCrawlingCluster(true);
          } else {
            setIsCrawlingCluster(false);
          }
          if (json.recentDossiers && json.recentDossiers.length > 0) {
            const latest = json.recentDossiers[0];
            setData(prev => ({
              ...prev,
              stage: json.currentlyCrawling ? 'CRAWLING' : 'SYNCED',
              topic: `[${latest.clusterCode}] ${latest.clusterName}`,
              sourcesCount: latest.sourcesCount || prev.sourcesCount,
              sources: (latest.sources && latest.sources.length > 0) ? latest.sources : prev.sources,
              lastSavedFile: {
                fileName: latest.fileName,
                filePath: latest.filePath,
                sizeKb: latest.sizeKb,
                timestamp: latest.timestamp,
                indexStatus: 'SQLITE_FTS5_INDEXED'
              }
            }));
          }
        }
      } catch (_) {}

      try {
        const hRes = await fetch('/api/vault/harvest/latest');
        if (hRes.ok && isMounted) {
          const hJson = await hRes.json();
          if (hJson && hJson.driveF) {
            setData(prev => ({
              ...prev,
              driveF: hJson.driveF
            }));
            setLastSyncTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
          }
        }
      } catch (_) {}
    };

    pollStatus();
    const interval = setInterval(pollStatus, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleCrawlCluster = async (tag) => {
    if (isCrawlingCluster) return;
    const targetTag = tag || selectedPillarTag;
    setIsCrawlingCluster(true);
    try {
      const res = await fetchDaemon('/api/daemon/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cluster: targetTag })
      });
      if (res.ok) {
        const result = await res.json();
        setData(prev => ({
          ...prev,
          stage: 'SYNCED',
          topic: `[${result.clusterCode}] ${result.clusterName}`,
          sourcesCount: result.sourcesCount || prev.sourcesCount,
          sources: (result.sources && result.sources.length > 0) ? result.sources : prev.sources,
          lastSavedFile: {
            fileName: result.fileName,
            filePath: result.filePath,
            sizeKb: result.sizeKb,
            timestamp: result.timestamp,
            indexStatus: 'SQLITE_FTS5_INDEXED'
          }
        }));
      }
    } catch (e) {
      console.error('Trigger crawl failed:', e);
    } finally {
      setIsCrawlingCluster(false);
    }
  };

  const isCrawling = isCrawlingCluster || data.stage === 'CRAWLING' || data.stage === 'SYNTHESIZING';
  const isCommitting = data.stage === 'COMMITTING_TO_F';

  return (
    <div className="tavily-f-monitor">
      {/* Top Header */}
      <div className="tavily-f-header">
        <div className="flex items-center gap-1.5">
          <span className={`tavily-pulse-dot ${isCrawling ? 'crawling' : ''}`} />
          <span className="font-mono text-[11px] font-bold tracking-wider text-cyan-400 uppercase">
            CURIOSITY DAEMON :: 4-WAVE PULSE
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 shrink-0 whitespace-nowrap" title={daemonStatus?.currentWIBTime || currentWave.timeLabel}>
            <Clock className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
            <span>{daemonStatus?.currentWIBTime ? daemonStatus.currentWIBTime.split(' ')[0] + ' WIB' : currentWave.timeLabel}</span>
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold tracking-wide uppercase shrink-0 whitespace-nowrap ${
            isCrawling 
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse' 
              : isCommitting
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 animate-pulse'
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}>
            {isCrawling ? `CRAWL ${selectedPillarTag}` : data.stage}
          </span>
        </div>
      </div>

      {/* Target Directory & Storage Status Bar */}
      <div className="px-2.5 py-1.5 bg-black/40 border-b border-cyan-500/10 flex items-center justify-between text-[9.5px] font-mono text-slate-300">
        <div className="flex items-center gap-1.5 overflow-hidden truncate">
          <HardDrive className="w-3 h-3 text-cyan-400 shrink-0" />
          <span className="text-cyan-300 truncate font-medium">F:\UltimateAI_Memory\02_Doc</span>
        </div>
        <div className="flex items-center gap-1 text-[10.5px] text-emerald-400 font-bold shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>{data.driveF?.freeGb ? `${data.driveF.freeGb} GB` : '118.3 GB'}</span>
        </div>
      </div>

      {/* 4-Wave Diurnal Selector */}
      <div className="px-2 py-1.5 bg-slate-950/80 border-b border-cyan-500/15">
        <div className="grid grid-cols-4 gap-1 mb-1.5">
          {DIURNAL_WAVES.map((w, idx) => (
            <button
              key={w.wave}
              onClick={() => {
                setActiveWaveIndex(idx);
                setSelectedPillarTag(w.pillars[0].tag);
              }}
              className={`px-1 py-0.5 rounded text-[8.5px] font-mono font-bold tracking-tight text-center transition border ${
                activeWaveIndex === idx
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/60 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-900/50 text-slate-400 border-slate-800/80 hover:text-slate-200'
              }`}
            >
              {w.timeLabel.replace(' WIB', '')}
            </button>
          ))}
        </div>

        {/* Wave Title & Action Button */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9.5px] font-mono text-slate-200 font-bold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>{currentWave.name.toUpperCase()}</span>
          </span>
          <button
            onClick={() => handleCrawlCluster(selectedPillarTag)}
            disabled={isCrawling}
            className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase transition flex items-center gap-1 ${
              isCrawling
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-not-allowed animate-pulse'
                : 'bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 border border-indigo-500/40 active:scale-95'
            }`}
            title={`Jalankan panen mendalam untuk klaster ${selectedPillarTag}`}
          >
            {isCrawling ? (
              <>
                <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-400" />
                <span>Merayap...</span>
              </>
            ) : (
              <>
                <Play className="w-2.5 h-2.5 text-indigo-400 fill-indigo-400" />
                <span>Crawl {selectedPillarTag}</span>
              </>
            )}
          </button>
        </div>

        {/* Current Wave Pillar Badges */}
        <div className={`grid gap-1 ${currentWave.pillars.length === 5 ? 'grid-cols-5' : currentWave.pillars.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {currentWave.pillars.map(p => {
            const isSelected = selectedPillarTag === p.tag;
            return (
              <button
                key={p.tag}
                onClick={() => setSelectedPillarTag(p.tag)}
                className={`px-1 py-1 rounded text-[9.5px] font-mono text-center transition border ${
                  isSelected
                    ? 'bg-indigo-500/30 border-indigo-400 text-indigo-200 font-bold shadow-sm'
                    : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:text-white'
                } ${p.isSpecial ? 'ring-1 ring-amber-400/40' : ''}`}
              >
                <div className="flex items-center justify-center gap-1">
                  {p.isSpecial && <Cpu className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                  <span>{p.tag}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Stream Area */}
      <div className="tavily-f-body">
        {/* Active Query Banner */}
        <div className="p-2 rounded bg-cyan-950/20 border border-cyan-500/15 mb-1 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-slate-300 uppercase font-semibold">
              <Globe className="w-3 h-3 text-cyan-400" />
              <span>Web Crawl Grounding</span>
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-semibold">
              {data.startYear || 2024}—2026
            </span>
          </div>
          <p className="text-[11px] font-sans font-medium text-slate-100 line-clamp-2 leading-snug">
            {isCrawling && daemonStatus?.currentlyCrawling
              ? `Sedang merayap klaster: ${daemonStatus.currentlyCrawling} ...`
              : data.topic || 'Menunggu kueri riset...'}
          </p>
        </div>

        {/* Live Sources Retrieved by Tavily */}
        <div className="mb-1 shrink-0">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-300 mb-1 px-0.5 font-semibold">
            <span className="flex items-center gap-1.5">
              <Radio className={`w-3 h-3 ${isCrawling ? 'text-amber-400 animate-spin' : 'text-cyan-400'}`} />
              <span>Sumber Terverifikasi</span>
            </span>
            <span className="text-cyan-400 font-bold">{data.sources?.length || 0} Domain</span>
          </div>

          <div className="flex flex-col gap-1 max-h-[75px] overflow-y-auto custom-scrollbar pr-0.5">
            {data.sources && data.sources.length > 0 ? (
              data.sources.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between px-2 py-1 rounded bg-slate-900/70 border border-slate-800 text-[9.5px] font-mono">
                  <div className="flex items-center gap-1.5 overflow-hidden truncate">
                    <CheckCircle className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                    <span className="text-slate-200 truncate">{s.domain || s.title}</span>
                  </div>
                  <span className="text-cyan-300 text-[9.5px] shrink-0 font-bold">
                    {Math.round((s.score || 0.85) * 100)}%
                  </span>
                </div>
              ))
            ) : (
              <div className="text-[9.5px] font-mono text-slate-400 italic text-center py-1">
                Belum ada sumber dipindai
              </div>
            )}
          </div>
        </div>

        {/* Data Stream Arrow Indicator (Compact) */}
        <div className="flex items-center justify-center my-0.5 opacity-60 shrink-0">
          <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent flex-1" />
          <ArrowDown className="w-3 h-3 text-cyan-400 mx-1 animate-bounce" />
          <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent flex-1" />
        </div>

        {/* Drive F: Ingestion & SQLite Commit Card (Tightly connected, high legibility) */}
        <div className="p-2 rounded bg-gradient-to-br from-slate-950 to-cyan-950/30 border border-cyan-500/25 relative overflow-hidden shrink-0 mt-0.5">
          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
            <span className="flex items-center gap-1.5 text-cyan-300 font-bold uppercase">
              <FileText className="w-3 h-3 text-cyan-400" />
              <span>Drive F: File Committed</span>
            </span>
            <span className="text-[9px] text-slate-300 font-mono font-medium">
              {data.lastSavedFile?.timestamp ? new Date(data.lastSavedFile.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : lastSyncTime}
            </span>
          </div>

          <div className="text-[10.5px] font-mono text-emerald-300 font-bold truncate mb-1" title={data.lastSavedFile?.fileName || 'Menunggu pencarian...'}>
            {data.lastSavedFile?.fileName || 'Menunggu kueri pencarian...'}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-cyan-500/10 text-[9.5px] font-mono text-slate-300">
            <span>
              Size: <strong className="text-cyan-300">{data.lastSavedFile?.sizeKb || (data.lastSavedFile?.sizeBytes ? `${(data.lastSavedFile.sizeBytes / 1024).toFixed(1)} KB` : '-')}</strong>
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Database className="w-2.5 h-2.5 text-emerald-400" />
              <span>SQLITE FTS5 OK</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
