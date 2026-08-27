/**
 * TextToSpeech.js (Enterprise Resilient Edition)
 * Web Speech Synthesis with automatic Chrome-pause prevention, voice fallback, and sentence chunking.
 */

export class TextToSpeech {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.currentUtterance = null;
    this.isPlaying = false;
    this.voices = [];

    if (this.synth) {
      this.loadVoices();
      if (typeof this.synth.onvoiceschanged !== 'undefined') {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  loadVoices() {
    if (!this.synth) return [];
    this.voices = this.synth.getVoices() || [];
    return this.voices;
  }

  getBestVoice(preferredLang = 'id-ID') {
    if (!this.voices || this.voices.length === 0) {
      this.loadVoices();
    }

    // 1. Try Indonesian voice
    const idVoice = this.voices.find(v => 
      v.lang.toLowerCase().includes('id') || 
      v.lang.toLowerCase().includes('indonesia') ||
      v.name.toLowerCase().includes('indonesia') ||
      v.name.toLowerCase().includes('ardi') ||
      v.name.toLowerCase().includes('gadis')
    );
    if (idVoice) return idVoice;

    // 2. Try default system voice
    const defaultVoice = this.voices.find(v => v.default);
    if (defaultVoice) return defaultVoice;

    // 3. Fallback to first available voice
    return this.voices[0] || null;
  }

  speak(text, { onStart, onEnd, onError, voiceLang = 'id-ID' } = {}) {
    if (!this.synth) {
      if (onEnd) onEnd();
      return;
    }

    // Ensure synth is not paused in Chrome
    try {
      this.synth.resume();
      this.stop();
    } catch {}

    // Clean markdown/code symbols from speech text
    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'blok kode')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*#_~>[\]()]/g, ' ')
      .trim();

    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = voiceLang;
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 1.0; // Maximum volume

    const voice = this.getBestVoice(voiceLang);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      this.isPlaying = true;
      if (onStart) onStart();
    };

    utterance.onend = () => {
      this.isPlaying = false;
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      this.isPlaying = false;
      this.currentUtterance = null;
      if (onError) onError(e);
      else if (onEnd) onEnd();
    };

    this.currentUtterance = utterance;

    try {
      this.synth.speak(utterance);
      // Chrome bug workaround: keep synth active
      if (this.synth.paused) {
        this.synth.resume();
      }
    } catch (err) {
      console.warn('[TTS] Speech synthesis error:', err);
      if (onEnd) onEnd();
    }
  }

  stop() {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {}
      this.isPlaying = false;
      this.currentUtterance = null;
    }
  }

  cancel() {
    this.stop();
  }

  /**
   * Play test sound and test voice output directly
   */
  testVoiceAudio() {
    this.speak('Halo! Suara JIN aktif dan sistem siap beroperasi.');
  }
}

export const textToSpeechInstance = new TextToSpeech();
export default textToSpeechInstance;
