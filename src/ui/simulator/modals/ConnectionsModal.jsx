import React, { useState, useEffect } from 'react';
import { X, Zap, RefreshCw, Trash2, CheckCircle2, AlertCircle, Clock, ShieldCheck, Settings, Key } from 'lucide-react';

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
  const [activeEnrollment, setActiveEnrollment] = useState(null);
  const [enrollProgress, setEnrollProgress] = useState(null);
  const [manualCallbackUrl, setManualCallbackUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);

  // OAuth Config State
  const [oauthConfigValid, setOauthConfigValid] = useState(true);
  const [showConfigBox, setShowConfigBox] = useState(false);
  const [customClientId, setCustomClientId] = useState('');
  const [customClientSecret, setCustomClientSecret] = useState('');

  const fetchSlotsAndConfig = async () => {
    setLoading(true);
    let success = false;

    for (const ep of [activeEndpoint, ...API_ENDPOINTS]) {
      try {
        // 1. Fetch Slots
        const res = await fetch(`${ep}/api/antigravity/connections`, { signal: AbortSignal.timeout(1500) });
        if (res.ok) {
          const data = await res.json();
          setSlots(data.slots || []);
          setActiveEndpoint(ep);
          success = true;

          // 2. Fetch OAuth Config
          try {
            const configRes = await fetch(`${ep}/api/antigravity/config`);
            if (configRes.ok) {
              const cfg = await configRes.json();
              setOauthConfigValid(cfg.valid);
              if (!cfg.valid) {
                setShowConfigBox(true);
              }
            }
          } catch {}

          setErrorMsg(null);
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
      fetchSlotsAndConfig();
      const interval = setInterval(fetchSlotsAndConfig, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  // Polling for active enrollment session
  useEffect(() => {
    let pollTimer = null;
    if (activeEnrollment && activeEnrollment.enrollmentId) {
      pollTimer = setInterval(async () => {
        try {
          const res = await fetch(`${activeEndpoint}/api/antigravity/enrollments/${activeEnrollment.enrollmentId}`);
          if (res.ok) {
            const data = await res.json();
            setEnrollProgress(data);
            if (data.state === 'ENROLLED') {
              clearInterval(pollTimer);
              setActiveEnrollment(null);
              fetchSlotsAndConfig();
            } else if (data.state.includes('FAILED') || data.state.includes('TIMEOUT') || data.state.includes('CANCELLED')) {
              clearInterval(pollTimer);
            }
          }
        } catch {}
      }, 1500);
    }
    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [activeEnrollment, activeEndpoint]);

  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault();
    if (!customClientId.trim()) {
      setErrorMsg('Harap masukkan Google OAuth Client ID (.apps.googleusercontent.com)');
      return;
    }
    try {
      const res = await fetch(`${activeEndpoint}/api/antigravity/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: customClientId.trim(),
          clientSecret: customClientSecret.trim() || undefined
        })
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        throw new Error(data.message || 'Client ID tidak valid. Pastikan format: <id>-<hash>.apps.googleusercontent.com');
      }
      setOauthConfigValid(true);
      setShowConfigBox(false);
      setErrorMsg(null);
      // Auto-trigger connect AG-01 immediately upon saving
      handleStartConnect('ag-01');
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleStartConnect = async (connectionId) => {
    try {
      setErrorMsg(null);
      const res = await fetch(`${activeEndpoint}/api/antigravity/connections/${connectionId}/enroll`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        const errMessage = data.error?.message || data.message || 'Gagal memulai koneksi';
        if (errMessage.includes('AUTH_CONFIGURATION')) {
          setShowConfigBox(true);
        }
        throw new Error(errMessage);
      }

      setActiveEnrollment(data);
      setEnrollProgress({ state: data.status, connectionId });

      // Instantly open the Google Account Chooser popup in the browser
      if (data.authUrl) {
        window.open(data.authUrl, 'google_oauth_popup', 'width=540,height=740,top=100,left=300');
      }
    } catch (err) {
      setErrorMsg(`Gagal menghubungkan ${connectionId.toUpperCase()}: ${err.message}`);
    }
  };

  const handleManualCallbackSubmit = async () => {
    if (!manualCallbackUrl || !activeEnrollment) return;
    try {
      const res = await fetch(`${activeEndpoint}/api/antigravity/enrollments/${activeEnrollment.enrollmentId}/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callbackUrl: manualCallbackUrl })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Validasi callback gagal');
      setManualCallbackUrl('');
    } catch (err) {
      setErrorMsg(`Manual Callback Gagal: ${err.message}`);
    }
  };

  const handleCancelEnrollment = async () => {
    if (activeEnrollment) {
      try {
        await fetch(`${activeEndpoint}/api/antigravity/enrollments/${activeEnrollment.enrollmentId}/cancel`, { method: 'POST' });
      } catch {}
      setActiveEnrollment(null);
      setEnrollProgress(null);
      fetchSlotsAndConfig();
    }
  };

  const handleRefresh = async (connectionId) => {
    try {
      const res = await fetch(`${activeEndpoint}/api/antigravity/connections/${connectionId}/refresh`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Refresh gagal');
      fetchSlotsAndConfig();
    } catch (err) {
      setErrorMsg(`Refresh ${connectionId.toUpperCase()} gagal: ${err.message}`);
    }
  };

  const handleDisconnect = async (connectionId) => {
    if (!confirm(`Apakah Anda yakin ingin memutuskan dan menghapus kredensial ${connectionId.toUpperCase()} dari Vault?`)) return;
    try {
      const res = await fetch(`${activeEndpoint}/api/antigravity/connections/${connectionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Disconnect gagal');
      fetchSlotsAndConfig();
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
                Pilih akun Google Anda secara independen untuk tiap slot AG-01 s/d AG-07
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowConfigBox(!showConfigBox)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 flex items-center gap-1.5 transition-all border border-cyan-500/30"
              title="Konfigurasi Client ID OAuth"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>OAuth Client ID</span>
            </button>
            <button
              onClick={fetchSlotsAndConfig}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 flex items-center gap-1.5 transition-all border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
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

        {/* OAuth Client Config Inline Box */}
        {showConfigBox && (
          <div className="mb-3 p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 text-xs font-mono space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan-300 flex items-center gap-2">
                <Key className="w-4 h-4" />
                MASUKKAN GOOGLE OAUTH DESKTOP CLIENT ID
              </span>
              <button onClick={() => setShowConfigBox(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-300">
              Paste <strong>URL Google Sign-In</strong> dari browser Anda atau Client ID (<code>.apps.googleusercontent.com</code>):
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={customClientId}
                onChange={(e) => setCustomClientId(e.target.value)}
                placeholder="Paste URL Google Sign-In ATAU Client ID di sini..."
                className="flex-1 bg-black/80 border border-cyan-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-300 font-mono"
              />
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs font-mono shadow-[0_0_15px_rgba(0,102,255,0.3)] cursor-pointer"
              >
                🚀 Simpan & Buka Login Google
              </button>
            </div>
          </div>
        )}

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

        {/* Active Enrollment Modal Overlay */}
        {activeEnrollment && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md rounded-3xl p-6 flex flex-col justify-between z-50 border border-cyan-400/40">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 animate-pulse">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold font-mono text-white">
                      AUTHORIZING {activeEnrollment.connectionId?.toUpperCase()}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Status: <span className="text-amber-400 font-semibold">{enrollProgress?.state || 'WAITING_FOR_AUTHORIZATION'}</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleCancelEnrollment}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-mono cursor-pointer"
                >
                  Batal
                </button>
              </div>

              {/* Steps Progress Visualizer */}
              <div className="my-4 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${enrollProgress?.oauth?.googleOAuth ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <span>1. Google Account Chooser & Otorisasi OAuth</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${enrollProgress?.oauth?.tokenExchange ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <span>2. Pertukaran Token PKCE (Access + Refresh Token)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${enrollProgress?.cloudCode?.authorized ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <span>3. Verifikasi Cloud Code Assist Control Plane (/v1internal:loadCodeAssist)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${enrollProgress?.cloudCode?.projectDiscovered ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <span>4. Upstream Project Discovery & Vault AES-256-GCM Persistence</span>
                </div>
              </div>

              {/* Manual URL fallback */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-2">
                <div className="text-slate-300 font-medium font-mono">
                  Browser telah dibuka otomatis dengan pilihan akun Google (Account Chooser). Jika popup diblokir, buka URL berikut:
                </div>
                <div className="p-2 rounded bg-black/60 font-mono text-[10px] text-cyan-300 break-all select-all border border-slate-800">
                  {activeEnrollment.authUrl}
                </div>

                <div className="pt-2">
                  <label className="text-[11px] text-slate-400 mb-1 block font-mono">
                    Atau paste redirect callback URL jika browser tidak redirect otomatis:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualCallbackUrl}
                      onChange={(e) => setManualCallbackUrl(e.target.value)}
                      placeholder="http://127.0.0.1:port/oauth/callback?code=..."
                      className="flex-1 bg-black/70 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      onClick={handleManualCallbackSubmit}
                      className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs font-mono cursor-pointer"
                    >
                      Submit Callback
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                Menunggu otorisasi browser...
              </span>
              <button
                onClick={handleCancelEnrollment}
                className="px-4 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-200 border border-red-800/50 cursor-pointer"
              >
                Cancel Authorization
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
