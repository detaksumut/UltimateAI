import React, { useState, useEffect } from 'react';
import { X, Zap, RefreshCw, Trash2, AlertCircle, ShieldCheck } from 'lucide-react';

const API_ENDPOINTS = [
  'http://127.0.0.1:20200',
  'http://localhost:20200',
  'http://127.0.0.1:20128',
  'http://localhost:20128',
  ''
];

export default function ConnectionsModal({ isOpen, onClose }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeEndpoint, setActiveEndpoint] = useState(API_ENDPOINTS[0]);
  const [errorMsg, setErrorMsg] = useState(null);

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
      setErrorMsg('Local Router (127.0.0.1:20200 / 20128) sedang offline atau belum dijalankan.');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchSlots();
      const interval = setInterval(fetchSlots, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleStartConnect = async (connectionId) => {
    try {
      setErrorMsg(null);
      // Pre-open tab immediately in user gesture to avoid popup blockers
      const authWindow = window.open('', '_blank');
      if (authWindow) {
        authWindow.document.write(`
          <html>
            <body style="background:#090d16;color:#22d3ee;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
              <div style="text-align:center;">
                <h3 style="color:#38bdf8;margin:0 0 8px 0;">Membuka Login Google...</h3>
                <p style="color:#94a3b8;font-size:13px;margin:0;">Menghubungkan slot ${connectionId.toUpperCase()} ke Google Cloud...</p>
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
      setErrorMsg(`Gagal memulai koneksi ${connectionId.toUpperCase()}: ${err.message}`);
    }
  };

  const handleRefresh = async (connectionId) => {
    try {
      const res = await fetch(`${activeEndpoint}/api/antigravity/connections/${connectionId}/refresh`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Refresh gagal');
      fetchSlots();
    } catch (err) {
      setErrorMsg(`Refresh ${connectionId.toUpperCase()} gagal: ${err.message}`);
    }
  };

  const handleDisconnect = async (connectionId) => {
    if (!confirm(`Apakah Anda yakin ingin memutuskan dan menghapus kredensial ${connectionId.toUpperCase()} dari Vault?`)) return;
    try {
      const res = await fetch(`${activeEndpoint}/api/antigravity/connections/${connectionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Disconnect gagal');
      fetchSlots();
    } catch (err) {
      setErrorMsg(`Disconnect ${connectionId.toUpperCase()} gagal: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  const enrolledCount = slots.filter(s => s.isEnrolled).length;
  const healthyCount = slots.filter(s => s.isEnrolled && s.status !== 'RATE_LIMITED' && s.status !== 'AUTH_EXPIRED').length;
  const rateLimitedCount = slots.filter(s => s.status === 'RATE_LIMITED').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-5xl bg-[#090d16] border border-cyan-500/30 rounded-3xl p-6 shadow-[0_0_60px_rgba(0,229,255,0.2)] text-slate-200 select-none flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(0,229,255,0.3)]">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-mono tracking-wide flex items-center gap-2">
                ANTIGRAVITY MULTI-CONNECTION MANAGER
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                  7 SLOTS
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Pilih dan hubungkan akun Google Anda untuk tiap slot AG-01 s/d AG-07
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchSlots}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 flex items-center gap-1.5 transition-all border border-slate-700 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Summary Status */}
        <div className="my-3 px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-4">
            <span className="text-cyan-400 font-bold">STATUS:</span>
            <span><strong className="text-emerald-400">{enrolledCount}/7</strong> ENROLLED</span>
            <span><strong className="text-cyan-400">{healthyCount}/7</strong> HEALTHY</span>
            <span><strong className="text-amber-400">{rateLimitedCount}/7</strong> RATE LIMITED</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Vault AES-256-GCM Encrypted</span>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-3 px-4 py-2 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2 font-mono">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Slot Grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 py-1">
          {slots.map((slot) => {
            const isEnrolled = slot.isEnrolled;
            const remaining = slot.quotaSummary?.remainingEstimate ?? 1000;
            const pct = Math.min(100, Math.max(0, (remaining / 1000) * 100));

            return (
              <div
                key={slot.connectionId}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                  isEnrolled
                    ? 'bg-slate-900/60 border-cyan-500/30 shadow-[0_0_15px_rgba(0,229,255,0.08)]'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold font-mono text-cyan-300">{slot.connectionId.toUpperCase()}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({slot.accountAlias})</span>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase font-mono ${
                        isEnrolled
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : slot.status === 'WAITING_FOR_AUTH'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {slot.status}
                    </span>
                  </div>

                  {/* Metadata Chips */}
                  <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono text-slate-400 bg-black/30 p-2 rounded-lg mb-2">
                    <div>Project: <span className="text-slate-200 font-semibold">{slot.projectId}</span></div>
                    <div>Cloud Code: <span className="text-emerald-400 font-semibold">{isEnrolled ? 'VERIFIED' : 'PENDING'}</span></div>
                    <div>Token: <span className="text-slate-200 font-semibold">{slot.hasRefreshToken ? 'VALID' : 'NONE'}</span></div>
                    <div>Priority: <span className="text-cyan-300 font-semibold">#{slot.priority}</span></div>
                  </div>

                  {/* Quota */}
                  <div className="bg-black/20 p-2 rounded-lg">
                    <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                      <span>Quota Fast Chat</span>
                      <span>{remaining} / 1,000 ({slot.quotaSummary?.source || 'LOCAL'})</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${pct > 20 ? 'bg-emerald-400' : 'bg-red-400'}`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                  {!isEnrolled ? (
                    <button
                      onClick={() => handleStartConnect(slot.connectionId)}
                      className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold font-mono flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(0,102,255,0.3)] transition-all cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>CONNECT {slot.connectionId.toUpperCase()}</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleRefresh(slot.connectionId)}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center justify-center gap-1 border border-slate-700 transition-all cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Refresh</span>
                      </button>
                      <button
                        onClick={() => handleDisconnect(slot.connectionId)}
                        className="py-1.5 px-2.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-mono flex items-center justify-center gap-1 border border-red-800/40 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Disconnect</span>
                      </button>
                    </>
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
