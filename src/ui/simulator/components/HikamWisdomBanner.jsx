/**
 * HikamWisdomBanner.jsx
 * Al-Hikam Neural Wisdom Banner positioned above JIN.
 * 
 * Features:
 *  - Pure high-literary English aphorisms from Kitab Al-Hikam (Ibn 'Ata'illah)
 *  - Cyber-Spiritual Glassmorphism (subtle amber-gold & cyan glow)
 *  - Auto-rotation every 20s with hover-pause
 *  - Interactive Next, Previous, Shuffle, and Arabic/Contemplation toggle
 *  - Zero clunky meta-labels (Clean, focused, elegant)
 */

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Play, Pause, BookOpen } from 'lucide-react';
import { AL_HIKAM_WISDOMS, getHikmahById, getRandomHikmah, TOTAL_HIKMAH } from '../../../data/alHikamWisdoms';

export default function HikamWisdomBanner() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const hoverRef = useRef(false);

  const current = AL_HIKAM_WISDOMS[currentIndex] || AL_HIKAM_WISDOMS[0];

  const transitionTo = (newIndex) => {
    setIsFading(true);
    setTimeout(() => {
      setCurrentIndex((newIndex + AL_HIKAM_WISDOMS.length) % AL_HIKAM_WISDOMS.length);
      setIsFading(false);
    }, 200);
  };

  const handleNext = () => transitionTo(currentIndex + 1);
  const handlePrev = () => transitionTo(currentIndex - 1);
  const handleShuffle = () => {
    let rand = Math.floor(Math.random() * AL_HIKAM_WISDOMS.length);
    if (rand === currentIndex) rand = (rand + 1) % AL_HIKAM_WISDOMS.length;
    transitionTo(rand);
  };

  // Auto-rotation timer (20 seconds)
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      if (!hoverRef.current) {
        transitionTo((currentIndex + 1) % AL_HIKAM_WISDOMS.length);
      }
    }, 20000);

    return () => clearInterval(timer);
  }, [currentIndex, isPaused]);

  return (
    <div
      onMouseEnter={() => { hoverRef.current = true; }}
      onMouseLeave={() => { hoverRef.current = false; }}
      className="w-full max-w-[420px] mb-3 px-3 py-2 rounded-lg relative overflow-hidden transition-all duration-300 border border-[rgba(251,191,36,0.22)] bg-[rgba(6,11,25,0.72)] backdrop-blur-md shadow-[0_0_18px_rgba(251,191,36,0.08)] hover:border-[rgba(251,191,36,0.4)]"
    >
      {/* Top Ambient Glow Line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[rgba(251,191,36,0.45)] to-transparent" />

      {/* Header Bar: Aphorism Number, Theme, and Controls */}
      <div className="flex items-center justify-between text-[9px] font-mono mb-1.5 pb-1 border-b border-[rgba(251,191,36,0.12)]">
        <div className="flex items-center gap-1.5 overflow-hidden truncate">
          <span className="text-amber-400 font-bold tracking-wider">
            APHORISM #{String(current.id).padStart(2, '0')}
          </span>
          <span className="text-[rgba(251,191,36,0.3)]">•</span>
          <span className="text-cyan-300 uppercase tracking-wide truncate font-medium">
            {current.theme}
          </span>
        </div>

        {/* Minimalist Controls */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`p-1 rounded transition ${
              showDetails
                ? 'bg-amber-500/25 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-amber-300'
            }`}
            title={showDetails ? 'Hide Arabic & Contemplation' : 'View Arabic & Contemplation'}
          >
            <BookOpen className="w-2.5 h-2.5" />
          </button>

          <button
            onClick={handleShuffle}
            className="p-1 rounded text-slate-400 hover:text-cyan-300 transition active:scale-95"
            title="Random Aphorism"
          >
            <Sparkles className="w-2.5 h-2.5" />
          </button>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-1 rounded text-slate-400 hover:text-cyan-300 transition"
            title={isPaused ? 'Resume auto-rotation' : 'Pause auto-rotation'}
          >
            {isPaused ? <Play className="w-2.5 h-2.5 text-amber-400" /> : <Pause className="w-2.5 h-2.5 text-slate-400" />}
          </button>

          <button
            onClick={handlePrev}
            className="p-1 rounded text-slate-400 hover:text-white transition active:scale-90"
            title="Previous"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>

          <button
            onClick={handleNext}
            className="p-1 rounded text-slate-400 hover:text-white transition active:scale-90"
            title="Next"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main Quote Body in English */}
      <div
        className={`transition-opacity duration-200 text-center px-1 ${
          isFading ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <p className="text-[11px] font-sans font-normal leading-relaxed text-slate-200 italic select-none">
          "{current.english}"
        </p>
      </div>

      {showDetails && (
        <div className="mt-2 pt-1.5 border-t border-[rgba(251,191,36,0.1)] text-center animate-fadeIn">
          {current.arabic && (
            <p className="text-[13px] font-serif text-amber-200/90 leading-relaxed mb-1 direction-rtl" dir="rtl">
              {current.arabic}
            </p>
          )}
          {current.contemplation && (
            <p className="text-[9.5px] font-mono text-cyan-300/80 leading-tight">
              ✦ {current.contemplation}
            </p>
          )}
        </div>
      )}

      {/* Bottom Subtle Accent */}
      <div className="absolute bottom-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-[rgba(0,229,255,0.25)] to-transparent" />
    </div>
  );
}
