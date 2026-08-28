/**
 * SpeechToText.js (Enterprise Resilient Hybrid STT Coordinator)
 * 
 * SPECIFICATION COMPLIANCE:
 * 1. Hybrid STT Strategy: BrowserSTTProvider with automated fallback to LocalBackendSTTProvider on STT_NETWORK_ERROR.
 * 2. Real-time logging: MIC_STARTED, VAD_SPEECH_START, VAD_SPEECH_END, STT_STARTED, STT_RESULT, AGENT_INPUT_RECEIVED.
 * 3. Never remains visually stuck in LISTENING on error.
 * 4. Delivers real Indonesian transcript to AgentRuntime.
 */

import { BrowserSTTProvider } from './BrowserSTTProvider.js';
import { LocalBackendSTTProvider } from './LocalBackendSTTProvider.js';

export class SpeechToText {
  constructor() {
    this.browserProvider = new BrowserSTTProvider();
    this.localProvider = new LocalBackendSTTProvider();
    this.activeProviderName = 'BROWSER_STT';
    this.isListening = false;
    this.callbacks = null;
  }

  isAvailable() {
    return this.browserProvider.isAvailable() || this.localProvider.isAvailable();
  }

  getActiveProvider() {
    if (this.activeProviderName === 'LOCAL_BACKEND_STT') {
      return this.localProvider;
    }
    return this.browserProvider.isAvailable() ? this.browserProvider : this.localProvider;
  }

  setProvider(providerName) {
    if (['BROWSER_STT', 'LOCAL_BACKEND_STT'].includes(providerName)) {
      this.activeProviderName = providerName;
      console.log(`[VOG] STT Provider manually set to: ${providerName}`);
    }
  }

  async verifyMicrophonePermission() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      console.warn('[VOG] MediaDevices API not available');
      return true;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = stream.getAudioTracks()[0];
      console.log(`[VOG] MIC_PERMISSION: GRANTED | MIC_TRACK_STATE: ${track?.readyState || 'live'}`);
      // Keep track open or release properly
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
          console.log(`[VOG] AGENT_INPUT_RECEIVED: "${finalText.trim()}"`);
          if (callbacks.onFinalTranscript) callbacks.onFinalTranscript(finalText.trim());
          if (callbacks.onEnd) callbacks.onEnd(finalText.trim());
        } else {
          if (callbacks.onEnd) callbacks.onEnd('');
        }
      },
      onError: async (err) => {
        console.warn(`[VOG] STT Provider error on ${currentProvider.getProviderName()}:`, err);

        // Automated fallback: If Browser STT fails with network error, switch to LocalBackendSTT!
        if (currentProvider.getProviderName() === 'BROWSER_STT' && (err.isNetworkError || err.error === 'network')) {
          console.log('[VOG] ⚡ STT_NETWORK_ERROR detected! Switching seamlessly to LOCAL_BACKEND_STT fallback...');
          this.activeProviderName = 'LOCAL_BACKEND_STT';
          
          if (this.localProvider.isAvailable()) {
            return this.localProvider.start(providerCallbacks);
          }
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
