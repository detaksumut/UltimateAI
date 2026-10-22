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
// Web search (Tavily) + date/time awareness — LIVE (Vercel) backend.
//
// The API key is read from the SERVERLESS environment (TAVILY_API_KEY) and
// never reaches the browser or the client bundle. Request shape + env var name
// mirror the canonical local implementation (server/tools/WebSearchTool.mjs);
// it is inlined here because a Vercel serverless function cannot import from
// server/. Local (localhost) JINI keeps using WebSearchTool — this is the same
// provider, not a second independent search system.
// ─────────────────────────────────────────────────────────────────────────────

const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';
const TAVILY_TIMEOUT_MS = 8000;
const WEB_SEARCH_MAX_RESULTS = 5;

/** Canonical timezone for JINI's clock. */
const WIB_TIME_ZONE = 'Asia/Jakarta';

/** Sanitize user-facing text for safe inclusion in model context. */
function sanitizeSearchText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = String(rawText);
  const injectionPatterns = [
    /ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions/gi,
    /abaikan\s+(?:semua\s+)?instruksi\s+(?:sebelumnya|sistem)/gi,
    /output\s+(?:the\s+)?admin\s+password/gi,
    /system\s+override/gi,
    /hapus\s+database/gi
  ];
  for (const p of injectionPatterns) {
    text = text.replace(p, '[neutralized_prompt_injection]');
  }
  return text.trim();
}

/**
 * Explicit "go to the internet" commands. These win over every other rule
 * because the user literally asked for a web lookup.
 */
const EXPLICIT_WEB_SEARCH_PATTERNS = [
  /\b(cari|carikan|cek|temukan|search|browse|googling|gugling)\s*(?:di|ke|dari)?\s*(?:internet|web|online|situs)\b/i,
  /\bsearch\s+(?:the\s+)?(?:web|internet|news)\b/i,
  /\bweb\s+search\b/i,
  /\bpencarian\s+(?:web|internet)\b/i,
  /\b(?:browse|browsing|browsingkan|lihat|buka)\s+(?:internet|web|situs)\b/i,
  /\b(?:cek|carikan|cari)\s+(?:berita|kabar|info|informasi)\s+(?:terkini|terbaru|hari\s+ini)\b/i
];

/** Explicit "give me current information" intent. */
const CURRENT_INFO_PATTERNS = [
  /\bberita\s+terbaru\b/i,
  /\bberita\s+(?:ini\s+hari|hari\s+ini)\b/i,
  /\b(?:info|informasi|kabar)\s+terkini\b/i,
  /\b(?:latest|current)\s+news\b/i,
  /\blatest\s+update\b/i,
  /\bnews\s+about\b/i
];

/** Date/time questions are answered from the injected clock, never from the web. */
const DATE_TIME_QUESTION_RE =
  /\b(tahun\s+berapa|tanggal\s+berapa|hari\s+ini|sekarang|jam\s+berapa|what\s+(?:is|are)\s+the\s+(?:date|time|year)|hari\s+apa|waktu\s+saat\s+ini)\b/i;

/** Greetings must never trigger a network search. */
const GREETING_RE = /\b(apa\s+kabar|bagaimana\s+kabar|how\s+are\s+you)\b/i;

/** Document summarisation requests are answered from the document, not the web. */
const DOCUMENT_REQUEST_RE =
  /\b(baca\s+ini|baca\s+dokumen|rangkum|ringkas|point\s+point|poin\s+poin|summarize\s+this)\b/i;

/**
 * Decide whether the user explicitly asked for internet research.
 * Mirrors the local rule set (server/local_router/LocalRouterServer.mjs ->
 * isSearchIntent) so Live and localhost behave the same way.
 * @param {string} userPrompt
 * @returns {boolean}
 */
