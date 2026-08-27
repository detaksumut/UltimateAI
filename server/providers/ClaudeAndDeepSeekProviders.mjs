/**
 * ClaudeProvider.mjs & DeepSeekProvider.mjs
 * Native Anthropic & DeepSeek Adapters for 9Router.
 */

import { BaseProvider } from './BaseProvider.mjs';
import { config } from '../config/env.mjs';

export class ClaudeProvider extends BaseProvider {
  constructor() {
    super('claude');
    this.apiKey = config.keys.claude;
    this.baseUrl = config.endpoints.claude;
  }

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 10);
  }

  async sendChat({ messages, stream = false, model = 'claude-3-5-sonnet-20241022', temperature = 0.7 }, onChunk = null) {
    if (!this.isConfigured()) {
      throw new Error('Claude API key is not configured in server environment.');
    }

    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const userMessages = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role,
      content: m.content
    }));

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: systemMessage,
        messages: userMessages,
        temperature
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude Upstream Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }
}

export class DeepSeekProvider extends BaseProvider {
  constructor() {
    super('deepseek');
    this.apiKey = config.keys.deepseek;
    this.baseUrl = config.endpoints.deepseek;
  }

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 10);
  }

  async sendChat({ messages, stream = false, model = 'deepseek-reasoner', temperature = 0.2 }, onChunk = null) {
    if (!this.isConfigured()) {
      throw new Error('DeepSeek API key is not configured in server environment.');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: false
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`DeepSeek Upstream Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
}
