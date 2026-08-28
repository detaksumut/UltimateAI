/**
 * STTProvider.js
 * Abstract STT Provider Interface for UltimateAI Voice Engine.
 */

export class BaseSTTProvider {
  constructor(name = 'BASE_STT') {
    this.name = name;
    this.isListening = false;
  }

  isAvailable() {
    return false;
  }

  getProviderName() {
    return this.name;
  }

  async start({ onStart, onTranscript, onFinalTranscript, onError, onEnd } = {}) {
    throw new Error('Method start() must be implemented by subclass');
  }

  stop() {
    throw new Error('Method stop() must be implemented by subclass');
  }
}

export default BaseSTTProvider;