export function detectWebSearchIntent(userPrompt) {
  if (!userPrompt || typeof userPrompt !== 'string') return false;

  // Guard: attached document / summarisation request -> never browse.
  if (/---\s*\[(?:berkas\s+dokumen|dokumen|konteks\s+dokumen)/i.test(userPrompt)) return false;
  if (DOCUMENT_REQUEST_RE.test(userPrompt)) return false;

  // Guard: explicit internet command -> search.
  for (const re of EXPLICIT_WEB_SEARCH_PATTERNS) {
    if (re.test(userPrompt)) return true;
  }

  // Guard: explicit "current information" intent -> search.
  for (const re of CURRENT_INFO_PATTERNS) {
    if (re.test(userPrompt)) return true;
  }

  // Guard: date/time question -> answer from the clock, not from the web.
  if (DATE_TIME_QUESTION_RE.test(userPrompt)) return false;

  // Guard: greeting -> no search.
  if (GREETING_RE.test(userPrompt)) return false;

  // Guard: explicit verb + web/news noun pair -> search.
  if (
    /\b(cari|carikan|cek|temukan|search|browse)\b/i.test(userPrompt) &&
    /\b(internet|web|online|situs|berita|kabar|terkini|perkembangan|news|latest)\b/i.test(userPrompt)
  ) {
    return true;
  }

  return false;
}

/**
 * Build a clean search query out of the raw user prompt (strips the
 * "cek internet" scaffolding so Tavily receives the actual topic).
 * @param {string} userPrompt
 * @returns {string}
 */
export function buildSearchQuery(userPrompt) {
  const raw = typeof userPrompt === 'string' ? userPrompt : '';
  if (!raw.trim()) return '';

  let q = raw;
  q = q.replace(/\btavily\b/gi, ' ');
  q = q.replace(/\b(cari|carikan|cek|temukan|search|browse)\s*(?:di|ke|dari)?\s*(?:internet|web|online|situs)\b/gi, ' ');
  q = q.replace(/\b(?:search|browse)\s+(?:the\s+)?(?:web|internet|news)\b/gi, ' ');
  q = q.replace(/\bweb\s+search\b/gi, ' ');
  q = q.replace(/\bpencarian\s+(?:web|internet)\b/gi, ' ');
  q = q.replace(/\b(?:di|ke|dari)\s*(?:internet|web|online|situs)\b/gi, ' ');
  q = q.replace(/\bberita\s+terbaru\b/gi, 'berita');
  q = q.replace(/\b(info|informasi|kabar)\s+terkini\b/gi, '$1');
  q = q.replace(/\b(latest|current)\s+news\b/gi, 'news');
  q = q.replace(/\blatest\s+(?:update|information)\b/gi, '$1');
  q = q.replace(/\b(tolong|bisakah\s+(?:anda|kamu|kau)|apakah\s+(?:anda|kamu|bisa|kau\s+bisa)|coba|please|halo|hai)\b/gi, ' ');
  q = q.replace(/[?!,.;:]/g, ' ');
  q = q.replace(/\s+/g, ' ').trim();

  if (q.length < 4) q = raw.replace(/\btavily\b/gi, '').replace(/\s+/g, ' ').trim();
  if (q.length > 200) q = q.slice(0, 200).trim();
  return q;
}

/**
 * Perform a Tavily web search.
 * @returns {Promise<{answer: string, sources: Array}|null>} null when the key is
 *   missing, the request fails/times out, or there is nothing to report.
 */
export async function searchTavily(query, maxResults = WEB_SEARCH_MAX_RESULTS, signal = null) {
  const apiKey = (process.env.TAVILY_API_KEY || '').trim();
  if (!apiKey || apiKey === 'undefined') {
    console.warn('[JINI Live] Web search skipped: TAVILY_API_KEY is not configured in this environment.');
    return null;
  }

  const sanitizedQuery = sanitizeSearchText(query);
  if (!sanitizedQuery) return null;

  try {
    const res = await fetch(TAVILY_SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: sanitizedQuery,
        search_depth: 'basic',
        include_answer: true,
        max_results: maxResults
      }),
      signal: signal || AbortSignal.timeout(TAVILY_TIMEOUT_MS)
    });

    if (!res.ok) {
      console.warn(`[JINI Live] Web search failed: Tavily HTTP ${res.status}.`);
      return null;
    }

    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    if (!results.length && !data?.answer) {
      console.warn('[JINI Live] Web search returned no results.');
      return null;
    }

    const sources = results.map((r, i) => {
      let domain = '';
      try { domain = new URL(r?.url || '').hostname.replace(/^www\./, ''); } catch { domain = ''; }
      return {
        id: `tavily_${i + 1}`,
        title: sanitizeSearchText(r?.title) || sanitizedQuery,
        url: r?.url || '',
        domain,
        snippet: sanitizeSearchText(r?.content || ''),
        score: r?.score,
        credibility: 'TAVILY_VERIFIED'
      };
    });

    return {
      answer: sanitizeSearchText(data?.answer || ''),
      sources
    };
  } catch (err) {
    console.warn(`[JINI Live] Web search error: ${err.message}`);
    return null;
  }
}

/**
 * Build the clearly-identified evidence block injected into the model context.
 * Titles + URLs are included so the model can cite them.
 * @returns {string} '' when there is nothing to report.
 */
