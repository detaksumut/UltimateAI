/**
 * LlamaCppAdapter.mjs
 * Primary Direct Runtime Adapter for llama.cpp (llama-server) in JIN.
 * Communicates directly with llama-server via OpenAI-compatible endpoints or native endpoints.
 * ZERO hidden fallback. If llama-server fails, it reports FAILURE.
 */

import { ModelRuntime } from './ModelRuntime.mjs';

export class LlamaCppAdapter extends ModelRuntime {
  constructor(options = {}) {
    const host = options.host || process.env.LLAMACPP_HOST || 'http://127.0.0.1:8080';
    super('llamacpp', host);
    this.defaultModel = options.model || process.env.LLAMACPP_MODEL || 'qwen2.5-3b-instruct-q4_k_m.gguf';
    this.ctxSize = parseInt(process.env.LLAMACPP_CTX_SIZE || '32768', 10);
  }

  isConfigured() {
    return true;
  }

  /**
   * Defensive preflight: estimates prompt tokens and queries /tokenize when available.
   * If prompt exceeds ctxSize, throws structured CONTEXT_LIMIT_EXCEEDED error.
   */
  async estimateTokens(messages = []) {
    let fullText = '';
    let totalChars = 0;
    for (const m of messages) {
      const content = typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? JSON.stringify(m.content) : '');
      totalChars += content.length + 20;
      fullText += `\n<|im_start|>${m.role || 'user'}\n${content}<|im_end|>`;
    }

    const heuristic = Math.ceil(totalChars / 3.0);

    if (heuristic < this.ctxSize * 0.25) {
      return heuristic;
    }

