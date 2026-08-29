import React, { useState, useRef } from 'react';
import { Mic, Send, Sparkles, Paperclip, X, Info, FileText, Image as ImageIcon, File } from 'lucide-react';
import { ContentExtractor } from '../../../services/analysis/ContentExtractor.js';

export default function CyberHUDVoiceBar({
  avatarState,
  isListening,
  onMicClick,
  onSubmitText,
  spectrum = [],
  liveTranscript = ''
}) {
  const [inputText, setInputText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const fileInputRef = useRef(null);

  const handleFilesSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setIsProcessingFiles(true);
    try {
      const processed = await Promise.all(
        files.map(async (file) => {
          try {
            const extracted = await ContentExtractor.extractFromFile(file);
            return {
              id: `${file.name}-${Date.now()}-${Math.random()}`,
              name: file.name,
              size: file.size,
              type: file.type || 'document',
              isImage: file.type.startsWith('image/'),
              dataUrl: extracted.dataUrl || extracted.preview || null,
              content: extracted.content || extracted.text || '',
              preview: extracted.preview || ''
            };
          } catch (err) {
            console.warn('Extraction fallback for', file.name, err);
            return {
              id: `${file.name}-${Date.now()}`,
              name: file.name,
              size: file.size,
              type: file.type || 'document',
              isImage: file.type.startsWith('image/'),
              content: '',
              dataUrl: null
            };
          }
        })
      );

      setAttachedFiles(prev => [...prev, ...processed]);
    } catch (err) {
      console.error('Failed to process files:', err);
    } finally {
      setIsProcessingFiles(false);
      e.target.value = '';
    }
  };

  const handleRemoveFile = (idToRemove) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== idToRemove));
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!inputText.trim() && attachedFiles.length === 0) return;

    // Collect images and document text
    const attachedImages = attachedFiles.filter(f => f.isImage && f.dataUrl).map(f => f.dataUrl);
    const documents = attachedFiles.filter(f => !f.isImage);

    let fullPrompt = inputText.trim();

    if (documents.length > 0) {
      const docSummaries = documents.map((doc, idx) => {
        return `=== DOKUMEN ${idx + 1}: "${doc.name}" (${(doc.size / 1024).toFixed(1)} KB) ===\n${doc.content || doc.preview || '(Konten dokumen terlampir)'}\n=== AKHIR DOKUMEN ${idx + 1} ===`;
      }).join('\n\n');

      if (!fullPrompt) {
        fullPrompt = `Tolong analisis ${documents.length} berkas dokumen berikut secara mendalam:\n\n${docSummaries}\n\nBerikan ringkasan eksekutif, data temuan, dan rekomendasi tindak lanjut.`;
      } else {
        fullPrompt = `${fullPrompt}\n\nLampiran Dokumen:\n${docSummaries}`;
      }
    }

    onSubmitText(fullPrompt, {
      attachedImage: attachedImages[0] || null,
      attachedImages: attachedImages,
      attachedFiles: attachedFiles
    });

    setInputText('');
    setAttachedFiles([]);
  };

  const isProcessing = avatarState === 'PROCESSING' || isProcessingFiles;
  const isSpeaking = avatarState === 'SPEAKING';
  const isVoiceActive = isListening || isSpeaking;

  return (
    <div className="w-full max-w-4xl mx-auto px-2 pb-1 z-20 flex-shrink-0">
      {/* Cyber-HUD Angled Enclosure Frame */}
      <div className="relative w-full rounded-2xl bg-[#060b18]/90 border border-cyan-500/40 p-3 backdrop-blur-xl shadow-[0_0_35px_rgba(0,242,254,0.18)] flex items-center justify-between gap-3 overflow-hidden">
        {/* Futuristic Angled Corner Cutouts */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400"></div>
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400"></div>
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400"></div>
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400"></div>

        {/* 1. Left: Cyber Holographic Radar / Glowing Orb */}
        <div className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-cyan-500/40 animate-spin" style={{ animationDuration: '8s' }}></div>
          <div className="absolute inset-1.5 rounded-full border border-blue-500/40 border-dashed animate-spin" style={{ animationDuration: '12s', animationDirection: 'reverse' }}></div>
          <div className="w-6 h-6 rounded-full bg-cyan-400/80 shadow-[0_0_15px_#00f2fe] flex items-center justify-center animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white"></span>
          </div>
        </div>

        {/* 2. Center: Input Field, Status, Multi-File Chips & Badges */}
        <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
          {/* Top Status Header: JIN IS READY */}
          <div className="w-full flex items-center justify-center gap-2">
            <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-cyan-400/60"></div>
            <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-cyan-300 uppercase">
              {isProcessingFiles ? 'MEMPROSES BERKAS...' : isListening ? 'JIN IS LISTENING...' : isSpeaking ? 'JIN IS SPEAKING...' : isProcessing ? 'JIN IS REASONING...' : 'JIN IS READY'}
            </span>
            <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-cyan-400/60"></div>
          </div>

          {/* Multi-File Attachment Chips List */}
          {attachedFiles.length > 0 && (
            <div className="w-full flex flex-wrap gap-1.5 max-h-16 overflow-y-auto custom-scrollbar p-1 rounded-lg bg-cyan-950/40 border border-cyan-500/30">
              {attachedFiles.map(file => (
                <div
                  key={file.id}
                  className="flex items-center gap-1 bg-slate-900/90 border border-cyan-400/40 px-2 py-0.5 rounded text-[9.5px] font-mono text-cyan-200 shadow-sm"
                >
                  {file.isImage ? <ImageIcon className="w-3 h-3 text-cyan-400" /> : <FileText className="w-3 h-3 text-purple-400" />}
                  <span className="truncate max-w-[120px]">{file.name}</span>
                  <span className="text-[8px] text-slate-400">({(file.size / 1024).toFixed(0)}k)</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(file.id)}
                    className="hover:text-red-400 p-0.5 ml-0.5 text-slate-400"
                    title="Hapus berkas ini"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="relative w-full flex items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? (liveTranscript || 'Mendengarkan suara Anda...') : attachedFiles.length > 0 ? `${attachedFiles.length} berkas terlampir. Ketik instruksi atau klik kirim...` : 'Ask JIN anything... (Teks, Dokumen, Gambar)'}
              disabled={isProcessing}
              className="w-full bg-slate-900/60 border border-cyan-500/30 rounded-xl py-2 pl-3 pr-20 text-xs font-mono text-cyan-100 placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(0,242,254,0.3)] transition-all"
            />

            {/* Waveform when active */}
            {isVoiceActive && (
              <div className="absolute right-24 flex items-center gap-0.5 pointer-events-none h-4">
                {Array.from({ length: 8 }).map((_, i) => {
                  const val = spectrum[i % spectrum.length] || 20;
                  const h = Math.max(3, Math.min(16, val * 0.25));
                  return (
                    <span
                      key={i}
                      className="w-0.5 bg-cyan-400 rounded-full transition-all duration-75"
                      style={{ height: `${h}px` }}
                    />
                  );
                })}
              </div>
            )}

            {/* Input Action Buttons */}
            <div className="absolute right-2 flex items-center gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt,.csv,.xlsx,.json,.md,image/*"
                onChange={handleFilesSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1 text-slate-400 hover:text-cyan-400 transition-colors"
                title="Unggah Dokumen atau Gambar (Bisa Banyak Berkas Sekaligus)"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>

              <button
                type="submit"
                disabled={!inputText.trim() && attachedFiles.length === 0}
                className="p-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 border border-cyan-400/40 disabled:opacity-30 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* Bottom Feature Badges */}
          <div className="w-full flex items-center justify-center gap-4 text-[9px] font-mono text-slate-400">
            <span className="flex items-center gap-1 hover:text-cyan-300 transition-colors">
              <Info className="w-2.5 h-2.5 text-cyan-400" />
              <span>Smart Context</span>
            </span>
            <span className="flex items-center gap-1 hover:text-cyan-300 transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              <span>Multi-File Docs &amp; Image Support</span>
            </span>
            <span className="flex items-center gap-1 hover:text-cyan-300 transition-colors">
              <Info className="w-2.5 h-2.5 text-cyan-400" />
              <span>Real-Time Processing</span>
            </span>
          </div>
        </div>

        {/* 3. Right: Large Glowing Concentric Neon Microphone Button */}
        <div className="relative w-14 h-14 flex-shrink-0 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-cyan-400/40 animate-ping opacity-30"></div>
          <div className="absolute -inset-1 rounded-full border border-cyan-500/30"></div>
          <div className="absolute -inset-2 rounded-full border border-purple-500/20 border-dashed"></div>

          <button
            type="button"
            onClick={onMicClick}
            disabled={isProcessing}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
              isListening
                ? 'bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 text-white shadow-[0_0_30px_#10b981] scale-105'
                : isSpeaking
                ? 'bg-gradient-to-tr from-purple-600 via-pink-500 to-cyan-400 text-white shadow-[0_0_30px_#00f2fe] animate-pulse'
                : 'bg-gradient-to-tr from-slate-900 via-cyan-950 to-blue-900 text-cyan-300 hover:scale-105 shadow-[0_0_20px_rgba(0,242,254,0.4)]'
            } border-2 border-cyan-400 z-10 cursor-pointer`}
            title="Klik untuk berbicara dengan JIN"
          >
            {isListening ? (
              <Mic className="w-5 h-5 text-white animate-pulse" />
            ) : isSpeaking ? (
              <Sparkles className="w-5 h-5 text-cyan-100 animate-spin" />
            ) : (
              <Mic className="w-5 h-5 text-cyan-300" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
