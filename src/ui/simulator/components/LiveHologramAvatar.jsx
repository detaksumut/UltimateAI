import React, { useRef, useEffect, useState, useCallback } from 'react';
import LiveMouthViseme from './LiveMouthViseme.jsx';
import LiveJeannieHologram from './LiveJeannieHologram.jsx';
import LiveChromaVideo from './LiveChromaVideo.jsx';
import { magicChimeEngineInstance } from '../../../services/audio/MagicChimeEngine.js';
import { voiceControllerInstance } from '../../../services/voice/VoiceController.js';
import { Sparkles, Moon, Sun, ArrowUpRight, Volume2, Play } from 'lucide-react';

export default function LiveHologramAvatar({ avatarState, audioMetrics, size = 'default', className = '', modalOpen = false }) {
  const canvasRef = useRef(null);
  const {
    mouthGlow = 0,
    volume = 0.1,
    orbitSpeed = 1.0,
    aperture = 0,
    spread = 1.0,
    jawOffset = 0
  } = audioMetrics || {};

  const isSpeaking = avatarState === 'SPEAKING';
  const isProcessing = avatarState === 'PROCESSING';
  const isListening = avatarState === 'LISTENING';
  const isPanelSize = size === 'panel';
  const isCenterSize = size === 'center';

  // Avatar Persona: 'JEANNIE' (1970s I Dream of Jeannie) or 'JIN' (Classic Genie)
  const [avatarPersona, setAvatarPersona] = useState('JEANNIE');

  // Video loop states (Hellomaster2.mp4 / Hedra AI Talking Avatar video loop)
  const videoRef = useRef(null);
  const [talkingVideoSrc, setTalkingVideoSrc] = useState('/Hellomaster2.mp4');
  const [hasVideoTalking, setHasVideoTalking] = useState(true);
  const [isDemoPlaying, setIsDemoPlaying] = useState(false);

  useEffect(() => {
    // Check available AI generated video loops in /public
    const candidates = ['/Hellomaster2.mp4', '/hellomaster2.mp4'];
    let found = false;

    const checkCandidate = async () => {
      for (const src of candidates) {
        try {
          const res = await fetch(src, { method: 'HEAD' });
          if (res.ok) {
            setTalkingVideoSrc(src);
            setHasVideoTalking(true);
            found = true;
            break;
          }
        } catch {
          // ignore error
        }
      }
      if (!found) setHasVideoTalking(false);
    };

    checkCandidate();
  }, []);

  // Jeannie Signature Sequence States
  const [lampPhase, setLampPhase] = useState('IDLE'); // 'IDLE', 'ENTER', 'INSIDE', 'EMERGE'
  const [isCrossingArms, setIsCrossingArms] = useState(false);
  const [isNodding, setIsNodding] = useState(false);
  const [isWinking, setIsWinking] = useState(false);

  const prevModalOpen = useRef(modalOpen);
  const prevSpeakingRef = useRef(isSpeaking);

  // ═══ SIGNATURE ACTION 1: JINNY FOLDS ARMS, NODS, PLAYS CHIME & SUCKS INTO BOTTLE ═══
  const triggerRestInBottle = useCallback(() => {
    if (lampPhase === 'INSIDE' || lampPhase === 'ENTER') return;

    // 1. Fold arms across chest + wink + head nod
    setIsCrossingArms(true);
    setIsWinking(true);
    setIsNodding(true);

    // 2. Play iconic 1970s Jeannie magic harp / chime glissando
    magicChimeEngineInstance.playMagicChime();

    // 3. After the magical nod (800ms), spiral vortex dissolve into bottle
    const timer1 = setTimeout(() => {
      setLampPhase('ENTER');
      const timer2 = setTimeout(() => {
        setLampPhase('INSIDE');
        setIsCrossingArms(false);
        setIsNodding(false);
        setIsWinking(false);
      }, 1100);
      return () => clearTimeout(timer2);
    }, 850);

    return () => clearTimeout(timer1);
  }, [lampPhase]);

  // ═══ SIGNATURE ACTION 2: JINNY EMERGES BURSTING UP OUT OF BOTTLE WITH MAGENTA SMOKE ═══
  const triggerSummonFromBottle = useCallback(() => {
    if (lampPhase === 'IDLE' || lampPhase === 'EMERGE') return;

    magicChimeEngineInstance.playMagicChime();
    setLampPhase('EMERGE');
    setIsCrossingArms(false);
    setIsNodding(false);
    setIsWinking(false);

    const timer = setTimeout(() => {
      setLampPhase('IDLE');
    }, 1350);

    return () => clearTimeout(timer);
  }, [lampPhase]);

  const playVideoDemo = useCallback(() => {
    if (lampPhase === 'INSIDE') {
      triggerSummonFromBottle();
      setTimeout(() => {
        setIsDemoPlaying(true);
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(() => {});
        }
      }, 900);
      return;
    }
    setIsDemoPlaying(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [lampPhase, triggerSummonFromBottle]);

  // ═══ REQUIREMENT 1: SPEECH SESSION FINISHED -> SMOOTH AUTO-STANDBY RECOVERY ═══
  useEffect(() => {
    if (prevSpeakingRef.current && !isSpeaking) {
      // Sesi pembicaraan selesai: Jinny kembali ke posisi awal standby tanpa menggantung!
      setIsCrossingArms(false);
      setIsNodding(false);
      setIsWinking(false);
      setIsDemoPlaying(false);
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        } catch (_) {}
      }
    }
    prevSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    if (prevModalOpen.current === modalOpen) return;
    prevModalOpen.current = modalOpen;

    if (modalOpen) {
      triggerRestInBottle();
    } else {
      triggerSummonFromBottle();
    }
  }, [modalOpen, triggerRestInBottle, triggerSummonFromBottle]);

  // Automatic Behavior: When user speaks / asks question while Jinny is inside bottle, summon her!
  useEffect(() => {
    if ((isProcessing || isSpeaking || isListening || modalOpen) && lampPhase === 'INSIDE') {
      triggerSummonFromBottle();
    }
  }, [isProcessing, isSpeaking, isListening, lampPhase, modalOpen, triggerSummonFromBottle]);

  // ═══ REQUIREMENT 2: IDLE 1 MENIT -> JINNY PAMIT TIDUR KE BOTOL ═══
  const idleTimerRef = useRef(null);
  const isGoingToSleepRef = useRef(false);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    // Hanya aktifkan hitungan mundur jika Jinny berada di luar botol (IDLE)
    if (lampPhase !== 'IDLE' || isGoingToSleepRef.current) return;
    if (isSpeaking || isProcessing || isListening) return;

    idleTimerRef.current = setTimeout(() => {
      // Pastikan kondisi masih memenuhi syarat ketika 1 menit berlalu
      if (lampPhase !== 'IDLE' || isSpeaking || isProcessing || isListening) return;
      isGoingToSleepRef.current = true;

      const bedtimeSpeech = "Jiny mau tidur dulu ya bos, kapan saja bos panggil jiny siap!";
      console.log('[JINNY-IDLE] 1 menit hening terlewati. Jinny berpamitan tidur ke botol:', bedtimeSpeech);

      try {
        voiceControllerInstance.speak(
          bedtimeSpeech,
          {
            force: true, // Pastikan suara pamit Jinny terdengar merdu
            onEnd: () => {
              isGoingToSleepRef.current = false;
              // Setelah selesai berucap, melipat tangan di dada, mengangguk dengan dentang chime, dan berputar masuk botol
              triggerRestInBottle();
            },
            onError: () => {
              isGoingToSleepRef.current = false;
              triggerRestInBottle();
            }
          }
        );
      } catch (err) {
        console.warn('[JINNY-IDLE] Voice speak failed, proceeding to bottle directly:', err);
        isGoingToSleepRef.current = false;
        triggerRestInBottle();
      }
    }, 60000); // 1 Menit (60.000 ms)
  }, [lampPhase, isSpeaking, isProcessing, isListening, triggerRestInBottle]);

  // Monitor interaksi user untuk me-reset timer 1 menit
  useEffect(() => {
    resetIdleTimer();

    const handleUserActivity = () => {
      if (!isGoingToSleepRef.current) {
        resetIdleTimer();
      }
    };

    window.addEventListener('mousemove', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });
    window.addEventListener('click', handleUserActivity, { passive: true });
    window.addEventListener('touchstart', handleUserActivity, { passive: true });
    window.addEventListener('scroll', handleUserActivity, { passive: true });

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
    };
  }, [resetIdleTimer]);

  const lampClass =
    lampPhase === 'ENTER'
      ? 'jin-lamp-enter'
      : lampPhase === 'EMERGE'
      ? 'jin-lamp-emerge'
      : lampPhase === 'INSIDE'
      ? 'jin-lamp-inside'
      : '';

  // ═══ VIBRANT LIVE PARTICLE & JEANNIE SPIRAL SMOKE VORTEX CANVAS ═══
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let last = performance.now();

    const width = (canvas.width = 440);
    const height = (canvas.height = 440);
    const holeX = width / 2;
    const holeY = height - 42; // Bottle neck location

    const seedAmbient = () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.8 + 0.8,
      speedY: -(Math.random() * 0.7 + 0.3),
      speedX: (Math.random() - 0.5) * 0.4,
      opacity: Math.random() * 0.6 + 0.2,
      pulse: Math.random() * Math.PI,
      smokeT: 0,
      smokeSeed: Math.random() * Math.PI,
      colorType: Math.random() > 0.4 ? 'magenta' : 'cyan'
    });

    const particles = Array.from({ length: 48 }, seedAmbient);

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
        // ─── JEANNIE TORNADO SPIRAL VORTEX INTO BOTTLE ───
        particles.forEach((p, i) => {
          const dx = holeX - p.x;
          const dy = holeY - p.y;
          const dist = Math.hypot(dx, dy) || 1;
          const pull = (280 + 120 * Math.sin(now / 150 + i)) * speedMult * dt;
          const ux = dx / dist;
          const uy = dy / dist;

          // Strong tangential spiral force (tornado corkscrew)
          p.x += ux * pull - uy * pull * 1.35;
          p.y += uy * pull + ux * pull * 1.35;
          p.pulse += 0.08 * speedMult;

          // Respawn in upper halo when sucked into the bottle neck
          if (dist < 14) {
            p.x = holeX + (Math.random() - 0.5) * 160;
            p.y = 40 + Math.random() * 120;
            p.opacity = Math.random() * 0.6 + 0.3;
            p.radius = Math.random() * 2.5 + 1.0;
          }

          const near = 1 - Math.min(1, dist / 280);
          const r = p.radius * (1 + near * 2.0);
          const a = Math.max(0, (p.opacity + Math.sin(p.pulse) * 0.25) * (0.4 + near * 0.8) * (1 - near * 0.3));

          // Color blend: Electric Magenta Pink & Glowing Cyan
          const isPink = p.colorType === 'magenta' || avatarPersona === 'JEANNIE';
          const rr = isPink ? Math.round(244 - near * 40) : Math.round(0 + near * 192);
          const gg = isPink ? Math.round(63 + near * 80) : Math.round(229 - near * 97);
          const bb = isPink ? Math.round(150 + near * 105) : 255;

          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.001, r), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rr}, ${gg}, ${bb}, ${Math.max(0, Math.min(1, a))})`;
          ctx.fill();
        });
      } else if (lampPhase === 'EMERGE') {
        // ─── JEANNIE SMOKE BURST OUT OF BOTTLE ───
        particles.forEach((p) => {
          p.smokeT += dt * (42 + p.smokeSeed * 18) * speedMult;
          const t = p.smokeT;
          if (t > 1) {
            p.smokeT = 0;
            p.smokeSeed = Math.random() * Math.PI;
            p.opacity = Math.random() * 0.5 + 0.3;
          }
          p.x = holeX + Math.sin(t * 3.6 + p.smokeSeed) * (8 + t * 95);
          p.y = holeY - t * (120 * speedMult) - Math.cos(t * 2.4 + p.smokeSeed) * (6 + t * 40);
          const r = 1.5 + t * 11 + p.smokeSeed;
          const a = Math.max(0, Math.min(1, Math.sin(t * Math.PI) * p.opacity * 1.25));

          const isPink = avatarPersona === 'JEANNIE' || p.smokeSeed > 1.5;
          const rr = isPink ? 244 : 0;
          const gg = isPink ? Math.round(63 + t * 100) : 229;
          const bb = 255;

          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.001, r), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rr}, ${gg}, ${bb}, ${a})`;
          ctx.fill();
        });
      } else {
        // ─── IDLE AMBIENT CYBER DUST ───
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
          const isPink = avatarPersona === 'JEANNIE';

          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.001, p.radius), 0, Math.PI * 2);
          ctx.fillStyle = isPink
            ? `rgba(244, 63, 94, ${Math.max(0.08, Math.min(0.9, currentOpacity))})`
            : `rgba(0, 229, 255, ${Math.max(0.08, Math.min(0.9, currentOpacity))})`;
          ctx.fill();
        });
      }
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [avatarState, isSpeaking, isProcessing, isListening, lampPhase, avatarPersona]);

  const containerSize = isCenterSize
    ? 'w-[420px] h-[440px] min-[1500px]:w-[480px] min-[1500px]:h-[480px]'
    : isPanelSize
    ? 'w-60 h-64 sm:w-68 sm:h-72'
    : 'w-80 h-84 md:w-96 md:h-96';

  const avatarImgSize = isCenterSize
    ? 'w-[380px] h-[380px] min-[1500px]:w-[440px] min-[1500px]:h-[440px]'
    : isPanelSize
    ? 'w-52 h-52 sm:w-60 sm:h-60'
    : 'w-72 h-72 md:w-84 md:h-84';

  const pedestalSize = isCenterSize
    ? 'w-[440px] h-32 -bottom-6'
    : isPanelSize
    ? 'w-68 h-20 -bottom-3'
    : 'w-88 h-28 -bottom-6';

  return (
    <div className={`relative ${containerSize} flex flex-col items-center justify-center select-none ${className}`}>
      {/* ═══ INTERACTIVE AVATAR PERSONA & BOTTLE ACTION TOOLBAR ═══ */}
      <div className="absolute -top-3 z-30 flex items-center gap-2 bg-[#040713]/85 backdrop-blur-md border border-cyan-400/25 px-3 py-1 rounded-full shadow-[0_0_16px_rgba(0,229,255,0.2)]">
        {/* Toggle Persona: Jinny vs JIN */}
        <button
          type="button"
          onClick={() => setAvatarPersona(p => (p === 'JEANNIE' ? 'JIN' : 'JEANNIE'))}
          className="flex items-center gap-1.5 text-[9px] font-mono tracking-wider transition-all duration-200 hover:scale-105"
          style={{
            color: avatarPersona === 'JEANNIE' ? '#f43f5e' : '#00e5ff',
            textShadow: avatarPersona === 'JEANNIE' ? '0 0 8px #f43f5e' : '0 0 8px #00e5ff'
          }}
          title="Ganti Avatar: Jinny (1970s Jeannie) atau JIN Klasik"
        >
          <Sparkles className="w-3 h-3" />
          <span className="font-bold">{avatarPersona === 'JEANNIE' ? 'JINNY 70s' : 'JIN GENIE'}</span>
        </button>

        <span className="text-white/20 text-[9px]">|</span>

        {/* Trigger Magic Bottle In/Out Action */}
        <button
          type="button"
          onClick={lampPhase === 'INSIDE' ? triggerSummonFromBottle : triggerRestInBottle}
          className="flex items-center gap-1 text-[8.5px] font-mono px-2 py-0.5 rounded-full transition-all duration-200 hover:brightness-125"
          style={{
            background: lampPhase === 'INSIDE' ? 'rgba(0,229,255,0.15)' : 'rgba(244,63,94,0.15)',
            border: lampPhase === 'INSIDE' ? '1px solid rgba(0,229,255,0.4)' : '1px solid rgba(244,63,94,0.4)',
            color: lampPhase === 'INSIDE' ? '#00e5ff' : '#f472b6'
          }}
          title={lampPhase === 'INSIDE' ? 'Panggil keluar dari botol' : 'Melipat tangan, mengangguk, lalu masuk botol'}
        >
          {lampPhase === 'INSIDE' ? (
            <>
              <Sun className="w-2.5 h-2.5" />
              <span>PANGGIL</span>
            </>
          ) : (
            <>
              <Moon className="w-2.5 h-2.5" />
              <span>MASUK BOTOL</span>
            </>
          )}
        </button>

        {/* Play Lipsync Video Demo (Hellomaster2.mp4) */}
        {avatarPersona === 'JEANNIE' && hasVideoTalking && (
          <>
            <span className="text-white/20 text-[9px]">|</span>
            <button
              type="button"
              onClick={playVideoDemo}
              className={`flex items-center gap-1 text-[8.5px] font-mono px-2 py-0.5 rounded-full transition-all duration-200 hover:brightness-125 ${
                isDemoPlaying
                  ? 'bg-amber-400 text-black font-bold shadow-[0_0_12px_#fbbf24]'
                  : 'bg-amber-500/20 border border-amber-400/40 text-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.3)]'
              }`}
              title="Putar video lip-sync Hellomaster2.mp4"
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>{isDemoPlaying ? 'PLAYING...' : 'HELLO MASTER'}</span>
            </button>
          </>
        )}
      </div>

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
        <g
          className="orbit-ring-outer origin-center"
          style={{ animationDuration: `${Math.max(4, 18 / orbitSpeed)}s` }}
        >
          <circle cx="200" cy="200" r="186" fill="none" stroke={avatarPersona === 'JEANNIE' ? '#f43f5e' : '#00e5ff'} strokeWidth="0.6" strokeDasharray="2 6" strokeOpacity="0.25" />
          <circle cx="200" cy="200" r="180" fill="none" stroke="#00e5ff" strokeWidth="1.2" strokeDasharray="8 12" strokeOpacity="0.35" />
        </g>
        <g
          className="orbit-ring-inner origin-center"
          style={{ animationDuration: `${Math.max(3, 13 / orbitSpeed)}s` }}
        >
          <circle cx="200" cy="200" r="140" fill="none" stroke={avatarPersona === 'JEANNIE' ? '#f472b6' : '#60a5fa'} strokeWidth="1" strokeDasharray="4 8" strokeOpacity="0.4" />
        </g>
      </svg>

      {/* Dynamic Ambient Energy Aura Glow */}
      <div
        className="absolute inset-6 rounded-full transition-all duration-300 pointer-events-none z-0"
        style={{
          background: isProcessing
            ? 'radial-gradient(circle, rgba(168, 85, 247, 0.55) 0%, rgba(0,0,0,0) 70%)'
            : avatarPersona === 'JEANNIE'
            ? `radial-gradient(circle, rgba(244, 63, 94, ${0.45 + mouthGlow * 0.45}) 0%, rgba(0,229,255,0.2) 45%, rgba(0,0,0,0) 72%)`
            : `radial-gradient(circle, rgba(0, 229, 255, ${0.45 + mouthGlow * 0.45}) 0%, rgba(0,0,0,0) 70%)`,
          transform: `scale(${1 + volume * 0.25})`
        }}
      />

      {/* ═══ AVATAR HOLOGRAM CONTAINER (APPLIES VORTEX SPIRAL ENTER/EMERGE/INSIDE) ═══ */}
      <div className={`relative z-10 ${avatarImgSize} flex items-center justify-center hologram-avatar-container ${lampClass}`}>
        {avatarPersona === 'JEANNIE' ? (
          /* ─── REAL BARBARA EDEN AS JEANNIE 1970s LIVING HOLOGRAM ─── */
          <div className="relative w-full h-full flex items-center justify-center scale-[0.82] -translate-y-2">
            {/* Real Barbara Eden Avatar: Seamless AI Video Loop (Hellomaster2.mp4) or Pristine Photo */}
            {(isSpeaking || isDemoPlaying) && hasVideoTalking ? (
              <LiveChromaVideo
                src={talkingVideoSrc}
                isPlaying={isSpeaking || isDemoPlaying}
                isMuted={!isDemoPlaying}
                isLoop={!isDemoPlaying}
                isNodding={isNodding}
                onEnded={() => {
                  if (isDemoPlaying) setIsDemoPlaying(false);
                }}
              />
            ) : (
              <img
                src="/jeannie-real.png"
                alt="Barbara Eden as Jeannie"
                className={`w-full h-full object-contain select-none pointer-events-none transition-all duration-400 ease-out ${
                  isNodding ? 'jeannie-head-nod' : ''
                }`}
                style={{
                  transform: isSpeaking
                    ? `translateY(${Math.sin(Date.now() / 150) * 2.2}px) rotate(${Math.sin(Date.now() / 300) * 0.8}deg) scale(${1 + (volume || 0) * 0.025})`
                    : 'translateY(0px) rotate(0deg) scale(1)',
                  filter: isSpeaking
                    ? `drop-shadow(0 0 18px rgba(244, 63, 94, 0.95)) drop-shadow(0 0 38px rgba(0, 229, 255, 0.75)) brightness(${1.08 + mouthGlow * 0.2})`
                    : isProcessing
                    ? 'drop-shadow(0 0 28px rgba(192, 132, 252, 0.95)) hue-rotate(45deg)'
                    : 'drop-shadow(0 0 18px rgba(244, 63, 94, 0.8)) drop-shadow(0 0 28px rgba(0, 229, 255, 0.5)) brightness(1.05)'
                }}
              />
            )}

            {/* Subtle Holographic Vocal Resonance Glow on Smile/Mouth during speech */}
            {isSpeaking && (
              <div
                className="absolute pointer-events-none z-10 transition-opacity duration-150"
                style={{
                  top: '34.5%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  opacity: Math.max(0.15, mouthGlow * 0.65)
                }}
              >
                <div className="w-14 h-5 rounded-full bg-pink-400/20 blur-sm shadow-[0_0_16px_#f43f5e]" />
              </div>
            )}

            {/* Magic Wink Sparkling Starburst over her right eye */}
            {isWinking && (
              <div
                className="absolute z-20 pointer-events-none animate-ping"
                style={{
                  top: '26.7%',
                  left: '54.5%',
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="relative w-10 h-10 flex items-center justify-center">
                  <div className="absolute w-8 h-1 bg-yellow-300 rounded-full shadow-[0_0_12px_#fbbf24]" />
                  <div className="absolute w-1 h-8 bg-yellow-300 rounded-full shadow-[0_0_12px_#fbbf24]" />
                  <div className="absolute w-5 h-5 rounded-full bg-white shadow-[0_0_16px_#ffffff]" />
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ─── CLASSIC JIN GENIE AVATAR (ORIGINAL) ─── */
          <>
            <img
              src="/genie-bg.png"
              alt="JIN Genie Avatar"
              className="w-full h-full object-contain select-none pointer-events-none transition-all duration-150"
              style={{
                transform: isSpeaking && jawOffset > 0.4 ? `translateY(${jawOffset * 0.35}px)` : 'none',
                filter: isSpeaking
                  ? `drop-shadow(0 0 ${18 + mouthGlow * 28}px rgba(0, 229, 255, 0.95)) drop-shadow(0 0 35px rgba(168, 85, 247, 0.7)) brightness(${1.05 + mouthGlow * 0.35})`
                  : isProcessing
                  ? 'drop-shadow(0 0 30px rgba(168, 85, 247, 0.95)) hue-rotate(45deg)'
                  : isListening
                  ? 'drop-shadow(0 0 25px rgba(0, 229, 255, 0.9)) brightness(1.15)'
                  : 'drop-shadow(0 0 16px rgba(0, 229, 255, 0.7)) drop-shadow(0 0 25px rgba(168, 85, 247, 0.5)) brightness(1.22) contrast(1.18) saturate(1.45)'
              }}
            />
            <LiveMouthViseme
              isSpeaking={isSpeaking}
              aperture={aperture}
              spread={spread}
              mouthGlow={mouthGlow}
              isProcessing={isProcessing}
            />
          </>
        )}
      </div>

      {/* ═══ ICONIC ANTIQUE JEANNIE BOTTLE & PEDESTAL ═══ */}
      <div className={`absolute ${pedestalSize} flex flex-col items-center justify-center pointer-events-none z-10`}>
        {/* Real Authentic 1970s Purple Jeannie Decanter Bottle */}
        <div className="relative -top-2 h-28 flex items-center justify-center transition-all duration-300">
          <img
            src="/jeannie-bottle-real.png"
            alt="Authentic 1970s Jeannie Bottle"
            className="h-full object-contain select-none pointer-events-none"
            style={{
              filter: lampPhase === 'INSIDE'
                ? 'drop-shadow(0 0 18px rgba(244, 63, 94, 0.95)) drop-shadow(0 0 25px rgba(251, 191, 36, 0.8)) brightness(1.2)'
                : 'drop-shadow(0 0 10px rgba(244, 63, 94, 0.6)) drop-shadow(0 0 16px rgba(0, 229, 255, 0.4))'
            }}
          />

          {/* Magical Internal Heart-Glow when Jinny is sleeping inside the bottle */}
          {lampPhase === 'INSIDE' && (
            <div
              className="absolute pointer-events-none animate-pulse"
              style={{
                bottom: '18px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(244,63,94,0.9) 0%, rgba(217,70,239,0.5) 50%, transparent 80%)',
                filter: 'blur(4px) drop-shadow(0 0 16px #f43f5e)'
              }}
            />
          )}

          {/* Vapor / Smoke wisp floating from the top lip of the real bottle */}
          <div
            className="absolute -top-1 w-2.5 h-2.5 rounded-full bg-pink-400/60 blur-xs animate-ping"
            style={{ animationDuration: '2s' }}
          />
        </div>

        {/* Concentric Base Pedestal Rings */}
        <div className="absolute w-[92%] h-[60%] -bottom-2 rounded-[100%] border border-cyan-400/30 bg-cyan-500/10 shadow-[0_0_25px_rgba(0,229,255,0.4)] ripple-circle-1" />
      </div>
    </div>
  );
}
