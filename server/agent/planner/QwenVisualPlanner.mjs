/**
 * QwenVisualPlanner.mjs
 * Primary visual design planner for JIN image generation via 9Router.
 *
 * Pipeline position:
 *   USER PROMPT
 *   → QwenVisualPlanner (llama.cpp :8080)  → structured visual spec
 *   → NineRouterGatewayAdapter             → image artifact
 *   → IMAGE_STUDIO (artifact consumer)     → reference / artifact container
 *
 * Security:
 *   - Never logs the prompt verbatim in production (only requestId + domain).
 *   - Never exposes the NINEROUTER_KEY.
 *
 * When Qwen (llama.cpp :8080) is unreachable or produces invalid JSON,
 * a deterministic local compiler produces a valid fallback spec so the
 * pipeline does not lose user intent. The planner tags the result with
 * planner='QWEN' | 'DETERMINISTIC' so every image artifact is auditable.
 */

import { config } from '../../config/env.mjs';
import { maskSecrets } from '../adapters/NineRouterGatewayAdapter.mjs';

const PLANNER_TIMEOUT_MS = 90_000;
const MAX_REPAIR_ATTEMPTS = 2;

/**
 * The strict schema every planner output must satisfy.
 * Keys not present in the schema are stripped.
 */
export const VISUAL_SPEC_SCHEMA_KEYS = new Set([
  'subject', 'visualIntent', 'style', 'composition', 'lighting', 'camera',
  'colorPalette', 'aspectRatio', 'size', 'prompt', 'negativePrompt', 'domain'
]);

function _clamp(val, fallback = '') {
  return (typeof val === 'string' ? val.trim() : typeof val === 'number' ? String(val) : Array.isArray(val) ? val.filter(Boolean).map(String) : fallback);
}

function _validateSpec(spec) {
  if (!spec || typeof spec !== 'object') return { ok: false, reason: 'Spec is not an object' };
  if (!_clamp(spec.subject)) return { ok: false, reason: 'Missing or empty subject' };
  if (!_clamp(spec.prompt)) return { ok: false, reason: 'Missing or empty prompt' };
  const ar = _clamp(spec.aspectRatio, '16:9');
  if (!['16:9', '9:16', '1:1'].includes(ar)) return { ok: false, reason: `Invalid aspectRatio "${ar}"` };
  const size = _clamp(spec.size, '16:9');
  if (!['912x512', '512x912', '912x912', '1024x1024'].includes(String(size))) return { ok: false, reason: `Invalid size "${size}"` };
  if (typeof spec.visualIntent !== 'string' || !spec.visualIntent.trim()) return { ok: false, reason: 'Missing visualIntent' };
  if (typeof spec.style !== 'string' || !spec.style.trim()) return { ok: false, reason: 'Missing style' };
  if (typeof spec.composition !== 'string' || !spec.composition.trim()) return { ok: false, reason: 'Missing composition' };
  return { ok: true };
}

/** Strip to schema and normalise types. */
function _normaliseSpec(raw) {
  const out = {};
  for (const key of VISUAL_SPEC_SCHEMA_KEYS) {
    if (raw[key] !== undefined) out[key] = _clamp(raw[key], key === 'colorPalette' ? [] : '');
  }
  out.aspectRatio = ['16:9', '9:16', '1:1'].includes(out.aspectRatio) ? out.aspectRatio : '16:9';
  out.size = ['912x512', '512x912', '912x912', '1024x1024'].includes(out.size) ? out.size : (out.aspectRatio === '9:16' ? '512x912' : '912x512');
  return out;
}

/** Extract JSON object from fenced code block or raw string. */
function _extractJSON(text = '') {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : text;
  const first = body.indexOf('{');
  const last = body.lastIndexOf('}');
  if (first < 0 || last <= first) return null;
  try { return JSON.parse(body.slice(first, last + 1)); } catch { return null; }
}

const PLANNER_SYSTEM_PROMPT = `You are JIN Visual Design Planner, an enterprise-grade visual prompt architect.

Your task: given a user image-generation prompt, output a SINGLE raw JSON object (no explanation, no markdown, no extra keys) describing the exact visual blueprint for the image.

Keys (all required):
- subject (string): the primary subject, described concisely in English.
- visualIntent (string): one of "photorealistic", "illustration", "infographic", "concept-art", "3D-render", "flat-design".
- style (string): e.g. "enterprise-corporate", "cinematic", "minimalist", "photorealistic", "cartoon", "technical".
- composition (string): description of subject placement, frame balance, and negative space.
- lighting (string): e.g. "studio-soft", "golden-hour-warm", "dramatic-rim", "overcast-flat", "backlit".
- camera (string): e.g. "eye-level-medium", "aerial-wide", "macro-closeup", "low-angle", "isometric".
- colorPalette (array of 3-6 hex colors): dominant palette for the image.
- aspectRatio (string): "16:9" (widescreen), "9:16" (portrait), or "1:1" (square).
- size (string): one of "912x512", "512x912", "912x912", "1024x1024".
- prompt (string): the final diffusion prompt in clear English. Preserve user intent. Add atmospheric, composition, and style modifiers. NO fabrications. Max 200 words.
- negativePrompt (string): specific quality/taste guardrails. NO generic "ugly, blurry" — be specific to the domain.
- domain (string): one of "PRESENTATION", "HOUSE_DESIGN", "GENERAL".

Output ONLY the raw JSON object. Nothing else.`;

