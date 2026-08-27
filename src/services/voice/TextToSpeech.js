/**
 * TextToSpeech.js
 * Text-to-Speech service using Web Speech Synthesis with interruptible playback.
 */

export class TextToSpeech {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.currentUtterance = null;
    this.isPlaying = false;
    this.onStartCallback = null;
    this.onEndCallback = null;
    this.onErrorCallback = null;
  }

  speak(text, { onStart, onEnd, onError, voiceLang = 'id-ID' } = {}) {
    if (!this.synth) {
      if (onEnd) onEnd();
      return;
    }

    this.stop(); // Stop previous speech

    // Clean markdown/code symbols from speech text
    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'blok kode program')
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

    // Pick suitable voice if available
    const voices = this.synth.getVoices();
    const idVoice = voices.find(v => v.lang.includes('id') || v.lang.includes('ID')) || voices[0];
    if (idVoice) utterance.voice = idVoice;

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
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
      this.isPlaying = false;
      this.currentUtterance = null;
    }
  }

  cancel() {
    this.stop();
  }
}

export const textToSpeechInstance = new TextToSpeech();
export default textToSpeechInstance;
