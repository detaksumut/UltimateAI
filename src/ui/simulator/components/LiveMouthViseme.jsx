import React, { useMemo } from 'react';

/**
 * LiveMouthViseme.jsx
 * High-precision Holographic Neon Lip-Sync & Viseme Articulation Engine for JIN.
 * Dynamically morphs upper lip, lower lip, oral cavity, and phonic resonance in real-time.
 */
export default function LiveMouthViseme({
  isSpeaking = false,
  aperture = 0,
  spread = 1.0,
  mouthGlow = 0,
  isProcessing = false
}) {
  // If not speaking and mouth is closed, hide overlay to let original resting artwork shine
  const isVisible = isSpeaking || aperture > 0.04;
  const opacity = isSpeaking ? Math.min(1, 0.4 + aperture * 0.7) : Math.max(0, aperture * 8);

  const neonColor = isProcessing ? '#c084fc' : '#00e5ff';
  const glowColor = isProcessing ? 'rgba(192, 132, 252, 0.8)' : 'rgba(0, 229, 255, 0.85)';

  // Calculate morphing mouth geometry (SVG ViewBox 0 0 100 60, Center at 50, 28)
  const geom = useMemo(() => {
    const cx = 50;
    const cy = 28;
    const halfW = Math.max(20, Math.min(32, 25 * (spread || 1.0)));
    const open = Math.max(0, Math.min(18, (aperture || 0) * 16));

    const leftX = cx - halfW;
    const rightX = cx + halfW;
    const upperY = cy - open * 0.32;
    const lowerY = cy + open * 0.82;

    // Upper lip Cupid's bow contour
    const midLeftX = cx - halfW * 0.45;
    const midRightX = cx + halfW * 0.45;
    const bowPeakY = upperY - (open > 2 ? 1.5 : 0.8);
    const bowCenterY = upperY + (open > 2 ? 0.8 : 0.4);

    // Oral cavity closed path
    const cavityPath = `
      M ${leftX} ${cy}
      C ${midLeftX} ${bowPeakY}, ${cx - 3} ${bowCenterY}, ${cx} ${bowCenterY}
      C ${cx + 3} ${bowCenterY}, ${midRightX} ${bowPeakY}, ${rightX} ${cy}
      C ${midRightX} ${lowerY + 1}, ${midLeftX} ${lowerY + 1}, ${leftX} ${cy}
      Z
    `.trim();

    // Upper lip path
    const upperLipPath = `
      M ${leftX} ${cy}
      C ${midLeftX} ${bowPeakY}, ${cx - 3} ${bowCenterY}, ${cx} ${bowCenterY}
      C ${cx + 3} ${bowCenterY}, ${midRightX} ${bowPeakY}, ${rightX} ${cy}
    `.trim();

    // Lower lip path
    const lowerLipPath = `
      M ${leftX} ${cy}
      C ${midLeftX} ${lowerY}, ${midRightX} ${lowerY}, ${rightX} ${cy}
    `.trim();

    return {
      cx,
      cy,
      halfW,
      open,
      leftX,
      rightX,
      cavityPath,
      upperLipPath,
      lowerLipPath
    };
  }, [aperture, spread]);

  if (!isVisible && opacity <= 0.01) {
    return null;
  }

  return (
    <div
      className="absolute pointer-events-none transition-opacity duration-100 select-none z-20"
      style={{
        width: '64px',
        height: '38px',
        left: '50%',
        top: '69.2%', // Perfectly centered on the mouth parting line
        transform: 'translate(-50%, -50%)',
        opacity
      }}
    >
      <svg
        viewBox="0 0 100 60"
        className="w-full h-full overflow-visible"
        style={{
          filter: `drop-shadow(0 0 ${4 + mouthGlow * 8}px ${glowColor})`
        }}
      >
        <defs>
          <filter id="jin-lip-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <radialGradient id="jin-cavity-grad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#030814" stopOpacity="0.98" />
            <stop offset="70%" stopColor="#040b1c" stopOpacity="0.95" />
            <stop offset="100%" stopColor={isProcessing ? '#3b0764' : '#082f49'} stopOpacity="0.9" />
          </radialGradient>
        </defs>

        {/* 1. Inner Oral Cavity (revealed when mouth opens) */}
        {geom.open > 0.8 && (
          <path
            d={geom.cavityPath}
            fill="url(#jin-cavity-grad)"
            stroke="none"
          />
        )}

        {/* 2. Holographic Phonic Teeth / Resonance Light */}
        {geom.open > 2.8 && (
          <line
            x1={geom.cx - geom.halfW * 0.55}
            y1={geom.cy - geom.open * 0.15 + 1.2}
            x2={geom.cx + geom.halfW * 0.55}
            y2={geom.cy - geom.open * 0.15 + 1.2}
            stroke="rgba(240, 253, 250, 0.75)"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity={Math.min(1, (geom.open - 2.5) / 3)}
          />
        )}

        {/* 3. Subtle Inner Tongue Resonance Glow */}
        {geom.open > 4.5 && (
          <ellipse
            cx={geom.cx}
            cy={geom.cy + geom.open * 0.45}
            rx={geom.halfW * 0.38}
            ry={geom.open * 0.25}
            fill={isProcessing ? 'rgba(192, 132, 252, 0.35)' : 'rgba(0, 229, 255, 0.3)'}
            filter="url(#jin-lip-glow)"
          />
        )}

        {/* 4. Morphable Lower Lip Arc */}
        <path
          d={geom.lowerLipPath}
          fill="none"
          stroke={neonColor}
          strokeWidth={geom.open > 1 ? '1.8' : '1.4'}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#jin-lip-glow)"
        />

        {/* 5. Morphable Upper Lip Arc */}
        <path
          d={geom.upperLipPath}
          fill="none"
          stroke={neonColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#jin-lip-glow)"
        />

        {/* 6. Subtle Acoustic Soundwave Ripples when Speaking Loudly */}
        {isSpeaking && geom.open > 5 && (
          <circle
            cx={geom.cx}
            cy={geom.cy}
            r={geom.halfW * 0.9}
            fill="none"
            stroke={neonColor}
            strokeWidth="0.6"
            strokeDasharray="2 4"
            opacity="0.35"
            className="animate-ping"
            style={{ animationDuration: '0.9s' }}
          />
        )}
      </svg>
    </div>
  );
}
