/**
 * GeminiProvider.mjs — ROTATION ENGINE 10 Key × 6 Model = 60 Kombinasi
 * Cloud-First LLM Provider for UltimateAI / JIN Runtime.
 *
 * Prinsip:
 *  - Request normal: berhasil jauh sebelum kombinasi ke-60
 *  - 60 = batas atas fallback, bukan default per-request
 *  - Logging aman: hanya cetak nomor index key, TIDAK pernah cetak value key
 *  - Cooldown berlapis: per-key, per-model, per-kombinasi (key+model)
 *  - Error transient (429) → rotasi; permanent (404) → skip model 1 jam
 *  - Statistik keberhasilan per-key dan per-model
 */

import { BaseProvider } from './BaseProvider.mjs';
import fs from 'fs';
import path from 'path';

// 6 model unik — tanpa duplikat
const DEFAULT_MODEL_CHAIN = [
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-flash-latest',
];

const ERROR_TYPE = {
  QUOTA: 'QUOTA', AUTH: 'AUTH', NOT_FOUND: 'NOT_FOUND', BAD_REQ: 'BAD_REQ',
  UNAVAILABLE: 'UNAVAILABLE', FATAL: 'FATAL', EMPTY_OUTPUT: 'EMPTY_OUTPUT',
};

function classifyHttpError(status) {
  if (status === 429) return ERROR_TYPE.QUOTA;
  if (status === 401 || status === 403) return ERROR_TYPE.AUTH;
  if (status === 404) return ERROR_TYPE.NOT_FOUND;
  if (status === 400) return ERROR_TYPE.BAD_REQ;
  if ([408, 425, 500, 502, 503, 504].includes(status)) return ERROR_TYPE.UNAVAILABLE;
  return ERROR_TYPE.FATAL;
}

/**
 * Menganalisis data response Gemini (HTTP 200) untuk mendeteksi blocked/empty output.
 * Return: { blocked: bool, reason: string }
 */
function _analyzeGeminiResponse(data) {
  // promptFeedback block
  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) return { blocked: true, reason: `PROMPT_BLOCKED:${blockReason}` };

  const candidate = data?.candidates?.[0];
  if (!candidate) return { blocked: true, reason: 'NO_CANDIDATES' };

  const finishReason = candidate.finishReason;
  const BLOCKED_REASONS = ['SAFETY', 'RECITATION', 'LANGUAGE', 'PROHIBITED_CONTENT', 'SPII', 'OTHER'];
  if (BLOCKED_REASONS.includes(finishReason)) {
    return { blocked: true, reason: `FINISH:${finishReason}` };
  }

  const text = candidate?.content?.parts?.[0]?.text;
  if (!text || typeof text !== 'string' || !text.trim()) {
    // MAX_TOKENS juga bisa menghasilkan partial output — tetap gunakan jika ada
    return { blocked: true, reason: `EMPTY_CONTENT:finishReason=${finishReason || 'unknown'}` };
  }
  return { blocked: false, reason: null };
}

const COOLDOWN = {
  KEY_QUOTA: 60000, KEY_AUTH: 300000, KEY_BAD: 30000,
  COMBO_QUOTA: 90000, MODEL_QUOTA: 120000, MODEL_404: 3600000,
};

export class GeminiProvider extends BaseProvider {
  constructor() {
    super('gemini');
    this.baseUrl      = 'https://generativelanguage.googleapis.com/v1beta';
    this.defaultModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const primary = this.defaultModel;
    this._modelChain = [primary, ...DEFAULT_MODEL_CHAIN.filter(m => m !== primary)];
    this._keyCooldowns   = new Map();
    this._modelCooldowns = new Map();
    this._comboCooldowns = new Map();
    this._currentKeyIndex = 0;
    this._availability   = { available: null, checkedAt: 0 };
    this._keyStats       = new Map();
    this._modelStats     = new Map();
  }