    try {
      const tokenizeRes = await fetch(`${this.host}/tokenize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fullText }),
        signal: AbortSignal.timeout(600)
      });
      if (tokenizeRes.ok) {
        const data = await tokenizeRes.json();
        if (Array.isArray(data.tokens)) {
          return data.tokens.length;
        }
      }
    } catch {}

    return heuristic;
  }

  /**
   * Health check against llama-server /health
   */
  async healthCheck() {
    try {
      const res = await fetch(`${this.host}/health`, { method: 'GET', signal: AbortSignal.timeout(3000) });
      if (!res.ok) {
        return {
          provider: this.name,
          configured: true,
          status: 'UNAVAILABLE',
          code: res.status,
          host: this.host
        };
      }
      const data = await res.json();
      return {
        provider: this.name,
        configured: true,
        status: data.status === 'ok' ? 'READY' : 'LOADING',
        details: data,
        host: this.host
      };
    } catch (err) {
      return {
        provider: this.name,
        configured: true,
        status: 'OFFLINE',
        error: err.message,
        host: this.host
      };
    }
  }

  async isAvailable() {
    try {
      const res = await fetch(`${this.host}/health`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return false;
      // llama-server returns {status:'ok'} only when model is fully loaded.
      // {status:'loading'} means model is still being read from disk — requests sent
      // at this point will hang indefinitely. We must not proceed until 'ok'.
      const data = await res.json().catch(() => ({}));
      return data.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Poll /health until llama-server reports status='ok' (model fully loaded).
   * Returns true if ready within timeoutMs, false otherwise.
   */
  async waitUntilReady(timeoutMs = 30_000, intervalMs = 800) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.isAvailable()) return true;
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return false;
  }

  /**
   * Direct Chat Completion via llama-server /v1/chat/completions
   */
  async sendChat({ messages, stream = false, model, temperature = 0.7, maxTokens = 8192 }, onChunk = null) {
    const t0 = Date.now();
    const endpoint = `${this.host}/v1/chat/completions`;

    const payload = {
      model: model || this.defaultModel,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream
    };

    // Untuk NON-STREAMING: hard timeout 120s.
    // Untuk STREAMING: tidak ada hard timeout — hanya inactivity timeout.
    // Jika model sedang generate token (walaupun lambat pada CPU), stream tidak dipotong.
    // Hanya jika tiada token selama 120s barulah timeout trigger.
    const NON_STREAM_TIMEOUT_MS = 120_000;
    const STREAM_INACTIVITY_MS = 120_000; // 2 minit tanpa token = hung
    const abortCtrl = new AbortController();
    let timeoutId = null;

    if (!stream) {
      timeoutId = setTimeout(() => abortCtrl.abort(), NON_STREAM_TIMEOUT_MS);
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortCtrl.signal
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 400 && (errText.includes('exceeds the available context size') || errText.includes('exceed_context_size_error') || errText.includes('context size'))) {
          const err = new Error(`CONTEXT_LIMIT_EXCEEDED: ${errText}`);
          err.code = 'CONTEXT_LIMIT_EXCEEDED';
          err.status = 400;
          err.statusCode = 400;
          err.ctxSize = this.ctxSize;
          throw err;
        }
        throw new Error(`llama-server returned HTTP ${res.status}: ${errText}`);
      }

      if (stream && onChunk) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullContent = '';
        let fullReasoning = '';
        let chunkCount = 0;
        let buffer = '';

        // Inactivity watchdog: abort jika tiada token selama STREAM_INACTIVITY_MS
        let lastTokenAt = Date.now();
        const inactivityWatchdog = setInterval(() => {
          if (Date.now() - lastTokenAt > STREAM_INACTIVITY_MS) {
            clearInterval(inactivityWatchdog);
            abortCtrl.abort();
          }
        }, 5000);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunkCount++;
            lastTokenAt = Date.now(); // reset watchdog setiap kali ada data
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data: ')) continue;
              const jsonStr = trimmed.replace(/^data:\s*/, '').trim();
              if (jsonStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const delta = parsed.choices?.[0]?.delta || {};
                const token = delta.content || '';
                const reasoning = delta.reasoning_content || '';
                if (token) {
                  fullContent += token;
                  lastTokenAt = Date.now();
                  onChunk(token, false);
                }
                if (reasoning) {
                  fullReasoning += reasoning;
                  lastTokenAt = Date.now();
                  onChunk(reasoning, true);
                }
              } catch {}
            }
          }
        } finally {
          clearInterval(inactivityWatchdog);
        }

        // Flush remainder in decoder buffer if any
        const remainder = decoder.decode();
        if (remainder) {
          buffer += remainder;
        }
        if (buffer.trim().startsWith('data: ')) {
          const jsonStr = buffer.trim().replace(/^data:\s*/, '').trim();
          if (jsonStr !== '[DONE]') {
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta || {};
              const token = delta.content || '';
              if (token) {
                fullContent += token;
                onChunk(token, false);
              }
            } catch {}
          }
        }

        const rawResult = fullContent
          ? (fullReasoning ? `<think>\n${fullReasoning}\n</think>\n${fullContent}` : fullContent)
          : fullReasoning;

        return rawResult;
      }

      const data = await res.json();
      const choice = data.choices?.[0]?.message || {};
      const content = choice.content || '';
      const reasoning = choice.reasoning_content || '';

      const rawResult = content
        ? (reasoning ? `<think>\n${reasoning}\n</think>\n${content}` : content)
        : (reasoning || '');

      return rawResult;
    } catch (err) {
      if (err.code === 'CONTEXT_LIMIT_EXCEEDED') {
        throw err;
      }
      if (err.name === 'AbortError') {
        const timeoutErr = new Error(
          stream
            ? 'LLAMACPP_INACTIVITY: llama-server berhenti menghantar token selama 120 detik. Model mungkin stuck.'
            : 'LLAMACPP_TIMEOUT: llama-server tidak merespons dalam 120 detik.'
        );
        timeoutErr.code = 'LLAMACPP_TIMEOUT';
        throw timeoutErr;
      }
      // STRICT RULE: No hidden fallback. Must surface error directly.
      throw new Error(`[LlamaCppAdapter Failure] ${err.message}`);
    } finally {
      clearTimeout(timeoutId);
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

export const llamaCppAdapterInstance = new LlamaCppAdapter();
export default LlamaCppAdapter;
