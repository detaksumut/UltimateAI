import React, { useState, useEffect } from 'react';
import { X, Zap, RefreshCw, Trash2, Edit3, Power, ExternalLink, CheckCircle2, ShieldCheck, Eye, EyeOff, Layers, Filter } from 'lucide-react';

const API_ENDPOINTS = [
  'http://127.0.0.1:20200',
  'http://localhost:20200',
  'http://127.0.0.1:20128',
  'http://localhost:20128',
  ''
];

const DEFAULT_MODELS = [
  { name: 'Gemini 3.6 Flash (High)', used: 3, total: 1000, reset: 'in 5d 10h 40m' },
  { name: 'Gemini 3.6 Flash (Medium)', used: 3, total: 1000, reset: 'in 5d 10h 40m' },
  { name: 'Gemini 3.6 Flash (Low)', used: 3, total: 1000, reset: 'in 5d 10h 40m' },
  { name: 'Gemini 3.5 Flash (Medium)', used: 3, total: 1000, reset: 'in 5d 10h 40m' },
  { name: 'Gemini 3.5 Flash (Low)', used: 3, total: 1000, reset: 'in 5d 10h 40m' },
  { name: 'Gemini 3.1 Pro (High)', used: 3, total: 1000, reset: 'in 5d 10h 40m' },
  { name: 'Gemini 3.1 Pro (Low)', used: 3, total: 1000, reset: 'in 5d 10h 40m' },
  { name: 'Claude Sonnet 4.6 (Thinking)', used: 0, total: 1000, reset: 'in 7d 0h 0m' },
  { name: 'Claude Opus 4.6 (Thinking)', used: 0, total: 1000, reset: 'in 7d 0h 0m' },
  { name: 'GPT-OSS 120B (Medium)', used: 0, total: 1000, reset: 'in 7d 0h 0m' }
];