export class QwenVisualPlanner {
  constructor() {
    this._llamaUrl = config.localLLM?.baseUrl || 'http://127.0.0.1:8080';
    this._model = config.localLLM?.model || 'qwen2.5-3b-instruct-q4_k_m.gguf';
    this._timeoutMs = config.localLLM?.timeoutMs || PLANNER_TIMEOUT_MS;
  }

  _requestSignal(signal, timeoutMs) {
    const t = AbortSignal.timeout(timeoutMs || this._timeoutMs);
    if (!signal) return t;
    if (typeof AbortSignal.any === 'function') return AbortSignal.any([signal, t]);
    return signal;
  }

  /** Call llama.cpp /v1/chat/completions and return raw text. */
  _resolveModel() {
    if (this._model && !this._model.includes('.gguf') && this._model !== 'auto') {
      return this._model;
    }
    return process.env.NINEROUTER_CHAT_MODEL || 'ag/gemini-3-flash';
  }

  /** Call 9Router /v1/chat/completions and return raw text. */
  async _askQwen({ messages, fetchFn, signal }) {
    const fn = fetchFn || globalThis.fetch;
    const url = `${this._llamaUrl}/v1/chat/completions`;
    const model = this._resolveModel();
    const body = JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 900,
      stream: false
    });

    const headers = { 'Content-Type': 'application/json' };
    const key = String(process.env.NINEROUTER_KEY || '').trim();
    if (key && !['NINEROUTER_KEY_ANDA', 'YOUR_NINEROUTER_KEY'].includes(key)) {
      headers['Authorization'] = `Bearer ${key}`;
    }

    const res = await fn(url, {
      method: 'POST',
      headers,
      body,
      signal: this._requestSignal(signal, this._timeoutMs)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`9Router HTTP ${res.status}: ${maskSecrets(text).slice(0, 200)}`);
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content || '';
    if (!content) throw new Error('Planner returned empty content');
    return content;
  }

  _deterministicSpec({ prompt, originalPrompt, aspectRatio = '16:9', domain = 'GENERAL' }) {
    const p = String(prompt || originalPrompt || 'visual illustration').trim();
    const ar = ['16:9', '9:16', '1:1'].includes(aspectRatio) ? aspectRatio : '16:9';
    const size = ar === '9:16' ? '512x912' : ar === '1:1' ? '1024x1024' : '912x512';
    return {
      subject: p.slice(0, 80),
      visualIntent: 'photorealistic',
      style: 'cinematic',
      composition: 'centered subject, dynamic framing with natural lighting and deep contrast',
      lighting: 'cinematic studio lighting with subtle ambient illumination',
      camera: 'eye-level-medium, sharp focus, 8k resolution',
      colorPalette: ['#0f172a', '#00e5ff', '#38bdf8', '#f8fafc'],
      aspectRatio: ar,
      size,
      prompt: `${p}, highly detailed, sharp focus, professional digital art, photorealistic, cinematic composition, masterpiece, 8k`,
      negativePrompt: 'blurry, distorted, low quality, oversaturated, deformed, watermark, text',
      domain: domain || 'GENERAL'
    };
  }

  /**
   * Main entry: generate a validated visual design spec.
   * Tries 9Router up to MAX_REPAIR_ATTEMPTS, then falls back to deterministic compiler.
   * @returns {{ success:true, spec, planner:'QWEN'|'DETERMINISTIC', requestId, error? }}
   */
  async generateVisualSpec({ prompt, originalPrompt, aspectRatio = '16:9', negativePrompt = '', requestId = null, fetchFn = null, signal = null, domain = 'GENERAL' } = {}) {
    const reqId = requestId || `qp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const tag = `[${reqId}] `;

    let lastError = null;
    let spec = null;

    for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
      const repairNote = attempt === 0 ? '' : `\n\nREPAIR INSTRUCTION: Your previous output was invalid JSON (${lastError || 'parse error'}). Return ONLY valid raw JSON matching the schema. No markdown.`;
      const messages = [
        { role: 'system', content: PLANNER_SYSTEM_PROMPT },
        { role: 'user', content: `Domain: ${domain}\nAspect ratio: ${aspectRatio}\nPrompt: ${prompt || originalPrompt || ''}${repairNote}` }
      ];
      try {
        const rawText = await this._askQwen({ messages, fetchFn, signal });
        const parsed = _extractJSON(rawText);
        if (parsed) {
          const normalised = _normaliseSpec(parsed);
          const validation = _validateSpec(normalised);
          if (validation.ok) {
            spec = normalised;
            break;
          }
          lastError = validation.reason;
        } else {
          lastError = 'No JSON object found in LLM output';
        }
      } catch (err) {
        lastError = maskSecrets(err.message);
        if (err.name === 'AbortError' || err.name === 'TimeoutError') break;
      }
    }

    if (spec) {
      console.log(`${tag}[9ROUTER|PLANNER] Visual planner SUCCESS via LLM.`);
      return { success: true, spec, planner: 'QWEN', requestId: reqId };
    }

    console.warn(`${tag}[9ROUTER|PLANNER] LLM planner failed (${lastError}). Engaging deterministic visual spec compiler.`);
    const fallbackSpec = this._deterministicSpec({ prompt, originalPrompt, aspectRatio, domain });
    return { success: true, spec: fallbackSpec, planner: 'DETERMINISTIC', requestId: reqId };
  }
}

export const qwenVisualPlannerInstance = new QwenVisualPlanner();
export default qwenVisualPlannerInstance;