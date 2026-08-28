import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Activity, Cpu, Radio, Globe, Mic, Volume2, 
  RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock, Zap, Server, Layers
} from 'lucide-react';
import conversationSessionControllerInstance from '../../../services/voice/ConversationSessionController.js';
import humanBargeInBenchmarkInstance from '../../../services/voice/HumanBargeInBenchmark.js';

export default function LiveCertificationDashboardModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState([]);
  const [quotaData, setQuotaData] = useState({});
  const [routerOnline, setRouterOnline] = useState(false);

  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const activeSessionId = conversationSessionControllerInstance.getActiveSessionId();

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const [connRes, quotaRes] = await Promise.all([
        fetch('http://127.0.0.1:20200/api/antigravity/connections', { signal: AbortSignal.timeout(2000) }),
        fetch('http://127.0.0.1:20200/api/quota', { signal: AbortSignal.timeout(2000) }).catch(() => null)
      ]);

      if (connRes.ok) {
        const connData = await connRes.json();
        setSlots(connData.slots || connData.accounts || []);
        setRouterOnline(true);

        if (quotaRes && quotaRes.ok) {
          const qData = await quotaRes.json();
          setQuotaData(qData.pools || {});
        }
      } else {
        setRouterOnline(false);
      }
    } catch {
      setRouterOnline(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setBenchmarkResult(humanBargeInBenchmarkInstance.getLatestBenchmark());
    }
  }, [isOpen]);

  const handleTriggerHumanBargeInTest = () => {
    const bench = humanBargeInBenchmarkInstance.measureHumanBargeIn('HUMAN_OPERATOR_BENCHMARK_TRIGGER');
    setBenchmarkResult(bench);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-3xl bg-[#070c18] border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(0,229,255,0.15)] flex flex-col overflow-hidden text-slate-200">
        {/* Header */}
        <div className="p-4 border-b border-cyan-500/20 flex items-center justify-between bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-blue-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-inner">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wider uppercase font-mono">
                ANTIGRAVITY POOL OBSERVABILITY & RUNTIME
              </h2>
              <p className="text-[10px] text-cyan-400/80 font-mono">
                Local Router :20200 | 7 Isolated Google Account Pools | Dynamic Model Registry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white transition-all disabled:opacity-50"
              title="Refresh Probe"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-slate-800/80 hover:bg-rose-950/50 border border-slate-700 hover:border-rose-500/50 text-xs font-mono text-slate-300 hover:text-rose-300 transition-all"
            >
              TUTUP
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Section 1: Live Operations Status Grid */}
          <div className="grid grid-cols-4 gap-2.5">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
              <div className="text-[9px] text-slate-400 font-mono">ROUTER STATUS</div>
              <div className={`text-xs font-bold font-mono ${routerOnline ? 'text-emerald-400' : 'text-red-400'}`}>
                {routerOnline ? 'ONLINE (:20200)' : 'OFFLINE'}
              </div>
              <div className="text-[8px] text-slate-500 font-mono">Local Router SSOT</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
              <div className="text-[9px] text-slate-400 font-mono">ENROLLED POOLS</div>
              <div className="text-xs font-bold text-cyan-300 font-mono">
                {slots.filter(s => s.isEnrolled).length} / 7 ENROLLED
              </div>
              <div className="text-[8px] text-slate-500 font-mono">1 Google Acc = 1 Pool</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
              <div className="text-[9px] text-slate-400 font-mono">ACTIVE IN SCHEDULER</div>
              <div className="text-xs font-bold text-emerald-400 font-mono">
                {slots.filter(s => s.isEnrolled && s.isActive !== false).length} ACTIVE
              </div>
              <div className="text-[8px] text-slate-500 font-mono">Sticky Sequential</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
              <div className="text-[9px] text-slate-400 font-mono">SESSION ID</div>
              <div className="text-xs font-bold text-purple-300 font-mono">#{activeSessionId}</div>
              <div className="text-[8px] text-slate-500 font-mono">Monotonic FSM</div>
            </div>
          </div>

          {/* Section 2: Real Human Barge-In Benchmark */}
          <div className="bg-slate-900/70 border border-cyan-500/30 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                  REAL HUMAN BARGE-IN LATENCY BENCHMARK (T0 ➔ T6)
                </span>
              </div>
              <button
                onClick={handleTriggerHumanBargeInTest}
                className="px-2.5 py-1 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-400/50 text-[10px] font-mono text-cyan-300 font-bold transition-all hover:scale-105"
              >
                TEST REAL BARGE-IN
              </button>
            </div>

            {benchmarkResult ? (
              <div className="space-y-2 mt-2 font-mono">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <div className="text-[9px] text-slate-400">DETECTION (T0➔T1)</div>
                    <div className="text-cyan-300 font-bold">{benchmarkResult.breakdown.detectionLatencyMs} ms</div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <div className="text-[9px] text-slate-400">ABORT & FLUSH (T1➔T4)</div>
                    <div className="text-purple-300 font-bold">{benchmarkResult.breakdown.abortAndFlushLatencyMs} ms</div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-cyan-500/40 shadow-inner">
                    <div className="text-[9px] text-cyan-400">TOTAL LATENCY (T0➔T6)</div>
                    <div className="text-emerald-400 font-bold">{benchmarkResult.breakdown.totalHumanBargeInLatencyMs} ms</div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 font-mono">
                Klik tombol "TEST REAL BARGE-IN" untuk mengukur latensi pembatalan request LLM dan audio flush secara real-time.
              </p>
            )}
          </div>

          {/* Section 3: Antigravity Pools Live Matrix */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                  ANTIGRAVITY POOL SLOTS (AG-01..AG-07)
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Single Source of Truth</span>
            </div>

            <div className="space-y-1.5 font-mono text-xs">
              {slots.length > 0 ? (
                slots.map((slot) => {
                  const isEnrolled = slot.isEnrolled;
                  const isActive = slot.isActive !== false;
                  return (
                    <div
                      key={slot.connectionId}
                      className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-300 font-bold">{slot.connectionId.toUpperCase()}</span>
                        <span className="text-slate-400 text-[11px]">{slot.email || '(Not Enrolled)'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          isEnrolled
                            ? isActive
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {isEnrolled ? (isActive ? 'ENROLLED & ACTIVE' : 'DISABLED (OFF)') : 'NOT_ENROLLED'}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-slate-500 text-center py-4 text-[11px]">
                  Local Router :20200 offline atau memuat status...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400 px-5">
          <span>UltimateAI Antigravity Local Router :20200</span>
          <span className="text-emerald-400">● LIVE RUNTIME</span>
        </div>
      </div>
    </div>
  );
}
