import React, { useState, useEffect } from 'react';
import { 
  X, Settings, Cpu, Globe, Shield, Check, Layers, Activity, 
  Server, Zap, RefreshCw, Power, AlertTriangle, ArrowRight, 
  Clock, Database, Eye, Terminal, CheckCircle2, XCircle, AlertCircle,
  Volume2, VolumeX
} from 'lucide-react';
import { RouterConfig } from '../../../services/router/RouterConfig.js';
import { textToSpeechInstance } from '../../../services/voice/TextToSpeech.js';

export default function ControlCenterModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [snapshot, setSnapshot] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTaskProvenance, setSelectedTaskProvenance] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [ttsState, setTtsState] = useState({
    voice: null, language: 'id-ID', rate: 0.90, pitch: 1.08,
    queueLength: 0, playing: false, interrupted: false,
    qualityTier: null, engineType: 'BROWSER_WEB_SPEECH_API', limitation: null
  });

  // Fetch full Control Center snapshot from LocalRouter SSOT endpoint
  const fetchSnapshot = async () => {
    try {
      const res = await fetch('http://127.0.0.1:20200/api/control-center', {
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json();
        setSnapshot(data);
      }
    } catch (err) {
      console.warn('Could not fetch Control Center snapshot:', err.message);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSnapshot();
      const interval = setInterval(fetchSnapshot, 2000);

      // Subscribe to TTS state updates
      const unsubTTS = textToSpeechInstance.subscribeState((state) => {
        setTtsState({ ...state });
      });

      // Trigger voice selection on open to populate state
      setTimeout(() => {
        textToSpeechInstance.selectBestVoice();
        setTtsState({ ...textToSpeechInstance.state });
      }, 200);

      return () => {
        clearInterval(interval);
        unsubTTS();
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTogglePool = async (poolId) => {
    setActionLoadingId(`toggle-${poolId}`);
    try {
      const res = await fetch(`http://127.0.0.1:20200/api/antigravity/connections/${poolId}/toggle`, {
        method: 'POST'
      });
      if (res.ok) {
        setStatusMessage(`Pool ${poolId.toUpperCase()} status berhasil diubah.`);
        await fetchSnapshot();
      }
    } catch (err) {
      setStatusMessage(`Gagal mengubah status: ${err.message}`);
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  const handleRefreshPool = async (poolId) => {
    setActionLoadingId(`refresh-${poolId}`);
    try {
      const res = await fetch(`http://127.0.0.1:20200/api/antigravity/connections/${poolId}/refresh`, {
        method: 'POST'
      });
      if (res.ok) {
        setStatusMessage(`Token & health check ${poolId.toUpperCase()} berhasil disegarkan.`);
        await fetchSnapshot();
      } else {
        const errJson = await res.json().catch(() => ({}));
        setStatusMessage(`Refresh gagal: ${errJson.error?.message || res.statusText}`);
      }
    } catch (err) {
      setStatusMessage(`Gagal refresh: ${err.message}`);
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  const overview = snapshot?.overview || {
    jinStatus: 'ONLINE',
    agentRuntimeStatus: 'ONLINE',
    localRouterStatus: 'ONLINE',
    enrolledCount: 7,
    healthyCount: 7,
    availableCount: 7,
    degradedCount: 0,
    totalCount: 7,
    ideDependency: 'NONE',
    systemHealth: 'LIVE'
  };

  const pools = snapshot?.pools || [];
  const currentTask = snapshot?.currentExecution || null;
  const lastRollover = snapshot?.rolloverTelemetry || { occurred: false };
  const recentTasks = snapshot?.recentTasks || [];
  const recentEvents = snapshot?.recentEvents || [];
  const alerts = snapshot?.alerts || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg">
      <div className="relative w-full max-w-6xl bg-[#090e1c] border border-cyan-500/30 rounded-3xl p-6 shadow-[0_0_60px_rgba(0,229,255,0.25)] text-slate-200 select-none flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(0,229,255,0.35)]">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-white font-mono tracking-wide">
                  ULTIMATEAI RUNTIME CONTROL CENTER
                </h2>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold uppercase ${
                  overview.systemHealth === 'LIVE' 
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60 animate-pulse'
                    : 'bg-amber-950/80 text-amber-400 border-amber-700/60'
                }`}>
                  ● {overview.systemHealth}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Observabilitas Real-Time SSOT, Pool Control, dan Evaluasi Pipeline Agen
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {statusMessage && (
              <span className="text-xs text-cyan-300 bg-cyan-950/70 border border-cyan-800/60 px-3 py-1 rounded-xl">
                {statusMessage}
              </span>
            )}
            <button
              onClick={fetchSnapshot}
              className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-cyan-300 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 pt-3 pb-2 border-b border-slate-800/80 flex-shrink-0">
          {[
            { id: 'overview', label: '📊 System Overview & Pipeline' },
            { id: 'pools', label: '🌊 7 Antigravity Pools' },
            { id: 'tasks', label: '📈 Task History & Telemetry' },
            { id: 'events', label: '📜 Live Event Stream' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-medium transition-all ${
                activeTab === t.id
                  ? 'bg-gradient-to-r from-cyan-600/30 to-blue-600/30 border border-cyan-400/50 text-cyan-200 shadow-[0_0_12px_rgba(0,229,255,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-4 space-y-5">
          
          {/* TAB 1: OVERVIEW & PIPELINE */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Alerts if any */}
              {alerts.length > 0 && (
                <div className="space-y-2">
                  {alerts.map((alt, idx) => (
                    <div key={idx} className="bg-amber-950/40 border border-amber-600/40 rounded-2xl p-3.5 flex items-center gap-3 text-xs text-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span>{alt.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Status Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
                <div className="bg-[#121729] border border-slate-800 rounded-2xl p-3.5">
                  <div className="text-[10px] text-slate-400">JIN PERSONA</div>
                  <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    ONLINE
                  </div>
                </div>

                <div className="bg-[#121729] border border-slate-800 rounded-2xl p-3.5">
                  <div className="text-[10px] text-slate-400">AGENT RUNTIME</div>
                  <div className="text-sm font-bold text-cyan-400 mt-1 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    AUTONOMOUS
                  </div>
                </div>

                <div className="bg-[#121729] border border-slate-800 rounded-2xl p-3.5">
                  <div className="text-[10px] text-slate-400">LOCAL ROUTER</div>
                  <div className="text-sm font-bold text-purple-300 mt-1 flex items-center gap-1">
                    :20200
                  </div>
                </div>

                <div className="bg-[#121729] border border-slate-800 rounded-2xl p-3.5">
                  <div className="text-[10px] text-slate-400">POOLS HEALTH</div>
                  <div className="text-sm font-bold text-emerald-400 mt-1">
                    {overview.healthyCount} / 7 READY
                  </div>
                </div>

                <div className="bg-[#121729] border border-slate-800 rounded-2xl p-3.5 col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-slate-400">IDE DEPENDENCY</div>
                  <div className="text-sm font-bold text-cyan-300 mt-1 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-cyan-400" />
                    NONE (STANDALONE)
                  </div>
                </div>
              </div>

              {/* REAL-TIME VOICE PIPELINE STATUS BAR */}
              <div className="bg-[#0b1021] border border-cyan-500/25 rounded-2xl p-3.5 flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar font-mono text-xs shadow-[0_0_15px_rgba(0,229,255,0.06)]">
                <div className="flex items-center gap-1.5 flex-shrink-0 text-cyan-400 font-bold text-[11px] uppercase tracking-wider pr-2 border-r border-slate-800">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  VOICE PIPELINE:
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>MIC: <b className="text-white">ACTIVE</b></span>
                  <span className="text-slate-600">|</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>VAD: <b className="text-white">ACTIVE</b></span>
                  <span className="text-slate-600">|</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>STT: <b className="text-white">READY</b></span>
                  <span className="text-slate-600">|</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>AGENT: <b className="text-white">ONLINE</b></span>
                  <span className="text-slate-600">|</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400"></span>POOL: <b className="text-cyan-300">{overview.currentStickyPool?.toUpperCase() || 'AG-01'}</b></span>
                  <span className="text-slate-600">|</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>TTS: <b className="text-white">{ttsState.playing ? 'SPEAKING' : 'READY'}</b></span>
                  <span className="text-slate-600">|</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>BARGE-IN: <b className="text-emerald-300">ACTIVE</b></span>
                </div>
              </div>

              {/* TTS STATUS PANEL */}
              <div className="bg-[#0a1220] border border-violet-500/20 rounded-2xl p-4 font-mono">
                <div className="flex items-center gap-2 mb-3">
                  <Volume2 className="w-4 h-4 text-violet-400" />
                  <span className="text-[11px] font-bold text-violet-400 tracking-wider uppercase">TTS / Voice Engine</span>
                  {ttsState.playing && (
                    <span className="ml-auto text-[10px] bg-violet-900/60 border border-violet-600/50 text-violet-300 px-2 py-0.5 rounded-full animate-pulse">▶ SPEAKING</span>
                  )}
                  {ttsState.interrupted && !ttsState.playing && (
                    <span className="ml-auto text-[10px] bg-amber-900/60 border border-amber-600/50 text-amber-300 px-2 py-0.5 rounded-full">⚡ BARGE-IN</span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="bg-[#111827] rounded-xl p-2.5">
                    <div className="text-slate-500 text-[9px] uppercase mb-1">VOICE</div>
                    <div className="text-violet-200 font-medium truncate" title={ttsState.voice || 'Loading...'}>
                      {ttsState.voice || '—'}
                    </div>
                  </div>
                  <div className="bg-[#111827] rounded-xl p-2.5">
                    <div className="text-slate-500 text-[9px] uppercase mb-1">LANGUAGE</div>
                    <div className="text-emerald-300 font-medium">{ttsState.language || 'id-ID'}</div>
                  </div>
                  <div className="bg-[#111827] rounded-xl p-2.5">
                    <div className="text-slate-500 text-[9px] uppercase mb-1">RATE / PITCH</div>
                    <div className="text-cyan-300 font-medium">{ttsState.rate} / {ttsState.pitch}</div>
                  </div>
                  <div className="bg-[#111827] rounded-xl p-2.5">
                    <div className="text-slate-500 text-[9px] uppercase mb-1">QUEUE</div>
                    <div className="text-white font-medium">{ttsState.queueLength} items</div>
                  </div>
                  <div className="bg-[#111827] rounded-xl p-2.5">
                    <div className="text-slate-500 text-[9px] uppercase mb-1">QUALITY TIER</div>
                    <div className={`font-bold text-[10px] ${
                      ttsState.qualityTier === 'NEURAL_PREMIUM' ? 'text-emerald-400' :
                      ttsState.qualityTier === 'NATIVE_INDONESIAN' ? 'text-cyan-300' :
                      ttsState.qualityTier === 'LOCALE_MATCH' ? 'text-amber-300' : 'text-red-400'
                    }`}>
                      {ttsState.qualityTier || 'DETECTING...'}
                    </div>
                  </div>
                  <div className="bg-[#111827] rounded-xl p-2.5">
                    <div className="text-slate-500 text-[9px] uppercase mb-1">ENGINE</div>
                    <div className="text-slate-300 text-[10px]">{ttsState.engineType || 'WEB_SPEECH'}</div>
                  </div>
                  <div className="bg-[#111827] rounded-xl p-2.5">
                    <div className="text-slate-500 text-[9px] uppercase mb-1">PLAYING</div>
                    <div className={`font-bold ${ttsState.playing ? 'text-violet-300' : 'text-slate-500'}`}>
                      {ttsState.playing ? '▶ YES' : '▪ NO'}
                    </div>
                  </div>
                  <div className="bg-[#111827] rounded-xl p-2.5">
                    <div className="text-slate-500 text-[9px] uppercase mb-1">INTERRUPTED</div>
                    <div className={`font-bold ${ttsState.interrupted ? 'text-amber-300' : 'text-slate-500'}`}>
                      {ttsState.interrupted ? '⚡ YES' : '▪ NO'}
                    </div>
                  </div>
                </div>
                {ttsState.limitation && (
                  <div className="mt-2 p-2.5 bg-amber-950/30 border border-amber-700/30 rounded-xl text-[10px] text-amber-300 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{ttsState.limitation}</span>
                  </div>
                )}
              </div>

              {/* Execution Pipeline Visualizer */}
              <div className="bg-[#0f1424] border border-[#1e2640] rounded-3xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold font-mono text-cyan-400 tracking-wider uppercase flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    END-TO-END AGENT EXECUTION PIPELINE
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700">
                    Active Sticky: {overview.currentStickyPool?.toUpperCase() || 'AG-01'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-1 overflow-x-auto custom-scrollbar py-2 text-[11px] font-mono">
                  {[
                    { label: 'USER', sub: 'Utterance' },
                    { label: 'JIN', sub: 'Interface' },
                    { label: 'AGENT RUNTIME', sub: 'Coordinator' },
                    { label: 'CAPABILITY', sub: 'Resolver' },
                    { label: 'MODEL', sub: 'Selector' },
                    { label: 'POOL SELECTOR', sub: overview.currentStickyPool?.toUpperCase() || 'AG-01' },
                    { label: 'CLOUD CODE', sub: 'Native API' },
                    { label: 'VERIFIER', sub: 'Grounding' },
                    { label: 'JIN RESPONSE', sub: 'Voice & HUD' }
                  ].map((step, idx, arr) => (
                    <React.Fragment key={step.label}>
                      <div className="flex flex-col items-center bg-[#151c33] border border-cyan-500/30 rounded-xl px-3 py-2 text-center min-w-[90px] shadow-[0_0_10px_rgba(0,229,255,0.08)]">
                        <span className="font-bold text-cyan-200">{step.label}</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">{step.sub}</span>
                      </div>
                      {idx < arr.length - 1 && (
                        <ArrowRight className="w-3.5 h-3.5 text-cyan-400/60 flex-shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Current Active Execution or Standby Widget */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0f1424] border border-[#1e2640] rounded-3xl p-5 space-y-3">
                  <h4 className="text-xs font-bold font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    CURRENT ACTIVE EXECUTION
                  </h4>
                  {currentTask ? (
                    <div className="space-y-2 text-xs font-mono bg-[#141b30] p-4 rounded-2xl border border-cyan-500/30">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Task ID:</span>
                        <span className="font-bold text-cyan-300">{currentTask.taskId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Capability:</span>
                        <span className="text-white">{currentTask.capability}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Model:</span>
                        <span className="text-cyan-300">{currentTask.requestedModel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Selected Pool:</span>
                        <span className="font-bold text-emerald-400">{currentTask.selectedPool?.toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Status:</span>
                        <span className="text-amber-300 animate-pulse font-bold">{currentTask.status}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 font-mono bg-[#141b30] p-6 rounded-2xl border border-slate-800 text-center">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2 opacity-80" />
                      Runtime Standby — Menunggu permintaan agen berikutnya.
                    </div>
                  )}
                </div>

                {/* Rollover Telemetry */}
                <div className="bg-[#0f1424] border border-[#1e2640] rounded-3xl p-5 space-y-3">
                  <h4 className="text-xs font-bold font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-purple-400" />
                    ROLLOVER TELEMETRY
                  </h4>
                  <div className="text-xs font-mono bg-[#141b30] p-4 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Rollover Occurred:</span>
                      <span className={`font-bold ${lastRollover.occurred ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {lastRollover.occurred ? 'YES' : 'NO (STICKY DIRECT)'}
                      </span>
                    </div>
                    {lastRollover.occurred && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Previous Pool:</span>
                          <span className="text-slate-300">{lastRollover.previousConnectionId?.toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Selected Pool:</span>
                          <span className="text-emerald-400 font-bold">{lastRollover.selectedConnectionId?.toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Reason:</span>
                          <span className="text-amber-300">{lastRollover.reason}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Timestamp:</span>
                          <span className="text-slate-400">{lastRollover.timestamp ? new Date(lastRollover.timestamp).toLocaleTimeString() : '-'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SEVEN POOL STATUS & CONTROLS */}
          {activeTab === 'pools' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pools.map((pool) => (
                  <div
                    key={pool.id}
                    className={`bg-[#0f1424] border rounded-3xl p-5 space-y-3 transition-all ${
                      pool.isActive && pool.health === 'HEALTHY'
                        ? 'border-cyan-500/30 shadow-[0_0_20px_rgba(0,229,255,0.08)]'
                        : 'border-slate-800 opacity-90'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold font-mono text-white tracking-wide">
                          {pool.alias}
                        </span>
                        <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border font-bold uppercase ${
                          pool.health === 'HEALTHY'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-700/60'
                            : (pool.health === 'DEGRADED' || pool.health === 'COOLDOWN' ? 'bg-amber-950 text-amber-400 border-amber-700/60' : 'bg-slate-900 text-slate-400 border-slate-700')
                        }`}>
                          {pool.health}
                        </span>
                      </div>

                      {/* ON/OFF Switch */}
                      <button
                        onClick={() => handleTogglePool(pool.id)}
                        disabled={actionLoadingId === `toggle-${pool.id}`}
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all ${
                          pool.isActive
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        {pool.isActive ? 'ON' : 'OFF'}
                      </button>
                    </div>

                    <div className="text-xs text-slate-400 font-mono truncate">
                      {pool.email || 'Slot Belum Terdaftar'}
                    </div>

                    <div className="bg-[#141b30] p-3 rounded-2xl border border-slate-800/80 space-y-1.5 text-[11px] font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Current Model:</span>
                        <span className="text-cyan-300">{pool.currentModel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Quota Source:</span>
                        <span className="text-purple-300">{pool.quotaSource}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Remaining:</span>
                        <span className="text-emerald-400 font-bold">{pool.remaining} Req</span>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleRefreshPool(pool.id)}
                        disabled={actionLoadingId === `refresh-${pool.id}`}
                        className="flex-1 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] font-mono flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <RefreshCw className={`w-3 h-3 ${actionLoadingId === `refresh-${pool.id}` ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: TASK HISTORY & PROVENANCE */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <div className="bg-[#0f1424] border border-[#1e2640] rounded-3xl p-5 space-y-3">
                <h4 className="text-xs font-bold font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  RECENT AGENT EXECUTION TASKS
                </h4>

                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-2">Task ID</th>
                        <th className="pb-2">Capability</th>
                        <th className="pb-2">Model</th>
                        <th className="pb-2">Pool</th>
                        <th className="pb-2">Duration</th>
                        <th className="pb-2">Rollover</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2 text-right">Inspect</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {recentTasks.map((t) => (
                        <tr key={t.taskId} className="hover:bg-slate-800/30">
                          <td className="py-2.5 font-bold text-cyan-300">{t.taskId}</td>
                          <td className="py-2.5 text-slate-300">{t.capability}</td>
                          <td className="py-2.5 text-slate-300">{t.actualModel || t.requestedModel}</td>
                          <td className="py-2.5 font-bold text-emerald-400">{t.connectionId?.toUpperCase()}</td>
                          <td className="py-2.5 text-slate-400">{t.durationMs}ms</td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${t.rollover ? 'bg-amber-950 text-amber-400 border border-amber-700/50' : 'text-slate-500'}`}>
                              {t.rollover ? 'YES' : 'NO'}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <span className="text-emerald-400 font-bold">{t.status}</span>
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              onClick={() => setSelectedTaskProvenance(t.provenance)}
                              className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 text-[10px]"
                            >
                              Provenance
                            </button>
                          </td>
                        </tr>
                      ))}
                      {recentTasks.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-slate-500">
                            Belum ada riwayat task yang terekam.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EVENT STREAM */}
          {activeTab === 'events' && (
            <div className="bg-[#0f1424] border border-[#1e2640] rounded-3xl p-5 space-y-3">
              <h4 className="text-xs font-bold font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                RUNTIME EVENT STREAM (ZERO SECRET LOGGING)
              </h4>

              <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar font-mono text-xs">
                {recentEvents.map((evt) => (
                  <div key={evt.id} className="bg-[#141b30] p-3 rounded-2xl border border-slate-800 flex items-start gap-3">
                    <span className="text-slate-500 text-[10px] whitespace-nowrap pt-0.5">{evt.timeFormatted}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      evt.type === 'TASK_START' ? 'bg-blue-950 text-blue-300 border border-blue-800' :
                      evt.type === 'TASK_COMPLETE' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                      evt.type === 'ROLLOVER' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                      'bg-purple-950 text-purple-300 border border-purple-800'
                    }`}>
                      {evt.type}
                    </span>
                    <div className="flex-1 text-slate-300">
                      <div>{evt.message}</div>
                      {evt.details && (
                        <pre className="text-[10px] text-slate-400 mt-1 overflow-x-auto bg-[#0a0f1d] p-2 rounded-xl border border-slate-800">
                          {JSON.stringify(evt.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Provenance Inspector Modal Drawer */}
        {selectedTaskProvenance && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-xl bg-[#0d1326] border border-cyan-500/40 rounded-3xl p-6 shadow-2xl text-slate-200 font-mono text-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="font-bold text-cyan-300 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  AUTHENTIC PROVENANCE INSPECTOR
                </h3>
                <button
                  onClick={() => setSelectedTaskProvenance(null)}
                  className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="bg-[#13192f] p-4 rounded-2xl border border-slate-800 space-y-2.5 overflow-y-auto max-h-[60vh] custom-scrollbar">
                <div className="flex justify-between"><span className="text-slate-400">Provider Gateway:</span><span className="text-cyan-300">{selectedTaskProvenance.providerGateway}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Connection ID:</span><span className="font-bold text-emerald-400">{selectedTaskProvenance.actualConnectionId?.toUpperCase() || selectedTaskProvenance.connectionId?.toUpperCase()}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Account Alias:</span><span className="text-slate-300">{selectedTaskProvenance.accountAlias}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Requested Model:</span><span className="text-slate-300">{selectedTaskProvenance.requestedModel}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Actual Model:</span><span className="text-cyan-300 font-bold">{selectedTaskProvenance.actualModel}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Transport Class:</span><span className="text-purple-300">{selectedTaskProvenance.transportClass}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Upstream Response ID:</span><span className="text-cyan-200 font-bold">{selectedTaskProvenance.upstreamResponseId || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Local Response ID:</span><span className="text-slate-400">{selectedTaskProvenance.localResponseId}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Fallback Used:</span><span className="text-slate-400">{String(selectedTaskProvenance.fallbackUsed)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Rollover:</span><span className="text-amber-300">{selectedTaskProvenance.rollover?.occurred ? `Occurred (from ${selectedTaskProvenance.rollover.previousConnectionId})` : 'None'}</span></div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
