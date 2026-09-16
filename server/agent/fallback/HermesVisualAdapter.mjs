/**
 * HermesVisualAdapter.mjs
 * Dedicated, explicit adapter for Hermes 3:8B visual design compilation.
 * 
 * STRICT ARCHITECTURAL SEPARATION:
 * - Isolated from normal chat routing (ModelRoutingService.routeChat).
 * - Explicitly targets Hermes 3:8B.
 * - Does NOT mutate or override default chat model (qwen2.5-3b-instruct-q4_k_m.gguf).
 * - Never calls or modifies global chat state.
 */

export class HermesVisualAdapter {
  constructor(options = {}) {
    this.name = 'hermes-3-8b';
    this.model = options.model || 'hermes-3-8b';
    this.host = options.host || process.env.HERMES_HOST || process.env.LLAMACPP_HOST || 'http://127.0.0.1:8080';
    this.ctxSize = parseInt(process.env.LLAMACPP_CTX_SIZE || '32768', 10);
  }

  async generate({ prompt, systemPrompt, temperature = 0.2, maxTokens = 4096 }) {
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const endpoint = `${this.host}/v1/chat/completions`;
    const payload = {
      model: this.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Hermes visual endpoint returned HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0]?.message || {};
      const content = choice.content || choice.reasoning_content || '';
      return content;
    } catch (err) {
      throw new Error(`[HermesVisualAdapter Failure] ${err.message}`);
    }
  }
}

export const hermesVisualAdapterInstance = new HermesVisualAdapter();
export default hermesVisualAdapterInstance;
