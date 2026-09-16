/**
 * ModelRuntime.mjs
 * Base Abstract Contract for Local Model Inference Runtimes in JIN.
 * Strictly forbids hidden fallback or silent provider switching.
 */

import { BaseProvider } from './BaseProvider.mjs';

export class ModelRuntime extends BaseProvider {
  constructor(name, host) {
    super(name);
    this.host = host;
  }

  /**
   * Abstract inference method.
   * Must return raw output directly from the engine.
   */
  async generate({ prompt, messages, systemPrompt, temperature = 0.0, maxTokens = 512, stream = false }, onChunk = null) {
    throw new Error(`Method generate() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Health check endpoint.
   */
  async healthCheck() {
    throw new Error(`Method healthCheck() must be implemented by ${this.constructor.name}`);
  }
}

export default ModelRuntime;
