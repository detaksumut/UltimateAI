// src/components/DeploymentStatus.jsx
// Real-time deployment pipeline status component
import React, { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, XCircle, GitBranch, Database, Globe, Rocket, ExternalLink } from 'lucide-react';
import { post, get } from '../services/apiClient';

const STEPS = [
  { key: 'github',   label: 'Push to GitHub',          icon: GitBranch, color: 'text-slate-400' },
  { key: 'supabase', label: 'Create Database',         icon: Database, color: 'text-emerald-400' },
  { key: 'vercel',   label: 'Deploy to Vercel',        icon: Globe,    color: 'text-blue-400' },
];

function StepIcon({ status, Icon }) {
  if (status === 'done')    return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
  if (status === 'running') return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
  if (status === 'failed')  return <XCircle className="w-5 h-5 text-red-400" />;
  return <Icon className="w-5 h-5 text-slate-600" />;
}

export default function DeploymentStatus({ projectId, onComplete }) {
  const [steps, setSteps] = useState({ github: 'pending', supabase: 'pending', vercel: 'pending' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isDeploying, setIsDeploying] = useState(false);

  const startDeploy = async () => {
    setIsDeploying(true);
    setError(null);
    setResult(null);
    // Mark github as running immediately for feedback
    setSteps({ github: 'running', supabase: 'pending', vercel: 'pending' });

    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${API_BASE}/api/deploy/${projectId}`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || data.error || 'Deploy failed');

      setSteps(data.steps || { github: 'done', supabase: 'done', vercel: 'done' });
      setResult(data);
      if (onComplete) onComplete(data);
    } catch (err) {
      setError(err.message);
      setSteps(prev => ({
        github:   prev.github   === 'running' ? 'failed' : prev.github,
        supabase: prev.supabase === 'running' ? 'failed' : prev.supabase,
        vercel:   prev.vercel   === 'running' ? 'failed' : prev.vercel,
      }));
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="bg-[#111827] border border-white/5 rounded-2xl p-8 shadow-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
          <Rocket className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Deploy to Cloud</h2>
          <p className="text-slate-400 text-sm">GitHub → Supabase → Vercel → Live URL</p>
        </div>
      </div>

      {/* Pipeline Steps */}
      <div className="space-y-4 mb-8">
        {STEPS.map(({ key, label, icon: Icon }, idx) => (
          <div key={key} className="flex items-center gap-4">
            {/* Connector line */}
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                steps[key] === 'done'    ? 'border-emerald-500 bg-emerald-500/10' :
                steps[key] === 'running' ? 'border-blue-500 bg-blue-500/10' :
                steps[key] === 'failed'  ? 'border-red-500 bg-red-500/10' :
                'border-slate-700 bg-slate-800/50'
              }`}>
                <StepIcon status={steps[key]} Icon={Icon} />
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`w-0.5 h-6 mt-1 ${
                  steps[key] === 'done' ? 'bg-emerald-500/50' : 'bg-slate-800'
                }`} />
              )}
            </div>
            <div className="flex-1">
              <p className={`font-semibold ${
                steps[key] === 'done'    ? 'text-emerald-400' :
                steps[key] === 'running' ? 'text-blue-300' :
                steps[key] === 'failed'  ? 'text-red-400' :
                'text-slate-500'
              }`}>
                {label}
              </p>
              <p className="text-xs text-slate-600 capitalize">
                {steps[key] === 'pending' ? 'Waiting...' :
                 steps[key] === 'running' ? 'In progress...' :
                 steps[key] === 'done'    ? 'Completed' :
                 steps[key] === 'failed'  ? 'Failed' : ''}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-4">
          <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-400">Deployment Failed</p>
            <p className="text-xs text-red-300/70 mt-1">{error}</p>
            <p className="text-xs text-slate-500 mt-2">
              Make sure GITHUB_TOKEN, SUPABASE_ACCESS_TOKEN, and VERCEL_TOKEN are set in your .env file.
            </p>
          </div>
        </div>
      )}

      {/* Result — Live URL */}
      {result?.liveUrl && (
        <div className="p-5 bg-gradient-to-br from-emerald-900/30 to-blue-900/30 border border-emerald-500/30 rounded-xl mb-6">
          <p className="text-sm text-emerald-400 font-semibold mb-1 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Application is Live!
          </p>
          <a
            href={result.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-lg font-bold text-white hover:text-blue-300 transition-colors break-all"
          >
            {result.liveUrl}
            <ExternalLink className="w-4 h-4 shrink-0" />
          </a>
          {result.githubUrl && (
            <a href={result.githubUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 mt-2 transition-colors"
            >
              <GitBranch className="w-3 h-3" /> View Source Code
            </a>
          )}
        </div>
      )}

      {/* Deploy Button */}
      {!result && (
        <button
          onClick={startDeploy}
          disabled={isDeploying}
          className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-4 px-8 rounded-xl font-bold text-lg shadow-xl shadow-blue-900/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isDeploying ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Deploying... (this may take 3–5 minutes)
            </>
          ) : (
            <>
              <Rocket className="w-5 h-5" /> Deploy Live Now
            </>
          )}
        </button>
      )}

      {result && (
        <div className="flex gap-3">
          {result.liveUrl && (
            <a
              href={result.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 px-6 rounded-xl font-bold transition-all"
            >
              <Globe className="w-5 h-5" /> Open Application
            </a>
          )}
          {result.githubUrl && (
            <a
              href={result.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-3.5 px-6 rounded-xl font-semibold transition-all"
            >
              <GitBranch className="w-5 h-5" /> Source Code
            </a>
          )}
        </div>
      )}
    </div>
  );
}
