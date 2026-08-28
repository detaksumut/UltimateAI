/**
 * TextToSpeech.js (Neural Indonesian Edition)
 *
 * SPECIFICATION COMPLIANCE:
 * 1. Primary Engine: NeuralIndonesianTTSProvider with Speaker Conditioning.
 * 2. Browser speechSynthesis: Demoted to emergency backup (disabled by default).
 * 3. SpeechRenderer: Converts rich markdown and complex data into conversational Indonesian.
 * 4. JinAudioQueue: Sentence-based queuing, Web Audio playback, and instant barge-in with context preservation.
 * 5. Full observability: State streaming to Control Center HUD.
 */

import { neuralIndonesianTTSProviderInstance } from './NeuralIndonesianTTSProvider.js';
import { speechRendererInstance } from './SpeechRenderer.js';
import { jinAudioQueueInstance } from './JinAudioQueue.js';
import { indonesianTextNormalizerInstance } from './IndonesianTextNormalizer.js';

export class TextToSpeech {
  constructor() {
    this.neuralProvider = neuralIndonesianTTSProviderInstance;
    this.speechRenderer = speechRendererInstance;
    this.audioQueue = jinAudioQueueInstance;
    this.normalizer = indonesianTextNormalizerInstance;

    // State mirror for Control Center
    this.state = {
      provider: 'NEURAL_INDONESIAN_TTS',
      language: 'id-ID',
      speaker: this.neuralProvider.defaultSpeaker,
      rate: this.neuralProvider.rate,
      pitch: this.neuralProvider.pitch,
      queueLength: 0,
      playing: false,
      interrupted: false,
      voiceReferenceConfigured: Boolean(this.neuralProvider.audioPromptPath),
      status: 'READY'
    };

    // Forward queue state to subscribers
    this.audioQueue.subscribe((queueState) => {
      this.state.playing = queueState.isPlaying;
      this.state.interrupted = queueState.isInterrupted;
      this.state.queueLength = queueState.queueLength;
      this.state.status = queueState.isPlaying
        ? 'SPEAKING'
        : queueState.isInterrupted
          ? 'INTERRUPTED'
          : 'READY';
      this._notifyListeners();
    });

    this.stateListeners = new Set();
  }

  subscribeState(listener) {
    this.stateListeners.add(listener);
    // Immediately emit current state
    try { listener({ ...this.state }); } catch {}
    return () => this.stateListeners.delete(listener);
  }

  _notifyListeners() {
    for (const l of this.stateListeners) {
      try { l({ ...this.state }); } catch {}
    }
  }

  get isPlaying() {
    return this.audioQueue.isPlaying;
  }

  /**
   * Primary Speak Method: Uses Neural TTS + SpeechRenderer + JinAudioQueue
   * @param {string} text - Raw JIN response text
   * @param {Object} options - { onStart, onEnd, onError, taskContext }
   */
  speak(text, options = {}) {
    if (!text || !text.trim()) {
      if (options.onEnd) options.onEnd();
      return;
    }

    console.log(`[TTS] 🎙️ Synthesizing Neural Indonesian Speech | Text Length: ${text.length} chars`);
    return this.audioQueue.speak(text, options);
  }

  /**
   * Instant Human Barge-In
   */
  stop() {
    this.audioQueue.stop();
  }

  cancel() {
    this.audioQueue.cancel();
  }

  /**
   * Resume playback of preserved context on "Lanjutkan"
   */
  resume(callbacks = {}) {
    return this.audioQueue.resume(callbacks);
  }

  hasResidualContext() {
    return this.audioQueue.hasResidualContext();
  }

  setAudioPrompt(promptPath) {
    this.neuralProvider.setAudioPrompt(promptPath);
    this.state.voiceReferenceConfigured = Boolean(promptPath);
    this._notifyListeners();
  }

  getDiagnostics() {
    return {
      engineType: 'NEURAL_INDONESIAN_TTS',
      provider: 'NEURAL_INDONESIAN_TTS',
      language: this.state.language,
      speaker: this.state.speaker,
      rate: this.state.rate,
      pitch: this.state.pitch,
      audioPromptConfigured: this.state.voiceReferenceConfigured,
      queueLength: this.state.queueLength,
      isPlaying: this.state.playing,
      status: this.state.status
    };
  }

  testVoiceAudio() {
    this.speak('Halo, saya JIN. Sistem suara neural bahasa Indonesia aktif dan siap melayani Anda.');
  }
}

export const textToSpeechInstance = new TextToSpeech();
export default textToSpeechInstance;
