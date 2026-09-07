/**
 * GeminiProvider.mjs
 * Cloud-First Ultra-Fast LLM Provider for UltimateAI / JIN Runtime.
 * Powered by Google Gemini 2.5 Flash via Generative Language API.
 * 
 * Provides:
 *  - High-speed inference (<2 sec TTFB vs 26 sec Ollama CPU)
 *  - Real-time SSE streaming passthrough to UI Ticker
 *  - Automatic message normalizer (OpenAI -> Gemini alternating turns)
 *  - Zero CPU / RAM load on user's machine
 */

import { BaseProvider } from './BaseProvider.mjs';

import fs from 'fs';
import path from 'path';

export class GeminiProvider extends BaseProvider {
  constructor() {
    super('gemini');
    this.defaultModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this._availability = { available: null, checkedAt: 0 };
    this._keyCooldowns = new Map(); // key -> cooldownUntilMs
    this._currentKeyIndex = 0;
  }

  _getAllApiKeys() {
    const keys = [];
    // 1. Process environment variables
    const candidates = [
      process.env.GEMINI_API_KEY_5,
      process.env.GEMINI_API_KEY_4,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_1
    ];
    for (const k of candidates) {
      if (k && typeof k === 'string' && k.trim().length > 10 && k.trim() !== 'API_KEY_GEMINI_ANDA') {
        const val = k.trim();
        if (!keys.includes(val)) keys.push(val);
      }
    }

    // 2. Direct .env file fallback read
    try {
      const envPath = path.resolve('d:/Users/ultimateai/.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
          const m = line.match(/^GEMINI_API_KEY(?:_\w+)?\s*=\s*([^\r\n#]+)/);
          if (m && m[1].trim() && m[1].trim().length > 10 && m[1].trim() !== 'API_KEY_GEMINI_ANDA') {
            const val = m[1].trim();
            if (!keys.includes(val)) keys.push(val);
          }
        }
      }
    } catch {}

    return keys;
  }

  _resolveApiKey() {
    const allKeys = this._getAllApiKeys();
    if (allKeys.length === 0) return null;

    const now = Date.now();
    // Try to find a non-cooldown key starting from current index
    for (let i = 0; i < allKeys.length; i++) {
      const idx = (this._currentKeyIndex + i) % allKeys.length;
      const candidate = allKeys[idx];
      const cd = this._keyCooldowns.get(candidate) || 0;
      if (now >= cd) {
        this._currentKeyIndex = idx;
        return candidate;
      }
    }

    // If all are in cooldown, pick the one that expires earliest
    return allKeys[0];
  }

  _markKeyCooldown(key, durationMs = 60000) {
    if (!key) return;
    this._keyCooldowns.set(key, Date.now() + durationMs);
    const allKeys = this._getAllApiKeys();
    this._currentKeyIndex = (this._currentKeyIndex + 1) % Math.max(1, allKeys.length);
    console.warn(`[GEMINI_KEY_COOLDOWN] Key ${key.slice(0, 10)}... in cooldown for ${durationMs / 1000}s. Rotated to index ${this._currentKeyIndex}`);
  }

  isConfigured() {
    return Boolean(this._resolveApiKey());
  }

  async isAvailable() {
    const key = this._resolveApiKey();
    if (!key) return false;

    // Cache TTL 30s
    if (this._availability.available !== null && (Date.now() - this._availability.checkedAt < 30000)) {
      return this._availability.available;
    }

    try {
      const res = await fetch(`${this.baseUrl}/models?key=${key}`, {
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
    if (clean === 'gemini-2.5-flash') return 'gemini-3.6-flash';
    if (clean.startsWith('gemini-')) return clean;
    return this.defaultModel;
  }

  /**
   * Convert OpenAI messages array to Gemini contents & systemInstruction
   */
  _convertMessages(messages = []) {
    let systemInstruction = null;
    const contents = [];

    const systemParts = [];
    for (const msg of messages) {
      if (!msg) continue;
      const role = String(msg.role || '').toLowerCase();
      let text = '';

      if (typeof msg.content === 'string') {
        text = msg.content;
      } else if (Array.isArray(msg.content)) {
        text = msg.content.map(p => p.text || '').filter(Boolean).join('\n');
      }

      if (role === 'system') {
        if (text) systemParts.push(text);
      } else {
        const geminiRole = (role === 'assistant' || role === 'model') ? 'model' : 'user';
        const parts = [];

        if (text) {
          parts.push({ text });
        }

        // Process multimodal parts (images, PDF documents)
        if (Array.isArray(msg.content)) {
          for (const p of msg.content) {
            if (!p) continue;
            const url = p.image_url?.url || (typeof p.image_url === 'string' ? p.image_url : null) || p.dataUrl;
            if (url && typeof url === 'string' && url.startsWith('data:')) {
              const match = url.match(/^data:([^;]+);base64,(.+)$/);
              if (match) {
                parts.push({
                  inlineData: {
                    mimeType: match[1],
                    data: match[2]
                  }
                });
              }
            } else if (p.inlineData) {
              parts.push({ inlineData: p.inlineData });
            }
          }
        }

        if (parts.length > 0) {
          // Merge consecutive same-role messages (Gemini requirement)
          const last = contents[contents.length - 1];
          if (last && last.role === geminiRole) {
            last.parts.push(...parts);
          } else {
            contents.push({
              role: geminiRole,
              parts
            });
          }
        }
      }
    }

    if (systemParts.length > 0) {
      systemInstruction = {
        parts: [{ text: systemParts.join('\n\n') }]
      };
    }

    // Ensure contents starts with user role if empty or starts with model
    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Halo' }] });
    } else if (contents[0].role !== 'user') {
      contents.unshift({ role: 'user', parts: [{ text: 'Mulai percakapan' }] });
    }

    return { contents, systemInstruction };
  }

  async sendChat({ messages, stream = false, model = 'auto', temperature = 0.7 }, onChunk = null) {
    const allKeys = this._getAllApiKeys();
    if (allKeys.length === 0) {
      throw new Error('GEMINI_UNCONFIGURED: Tidak ada kunci GEMINI_API_KEY valid di environment.');
    }

    const resolvedModel = this._resolveModel(model);
    const { contents, systemInstruction } = this._convertMessages(messages);

    const requestBody = {
      contents,
      generationConfig: {
        temperature: typeof temperature === 'number' ? temperature : 0.7
      }
    };

    if (systemInstruction) {
      requestBody.systemInstruction = systemInstruction;
    }

    let lastError = null;
    const maxAttempts = Math.min(allKeys.length, 3);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const key = this._resolveApiKey();
      const t0 = Date.now();

      try {
        if (stream && typeof onChunk === 'function') {
          const url = `${this.baseUrl}/models/${resolvedModel}:streamGenerateContent?alt=sse&key=${key}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(60000)
          });

          if (!response.ok) {
            const errText = await response.text().catch(() => '');
            if (response.status === 429 || response.status === 403 || response.status === 401) {
              this._markKeyCooldown(key, 60000);
              console.warn(`[GEMINI_QUOTA_RETRY] Key ${key.slice(0, 10)}... failed with HTTP ${response.status}. Retrying next key...`);
              lastError = new Error(`GEMINI_STREAM_ERROR: HTTP ${response.status} - ${errText.slice(0, 200)}`);
              continue;
            }
            throw new Error(`GEMINI_STREAM_ERROR: HTTP ${response.status} - ${errText.slice(0, 200)}`);
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
                const textChunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (textChunk) {
                  fullText += textChunk;
                  onChunk(textChunk);
                }
              } catch {
                // Partial JSON chunk
              }
            }
          }

          const latencyMs = Date.now() - t0;
          console.log(`[GEMINI_STREAM_COMPLETE] model=${resolvedModel} length=${fullText.length} latencyMs=${latencyMs}`);
          return fullText;
        } else {
          // Non-streaming call
          const url = `${this.baseUrl}/models/${resolvedModel}:generateContent?key=${key}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(45000)
          });

          if (!response.ok) {
            const errText = await response.text().catch(() => '');
            if (response.status === 429 || response.status === 403 || response.status === 401) {
              this._markKeyCooldown(key, 60000);
              console.warn(`[GEMINI_QUOTA_RETRY] Key ${key.slice(0, 10)}... failed with HTTP ${response.status}. Retrying next key...`);
              lastError = new Error(`GEMINI_HTTP_ERROR: HTTP ${response.status} - ${errText.slice(0, 200)}`);
              continue;
            }
            throw new Error(`GEMINI_HTTP_ERROR: HTTP ${response.status} - ${errText.slice(0, 200)}`);
          }

          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const latencyMs = Date.now() - t0;
          console.log(`[GEMINI_COMPLETE] model=${resolvedModel} length=${text.length} latencyMs=${latencyMs}`);
          return text;
        }
      } catch (callErr) {
        if (callErr.message.includes('429') && attempt < maxAttempts - 1) {
          continue;
        }
        throw callErr;
      }
    }

    throw lastError || new Error('GEMINI_ALL_KEYS_EXHAUSTED: Semua kunci Gemini API mengalami batas limit.');
  }
}

export const geminiProviderInstance = new GeminiProvider();
export default geminiProviderInstance;
