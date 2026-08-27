/**
 * EdgeTTSProvider.mjs & VoiceProviderRegistry.mjs
 * Multi-Provider Voice Abstraction for JIN Voice Engine.
 */

import { BaseVoiceProvider } from './BaseVoiceProvider.mjs';

export class EdgeTTSProvider extends BaseVoiceProvider {
  constructor() {
    super('edge-neural');
    this.defaultVoice = 'id-ID-ArdiNeural'; // Authoritative, warm, Indonesian neural male voice
  }

  isConfigured() {
    return true; // Edge TTS endpoint available publicly via Microsoft cognitive WebSocket/REST
  }

  async synthesizeSpeech({ text, voice }) {
    // Returns neural voice stream metadata
    return {
      provider: 'edge-neural',
      voice: voice || this.defaultVoice,
      format: 'audio/mp3',
      textPreview: text.substring(0, 50)
    };
  }
}

export class BrowserSynthesisProvider extends BaseVoiceProvider {
  constructor() {
    super('browser-synthesis');
  }

  isConfigured() {
    return true;
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
    this.register(new BrowserSynthesisProvider());
    this.register(new EdgeTTSProvider());
  }

  register(provider) {
    this.providers.set(provider.name, provider);
  }

  get(name) {
    return this.providers.get(name);
  }

  getActiveVoiceMode() {
    if (this.get('edge-neural')?.isConfigured()) {
      return 'EDGE_NEURAL';
    }
    return 'BROWSER_SYNTHESIS';
  }
}

export const voiceProviderRegistryInstance = new VoiceProviderRegistry();
export default voiceProviderRegistryInstance;
