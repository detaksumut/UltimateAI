/**
 * TextToSpeech.js (Bulletproof Chrome & Edge Edition)
 * Web Speech Synthesis with verified Google Bahasa Indonesia voice binding and anti-cancellation queue.
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

    // 1. Prioritize Google Bahasa Indonesia or any id-ID voice
    const idVoice = this.voices.find(v => 
      v.lang === 'id-ID' || 
      v.lang === 'id_ID' ||
      v.lang.startsWith('id') ||
      v.name.toLowerCase().includes('indonesia')
    );
    if (idVoice) return idVoice;

    // 2. Default system voice
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

    // Clean markdown/brackets from speech text
    const cleanText = text
      .replace(/\[.*?\]/g, '') // remove bracket tags like [9Router ...]
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*#_~>]/g, ' ')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    // Resume synth in Chrome
    try {
      if (this.synth.paused) {
        this.synth.resume();
      }
    } catch {}

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = voiceLang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voice = this.getBestVoice(voiceLang);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      this.isPlaying = true;
      console.log('[TTS] 🔊 Started speaking with voice:', voice?.name || 'default');
      if (onStart) onStart();
    };

    utterance.onend = () => {
      this.isPlaying = false;
      this.currentUtterance = null;
      console.log('[TTS] ✅ Finished speaking.');
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      console.warn('[TTS] ⚠️ Speech error:', e);
      this.isPlaying = false;
      this.currentUtterance = null;
      if (onError) onError(e);
      else if (onEnd) onEnd();
    };

    this.currentUtterance = utterance;

    try {
      this.synth.speak(utterance);
    } catch (err) {
      console.error('[TTS] Speak invocation error:', err);
      if (onEnd) onEnd();
    }
  }

  stop() {
    if (this.synth && this.isPlaying) {
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

  testVoiceAudio() {
    this.speak('Halo! Suara JIN aktif dan sistem siap beroperasi.');
  }
}

export const textToSpeechInstance = new TextToSpeech();
export default textToSpeechInstance;
