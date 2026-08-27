/**
 * GeminiProvider.mjs
 * Google Gemini 2.0 Native Adapter with upstream streaming support.
 */

import { BaseProvider } from './BaseProvider.mjs';
import { config } from '../config/env.mjs';

export class GeminiProvider extends BaseProvider {
  constructor() {
    super('gemini');
    this.apiKey = config.keys.gemini;
    this.baseUrl = config.endpoints.gemini;
  }

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 10);
  }

  async sendChat({ messages, stream = false, model = 'gemini-2.5-flash', temperature = 0.7 }, onChunk = null) {
    if (!this.isConfigured()) {
      throw new Error('Gemini API key is not configured in server environment.');
    }

    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    const systemInstruction = messages.find(m => m.role === 'system')?.content || '';

    const payload = {
      contents,
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: 2048
      }
    };

    if (systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    if (stream) {
      const url = `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini Upstream Error (${response.status}): ${errText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        const lines = chunkText.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.substring(6));
              const token = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
      const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini Upstream Error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
  }
}

export default GeminiProvider;
