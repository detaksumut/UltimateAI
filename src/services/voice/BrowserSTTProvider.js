/**
 * BrowserSTTProvider.js
 * Browser Web Speech API SpeechRecognition wrapper with id-ID locale,
 * comprehensive event listeners, and detailed network error diagnostics.
 */

import { BaseSTTProvider } from './STTProvider.js';

export class BrowserSTTProvider extends BaseSTTProvider {
  constructor() {
    super('BROWSER_STT');
    this.recognition = null;
    this.latestTranscript = '';
    this.hasFinalized = false;
    this.silenceTimer = null;
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
    }
  }

  isAvailable() {
    return Boolean(this.recognition);
  }

  async start({ onStart, onTranscript, onFinalTranscript, onError, onEnd } = {}) {
    if (!this.recognition) {
      if (onError) onError(new Error('BROWSER_STT_UNAVAILABLE'));
      return false;
    }

    this.latestTranscript = '';
    this.hasFinalized = false;

    // Connect all standard SpeechRecognition events
    this.recognition.onstart = () => {
      this.isListening = true;
      console.log('[VOG] STT_STARTED | Engine: BROWSER_STT | Lang: id-ID');
      if (onStart) onStart();
    };

    this.recognition.onaudiostart = () => {
      console.log('[VOG] AUDIO_STREAM_STARTED');
    };

    this.recognition.onsoundstart = () => {
      console.log('[VOG] SOUND_DETECTED');
    };

    this.recognition.onspeechstart = () => {
      console.log('[VOG] VAD_SPEECH_START');
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

        if (onTranscript) {
          onTranscript(clean, isFinal);
        }

        if (this.silenceTimer) clearTimeout(this.silenceTimer);

        // Auto-finalize after 650ms of silence
        this.silenceTimer = setTimeout(() => {
          if (this.isListening && this.latestTranscript && !this.hasFinalized) {
            console.log(`[VOG] VAD_SPEECH_END | Finalizing transcript: "${this.latestTranscript}"`);
            this.hasFinalized = true;
            const textToDispatch = this.latestTranscript;
            this.stop();
            if (onFinalTranscript) {
              onFinalTranscript(textToDispatch);
            }
          }
        }, 650);
      }
    };

    this.recognition.onspeechend = () => {
      console.log('[VOG] VAD_SPEECH_END');
    };

    this.recognition.onsoundend = () => {
      console.log('[VOG] SOUND_ENDED');
    };

    this.recognition.onaudioend = () => {
      console.log('[VOG] AUDIO_STREAM_ENDED');
    };

    this.recognition.onerror = (event) => {
      const errType = event.error || 'unknown';
      console.warn(`[VOG] STT_ERROR: ${errType}`);

      if (errType === 'network') {
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
        console.warn(`[VOG] STT_NETWORK_ERROR | onlineState: ${isOnline} | Engine: BROWSER_STT | SpeechService cloud unreachable`);
      }

      if (errType !== 'no-speech') {
        this.isListening = false;
        if (this.silenceTimer) clearTimeout(this.silenceTimer);
        if (onError) onError({ error: errType, isNetworkError: errType === 'network' });
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.silenceTimer) clearTimeout(this.silenceTimer);

      const remaining = this.latestTranscript;
      if (remaining && !this.hasFinalized) {
        this.hasFinalized = true;
        if (onFinalTranscript) onFinalTranscript(remaining);
      }
      this.latestTranscript = '';
      console.log('[VOG] STT_END');
      if (onEnd) onEnd();
    };

    try {
      this.recognition.start();
      return true;
    } catch (err) {
      if (err.name === 'InvalidStateError') {
        this.isListening = true;
        return true;
      }
      console.error('[VOG] Browser STT Start Error:', err.message);
      if (onError) onError(err);
      return false;
    }
  }

  stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {}
      this.isListening = false;
    }
  }
}

export default BrowserSTTProvider;
