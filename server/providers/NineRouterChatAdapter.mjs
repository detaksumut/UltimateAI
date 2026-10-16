/**
 * NineRouterChatAdapter.mjs
 * Chat Inference Adapter for 9Router Gateway (http://127.0.0.1:20128).
 *
 * Replaces LlamaCppAdapter as the LOCAL/FAST inference backend.
 * Uses the OpenAI-compatible /v1/chat/completions endpoint exposed by 9Router.
 *
 * STRICT POLICY:
 *  - Zero silent / hidden fallback.
 *  - If 9Router is unavailable, the error is surfaced directly to the caller.
 */

import { ModelRuntime } from './ModelRuntime.mjs';

const NON_STREAM_TIMEOUT_MS = 120_000;
const STREAM_INACTIVITY_MS  = 120_000;
const HEALTH_TIMEOUT_MS     = 5_000;

export class NineRouterChatAdapter extends ModelRuntime {
  constructor(options = {}) {
    const host = options.host || process.env.NINEROUTER_URL || 'http://127.0.0.1:20128';
    super('ninerouter', host);
    this.defaultModel = options.model || process.env.NINEROUTER_CHAT_MODEL || 'auto';
  }

  isConfigured() { return true; }

  _baseHeaders() {
    const key = String(process.env.NINEROUTER_KEY || '').trim();
    const hdrs = { 'Content-Type': 'application/json' };
    if (key && key.length > 0 && !['NINEROUTER_KEY_ANDA', 'YOUR_NINEROUTER_KEY'].includes(key)) {
      hdrs['Authorization'] = `Bearer ${key}`;
    }
    return hdrs;
  }

  async healthCheck() {
    try {
      const res = await fetch(`${this.host}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS)
      });
      return {
        provider: this.name, configured: true,
        status: res.ok ? 'READY' : 'UNAVAILABLE',
        code: res.status, host: this.host
      };
    } catch (err) {
      return { provider: this.name, configured: true, status: 'OFFLINE', error: err.message, host: this.host };
    }
  }

  async isAvailable() {
    try {
      const res = await fetch(`${this.host}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
      return res.ok;
    } catch { return false; }
  }

  async waitUntilReady(timeoutMs = 30_000, intervalMs = 800) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.isAvailable()) return true;
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return false;
  }

  async sendChat({ messages, stream = false, model, temperature = 0.7, maxTokens = 8192 }, onChunk = null) {
    const endpoint = `${this.host}/v1/chat/completions`;
    const payload = {
      model: model || this.defaultModel,
      messages, temperature,
      max_tokens: maxTokens, stream
    };

    const abortCtrl = new AbortController();
    let timeoutId = null;
    if (!stream) timeoutId = setTimeout(() => abortCtrl.abort(), NON_STREAM_TIMEOUT_MS);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: this._baseHeaders(),
        body: JSON.stringify(payload),
        signal: abortCtrl.signal
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => String(res.status));
        throw new Error(`9Router HTTP ${res.status}: ${errText}`);
      }

      if (stream && onChunk) {
        const reader  = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullContent = '', fullReasoning = '', buffer = '';
        let lastTokenAt = Date.now();

        const watchdog = setInterval(() => {
          if (Date.now() - lastTokenAt > STREAM_INACTIVITY_MS) {
            clearInterval(watchdog);
            abortCtrl.abort();
          }
        }, 5_000);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            lastTokenAt = Date.now();
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data: ')) continue;
              const jsonStr = trimmed.replace(/^data:\s*/, '').trim();
              if (jsonStr === '[DONE]') continue;
              try {
                const delta     = JSON.parse(jsonStr).choices?.[0]?.delta || {};
                const token     = delta.content || '';
                const reasoning = delta.reasoning_content || '';
                if (token)     { fullContent   += token;     lastTokenAt = Date.now(); onChunk(token, false); }
                if (reasoning) { fullReasoning += reasoning; lastTokenAt = Date.now(); onChunk(reasoning, true); }
              } catch { /* ignore malformed SSE */ }
            }
          }
        } finally { clearInterval(watchdog); }

        const rem = decoder.decode();
        if (rem && rem.trim().startsWith('data: ')) {
          const jsonStr = rem.trim().replace(/^data:\s*/, '');
          if (jsonStr !== '[DONE]') {
            try {
              const d = JSON.parse(jsonStr).choices?.[0]?.delta || {};
              if (d.content) { fullContent += d.content; onChunk(d.content, false); }
            } catch { /* ignore */ }
          }
        }

        return fullContent
          ? (fullReasoning ? `<think>\n${fullReasoning}\n</think>\n${fullContent}` : fullContent)
          : fullReasoning;
      }

      const data    = await res.json();
      const choice  = data.choices?.[0]?.message || {};
      const content = choice.content || '';
      const reason  = choice.reasoning_content || '';
      return content
        ? (reason ? `<think>\n${reason}\n</think>\n${content}` : content)
        : (reason || '');

    } catch (err) {
      if (err.name === 'AbortError') {
        const te = new Error(stream
          ? 'NINEROUTER_INACTIVITY: 9Router tidak mengirim token selama 120 detik.'
          : 'NINEROUTER_TIMEOUT: 9Router tidak merespons dalam 120 detik.');
        te.code = 'NINEROUTER_TIMEOUT';
        throw te;
      }
      throw new Error(`[NineRouterChatAdapter] ${err.message}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generate(params, onChunk = null) {
    let messages = params.messages;
    if (!messages && params.prompt) {
      messages = [];
      if (params.systemPrompt) messages.push({ role: 'system', content: params.systemPrompt });
      messages.push({ role: 'user', content: params.prompt });
    }
    return this.sendChat({ ...params, messages }, onChunk);
  }
}

export const nineRouterChatAdapterInstance = new NineRouterChatAdapter();
export default NineRouterChatAdapter;