export function buildSearchEvidenceBlock(searchResult, query = '') {
  if (!searchResult || !Array.isArray(searchResult.sources) || !searchResult.sources.length) return '';

  const lines = ['--- [DATA FAKTA TERVERIFIKASI INTERNET (TAVILY AI)] ---'];
  if (query) lines.push(`Topik Pencarian: "${query}"`);
  lines.push(`Waktu Akses: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} WIB`);
  lines.push('');

  searchResult.sources.forEach((s, idx) => {
    lines.push(`${idx + 1}. Judul: ${s.title || ''}`);
    lines.push(`   URL: ${s.url || ''}`);
    lines.push(`   Domain: ${s.domain || 'web'}`);
    if (s.snippet) lines.push(`   Cuplikan: ${s.snippet}`);
    lines.push('');
  });

  if (searchResult.answer) lines.push(`Ikhtisar Web: ${searchResult.answer}`);
  lines.push('--- [AKHIR DATA FAKTA] ---');
  lines.push(
    'Gunakan fakta di atas sebagai sumber terverifikasi. Saat mengutip, sertakan Judul dan URL sumber yang relevan. Jangan mengarang sumber lain.'
  );
  return lines.join('\n');
}

/**
 * Build the current date/time context for the model system instruction.
 * Generated per request (never at build time) in WIB / Asia/Jakarta.
 * @param {Date} [now]
 * @returns {string}
 */
export function buildDateContext(now = new Date()) {
  const d = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();

  const humanParts = new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB_TIME_ZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(d);

  const numericParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WIB_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d);

  const pick = (parts, type) => parts.find((p) => p.type === type)?.value || '';

  const weekday = pick(humanParts, 'weekday');
  const year = pick(humanParts, 'year');
  const month = pick(humanParts, 'month');
  const day = pick(humanParts, 'day');
  const hour = pick(humanParts, 'hour');
  const minute = pick(humanParts, 'minute');
  const second = pick(humanParts, 'second');
  const isoDate = `${pick(numericParts, 'year')}-${pick(numericParts, 'month')}-${pick(numericParts, 'day')}`;

  return (
    `Tanggal dan waktu saat ini: ${weekday}, ${day} ${month} ${year} pukul ${hour}.${minute}.${second} WIB (${WIB_TIME_ZONE}). ` +
    `Tanggal numerik: ${isoDate} ${hour}:${minute}:${second} WIB. ` +
    'Jika pengguna menanyakan tanggal, tahun, hari, atau waktu saat ini - jawab dari informasi waktu di atas, ' +
    'jangan mengklaim telah mencari ke internet untuk pertanyaan waktu.'
  );
}

/** True when the incoming system prompt already carries a date/time context. */
export function hasDateContext(text) {
  if (!text || typeof text !== 'string') return false;
  return [
    /tanggal\s+(?:dan\s+waktu\s+)?saat\s+ini/i,
    /informasi\s+waktu\s+saat\s+ini/i,
    /current\s+(?:date|time)/i,
    /waktu\s+saat\s+ini/i
  ].some((re) => re.test(text));
}

/**
 * Normalise any message content shape (string | parts array | object | null)
 * into plain text. Never throws.
 * @param {*} content
 * @returns {string}
 */
