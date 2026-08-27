import React, { useState } from 'react';
import { X, Settings, Cpu, Volume2, Globe, Shield, Check } from 'lucide-react';
import { RouterConfig } from '../../../services/router/RouterConfig.js';

export default function ControlCenterModal({ isOpen, onClose }) {
  const [selectedModel, setSelectedModel] = useState('9Router-Autonomous');
  const [endpoint, setEndpoint] = useState(RouterConfig.getEndpoint());
  const [speechRate, setSpeechRate] = useState(1.05);
  const [isSaved, setIsSaved] = useState(false);

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
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-cyan-300">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-mono tracking-wide">
                CONTROL CENTER & SETTINGS
              </h3>
              <p className="text-xs text-slate-400">
                Konfigurasi orkestrasi 9Router, model AI, dan preferensi suara
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
          {/* Model Routing Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-cyan-400 font-mono flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              <span>AI REASONING CORE / MODEL SELECTOR</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: '9Router-Autonomous', name: '9Router Autonomous', desc: 'Auto-orchestrated' },
                { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', desc: 'Ultra-fast inference' },
                { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', desc: 'Deep coding & logic' },
                { id: 'deepseek-r1', name: 'DeepSeek-R1', desc: 'Complex reasoning' }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedModel(m.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedModel === m.id
                      ? 'border-cyan-400 bg-cyan-500/15 text-white shadow-[0_0_12px_rgba(0,229,255,0.3)]'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-bold font-mono">{m.name}</div>
                  <div className="text-[10px] text-slate-500">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 9Router Proxy Endpoint */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-cyan-400 font-mono flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              <span>9ROUTER PROXY ENDPOINT</span>
            </label>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="http://localhost:20128/v1"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
            />
            <p className="text-[10px] text-slate-500 font-mono">
              Default proxy lokal 9Router berjalan di port 20128
            </p>
          </div>

          {/* Voice Settings */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-cyan-400 font-mono flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5" />
                <span>KECEPATAN SUARA TTS</span>
              </label>
              <span className="text-xs font-mono text-cyan-300 font-bold">{speechRate}x</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.5"
              step="0.05"
              value={speechRate}
              onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 hover:bg-slate-700"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,229,255,0.4)]"
          >
            {isSaved ? <Check className="w-4 h-4" /> : null}
            <span>{isSaved ? 'Tersimpan!' : 'Simpan Pengaturan'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
