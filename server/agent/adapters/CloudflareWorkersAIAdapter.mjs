/**
 * CloudflareWorkersAIAdapter.mjs
 * Adapter untuk Cloudflare Workers AI image generation (free tier).
 * Endpoint: POST /client/v4/accounts/{ACCOUNT_ID}/ai/run/@cf/{model}
 * Auth: Authorization: Bearer {CLOUDFLARE_API_TOKEN}
 * Free tier: ~50–200 images/day, resets daily 00:00 UTC.
 * Env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_IMAGE_MODEL (optional).
 */
import fs from 'fs';
import path from 'path';

export class CloudflareWorkersAIAdapter {
  constructor() {
    this._token = '';
    this._accountId = '';
    this._model = '@cf/bytedance/stable-diffusion-xl-lightning';
    this._baseUrl = null;
  }

  _resolveConfig() {
    this._token = process.env.CLOUDFLARE_API_TOKEN || '';
    this._accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
    this._model = process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/bytedance/stable-diffusion-xl-lightning';
    this._baseUrl = this._accountId ? `https://api.cloudflare.com/client/v4/accounts/${this._accountId}/ai/run/${this._model}` : null;
    return { token: this._token, accountId: this._accountId, model: this._model, baseUrl: this._baseUrl };
  }

  isConfigured() {
    const { token, accountId } = this._resolveConfig();
    return Boolean(token && accountId);
  }