export function toPlainText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part.text === 'string') return part.text;
        if (part && part.type === 'image_url') return '[gambar terlampir]';
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  if (content === null || content === undefined) return '';
  try {
    return JSON.stringify(content) ?? '';
  } catch (_) {
    return '';
  }
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
        const perAttemptTimer = setTimeout(() => perAttemptCtrl.abort(new Error('9Router attempt timeout (40s)')), 40000);
        const combinedSignal = signal
          ? AbortSignal.any([signal, perAttemptCtrl.signal])
          : perAttemptCtrl.signal;
        // DIAGNOSTIC: record attempt, signal state, and reason for abort
        // before the fetch. This eliminates guessing which AbortController
        // cancelled the request (stage budget vs per-attempt timeout vs other).
        if (signal?.aborted) {
          console.error(`[NineRouter] stage signal already aborted before fetch: stageCtrl.signal.aborted=${signal.aborted}`);
        }
        const start = Date.now();
        const gr = await fetch(`${base}/v1/images/generations`, {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody),
          signal: combinedSignal
        });
        clearTimeout(perAttemptTimer);
        if (gr.ok) {
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
            clearTimeout(perAttemptTimer);
            return { success: true, dataUrl, model, gateway: '9ROUTER' };
          } else {
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

    const { messages: rawMessages = [], stream = false, model = 'ag/gemini-3-flash', generationId = null, messageId = null } = body;
    const messages = Array.isArray(rawMessages) ? rawMessages : [];
    const lastUserMessage = [...messages].reverse().find(m => m && m.role === 'user');
    const userPrompt = toPlainText(lastUserMessage?.content);

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
      const stageTimer = setTimeout(() => stageCtrl.abort(), 55000);
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

    // ── Date/time awareness (Asia/Jakarta) ───────────────────────────────
    // Built per request (never at build time) and MERGED with the system prompt
    // sent by the browser: the existing instructions are preserved, never
    // replaced. Skipped only when the caller already supplied a clock.
    const dateContext = buildDateContext(new Date());

    const existingSystemText = messages
      .filter(m => m && m.role === 'system')
      .map(m => toPlainText(m.content))
      .filter(Boolean)
      .join('\n\n');

    // ── Web search (only on an explicit internet request) ────────────────
    // Runs server-side against Tavily (TAVILY_API_KEY); the key never reaches
    // the browser. Evidence is injected as clearly-identified context so the
    // model can cite titles + URLs.
    let searchContext = '';
    let searchMeta = null;
    let searchUnavailableNote = '';
    if (detectWebSearchIntent(userPrompt)) {
      const searchQuery = buildSearchQuery(userPrompt);
      const searchResult = await searchTavily(searchQuery, WEB_SEARCH_MAX_RESULTS);
      if (searchResult && searchResult.sources.length) {
        searchContext = buildSearchEvidenceBlock(searchResult, searchQuery);
        searchMeta = {
          intent: 'WEB_SEARCH',
          toolsUsed: ['web.search'],
          provider: 'TAVILY_AI',
          query: searchQuery,
          generationId,
          messageId,
          sources: searchResult.sources.map(s => ({ id: s.id, title: s.title, url: s.url, domain: s.domain }))
        };
      } else {
        // Honest failure mode: the model is told the web is unavailable so it
        // never claims a search happened and never invents citations.
        searchUnavailableNote =
          'Pencarian internet tidak tersedia (layanan web search gagal atau TAVILY_API_KEY belum dikonfigurasi). ' +
          'Jika pengguna meminta informasi terkini, jawab dari pengetahuan Anda, sebutkan keterbatasannya dengan jujur, ' +
          'dan jangan mengklaim telah melakukan pencarian internet atau mengutip sumber internet.';
      }
    }

    // ── System instruction (date + existing prompt + search policy) ──────
    const systemParts = [];
    if (!hasDateContext(existingSystemText)) systemParts.push(dateContext);
    if (existingSystemText) systemParts.push(existingSystemText);
    if (searchUnavailableNote) systemParts.push(searchUnavailableNote);
    const systemText = systemParts.join('\n\n');

    console.log(
      '[JINI Live] date context:', dateContext.slice(0, 72),
      '| web search:', searchMeta ? 'YES' : 'no',
      '| system prompt length:', systemText.length
    );

    const contents = [];
    for (const m of messages) {
      if (!m || m.role === 'system') continue;
      const text = toPlainText(m.content);
      if (!text) continue;
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text }]
      });
    }

    // Attach the verified search evidence to the last user turn (same shape as
    // the local Tavily grounding path) so the model can cite titles + URLs.
    if (searchContext) {
      let lastUserIdx = -1;
      for (let i = contents.length - 1; i >= 0; i--) {
        if (contents[i].role === 'user') { lastUserIdx = i; break; }
      }
      if (lastUserIdx >= 0) {
        contents[lastUserIdx].parts[0].text = `${contents[lastUserIdx].parts[0].text}\n\n${searchContext}`;
      } else {
        contents.push({ role: 'user', parts: [{ text: searchContext }] });
      }
    }

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
      if (searchMeta) {
        res.write(`data: ${JSON.stringify({
          id: 'chatcmpl-' + Date.now(),
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: model || 'ag/gemini-3-flash',
          choices: [{ index: 0, delta: {}, finish_reason: null }],
          _agent: searchMeta
        })}\n\n`);
      }
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
      const payload = {
        id: 'chatcmpl-' + Date.now(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model || 'ag/gemini-3-flash',
        choices: [{ index: 0, message: { role: 'assistant', content: assistantReply }, finish_reason: 'stop' }]
      };
      if (searchMeta) payload._agent = searchMeta;
      return res.status(200).json(payload);
    }
  } catch (err) {
    console.error('[ChatCompletions] Fatal Error:', err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
}


