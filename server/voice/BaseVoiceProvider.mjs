/**
 * BaseVoiceProvider.mjs
 * Abstract contract for 9Router Neural Voice Providers.
 */

export class BaseVoiceProvider {
  constructor(name) {
    this.name = name;
  }

  isConfigured() {
    throw new Error('Method isConfigured() must be implemented');
  }

  async synthesizeSpeech({ text, voice, rate = 1.0, pitch = 1.0 }) {
    throw new Error('Method synthesizeSpeech() must be implemented');
  }
}

export default BaseVoiceProvider;
