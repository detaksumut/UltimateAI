/**
 * OpenAIProvider.mjs
 * OpenAI / OpenRouter / Groq Compatible Adapter with upstream streaming.
 */

import { BaseProvider } from './BaseProvider.mjs';
import { config } from '../config/env.mjs';

export class OpenAIProvider extends BaseProvider {
  constructor() {
    super('openai');
    this.apiKey = config.keys.openai;
    this.baseUrl = config.endpoints.openai;
  }

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 10);
  }

  async sendChat({ messages, stream = false, model = 'gpt-4o-mini', temperature = 0.7 }, onChunk = null) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key is not configured in server environment.');
    }

    const payload = {
      model,
      messages,
      temperature,
      stream
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI Upstream Error (${response.status}): ${errText}`);
    }

    if (stream) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        const lines = chunkText.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try {
              const json = JSON.parse(line.substring(6));
              const token = json.choices?.[0]?.delta?.content || '';
              if (token) {
                fullText += token;
                if (onChunk) onChunk(token);
              }
            } catch {
              // Partial line
            }
          }
        }
      }

      return fullText;
    } else {
      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    }
  }
}

export default OpenAIProvider;
