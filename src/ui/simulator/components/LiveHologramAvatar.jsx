import React, { useRef, useEffect } from 'react';

export default function LiveHologramAvatar({ avatarState, audioMetrics }) {
  const canvasRef = useRef(null);
  const { mouthGlow = 0, volume = 0.1, orbitSpeed = 1.0 } = audioMetrics || {};

  const isSpeaking = avatarState === 'SPEAKING';
  const isProcessing = avatarState === 'PROCESSING';
  const isListening = avatarState === 'LISTENING';

  // Live Particle System (Cyber Dust / Hologram Energy Field)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const width = (canvas.width = 400);
    const height = (canvas.height = 400);

    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.6 + 0.8,
      speedY: -(Math.random() * 0.7 + 0.3),
      speedX: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.6 + 0.2,
      pulse: Math.random() * Math.PI
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const speedMult = isSpeaking ? 1.8 : isProcessing ? 2.4 : isListening ? 1.4 : 1.0;

      particles.forEach((p) => {
        p.y += p.speedY * speedMult;
        p.x += p.speedX * speedMult;
        p.pulse += 0.04 * speedMult;

        if (p.y < 0) {
          p.y = height;
          p.x = Math.random() * width;
        }
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;

        const currentOpacity = p.opacity + Math.sin(p.pulse) * 0.25;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = isProcessing
          ? `rgba(192, 132, 252, ${Math.max(0.1, Math.min(1, currentOpacity))})`
          : `rgba(0, 229, 255, ${Math.max(0.1, Math.min(1, currentOpacity))})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = isProcessing ? '#c084fc' : '#00e5ff';
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [avatarState, isSpeaking, isProcessing, isListening]);

  return (
    <div className="relative w-80 h-80 md:w-96 md:h-96 flex items-center justify-center select-none">
      {/* Background Holographic Live Particle Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      />

      {/* SVG Holographic Precision Orbit Rings */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        viewBox="0 0 400 400"
      >
        {/* Outer Orbit */}
        <g
          className="orbit-ring-outer origin-center"
          style={{ animationDuration: `${Math.max(4, 18 / orbitSpeed)}s` }}
        >
          <circle
            cx="200"
            cy="200"
            r="182"
            fill="none"
            stroke="#00e5ff"
            strokeWidth="1.2"
            strokeDasharray="8 12"
            strokeOpacity="0.35"
          />
          <circle
            cx="200"
            cy="200"
            r="168"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="0.8"
            strokeDasharray="40 80"
            strokeOpacity="0.4"
          />
        </g>

        {/* Inner Counter-Rotating Orbit */}
        <g
          className="orbit-ring-inner origin-center"
          style={{ animationDuration: `${Math.max(3, 13 / orbitSpeed)}s` }}
        >
          <circle
            cx="200"
            cy="200"
            r="140"
            fill="none"
            stroke="#60a5fa"
            strokeWidth="1"
            strokeDasharray="4 8"
            strokeOpacity="0.4"
          />
          <circle
            cx="200"
            cy="200"
            r="120"
            fill="none"
            stroke="#00e5ff"
            strokeWidth="1.5"
            strokeDasharray="20 40"
            strokeOpacity="0.5"
          />
        </g>
      </svg>

      {/* Dynamic Ambient Energy Aura Glow */}
      <div
        className="absolute inset-4 rounded-full transition-all duration-300 blur-3xl pointer-events-none z-0"
        style={{
          background: isProcessing
            ? 'radial-gradient(circle, rgba(168, 85, 247, 0.55) 0%, rgba(0,0,0,0) 70%)'
            : isSpeaking
            ? `radial-gradient(circle, rgba(0, 229, 255, ${0.5 + mouthGlow * 0.5}) 0%, rgba(0,0,0,0) 72%)`
            : 'radial-gradient(circle, rgba(0, 229, 255, 0.4) 0%, rgba(0,0,0,0) 70%)',
          transform: `scale(${1 + volume * 0.25})`
        }}
      />

      {/* Pure Transparent Neon JIN Line-Art Avatar (NO BOX / NO CHECKERBOARD) */}
      <div className="relative z-10 w-72 h-72 md:w-84 md:h-84 flex items-center justify-center hologram-avatar-container">
        <img
          src="/genie-bg.png"
          alt="Live JIN Hologram"
          className="w-full h-full object-contain select-none pointer-events-none transition-all duration-150"
          style={{
            filter: isSpeaking
              ? `drop-shadow(0 0 ${18 + mouthGlow * 28}px rgba(0, 229, 255, 0.95)) drop-shadow(0 0 35px rgba(168, 85, 247, 0.7)) brightness(${1.05 + mouthGlow * 0.35})`
              : isProcessing
              ? 'drop-shadow(0 0 30px rgba(168, 85, 247, 0.95)) hue-rotate(45deg)'
              : isListening
              ? 'drop-shadow(0 0 25px rgba(0, 229, 255, 0.9)) brightness(1.15)'
              : 'drop-shadow(0 0 16px rgba(0, 229, 255, 0.7)) drop-shadow(0 0 25px rgba(168, 85, 247, 0.5))'
          }}
        />

        {/* Live Speaking Frequency Glow on Beard / Mouth area */}
        {isSpeaking && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-75"
            style={{ opacity: Math.max(0.2, mouthGlow) }}
          >
            <div className="w-24 h-16 rounded-full bg-cyan-300/40 blur-md translate-y-10 shadow-[0_0_25px_#00e5ff]"></div>
          </div>
        )}

        {/* Live Listening Audio Focus Beacon */}
        {isListening && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 rounded-full border border-cyan-400/40 animate-ping opacity-40"></div>
          </div>
        )}
      </div>

      {/* Concentric Glowing Hologram Ripple Base Pedestal */}
      <div className="absolute -bottom-8 w-96 h-28 flex items-center justify-center pointer-events-none z-0">
        <div className="absolute w-84 h-20 rounded-[100%] border border-cyan-400/50 bg-cyan-500/15 shadow-[0_0_35px_rgba(0,229,255,0.6)] ripple-circle-1"></div>
        <div className="absolute w-64 h-14 rounded-[100%] border border-blue-400/50 ripple-circle-2"></div>
        <div className="absolute w-44 h-10 rounded-[100%] border border-cyan-300/60 ripple-circle-3"></div>
        <div className="absolute w-28 h-5 rounded-[100%] bg-cyan-400/90 blur-md shadow-[0_0_30px_#00e5ff]"></div>
      </div>
    </div>
  );
}
