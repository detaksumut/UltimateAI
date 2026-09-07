import React, { useRef, useEffect, useState } from 'react';
import LiveMouthViseme from './LiveMouthViseme.jsx';
import LiveFaceMimic from './LiveFaceMimic.jsx';

export default function LiveHologramAvatar({ avatarState, audioMetrics, size = 'default', className = '', modalOpen = false }) {
  const canvasRef = useRef(null);
  const {
    mouthGlow = 0,
    volume = 0.1,
    orbitSpeed = 1.0,
    aperture = 0,
    spread = 1.0,
    jawOffset = 0,
    blinkProgress = 0,
    eyebrowRaise = 0,
    eyeSquint = 0
  } = audioMetrics || {};

  const isSpeaking = avatarState === 'SPEAKING';
  const isProcessing = avatarState === 'PROCESSING';
  const isListening = avatarState === 'LISTENING';
  const isPanelSize = size === 'panel';
  const isCenterSize = size === 'center';

  // Genie-Into-Lamp FSM: every time a popup mounts, JIN spirals down into the pedestal
  // ("lamp") below; when the popup closes, JIN re-emerges in a bright swirl.
  const [lampPhase, setLampPhase] = useState('IDLE');
  const prevModalOpen = useRef(modalOpen);

  useEffect(() => {
    if (prevModalOpen.current === modalOpen) return;
    prevModalOpen.current = modalOpen;
    let enterTimer;
    let exitTimer;

    if (modalOpen) {
      // Suck JIN into the lamp hole
      setLampPhase('ENTER');
      enterTimer = setTimeout(() => setLampPhase('INSIDE'), 900);
    } else {
      // Unleash JIN back out of the lamp
      setLampPhase('EMERGE');
      exitTimer = setTimeout(() => setLampPhase('IDLE'), 1200);
    }

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
    };
  }, [modalOpen]);

  const lampClass =
    lampPhase === 'ENTER'
      ? 'jin-lamp-enter'
      : lampPhase === 'EMERGE'
      ? 'jin-lamp-emerge'
      : lampPhase === 'INSIDE'
      ? 'jin-lamp-inside'
      : '';

  // Live Particle System (Cyber Dust / Hologram Energy Field)
  // Saat lampPhase != IDLE, dust berubah jadi asap: ditarik masuk (ENTER/INSIDE)
  // atau mengepul keluar (EMERGE) dari lubang lampu, mengikuti JIN.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let last = performance.now();

    const width = (canvas.width = 400);
    const height = (canvas.height = 400);
    const holeX = width / 2;
    const holeY = height + 30;

    const seedAmbient = () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.6 + 0.8,
      speedY: -(Math.random() * 0.7 + 0.3),
      speedX: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.6 + 0.2,
      pulse: Math.random() * Math.PI,
      smokeT: 0,
      smokeSeed: Math.random() * Math.PI
    });

    const particles = Array.from({ length: 36 }, seedAmbient);

    let lastRenderTime = 0;
    const frameInterval = 1000 / 30; // 30 FPS throttle

    const render = (now) => {
      animationFrameId = requestAnimationFrame(render);
      if (document.hidden) return;

      const elapsed = now - lastRenderTime;
      if (elapsed < frameInterval) return;
      lastRenderTime = now - (elapsed % frameInterval);

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, width, height);

      const speedMult = isSpeaking ? 1.8 : isProcessing ? 2.4 : isListening ? 1.4 : 1.0;

      if (lampPhase === 'ENTER' || lampPhase === 'INSIDE') {
        // SMOKE INHALED — dust ditarik spiral masuk ke lubang lampu
        particles.forEach((p, i) => {
          const dx = holeX - p.x;
          const dy = holeY - p.y;
          const dist = Math.hypot(dx, dy) || 1;
          const pull = (230 + 90 * Math.sin(now / 180 + i)) * speedMult * dt;
          const ux = dx / dist;
          const uy = dy / dist;
          p.x += ux * pull - uy * pull * 0.9;
          p.y += uy * pull + ux * pull * 0.9;
          p.pulse += 0.05 * speedMult;

          // respawn jauh saat tersedot habis ke lubang (asap terus mengalir)
          if (dist < 12) {
            p.x = 20 + Math.random() * (width - 40);
            p.y = 24 + Math.random() * (height - 80);
            p.opacity = Math.random() * 0.5 + 0.2;
            p.radius = Math.random() * 2 + 1;
          }

          const near = 1 - Math.min(1, dist / 280);
          const r = p.radius * (1 + near * 1.8);
          const a = Math.max(0, (p.opacity + Math.sin(p.pulse) * 0.2) * (0.35 + near * 0.75) * (1 - near * 0.35));
          const mix = near > 0.45 ? 1 : near / 0.45;
          const rr = Math.round(0 + mix * 192);
          const gg = Math.round(229 - mix * 97);
          const bb = Math.round(255 - mix * 3);
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.001, r), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rr}, ${gg}, ${bb}, ${Math.max(0, Math.min(1, a))})`;
          ctx.fill();
        });
      } else if (lampPhase === 'EMERGE') {
        // SMOKE BILLOWING — asap mengepul keluar dari lubang, membesar lalu memudar
        particles.forEach((p) => {
          p.smokeT += dt * (34 + p.smokeSeed * 14) * speedMult;
          const t = p.smokeT;
          if (t > 1) {
            p.smokeT = 0;
            p.smokeSeed = Math.random() * Math.PI;
            p.opacity = Math.random() * 0.5 + 0.3;
          }
          p.x = holeX + Math.sin(t * 3.2 + p.smokeSeed) * (6 + t * 78);
          p.y = holeY - t * (90 * speedMult) - Math.cos(t * 2.1 + p.smokeSeed) * (4 + t * 30);
          const r = 1.2 + t * 9 + p.smokeSeed;
          const a = Math.max(0, Math.min(1, Math.sin(t * Math.PI) * p.opacity * 1.1));
          const mix = t;
          const rr = Math.round(150 + mix * 80);
          const gg = Math.round(205 + mix * 10);
          const bb = Math.round(255);
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.001, r), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rr}, ${gg}, ${bb}, ${a})`;
          ctx.fill();
        });
      } else {
        // IDLE — ambient cyber dust mengambang naik
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
          ctx.arc(p.x, p.y, Math.max(0.001, p.radius), 0, Math.PI * 2);
          ctx.fillStyle = isProcessing
            ? `rgba(192, 132, 252, ${Math.max(0.1, Math.min(1, currentOpacity))})`
            : `rgba(0, 229, 255, ${Math.max(0.1, Math.min(1, currentOpacity))})`;
          ctx.fill();
        });
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [avatarState, isSpeaking, isProcessing, isListening, lampPhase]);

  const containerSize = isCenterSize
    ? 'w-[420px] h-[420px] min-[1500px]:w-[480px] min-[1500px]:h-[480px]'
    : isPanelSize
    ? 'w-60 h-60 sm:w-68 sm:h-68'
    : 'w-80 h-80 md:w-96 md:h-96';

  const avatarImgSize = isCenterSize
    ? 'w-[380px] h-[380px] min-[1500px]:w-[440px] min-[1500px]:h-[440px]'
    : isPanelSize
    ? 'w-52 h-52 sm:w-60 sm:h-60'
    : 'w-72 h-72 md:w-84 md:h-84';

  const pedestalSize = isCenterSize
    ? 'w-[480px] h-32 -bottom-8'
    : isPanelSize
    ? 'w-72 h-20 -bottom-4'
    : 'w-96 h-28 -bottom-8';

  // Floating hex data codes around the avatar
  const hexCodes = ['0x4A494E', 'NEURAL', '0xFF00E5', 'SYNC', '0x00FFFF', 'ACTIVE', '0xDEAD', 'LINK', '0xBEEF', 'PULSE'];

  return (
    <div className={`relative ${containerSize} flex items-center justify-center select-none ${className}`}>
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
          <circle cx="200" cy="200" r="188" fill="none" stroke="#00e5ff" strokeWidth="0.5" strokeDasharray="2 6" strokeOpacity="0.2" />
          <circle cx="200" cy="200" r="182" fill="none" stroke="#00e5ff" strokeWidth="1.2" strokeDasharray="8 12" strokeOpacity="0.35" />
          <circle cx="200" cy="200" r="168" fill="none" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="40 80" strokeOpacity="0.4" />
          {/* Data point markers on outer orbit */}
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <circle key={deg} cx={200 + 182 * Math.cos(deg * Math.PI / 180)} cy={200 + 182 * Math.sin(deg * Math.PI / 180)} r="2" fill="#00e5ff" fillOpacity="0.6" />
          ))}
        </g>

        {/* Inner Counter-Rotating Orbit */}
        <g
          className="orbit-ring-inner origin-center"
          style={{ animationDuration: `${Math.max(3, 13 / orbitSpeed)}s` }}
        >
          <circle cx="200" cy="200" r="148" fill="none" stroke="#60a5fa" strokeWidth="0.4" strokeDasharray="1 4" strokeOpacity="0.25" />
          <circle cx="200" cy="200" r="140" fill="none" stroke="#60a5fa" strokeWidth="1" strokeDasharray="4 8" strokeOpacity="0.4" />
          <circle cx="200" cy="200" r="120" fill="none" stroke="#00e5ff" strokeWidth="1.5" strokeDasharray="20 40" strokeOpacity="0.5" />
          {/* Data point markers on inner orbit */}
          {[0, 90, 180, 270].map((deg) => (
            <circle key={deg} cx={200 + 140 * Math.cos(deg * Math.PI / 180)} cy={200 + 140 * Math.sin(deg * Math.PI / 180)} r="1.5" fill="#c084fc" fillOpacity="0.5" />
          ))}
        </g>

        {/* Hexagonal grid hints */}
        {[80, 160, 240, 320].map((r) => (
          <polygon
            key={r}
            points={Array.from({ length: 6 }, (_, i) => {
              const angle = (i * 60 - 30) * Math.PI / 180;
              return `${200 + r * Math.cos(angle)},${200 + r * Math.sin(angle)}`;
            }).join(' ')}
            fill="none"
            stroke="#00e5ff"
            strokeWidth="0.3"
            strokeOpacity="0.08"
          />
        ))}
      </svg>

      {/* Dynamic Ambient Energy Aura Glow */}
      <div
        className="absolute inset-4 rounded-full transition-all duration-300 pointer-events-none z-0"
        style={{
          background: isProcessing
            ? 'radial-gradient(circle, rgba(168, 85, 247, 0.55) 0%, rgba(0,0,0,0) 70%)'
            : isSpeaking
            ? `radial-gradient(circle, rgba(0, 229, 255, ${0.5 + mouthGlow * 0.5}) 0%, rgba(0,0,0,0) 72%)`
            : 'radial-gradient(circle, rgba(0, 229, 255, 0.4) 0%, rgba(0,0,0,0) 70%)',
          transform: `scale(${1 + volume * 0.25})`
        }}
      />

      {/* Floating Hex Data Codes */}
      {hexCodes.map((code, i) => {
        const angle = (i / hexCodes.length) * Math.PI * 2;
        const radius = isCenterSize ? 220 : 180;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return (
          <div
            key={i}
            className="absolute z-5 pointer-events-none font-mono text-[8px] tracking-wider"
            style={{
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
              color: i % 2 === 0 ? 'rgba(0,229,255,0.2)' : 'rgba(192,132,252,0.2)',
              transform: 'translate(-50%, -50%)',
              animation: `ambientDrift ${4 + i * 0.5}s ease-in-out infinite ${i * 0.3}s`
            }}
          >
            {code}
          </div>
        );
      })}

      {/* Pure Transparent Neon JIN Line-Art Avatar */}
      <div className={`relative z-10 ${avatarImgSize} flex items-center justify-center hologram-avatar-container ${lampClass}`}>
        <img
          src="/genie-bg.png"
          alt="Live JIN Hologram"
          className="w-full h-full select-none pointer-events-none transition-all duration-150"
          style={{
            transform: isSpeaking && jawOffset > 0.4 ? `translateY(${jawOffset * 0.35}px)` : 'none',
            filter: isSpeaking
              ? `drop-shadow(0 0 ${18 + mouthGlow * 28}px rgba(0, 229, 255, 0.95)) drop-shadow(0 0 35px rgba(168, 85, 247, 0.7)) brightness(${1.05 + mouthGlow * 0.35})`
              : isProcessing
              ? 'drop-shadow(0 0 30px rgba(168, 85, 247, 0.95)) hue-rotate(45deg)'
              : isListening
              ? 'drop-shadow(0 0 25px rgba(0, 229, 255, 0.9)) brightness(1.15)'
              : 'drop-shadow(0 0 16px rgba(0, 229, 255, 0.7)) drop-shadow(0 0 25px rgba(168, 85, 247, 0.5))'
          }}
        />

        {/* Dynamic Holographic Facial Mimicry Engine (Eye Blinking, Eyebrows & Smiling Squint) */}
        <LiveFaceMimic
          blinkProgress={blinkProgress}
          eyebrowRaise={eyebrowRaise}
          eyeSquint={eyeSquint}
          isSpeaking={isSpeaking}
          isProcessing={isProcessing}
          mouthGlow={mouthGlow}
        />

        {/* Dynamic Holographic Lip-Sync Engine (SVG Viseme Morphing) */}
        <LiveMouthViseme
          isSpeaking={isSpeaking}
          aperture={aperture}
          spread={spread}
          mouthGlow={mouthGlow}
          isProcessing={isProcessing}
        />

        {/* Live Speaking Frequency Glow on Beard / Mouth area */}
        {isSpeaking && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-75"
            style={{ opacity: Math.max(0.12, mouthGlow * 0.6) }}
          >
            <div className="w-20 h-11 rounded-full bg-cyan-400/20 blur-sm translate-y-[73px] shadow-[0_0_20px_#00e5ff]"></div>
          </div>
        )}

        {/* Live Listening Audio Focus Beacon - triple ring */}
        {isListening && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-40 h-40 rounded-full border border-cyan-400/30 animate-ping opacity-30" style={{ animationDuration: '1.5s' }}></div>
            <div className="absolute w-52 h-52 rounded-full border border-cyan-400/20 animate-ping opacity-20" style={{ animationDuration: '2s', animationDelay: '0.5s' }}></div>
          </div>
        )}
      </div>

      {/* Concentric Glowing Hologram Ripple Base Pedestal */}
      <div className={`absolute ${pedestalSize} flex items-center justify-center pointer-events-none z-0`}>
        <div className="absolute w-[95%] h-[80%] rounded-[100%] border border-cyan-400/20 ripple-circle-1" style={{ animationDelay: '0s' }}></div>
        <div className="absolute w-[90%] h-[70%] rounded-[100%] border border-cyan-400/50 bg-cyan-500/15 shadow-[0_0_35px_rgba(0,229,255,0.6)] ripple-circle-1"></div>
        <div className="absolute w-[70%] h-[50%] rounded-[100%] border border-blue-400/50 ripple-circle-2"></div>
        <div className="absolute w-[50%] h-[35%] rounded-[100%] border border-cyan-300/60 ripple-circle-3"></div>
        <div className="absolute w-[30%] h-[20%] rounded-[100%] bg-cyan-400/90 blur-none shadow-[0_0_30px_#00e5ff]"></div>
        {/* Pedestal glow ring */}
        <div className="absolute w-[100%] h-[85%] rounded-[100%] bg-gradient-to-t from-cyan-500/10 to-transparent blur-sm"></div>
      </div>
    </div>
  );
}
