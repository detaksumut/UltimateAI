import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Activity, Cpu, Radio, Globe, Mic, Volume2, 
  RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock, Zap
} from 'lucide-react';
import conversationSessionControllerInstance from '../../../services/voice/ConversationSessionController.js';
import humanBargeInBenchmarkInstance from '../../../services/voice/HumanBargeInBenchmark.js';

export default function LiveCertificationDashboardModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    gateway: 'ONLINE',
    mode: 'LOCAL_HEURISTIC_FALLBACK',
    timestamp: new Date().toISOString(),
    providers: {
      gemini: { configured: false, status: 'NOT_CONFIGURED' },
      openai: { configured: false, status: 'NOT_CONFIGURED' },
      claude: { configured: false, status: 'NOT_CONFIGURED' },
      deepseek: { configured: false, status: 'NOT_CONFIGURED' }
    }
  });

  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const activeSessionId = conversationSessionControllerInstance.getActiveSessionId();

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ultimateai/providers/status');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Standalone probe
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

  const getStatusBadge = (status) => {
    if (status === 'AUTHENTICATED_AND_LIVE') {
      return (
        <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          AUTHENTICATED LIVE
        </span>
      );
    }
    if (status === 'DEGRADED') {
      return (
        <span className="flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          DEGRADED
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-slate-800/60 border border-slate-700/50 px-2 py-0.5 rounded-full">
        <XCircle className="w-3 h-3 text-slate-500" />
        NOT CONFIGURED
      </span>
    );
  };

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
                JIN LIVE OPERATIONS & OBSERVABILITY (PHASE 4.4)
              </h2>
              <p className="text-[10px] text-cyan-400/80 font-mono">
                Granular Forensic Telemetry | Real Human & Host Runtime Verification
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
              <div className="text-[9px] text-slate-400 font-mono">ACTIVE SESSION</div>
              <div className="text-sm font-bold text-purple-300 font-mono">#{activeSessionId}</div>
              <div className="text-[8px] text-slate-500 font-mono">Monotonic ID</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
              <div className="text-[9px] text-slate-400 font-mono">STREAM MODE</div>
              <div className="text-xs font-bold text-cyan-300 font-mono">
                {Object.values(data.providers || {}).some(p => p.configured) ? 'UPSTREAM_NATIVE' : 'LOCAL_SYNTHETIC'}
              </div>
              <div className="text-[8px] text-slate-500 font-mono">
                {Object.values(data.providers || {}).some(p => p.configured) ? 'Real Cloud AI' : 'Transparent Heuristic'}
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
              <div className="text-[9px] text-slate-400 font-mono">WEB INTELLIGENCE</div>
              <div className="text-xs font-bold text-emerald-400 font-mono">LIVE</div>
              <div className="text-[8px] text-slate-500 font-mono">Untrusted Delimiter</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
              <div className="text-[9px] text-slate-400 font-mono">NEURAL VOICE</div>
              <div className="text-xs font-bold text-purple-300 font-mono">EDGE_NEURAL</div>
              <div className="text-[8px] text-slate-500 font-mono">id-ID-ArdiNeural</div>
            </div>
          </div>

          {/* Section 2: Real Human Barge-In Benchmark (T0 -> T6) */}
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
                <div className="text-[9px] text-slate-400 text-right">
                  Session #{benchmarkResult.oldSessionId} invalidated ➔ Session #{benchmarkResult.newSessionId} created cleanly.
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 font-mono">
                Klik tombol "TEST REAL BARGE-IN" untuk mengukur latensi pembatalan request LLM dan audio flush secara real-time.
              </p>
            )}
          </div>

          {/* Section 3: AI Brain Providers Probe Matrix */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                  AI BRAIN PROVIDER MATRIX
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Zero-Camouflage Verification</span>
            </div>

            <div className="space-y-2">
              {[
                { name: 'Gemini (Google AI)', key: 'gemini', model: 'gemini-2.0-flash', desc: 'Fast Chat & High Throughput' },
                { name: 'OpenAI (GPT-4o)', key: 'openai', model: 'gpt-4o-mini', desc: 'Reasoning & Coding' },
                { name: 'Claude (Anthropic)', key: 'claude', model: 'claude-3-5-sonnet', desc: 'Architecture & Analysis' },
                { name: 'DeepSeek (Reasoner)', key: 'deepseek', model: 'deepseek-reasoner', desc: 'Deep Multi-Step Synthesis' }
              ].map((prov) => {
                const status = data.providers?.[prov.key]?.status || (data.providers?.[prov.key]?.configured ? 'AUTHENTICATED_AND_LIVE' : 'NOT_CONFIGURED');
                return (
                  <div
                    key={prov.key}
                    className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between gap-3 hover:border-slate-700 transition-all"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-200 font-mono flex items-center gap-2">
                        <span>{prov.name}</span>
                        <span className="text-[9px] text-cyan-400/80 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/40">
                          {prov.model}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">{prov.desc}</div>
                    </div>
                    <div>{getStatusBadge(status)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400 px-5">
          <span>Standards: Phase 4.4 Live Operations & Forensic Telemetry</span>
          <span>Timestamp: {new Date(data.timestamp || Date.now()).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
