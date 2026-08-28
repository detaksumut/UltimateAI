/**
 * RealtimeVoicePipeline.js
 * Production Full-Duplex Voice Engine for UltimateAI JIN Agent.
 * Handles:
 *  1. Browser Microphone & MediaStream
 *  2. Real-Time VAD (Voice Activity Detection via Web Audio API)
 *  3. Speech-to-Text (STT via SpeechRecognition)
 *  4. Instant Human Barge-In (TTS cancellation on speech detection)
 *  5. Text-to-Speech (TTS with Sentence Segmentation, Indonesian Normalization)
 */

import { indonesianTextNormalizerInstance } from './IndonesianTextNormalizer.js';

export const PIPELINE_STATES = {
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  TRANSCRIBING: 'TRANSCRIBING',
  THINKING: 'THINKING',
  TOOL_EXECUTION: 'TOOL_EXECUTION',
  SPEAKING: 'SPEAKING',
  INTERRUPTED: 'INTERRUPTED'
};

export class RealtimeVoicePipeline {
  constructor() {
    this.state = PIPELINE_STATES.IDLE;
    this.mediaStream = null;
    this.audioContext = null;
    this.analyser = null;
    this.recognition = null;
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.isListening = false;
    this.isPlayingTTS = false;
    this.preservedContext = null;
    this.listeners = new Set();
    this.vadThreshold = 0.02;
    this.vadInterval = null;

    this.initSTT();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _setState(newState, payload = {}) {
    this.state = newState;
    const event = { state: newState, timestamp: Date.now(), payload };
    for (const listener of this.listeners) {
      try { listener(event); } catch {}
    }
  }

  initSTT() {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'id-ID';

      this.recognition.onresult = (event) => {
        let transcript = '';
        let isFinal = false;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
          if (event.results[i].isFinal) isFinal = true;
        }

        const clean = transcript.trim();
        if (clean) {
          // Barge-in check: If JIN is speaking, immediately stop TTS
          if (this.isPlayingTTS) {
            this.handleBargeIn('SPEECH_DETECTED_DURING_TTS', clean);
          }

          if (isFinal) {
            this._setState(PIPELINE_STATES.TRANSCRIBING, { transcript: clean });
          }
        }
      };

      this.recognition.onerror = (e) => {
        if (e.error !== 'no-speech') {
          console.warn('[VOICE_PIPELINE] STT Error:', e.error);
        }
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          try { this.recognition.start(); } catch {}
        }
      };
    }
  }

  async startMicrophone() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return null;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);
        this.startVADLoop();
      }

      this.isListening = true;
      if (this.recognition) {
        try { this.recognition.start(); } catch {}
      }
      this._setState(PIPELINE_STATES.LISTENING, { mic: 'ACTIVE' });
      return true;
    } catch (err) {
      console.error('[VOICE_PIPELINE] Mic permission denied:', err);
      return false;
    }
  }

  startVADLoop() {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    this.vadInterval = setInterval(() => {
      if (!this.analyser || !this.isListening) return;
      this.analyser.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length / 255;

      // Detect speech energy
      if (average > this.vadThreshold && this.isPlayingTTS) {
        this.handleBargeIn('VAD_ENERGY_THRESHOLD_EXCEEDED');
      }
    }, 100);
  }

  handleBargeIn(reason = 'USER_BARGE_IN', transcript = '') {
    console.log(`[VOICE_PIPELINE] 🛑 Instant Barge-In [${reason}]`);
    this.stopTTS();
    this._setState(PIPELINE_STATES.INTERRUPTED, { reason, transcript, preservedContext: this.preservedContext });

    setTimeout(() => {
      if (this.isListening) {
        this._setState(PIPELINE_STATES.LISTENING);
      }
    }, 50);
  }

  speak(text, onComplete = null) {
    if (!this.synth) {
      if (onComplete) onComplete();
      return;
    }

    this.stopTTS();

    // Normalize text through IndonesianTextNormalizer before TTS
    const normalized = indonesianTextNormalizerInstance.normalize(text || '');
    if (!normalized.trim()) {
      if (onComplete) onComplete();
      return;
    }

    // Split into natural sentence segments
    const segments = indonesianTextNormalizerInstance.splitIntoSentences(normalized);
    if (segments.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    this._speakSegmentsSequentially(segments, onComplete);
  }

  _speakSegmentsSequentially(segments, onComplete) {
    if (!segments || segments.length === 0) {
      this.isPlayingTTS = false;
      this._setState(PIPELINE_STATES.IDLE);
      if (onComplete) onComplete();
      return;
    }

    const [current, ...rest] = segments;

    try {
      if (this.synth.paused) this.synth.resume();
    } catch {}

    const utterance = new SpeechSynthesisUtterance(current);
    utterance.lang = 'id-ID';
    utterance.rate = 0.90;
    utterance.pitch = 1.08;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      this.isPlayingTTS = true;
      this._setState(PIPELINE_STATES.SPEAKING, { text: current });
    };

    utterance.onend = () => {
      if (rest.length > 0) {
        // Natural sentence pause before next segment
        setTimeout(() => {
          this._speakSegmentsSequentially(rest, onComplete);
        }, 100);
      } else {
        this.isPlayingTTS = false;
        this._setState(PIPELINE_STATES.IDLE);
        if (onComplete) onComplete();
      }
    };

    utterance.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      this.isPlayingTTS = false;
      this._setState(PIPELINE_STATES.IDLE);
    };

    this.synth.speak(utterance);
  }

  stopTTS() {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {}
    }
    this.isPlayingTTS = false;
  }

  stopMicrophone() {
    this.isListening = false;
    if (this.vadInterval) clearInterval(this.vadInterval);
    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.stopTTS();
    this._setState(PIPELINE_STATES.IDLE);
  }
}

export const realtimeVoicePipelineInstance = new RealtimeVoicePipeline();
export default realtimeVoicePipelineInstance;
