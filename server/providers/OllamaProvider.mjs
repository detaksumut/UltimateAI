/**
 * OllamaProvider.mjs
 * Local On-Device LLM Adapter via Ollama (OpenAI-compatible endpoint).
 * Zero cloud dependency; used by the Local Router :20200 hybrid routing.
 *
 * Streaming is passed through 1:1 (SSE `choices[].delta.content`), matching
 * the Antigravity provider contract used by /v1/chat/completions.
 */

import { config } from '../config/env.mjs';

export class OllamaProvider {
  constructor() {
    this.name = 'ollama';
    this.baseUrl = (process.env.OLLAMA_BASE_URL || config.endpoints.ollama || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    this.defaultModel = process.env.OLLAMA_MODEL || 'hermes3:8b';
    this._availability = { available: false, checkedAt: 0 };
  }

  isConfigured() {
    return true;
  }

  /**
   * Cached reachability probe against Ollama's model list endpoint.
   * Cache TTL 15s so hot paths (health polling) don't hammer the local daemon.
   */
  async isAvailable() {
    if (Date.now() - this._availability.checkedAt < 15000) {
      return this._availability.available;
    }
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      this._availability = { available: res.ok, checkedAt: Date.now() };
    } catch {
      this._availability = { available: false, checkedAt: Date.now() };
    }
    return this._availability.available;
  }

  async listLocalModels() {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || []).map(m => m.name || m.model || '').filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Maps an upstream model request to an Ollama model. Non-Ollama names
   * (gemini-*, gpt-*, auto, etc.) fall back to the configured local model.
   */
  _resolveModel(model) {
    const clean = String(model || '').replace(/^ollama[\/:]/i, '');
    if (clean && clean !== 'auto' && !/^(gemini-|gpt-|claude-|deepseek-)/i.test(clean)) {
      return clean;
    }
    return this.defaultModel;
  }

  async sendChat({ messages, stream = false, model = 'hermes3:8b', temperature = 0.7 }, onChunk = null) {
    if (!(await this.isAvailable())) {
      throw new Error('OLLAMA_UNAVAILABLE: Ollama server tidak aktif.');
    }

    const resolvedModel = this._resolveModel(model);
    console.log(`[OLLAMA_REQUEST_START] model=${resolvedModel} stream=${stream} messagesCount=${messages.length}`);

    // TTFB (Time to First Byte / Connect) Controller: 45 seconds to allow cold-start model load without long freeze
    const connectAbortController = new AbortController();
    const connectTimeoutId = setTimeout(() => {
      console.error(`[OLLAMA_TIMEOUT] Model load / connect timed out after 45s`);
      connectAbortController.abort(new Error('OLLAMA_CONNECT_TIMEOUT: Waktu tunggu inisialisasi model lokal habis (45s).'));
    }, 45000);

    let response;
    try {
      response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: resolvedModel,
          messages,
          temperature,
          stream: Boolean(stream)
        }),
        signal: connectAbortController.signal
      });
    } catch (err) {
      clearTimeout(connectTimeoutId);
      if (connectAbortController.signal.aborted) {
        console.error(`[OLLAMA_TIMEOUT] ${err.message}`);
        throw new Error(`OLLAMA_TIMEOUT: ${err.message}`);
      }
      console.error(`[OLLAMA_ERROR] Connect failed: ${err.message}`);
      throw err;
    }

    clearTimeout(connectTimeoutId);
    console.log(`[OLLAMA_RESPONSE_HEADERS] status=${response.status}`);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[OLLAMA_ERROR] Upstream returned status ${response.status}: ${errText.slice(0, 200)}`);
      throw new Error(`Ollama Upstream Error (${response.status}): ${errText.slice(0, 300)}`);
    }

    if (stream) {
      console.log(`[OLLAMA_STREAM_START]`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullText = '';
      let buffer = '';
      let chunkIndex = 0;

      // Inactivity timeout: allow long local-model/tool-processing gaps.
      // Abort only after 10 minutes with no upstream data.
      let inactivityTimer = null;
      const resetInactivityTimer = (reject) => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
          console.error(`[OLLAMA_TIMEOUT] Stream stalled: no data received for 600s`);
          reader.cancel().catch(() => {});
        }, 600000);
      };

      try {
        resetInactivityTimer();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          resetInactivityTimer();
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const jsonStr = trimmed.replace(/^data:\s*/, '').trim();
            if (jsonStr === '[DONE]') continue;
            try {
              const json = JSON.parse(jsonStr);
              const token = json.choices?.[0]?.delta?.content || '';
              if (token) {
                fullText += token;
                chunkIndex++;
                if (chunkIndex % 20 === 0) {
                  console.log(`[OLLAMA_DELTA] chunksCount=${chunkIndex} textLen=${fullText.length}`);
                }
                if (onChunk) onChunk(token);
              }
            } catch {
              // Partial / keep-alive lines
            }
          }
        }

        if (inactivityTimer) clearTimeout(inactivityTimer);
        console.log(`[OLLAMA_STREAM_DONE] totalChunks=${chunkIndex} totalChars=${fullText.length}`);
        return fullText;
      } catch (streamErr) {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        console.error(`[OLLAMA_ERROR] Stream reading failed: ${streamErr.message}`);
        throw streamErr;
      }
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log(`[OLLAMA_STREAM_DONE] nonStreamChars=${content.length}`);
    return content;
  }

  async healthCheck() {
    const available = await this.isAvailable();
    return {
      provider: this.name,
      endpoint: this.baseUrl,
      configured: true,
      status: available ? 'READY' : 'OFFLINE',
      model: this.defaultModel
    };
  }
}

export const ollamaProviderInstance = new OllamaProvider();
export default ollamaProviderInstance;
