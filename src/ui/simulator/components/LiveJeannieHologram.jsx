import React from 'react';

/**
 * LiveJeannieHologram.jsx
 * High-definition Translucent Cyber-Hologram Vector Character for JINNY.
 * Inspired by Barbara Eden's iconic 1970s "I Dream of Jeannie":
 * - Signature high topknot ponytail with flowing locks
 * - Translucent cyber harem vestment with tiara & veil
 * - Dynamic crossed-arms articulation (melipat tangan di dada)
 * - Magic nod & winking eye gesture with twinkling starburst
 * - Seamless integration with cosmos backdrop (transparent body interior)
 */
export default function LiveJeannieHologram({
  isCrossingArms = false,
  isNodding = false,
  isWinking = false,
  isSpeaking = false,
  isProcessing = false,
  mouthGlow = 0,
  lampPhase = 'IDLE'
}) {
  const primaryColor = isProcessing ? '#c084fc' : '#f43f5e'; // Iconic Jeannie Electric Pink / Magenta
  const secondaryColor = '#00e5ff'; // Holographic Cyan accent
  const glowColor = isProcessing ? 'rgba(192, 132, 252, 0.75)' : 'rgba(244, 63, 94, 0.75)';

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center pointer-events-none select-none transition-all duration-400 ease-out ${
        isNodding ? 'jeannie-head-nod' : ''
      }`}
      style={{
        transform: isSpeaking ? `translateY(${Math.sin(Date.now() / 150) * 1.5}px)` : 'translateY(0px)'
      }}
    >
      <svg
        viewBox="0 0 400 480"
        className="w-full h-full overflow-visible"
        style={{
          filter: `drop-shadow(0 0 ${12 + mouthGlow * 18}px ${glowColor}) drop-shadow(0 0 25px rgba(0,229,255,0.45))`
        }}
      >
        <defs>
          <filter id="jeannie-neon-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id="hair-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="0.95" /> {/* Golden blonde highlight */}
            <stop offset="60%" stopColor="#f43f5e" stopOpacity="0.85" /> {/* Magenta aura */}
            <stop offset="100%" stopColor="#00e5ff" stopOpacity="0.7" /> {/* Cyber cyan rim */}
          </linearGradient>

          <linearGradient id="bodice-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#ec4899" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#00e5ff" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* ═══ 1. HIGH TOPKNOT PONYTAIL (Kuncir Kuda Tinggi Ikonik Jeannie) ═══ */}
        <g id="jeannie-hair" filter="url(#jeannie-neon-glow)">
          {/* Top ponytail knot puff */}
          <path
            d="M 185 85 C 160 40, 240 40, 215 85 C 235 60, 245 95, 218 105 C 190 108, 175 95, 185 85 Z"
            fill="none"
            stroke="url(#hair-gradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Decorative Gold & Neon Hair Ring / Tiara Ribbon */}
          <ellipse
            cx="200"
            cy="90"
            rx="22"
            ry="8"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="3"
            filter="drop-shadow(0 0 6px #fbbf24)"
          />
          {/* Cascading flowing ponytail strands down left & right */}
          <path
            d="M 218 90 C 265 95, 285 140, 275 190 C 268 220, 255 240, 250 260"
            fill="none"
            stroke="url(#hair-gradient)"
            strokeWidth="2"
            strokeDasharray="4 2"
            opacity="0.85"
          />
          <path
            d="M 222 92 C 280 110, 298 160, 288 210 C 280 245, 265 270, 260 290"
            fill="none"
            stroke="url(#hair-gradient)"
            strokeWidth="1.6"
            opacity="0.7"
          />
          {/* Subtle front bangs framing the brow */}
          <path
            d="M 178 120 C 188 108, 212 108, 222 120"
            fill="none"
            stroke="#fef08a"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>

        {/* ═══ 2. JEANNIE TRANSLUCENT HAREM VEIL (Selendang Transparan) ═══ */}
        <g id="jeannie-veil" opacity="0.6">
          <path
            d="M 170 142 C 150 170, 145 220, 160 260 C 168 280, 185 295, 200 300 C 215 295, 232 280, 240 260 C 255 220, 250 170, 230 142"
            fill="none"
            stroke="#ec4899"
            strokeWidth="1.4"
            strokeDasharray="3 3"
          />
        </g>

        {/* ═══ 3. FEMININE FACE CONTOUR & NECK ═══ */}
        <g id="jeannie-face" filter="url(#jeannie-neon-glow)">
          {/* Elegant slender jawline */}
          <path
            d="M 175 138 C 172 170, 185 195, 200 206 C 215 195, 228 170, 225 138"
            fill="none"
            stroke="#00e5ff"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Slender neck & collarbone lines */}
          <path
            d="M 192 206 L 190 232 M 208 206 L 210 232"
            fill="none"
            stroke="#00e5ff"
            strokeWidth="1.6"
            opacity="0.75"
          />
          <path
            d="M 176 238 C 192 245, 208 245, 224 238"
            fill="none"
            stroke="#00e5ff"
            strokeWidth="1.5"
            opacity="0.7"
          />
        </g>

        {/* ═══ 4. FEMININE EYEBROWS & NOSE ═══ */}
        <g id="jeannie-features">
          {/* Graceful arched left eyebrow */}
          <path
            d="M 178 142 Q 186 137 194 141"
            fill="none"
            stroke="#f472b6"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Graceful arched right eyebrow */}
          <path
            d="M 206 141 Q 214 137 222 142"
            fill="none"
            stroke="#f472b6"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Dainty nose bridge & tip */}
          <path
            d="M 200 148 L 200 168 Q 200 173 203 172"
            fill="none"
            stroke="#00e5ff"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.8"
          />
        </g>

        {/* ═══ 5. SIGNATURE MAGIC WINKING EYE (KEDIPAN SIHIR DENGAN BINTANG) ═══ */}
        {isWinking && (
          <g id="magic-wink-sparkle" className="animate-ping" style={{ transformOrigin: '214px 152px' }}>
            {/* 8-point sparkling star burst over right eye */}
            <path
              d="M 214 140 L 214 164 M 202 152 L 226 152 M 206 144 L 222 160 M 206 160 L 222 144"
              stroke="#fef08a"
              strokeWidth="2.5"
              strokeLinecap="round"
              filter="drop-shadow(0 0 8px #fbbf24)"
            />
            <circle cx="214" cy="152" r="3.5" fill="#ffffff" filter="drop-shadow(0 0 10px #ffffff)" />
          </g>
        )}

        {/* ═══ 6. HAREM BODICE / VESTMENT (Busana Harem Futuristik) ═══ */}
        <g id="jeannie-bodice" filter="url(#jeannie-neon-glow)">
          {/* Curved shoulder line */}
          <path
            d="M 148 250 C 170 240, 230 240, 252 250"
            fill="none"
            stroke="#ec4899"
            strokeWidth="2.2"
          />
          {/* Ornate crop-top bodice */}
          <path
            d="M 166 250 C 172 278, 185 292, 200 292 C 215 292, 228 278, 234 250"
            fill="none"
            stroke="url(#bodice-gradient)"
            strokeWidth="2"
          />
          {/* Center jewel medallion */}
          <polygon
            points="200,256 205,263 200,270 195,263"
            fill="#fbbf24"
            stroke="#ffffff"
            strokeWidth="1"
            filter="drop-shadow(0 0 6px #fbbf24)"
          />
          {/* Slender bare midriff & waistband */}
          <path
            d="M 180 292 C 182 312, 185 325, 188 335 M 220 292 C 218 312, 215 325, 212 335"
            fill="none"
            stroke="#00e5ff"
            strokeWidth="1.6"
            opacity="0.75"
          />
          <path
            d="M 172 335 C 190 345, 210 345, 228 335"
            fill="none"
            stroke="#ec4899"
            strokeWidth="2.2"
          />
        </g>

        {/* ═══ 7. DYNAMIC ARMS (RESTING vs CROSSED ARMS "MELIPAT TANGAN DI DADA") ═══ */}
        {isCrossingArms ? (
          /* ─── CROSSED ARMS IN FRONT OF CHEST (Gestur Khas Jeannie) ─── */
          <g id="jeannie-arms-crossed" filter="url(#jeannie-neon-glow)" className="transition-all duration-300">
            {/* Left arm folded horizontally across chest */}
            <path
              d="M 148 250 C 142 270, 150 295, 175 298 L 235 298 C 242 298, 246 290, 244 285"
              fill="none"
              stroke="#00e5ff"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            {/* Right arm folded over left arm with hand resting gracefully on upper left arm */}
            <path
              d="M 252 250 C 258 270, 250 288, 225 290 L 165 290 C 158 290, 154 284, 156 278"
              fill="none"
              stroke="#f43f5e"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            {/* Elegant wrist cuffs / golden bracelets */}
            <ellipse cx="172" cy="290" rx="5" ry="7" fill="none" stroke="#fbbf24" strokeWidth="2.5" />
            <ellipse cx="228" cy="298" rx="5" ry="7" fill="none" stroke="#fbbf24" strokeWidth="2.5" />
          </g>
        ) : (
          /* ─── RESTING POSE: Arms arched gracefully down to hips ─── */
          <g id="jeannie-arms-resting" filter="url(#jeannie-neon-glow)" className="transition-all duration-300">
            {/* Left arm descending to hip */}
            <path
              d="M 148 250 C 135 280, 140 320, 162 342"
              fill="none"
              stroke="#00e5ff"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Right arm descending to hip */}
            <path
              d="M 252 250 C 265 280, 260 320, 238 342"
              fill="none"
              stroke="#00e5ff"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Golden wrist bracelets */}
            <ellipse cx="158" cy="336" rx="6" ry="3" fill="none" stroke="#fbbf24" strokeWidth="2" />
            <ellipse cx="242" cy="336" rx="6" ry="3" fill="none" stroke="#fbbf24" strokeWidth="2" />
          </g>
        )}

        {/* ═══ 8. SMOKE VORTEX LOWER BODY (Ekor Asap Melayang Masuk Botol) ═══ */}
        <g id="jeannie-vortex-tail" opacity="0.8">
          <path
            d="M 172 335 C 165 375, 225 395, 185 430 C 160 450, 215 470, 200 480"
            fill="none"
            stroke="url(#hair-gradient)"
            strokeWidth="3"
            strokeDasharray="6 3"
          />
          <path
            d="M 228 335 C 235 375, 175 395, 215 430 C 240 450, 185 470, 200 480"
            fill="none"
            stroke="#00e5ff"
            strokeWidth="2.2"
            strokeDasharray="4 4"
            opacity="0.7"
          />
        </g>
      </svg>
    </div>
  );
}
