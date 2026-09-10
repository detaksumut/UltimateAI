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
    this.defaultModel = process.env.OLLAMA_MODEL || 'qwen3:8b';
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

  _generationOptions(model) {
    const configuredNumPredict = Number(process.env.OLLAMA_NUM_PREDICT || 512);
    const numPredict = Number.isFinite(configuredNumPredict) && configuredNumPredict > 0
      ? Math.floor(configuredNumPredict)
      : 512;
    const thinkingDisabled = String(process.env.OLLAMA_THINK || 'false').toLowerCase() !== 'true';
    return {
      think: thinkingDisabled ? false : undefined,
      num_predict: numPredict
    };
  }

  async sendChat({ messages, stream = false, model = 'qwen3:8b', temperature = 0.7 }, onChunk = null) {
    if (!(await this.isAvailable())) {
      throw new Error('OLLAMA_UNAVAILABLE: Ollama server tidak aktif. Pastikan Ollama berjalan di http://127.0.0.1:11434');
    }

    const resolvedModel = this._resolveModel(model);

    // PRE-FLIGHT MODEL CHECK: Verify model is actually downloaded before attempting load
    // This prevents the 120s hang if the model doesn't exist locally
    try {
      const localModels = await this.listLocalModels();
      const modelBase = resolvedModel.split(':')[0];
      const modelExists = localModels.some(m => {
        const mBase = m.split(':')[0];
        return m === resolvedModel || mBase === modelBase;
      });

      if (!modelExists) {
        const availableList = localModels.length > 0 ? localModels.slice(0, 5).join(', ') : '(kosong)';
        throw new Error(
          `OLLAMA_MODEL_NOT_FOUND: Model "${resolvedModel}" belum diunduh. ` +
          `Jalankan: ollama pull ${resolvedModel} | ` +
          `Model tersedia: ${availableList}`
        );
      }
    } catch (checkErr) {
      if (checkErr.message.startsWith('OLLAMA_MODEL_NOT_FOUND')) throw checkErr;
      // If list fails but Ollama is up, proceed anyway (tags endpoint might be limited)
      console.warn(`[OLLAMA_PREFLIGHT] Could not verify model list: ${checkErr.message}. Proceeding...`);
    }

    console.log(`[OLLAMA_REQUEST_START] model=${resolvedModel} stream=${stream} messagesCount=${messages.length}`);

    // Retry logic: up to 2 retries on timeout
    const maxRetries = 2;
    let lastError = null;
    let response = null;
    const generationOptions = this._generationOptions(resolvedModel);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`[OLLAMA_RETRY] Attempt ${attempt}/${maxRetries} after timeout...`);
        await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
      }

      // TTFB (Time to First Byte / Connect) Controller: 180 seconds to allow cold-start model load
      const connectAbortController = new AbortController();
      const connectTimeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS || '180000', 10);
      const connectTimeoutId = setTimeout(() => {
        console.error(`[OLLAMA_TIMEOUT] Model load / connect timed out after ${connectTimeoutMs}ms (attempt ${attempt + 1})`);
        connectAbortController.abort(new Error(`OLLAMA_CONNECT_TIMEOUT: Waktu tunggu inisialisasi model lokal habis (${Math.round(connectTimeoutMs/1000)}s).`));
      }, connectTimeoutMs);

      try {
        response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: resolvedModel,
            messages,
            temperature,
            stream: Boolean(stream),
            keep_alive: '24h',
            think: generationOptions.think,
            max_tokens: generationOptions.num_predict,
            options: generationOptions
          }),
          signal: connectAbortController.signal
        });
        clearTimeout(connectTimeoutId);

        if (!response.ok) {
          const errText = await response.text();
          console.error(`[OLLAMA_ERROR] Upstream returned status ${response.status}: ${errText.slice(0, 200)}`);
          throw new Error(`Ollama Upstream Error (${response.status}): ${errText.slice(0, 300)}`);
        }

        // Success — break out of retry loop
        lastError = null;
        console.log(`[OLLAMA_RESPONSE_HEADERS] status=${response.status}`);
        break;
      } catch (err) {
        clearTimeout(connectTimeoutId);
        lastError = err;

        if (connectAbortController.signal.aborted && err.message?.includes('OLLAMA_CONNECT_TIMEOUT')) {
          console.warn(`[OLLAMA_TIMEOUT] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${err.message}`);
          if (attempt < maxRetries) continue; // Retry
        }

        // Non-timeout error — throw immediately
        if (err.message?.startsWith('Ollama Upstream Error')) throw err;
        console.error(`[OLLAMA_ERROR] Connect failed: ${err.message}`);
        throw err;
      }
    }

    // If all retries failed with timeout
    if (lastError) {
      throw new Error(`OLLAMA_TIMEOUT: Semua ${maxRetries + 1} percobaan gagal. Model mungkin sedang cold-start atau server under load.`);
    }
    if (!response) {
      throw new Error('OLLAMA_NO_RESPONSE: Ollama tidak mengembalikan response setelah request selesai.');
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
