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

    const loop = () => {
      if (!this.isAnalyzing) return;
      tick += 0.05;

      let volume = 0.1;
      let mouthGlow = 0;
      let orbitSpeed = 1.0;
      let spectrum = [10, 15, 12, 18, 14, 16, 12, 10];

      if (state === 'SPEAKING') {
        // Dynamic synthetic speech cadence
        const speechOsc = Math.abs(Math.sin(tick * 3.5) * Math.cos(tick * 1.8));
        volume = 0.4 + speechOsc * 0.5;
        mouthGlow = 0.5 + speechOsc * 0.5;
        orbitSpeed = 2.4;
        spectrum = spectrum.map((v, i) => Math.min(100, Math.round(v + speechOsc * 70 * ((i % 3) + 1))));
      } else if (state === 'LISTENING') {
        const listenOsc = Math.abs(Math.sin(tick * 2));
        volume = 0.2 + listenOsc * 0.3;
        mouthGlow = 0.1;
        orbitSpeed = 1.8;
        spectrum = spectrum.map(v => Math.round(v + listenOsc * 35));
      } else if (state === 'PROCESSING') {
        const procOsc = Math.abs(Math.sin(tick * 4));
        volume = 0.3;
        mouthGlow = 0.2;
        orbitSpeed = 3.0; // Fast spin
        spectrum = spectrum.map(v => Math.round(v + procOsc * 45));
      }

      const metrics = {
        volume,
        mouthGlow,
        orbitSpeed,
        spectrum,
        state
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
