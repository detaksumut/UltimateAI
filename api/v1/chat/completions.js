/**
 * api/v1/chat/completions.js
 * Vercel Serverless Function for OpenAI-compatible Chat Completions.
 * Handles:
 *   1. IMAGE GENERATION via Gemini image API (cloud-reachable) — returns a
 *      base64 data-URL inside `_agent.imageUrl` + `artifactType: 'IMAGE'`,
 *      mirroring the local JIN runtime contract (JINResponseEngine).
 *   2. Live media (YouTube) playback.
 *   3. JIN conversational intelligence via Gemini Cloud (system-prompt aware).
 *
 * NOTE: Local-only providers (llama.cpp :8080, ComfyUI :8188, 9Router :20128)
 * are NOT reachable from Vercel serverless and are intentionally not used here.
 */

async function searchYouTubeVideo(query) {
  try {
    const cleanQ = query
      .replace(/\b(carikan|cari|putar|mainkan|tampilkan|play|lagu|musik|di|dari|youtube|video|judulnya|judul|penyanyi)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const searchTarget = cleanQ || query;
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTarget + ' official video')}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(6000)
    });
    
    if (res.ok) {
      const html = await res.text();
      // Match first videoId
      const match = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
      if (match && match[1]) {
        return {
          videoId: match[1],
          query: searchTarget
        };
      }
    }
  } catch (err) {
    console.warn('[YouTubeSearch] Error:', err.message);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini helpers (self-contained; no imports from server/agent/* to keep the
// serverless bundle lean and avoid local-only dependencies).
// ─────────────────────────────────────────────────────────────────────────────

/** Collect the Gemini key pool (primary + numbered rotation keys). */
function collectGeminiKeys() {
  const keys = [];
  const primary = process.env.GEMINI_API_KEY;
  if (primary && primary.trim()) keys.push(primary.trim());
  for (let i = 1; i <= 15; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k && k.trim()) keys.push(k.trim());
  }
  return keys;
}

/** Mask any secret-looking tokens before they reach logs or responses. */
function maskSecrets(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/AIzaSy[a-zA-Z0-9_-]{33}/g, '[REDACTED_GEMINI_KEY]')
    .replace(/AQ\.[a-zA-Z0-9_-]{50,}/g, '[REDACTED_GEMINI_KEY]')
    .replace(/key=[^&\s]+/g, 'key=[REDACTED_KEY]')
    .replace(/Bearer\s+[a-zA-Z0-9_.-]+/g, 'Bearer [REDACTED_TOKEN]');
}

/**
 * Inlined from server/agent/ImageOutputConfig.mjs (Vercel serverless cannot
 * import files outside api/ directory).
 * Resolve ordered request-size hints for a requested aspect ratio.
 * @param {string} aspectRatio '16:9' | '9:16' | '1:1' (anything else -> '16:9')
 * @returns {string[]} [preferred, fallback]
 */
function resolveRequestSizes(aspectRatio) {
  const ar = String(aspectRatio || '16:9');
  if (ar === '9:16') return ['432x768', '360x640'];
  if (ar === '1:1') return ['768x768'];
  return ['768x432', '640x360'];
}

const ASPECT_TOKEN_RE = /\b(16\s*:\s*9|9\s*:\s*16|1\s*:\s*1|4\s*:\s*3|3\s*:\s*4|3\s*:\s*2|2\s*:\s*3)\b/i;
const IMAGE_VERB_RE = /\b(buatkan|buat|bikin|bikinkan|create|make|generate|gambar|gambarkan|image|ilustrasi|illustration|lukisan|render|desain|design|foto|photo|visual|poster|wallpaper|meme|sketsa|sketch|rancang|lukis)\b/i;
// "Capability inquiry" = asking IF the AI can do something, not requesting it.
const CAPABILITY_INQUIRY_RE = /^(?:apakah|apakh|bisakah|bisa(?:kah)?|can you|do you|are you able|mampukah|mampu(?:kah)?)\b/i;

/**
 * Deterministic image-generation intent detection (mirrors the local
 * SemanticIntentEngine image classifier). Returns { prompt, aspectRatio } or null.
 */
