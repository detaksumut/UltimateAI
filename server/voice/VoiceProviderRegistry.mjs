/**
 * VoiceProviderRegistry.mjs
 * Multi-Provider Voice Abstraction for JIN Voice Engine.
 * 
 * SPECIFICATION COMPLIANCE:
 * 1. NEURAL_INDONESIAN_TTS is the PRIMARY voice provider.
 * 2. Browser speechSynthesis is demoted to optional fallback only.
 */

import { BaseVoiceProvider } from './BaseVoiceProvider.mjs';
import { NeuralIndonesianTTSProvider, neuralIndonesianTTSProviderInstance } from './NeuralIndonesianTTSProvider.mjs';

export { NeuralIndonesianTTSProvider };

export class BrowserSynthesisProvider extends BaseVoiceProvider {
  constructor() {
    super('browser-synthesis');
  }

  isConfigured() {
    return false; // Disabled as primary
  }

  async synthesizeSpeech({ text }) {
    return {
      provider: 'browser-synthesis',
      format: 'web-speech-api',
      textPreview: text.substring(0, 50)
    };
  }
}

export class VoiceProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.register(neuralIndonesianTTSProviderInstance);
    this.register(new BrowserSynthesisProvider());
  }

  register(provider) {
    this.providers.set(provider.name, provider);
  }

  get(name) {
    return this.providers.get(name);
  }

  getPrimaryProvider() {
    return this.get('NEURAL_INDONESIAN_TTS') || neuralIndonesianTTSProviderInstance;
  }

  getActiveVoiceMode() {
    const primary = this.getPrimaryProvider();
    if (primary && primary.isConfigured()) {
      return 'NEURAL_INDONESIAN_TTS';
    }
    return 'TTS_NEURAL_UNAVAILABLE';
  }
}

export const voiceProviderRegistryInstance = new VoiceProviderRegistry();
export default voiceProviderRegistryInstance;
