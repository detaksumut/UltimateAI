/**
 * SpeechToText.js (Ultra-Fast Response Edition)
 * Speech Recognition service with intelligent 600ms silence auto-finalization.
 */

export class SpeechToText {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.onEndCallback = null;
    this.silenceTimer = null;
    this.latestTranscript = '';
    this.init();
  }

  init() {
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

        if (transcript.trim()) {
          this.latestTranscript = transcript.trim();
          if (this.onResultCallback) {
            this.onResultCallback(transcript, isFinal);
          }

          // Clear previous silence timer
          if (this.silenceTimer) clearTimeout(this.silenceTimer);

          // Fast 700ms silence detection: auto-finalize speech without waiting 3s
          this.silenceTimer = setTimeout(() => {
            if (this.isListening && this.latestTranscript) {
              this.stopListening();
            }
          }, 700);
        }
      };

      this.recognition.onerror = (event) => {
        this.isListening = false;
        if (this.silenceTimer) clearTimeout(this.silenceTimer);
        if (this.onErrorCallback) this.onErrorCallback(event.error);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (this.silenceTimer) clearTimeout(this.silenceTimer);
        if (this.onEndCallback) this.onEndCallback(this.latestTranscript);
        this.latestTranscript = '';
      };
    }
  }

  startListening({ onStart, onResult, onEnd, onError, onFinalTranscript } = {}) {
    this.onResultCallback = onResult || onFinalTranscript;
    this.onErrorCallback = onError;
    this.onEndCallback = onFinalTranscript || onEnd;
    this.latestTranscript = '';

    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
        this.isListening = true;
        if (onStart) onStart();
        return true;
      } catch {
        this.isListening = false;
        return false;
      }
    }
    return false;
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {}
      this.isListening = false;
    }
  }

  start(onResult, onError, onEnd) {
    return this.startListening({ onResult, onError, onEnd });
  }

  stop() {
    this.stopListening();
  }
}

export const speechToTextInstance = new SpeechToText();
export default speechToTextInstance;