  _getAllApiKeys() {
    const keys = [];
    const candidates = [
      process.env.GEMINI_API_KEY_10, process.env.GEMINI_API_KEY_9,
      process.env.GEMINI_API_KEY_8,  process.env.GEMINI_API_KEY_7,
      process.env.GEMINI_API_KEY_6,  process.env.GEMINI_API_KEY_5,
      process.env.GEMINI_API_KEY_4,  process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_2,  process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_1,
    ];
    for (const k of candidates) {
      if (k && typeof k === 'string' && k.trim().length > 10 && k.trim() !== 'API_KEY_GEMINI_ANDA') {
        const val = k.trim();
        if (!keys.includes(val)) keys.push(val);
      }
    }
    try {
      const envPath = path.resolve('d:/Users/ultimateai/.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
          const m = line.match(/^GEMINI_API_KEY(?:_\w+)?\s*=\s*([^\r\n#]+)/);
          if (m && m[1].trim().length > 10 && m[1].trim() !== 'API_KEY_GEMINI_ANDA') {
            const val = m[1].trim();
            if (!keys.includes(val)) keys.push(val);
          }
        }
      }
    } catch { }
    return keys;
  }

  _resolveApiKey(allKeys) {
    const now = Date.now();
    for (let i = 0; i < allKeys.length; i++) {
      const idx = (this._currentKeyIndex + i) % allKeys.length;
      if (now >= (this._keyCooldowns.get(idx) || 0)) {
        this._currentKeyIndex = idx;
        return { key: allKeys[idx], idx };
      }
    }
    let minIdx = this._currentKeyIndex, minExp = Infinity;
    for (let i = 0; i < allKeys.length; i++) {
      const idx = (this._currentKeyIndex + i) % allKeys.length;
      const exp = this._keyCooldowns.get(idx) || 0;
      if (exp < minExp) { minExp = exp; minIdx = idx; }
    }
    this._currentKeyIndex = minIdx;
    return { key: allKeys[minIdx], idx: minIdx };
  }

  _markKeyCooldown(idx, durationMs, reason) {
    this._keyCooldowns.set(idx, Date.now() + durationMs);
    const total = this._getAllApiKeys().length;
    this._currentKeyIndex = (idx + 1) % Math.max(1, total);
    console.warn(`[GEMINI_KEY_CD] key#${idx + 1} cd=${durationMs / 1000}s reason=${reason}`);
  }

  _markModelCooldown(model, durationMs, reason) {
    this._modelCooldowns.set(model, Date.now() + durationMs);
    console.warn(`[GEMINI_MODEL_CD] model="${model}" cd=${durationMs / 1000}s reason=${reason}`);
  }

  _markComboCooldown(idx, model, durationMs) {
    this._comboCooldowns.set(`${idx}:${model}`, Date.now() + durationMs);
  }

  _isComboInCooldown(idx, model) {
    return Date.now() < (this._comboCooldowns.get(`${idx}:${model}`) || 0);
  }

  _initStats(map, key) {
    if (!map.has(key)) map.set(key, { attempts: 0, success: 0, quota: 0, auth: 0, notFound: 0, errors: 0 });
    return map.get(key);
  }

  _recordAttempt(keyIdx, model, outcome) {
    const ks = this._initStats(this._keyStats, keyIdx);
    const ms = this._initStats(this._modelStats, model);
    ks.attempts++; ms.attempts++;
    if (outcome === 'success')  { ks.success++;  ms.success++;  }
    if (outcome === 'quota')    { ks.quota++;    ms.quota++;    }
    if (outcome === 'auth')     { ks.auth++;     ms.auth++;     }
    if (outcome === 'notFound') { ks.notFound++; ms.notFound++; }
    if (outcome === 'error')    { ks.errors++;   ms.errors++;   }
  }

  _logStats() {
    const kl = [], ml = [];
    for (const [i, s] of this._keyStats.entries())   kl.push(`key#${i+1}[ok=${s.success} 429=${s.quota}]`);
    for (const [m, s] of this._modelStats.entries()) ml.push(`${m}[ok=${s.success} 429=${s.quota}]`);
    if (kl.length) console.log(`[GEMINI_KEY_STATS]   ${kl.join(' | ')}`);
    if (ml.length) console.log(`[GEMINI_MODEL_STATS] ${ml.join(' | ')}`);
  }

  getStats() {
    return {
      keys: Object.fromEntries(this._keyStats),
      models: Object.fromEntries(this._modelStats),
      activeCooldowns: {
        keys: Array.from(this._keyCooldowns.entries())
          .filter(([, exp]) => Date.now() < exp)
          .map(([idx, exp]) => ({ keyIndex: idx + 1, remainingSec: Math.round((exp - Date.now()) / 1000) })),
        models: Array.from(this._modelCooldowns.entries())
          .filter(([, exp]) => Date.now() < exp)
          .map(([m, exp]) => ({ model: m, remainingSec: Math.round((exp - Date.now()) / 1000) })),
      }
    };
  }

  isConfigured() { return this._getAllApiKeys().length > 0; }

  async isAvailable() {
    if (!this.isConfigured()) return false;
    if (this._availability.available !== null && Date.now() - this._availability.checkedAt < 30000) {
      return this._availability.available;
    }
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { 'X-goog-api-key': this._getAllApiKeys()[0] },
        signal: AbortSignal.timeout(4000),
      });
      this._availability = { available: res.ok, checkedAt: Date.now() };
      return res.ok;
    } catch {
      this._availability = { available: false, checkedAt: Date.now() };
      return false;
    }
  }

  _resolveModel(model) {
    if (!model || model === 'auto' || /^(ollama|hermes)/i.test(String(model))) return this.defaultModel;
    const clean = String(model).trim();
    if (clean.startsWith('gemini-')) return clean;
    return this.defaultModel;
  }

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
        if (text) parts.push({ text });
        if (Array.isArray(msg.content)) {
          for (const p of msg.content) {
            if (!p) continue;
            const url = p.image_url?.url || (typeof p.image_url === 'string' ? p.image_url : null) || p.dataUrl;
            if (url && typeof url === 'string' && url.startsWith('data:')) {
              const match = url.match(/^data:([^;]+);base64,(.+)$/);
              if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
            } else if (p.inlineData) {
              parts.push({ inlineData: p.inlineData });
            }
          }
        }
        if (parts.length > 0) {
          const last = contents[contents.length - 1];
          if (last && last.role === geminiRole) last.parts.push(...parts);
          else contents.push({ role: geminiRole, parts });
        }
      }
    }

    if (systemParts.length > 0) systemInstruction = { parts: [{ text: systemParts.join('\n\n') }] };
    if (contents.length === 0) contents.push({ role: 'user', parts: [{ text: 'Halo' }] });
    else if (contents[0].role !== 'user') contents.unshift({ role: 'user', parts: [{ text: 'Mulai' }] });
    return { contents, systemInstruction };
  }

  async sendChat({ messages, stream = false, model = 'auto', temperature = 0.7 }, onChunk = null) {
    const allKeys = this._getAllApiKeys();
    if (allKeys.length === 0) throw new Error('GEMINI_UNCONFIGURED: Tidak ada GEMINI_API_KEY valid.');

    const { contents, systemInstruction } = this._convertMessages(messages);
    const requestBody = {
      contents,
      generationConfig: { temperature: typeof temperature === 'number' ? temperature : 0.7 },
    };
    if (systemInstruction) requestBody.systemInstruction = systemInstruction;

    const preferred = this._resolveModel(model);
    const chain     = [preferred, ...this._modelChain.filter(m => m !== preferred)];

    let lastError = null, totalTried = 0;

    for (const activeModel of chain) {
      const now = Date.now();
      if (now < (this._modelCooldowns.get(activeModel) || 0)) {
        const rem = Math.ceil(((this._modelCooldowns.get(activeModel) || 0) - now) / 1000);
        console.warn(`[GEMINI_SKIP_MODEL] "${activeModel}" cd=${rem}s`);
        continue;
      }

      let allQuotaForModel = true;

      for (let i = 0; i < allKeys.length; i++) {
        const { key, idx } = this._resolveApiKey(allKeys);

        if (this._isComboInCooldown(idx, activeModel)) {
          this._currentKeyIndex = (idx + 1) % allKeys.length;
          continue;
        }

        totalTried++;
        const t0 = Date.now();

        try {
          let result;
          if (stream && typeof onChunk === 'function') {
            result = await this._streamRequest(activeModel, key, idx, requestBody, onChunk, t0);
          } else {
            result = await this._nonStreamRequest(activeModel, key, idx, requestBody, t0);
          }
          this._recordAttempt(idx, activeModel, 'success');
          this._logStats();
          return result;
        } catch (err) {
          const errType = err._geminiErrorType || ERROR_TYPE.FATAL;
          lastError = err;
          if (errType === ERROR_TYPE.QUOTA) {
            this._recordAttempt(idx, activeModel, 'quota');
            this._markKeyCooldown(idx, COOLDOWN.KEY_QUOTA, '429');
            this._markComboCooldown(idx, activeModel, COOLDOWN.COMBO_QUOTA);
            continue;
          }
          if (errType === ERROR_TYPE.AUTH) {
            this._recordAttempt(idx, activeModel, 'auth');
            this._markKeyCooldown(idx, COOLDOWN.KEY_AUTH, 'AUTH');
            allQuotaForModel = false; continue;
          }
          if (errType === ERROR_TYPE.NOT_FOUND) {
            this._recordAttempt(idx, activeModel, 'notFound');
            this._markModelCooldown(activeModel, COOLDOWN.MODEL_404, '404');
            allQuotaForModel = false; break;
          }
          if (errType === ERROR_TYPE.BAD_REQ) {
            this._recordAttempt(idx, activeModel, 'error');
            this._markKeyCooldown(idx, COOLDOWN.KEY_BAD, '400');
            allQuotaForModel = false; continue;
          }
          // EMPTY_OUTPUT: HTTP 200 tapi content kosong / diblokir safety.
          // Perlakukan sebagai soft-skip: coba key berikutnya, lalu model berikutnya.
          if (errType === ERROR_TYPE.EMPTY_OUTPUT) {
            this._recordAttempt(idx, activeModel, 'error');
            this._markComboCooldown(idx, activeModel, COOLDOWN.KEY_BAD); // 30s cooldown combo ini
            allQuotaForModel = false; continue;
          }
          if (errType === ERROR_TYPE.UNAVAILABLE) {
            this._recordAttempt(idx, activeModel, 'error');
            this._markComboCooldown(idx, activeModel, COOLDOWN.KEY_BAD);
            console.warn(`[GEMINI_RETRY] key#${idx + 1} model=${activeModel} unavailable; trying next pool key`);
            allQuotaForModel = false;
            continue;
          }
          this._recordAttempt(idx, activeModel, 'error');
          this._logStats();
          throw err;
        }
      }

      if (allQuotaForModel) {
        this._markModelCooldown(activeModel, COOLDOWN.MODEL_QUOTA, 'ALL_KEYS_429');
        console.warn(`[GEMINI_MODEL_EXHAUSTED] "${activeModel}" → next model`);
      }
    }

    this._logStats();
    const e = new Error(`GEMINI_ALL_EXHAUSTED: ${totalTried} kombinasi dicoba, semua gagal. Failover ke Groq/Ollama.`);
    e.code = 'GEMINI_ALL_EXHAUSTED';
    throw e;
  }

  async sendImage({ prompt, negativePrompt = '', aspectRatio = '1:1', model = null, signal = null, fetchFn = globalThis.fetch } = {}) {
    const allKeys = this._getAllApiKeys();
    if (allKeys.length === 0) {
      throw new Error('GEMINI_UNCONFIGURED: Tidak ada GEMINI_API_KEY valid.');
    }

    const activeModel = model || process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
    const fullPrompt = negativePrompt ? `${prompt}. Avoid: ${negativePrompt}` : prompt;
    const aspectHint = aspectRatio ? ` (${aspectRatio} aspect ratio)` : '';
    const requestBody = {
      model: activeModel,
      input: [
        { type: 'text', text: `Generate an image based on this description${aspectHint}: ${fullPrompt}` }
      ]
    };
    let lastError = null;

    for (let i = 0; i < allKeys.length; i++) {
      const { key, idx } = this._resolveApiKey(allKeys);
      if (this._isComboInCooldown(idx, activeModel)) {
        this._currentKeyIndex = (idx + 1) % allKeys.length;
        continue;
      }

      try {
        const response = await fetchFn(
          `${this.baseUrl}/interactions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': key,
              'Api-Revision': '2026-05-20'
            },
            body: JSON.stringify(requestBody),
            signal: signal || AbortSignal.timeout(90000)
          }
        );

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          const error = new Error(`GEMINI_IMAGE_HTTP ${response.status} key#${idx + 1}: ${errText.slice(0, 180)}`);
          error._geminiErrorType = classifyHttpError(response.status);
          throw error;
        }

        const data = await response.json();
        const imagePart = data.output?.find(part => part.inlineData?.data)
          || data.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.data);
        if (!imagePart) {
          const error = new Error(`GEMINI_IMAGE_EMPTY key#${idx + 1}: response contained no image data`);
          error._geminiErrorType = ERROR_TYPE.EMPTY_OUTPUT;
          throw error;
        }

        this._recordAttempt(idx, activeModel, 'success');
        this._currentKeyIndex = (idx + 1) % allKeys.length;
        return {
          base64Data: imagePart.inlineData.data,
          mimeType: imagePart.inlineData.mimeType || 'image/png',
          model: activeModel,
          keyIndex: idx + 1
        };
      } catch (error) {
        lastError = error;
        const type = error._geminiErrorType || ERROR_TYPE.FATAL;
        this._recordAttempt(idx, activeModel, type === ERROR_TYPE.QUOTA ? 'quota' : type === ERROR_TYPE.AUTH ? 'auth' : 'error');
        if (type === ERROR_TYPE.QUOTA) {
          this._markKeyCooldown(idx, COOLDOWN.KEY_QUOTA, 'IMAGE_429');
          this._markComboCooldown(idx, activeModel, COOLDOWN.COMBO_QUOTA);
          continue;
        }
        if (type === ERROR_TYPE.AUTH) {
          this._markKeyCooldown(idx, COOLDOWN.KEY_AUTH, 'IMAGE_AUTH');
          continue;
        }
        if (type === ERROR_TYPE.BAD_REQ || type === ERROR_TYPE.EMPTY_OUTPUT) {
          this._markComboCooldown(idx, activeModel, COOLDOWN.KEY_BAD);
          continue;
        }
        if (type === ERROR_TYPE.UNAVAILABLE) {
          this._markComboCooldown(idx, activeModel, COOLDOWN.KEY_BAD);
          console.warn(`[GEMINI_IMAGE_RETRY] key#${idx + 1} model=${activeModel} unavailable; trying next pool key`);
          continue;
        }
        throw error;
      }
    }

    throw new Error(`GEMINI_IMAGE_ALL_KEYS_EXHAUSTED: ${lastError?.message || 'Semua API key image gagal.'}`);
  }

  async _streamRequest(activeModel, key, idx, requestBody, onChunk, t0) {
    const url = `${this.baseUrl}/models/${activeModel}:streamGenerateContent?alt=sse`;
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': key },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(60000),
      });
    } catch (fe) {
      const e = new Error(`GEMINI_STREAM_FETCH: ${fe.message}`);
      e._geminiErrorType = ERROR_TYPE.FATAL; throw e;
    }
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      const e = new Error(`GEMINI_STREAM_HTTP ${response.status} key#${idx+1} model=${activeModel}: ${errText.slice(0,120)}`);
      e._geminiErrorType = classifyHttpError(response.status); throw e;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '', fullText = '', lastParsed = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data: ')) continue;
        const js = t.slice(6).trim();
        if (!js || js === '[DONE]') continue;
        try {
          const parsed = JSON.parse(js);
          lastParsed = parsed;
          const chunk  = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (chunk) { fullText += chunk; onChunk(chunk); }
        } catch { }
      }
    }

    // Jika stream selesai tapi tidak ada teks — cek apakah diblokir
    if (!fullText.trim()) {
      const { blocked, reason } = _analyzeGeminiResponse(lastParsed);
      const finalReason = reason || 'EMPTY_STREAM';
      const e = new Error(`GEMINI_EMPTY_STREAM key#${idx+1} model=${activeModel} reason=${finalReason}`);
      e._geminiErrorType = ERROR_TYPE.EMPTY_OUTPUT;
      e._geminiEmptyReason = finalReason;
      console.warn(`[GEMINI_EMPTY_STREAM] key#${idx+1} model=${activeModel} reason=${finalReason}`);
      throw e;
    }

    console.log(`[GEMINI_STREAM_OK] key#${idx+1} model=${activeModel} chars=${fullText.length} ${Date.now()-t0}ms`);
    return fullText;
  }

  async _nonStreamRequest(activeModel, key, idx, requestBody, t0) {
    const url = `${this.baseUrl}/models/${activeModel}:generateContent`;
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': key },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(45000),
      });
    } catch (fe) {
      const e = new Error(`GEMINI_FETCH: ${fe.message}`);
      e._geminiErrorType = ERROR_TYPE.FATAL; throw e;
    }
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      const e = new Error(`GEMINI_HTTP ${response.status} key#${idx+1} model=${activeModel}: ${errText.slice(0,120)}`);
      e._geminiErrorType = classifyHttpError(response.status); throw e;
    }
    const data = await response.json();

    // Deteksi empty / blocked output (HTTP 200 tapi content kosong atau diblokir safety)
    const { blocked, reason } = _analyzeGeminiResponse(data);
    if (blocked) {
      const e = new Error(`GEMINI_EMPTY_OUTPUT key#${idx+1} model=${activeModel} reason=${reason}`);
      e._geminiErrorType = ERROR_TYPE.EMPTY_OUTPUT;
      e._geminiEmptyReason = reason;
      console.warn(`[GEMINI_EMPTY] key#${idx+1} model=${activeModel} reason=${reason}`);
      throw e;
    }

    const text = data.candidates[0].content.parts[0].text;
    console.log(`[GEMINI_OK] key#${idx+1} model=${activeModel} chars=${text.length} ${Date.now()-t0}ms`);
    return text;
  }

  async healthCheck() {
    const available = await this.isAvailable();
    const keys      = this._getAllApiKeys();
    return {
      provider: this.name, configured: keys.length > 0,
      keyCount: keys.length, modelChain: this._modelChain,
      combinations: keys.length * this._modelChain.length,
      status: available ? 'READY' : 'UNAVAILABLE', model: this.defaultModel,
    };
  }
}

export const geminiProviderInstance = new GeminiProvider();
export default geminiProviderInstance;
