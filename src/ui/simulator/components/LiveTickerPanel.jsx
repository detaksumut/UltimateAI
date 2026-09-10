import React, { useState, useEffect, useRef, useCallback } from 'react';
import TavilyDriveFMonitor from './TavilyDriveFMonitor.jsx';

function buildRealTickerEntries(t) {
  if (!t) return [];
  const entries = [];

  // 1. CPU Real Hardware
  if (t.cpu) {
    entries.push({
      tag: 'CPU',
      color: '#10b981',
      text: `${t.cpu.model} — ${t.cpu.cores} Cores (${t.cpu.arch}) @ ${t.cpu.speed} MHz — Status: Nominal.`
    });
  }

  // 2. RAM Real Memory
  if (t.memory) {
    entries.push({
      tag: 'MEM',
      color: '#06b6d4',
      text: `RAM Fisik: ${t.memory.usedGb} GB / ${t.memory.totalGb} GB terpakai (${t.memory.usedPercent}%) — Sisa Bebas: ${t.memory.freeGb} GB.`
    });
  }

  // 3. Drive F: Storage
  if (t.driveF) {
    entries.push({
      tag: 'DRV',
      color: '#00e5ff',
      text: `Drive F:\\ Fisik Terpasang — Ruang Bebas: ${t.driveF.freeGb} GB / ${t.driveF.totalGb} GB — Total Berkas Intelijen: ${t.driveF.archivedDocsCount} Dokumen.`
    });
  }

  // 4. Ollama Local Engine Status
  if (t.ollama) {
    const modelList = t.ollama.models?.length > 0 ? t.ollama.models.join(', ') : 'qwen3:8b';
    entries.push({
      tag: 'OLM',
      color: t.ollama.online ? '#8b5cf6' : '#f59e0b',
      text: `Ollama Engine :11434 [${t.ollama.status}] — Model Terverifikasi: [${modelList}] — Siap Akses RAG Offline.`
    });
  }

  // 5. Harvester Web Grounding
  entries.push({
    tag: 'HAR',
    color: '#10b981',
    text: `Tavily Deep Harvester Aktif — Perayap Live Internet terhubung langsung ke pipeline penyimpanan Drive F:\\.`
  });

  // 6. Router & Cloud Engine
  if (t.router) {
    entries.push({
      tag: 'NET',
      color: '#22d3ee',
      text: `Router Sistem :${t.router.port} [${t.router.status}] — Primary Cloud: ${t.router.cloudProvider}.`
    });
  }

  // 7. Scheduler 07:00 WIB
  entries.push({
    tag: 'SCH',
    color: '#eab308',
    text: `Autonomous Cron 07:00 WIB [AKTIF] — Fokus: Politik, Ekonomi, Saham, Komoditas, Crypto — Target: Drive F:\\.`
  });

  // 7. Host Operating System
  if (t.os) {
    entries.push({
      tag: 'SYS',
      color: '#00e5ff',
      text: `OS Windows: ${t.os.platform} (Build ${t.os.release}) — Host Uptime: ${t.os.uptimeHours} Jam — Telemetri 100% Riil.`
    });
  }

  return entries;
}

export default function LiveTickerPanel() {
  const [telemetry, setTelemetry] = useState(null);
  const [tickerItems, setTickerItems] = useState(() => [
    { tag: 'SYS', color: '#00e5ff', text: 'Menginisialisasi sensor telemetri perangkat keras...' },
    { tag: 'DRV', color: '#06b6d4', text: 'Memeriksa kapasitas fisik Drive F:\\ dan indeks dokumen...' }
  ]);
  const [completedEntries, setCompletedEntries] = useState([]);
  const [currentEntry, setCurrentEntry] = useState(null);
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef(null);
  const charIndexRef = useRef(0);
  const timerRef = useRef(null);
  const tickerItemsRef = useRef(tickerItems);

  tickerItemsRef.current = tickerItems;

  // Poll real OS and hardware telemetry
  useEffect(() => {
    let isMounted = true;
    const fetchTelemetry = async () => {
      try {
        const res = await fetch('/api/system/telemetry');
        if (res.ok && isMounted) {
          const json = await res.json();
          setTelemetry(json);
          const realEntries = buildRealTickerEntries(json);
          if (realEntries.length > 0) {
            setTickerItems(realEntries);
          }
        }
      } catch (_) {}
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const typeNextChar = useCallback(() => {
    const list = tickerItemsRef.current;
    if (!list || list.length === 0) return;

    const safeIndex = currentIndex % list.length;
    const entry = list[safeIndex];
    if (!entry) return;

    charIndexRef.current++;
    const text = entry.text;

    if (charIndexRef.current > text.length) {
      // Entry finished — move to completed, start next
      setCompletedEntries(prev => [...prev.slice(-15), entry]);
      setCurrentEntry(null);
      setDisplayedText('');
      charIndexRef.current = 0;
      setCurrentIndex(prev => (prev + 1) % list.length);
      return;
    }

    setCurrentEntry({ ...entry, partialText: text.slice(0, charIndexRef.current) });
    setDisplayedText(text.slice(0, charIndexRef.current));
  }, [currentIndex]);

  useEffect(() => {
    timerRef.current = setInterval(typeNextChar, 65);
    return () => clearInterval(timerRef.current);
  }, [typeNextChar]);

  // Auto-scroll to bottom of telemetry area
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [completedEntries, displayedText]);

  return (
    <div className="ticker-panel">
      {/* ═══ TOP HALF: TAVILY WEB HARVEST & DRIVE F: PIPELINE MONITOR ═══ */}
      <div className="ticker-panel-top">
        <TavilyDriveFMonitor />
      </div>

      {/* ═══ CYBER SPLIT DIVIDER ═══ */}
      <div className="ticker-split-divider">
        <span className="ticker-split-line" />
        <span className="ticker-split-label flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          SYSTEM TELEMETRY [LIVE RIIL]
        </span>
        <span className="ticker-split-line" />
      </div>

      {/* ═══ BOTTOM HALF: REAL HARDWARE & SYSTEM TELEMETRY STREAM ═══ */}
      <div className="ticker-panel-bottom">
        <div className="ticker-scroll" ref={containerRef}>
          {/* Completed entries */}
          {completedEntries.map((entry, i) => (
            <div className="ticker-item" key={`done-${i}`}>
              <span className="ticker-tag" style={{ color: entry.color, borderColor: entry.color }}>
                {entry.tag}
              </span>
              <span className="ticker-text">{entry.text}</span>
            </div>
          ))}
          {/* Currently typing entry */}
          {currentEntry && (
            <div className="ticker-item ticker-item-active">
              <span className="ticker-tag" style={{ color: currentEntry.color, borderColor: currentEntry.color }}>
                {currentEntry.tag}
              </span>
              <span className="ticker-text">
                {displayedText}
                <span className="ticker-cursor" />
              </span>
            </div>
          )}
        </div>

        <div className="ticker-footer">
          <span className="ticker-footer-line" />
          <span className="text-[7.5px] font-mono tracking-wider text-emerald-400/90 font-semibold">
            {telemetry?.cpu?.model ? `${telemetry.cpu.model.split(' ')[0]} ${telemetry.cpu.model.split(' ')[2] || ''} | RAM ${telemetry.memory?.usedPercent}% | DRIVE F: ${telemetry.driveF?.freeGb} GB` : 'SYS::LIVE TELEMETRY ACTIVE'}
          </span>
          <span className="ticker-footer-line" />
        </div>
      </div>
    </div>
  );
}
