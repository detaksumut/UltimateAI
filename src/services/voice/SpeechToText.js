/**
 * SpeechToText.js (Hardened Browser STT Engine)
 * High-reliability Speech Recognition service with MediaStream diagnostics,
 * id-ID locale, and fast 650ms silence auto-finalization.
 */

export class SpeechToText {
  constructor() {
    this.recognition = null;
    this.mediaStream = null;
    this.isListening = false;
    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.onEndCallback = null;
    this.silenceTimer = null;
    this.latestTranscript = '';
    this.hasFinalized = false;
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

      this.recognition.onstart = () => {
        this.isListening = true;
        this.hasFinalized = false;
        console.log('[VOG] STT_STARTED | Lang: id-ID');
      };

      this.recognition.onresult = (event) => {
        let fullTranscript = '';
        let isFinal = false;

        for (let i = 0; i < event.results.length; ++i) {
          fullTranscript += event.results[i][0].transcript;
          if (event.results[i].isFinal) isFinal = true;
        }

        const clean = fullTranscript.trim();
        if (clean) {
          this.latestTranscript = clean;
          console.log(`[VOG] STT_RESULT: "${clean}" (isFinal: ${isFinal})`);

          if (this.onResultCallback) {
            this.onResultCallback(clean, isFinal);
          }

          if (this.silenceTimer) clearTimeout(this.silenceTimer);

          // Auto-finalize speech after 650ms of quiet
          this.silenceTimer = setTimeout(() => {
            if (this.isListening && this.latestTranscript && !this.hasFinalized) {
              console.log('[VOG] VAD_SPEECH_END | Auto-finalizing transcript:', this.latestTranscript);
              this.hasFinalized = true;
              const textToDispatch = this.latestTranscript;
              this.stopListening();
              if (this.onEndCallback) {
                this.onEndCallback(textToDispatch);
              }
            }
          }, 650);
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('[VOG] STT_ERROR:', event.error);
        if (event.error !== 'no-speech') {
          this.isListening = false;
          if (this.silenceTimer) clearTimeout(this.silenceTimer);
          if (this.onErrorCallback) this.onErrorCallback(event.error);
        }
      };

      this.recognition.onend = () => {
        const remaining = this.latestTranscript;
        this.isListening = false;
        if (this.silenceTimer) clearTimeout(this.silenceTimer);
        
        if (remaining && !this.hasFinalized) {
          this.hasFinalized = true;
          if (this.onEndCallback) this.onEndCallback(remaining);
        }
        this.latestTranscript = '';
        console.log('[VOG] STT_ENDED');
      };
    }
  }

  async verifyMicrophonePermission() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      console.warn('[VOG] MediaDevices API not available in current environment');
      return true;
    }

    try {
      if (!this.mediaStream || !this.mediaStream.active) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const track = this.mediaStream.getAudioTracks()[0];
        console.log(`[VOG] MIC_PERMISSION: GRANTED | MIC_TRACK_STATE: ${track?.readyState || 'live'}`);
      }
      return true;
    } catch (err) {
      console.error('[VOG] MIC_PERMISSION_DENIED:', err.message);
      return false;
    }
  }

  async startListening({ onStart, onResult, onEnd, onError, onFinalTranscript } = {}) {
    this.onResultCallback = onResult || onFinalTranscript;
    this.onErrorCallback = onError;
    this.onEndCallback = onFinalTranscript || onEnd;
    this.latestTranscript = '';
    this.hasFinalized = false;

    if (this.isListening) {
      console.log('[VOG] STT already active, reusing existing session');
      return true;
    }

    await this.verifyMicrophonePermission();

    if (this.recognition) {
      try {
        this.recognition.start();
        this.isListening = true;
        console.log('[VOG] MIC_STARTED | VAD_SPEECH_START');
        if (onStart) onStart();
        return true;
      } catch (err) {
        if (err.name === 'InvalidStateError') {
          // Already running
          this.isListening = true;
          return true;
        }
        console.error('[VOG] STT Start Exception:', err);
        this.isListening = false;
        if (onError) onError(err);
        return false;
      }
    } else {
      console.warn('[VOG] STT_NOT_AVAILABLE in this browser.');
      return false;
    }
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
