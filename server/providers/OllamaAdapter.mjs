/**
 * OllamaAdapter.mjs
 * Legacy / Comparison Runtime Adapter for Ollama (:11434).
 * OUT OF PATH for primary JIN benchmark runs.
 * Marked as legacy, never used as silent fallback.
 */

import { ModelRuntime } from './ModelRuntime.mjs';

export class OllamaAdapter extends ModelRuntime {
  constructor(options = {}) {
    const host = options.host || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
    super('ollama', host);
    this.isLegacy = true;
    this.defaultModel = options.model || 'hermes3:8b';
  }

  isConfigured() {
    return true;
  }

  async healthCheck() {
    try {
      const res = await fetch(`${this.host}/api/tags`, { method: 'GET', signal: AbortSignal.timeout(3000) });
      if (!res.ok) {
        return { provider: this.name, isLegacy: true, status: 'UNAVAILABLE', code: res.status };
      }
      const data = await res.json();
      return {
        provider: this.name,
        isLegacy: true,
        status: 'READY',
        models: (data.models || []).map(m => m.name),
        host: this.host
      };
    } catch (err) {
      return { provider: this.name, isLegacy: true, status: 'OFFLINE', error: err.message, host: this.host };
    }
  }

  async sendChat({ messages, stream = false, model, temperature = 0.0, maxTokens = 512 }, onChunk = null) {
    const t0 = Date.now();
    const endpoint = `${this.host}/api/chat`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || this.defaultModel,
          messages,
          stream,
          options: {
            temperature,
            num_predict: maxTokens
          }
        })
      });

      if (!res.ok) {
        throw new Error(`Ollama returned HTTP ${res.status}`);
      }

      if (stream && onChunk) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          const lines = text.split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              const token = parsed.message?.content || '';
              if (token) {
                fullText += token;
                onChunk(token, false);
              }
            } catch {}
          }
        }
        return { success: true, provider: 'ollama', isLegacy: true, content: fullText, durationMs: Date.now() - t0 };
      }

      const data = await res.json();
      return {
        success: true,
        provider: 'ollama',
        isLegacy: true,
        content: data.message?.content || '',
        durationMs: Date.now() - t0
      };
    } catch (err) {
      return {
        success: false,
        provider: 'ollama',
        isLegacy: true,
        error: `[Ollama Failure] ${err.message}`,
        durationMs: Date.now() - t0
      };
    }
  }

  async generate(params, onChunk = null) {
    let messages = params.messages;
    if (!messages && params.prompt) {
      messages = [];
      if (params.systemPrompt) {
        messages.push({ role: 'system', content: params.systemPrompt });
      }
      messages.push({ role: 'user', content: params.prompt });
    }
    return this.sendChat({ ...params, messages }, onChunk);
  }
}

export default OllamaAdapter;
