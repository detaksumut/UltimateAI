/**
 * SpeechToText.js (Enterprise Resilient Hybrid STT Coordinator)
 * 
 * SPECIFICATION COMPLIANCE:
 * 1. Default Primary Provider: LOCAL_BACKEND_STT (MediaRecorder + Local VAD + LocalRouter /api/voice/transcribe).
 * 2. Secondary Provider: BROWSER_STT (Web Speech API with id-ID).
 * 3. Complete Telemetry:
 *    [VOG] MIC_STARTED
 *    [VOG] VAD_SPEECH_START
 *    [VOG] VAD_SPEECH_END
 *    [VOG] STT_STARTED
 *    [VOG] STT_RESULT
 *    [VOG] TRANSCRIPT_FINAL
 *    [VOG] AGENT_INPUT_RECEIVED
 *    [VOG] JIN_RESPONSE_RECEIVED
 * 4. Never remains stuck in LISTENING on empty result or failure.
 */

import { BrowserSTTProvider } from './BrowserSTTProvider.js';
import { LocalBackendSTTProvider } from './LocalBackendSTTProvider.js';

export class SpeechToText {
  constructor() {
    this.browserProvider = new BrowserSTTProvider();
    this.localProvider = new LocalBackendSTTProvider();
    // Default to LOCAL_BACKEND_STT as primary because Web Speech API in Chrome on localhost silently drops hypotheses
    this.activeProviderName = 'LOCAL_BACKEND_STT';
    this.isListening = false;
    this.callbacks = null;
  }

  isAvailable() {
    return this.localProvider.isAvailable() || this.browserProvider.isAvailable();
  }

  getActiveProvider() {
    if (this.activeProviderName === 'LOCAL_BACKEND_STT') {
      return this.localProvider;
    }
    if (this.activeProviderName === 'BROWSER_STT') {
      return this.browserProvider;
    }
    return this.localProvider.isAvailable() ? this.localProvider : this.browserProvider;
  }

  setProvider(providerName) {
    if (['BROWSER_STT', 'LOCAL_BACKEND_STT'].includes(providerName)) {
      this.activeProviderName = providerName;
      console.log(`[VOG] STT Provider explicitly set to: ${providerName}`);
    }
  }

  getProviderName() {
    return this.getActiveProvider().getProviderName();
  }

  async verifyMicrophonePermission() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      console.warn('[VOG] MediaDevices API not available in headless environment');
      return true;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = stream.getAudioTracks()[0];
      console.log(`[VOG] MIC_PERMISSION: GRANTED | MIC_TRACK_STATE: ${track?.readyState || 'live'}`);
      return true;
    } catch (err) {
      console.error('[VOG] MIC_PERMISSION_DENIED:', err.message);
      return false;
    }
  }

  async startListening(callbacks = {}) {
    this.callbacks = callbacks;
    this.isListening = true;

    await this.verifyMicrophonePermission();

    const currentProvider = this.getActiveProvider();
    console.log(`[VOG] STT_STARTED | Engine: ${currentProvider.getProviderName()} | Lang: id-ID`);

    const providerCallbacks = {
      onStart: () => {
        if (callbacks.onStart) callbacks.onStart();
      },
      onTranscript: (text, isFinal) => {
        if (callbacks.onResult) callbacks.onResult(text, isFinal);
        if (callbacks.onTranscript) callbacks.onTranscript(text, isFinal);
      },
      onFinalTranscript: (finalText) => {
        this.isListening = false;
        if (finalText && finalText.trim()) {
          const cleanText = finalText.trim();
          console.log(`[VOG] TRANSCRIPT_FINAL: "${cleanText}"`);
          console.log(`[VOG] AGENT_INPUT_RECEIVED: "${cleanText}"`);
          if (callbacks.onFinalTranscript) callbacks.onFinalTranscript(cleanText);
          if (callbacks.onEnd) callbacks.onEnd(cleanText);
        } else {
          console.warn('[VOG] STT_NO_RESULT: No speech transcript generated');
          if (callbacks.onEnd) callbacks.onEnd('');
        }
      },
      onError: async (err) => {
        console.warn(`[VOG] STT error on ${currentProvider.getProviderName()}:`, err?.message || err);

        // Failover if Browser STT fails
        if (currentProvider.getProviderName() === 'BROWSER_STT' && this.localProvider.isAvailable()) {
          console.log('[VOG] Switching to LOCAL_BACKEND_STT fallback...');
          this.activeProviderName = 'LOCAL_BACKEND_STT';
          return this.localProvider.start(providerCallbacks);
        }

        this.isListening = false;
        if (callbacks.onError) callbacks.onError(err);
      },
      onEnd: () => {
        this.isListening = false;
        if (callbacks.onEnd) callbacks.onEnd();
      }
    };

    return currentProvider.start(providerCallbacks);
  }

  stopListening() {
    this.isListening = false;
    if (this.browserProvider.isListening) {
      this.browserProvider.stop();
    }
    if (this.localProvider.isListening) {
      this.localProvider.stop();
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
