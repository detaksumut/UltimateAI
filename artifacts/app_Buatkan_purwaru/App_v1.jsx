import React, { useState } from 'react';

export default function ResearchRoiCalculator() {
  const [investment, setInvestment] = useState(100);
  const [expectedReturn, setExpectedReturn] = useState(150);

  const calculateRoi = () => {
    if (!investment || investment <= 0) return 0;
    return (((expectedReturn - investment) / investment) * 100).toFixed(2);
  };

  const roiValue = calculateRoi();
  const isPositive = Number(roiValue) >= 0;

  return (
    <div className="p-5 bg-slate-900/90 backdrop-blur border border-cyan-500/30 rounded-2xl text-slate-100 max-w-md mx-auto shadow-2xl font-sans">
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3 mb-4">
        <h2 className="text-sm font-bold tracking-wider text-cyan-400 uppercase flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          Kalkulator ROI Riset
        </h2>
        <span className="text-[10px] bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-800">
          PROTOTYPE v1.0
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Nilai Investasi Riset (Juta Rp / USD)</label>
          <input
            type="number"
            value={investment}
            onChange={(e) => setInvestment(Number(e.target.value))}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-cyan-200 focus:outline-none focus:border-cyan-400"
            placeholder="Contoh: 100"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Ekspektasi Hasil / Manfaat (Juta Rp / USD)</label>
          <input
            type="number"
            value={expectedReturn}
            onChange={(e) => setExpectedReturn(Number(e.target.value))}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-cyan-200 focus:outline-none focus:border-cyan-400"
            placeholder="Contoh: 150"
          />
        </div>

        <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 text-center">
          <span className="text-xs text-slate-400 uppercase tracking-widest block mb-1">Estimasi ROI Riset</span>
          <span className={`text-3xl font-black tracking-tight ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {roiValue}%
          </span>
          <p className="text-[11px] text-slate-500 mt-1">
            Formula: ((Manfaat - Investasi) / Investasi) × 100%
          </p>
        </div>
      </div>
    </div>
  );
}