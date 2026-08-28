import React, { useState, useEffect } from 'react';
import { X, Zap, RefreshCw, Trash2, AlertCircle, ShieldCheck, Layers, Filter, CheckCircle2, Server, Activity } from 'lucide-react';

const API_ENDPOINTS = [
  'http://127.0.0.1:20200',
  'http://localhost:20200',
  'http://127.0.0.1:20128',
  'http://localhost:20128',
  ''
];

export default function ConnectionsModal({ isOpen, onClose }) {
  const [slots, setSlots] = useState([]);
  const [quotaData, setQuotaData] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeEndpoint, setActiveEndpoint] = useState(API_ENDPOINTS[0]);
  const [isLiveOnline, setIsLiveOnline] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [autoRefreshSec, setAutoRefreshSec] = useState(55);

  const fetchLiveState = async () => {
    setLoading(true);
    let success = false;

    for (const ep of [activeEndpoint, ...API_ENDPOINTS]) {
      try {
        const [accRes, quotaRes] = await Promise.all([
          fetch(`${ep}/api/accounts`, { signal: AbortSignal.timeout(1500) })
            .catch(() => fetch(`${ep}/api/antigravity/connections`, { signal: AbortSignal.timeout(1500) })),
          fetch(`${ep}/api/quota`, { signal: AbortSignal.timeout(1500) }).catch(() => null)
        ]);

        if (accRes && accRes.ok) {
          const accData = await accRes.json();
          setSlots(accData.slots || accData.accounts || []);
          setActiveEndpoint(ep);
          setIsLiveOnline(true);
          setErrorMsg(null);
          success = true;

          if (quotaRes && quotaRes.ok) {
            const qData = await quotaRes.json();
            setQuotaData(qData.pools || {});
          }
          break;
        }
      } catch {}
    }

    if (!success) {
      setIsLiveOnline(false);
      setErrorMsg('LIVE DATA UNAVAILABLE: Local Router (127.0.0.1:20200) sedang offline.');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchLiveState();
      const interval = setInterval(() => {
        fetchLiveState();
        setAutoRefreshSec(55);
      }, 55000);
      const ticker = setInterval(() => {
        setAutoRefreshSec(prev => (prev > 1 ? prev - 1 : 55));
      }, 1000);
      return () => {
        clearInterval(interval);
        clearInterval(ticker);
      };
    }
  }, [isOpen]);

  const handleStartConnect = async (connectionId) => {
    try {
      setErrorMsg(null);
      const authWindow = window.open('', '_blank');
      if (authWindow) {
        authWindow.document.write(`
          <html>
            <body style="background:#0e1117;color:#38bdf8;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
              <div style="text-align:center;">
                <h3 style="margin:0 0 8px 0;font-size:18px;">Membuka Login Google Antigravity...</h3>
                <p style="color:#94a3b8;font-size:13px;margin:0;">Menghubungkan slot ${connectionId.toUpperCase()}...</p>
              </div>
            </body>
          </html>
        `);
      }

      const res = await fetch(`${activeEndpoint}/api/antigravity/connections/${connectionId}/enroll`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        if (authWindow) authWindow.close();
        throw new Error(data.error?.message || data.message || 'Gagal memulai koneksi');
      }

      if (data.authUrl) {
        if (authWindow) {
          authWindow.location.href = data.authUrl;
        } else {
          window.open(data.authUrl, '_blank');
        }
      }
      fetchLiveState();
    } catch (err) {
      setErrorMsg(`Gagal menghubungkan ${connectionId.toUpperCase()}: ${err.message}`);
    }
  };

  const handleRefresh = async (connectionId) => {
    try {
      const res = await fetch(`${activeEndpoint}/api/antigravity/connections/${connectionId}/refresh`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Refresh gagal');
      fetchLiveState();
    } catch (err) {
      setErrorMsg(`Refresh gagal: ${err.message}`);
    }
  };

  const handleToggle = async (connectionId) => {
    try {
      const res = await fetch(`${activeEndpoint}/api/antigravity/connections/${connectionId}/toggle`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Toggle gagal');
      fetchLiveState();
    } catch (err) {
      setErrorMsg(`Toggle gagal: ${err.message}`);
    }
  };

  const handleDisconnect = async (connectionId) => {
    if (!confirm(`Hapus dan putuskan koneksi ${connectionId.toUpperCase()} dari Pool Antigravity?`)) return;
    try {
      const res = await fetch(`${activeEndpoint}/api/antigravity/connections/${connectionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Disconnect gagal');
      fetchLiveState();
    } catch (err) {
      setErrorMsg(`Disconnect gagal: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-7xl bg-[#12141a] border border-[#232734] rounded-2xl p-5 shadow-[0_0_80px_rgba(0,0,0,0.8)] text-slate-200 select-none flex flex-col max-h-[95vh] overflow-hidden">
        {/* Top Control Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#232734] text-xs font-mono">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Live Data Boundary Badge */}
            <div className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 font-bold ${
              isLiveOnline
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-red-950/60 border-red-500/40 text-red-300'
            }`}>
              <Server className="w-3.5 h-3.5" />
              <span>{isLiveOnline ? 'LIVE DATA: LOCAL_ROUTER_API (:20200)' : 'LIVE DATA UNAVAILABLE'}</span>
            </div>

            <div className="px-3 py-1.5 rounded-lg bg-[#1a1d26] border border-[#2d3243] text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Antigravity Pools (7 Slots)</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#1a1d26] border border-[#2d3243] text-amber-400/90 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Auto-refresh ({autoRefreshSec}s)</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLiveState}
              disabled={loading}
              className="p-1.5 rounded-lg bg-[#1a1d26] hover:bg-[#252a38] text-slate-300 border border-[#2d3243] cursor-pointer"
              title="Refresh All"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#1a1d26] hover:bg-[#252a38] text-slate-300 border border-[#2d3243] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="my-2.5 px-4 py-2 rounded-xl bg-red-950/50 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 font-mono">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 9Router Styled Account Grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 grid grid-cols-1 lg:grid-cols-2 gap-4 py-3">
          {slots.map((slot) => {
            const isEnrolled = slot.isEnrolled;
            const accountEmail = slot.email || slot.accountAlias || null;
            const livePoolQuota = quotaData[slot.connectionId] || slot.quotaSummary || {};
            const modelsMap = livePoolQuota.models || {};
            const recordedModels = Object.keys(modelsMap);
            const quotaSource = livePoolQuota.source || 'NO_DATA_RECORDED';
            const isSlotActive = slot.isActive !== false;

            return (
              <div
                key={slot.connectionId}
                className={`border rounded-2xl p-4 flex flex-col justify-between shadow-lg transition-all ${
                  isEnrolled
                    ? isSlotActive
                      ? 'bg-[#181b24] border-[#282d3d] hover:border-[#383f55]'
                      : 'bg-[#14161f] border-amber-900/30 opacity-75'
                    : 'bg-[#12141a]/80 border-[#202430]'
                }`}
              >
                <div>
                  {/* Card Header (9Router Style) */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#252a39] mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#1e2330] border border-[#30374b] flex items-center justify-center text-cyan-400">
                        <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2L2 22h20L12 2z" stroke="url(#antigravity-grad)" />
                          <defs>
                            <linearGradient id="antigravity-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                              <stop stopColor="#38bdf8" />
                              <stop offset="1" stopColor="#a855f7" />
                            </linearGradient>
                          </defs>
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-300">Antigravity</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                            {slot.connectionId.toUpperCase()}
                          </span>
                          {isEnrolled && (
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                              !isSlotActive
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : quotaSource === 'UPSTREAM_OBSERVED'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {!isSlotActive ? 'DISABLED (OFF)' : quotaSource}
                            </span>
                          )}
                        </div>
                        <span className={`text-xs font-mono font-bold tracking-tight ${isEnrolled && accountEmail ? 'text-emerald-300' : 'text-slate-500'}`}>
                          {isEnrolled ? (accountEmail || 'AUTHENTICATED_ACCOUNT') : '(Belum Terhubung)'}
                        </span>
                      </div>
                    </div>

                    {/* Action Toolbar */}
                    <div className="flex items-center gap-2">
                      {isEnrolled && (
                        <>
                          <button
                            onClick={() => handleRefresh(slot.connectionId)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#252a38] transition-all cursor-pointer"
                            title="Refresh Token & Health"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDisconnect(slot.connectionId)}
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-all cursor-pointer"
                            title="Purge Credentials (Delete)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggle(slot.connectionId)}
                            className={`w-9 h-5 rounded-full p-0.5 flex items-center transition-all cursor-pointer ${
                              isSlotActive
                                ? 'bg-emerald-500 justify-end shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                                : 'bg-slate-700 justify-start'
                            }`}
                            title={isSlotActive ? "ON: Eligible in Scheduler" : "OFF: Excluded from Scheduler"}
                          >
                            <div className="w-4 h-4 rounded-full bg-white shadow-md"></div>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Quotas Model List (Live Telemetry Only - No Fabricated Arrays) */}
                  {isEnrolled ? (
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-2">
                        <span>
                          {recordedModels.length > 0 ? `${recordedModels.length} observed models` : 'Live Quota Telemetry'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Source: {quotaSource}
                        </span>
                      </div>

                      {recordedModels.length > 0 ? (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                          {recordedModels.map((modelId) => {
                            const m = modelsMap[modelId];
                            const limit = m.limit || 1000;
                            const remaining = m.remaining ?? limit;
                            const used = m.used ?? (limit - remaining);
                            const pct = Math.min(100, Math.max(0, Math.round((remaining / limit) * 100)));
                            const isUpstream = m.source === 'UPSTREAM_OBSERVED';

                            return (
                              <div key={modelId} className="flex items-center justify-between text-[11px] font-mono py-1 px-2 rounded-lg bg-[#14161f] border border-[#212533]">
                                <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                    isUpstream ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-amber-400'
                                  }`}></span>
                                  <span className="text-slate-200 truncate">{modelId}</span>
                                  <span className="text-slate-400 text-[10px] flex-shrink-0">
                                    {remaining} / {limit}
                                  </span>
                                </div>

                                <div className="flex items-center gap-3 flex-shrink-0">
                                  <div className="w-24 h-1 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${isUpstream ? 'bg-emerald-400' : 'bg-amber-400'}`}
                                      style={{ width: `${pct}%` }}
                                    ></div>
                                  </div>
                                  <span className={`font-bold text-[10px] w-8 text-right ${isUpstream ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {pct}%
                                  </span>
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-black/40 text-slate-400 border border-slate-800">
                                    {isUpstream ? 'UPSTREAM' : 'ESTIMATE'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                          {(slot.models || []).map((modelId) => (
                            <div key={modelId} className="flex items-center justify-between text-[11px] font-mono py-1 px-2 rounded-lg bg-[#14161f] border border-[#212533]">
                              <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                                <span className="w-2 h-2 rounded-full bg-cyan-400/60 flex-shrink-0"></span>
                                <span className="text-slate-300 truncate">{modelId}</span>
                              </div>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                                READY (STANDBY)
                              </span>
                            </div>
                          ))}
                          <div className="mt-2 p-2 rounded-lg bg-black/30 border border-[#212533] text-[10px] font-mono text-slate-400">
                            Telemetri kuota upstream Google akan dicatat otomatis pada request chat pertama.
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Not Connected State */
                    <div className="py-4 px-2 flex flex-col items-center justify-center text-center space-y-2 font-mono">
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          STATUS: NOT_ENROLLED
                        </span>
                        <span className="text-slate-500">|</span>
                        <span className="text-amber-400/90 text-[10px]">
                          No live credential
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Quota: <span className="text-slate-400 font-bold">NOT_AVAILABLE</span>
                      </div>
                      <button
                        onClick={() => handleStartConnect(slot.connectionId)}
                        className="mt-2 py-2 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold font-mono flex items-center gap-2 shadow-[0_0_15px_rgba(0,102,255,0.4)] transition-all cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>CONNECT {slot.connectionId.toUpperCase()}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
