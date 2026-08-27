import React, { useState } from 'react';
import { Mic, Send, MicOff } from 'lucide-react';

export default function VoiceConsole({
  avatarState,
  isListening,
  onMicClick,
  onSubmitText,
  spectrum = []
}) {
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    onSubmitText(inputText);
    setInputText('');
  };

  const isProcessing = avatarState === 'PROCESSING';
  const isSpeaking = avatarState === 'SPEAKING';
  const isVoiceActive = isListening || isSpeaking;

  return (
    <div className="w-full max-w-xl flex flex-col items-center gap-2.5 z-20 px-4">
      {/* Waveform Console Bar (Flanked Audio Waves + Center Mic Button) */}
      <div className="w-full glass-hud-card rounded-2xl py-2.5 px-6 border border-cyan-500/25 flex flex-col items-center shadow-[0_0_30px_rgba(0,0,0,0.7)]">
        {/* Horizontal Line: Left Waveform + Center Mic + Right Waveform */}
        <div className="w-full flex items-center justify-between gap-4">
          {/* Left Waveform Bars */}
          <div className="flex-1 flex items-center justify-end gap-1.5 h-7">
            {Array.from({ length: 14 }).map((_, i) => {
              const val = spectrum[i % spectrum.length] || 15;
              const height = isVoiceActive ? Math.max(5, Math.min(26, val * 0.35)) : 3;
              return (
                <span
                  key={i}
                  className="w-1 bg-gradient-to-t from-blue-600 to-cyan-300 rounded-full transition-all duration-100"
                  style={{
                    height: `${height}px`,
                    opacity: isVoiceActive ? 0.95 : 0.3
                  }}
                />
              );
            })}
          </div>

          {/* Center Mic Button */}
          <button
            onClick={onMicClick}
            disabled={isProcessing}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${
              isListening
                ? 'bg-red-500 text-white shadow-[0_0_25px_rgba(239,68,68,0.9)] scale-110'
                : isSpeaking
                ? 'bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-[0_0_22px_rgba(0,229,255,0.8)]'
                : 'bg-gradient-to-tr from-blue-700 to-cyan-600 text-white hover:shadow-[0_0_25px_rgba(0,229,255,0.7)]'
            } border border-cyan-300/50 flex-shrink-0`}
            title={isListening ? 'Stop Listening' : 'Talk to JIN'}
          >
            {isListening ? <MicOff className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5 text-cyan-100" />}
          </button>

          {/* Right Waveform Bars */}
          <div className="flex-1 flex items-center justify-start gap-1.5 h-7">
            {Array.from({ length: 14 }).map((_, i) => {
              const val = spectrum[(i + 4) % spectrum.length] || 15;
              const height = isVoiceActive ? Math.max(5, Math.min(26, val * 0.35)) : 3;
              return (
                <span
                  key={i}
                  className="w-1 bg-gradient-to-t from-blue-600 to-cyan-300 rounded-full transition-all duration-100"
                  style={{
                    height: `${height}px`,
                    opacity: isVoiceActive ? 0.95 : 0.3
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Status Prompt Text */}
        <div className="text-center mt-1.5">
          <div className="text-[11px] font-mono font-bold tracking-[0.2em] text-cyan-300 uppercase">
            {isListening
              ? 'JIN IS LISTENING...'
              : isProcessing
              ? '9ROUTER IS REASONING...'
              : isSpeaking
              ? 'JIN IS SPEAKING...'
              : 'JIN IS LISTENING...'}
          </div>
          <div className="text-[9px] text-slate-400 font-mono mt-0.5">
            {isListening ? 'Mendengarkan suara Anda...' : 'Speak now or type your command'}
          </div>
        </div>
      </div>

      {/* Command Input Bar */}
      <form onSubmit={handleSubmit} className="w-full flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ketik perintah untuk UltimateAI 9Router..."
          disabled={isProcessing}
          className="flex-1 bg-slate-950/80 border border-cyan-500/30 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-mono"
        />
        <button
          type="submit"
          disabled={isProcessing || !inputText.trim()}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-cyan-400/40 shadow-[0_0_15px_rgba(0,229,255,0.35)]"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Kirim</span>
        </button>
      </form>
    </div>
  );
}
