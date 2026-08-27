/**
 * SpeechToText.js
 * Speech Recognition service utilizing Web Speech API with event callbacks.
 */

export class SpeechToText {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.onEndCallback = null;
    this.init();
  }

  init() {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'id-ID'; // Default Indonesian, fallback compatible

      this.recognition.onresult = (event) => {
        let transcript = '';
        let isFinal = false;
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
          if (event.results[i].isFinal) isFinal = true;
        }
        if (this.onResultCallback) {
          this.onResultCallback(transcript, isFinal);
        }
      };

      this.recognition.onerror = (event) => {
        this.isListening = false;
        if (this.onErrorCallback) this.onErrorCallback(event.error);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (this.onEndCallback) this.onEndCallback();
      };
    }
  }

  start(onResult, onError, onEnd) {
    this.onResultCallback = onResult;
    this.onErrorCallback = onError;
    this.onEndCallback = onEnd;

    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
        this.isListening = true;
        return true;
      } catch {
        this.isListening = false;
        return false;
      }
    }
    return false;
  }

  stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // Safe catch
      }
      this.isListening = false;
    }
  }
}

export const speechToTextInstance = new SpeechToText();
export default speechToTextInstance;
