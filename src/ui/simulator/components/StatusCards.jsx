import React from 'react';

export default function StatusCards({ avatarState, isSpeaking, spectrum = [] }) {
  const isOnline = true;
  const isVoiceActive = avatarState === 'LISTENING' || avatarState === 'SPEAKING';

  return (
    <>
      {/* Top Left Card: STATUS */}
      <div className="absolute top-16 left-6 z-10 glass-hud-card rounded-2xl p-3.5 w-36 border border-cyan-500/20 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        <div className="text-[10px] font-mono tracking-wider text-slate-400 font-semibold mb-1">STATUS</div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse"></span>
          <span className="text-sm font-bold tracking-wide text-emerald-400 font-mono">ONLINE</span>
        </div>
      </div>

      {/* Mid Left Card: VOICE STATUS */}
      <div className="absolute top-36 left-6 z-10 glass-hud-card rounded-2xl p-3.5 w-36 border border-cyan-500/20 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        <div className="text-[10px] font-mono tracking-wider text-slate-400 font-semibold mb-1.5">VOICE STATUS</div>
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1 h-4">
            {[40, 90, 60, 100, 75, 45, 80].map((h, i) => (
              <span
                key={i}
                className="w-1 bg-cyan-400 rounded-full transition-all duration-150"
                style={{
                  height: isVoiceActive ? `${Math.max(20, (spectrum[i % spectrum.length] || h) * 0.2)}px` : '4px',
                  opacity: isVoiceActive ? 0.9 : 0.4
                }}
              />
            ))}
          </div>
        </div>
        <div className="text-xs font-bold tracking-wider text-emerald-400 font-mono">
          {isVoiceActive ? 'ACTIVE' : 'STANDBY'}
        </div>
      </div>

      {/* Top Right Card: MODE */}
      <div className="absolute top-16 right-6 z-10 glass-hud-card rounded-2xl p-3.5 w-36 border border-cyan-500/20 shadow-[0_4px_20px_rgba(0,0,0,0.5)] text-right">
        <div className="text-[10px] font-mono tracking-wider text-slate-400 font-semibold mb-1">MODE</div>
        <div className="text-sm font-bold tracking-wide text-cyan-400 font-mono">
          {avatarState === 'SPEAKING' ? 'SPEAKING' : avatarState === 'PROCESSING' ? 'PROCESSING' : avatarState === 'LISTENING' ? 'LISTENING' : 'ADAPTIVE'}
        </div>
      </div>

      {/* Mid Right Card: SPECTRUM MONITOR */}
      <div className="absolute top-36 right-6 z-10 glass-hud-card rounded-2xl p-3.5 w-36 border border-cyan-500/20 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-end gap-1 h-6">
          {[30, 60, 100, 80, 50, 90, 40, 70].map((h, i) => (
            <span
              key={i}
              className="w-1 bg-blue-400/80 rounded-full transition-all duration-150"
              style={{
                height: `${Math.max(4, (spectrum[i % spectrum.length] || h) * 0.25)}px`,
                backgroundColor: avatarState === 'PROCESSING' ? '#a855f7' : '#38bdf8'
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
