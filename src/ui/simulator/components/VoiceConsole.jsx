import React, { useState, useRef } from 'react';
import { Mic, Send, Sparkles, Brain, Cpu, Image as ImageIcon, X, Paperclip } from 'lucide-react';

export default function VoiceConsole({
  avatarState,
  isListening,
  onMicClick,
  onSubmitText,
  spectrum = [],
  liveTranscript = '',
  cognitiveIntent = null
}) {
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState(null);
  const fileInputRef = useRef(null);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Hanya file gambar (PNG, JPG, JPEG, WEBP, GIF) yang didukung.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachedImage({
        name: file.name,
        dataUrl: event.target.result,
        size: file.size
      });
    };
    reader.readAsDataURL(file);
    // Reset file input value so same file can be re-selected if needed
    e.target.value = '';
  };

  const handleRemoveImage = () => {
    setAttachedImage(null);
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!inputText.trim() && !attachedImage) return;
    
    onSubmitText(inputText, { attachedImage: attachedImage?.dataUrl });
    setInputText('');
    setAttachedImage(null);
  };

  const isProcessing = avatarState === 'PROCESSING';
  const isSpeaking = avatarState === 'SPEAKING';
  const isVoiceActive = isListening || isSpeaking;

  return (
    <div className="w-full max-w-xl flex flex-col items-center gap-2 z-20 px-4">
      {/* Central Natural Conversational Intelligence HUD */}
      <div className="w-full glass-hud-card rounded-2xl py-3 px-6 border border-cyan-500/30 flex flex-col items-center shadow-[0_0_35px_rgba(0,0,0,0.8)]">
        
        {/* Horizontal Line: Left Waveform + Center Active Presence Indicator + Right Waveform */}
        <div className="w-full flex items-center justify-between gap-4">
          {/* Left Audio Reactive Waveform */}
          <div className="flex-1 flex items-center justify-end gap-1.5 h-6">
            {Array.from({ length: 12 }).map((_, i) => {
              const val = spectrum[i % spectrum.length] || 15;
              const height = isVoiceActive ? Math.max(4, Math.min(24, val * 0.35)) : 3;
              return (
                <span
                  key={i}
                  className="w-1 bg-gradient-to-t from-blue-600 to-cyan-300 rounded-full transition-all duration-100"
                  style={{
                    height: `${height}px`,
                    opacity: isVoiceActive ? 0.95 : 0.25
                  }}
                />
              );
            })}
          </div>

          {/* Center Presence Toggle Button */}
          <button
            onClick={onMicClick}
            disabled={isProcessing}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
              isListening
                ? 'bg-gradient-to-tr from-emerald-600 to-cyan-400 text-white shadow-[0_0_25px_rgba(16,185,129,0.9)] scale-110'
                : isSpeaking
                ? 'bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-[0_0_25px_rgba(0,229,255,0.9)] animate-pulse'
                : 'bg-slate-900/90 text-cyan-300 hover:bg-slate-800 shadow-[0_0_15px_rgba(0,229,255,0.4)]'
            } border-2 border-cyan-400/60 flex-shrink-0`}
            title={isListening ? 'JIN sedang menyimak...' : 'Mulai Percakapan Alami dengan JIN'}
          >
            {isListening ? (
              <Mic className="w-5 h-5 text-white animate-pulse" />
            ) : isSpeaking ? (
              <Sparkles className="w-5 h-5 text-cyan-200 animate-spin" />
            ) : (
              <Mic className="w-5 h-5 text-cyan-300" />
            )}
          </button>

          {/* Right Audio Reactive Waveform */}
          <div className="flex-1 flex items-center justify-start gap-1.5 h-6">
            {Array.from({ length: 12 }).map((_, i) => {
              const val = spectrum[(i + 4) % spectrum.length] || 15;
              const height = isVoiceActive ? Math.max(4, Math.min(24, val * 0.35)) : 3;
              return (
                <span
                  key={i}
                  className="w-1 bg-gradient-to-t from-blue-600 to-cyan-300 rounded-full transition-all duration-100"
                  style={{
                    height: `${height}px`,
                    opacity: isVoiceActive ? 0.95 : 0.25
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Presence & Cognitive Status */}
        <div className="text-center mt-2">
          <div className="text-xs font-mono font-bold tracking-[0.25em] text-cyan-300 uppercase flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00e5ff] animate-ping"></span>
            <span>JIN IS WITH YOU</span>
          </div>
          <div className="text-[10px] text-slate-300 font-mono mt-0.5 font-semibold">
            {isListening
              ? 'Listening naturally • Understanding • Ready to act'
              : isSpeaking
              ? 'JIN sedang menjawab & menjelaskan...'
              : isProcessing
              ? '9Router sedang menganalisa dan merancang eksekusi...'
              : 'Listening naturally • Understanding • Ready to act'}
          </div>
          <div className="text-[8px] text-cyan-400/80 font-mono mt-0.5">
            "Silakan berbicara secara alami atau lampirkan gambar, JIN menyimak dan mengambil keputusan langsung"
          </div>
        </div>

        {/* Live Conversation Stream Box (If transcript / thoughts active) */}
        {(liveTranscript || isListening || isProcessing) && (
          <div className="w-full mt-2 pt-2 border-t border-cyan-500/20 flex flex-col gap-1 text-[10px] font-mono">
            {liveTranscript && (
              <div className="bg-slate-950/80 rounded-lg px-2.5 py-1.5 text-slate-200 border border-slate-800 flex items-center gap-2 select-text cursor-text selection:bg-cyan-500/40 selection:text-white">
                <span className="text-cyan-400 font-bold select-none">YOU:</span>
                <span className="select-text">{liveTranscript}</span>
              </div>
            )}
            <div className="flex items-center justify-between px-1 text-[8px] text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <Brain className="w-3 h-3 text-emerald-400" />
                <span>JIN • AUTONOMOUS ACTION PLANNER</span>
              </span>
              <span className="flex items-center gap-1 text-cyan-300">
                <Cpu className="w-3 h-3 text-cyan-400" />
                <span>9ROUTER BRAIN ACTIVE</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Image Preview Floating Badge if attached */}
      {attachedImage && (
        <div className="w-full flex items-center justify-between bg-slate-900/90 border border-cyan-500/40 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-mono shadow-[0_0_15px_rgba(0,229,255,0.2)]">
          <div className="flex items-center gap-2 overflow-hidden">
            <img 
              src={attachedImage.dataUrl} 
              alt="Preview" 
              className="w-7 h-7 object-cover rounded-lg border border-cyan-400/50 flex-shrink-0"
            />
            <span className="truncate text-[11px] text-cyan-300">{attachedImage.name}</span>
            <span className="text-[9px] text-slate-400 font-mono">({Math.round(attachedImage.size / 1024)} KB)</span>
          </div>
          <button
            type="button"
            onClick={handleRemoveImage}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-all flex-shrink-0"
            title="Hapus gambar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Hidden File Input for Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageSelect}
        accept="image/png, image/jpeg, image/jpg, image/webp, image/gif"
        className="hidden"
      />

      {/* Minimalist Quick Text & Image Input Bar */}
      <form onSubmit={handleSubmit} className="w-full flex items-center gap-2">
        {/* Attach Image Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className={`p-2 rounded-xl border transition-all flex items-center justify-center flex-shrink-0 ${
            attachedImage
              ? 'bg-cyan-900/60 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(0,229,255,0.4)]'
              : 'bg-slate-950/60 border-cyan-500/20 hover:border-cyan-500/50 text-slate-400 hover:text-cyan-300'
          } disabled:opacity-40`}
          title="Lampirkan Gambar (Screenshot/Foto)"
        >
          <ImageIcon className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={attachedImage ? "Tulis instruksi/pertanyaan tentang gambar ini..." : "Opsi ketik cepat percakapan alami..."}
          disabled={isProcessing}
          className="flex-1 bg-slate-950/60 border border-cyan-500/20 hover:border-cyan-500/40 rounded-xl px-3.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-all font-mono shadow-inner"
        />
        <button
          type="submit"
          disabled={isProcessing || (!inputText.trim() && !attachedImage)}
          className="px-3.5 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(0,229,255,0.2)]"
        >
          <Send className="w-3 h-3" />
          <span>Kirim</span>
        </button>
      </form>
    </div>
  );
}
