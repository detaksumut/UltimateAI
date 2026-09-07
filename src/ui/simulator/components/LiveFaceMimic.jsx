import React, { useMemo } from 'react';

/**
 * LiveFaceMimic.jsx
 * High-precision Holographic Facial Expression Engine for JIN.
 * Animates natural spontaneous eye blinking, smiling micro-squint, and dynamic eyebrow articulation.
 */
export default function LiveFaceMimic({
  blinkProgress = 0,
  eyebrowRaise = 0,
  eyeSquint = 0,
  isSpeaking = false,
  isProcessing = false,
  mouthGlow = 0
}) {
  const neonColor = isProcessing ? '#c084fc' : '#00e5ff';
  const glowColor = isProcessing ? 'rgba(192, 132, 252, 0.85)' : 'rgba(0, 229, 255, 0.85)';

  // Calculate eye aperture & eyelid drop during blink
  // Nominal eye half-height is 6.5px. During blink, it drops to 0px.
  const eyeOpenness = Math.max(0, 1 - blinkProgress);
  const lidDrop = blinkProgress * 7.5; // drops downward to cover eye

  // Squint effect (lower lid rises slightly during warm speech)
  const lowerLidRise = eyeSquint * 2.2;

  // ViewBox: 210 x 96
  // Left eye center: (64, 58), Right eye center: (146, 58)
  // Left brow center: (64, 25), Right brow center: (146, 25)
  const eyeGeom = useMemo(() => {
    // Left eye coordinates - neatly fitted to almond eye contours
    const lx1 = 45; // inner corner
    const lx2 = 83; // outer corner
    const lcx = 64;
    const lcy = 58;

    // Right eye coordinates - neatly fitted to almond eye contours
    const rx1 = 127; // inner corner
    const rx2 = 165; // outer corner
    const rcx = 146;
    const rcy = 58;

    // Upper lid apex (drops down during blink)
    const upperApexOffset = -6.5 * eyeOpenness + lowerLidRise * 0.4;
    const lowerApexOffset = 6.0 * eyeOpenness - lowerLidRise;

    // Closed eye lash line (when blinkProgress > 0.4)
    const leftClosedPath = `M ${lx1} ${lcy} Q ${lcx} ${lcy + 1.5} ${lx2} ${lcy}`;
    const rightClosedPath = `M ${rx1} ${rcy} Q ${rcx} ${rcy + 1.5} ${rx2} ${rcy}`;

    // Eyelid cover fill path (occludes underlying static eye during blink)
    const leftLidFill = `
      M ${lx1} ${lcy}
      Q ${lcx} ${lcy - 8} ${lx2} ${lcy}
      Q ${lcx} ${lcy + upperApexOffset + lidDrop} ${lx1} ${lcy}
      Z
    `.trim();

    const rightLidFill = `
      M ${rx1} ${rcy}
      Q ${rcx} ${rcy - 8} ${rx2} ${rcy}
      Q ${rcx} ${rcy + upperApexOffset + lidDrop} ${rx1} ${rcy}
      Z
    `.trim();

    return {
      lx1, lx2, lcx, lcy,
      rx1, rx2, rcx, rcy,
      upperApexOffset,
      lowerApexOffset,
      leftClosedPath,
      rightClosedPath,
      leftLidFill,
      rightLidFill
    };
  }, [eyeOpenness, lidDrop, lowerLidRise]);

  return (
    <div
      className="absolute pointer-events-none select-none z-20 overflow-visible"
      style={{
        width: '196px',
        height: '92px',
        left: '50%',
        top: '50.9%', // Calibrated right on the bullseye of JIN's eye axis
        transform: 'translate(-50%, -50%)'
      }}
    >
      <svg
        viewBox="0 0 210 96"
        className="w-full h-full overflow-visible"
        style={{
          filter: `drop-shadow(0 0 ${3 + mouthGlow * 4}px ${glowColor})`
        }}
      >
        <defs>
          <filter id="jin-brow-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <radialGradient id="eyelid-bg-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#040713" stopOpacity="0.96" />
            <stop offset="80%" stopColor="#050b1e" stopOpacity="0.92" />
            <stop offset="100%" stopColor={isProcessing ? '#3b0764' : '#03172e'} stopOpacity="0.88" />
          </radialGradient>
        </defs>

        {/* ═══ SPONTANEOUS EYE BLINK OCCLUSION & LASH LINES ═══ */}

        {/* ═══ 2. SPONTANEOUS BLINK OCCLUSION & LASH LINES ═══ */}
        {blinkProgress > 0.08 && (
          <g className="transition-opacity duration-75">
            {/* Dark Eyelid mask covering static background eyeball during blink */}
            <path d={eyeGeom.leftLidFill} fill="url(#eyelid-bg-grad)" />
            <path d={eyeGeom.rightLidFill} fill="url(#eyelid-bg-grad)" />

            {/* Closed Eyelid Neon Crease line when fully blinking */}
            {blinkProgress > 0.55 && (
              <>
                <path
                  d={eyeGeom.leftClosedPath}
                  fill="none"
                  stroke={neonColor}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  filter="url(#jin-brow-glow)"
                />
                <path
                  d={eyeGeom.rightClosedPath}
                  fill="none"
                  stroke={neonColor}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  filter="url(#jin-brow-glow)"
                />
              </>
            )}
          </g>
        )}

        {/* ═══ 3. WIDE-OPEN ALERT EYE IRIS SHINE (Mata Terbuka Bersinar) ═══ */}
        {blinkProgress < 0.15 && (
          <g className="transition-opacity duration-100">
            {/* Luminous cyan pupil center in left eye */}
            <circle
              cx={eyeGeom.lcx}
              cy={eyeGeom.lcy - 1}
              r={1.6 + (isSpeaking ? mouthGlow * 1.0 : 0.3)}
              fill={neonColor}
              opacity={0.85 + (isSpeaking ? mouthGlow * 0.15 : 0)}
              filter="url(#jin-brow-glow)"
            />
            {/* Luminous cyan pupil center in right eye */}
            <circle
              cx={eyeGeom.rcx}
              cy={eyeGeom.rcy - 1}
              r={1.6 + (isSpeaking ? mouthGlow * 1.0 : 0.3)}
              fill={neonColor}
              opacity={0.85 + (isSpeaking ? mouthGlow * 0.15 : 0)}
              filter="url(#jin-brow-glow)"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
