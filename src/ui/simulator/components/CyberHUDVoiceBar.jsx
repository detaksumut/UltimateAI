import React, { useState, useRef } from 'react';
import { Mic, Send, Sparkles, Paperclip, X, Info } from 'lucide-react';

export default function CyberHUDVoiceBar({
  avatarState,
  isListening,
  onMicClick,
  onSubmitText,
  spectrum = [],
  liveTranscript = ''
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
    <div className="w-full max-w-5xl mx-auto px-2 pb-1 z-20 flex-shrink-0">
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

        {/* 2. Center: Input Field, Status, Waveform, and Feature Tags */}
        <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
          {/* Top Status Header: JIN IS READY */}
          <div className="w-full flex items-center justify-center gap-2">
            <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-cyan-400/60"></div>
            <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-cyan-300 uppercase">
              {isListening ? 'JIN IS LISTENING...' : isSpeaking ? 'JIN IS SPEAKING...' : isProcessing ? 'JIN IS REASONING...' : 'JIN IS READY'}
            </span>
            <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-cyan-400/60"></div>
          </div>

          {/* Form Input + Waveform */}
          <form onSubmit={handleSubmit} className="relative w-full flex items-center">
            {attachedImage && (
              <div className="absolute left-2 flex items-center gap-1 bg-cyan-950/80 border border-cyan-500/50 px-2 py-0.5 rounded-md text-[10px] text-cyan-300 z-10">
                <span className="truncate max-w-[100px]">{attachedImage.name}</span>
                <button type="button" onClick={handleRemoveImage} className="hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? (liveTranscript || 'Mendengarkan suara Anda...') : 'Ask JIN anything...'}
              disabled={isProcessing}
              className={`w-full bg-slate-900/60 border border-cyan-500/30 rounded-xl py-2 ${
                attachedImage ? 'pl-36' : 'pl-3'
              } pr-20 text-xs font-mono text-cyan-100 placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(0,242,254,0.3)] transition-all`}
            />

            {/* Middle Waveform Effect Overlay when active */}
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
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1 text-slate-400 hover:text-cyan-400 transition-colors"
                title="Unggah Gambar"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>

              <button
                type="submit"
                disabled={!inputText.trim() && !attachedImage}
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
              <span>Deep Understanding</span>
            </span>
            <span className="flex items-center gap-1 hover:text-cyan-300 transition-colors">
              <Info className="w-2.5 h-2.5 text-cyan-400" />
              <span>Real-time Processing</span>
            </span>
          </div>
        </div>

        {/* 3. Right: Large Glowing Concentric Neon Microphone Button */}
        <div className="relative w-14 h-14 flex-shrink-0 flex items-center justify-center">
          {/* Concentric Pulsing Radar Rings */}
          <div className="absolute inset-0 rounded-full border border-cyan-400/40 animate-ping opacity-30"></div>
          <div className="absolute -inset-1 rounded-full border border-cyan-500/30"></div>
          <div className="absolute -inset-2 rounded-full border border-purple-500/20 border-dashed"></div>

          <button
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
