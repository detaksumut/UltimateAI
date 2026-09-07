/**
 * TypingSoundEngine.js
 * Lightweight Web Audio API synthesized mechanical keystroke sound.
 * Zero external audio files, zero network requests, zero latency.
 * Pure real-time procedural audio synchronized with character-by-character ticker.
 */

export class TypingSoundEngine {
  constructor() {
    this._audioCtx = null;
    this._enabled = true;
    this._lastPlayTime = 0;
    this._minIntervalMs = 12; // Prevents audio node pileup on hyper-fast bursts

    // Load persisted user preference
    try {
      const stored = localStorage.getItem('jin_typing_sound');
      if (stored !== null) {
        this._enabled = stored === 'true';
      }
    } catch {
      this._enabled = true;
    }
  }

  _getAudioContext() {
    if (!this._audioCtx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this._audioCtx = new AudioCtxClass();
      }
    }
    if (this._audioCtx && this._audioCtx.state === 'suspended') {
      this._audioCtx.resume().catch(() => {});
    }
    return this._audioCtx;
  }

  enable() {
    this._enabled = true;
    try {
      localStorage.setItem('jin_typing_sound', 'true');
    } catch {}
    this._getAudioContext();
  }

  disable() {
    this._enabled = false;
    try {
      localStorage.setItem('jin_typing_sound', 'false');
    } catch {}
  }

  toggle() {
    if (this._enabled) {
      this.disable();
    } else {
      this.enable();
    }
    return this._enabled;
  }

  isEnabled() {
    return this._enabled;
  }

  /**
   * Plays a synthesized mechanical cyber-tick for the rendered character.
   * - Whitespace (spaces, tabs, newlines) produce NO sound.
   * - Slight randomized pitch variation produces natural mechanical ambiance.
   *
   * @param {string} char - The single character being rendered
   */
  play(char) {
    if (!this._enabled || !char) return;

    // Rule 4 & 5: No sound for spaces, tabs, or newlines
    if (char === ' ' || char === '\n' || char === '\r' || char === '\t') {
      return;
    }

    const now = performance.now();
    // Dynamic cadence: slightly longer interval during high-speed typing to produce rhythmic terminal chatter
    const effectiveInterval = Math.max(this._minIntervalMs, 22);
    if (now - this._lastPlayTime < effectiveInterval) {
      return; // Smooth pacing throttle
    }
    this._lastPlayTime = now;

    try {
      const ctx = this._getAudioContext();
      if (!ctx || ctx.state !== 'running') {
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        return;
      }

      const t = ctx.currentTime;

      // 1. Dual oscillator for mechanical click timbre (transient punch + high-frequency tactile tick)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Subtle pitch variation (1750Hz +/- 120Hz)
      const baseFreq = 1750 + (Math.random() - 0.5) * 240;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, t);
      // Quick pitch-drop creates the physical key-strike tactile click
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.45, t + 0.015);

      // 2. High-pass filter for crispness
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1000, t);

      // 3. Subtle ambient volume envelope (soft click, ~18ms duration)
      const volume = 0.045; // Gentle ambient sound
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(volume, t + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);

      // Connect graph: Osc -> Filter -> Gain -> Destination
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.02);

      // Cleanup
      osc.onended = () => {
        try {
          osc.disconnect();
          filter.disconnect();
          gain.disconnect();
        } catch {}
      };
    } catch {
      // Graceful fallback: audio issue never breaks UI rendering
    }
  }
}

export const typingSoundEngineInstance = new TypingSoundEngine();
export default typingSoundEngineInstance;
