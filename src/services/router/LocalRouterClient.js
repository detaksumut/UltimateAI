/**
 * LocalRouterClient.js
 * Clean, modern client for UltimateAI Local Router (:20200).
 * Dedicated to real SSE streaming directly to/from Ollama.
 * ZERO fallback, ZERO dummy text, ZERO fake delay.
 */

import { RouterConfig } from './RouterConfig.js';
import { routerStatusInstance } from './RouterStatus.js';

export class LocalRouterClient {
  constructor() {
    this.endpoint = RouterConfig.getEndpoint();
  }

  /**
   * Check connection health with Local Router :20200
   */
  async checkHealth() {
    const startTime = performance.now();
    try {
      const res = await fetch(`${this.endpoint}/health`, {
        signal: AbortSignal.timeout(3000)
      });
      const latency = Math.round(performance.now() - startTime);
      const ok = res.ok;
      routerStatusInstance.updateHealth(ok, latency);
      return ok;
    } catch {
      const latency = Math.round(performance.now() - startTime);
      routerStatusInstance.updateHealth(false, latency);
      return false;
    }
  }

  /**
   * Stream chat completion from Local Router via SSE.
   * Calls onDelta(token, fullText) as tokens arrive.
   * Calls onComplete(fullText) when [DONE] is received.
   * Calls onError(error) if any failure occurs.
   *
   * @param {Object} params
   * @param {Array} params.messages - [{ role: 'user'|'assistant'|'system', content: string }]
   * @param {string} [params.model] - default 'qwen3:8b'
   * @param {number} [params.temperature] - default 0.7
   * @param {AbortSignal} [params.signal] - optional abort signal
   * @param {Object} callbacks - { onDelta, onComplete, onError }
   * @returns {Promise<string>} Final accumulated text
   */
  async streamChat({ messages = [], model = RouterConfig.DEFAULT_MODEL, temperature = 0.7, signal = null, generationId = null, messageId = null } = {}, { onDelta, onComplete, onError } = {}) {
    let errorNotified = false;
    const baseEndpoint = this.endpoint.replace(/\/+$/, '');
    const url = baseEndpoint.endsWith('/v1')
      ? `${baseEndpoint}/chat/completions`
      : `${baseEndpoint}/v1/chat/completions`;

    const payload = {
      model: model || 'qwen3:8b',
      messages,
      temperature,
      stream: true,
      generationId,
      messageId
    };

    console.log(`[STREAM_DEBUG] fetch_started`);
    const startTime = performance.now();

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: signal || undefined
      });
    } catch (fetchErr) {
      const latency = Math.round(performance.now() - startTime);
      routerStatusInstance.updateHealth(false, latency);

      const isAborted = signal?.aborted || fetchErr.name === 'AbortError';
      const errMsg = isAborted
        ? 'REQUEST_ABORTED: Permintaan dibatalkan.'
        : `LOCAL_ROUTER_UNREACHABLE: Tidak dapat terhubung ke ${url}. Pastikan server :20200 aktif. (${fetchErr.message})`;
      
      const err = new Error(errMsg);
      console.error(`[STREAM_DEBUG] fetch_error:`, errMsg);
      if (onError && !errorNotified) {
        errorNotified = true;
        onError(err);
      }
      throw err;
    }

    const latency = Math.round(performance.now() - startTime);

    console.log(`[STREAM_DEBUG] response_received`);
    console.log(`[STREAM_DEBUG] status=${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    console.log(`[STREAM_DEBUG] content_type=${contentType}`);

    if (!response.ok) {
      routerStatusInstance.updateHealth(false, latency);
      let bodyText = '';
      try { bodyText = await response.text(); } catch {}
      const errMsg = `LOCAL_ROUTER_HTTP_ERROR: Status ${response.status} ${response.statusText}${bodyText ? ` (${bodyText.slice(0, 150)})` : ''}`;
      console.error(`[STREAM_DEBUG] ${errMsg}`);
      const err = new Error(errMsg);
      if (onError && !errorNotified) {
                errorNotified = true;
                onError(err);
              }
              throw err;
    }

    routerStatusInstance.updateHealth(true, latency);

    if (!response.body) {
      const err = new Error('LOCAL_ROUTER_STREAM_BROKEN: Response body is null or undefined.');
      if (onError && !errorNotified) {
                errorNotified = true;
                onError(err);
              }
              throw err;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';
    let chunkCount = 0;
    let isDone = false;

    try {
      let lastAgentMetadata = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        console.log(`[STREAM_DEBUG] chunk_received`);
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.replace(/^data:\s*/, '').trim();

          if (dataStr === '[DONE]') {
            console.log(`[STREAM_DEBUG] stream_done`);
            isDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(dataStr);
            console.log(`[STREAM_DEBUG] sse_data_parsed`);

            if (parsed.error) {
              const err = new Error(`OLLAMA_ERROR: ${parsed.error.message || JSON.stringify(parsed.error)}`);
              if (onError && !errorNotified) {
                errorNotified = true;
                onError(err);
              }
              throw err;
            }

            if (parsed._agent) {
              lastAgentMetadata = parsed._agent;
            }

            const delta = parsed.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta.length > 0) {
              fullText += delta;
              chunkCount++;
              console.log(`[STREAM_DEBUG] delta_received`);
              if (onDelta) onDelta(delta, fullText);
            }

          } catch (jsonErr) {
            if (jsonErr.message?.startsWith('OLLAMA_ERROR')) throw jsonErr;
            console.warn('[STREAM_DEBUG] SSE JSON parse warning:', dataStr.slice(0, 60), jsonErr.message);
          }
        }

        if (isDone) break;
      }

      // Flush decoder
      const remainder = decoder.decode();
      if (remainder) {
        buffer += remainder;
        const lines = buffer.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.replace(/^data:\s*/, '').trim();
          if (dataStr === '[DONE]') {
            console.log(`[STREAM_DEBUG] stream_done`);
            isDone = true;
            break;
          }
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed._agent) lastAgentMetadata = parsed._agent;
            console.log(`[STREAM_DEBUG] sse_data_parsed`);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta.length > 0) {
              fullText += delta;
              chunkCount++;
              console.log(`[STREAM_DEBUG] delta_received`);
              if (onDelta) onDelta(delta, fullText);
            }
          } catch {}
        }
      }

      if (onComplete) onComplete(fullText, lastAgentMetadata);
      return fullText;
    } catch (streamErr) {
      console.error(`[STREAM_DEBUG] stream_read_error:`, streamErr.message);
      const err = streamErr.message?.startsWith('OLLAMA_') || streamErr.message?.startsWith('LOCAL_ROUTER_')
        ? streamErr
        : new Error(`LOCAL_ROUTER_STREAM_BROKEN: ${streamErr.message}`);
      if (onError && !errorNotified) {
                errorNotified = true;
                onError(err);
              }
              throw err;
    }
  }

  /**
   * Compatibility method for callers expecting routeAndExecute
   */
  async routeAndExecute(messages, options = {}, onChunk = null) {
    let accumulated = '';
    const text = await this.streamChat(
      {
        messages,
        model: options.model,
        temperature: options.temperature
      },
      {
        onDelta: (delta, full) => {
          accumulated = full;
          if (onChunk) onChunk(delta, full);
        }
      }
    );
    return {
      text,
      routing: {
        orchestratedBy: 'LocalRouter-Live-Stream',
        providerGateway: 'OLLAMA',
        actualModel: options.model || RouterConfig.DEFAULT_MODEL,
        transportClass: 'LOCAL_OLLAMA'
      }
    };
  }
}

export const localRouterClient = new LocalRouterClient();
export default localRouterClient;
