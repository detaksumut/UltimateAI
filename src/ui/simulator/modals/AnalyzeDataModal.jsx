import React, { useState, useRef } from 'react';
import { X, UploadCloud, FileText, CheckCircle, AlertCircle, Trash2, ArrowRight } from 'lucide-react';
import { ContentExtractor } from '../../../services/analysis/ContentExtractor.js';
import { documentContextManagerInstance } from '../../../services/analysis/DocumentContextManager.js';

export default function AnalyzeDataModal({ isOpen, onClose, onAnalyzeDocument }) {
  const [dragActive, setDragActive] = useState(false);
  const [extractedDocs, setExtractedDocs] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setErrorMsg('');
    setIsExtracting(true);

    try {
      const file = files[0];
      const extracted = await ContentExtractor.extractFromFile(file);
      
      // Save to document context manager
      const saved = documentContextManagerInstance.addDocument(extracted);
      setExtractedDocs(prev => [saved, ...prev]);
      setSelectedDoc(saved);
    } catch (err) {
      setErrorMsg(err.message || 'Gagal memproses file.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleAnalyzeClick = () => {
    if (!selectedDoc) return;
    onClose();
    if (onAnalyzeDocument) {
      onAnalyzeDocument(selectedDoc);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-[#0a101f] border border-cyan-500/30 rounded-3xl p-6 shadow-[0_0_50px_rgba(0,229,255,0.2)] text-slate-200 select-none flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-mono tracking-wide">
                ANALYZE DATA PIPELINE
              </h3>
              <p className="text-xs text-slate-400">
                Ekstraksi dokumen & integrasi konteks langsung ke UltimateAI 9Router
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:border-cyan-400 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-4 space-y-4">
          {/* File Dropzone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${
              dragActive
                ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
                : 'border-slate-700 bg-slate-900/50 hover:border-cyan-500/50 hover:bg-slate-900/80'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => handleFiles(e.target.files)}
              accept=".pdf,.csv,.json,.txt,.md,.js,.ts,.py,.png,.jpg,.jpeg"
              className="hidden"
            />
            <UploadCloud className="w-10 h-10 text-cyan-400 mb-2 animate-bounce" />
            <p className="text-sm font-semibold text-white">
              Tarik & Letakkan Dokumen atau Klik untuk Unggah
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Mendukung CSV, JSON, TXT, Markdown, Gambar, dan Dokumen Riset (Maks 5 MB)
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-500/15 border border-red-500/40 rounded-xl p-3 flex items-center gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Selected Document Extraction Viewer */}
          {selectedDoc && (
            <div className="bg-slate-900/80 border border-cyan-500/30 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">{selectedDoc.fileName}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                    {selectedDoc.type}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {(selectedDoc.size / 1024).toFixed(1)} KB
                </span>
              </div>

              {/* Extraction Preview Box */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-slate-300 max-h-36 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                {selectedDoc.preview}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <div className="text-xs text-slate-400 font-mono">
            {documentContextManagerInstance.getDocuments().length} Dokumen Aktif di Konteks 9Router
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
            >
              Batal
            </button>
            <button
              onClick={handleAnalyzeClick}
              disabled={!selectedDoc || isExtracting}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-40 shadow-[0_0_20px_rgba(0,229,255,0.4)]"
            >
              <span>Instruksikan JIN Analisis</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
