import React, { useState, useEffect } from 'react';
import { X, Settings, Cpu, Volume2, Globe, Shield, Check, Layers, Activity, Server, Zap } from 'lucide-react';
import { RouterConfig } from '../../../services/router/RouterConfig.js';

export default function ControlCenterModal({ isOpen, onClose }) {
  const [endpoint, setEndpoint] = useState(RouterConfig.getEndpoint());
  const [speechRate, setSpeechRate] = useState(1.05);
  const [isSaved, setIsSaved] = useState(false);
  const [poolStats, setPoolStats] = useState({ total: 7, enrolled: 0, active: 0, status: 'CHECKING' });

  useEffect(() => {
    if (isOpen) {
      fetch('http://127.0.0.1:20200/api/antigravity/connections', { signal: AbortSignal.timeout(2000) })
        .then(res => res.json())
        .then(data => {
          const slots = data.slots || data.accounts || [];
          const enrolled = slots.filter(s => s.isEnrolled).length;
          const active = slots.filter(s => s.isEnrolled && s.isActive !== false).length;
          setPoolStats({ total: 7, enrolled, active, status: 'ONLINE' });
        })
        .catch(() => {
          setPoolStats({ total: 7, enrolled: 0, active: 0, status: 'OFFLINE' });
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      window.__ULTIMATE_ROUTER_ENDPOINT__ = endpoint;
    }
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-[#0a101f] border border-cyan-500/30 rounded-3xl p-6 shadow-[0_0_50px_rgba(0,229,255,0.2)] text-slate-200 select-none flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_12px_rgba(0,229,255,0.3)]">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-mono tracking-wide">
                ULTIMATEAI CONTROL CENTER
              </h3>
              <p className="text-xs text-slate-400">
                Arsitektur Antigravity Pool & Konfigurasi Local Router :20200
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-4 space-y-4">
          {/* Antigravity Runtime Status */}
          <div className="bg-[#121624] border border-[#23293d] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>Router Backend:</span>
              </span>
              <span className="font-bold text-cyan-300">LOCAL ROUTER :20200</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center font-mono">
              <div className="bg-[#181d2e] p-2.5 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400">TOTAL SLOTS</div>
                <div className="text-sm font-bold text-cyan-400 mt-0.5">{poolStats.total} Slots</div>
              </div>
              <div className="bg-[#181d2e] p-2.5 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400">ENROLLED</div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">{poolStats.enrolled} / 7</div>
              </div>
              <div className="bg-[#181d2e] p-2.5 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400">ACTIVE</div>
                <div className="text-sm font-bold text-amber-400 mt-0.5">{poolStats.active} / 7</div>
              </div>
            </div>
          </div>

          {/* Model Resolution Core */}
          <div className="space-y-1.5 bg-[#121624] border border-[#23293d] rounded-2xl p-4">
            <label className="text-xs font-bold text-cyan-400 font-mono flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              <span>DYNAMIC MODEL RESOLUTION</span>
            </label>
            <p className="text-xs text-slate-300">
              Inferensi disalurkan secara otonom melalui <strong className="text-cyan-300">AntigravityModelRegistry</strong> & <strong className="text-cyan-300">AntigravityQuotaTracker</strong> dengan rotasi deterministik 7 Pool Akun Google.
            </p>
            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-1">
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>Didukung 11 Model: Gemini 3.6 Flash, Claude 4.6 Thinking, GPT-OSS 120B, dsb.</span>
            </div>
          </div>

          {/* Local Router Endpoint */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-cyan-400 font-mono flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              <span>LOCAL ROUTER ENDPOINT</span>
            </label>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="http://127.0.0.1:20200"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
            />
            <p className="text-[10px] text-slate-500 font-mono">
              Default Local Router berjalan di http://127.0.0.1:20200
            </p>
          </div>

          {/* Voice Settings */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-cyan-400 font-mono flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" />
              <span>KECEPATAN SUARA JIN (SPEECH RATE)</span>
            </label>
            <div className="flex items-center gap-4 bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
              <input
                type="range"
                min="0.8"
                max="1.4"
                step="0.05"
                value={speechRate}
                onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                className="flex-1 accent-cyan-400"
              />
              <span className="text-xs font-bold font-mono text-cyan-300 w-12 text-right">
                {speechRate.toFixed(2)}x
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[10px] text-slate-500 font-mono">
            UltimateAI Architecture SSOT
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              Tutup
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-xl text-xs font-mono font-bold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-[0_0_15px_rgba(0,102,255,0.4)] flex items-center gap-1.5"
            >
              {isSaved ? <Check className="w-3.5 h-3.5" /> : null}
              <span>{isSaved ? 'Tersimpan!' : 'Simpan Pengaturan'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
