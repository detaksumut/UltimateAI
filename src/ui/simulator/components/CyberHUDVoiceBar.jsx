import React, { useState, useRef } from 'react';
import { Mic, Send, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import { readUploadedDocument } from '../../../utils/documentReader.js';

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
  const fileInputRef = useRef(null);

  const handleFilesSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const processed = await Promise.all(
      files.map((file) => readUploadedDocument(file))
    );

    setAttachedFiles((prev) => [...prev, ...processed]);
    e.target.value = '';
  };

  const handleRemoveFile = (idToRemove) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== idToRemove));
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!inputText.trim() && attachedFiles.length === 0) return;

    onSubmitText(inputText.trim(), {
      attachedImage: null,
      attachedFiles: attachedFiles
    });

    setInputText('');
    setAttachedFiles([]);
  };

  const isProcessing = avatarState === 'PROCESSING';
  const isSpeaking = avatarState === 'SPEAKING';
  const isVoiceActive = isListening || isSpeaking;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 z-20">
      {/* Voice Bar Container */}
      <div className="relative w-full rounded-2xl bg-[#060b18]/90 border border-cyan-500/40 p-3 shadow-[0_0_35px_rgba(0,242,254,0.15)] overflow-hidden">
        
        {/* Corner Accents */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400"></div>
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400"></div>
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400"></div>
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400"></div>

        <div className="flex items-center gap-3">
          
          {/* Mic Button */}
          <button
            type="button"
            onClick={onMicClick}
            disabled={isProcessing}
            className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
              isListening
                ? 'bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 text-white shadow-[0_0_30px_#10b981] scale-110'
                : isSpeaking
                ? 'bg-gradient-to-tr from-purple-600 via-pink-500 to-cyan-400 text-white shadow-[0_0_30px_#a855f7] animate-pulse'
                : 'bg-gradient-to-tr from-slate-800 via-cyan-950 to-slate-800 text-cyan-300 hover:scale-105 shadow-[0_0_15px_rgba(0,242,254,0.3)]'
            } border-2 border-cyan-400 cursor-pointer`}
            title="Klik untuk berbicara dengan JIN"
          >
            <Mic className="w-5 h-5" />
          </button>

          {/* Input Field */}
          <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? (liveTranscript || 'Mendengarkan...') : 'Ketik pesan untuk JIN...'}
              disabled={isProcessing}
              className="flex-1 bg-slate-900/60 border border-cyan-500/30 rounded-xl py-2.5 px-4 text-sm font-mono text-cyan-100 placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(0,242,254,0.2)] transition-all"
            />

            {/* File Upload */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFilesSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-400 hover:text-cyan-400 transition-colors"
              title="Lampirkan file"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim() && attachedFiles.length === 0}
              className="p-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 border border-cyan-400/40 disabled:opacity-30 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Spectrum Visualizer */}
          {isVoiceActive && (
            <div className="flex-shrink-0 flex items-center gap-0.5 h-6">
              {Array.from({ length: 6 }).map((_, i) => {
                const val = spectrum[i % spectrum.length] || 20;
                const h = Math.max(3, Math.min(20, val * 0.3));
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
        </div>

        {/* Attached Files Chips */}
        {attachedFiles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {attachedFiles.map(file => (
              <div
                key={file.id}
                className="flex items-center gap-1 bg-slate-900/90 border border-cyan-400/40 px-2 py-1 rounded text-[10px] font-mono text-cyan-200"
              >
                {file.isImage ? <ImageIcon className="w-3 h-3 text-cyan-400" /> : file.content ? <FileText className="w-3 h-3 text-emerald-400" /> : <FileText className="w-3 h-3 text-purple-400" />}
                <span className="truncate max-w-[100px]">{file.name}</span>
                {file.content && !file.isImage && <span className="text-emerald-400/60 ml-0.5">✓</span>}
                <button
                  type="button"
                  onClick={() => handleRemoveFile(file.id)}
                  className="text-slate-400 hover:text-red-400 ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
