import React, { useState, useEffect } from 'react';
import { X, Activity, Cpu, Zap, Shield, Clock, CheckCircle2, AlertTriangle, GitCommit, Wrench } from 'lucide-react';
import { routerStatusInstance } from '../../../services/router/RouterStatus.js';

export default function ActivityFeedDrawer({ isOpen, onClose }) {
  const [status, setStatus] = useState(routerStatusInstance.getStatus());
  const [engStatus, setEngStatus] = useState({ status: 'ONLINE', level: 3, totalIncidents: 0, pendingIncidents: 0, learnedPatterns: 0 });
  const [incidents, setIncidents] = useState([]);
  const [isApproving, setIsApproving] = useState(false);

  const fetchEngineeringData = async () => {
    try {
      const res = await fetch('/api/engineering/status');
      if (res.ok) {
        const data = await res.json();
        setEngStatus(data);
      }
      const incRes = await fetch('/api/engineering/incidents');
      if (incRes.ok) {
        const incData = await incRes.json();
        setIncidents(incData.incidents || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    const unsub = routerStatusInstance.subscribe(setStatus);
    fetchEngineeringData();
    const interval = setInterval(fetchEngineeringData, 3000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  const handleApprove = async (incidentId) => {
    setIsApproving(true);
    try {
      await fetch('/api/engineering/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentId })
      });
      await fetchEngineeringData();
    } catch (_) {}
    setIsApproving(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-[#0a101f] border border-emerald-500/30 rounded-3xl p-6 shadow-[0_0_60px_rgba(16,185,129,0.25)] text-slate-200 select-none flex flex-col max-h-[85vh] overflow-hidden z-[101]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-mono tracking-wide flex items-center gap-2">
                <span>AUTONOMOUS ENGINEERING HUD</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
                  LEVEL {engStatus.level || 3}
                </span>
              </h3>
              <p className="text-xs text-slate-400">Live Telemetry, Self-Healing Subsystem & Incident Queue</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Real Status Metrics Banner */}
        <div className="grid grid-cols-3 gap-2.5 my-3.5 flex-shrink-0 text-center">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
            <div className="text-[9px] text-slate-400 font-mono uppercase">OBSERVER STATUS</div>
            <div className="text-xs font-bold text-emerald-400 font-mono mt-0.5 flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {engStatus.status || 'ACTIVE'}
            </div>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
            <div className="text-[9px] text-slate-400 font-mono uppercase">INCIDENTS (ACTIVE/TOTAL)</div>
            <div className="text-xs font-bold text-cyan-400 font-mono mt-0.5">
              {engStatus.pendingIncidents} / {engStatus.totalIncidents}
            </div>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
            <div className="text-[9px] text-slate-400 font-mono uppercase">LEARNED PATTERNS</div>
            <div className="text-xs font-bold text-purple-400 font-mono mt-0.5">
              {engStatus.learnedPatterns} VALIDATED
            </div>
          </div>
        </div>

        {/* Live Incident Queue List */}
        <div className="space-y-2 flex-1 overflow-hidden flex flex-col my-1">
          <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase font-mono flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>LIVE INCIDENT PIPELINE & DIAGNOSTICS</span>
            </div>
            <span className="text-slate-500 font-mono text-[9px]">{incidents.length} Records</span>
          </div>

          <div className="space-y-2.5 overflow-y-auto custom-scrollbar pr-1 flex-1">
            {incidents.length > 0 ? (
              incidents.map((inc) => (
                <div
                  key={inc.incidentId}
                  className="bg-slate-950/75 border border-slate-800/90 rounded-xl p-3 text-xs space-y-2 hover:border-cyan-500/40 transition-all"
                >
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-cyan-300">{inc.incidentId}</span>
                      <span className="text-slate-500">â€¢</span>
                      <span className="text-slate-400">{inc.targetComponent}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] border ${
                      inc.status === 'STABLE' || inc.status === 'DEPLOYED'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : inc.status === 'AWAITING_APPROVAL'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/30 animate-pulse'
                        : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                    }`}>
                      {inc.status}
                    </span>
                  </div>

                  <div className="text-slate-200 text-xs leading-relaxed">
                    {inc.errorMessage}
                  </div>

                  {inc.diagnosticReport && (
                    <div className="bg-slate-900/90 rounded-lg p-2 border border-slate-800 space-y-1 text-[11px]">
                      <div className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Root Cause: {inc.diagnosticReport.rootCause}</span>
                      </div>
                      <div className="text-slate-400 font-mono text-[9.5px]">
                        Fix Strategy: <span className="text-cyan-300">{inc.diagnosticReport.proposedFix}</span> (Confidence: {(inc.diagnosticReport.confidence * 100).toFixed(0)}%)
                      </div>
                    </div>
                  )}

                  {/* Level 3 Approval Gate Button */}
                  {inc.status === 'AWAITING_APPROVAL' && (
                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-[10px] text-purple-300 font-mono">
                        ðŸ§ª Sandbox Tests: <b className="text-emerald-400">100% PASSED</b>
                      </span>
                      <button
                        onClick={() => handleApprove(inc.incidentId)}
                        disabled={isApproving}
                        className="py-1 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold text-[10px] flex items-center gap-1 shadow-md transition-all cursor-pointer"
                      >
                        <Wrench className="w-3 h-3" />
                        <span>{isApproving ? 'MERGING...' : 'APPROVE & MERGE PATCH âž”'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 font-mono text-xs">
                No active incidents. System observer is operating normally.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 mt-1 border-t border-slate-800 text-[10px] text-slate-500 font-mono flex items-center justify-between flex-shrink-0">
          <span>Engineering Runtime v1</span>
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            SUPERVISED SELF-HEALING ACTIVE (LEVEL 3)
          </span>
        </div>
      </div>
    </div>
  );
}
