/**
 * AudioReactiveAnalyzer.js
 * Analyzes audio frequency and RMS amplitude for Level A Holographic Reactive JIN.
 * Computes real-time metrics for mouth glow, energy pulse, and waveform oscilloscope.
 */

export class AudioReactiveAnalyzer {
  constructor() {
    this.audioCtx = null;
    this.analyser = null;
    this.dataArray = null;
    this.animationId = null;
    this.isAnalyzing = false;
    this.listeners = new Set();
  }

  initContext() {
    if (typeof window === 'undefined') return;
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 64; // Fast real-time bins
        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);
      }
    }
  }

  startSynthetic(state = 'IDLE') {
    this.isAnalyzing = true;
    let tick = 0;
    let smoothedAperture = 0;
    let smoothedSpread = 1.0;
    let smoothedJaw = 0;
    let smoothedBrow = 0;
    let smoothedSquint = 0;

    // Spontaneous natural blinking timer
    let nextBlinkTime = performance.now() + 2500 + Math.random() * 2500;
    let blinkStartTime = 0;

    const loop = (now = performance.now()) => {
      if (!this.isAnalyzing) return;
      tick += 0.05;

      // ── 1. SPONTANEOUS EYE BLINK ENGINE (Mata Terbuka LAMA, Menutup Cepat Sekejap: ~110ms) ──
      let blinkProgress = 0;
      if (now >= nextBlinkTime && blinkStartTime === 0) {
        blinkStartTime = now;
      }
      if (blinkStartTime > 0) {
        const elapsed = now - blinkStartTime;
        if (elapsed < 110) {
          // Kedipan kilat sekejap (0 -> 1 -> 0 dalam 110ms saja)
          blinkProgress = Math.sin((elapsed / 110) * Math.PI);
        } else {
          blinkStartTime = 0;
          // Mata TERBUKA LAMA: 4.5 hingga 8.0 detik terus terbuka segar!
          nextBlinkTime = now + 4500 + Math.random() * 3500;
        }
      }

      let volume = 0.1;
      let mouthGlow = 0;
      let orbitSpeed = 1.0;
      let spectrum = [10, 15, 12, 18, 14, 16, 12, 10];

      if (state === 'SPEAKING') {
        // Natural Multi-Harmonic Syllable & Phoneme Cadence Generator
        // 1. Primary syllable cadence (~3.8 Hz typical conversational rate)
        const sylPhase = (tick * 4.4) % (Math.PI * 2);
        const sylOsc = Math.sin(sylPhase);

        // 2. Secondary phoneme articulation (tongue & vowel formant shift ~8.2 Hz)
        const phonemeMod = Math.sin(tick * 8.2);

        // 3. Inter-syllabic consonant dips (consonants like M, P, B, T closing lips)
        const dipWave = Math.sin(tick * 2.1);
        const isConsonantDip = dipWave < -0.65 && Math.sin(tick * 6.0) > 0.25;

        // Compute raw target aperture (0.0 to 1.0)
        let rawAperture = 0;
        let rawSpread = 1.0;
        let targetJaw = 0;

        if (isConsonantDip) {
          // Consonant closure pose
          rawAperture = 0.04;
          rawSpread = 0.96;
          targetJaw = 0.3;
        } else {
          // Open vowel articulation - more expressive width and aperture
          const baseOpen = Math.max(0, sylOsc) * 0.72 + Math.max(0, phonemeMod) * 0.28;
          rawAperture = 0.22 + baseOpen * 0.95;
          rawSpread = 1.05 + phonemeMod * 0.22; // widens dynamically for more expressive speech articulation
          targetJaw = baseOpen * 2.8; // jaw drops up to 2.8px
        }

        // Smooth LERP interpolation for organic non-robotic lip elasticity
        smoothedAperture += (rawAperture - smoothedAperture) * 0.35;
        smoothedSpread += (rawSpread - smoothedSpread) * 0.28;
        smoothedJaw += (targetJaw - smoothedJaw) * 0.25;

        // Eyebrows elevate on pitch/vowel emphasis
        const targetBrow = Math.max(0, sylOsc) * 0.65 + (smoothedAperture > 0.4 ? 0.35 : 0);
        smoothedBrow += (targetBrow - smoothedBrow) * 0.25;

        // Smiling eyes micro-squint during speech
        const targetSquint = smoothedAperture * 0.38;
        smoothedSquint += (targetSquint - smoothedSquint) * 0.22;

        volume = 0.35 + smoothedAperture * 0.55;
        mouthGlow = 0.45 + smoothedAperture * 0.55;
        orbitSpeed = 2.2 + smoothedAperture * 0.8;
        spectrum = spectrum.map((v, i) => Math.min(100, Math.round(v + smoothedAperture * 65 * ((i % 3) + 1))));
      } else {
        // Return gracefully to resting mouth pose (closed lips)
        smoothedAperture += (0 - smoothedAperture) * 0.22;
        smoothedSpread += (1.0 - smoothedSpread) * 0.22;
        smoothedJaw += (0 - smoothedJaw) * 0.22;
        smoothedSquint += (0 - smoothedSquint) * 0.2;

        if (state === 'LISTENING') {
          const listenOsc = Math.abs(Math.sin(tick * 2));
          volume = 0.2 + listenOsc * 0.3;
          mouthGlow = 0.1;
          orbitSpeed = 1.8;
          spectrum = spectrum.map(v => Math.round(v + listenOsc * 35));
          // Attentive listening brow
          smoothedBrow += (0.25 - smoothedBrow) * 0.15;
        } else if (state === 'PROCESSING') {
          const procOsc = Math.abs(Math.sin(tick * 4));
          volume = 0.3;
          mouthGlow = 0.2;
          orbitSpeed = 3.0; // Fast analytical spin
          spectrum = spectrum.map(v => Math.round(v + procOsc * 45));
          // Thoughtful analytical brow furrow
          smoothedBrow += (-0.2 - smoothedBrow) * 0.15;
        } else {
          // IDLE rest brow
          smoothedBrow += (0 - smoothedBrow) * 0.15;
        }
      }

      const metrics = {
        volume,
        mouthGlow,
        orbitSpeed,
        spectrum,
        state,
        // High-fidelity Viseme & Lip Articulation metrics
        aperture: Math.max(0, Math.min(1, smoothedAperture)),
        spread: Math.max(0.85, Math.min(1.25, smoothedSpread)),
        jawOffset: Math.max(0, Math.min(4, smoothedJaw)),
        // Facial Mimicry metrics
        blinkProgress: Math.max(0, Math.min(1, blinkProgress)),
        eyebrowRaise: Math.max(-0.5, Math.min(1.0, smoothedBrow)),
        eyeSquint: Math.max(0, Math.min(0.5, smoothedSquint)),
        isSpeaking: state === 'SPEAKING'
      };

      this.listeners.forEach(cb => cb(metrics));
      this.animationId = requestAnimationFrame(loop);
    };

    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.animationId = requestAnimationFrame(loop);
  }

  stop() {
    this.isAnalyzing = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}

export const audioReactiveAnalyzerInstance = new AudioReactiveAnalyzer();
export default audioReactiveAnalyzerInstance;
