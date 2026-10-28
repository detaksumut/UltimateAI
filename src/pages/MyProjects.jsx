// src/pages/MyProjects.jsx
import React, { useEffect, useState } from 'react';
import { get } from '../services/apiClient';
import { useNavigate } from 'react-router-dom';
import {
  Monitor, FileText, Settings, LayoutTemplate, MessageSquare,
  Rocket, AlertCircle, Loader2, Moon, Sun, FolderOpen,
  ArrowRight, Calendar, Tag, X
} from 'lucide-react';

// Application Modal Component for Iframe-based applications
function ApplicationModal({
  isOpen,
  onClose,
  appName,
  appUrl,
  isLoading,
  error,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-2xl max-h-[85vh] bg-[#111827] rounded-xl overflow-hidden shadow-2xl shadow-slate-800/30 transform transition-all duration-500"
        style={{ width: '96vw', maxWidth: '96vw', height: 'calc(85vh - 120px)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-white/5"
        >
          <h2 className="text-xl font-bold text-white">
            {appName}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800/50 transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex flex-col h-full w-full">
          {/* Loading state */}
          {isLoading && (
            <div className="flex-1 flex items-center justify-center pt-8 text-slate-400">
              <Loader2 className="w-6 h-6 mr-3" /> Memuat...
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="flex-1 flex items-center justify-center pt-8 text-red-400">
              <AlertCircle className="w-6 h-6 mr-3" /> {error}
            </div>
          )}

          {/* Iframe */}
          <iframe
            src={appUrl}
            className="w-full h-full border-none"
            allow="autoplay; fullscreen; clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-popups"
            style={{ width: '100%', height: '100%' }}
            onLoad={() => {
              setAppLoading(false);
            }}
            onError={() => {
              setAppLoading(false);
              setAppError('Aplikasi ini tidak memungkinkan penyematan dalam iframe. Kebijakan keamanan browser mencegah menampilkan konten ini.');
            }}
          />
        </div>

        {/* Fullscreen button */}
        <button
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-800/50 transition-colors z-10"
          title="Layar penuh"
        >
          <svg
            className="w-4 h-4 text-slate-400"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M10 4L9 4l12 12-4 4-1-6-6-1L10 4z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Application definitions with URLs
const APPS = {
  AKP: {
    name: 'AKP',
    url: 'https://akp.beritaindonesia.news/',
    description: 'Berita Indonesia - AKP',
  },
  AJ: {
    name: 'AJ',
    url: 'https://aj.beritaindonesia.news/',
    description: 'Audit Justice - AJ',
  },
  'MASTER ADVOCAT': {
    name: 'MASTER ADVOCAT',
    url: 'https://master-advocat.vercel.app/',
    description: 'Master Advocat Legal Platform',
  },
}

function MyProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const navigate = useNavigate();
// Modal state for application iframes
const [visibleApp, setVisibleApp] = useState(null);
const [appLoading, setAppLoading] = useState(false);
const [appError, setAppError] = useState(null);

  const openAppModal = (appKey) => {
    const app = APPS[appKey];
    if (app) {
      setVisibleApp(appKey);
      setAppLoading(true);
      setAppError(null);
      setTimeout(() => {
        setAppLoading(false);
      }, 3000);
    }
  };

  const closeAppModal = () => {
    setVisibleApp(null);
    setAppLoading(false);
    setAppError(null);
  };

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await get('/api/projects');
        setProjects(data);
      } catch (e) {
        console.error(e);
        setError('Failed to load projects.');
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const openProject = (projectId) => {
    localStorage.setItem('currentProjectId', projectId);
    navigate('/generated-apps');
  };

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-slate-200">
      {/* HEADER */}
      <header className="border-b border-white/5 bg-[#0a0f1c]">
        <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logoUrl} alt="UltimateAI Logo" className="h-10 w-auto object-contain" />
            <div className="hidden md:block">
              <h1 className="font-bold text-2xl text-white tracking-tight leading-none">
                Ultimate<span className="text-blue-500">AI</span>
              </h1>
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.2em]">
                Helping Researchers Build, Not Code.
              </span>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-8">
            <button onClick={() => navigate('/research-builder')} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors font-medium text-sm">
              <MessageSquare className="w-4 h-4" /> Research Builder
            </button>
            <button className="flex items-center gap-2 text-blue-400 border-b-2 border-blue-500 pb-[26px] pt-[28px] font-medium text-sm">
              <FileText className="w-4 h-4" /> My Projects
            </button>
            <button onClick={() => navigate('/generated-apps')} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors font-medium text-sm">
              <Monitor className="w-4 h-4" /> Generated Apps
            </button>
            <button className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors font-medium text-sm">
              <LayoutTemplate className="w-4 h-4" /> Templates
            </button>
            <button className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors font-medium text-sm">
              <Settings className="w-4 h-4" /> Settings
            </button>
          </nav>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 rounded-full bg-slate-800/50 hover:bg-slate-700/50 border border-white/5 transition-colors text-slate-300"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold cursor-pointer">U</div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-[1200px] mx-auto px-6 py-8 space-y-6 pb-32">
        {/* Quick Access - Applications */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <div
            key="AKP"
            className="bg-[#182133] border border-white/5 rounded-2xl p-6 hover:border-indigo-500/30 transition-all cursor-pointer relative"
            onClick={() => openAppModal('AKP')}
            role="button"
            tabindex="0"
            onKeyDown={(e) => e.key === 'Enter' && openAppModal('AKP')}
          >
            <div className="flex items-center gap-3 mb-3">
              <svg
                className="w-6 h-6 text-indigo-400"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.21L7 14.14 2 9.27l6.91-1.02L12 2z" />
              </svg>
              <span className="text-lg font-bold text-white">AKP</span>
            </div>
            <p className="text-sm text-slate-500 line-clamp-2">
              Berita terbaru dari Indonesia
            </p>
          </div>

          <div
            key="AJ"
            className="bg-[#182133] border border-white/5 rounded-2xl p-6 hover:border-indigo-500/30 transition-all cursor-pointer relative"
            onClick={() => openAppModal('AJ')}
            role="button"
            tabindex="0"
            onKeyDown={(e) => e.key === 'Enter' && openAppModal('AJ')}
          >
            <div className="flex items-center gap-3 mb-3">
              <svg
                className="w-6 h-6 text-indigo-400"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14-4-4 1.41-1.42L10 14.17l6.73-6.73L6 8l2.03 1.89L10 14.17z" />
              </svg>
              <span className="text-lg font-bold text-white">AJ</span>
            </div>
            <p className="text-sm text-slate-500 line-clamp-2">
              Audit Justice Platform
            </p>
          </div>

          <div
            key="MASTER ADVOCAT"
            className="bg-[#182133] border border-white/5 rounded-2xl p-6 hover:border-indigo-500/30 transition-all cursor-pointer relative"
            onClick={() => openAppModal('MASTER ADVOCAT')}
            role="button"
            tabindex="0"
            onKeyDown={(e) => e.key === 'Enter' && openAppModal('MASTER ADVOCAT')}
          >
            <div className="flex items-center gap-3 mb-3">
              <svg
                className="w-6 h-6 text-indigo-400"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14-4-4 1.41-1.42L10 14.17l6.73-6.73L6 8l2.03 1.89L10 14.17z" />
              </svg>
              <span className="text-lg font-bold text-white">MASTER ADVOCAT</span>
            </div>
            <p className="text-sm text-slate-500 line-clamp-2">
              Master Advocat Legal Platform
            </p>
          </div>
        </div>

        {/* Page Title */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">My Projects</h2>
            <p className="text-slate-400 text-sm mt-1">All your research projects in one place</p>
          </div>
          <button
            onClick={() => navigate('/research-builder')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-blue-900/30 text-sm"
          >
            <Rocket className="w-4 h-4" /> New Project
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            <p className="text-slate-400">Loading projects...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 bg-[#111827] border border-white/5 rounded-2xl">
            <FolderOpen className="w-12 h-12 text-slate-600" />
            <p className="text-slate-400 font-medium">No projects yet. Start your first research!</p>
            <button
              onClick={() => navigate('/research-builder')}
              className="mt-2 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all text-sm"
            >
              <Rocket className="w-4 h-4" /> Start Research
            </button>
          </div>
        )}

        {/* Projects Grid */}
        {!loading && !error && projects.length > 0 && (
          <div className="grid gap-4">
            {projects.map((p) => {
              const title = p.spec?.researchTitle || 'Untitled Project';
              const type  = p.spec?.researchType  || 'General Research';
              const date  = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
              return (
                <div
                  key={p.projectId}
                  className="bg-[#111827] border border-white/5 rounded-2xl p-6 hover:border-blue-900/40 transition-all shadow-xl group"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                        <FileText className="w-6 h-6 text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white group-hover:text-blue-300 transition-colors">{title}</h3>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                            <Tag className="w-3 h-3" /> {type}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                            <Calendar className="w-3 h-3" /> {date}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-2 font-mono">ID: {p.projectId}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => openProject(p.projectId)}
                      className="flex items-center gap-2 bg-[#182133] hover:bg-blue-600 text-slate-200 hover:text-white border border-slate-700 hover:border-blue-600 px-5 py-2.5 rounded-xl text-sm font-medium transition-all shrink-0"
                    >
                      View App <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <ApplicationModal
        isOpen={visibleApp !== null}
        onClose={closeAppModal}
        appName={visibleApp ? APPS[visibleApp].name : ''}
        appUrl={visibleApp ? APPS[visibleApp].url : ''}
        isLoading={appLoading}
        error={appError}
      />
    </div>
  );
}

export default MyProjects;