export default function ConnectionsModal({ isOpen, onClose }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeEndpoint, setActiveEndpoint] = useState(API_ENDPOINTS[0]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [autoRefreshSec, setAutoRefreshSec] = useState(55);

  const fetchSlots = async () => {
    setLoading(true);
    let success = false;

    for (const ep of [activeEndpoint, ...API_ENDPOINTS]) {
      try {
        const res = await fetch(`${ep}/api/antigravity/connections`, { signal: AbortSignal.timeout(1500) });
        if (res.ok) {
          const data = await res.json();
          setSlots(data.slots || []);
          setActiveEndpoint(ep);
          setErrorMsg(null);
          success = true;
          break;
        }
      } catch {}
    }

    if (!success) {
      setErrorMsg('Local Router (127.0.0.1:20200) sedang offline.');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchSlots();
      const interval = setInterval(() => {
        fetchSlots();
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
      fetchSlots();
    } catch (err) {
      setErrorMsg(`Gagal menghubungkan ${connectionId.toUpperCase()}: ${err.message}`);
    }
  };

  const handleRefresh = async (connectionId) => {
    try {
      const res = await fetch(`${activeEndpoint}/api/antigravity/connections/${connectionId}/refresh`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Refresh gagal');
      fetchSlots();
    } catch (err) {
      setErrorMsg(`Refresh gagal: ${err.message}`);
    }
  };

  const handleDisconnect = async (connectionId) => {
    if (!confirm(`Hapus dan putuskan koneksi ${connectionId.toUpperCase()} dari Pool Antigravity?`)) return;
    try {
      const res = await fetch(`${activeEndpoint}/api/antigravity/connections/${connectionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Disconnect gagal');
      fetchSlots();
    } catch (err) {
      setErrorMsg(`Disconnect gagal: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-7xl bg-[#12141a] border border-[#232734] rounded-2xl p-5 shadow-[0_0_80px_rgba(0,0,0,0.8)] text-slate-200 select-none flex flex-col max-h-[95vh] overflow-hidden">
        {/* Top Control Toolbar (9Router Style) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#232734] text-xs font-mono">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-3 py-1.5 rounded-lg bg-[#1a1d26] border border-[#2d3243] text-slate-300 flex items-center gap-1.5 cursor-pointer">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>All Providers ▾</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#1a1d26] border border-[#2d3243] text-slate-300 flex items-center gap-1.5 cursor-pointer">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              <span>All accounts ▾</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#1a1d26] border border-[#2d3243] text-slate-300 cursor-pointer">
              ⏳ Expiring first
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#1a1d26] border border-[#2d3243] text-red-400/90 cursor-pointer">
              🚫 Turn off Empty
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#1a1d26] border border-[#2d3243] text-emerald-400/90 cursor-pointer">
              ✅ Turn on Available
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#1a1d26] border border-[#2d3243] text-amber-400/90 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              <span>Auto-refresh ({autoRefreshSec}s)</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchSlots}
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
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 9Router Styled Account Grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 grid grid-cols-1 lg:grid-cols-2 gap-4 py-3">
          {slots.map((slot) => {
            const isEnrolled = slot.isEnrolled;
            const accountEmail = slot.email || slot.accountAlias || `antigravity-${slot.connectionId.replace('ag-', '')}@gmail.com`;

            return (
              <div
                key={slot.connectionId}
                className="bg-[#181b24] border border-[#282d3d] rounded-2xl p-4 flex flex-col justify-between shadow-lg transition-all hover:border-[#383f55]"
              >
                <div>
                  {/* Card Header (9Router Style) */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#252a39] mb-3">
                    <div className="flex items-center gap-3">
                      {/* Antigravity Colorful Delta Logo */}
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
                        </div>
                        <span className={`text-xs font-mono font-bold tracking-tight ${isEnrolled ? 'text-slate-100' : 'text-slate-500'}`}>
                          {isEnrolled ? accountEmail : '(Belum Terhubung)'}
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
                            title="Refresh Token"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDisconnect(slot.connectionId)}
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-all cursor-pointer"
                            title="Disconnect Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {/* Toggle Switch */}
                          <div className="w-9 h-5 rounded-full bg-emerald-500/80 p-0.5 flex items-center justify-end cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                            <div className="w-4 h-4 rounded-full bg-white shadow-md"></div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Quotas Model List (9Router Style) */}
                  {isEnrolled ? (
                    <div>
                      <div className="text-[11px] text-slate-400 font-mono mb-2">11 quotas</div>
                      <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                        {DEFAULT_MODELS.map((m, idx) => {
                          const pct = Math.round(((m.total - m.used) / m.total) * 100);
                          return (
                            <div key={idx} className="flex items-center justify-between text-[11px] font-mono py-1 px-2 rounded-lg bg-[#14161f] border border-[#212533] hover:border-[#2f3549]">
                              <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.8)]"></span>
                                <span className="text-slate-200 truncate">{m.name}</span>
                                <span className="text-slate-400 text-[10px] flex-shrink-0">{m.used}/1,000</span>
                              </div>

                              <div className="flex items-center gap-3 flex-shrink-0">
                                {/* Green Quota Bar */}
                                <div className="w-28 h-1 bg-slate-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" style={{ width: `${pct}%` }}></div>
                                </div>
                                <span className="text-emerald-400 font-bold text-[10px] w-8 text-right">{pct}%</span>
                                <span className="text-slate-400 text-[10px] w-20 text-right">{m.reset}</span>
                                <EyeOff className="w-3.5 h-3.5 text-slate-500 cursor-pointer hover:text-slate-300" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* Not Connected Placeholder */
                    <div className="py-8 flex flex-col items-center justify-center text-center">
                      <p className="text-xs text-slate-400 mb-4 font-mono">
                        Slot {slot.connectionId.toUpperCase()} siap dihubungkan ke akun Google Antigravity Anda.
                      </p>
                      <button
                        onClick={() => handleStartConnect(slot.connectionId)}
                        className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold font-mono flex items-center gap-2 shadow-[0_0_20px_rgba(0,102,255,0.4)] transition-all cursor-pointer"
                      >
                        <Zap className="w-4 h-4" />
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
