/**
 * GroqProvider.mjs
 * Ultra-Fast Cloud Failover Provider for UltimateAI / JIN Runtime.
 * Powered by Groq Cloud (OpenAI-compatible API, >500 token/s).
 *
 * Tier 2 Failover: Groq fires when Gemini Cloud is unavailable.
 * Model: llama-3.3-70b-versatile (default) | llama-3.1-8b-instant (fast)
 * Latency: <0.8s TTFB, zero CPU/RAM load on user machine.
 */

import { BaseProvider } from './BaseProvider.mjs';

export class GroqProvider extends BaseProvider {
  constructor() {
    super('groq');
    this.baseUrl = 'https://api.groq.com/openai/v1';
    this.defaultModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    this._availability = { available: null, checkedAt: 0 };
  }

  _getApiKey() {
    return (process.env.GROQ_API_KEY || '').trim() || null;
  }

  isConfigured() {
    return Boolean(this._getApiKey());
  }

  async isAvailable() {
    const key = this._getApiKey();
    if (!key) return false;

    // Cache TTL 30s
    if (this._availability.available !== null && (Date.now() - this._availability.checkedAt < 30000)) {
      return this._availability.available;
    }

    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${key}` },
        signal: AbortSignal.timeout(4000)
      });
      const ok = res.ok;
      this._availability = { available: ok, checkedAt: Date.now() };
      return ok;
    } catch {
      this._availability = { available: false, checkedAt: Date.now() };
      return false;
    }
  }

  _resolveModel(model) {
    if (!model || model === 'auto' || model.startsWith('ollama') || model.startsWith('hermes')) {
      return this.defaultModel;
    }
    const clean = String(model).trim();
    // Route gemini/openai requests to fast Groq equivalent
    if (clean.startsWith('gemini-') || clean.startsWith('gpt-')) {
      return this.defaultModel;
    }
    if (clean.startsWith('llama')) return clean;
    if (clean.startsWith('mixtral')) return clean;
    return this.defaultModel;
  }

  async sendChat({ messages, stream = false, model = 'auto', temperature = 0.7 }, onChunk = null) {
    const key = this._getApiKey();
    if (!key) {
      throw new Error('GROQ_UNCONFIGURED: GROQ_API_KEY tidak ada di environment.');
    }

    const resolvedModel = this._resolveModel(model);
    const t0 = Date.now();

    const requestBody = {
      model: resolvedModel,
      messages,
      temperature: typeof temperature === 'number' ? temperature : 0.7,
      stream: stream && typeof onChunk === 'function'
    };

    try {
      if (stream && typeof onChunk === 'function') {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(60000)
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          throw new Error(`GROQ_STREAM_ERROR: HTTP ${response.status} - ${errText.slice(0, 200)}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const jsonStr = trimmed.slice(6).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const textChunk = parsed.choices?.[0]?.delta?.content || '';
              if (textChunk) {
                fullText += textChunk;
                onChunk(textChunk);
              }
            } catch {
              // Partial JSON chunk, ignore
            }
          }
        }

        const latencyMs = Date.now() - t0;
        console.log(`[GROQ_STREAM_COMPLETE] model=${resolvedModel} length=${fullText.length} latencyMs=${latencyMs}`);
        return fullText;
      } else {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({ ...requestBody, stream: false }),
          signal: AbortSignal.timeout(45000)
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          throw new Error(`GROQ_HTTP_ERROR: HTTP ${response.status} - ${errText.slice(0, 200)}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '';
        const latencyMs = Date.now() - t0;
        console.log(`[GROQ_COMPLETE] model=${resolvedModel} length=${text.length} latencyMs=${latencyMs}`);
        return text;
      }
    } catch (err) {
      console.error(`[GROQ_ERROR] ${err.message}`);
      throw err;
    }
  }

  async healthCheck() {
    const available = await this.isAvailable();
    return {
      provider: this.name,
      endpoint: this.baseUrl,
      configured: this.isConfigured(),
      status: available ? 'READY' : (this.isConfigured() ? 'UNREACHABLE' : 'NOT_CONFIGURED'),
      model: this.defaultModel
    };
  }
}

export const groqProviderInstance = new GroqProvider();
export default groqProviderInstance;