  async probe(fetchFn = globalThis.fetch) {
    const { token, accountId, model, baseUrl } = this._resolveConfig();
    if (!token || !accountId) {
      return { available: false, provider: 'CLOUDFLARE_WORKERS_AI', reason: 'Cloudflare Workers AI not configured (CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID missing).' };
    }
    try {
      const r = await fetchFn(baseUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'probe' }),
        signal: AbortSignal.timeout(15000)
      });
      if (r.ok) { return { available: true, provider: 'CLOUDFLARE_WORKERS_AI', reason: `Cloudflare Workers AI reachable (model=${model}).` }; }
      const t = (await r.text().catch(() => '')).slice(0, 200);
      return { available: false, provider: 'CLOUDFLARE_WORKERS_AI', reason: `Cloudflare Workers AI HTTP ${r.status}: ${t}` };
    } catch (err) {
      return { available: false, provider: 'CLOUDFLARE_WORKERS_AI', reason: `Cloudflare Workers AI unreachable: ${err.message}` };
    }
  }
  async generate(params, fetchFn = globalThis.fetch) {
    const { prompt, negativePrompt, aspectRatio, size, generationId, messageId, signal, requestId } = params;
    const reqId = requestId || generationId || messageId || `cf-${Date.now()}`;
    const tag = `[CloudflareWorkersAI|${reqId}] `;
    const { token, accountId, model, baseUrl } = this._resolveConfig();
    if (!token || !accountId) {
      return { success: false, error: 'IMAGE_GENERATION_FAILED: Cloudflare Workers AI not configured (CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID missing).', reasonCode: 'CLOUDFLARE_NOT_CONFIGURED' };
    }
    const arLabel = aspectRatio === '9:16' ? '9:16' : aspectRatio === '1:1' ? '1:1' : '16:9';
    let cfWidth = null; let cfHeight = null;
    if (size && /^\d+x\d+$/i.test(String(size))) { const [w,h] = String(size).split('x').map(Number); if (w&&h) { cfWidth=w; cfHeight=h; } }
    else if (arLabel === '9:16') { cfWidth = 576; cfHeight = 1024; }
    else if (arLabel === '1:1') { cfWidth = 1024; cfHeight = 1024; }
    else { cfWidth = 1024; cfHeight = 576; }
    let enrichedPrompt = String(prompt || '');
    const mappings = [
      [/\b(kuda|horse)\b/gi, 'horse'], [/\b(kucing|cat)\b/gi, 'cat'], [/\b(anjing|dog)\b/gi, 'dog'],
      [/\b(rumah|house)\b/gi, 'house'], [/\b(mobil|car)\b/gi, 'car'], [/\b(pantai|beach)\b/gi, 'beach'],
      [/\b(gunung|mountain)\b/gi, 'mountain'], [/\b(malam|night)\b/gi, 'night scene'],
      [/\b(senja|sunset|twilight)\b/gi, 'sunset'], [/\b(pagi|morning|sunrise)\b/gi, 'morning sunrise'],
      [/\b(siang|daylight)\b/gi, 'bright daylight']
    ];
    for (const [re, repl] of mappings) enrichedPrompt = enrichedPrompt.replace(re, repl);
    if (!enrichedPrompt.trim()) enrichedPrompt = 'futuristic AI visual';
    const body = { prompt: enrichedPrompt }; if (cfWidth&&cfHeight) { body.width = cfWidth; body.height = cfHeight; }
    console.log(`${tag}[CLOUDFLARE] model=${model} aspectRatio=${arLabel} size=${cfWidth}x${cfHeight}`);
    try {
      const r = await fetchFn(baseUrl, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: this._requestSignal(signal, 120000) });
      if (!r.ok) { const t = (await r.text().catch(()=>'')).slice(0,400); return { success: false, error: `IMAGE_GENERATION_FAILED: Cloudflare HTTP ${r.status}: ${t}`, reasonCode: 'CLOUDFLARE_HTTP_ERROR' }; }
      const ct = String(r.headers.get('content-type') || '');
      let imageBytes = null;
      let mimeType = 'image/png';
      if (ct.includes('application/json')) {
        const json = await r.json().catch(()=>null);
        if (!json || !json.success) { const errMsg = json && json.errors ? JSON.stringify(json.errors) : 'Cloudflare returned no result'; return { success: false, error: `IMAGE_GENERATION_FAILED: Cloudflare error: ${errMsg}`, reasonCode: 'CLOUDFLARE_ERROR' }; }
        const result = json.result || {};
        let imageB64 = result.image || result.data || null;
        if (!imageB64) { return { success: false, error: 'IMAGE_GENERATION_FAILED: Cloudflare returned no image data.', reasonCode: 'CLOUDFLARE_NO_IMAGE' }; }
        if (typeof imageB64 === 'string' && imageB64.startsWith('data:')) { const match = imageB64.match(/^data:([^;]+);base64,/); if (match) { mimeType = match[1]; imageB64 = imageB64.slice(match[0].length); } }
        try { imageBytes = Buffer.from(imageB64, 'base64'); } catch (err) { return { success: false, error: `IMAGE_GENERATION_FAILED: Cloudflare image decode error: ${err.message}`, reasonCode: 'CLOUDFLARE_DECODE_ERROR' }; }
      } else {
        // Raw image bytes (Cloudflare returns image/* directly for image models).
        const arr = await r.arrayBuffer().catch(()=>null);
        if (!arr || arr.byteLength < 1024) { return { success: false, error: `IMAGE_GENERATION_FAILED: Cloudflare returned empty body (${arr ? arr.byteLength : 0} bytes)`, reasonCode: 'CLOUDFLARE_EMPTY_IMAGE' }; }
        imageBytes = Buffer.from(arr);
        if (ct.includes('jpeg') || ct.includes('jpg')) mimeType = 'image/jpeg';
        else if (ct.includes('webp')) mimeType = 'image/webp';
        else if (ct.includes('png')) mimeType = 'image/png';
        if (!imageBytes || imageBytes.length < 1024) { return { success: false, error: `IMAGE_GENERATION_FAILED: Cloudflare returned empty/invalid image (${imageBytes?imageBytes.length:0} bytes)`, reasonCode: 'CLOUDFLARE_EMPTY_IMAGE' }; }
        const isPng = imageBytes.length >= 8 && imageBytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]));
        const isJpeg = imageBytes.length >= 3 && imageBytes[0]===0xFF && imageBytes[1]===0xD8 && imageBytes[2]===0xFF;
        const isWebp = imageBytes.length >= 12 && imageBytes.subarray(8,12).toString('ascii') === 'WEBP';
        if (!isPng && !isJpeg && !isWebp) { return { success: false, error: 'IMAGE_GENERATION_FAILED: Cloudflare returned invalid image magic bytes', reasonCode: 'CLOUDFLARE_INVALID_IMAGE' }; }
      }
      return { success: true, imageBytes, mimeType, width: cfWidth, height: cfHeight, model, provider: 'CLOUDFLARE_WORKERS_AI' };
    } catch (err) { return { success: false, error: `IMAGE_GENERATION_FAILED: ${err.message}`, reasonCode: 'CLOUDFLARE_EXCEPTION' }; }
  }

  _requestSignal(signal, timeoutMs = 120000) { if (signal) return signal; return AbortSignal.timeout(timeoutMs); }
}

export const cloudflareWorkersAIAdapterInstance = new CloudflareWorkersAIAdapter();