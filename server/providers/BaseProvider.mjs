/**
 * BaseProvider.mjs
 * Abstract Contract for 9Router AI Provider Adapters.
 */

export class BaseProvider {
  constructor(name) {
    this.name = name;
  }

  isConfigured() {
    throw new Error('Method isConfigured() must be implemented');
  }

  async sendChat({ messages, stream = false, model, temperature = 0.7 }, onChunk = null) {
    throw new Error('Method sendChat() must be implemented');
  }

  async healthCheck() {
    return {
      provider: this.name,
      configured: this.isConfigured(),
      status: this.isConfigured() ? 'READY' : 'UNCONFIGURED'
    };
  }
}

export default BaseProvider;
