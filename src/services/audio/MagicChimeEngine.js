/**
 * MagicChimeEngine.js
 * High-fidelity Procedural Web Audio API Synthesizer for Jinny's Signature Magic Chime.
 * Recreates the iconic 1970s "I Dream of Jeannie" magical harp / celesta arpeggio
 * with ascending twinkling harmonics, bell resonance, and ethereal shimmer.
 * 100% Client-side, 0 latency, 0 external network requests.
 */

class MagicChimeEngine {
  constructor() {
    this.ctx = null;
    this.isEnabled = true;
  }

  _initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Plays the signature Jeannie magic twinkle arpeggio
   * Sequence: Rapid ascending chime notes + final sparkling shimmer chord
   */
  playMagicChime() {
    if (!this.isEnabled) return;
    try {
      this._initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      // High sparkling pentatonic frequencies (G6, A6, C7, D7, E7, G7, C8)
      const frequencies = [1567.98, 1760.00, 2093.00, 2349.32, 2637.02, 3135.96, 4186.01];

      // Play rapid ascending chime notes (50ms interval)
      frequencies.forEach((freq, idx) => {
        const noteTime = now + idx * 0.05;
        this._playChimeNote(freq, noteTime, 0.35 + idx * 0.04);
      });

      // Final magic sparkle shimmer chord (plays simultaneously at peak)
      const peakTime = now + frequencies.length * 0.05;
      [2093.00, 3135.96, 4186.01, 5274.04].forEach(f => {
        this._playSparkleNote(f, peakTime);
      });
    } catch (e) {
      console.debug('[MagicChime] Audio context playback note:', e);
    }
  }

  _playChimeNote(freq, startTime, duration = 0.4) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.025, startTime + 0.08);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.2, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  _playSparkleNote(freq, startTime) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.14, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.65);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.65);
  }

  toggle(enable) {
    this.isEnabled = enable !== undefined ? enable : !this.isEnabled;
  }
}

export const magicChimeEngineInstance = new MagicChimeEngine();
export default magicChimeEngineInstance;