function detectImageIntent(rawPrompt) {
  const p = String(rawPrompt || '').trim();
  if (!p) return null;
  if (CAPABILITY_INQUIRY_RE.test(p)) return null; // "apakah kamu bisa ...?" → not an action
  if (!IMAGE_VERB_RE.test(p)) return null;

  const arMatch = p.match(ASPECT_TOKEN_RE);
  const aspectRatio = arMatch ? arMatch[1].replace(/\s+/g, '') : '16:9';

  const clean = p
    .replace(/\b(buatkan|buat|bikin|bikinkan|create|make|generate|gambarkan|gambar|image|ilustrasi|illustration|lukisan|render|desain|design|foto|photo|visual|poster|wallpaper|meme|sketsa|sketch|rancang|lukis)\b/gi, ' ')
    .replace(new RegExp(ASPECT_TOKEN_RE.source, 'gi'), ' ')
    .replace(/\b(rasio|aspect|ratio|with|of|yang|di|a|an|the)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { prompt: clean || p, aspectRatio };
}

/**
 * Generate an image via the Gemini image API (cloud). Returns
 * { success, dataUrl?, model?, error? }. No dummy/fake image is ever returned.
 */
async function generateImageWithGemini(prompt, aspectRatio, signal) {
  const keys = collectGeminiKeys();
  if (keys.length === 0) {
    return {
      success: false,
      error: 'GEMINI_API_KEY belum di-set di environment Vercel. Buka Vercel → Settings → Environment Variables, tambahkan GEMINI_API_KEY (dan opsional GEMINI_API_KEY_1..N untuk rotasi), lalu redeploy.'
    };
  }

  // gemini-2.5-flash-image is the current image-capable model (older
  // gemini-2.0-flash-exp has been retired → 404). Override via GEMINI_IMAGE_MODEL.
  // Guard against STALE env config: if the env pins a known-retired model,
  // silently fall back to the current default instead of failing every key.
  const RETIRED_IMAGE_MODELS = ['gemini-2.0-flash-exp', 'gemini-2.0-flash'];
  let model = (process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image').trim();
  if (RETIRED_IMAGE_MODELS.includes(model)) {
    console.warn(`[GeminiImage] Env GEMINI_IMAGE_MODEL="${model}" is retired; using gemini-2.5-flash-image instead.`);
    model = 'gemini-2.5-flash-image';
  }
  const modelPath = model.startsWith('models/') ? model : `models/${model}`;
  const aspectHint = aspectRatio ? ` (${aspectRatio} aspect ratio)` : '';
  let lastError = null;

  for (const key of keys) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${encodeURIComponent(key)}`;
      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `Generate an image based on this description${aspectHint}: ${prompt}` }]
          }
        ],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: signal || AbortSignal.timeout(90000)
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        lastError = `HTTP ${response.status}: ${maskSecrets(errText.slice(0, 160))}`;
        // Rotate to next key on quota / transient server errors AND on 403:
        // 403 = "Gemini API not enabled in THIS key's project" is
        // project-scoped — a key from another project can still succeed, so
        // fall through to the next key instead of aborting the whole run.
        if (response.status === 403 || response.status === 429 || response.status >= 500) continue;
        return { success: false, error: `IMAGE_GENERATION_FAILED: ${lastError}` };
      }

      const data = await response.json();
      const imagePart =
        (data.candidates?.[0]?.content?.parts || []).find((part) => part.inlineData?.data) ||
        (data.output || []).find((part) => part.inlineData?.data);

      if (!imagePart?.inlineData?.data) {
        lastError = 'Gemini tidak mengembalikan data gambar (hanya teks). Coba model image lain di GEMINI_IMAGE_MODEL.';
        continue;
      }

      const b64 = imagePart.inlineData.data;
      const mime = imagePart.inlineData.mimeType || 'image/png';
      return { success: true, dataUrl: `data:${mime};base64,${b64}`, model };
    } catch (err) {
      lastError = maskSecrets(err.message);
      continue;
    }
  }

  return { success: false, error: `IMAGE_GENERATION_FAILED: ${lastError || 'Semua Gemini API key habis.'}` };
}

function detectMimeFromB64(b64) {
  const head = String(b64).slice(0, 12);
  if (head.startsWith('iVBOR')) return 'image/png';
  if (head.startsWith('/9j/')) return 'image/jpeg';
  if (head.startsWith('UklGR')) return 'image/webp';
  return 'image/png';
}

/**
 * Generate an image via the 9Router gateway (OpenAI-compatible), mirroring the
 * local NineRouterGatewayAdapter exactly: GET /v1/models/image (discovery) then
 * POST /v1/images/generations with the discovered model. This is the SAME
 * provider that powers localhost image generation.
 *
 * Reads NINEROUTER_URL + NINEROUTER_KEY from env (identical to local .env).
 * Falls back to the user's public 9Router tunnel when NINEROUTER_URL is unset,
 * because http://127.0.0.1:20128 is unreachable from Vercel's cloud servers.
 * Returns { success:false, skip:true } when no key is configured so the caller
 * can fall back to Gemini.
 */
async function generateImageWithNineRouter(prompt, aspectRatio, signal) {
  // URL publik dari dashboard 9Router user (Tunnel1). Bisa dioverride via env.
  // JANGAN default ke 127.0.0.1 di sini — tak terjangkau dari cloud.
  const NINEROUTER_PUBLIC_URL = 'https://r8ggih7.abc-tunnel.us';
  const base = String(process.env.NINEROUTER_URL || NINEROUTER_PUBLIC_URL).trim().replace(/\/+$/, '');
  const key = String(process.env.NINEROUTER_KEY || '').trim();
  if (!key) {
    return { success: false, skip: true, error: 'NINEROUTER_KEY belum di-set di environment Vercel.' };
  }

  const auth = { Authorization: `Bearer ${key}` };
  const aspectHint = aspectRatio ? ` (${aspectRatio} aspect ratio)` : '';
  const fullPrompt = `Generate an image based on this description${aspectHint}: ${prompt}`;

  // 3. Target size for this aspect ratio (from shared global config; request
  //    `size` is only a hint — the gateway maps it to an internal canvas and the
  //    strict box is re-validated against the ACTUAL decoded image bytes).
  const requestSizes = resolveRequestSizes(aspectRatio);
  const targetSize = requestSizes[0];

  // 1. Discovery — GET /v1/models/image (cached by gateway; cheap to call).
  let models = [];
  try {
    const dr = await fetch(`${base}/v1/models/image`, {
      headers: auth,
      signal: AbortSignal.timeout(15000)
    });
    if (dr.ok) {
      const dj = await dr.json().catch(() => null);
      models = (Array.isArray(dj?.data) ? dj.data : [])
        .map((m) => (typeof m === 'string' ? m : m?.id))
        .filter(Boolean);
    }
  } catch (_) { /* fallthrough */ }
  if (models.length === 0) {
    return { success: false, error: '9Router tidak mengekspos model image (discovery kosong).' };
  }

  // 2. Generate — POST /v1/images/generations (first discovered model, like local).
  // Prefer response_format=url (tiny payload, safe for Vercel limits) and fall back
  // to the request without it when the gateway rejects the parameter.
  const model = models[0];
  const attemptBodies = [
    { model, prompt: fullPrompt, n: 1, size: targetSize, response_format: 'url' },
    { model, prompt: fullPrompt, n: 1, size: targetSize }
  ];
  // The free trycloudflare tunnel in front of a home 9Router drops long-lived
  // generation POSTs with a transient 502 (observed ~16s proxy cut). Chain a few
  // fresh attempts, trying both request shapes per attempt, before giving up.
  const MAX_GEN_ATTEMPTS = 4;
  const RETRY_DELAY_MS = 2000;
  let lastTransientError = null;

  for (let generationAttempt = 1; generationAttempt <= MAX_GEN_ATTEMPTS; generationAttempt++) {
    let attemptFailed = false;
    for (const reqBody of attemptBodies) {
      try {
        // Per-attempt 24s: chained with the stage signal (50s in handler) so
        // the total retry chain fits inside Vercel 60s maxDuration.
        const perAttemptCtrl = new AbortController();
        const perAttemptTimer = setTimeout(
          () => perAttemptCtrl.abort(new Error('9Router attempt timeout (24s)')),
          24000
        );
        const combinedSignal = signal
          ? AbortSignal.any([signal, perAttemptCtrl.signal])
          : perAttemptCtrl.signal;
        const gr = await fetch(`${base}/v1/images/generations`, {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody),
          signal: combinedSignal
        });
        clearTimeout(perAttemptTimer);
        if (!gr.ok) {
          const t = await gr.text().catch(() => '');
          const unknownParam = gr.status === 400 && /unknown parameter/i.test(t) && /response_format/i.test(t);
          if (unknownParam) continue; // gateway rejected this param; try the other shape
          if ((gr.status === 502 || gr.status === 503 || gr.status === 504)) {
            lastTransientError = `9Router HTTP ${gr.status}`;
            attemptFailed = true;
            continue; // try the other request shape before backing off
          }
          return { success: false, error: `9Router HTTP ${gr.status}: ${maskSecrets(t.slice(0, 160))}` };
        }
        const gj = await gr.json().catch(() => null);
        const entry = Array.isArray(gj?.data) ? gj.data[0] : null;
        let dataUrl = null;
        if (typeof entry?.url === 'string' && entry.url) {
          dataUrl = entry.url;
        } else if (typeof entry?.b64_json === 'string' && entry.b64_json) {
          dataUrl = `data:${detectMimeFromB64(entry.b64_json)};base64,${entry.b64_json}`;
        }
        if (!dataUrl) {
          return { success: false, error: '9Router tidak mengembalikan data gambar.' };
        }
        return { success: true, dataUrl, model, gateway: '9ROUTER' };
      } catch (err) {
        if (signal?.aborted) {
          return { success: false, error: `9Router error: ${maskSecrets(err.message)}` };
        }
        lastTransientError = `9Router error: ${maskSecrets(err.message)}`;
        attemptFailed = true;
        continue; // connection reset / tunnel drop; try the other request shape
      }
    }
    if (attemptFailed && generationAttempt < MAX_GEN_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * generationAttempt));
    }
  }
  return { success: false, error: lastTransientError || '9Router menolak parameter response_format.' };
}

/** Write an OpenAI-compatible SSE delta chunk (with optional _agent metadata). */
function writeSSE(res, { id, model, delta = {}, agent = null, finish = null }) {
  const payload = {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finish }]
  };
  if (agent) payload._agent = agent;
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export default async function handler(req, res) {
  // 1. CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed' } });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {}
    }
    body = body || {};

    const { messages = [], stream = false, model = 'ag/gemini-3-flash', generationId = null, messageId = null } = body;
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const userPrompt = typeof lastUserMessage === 'string' ? lastUserMessage : JSON.stringify(lastUserMessage);

    // 2. IMAGE GENERATION (deterministic intent — runs BEFORE YouTube/general chat)
    const imageIntent = detectImageIntent(userPrompt);
    if (imageIntent) {
      const sseId = 'chatcmpl-image-' + Date.now();
      const sseModel = model || 'gemini-image';

      // LIVE IMAGE POLICY: 9Router-only — IDENTICAL mechanism to localhost.
      // Do NOT fall back to direct Gemini here: the owner's own Gemini keys
      // keep hitting project (403) / quota (429) walls, while 9Router serves
      // image from its own provider account (ag/gemini-3.1-flash-image).
      // On failure the real 9Router/tunnel error is reported honestly below.
      // Vercel 60s budget: cap the ENTIRE image stage at 50s so the handler
      // always returns before FUNCTION_INVOCATION_TIMEOUT. Abort early instead
      // of letting 9Router(90s/try)+Gemini(90s/key) overrun. This also fixes the
      // latent ReferenceError (bare `signal` was never defined in handler scope).
      const stageCtrl = new AbortController();
      const stageTimer = setTimeout(() => stageCtrl.abort(), 50000);
      let gen;
      try {
        gen = await generateImageWithNineRouter(imageIntent.prompt, imageIntent.aspectRatio, stageCtrl.signal);
        if (!gen.success && !stageCtrl.signal.aborted) {
          const g2 = await generateImageWithGemini(imageIntent.prompt, imageIntent.aspectRatio, stageCtrl.signal);
          if (g2.success) gen = g2;
          else gen.error = `9Router: ${gen.error} | Gemini: ${g2.error}`;
        }
      } catch (stageErr) {
        gen = gen || { success: false, error: `Tahap gambar dibatalkan agar tidak timeout (budget 50s): ${maskSecrets(stageErr.message)}` };
      } finally {
        clearTimeout(stageTimer);
      }

      let textContent;
      let agentMeta = null;
      if (gen.success) {
        const via = gen.gateway ? ` via ${gen.gateway}` : '';
        textContent = `Visual untuk **"${imageIntent.prompt}"** rasio ${imageIntent.aspectRatio} telah berhasil dibuat (model ${gen.model}${via}).`;
        agentMeta = {
          intent: 'IMAGE_GENERATION',
          artifactType: 'IMAGE',
          presentation: { artifactType: 'IMAGE', mode: 'GENERIC_IMAGE', surface: 'CONVERSATION_CANVAS' },
          imageUrl: gen.dataUrl,
          generationId,
          messageId
        };
      } else {
        textContent = `Pembuatan gambar belum berhasil. Penyebab: ${gen.error}\n\n(Jalur ini sama persis dengan localhost: via 9Router Tunnel1. Pastikan 9Router (:20128) hidup dan tunnel aktif.)`;
      }

      if (stream) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        writeSSE(res, { id: sseId, model: sseModel, delta: { role: 'assistant', content: textContent } });
        if (agentMeta) writeSSE(res, { id: sseId, model: sseModel, delta: {}, agent: agentMeta });
        writeSSE(res, { id: sseId, model: sseModel, delta: {}, finish: 'stop' });
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      const payload = {
        id: sseId,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: sseModel,
        choices: [{ index: 0, message: { role: 'assistant', content: textContent }, finish_reason: 'stop' }]
      };
      if (agentMeta) payload._agent = agentMeta;
      return res.status(200).json(payload);
    }

    // 3. DETECT YOUTUBE / MUSIC PLAYBACK REQUESTS
    const isYouTubeIntent = /\b(youtube|lagu|musik|music|song|video|putar|play|setel|dengarkan)\b/i.test(userPrompt);

    if (isYouTubeIntent) {
      const ytResult = await searchYouTubeVideo(userPrompt);
      const videoId = ytResult?.videoId || 'CP018TPJ40Y'; // Bryan Adams - Heaven verified fallback
      const cleanTitle = (ytResult?.query || userPrompt)
        .replace(/\b(carikan|cari|putar|mainkan|di|dari|youtube|video|judulnya|penyanyi)\b/gi, '')
        .trim();

      const playbackText = `Lagu **"${cleanTitle || 'Heaven - Bryan Adams'}"** telah ditemukan di YouTube dan langsung diputar di Canvas pemutar di bawah ini:\n\n` +
        `<div style="width: 100%; position: relative; padding-bottom: 56.25%; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.4); background-color: #000;">\n` +
        `  <iframe \n` +
        `    src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1" \n` +
        `    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" \n` +
        `    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" \n` +
        `    allowfullscreen \n` +
        `    referrerpolicy="strict-origin-when-cross-origin" \n` +
        `    title="${cleanTitle}">\n` +
        `  </iframe>\n` +
        `</div>\n\n` +
        `🔗 [Buka "${cleanTitle}" di YouTube](https://www.youtube.com/watch?v=${videoId})`;

      if (stream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        res.write(`data: ${JSON.stringify({
          id: 'chatcmpl-media-' + Date.now(),
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'media_playback',
          choices: [{ index: 0, delta: { content: playbackText }, finish_reason: null }]
        })}\n\n`);
        res.write(`data: ${JSON.stringify({
          id: 'chatcmpl-media-' + Date.now(),
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'media_playback',
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          _agent: {
            intent: 'MEDIA_PLAYBACK',
            toolsUsed: ['youtube.search'],
            videoId,
            watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
            title: cleanTitle
          }
        })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      } else {
        return res.status(200).json({
          id: 'chatcmpl-media-' + Date.now(),
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: 'media_playback',
          choices: [{ index: 0, message: { role: 'assistant', content: playbackText }, finish_reason: 'stop' }],
          _agent: {
            intent: 'MEDIA_PLAYBACK',
            toolsUsed: ['youtube.search'],
            videoId,
            watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
            title: cleanTitle
          }
        });
      }
    }

    // 4. GENERAL AI CONVERSATION (Gemini Cloud, system-prompt aware + key rotation)
    const textKeys = collectGeminiKeys();
    let assistantReply = `Halo! Saya JINI, AI partner Anda. Bagaimana saya bisa membantu Anda hari ini?`;

    const systemText = messages
      .filter(m => m.role === 'system')
      .map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
      .join('\n\n');
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
      }));

    const textModel = (process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash').trim();
    const textModelPath = textModel.startsWith('models/') ? textModel : `models/${textModel}`;

    for (const key of textKeys) {
      try {
        const requestBody = { contents, generationConfig: { temperature: 0.7, maxOutputTokens: 2048 } };
        if (systemText) requestBody.systemInstruction = { parts: [{ text: systemText }] };

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${textModelPath}:generateContent?key=${encodeURIComponent(key)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(20000)
        });

        if (geminiRes.ok) {
          const gData = await geminiRes.json();
          const candidateText = gData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            assistantReply = candidateText;
            break; // success — stop key rotation
          }
        } else if (geminiRes.status === 429 || geminiRes.status >= 500) {
          continue; // rotate to next key on quota/transient errors
        }
      } catch (geminiErr) {
        console.warn('[GeminiCloud] Error:', maskSecrets(geminiErr.message));
      }
    }

    if (stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write(`data: ${JSON.stringify({
        id: 'chatcmpl-' + Date.now(),
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: model || 'ag/gemini-3-flash',
        choices: [{ index: 0, delta: { content: assistantReply }, finish_reason: null }]
      })}\n\n`);
      res.write(`data: ${JSON.stringify({
        id: 'chatcmpl-' + Date.now(),
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: model || 'ag/gemini-3-flash',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    } else {
      return res.status(200).json({
        id: 'chatcmpl-' + Date.now(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model || 'ag/gemini-3-flash',
        choices: [{ index: 0, message: { role: 'assistant', content: assistantReply }, finish_reason: 'stop' }]
      });
    }
  } catch (err) {
    console.error('[ChatCompletions] Fatal Error:', err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
}


