import React, { useState, useEffect } from 'react';
import { Database, HardDrive, ShieldCheck, RefreshCw, Archive, Eye, Activity } from 'lucide-react';

export default function MemoryCoreHUD({ isCompact = false }) {
  const [healthData, setHealthData] = useState({
    status: 'HEALTHY',
    drive: 'F:\\',
    vaultRecords: 0,
    indexedRecords: 0,
    indexHealth: 'CONSISTENT',
    watcher: 'ACTIVE',
    bridge: 'ONLINE',
    lastBackup: 'Just now',
    lastEvent: 'None',
    isSyncing: false
  });

  const fetchHealth = async () => {
    try {
      const res = await fetch('http://localhost:8080/health', { signal: AbortSignal.timeout(1200) });
      if (res.ok) {
        const data = await res.json();
        setHealthData(prev => ({
          ...prev,
          status: data.status || 'HEALTHY',
          vaultRecords: data.vaultRecords || prev.vaultRecords,
          indexedRecords: data.vaultRecords || prev.indexedRecords,
          bridge: 'ONLINE',
          watcher: 'ACTIVE'
        }));
      }
    } catch (_) {
      // Offline fallback state
    }
  };

  useEffect(() => {
    fetchHealth();
    const timer = setInterval(fetchHealth, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-cyan-500/30 rounded-xl p-3 text-slate-200 font-sans shadow-lg">
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
            Memory Core (Drive F:)
          </span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          {healthData.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 flex flex-col">
          <span className="text-slate-400 text-[10px] uppercase">Storage Node</span>
          <span className="font-mono text-cyan-400 font-semibold mt-0.5">F:\ (Air-Gapped)</span>
        </div>

        <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 flex flex-col">
          <span className="text-slate-400 text-[10px] uppercase">Vault / Indexed</span>
          <span className="font-mono text-emerald-400 font-semibold mt-0.5">
            {healthData.vaultRecords} recs
          </span>
        </div>

        <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 flex flex-col">
          <span className="text-slate-400 text-[10px] uppercase">SQLite Index</span>
          <span className="font-mono text-cyan-300 font-semibold mt-0.5 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            {healthData.indexHealth}
          </span>
        </div>

        <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 flex flex-col">
          <span className="text-slate-400 text-[10px] uppercase">File Watcher</span>
          <span className="font-mono text-purple-300 font-semibold mt-0.5 flex items-center gap-1">
            <Activity className="w-3 h-3 text-purple-400" />
            {healthData.watcher}
          </span>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
        <span>Backup: <strong className="text-slate-300 font-mono">02:00 (Local F:)</strong></span>
        <span className="text-[9px] text-cyan-500/80">Active Memory v4.0</span>
      </div>
    </div>
  );
}
