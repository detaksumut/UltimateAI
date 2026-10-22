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
      signal: AbortSignal.timeout(5000)
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
  /\bnews\s+about\b/i,
  // Natural Indonesian requests for recent developments should trigger web search
  // even when the user does not explicitly say "cari" or "cek internet".
  /\b(?:ada\s+)?perkembangan\s+(?:baru\s+)?(?:terkait|tentang|mengenai)\b/i,
  /\b(?:apa\s+)?perkembangan\s+(?:berita\s+)?(?:terbaru\s+)?(?:ihsg|idx|indeks\s+harga\s+saham|pasar\s+saham|saham|kebakaran\s+hutan|karhutla|hutan\s+kalimantan|ekonomi|politik)\b/i
];

/**
 * Clock questions are answered from the injected date context, never from the
 * web. Strict on purpose: bare "hari ini" / "sekarang" must NOT disable the
 * search for real topics (e.g. "harga emas sekarang", "berita hari ini").
 */
const DATE_TIME_QUESTION_RE =
  /\b(?:tanggal|tahun|jam|pukul|hari|bulan)\s+(?:berapa|apa)\b|\bsekarang\s+(?:jam|pukul|tanggal|tahun|hari|bulan)\b|\b(?:hari|tanggal|bulan|tahun)\s+ini\s+(?:tanggal|hari|jam)\b|\bwhat\s+(?:is|are)\s+the\s+(?:date|time|day|year)\b|\bwhat\s+time\s+is\s+it\b/i;

/** Greetings must never trigger a network search. */
const GREETING_RE = /\b(apa\s+kabar|bagaimana\s+kabar|how\s+are\s+you|selamat\s+(?:pagi|siang|sore|malam))\b/i;

/** Document summarisation requests are answered from the document, not the web. */
const DOCUMENT_REQUEST_RE =
  /\b(baca\s+ini|baca\s+dokumen|rangkum|ringkas|point\s+point|poin\s+poin|summarize\s+this)\b/i;

/**
 * Fresh-information topics. Their correct answer depends on live data (today's
 * news, disasters, markets, policy). On Live there is no other source for
 * "hari ini", so these MUST hit the web.
 */
const FRESH_INFO_PATTERNS = [
  // Explicit temporal markers
  /\b(terbaru|terkini|mutakhir|hari\s+ini|kemarin|minggu\s+ini|bulan\s+ini|tahun\s+ini|saat\s+ini|sekarang|baru\s+ini|baru\s+saja|latest|current|today)\b/i,
  // News & developments
  /\b(berita|kabar|news|headline|perkembangan|update|situasi|kondisi\s+terkini|kronologi)\b/i,
  // Disasters / weather
  /\b(kebakaran|karhutla|kebakaran\s+hutan|banjir|gempa|erupsi|tsunami|longsor|kekeringan|cuaca|prakiraan\s+cuaca|asap|polusi)\b/i,
  // Markets & economy
  /\b(ihsg|saham|emiten|kurs|rupiah|dolar|inflasi|suku\s+bunga|pasar\s+modal|obligasi|bitcoin|ethereum|crypto|kripto|harga\s+(?:emas|minyak|beras|saham|bitcoin))\b/i,
  // Politics / policy
  /\b(pemilu|pilpres|pilkada|presiden|menteri|dpr|dprd|kabinet|kebijakan|regulasi|uu\s+baru|omnibus)\b/i,
  // Sports / releases
  /\b(skor|klasemen|hasil\s+pertandingan|jadwal\s+pertandingan|rilis|peluncuran|dirilis)\b/i
];

/** Creative/technical writing requests never need a web lookup. */
const CREATIVE_REQUEST_RE =
  /\b(puisi|cerita|dongeng|pantun|syair|naskah\s+drama|lukisan|sketsa)\b|\b(tulis|tuliskan|karang|buatkan|buat|bikin)\b[^.]{0,40}\b(kode|script|program|function|class|komponen|component|query|sql)\b/i;

/** A bare "cek/cari" command is an internet request, even with a typo. */
const BARE_SEARCH_VERB_RE = /\b(cek|check|cari|carikan|temukan|search|browse|googling|gugling|gugel|telusuri)\b/i;

/** Question forms: default-ON for world questions (Live has no other tool). */
const QUESTION_FORM_RE = /^(?:apa|apakah|bagaimana|gimana|mengapa|kenapa|kapan|siapa|berapa|di\s*mana|dimana|adakah|apakah\s+ada)\b|\?\s*$/i;

/** "Bisakah kamu ...?" is a capability question, not a request to browse. */
const BROWSE_CAPABILITY_INQUIRY_RE =
  /\b(apakah|bisakah|bisa(?:kah)?|mampukah|can\s+you|are\s+you\s+able)\s+(?:kamu|anda|kau|you)\b/i;

/**
 * Bare connectivity probe ("cek internet", "test koneksi", typo "cek inernet"):
 * there is no topic to search for, so instead of searching for the word
 * "internet" we prove the connection with today's headlines.
 */
const CONNECTIVITY_PROBE_RE =
  /^(?:tolong\s+|coba\s+|mohon\s+)?(?:cek|check|test|tes|periksa|uji)\s+(?:koneksi\s+|akses\s+|jaringan\s+)?(?:internet|inernet|inet|internetnya|web|online|jaringan)\s*[?!.,]*$/i;

/**
 * Decide whether this user turn needs live internet data.
 *
 * Mirrors the local rule set (server/local_router/LocalRouterServer.mjs ->
 * isSearchIntent) but is deliberately broader: on Live the cloud model has no
 * memory/tools, so failing to search means the model answers "saya tidak punya
 * akses internet". Guards keep greetings/clock/document/creative turns offline.
 *
 * @param {string} userPrompt
 * @returns {boolean}
 */
export function detectWebSearchIntent(userPrompt) {
  if (!userPrompt || typeof userPrompt !== 'string') return false;
  const p = userPrompt.trim();
  if (!p) return false;

  // Guard: attached document / summarisation request -> never browse.
  if (/---\s*\[(?:berkas\s+dokumen|dokumen|konteks\s+dokumen)/i.test(p)) return false;
  if (DOCUMENT_REQUEST_RE.test(p)) return false;
  if (/\b(?:dokumen|berkas|file|lampiran)\s+ini\b/i.test(p)) return false;

  // Guard: greeting / capability question -> not an action.
  if (GREETING_RE.test(p)) return false;
  if (BROWSE_CAPABILITY_INQUIRY_RE.test(p)) return false;

  // 1. Explicit internet command -> always search.
  for (const re of EXPLICIT_WEB_SEARCH_PATTERNS) {
    if (re.test(p)) return true;
  }

  // 2. Explicit "current information" intent -> always search.
  for (const re of CURRENT_INFO_PATTERNS) {
    if (re.test(p)) return true;
  }

  // 3. Clock question -> answer from the injected date context.
  if (DATE_TIME_QUESTION_RE.test(p)) return false;

  // 4. Fresh-information topic -> search.
  for (const re of FRESH_INFO_PATTERNS) {
    if (re.test(p)) return true;
  }

  // 5. Creative / code-writing request -> no search.
  if (CREATIVE_REQUEST_RE.test(p)) return false;

  // 6. Bare "cek/cari ..." command -> search even without "internet"/"web".
  if (BARE_SEARCH_VERB_RE.test(p)) return true;

  // 7. Default ON for genuine questions: Live has no other way to know.
  if (QUESTION_FORM_RE.test(p) && p.length >= 12) return true;

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
 * Independent public-web fallback when Tavily is unavailable.
 * Tries DuckDuckGo HTML, then Google News RSS; neither requires a Tavily key.
 */
function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function stripHtml(value) {
  return decodeHtmlEntities(String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim();
}

async function searchExternalFallback(query, maxResults = WEB_SEARCH_MAX_RESULTS) {
  const q = sanitizeSearchText(query);
  if (!q) return null;

  // Provider 1: DuckDuckGo public HTML search.
  try {
    const response = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JINI-WebSearch/1.0)', 'Accept': 'text/html' },
      signal: AbortSignal.timeout(7000)
    });
    if (response.ok) {
      const html = await response.text();
      const sources = [];
      const linkRe = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while ((match = linkRe.exec(html)) && sources.length < maxResults) {
        let href = decodeHtmlEntities(match[1]);
        try {
          const parsed = new URL(href, 'https://duckduckgo.com');
          const redirected = parsed.searchParams.get('uddg');
          if (redirected) href = redirected;
        } catch {}
        if (!/^https?:\/\//i.test(href)) continue;
        const tail = html.slice(match.index, Math.min(html.length, match.index + 2500));
        const snippetMatch = tail.match(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div)>/i);
        let domain = '';
        try { domain = new URL(href).hostname.replace(/^www\./, ''); } catch {}
        sources.push({
          id: 'external_' + (sources.length + 1),
          title: stripHtml(match[2]) || q,
          url: href,
          domain,
          snippet: stripHtml(snippetMatch?.[1] || ''),
          credibility: 'EXTERNAL_WEB_SEARCH'
        });
      }
      if (sources.length) return { answer: '', sources, provider: 'DUCKDUCKGO' };
    }
  } catch (err) {
    console.warn('[JINI Live] DuckDuckGo fallback failed:', maskSecrets(err.message));
  }

  // Provider 2: Google News RSS, especially useful for Indonesian current affairs.
  try {
    const rssUrl = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=id&gl=ID&ceid=ID:id';
    const response = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JINI-NewsSearch/1.0)', 'Accept': 'application/rss+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(7000)
    });
    if (response.ok) {
      const xml = await response.text();
      const sources = [];
      const itemRe = /<item>([\s\S]*?)<\/item>/gi;
      let item;
      while ((item = itemRe.exec(xml)) && sources.length < maxResults) {
        const field = (tag) => {
          const re = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'i');
          const found = item[1].match(re);
          return found ? stripHtml(found[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')) : '';
        };
        const title = field('title');
        const link = field('link');
        const snippet = field('description');
        if (!title || !/^https?:\/\//i.test(link)) continue;
        let domain = '';
        try { domain = new URL(link).hostname.replace(/^www\./, ''); } catch {}
        sources.push({
          id: 'external_' + (sources.length + 1),
          title,
          url: link,
          domain,
          snippet,
          credibility: 'GOOGLE_NEWS_RSS'
        });
      }
      if (sources.length) return { answer: '', sources, provider: 'GOOGLE_NEWS_RSS' };
    }
  } catch (err) {
    console.warn('[JINI Live] Google News RSS fallback failed:', maskSecrets(err.message));
  }

  return null;
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
  lines.push(
    'Data di atas baru saja diambil dari internet live. DILARANG menolak menjawab dengan alasan "tidak punya akses real-time", "tidak bisa menjelajahi internet", atau "pengetahuan hanya sampai tanggal tertentu" - jawablah memakai data di atas.'
  );
  return lines.join('\n');
}

/**
 * Always-on system policy. Without this the cloud model tends to refuse with
 * "saya tidak memiliki akses real-time" even when the backend just fetched
 * live data. Kept short so it does not crowd out the product persona.
 */
export const INTERNET_ACCESS_POLICY =
  'KEBIJAKAN AKSES INTERNET (WAJIB DIPATUHI):\n' +
  '- Anda TERHUBUNG ke internet melalui backend JINI. Web search dijalankan otomatis di server, tanpa perlu diminta pengguna.\n' +
  '- Bila konteks memuat blok "--- [DATA FAKTA TERVERIFIKASI INTERNET ...] ---", Anda WAJIB menjawab berdasarkan fakta tersebut dan mencantumkan Judul + URL sumber yang relevan.\n' +
  '- DILARANG menjawab "saya tidak memiliki akses real-time", "saya tidak bisa menjelajahi internet", "saya tidak dapat mencari di web", atau "pengetahuan saya hanya sampai tanggal ...". Jawaban semacam itu tidak benar.\n' +
  '- Bila pengguna menanyakan hal terkini dan tidak ada blok data fakta, katakan terus terang bahwa pencarian internet sedang gagal, berikan konteks umum sebaik mungkin, dan jangan mengarang sumber.';

/**
 * Map Gemini Google Search grounding metadata into the same source shape used
 * by the Tavily path, so the UI/`_agent` contract stays identical.
 * @param {*} metadata candidates[].groundingMetadata
 * @returns {Array}
 */
export function extractGroundingSources(metadata) {
  const chunks = metadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];
  const seen = new Set();
  const out = [];
  for (const chunk of chunks) {
    const uri = chunk?.web?.uri;
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    let domain = '';
    try { domain = new URL(uri).hostname.replace(/^www\./, ''); } catch { domain = ''; }
    out.push({
      id: `google_${out.length + 1}`,
      title: sanitizeSearchText(chunk?.web?.title) || domain || uri,
      url: uri,
      domain,
      snippet: '',
      credibility: 'GEMINI_GOOGLE_SEARCH'
    });
  }
  return out;
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

/** Collect the Gemini key pool (primary + numbered rotation keys). Deduplicated. */
function collectGeminiKeys() {
  const keys = [];
  const seen = new Set();
  const add = (raw) => {
    if (typeof raw !== 'string') return;
    const k = raw.trim();
    if (!k) return;
    if (seen.has(k)) return;
    seen.add(k);
    keys.push(k);
  };
  add(process.env.GEMINI_API_KEY);
  for (let i = 1; i <= 15; i++) {
    add(process.env[`GEMINI_API_KEY_${i}`]);
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
  // Use conservative SDXL-friendly dimensions until the quality path is
  // validated end-to-end. Avoid changing both semantics and resolution at once.
  const ar = String(aspectRatio || '16:9').replace(/\s+/g, '');
  if (ar === '9:16') return ['432x768', '360x640'];
  if (ar === '1:1') return ['768x768'];
  if (ar === '4:3') return ['768x576'];
  if (ar === '3:4') return ['576x768'];
  if (ar === '3:2') return ['768x512'];
  if (ar === '2:3') return ['512x768'];
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

  // Never route document-reading requests to image generation, even if a filename
  // or extracted text contains words such as "image", "gambar", or "buat".
  const hasDocumentFile = /(?:^|[\s"'(])[^\s"'()]+\.(?:pdf|docx?|odt|rtf)(?:$|[\s"'()),])/i.test(p);
  const mentionsDocumentFormat = /\b(?:dokumen|file|berkas|lampiran|pdf|docx?|word|gambar|image|foto|scan|hasil\s+pindai)\b/i.test(p);
  const asksToReadDocument = /\b(baca|membaca|bacakan|analisis|analisa|ringkas|rangkum|jelaskan|isi\s+dokumen|apa\s+isi|review|summari[sz]e|read|extract\s+text|ambil\s+teks|pahami|periksa|cek\s+isi)\b/i.test(p);
  if ((hasDocumentFile && asksToReadDocument) ||
      (mentionsDocumentFormat && asksToReadDocument) ||
      /---\s*\[(?:berkas\s+dokumen|dokumen|konteks\s+dokumen)/i.test(p)) return null;

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
  const aspectHint = aspectRatio ? `. Aspect ratio ${aspectRatio}.` : '';
  // Preserve the user's requested subject as the primary instruction. The
  // previous generic wrapper diluted subject fidelity (e.g. "airplane" became
  // a waterfall). Quality constraints follow the subject and forbid unsolicited
  // poster/text composition without replacing the requested object.
  const fullPrompt = `${String(prompt || '').trim()}${aspectHint} Create exactly the subject described by the user; keep the main subject unmistakable and centered in the composition. High-quality polished image, clean fine details, smooth natural textures, crisp focus, balanced lighting, natural colors. Do not substitute a different subject. No text, lettering, watermark, logo, or poster layout unless explicitly requested.`;

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
      signal: AbortSignal.timeout(6000)
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

  // Use the exact model confirmed by the successful localhost logs. Do NOT
  // silently choose models[0]: discovery ordering can point Live at a different
  // provider/model, so the request may never reach the intended Cloudflare model.
  const PREFERRED_IMAGE_MODEL = 'cf/@cf/bytedance/stable-diffusion-xl-lightning';
  const model = PREFERRED_IMAGE_MODEL;
  console.log('[NineRouterImage] discovery ok', JSON.stringify({
    base,
    discoveredCount: models.length,
    preferredModelListed: models.includes(PREFERRED_IMAGE_MODEL),
    preferredModel: PREFERRED_IMAGE_MODEL
  }));

  // Keep the exact model ID in the POST body. First try the OpenAI-compatible
  // URL response; only retry the request shape when the gateway explicitly says
  // response_format is unsupported. Never silently switch to another model.
  const attemptBodies = [
    { model, prompt: fullPrompt, n: 1, size: targetSize, response_format: 'url' },
    { model, prompt: fullPrompt, n: 1, size: targetSize }
  ];
  const MAX_GEN_ATTEMPTS = 1;
  const RETRY_DELAY_MS = 2000;
  let lastTransientError = null;

  for (let generationAttempt = 1; generationAttempt <= MAX_GEN_ATTEMPTS; generationAttempt++) {
    let attemptFailed = false;
    for (const reqBody of attemptBodies) {
      let perAttemptTimer = null;
      try {
        // Per-attempt 14s: timer is declared outside try so catch can always clear it.
        const perAttemptCtrl = new AbortController();
        perAttemptTimer = setTimeout(() => perAttemptCtrl.abort(new Error('9Router attempt timeout (16s)')), 16000);
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
        console.log('[NineRouterImage] POST generation start', JSON.stringify({
          model: reqBody.model,
          responseFormat: reqBody.response_format || 'default',
          size: reqBody.size,
          attempt: generationAttempt
        }));
        const gr = await fetch(`${base}/v1/images/generations`, {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody),
          signal: combinedSignal
        });
        clearTimeout(perAttemptTimer);
        console.log('[NineRouterImage] POST generation response', JSON.stringify({
          status: gr.status,
          model: reqBody.model,
          elapsedMs: Date.now() - start
        }));
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
          console.warn('[NineRouterImage] generation rejected', JSON.stringify({
            status: gr.status,
            model: reqBody.model,
            body: maskSecrets(t.slice(0, 240))
          }));
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
        clearTimeout(perAttemptTimer);
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

      // Prefer 9Router (the provider proven by localhost logs), but bound its
      // cloud-tunnel attempt so it cannot consume the entire Live image-stage budget.
      // Gemini gets its own fallback window even if the tunnel is unresponsive.
      const stageCtrl = new AbortController();
      const stageTimer = setTimeout(() => stageCtrl.abort(new Error('Image stage timeout')), 52000);
      const routerCtrl = new AbortController();
      const routerTimer = setTimeout(() => routerCtrl.abort(new Error('9Router fallback window elapsed')), 38000);
      let gen = null;
      let routerError = '';
      let geminiError = '';
      try {
        let routerResult;
        try {
          const routerSignal = AbortSignal.any([stageCtrl.signal, routerCtrl.signal]);
          routerResult = await generateImageWithNineRouter(
            imageIntent.prompt,
            imageIntent.aspectRatio,
            routerSignal
          );
        } finally {
          clearTimeout(routerTimer);
        }
        if (routerResult?.success) {
          gen = routerResult;
        } else {
          routerError = routerResult?.error || (routerResult?.skip
            ? '9Router dilewati karena konfigurasi belum tersedia'
            : '9Router image generation failed');
        }

        // Gemini is the fallback after a bounded 9Router attempt.
        if (!gen?.success && !stageCtrl.signal.aborted) {
          const geminiCtrl = new AbortController();
          const geminiTimer = setTimeout(
            () => geminiCtrl.abort(new Error('Gemini image attempt timeout (25s)')),
            25000
          );
          let geminiResult;
          try {
            const geminiSignal = AbortSignal.any([stageCtrl.signal, geminiCtrl.signal]);
            geminiResult = await generateImageWithGemini(
              imageIntent.prompt,
              imageIntent.aspectRatio,
              geminiSignal
            );
          } finally {
            clearTimeout(geminiTimer);
          }
          if (geminiResult?.success) {
            gen = geminiResult;
          } else {
            geminiError = geminiResult?.error || 'Gemini image generation failed';
          }
        }

        if (!gen?.success) {
          gen = {
            success: false,
            error: `9Router: ${routerError || 'gagal'} | Gemini: ${geminiError || (stageCtrl.signal.aborted ? 'waktu tahap gambar habis' : 'gagal')}`
          };
        }
      } catch (stageErr) {
        gen = gen || {
          success: false,
          error: `Tahap gambar gagal: ${maskSecrets(stageErr?.message || String(stageErr))}`
        };
      } finally {
        clearTimeout(routerTimer);
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
        textContent = `Pembuatan gambar belum berhasil. Penyebab: ${gen.error}\n\nJINI Live mencoba 9Router terlebih dahulu, lalu Gemini sebagai fallback. Periksa konfigurasi NINEROUTER_URL dan NINEROUTER_KEY pada environment Live jika kedua provider gagal.`;
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
    // Never pretend success: a placeholder greeting here used to mask total
    // generation failure (retired model ids, exhausted quota) as a normal reply.
    let assistantReply = '';

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

    // ── Web search (fresh-information intent) ────────────────────────────
    // Runs server-side against Tavily (TAVILY_API_KEY); the key never reaches
    // the browser. Evidence is injected as clearly-identified context so the
    // model can cite titles + URLs. When Tavily is unavailable the handler
    // still reaches the internet through Gemini native Google Search grounding
    // (see the generation loop below).
    let searchContext = '';
    let searchMeta = null;
    let searchUnavailableNote = '';
    const wantsWebSearch = detectWebSearchIntent(userPrompt);
    const isConnectivityProbe = CONNECTIVITY_PROBE_RE.test(userPrompt.trim());
    if (wantsWebSearch) {
      const searchQuery = isConnectivityProbe
        ? 'berita utama Indonesia hari ini'
        : buildSearchQuery(userPrompt);
      let searchResult = await searchTavily(searchQuery, WEB_SEARCH_MAX_RESULTS);
      if (!searchResult || !searchResult.sources?.length) {
        console.warn('[JINI Live] Tavily unavailable; trying independent external search providers.');
        searchResult = await searchExternalFallback(searchQuery, WEB_SEARCH_MAX_RESULTS);
      }
      if (searchResult && searchResult.sources.length) {
        searchContext = buildSearchEvidenceBlock(searchResult, searchQuery);
        searchMeta = {
          intent: 'WEB_SEARCH',
          toolsUsed: ['web.search'],
          provider: searchResult.provider || 'TAVILY_AI',
          query: searchQuery,
          generationId,
          messageId,
          sources: searchResult.sources.map(s => ({ id: s.id, title: s.title, url: s.url, domain: s.domain }))
        };
      } else {
        // Honest failure mode: never claim a search happened or invent sources.
        // The generation loop will retry with Gemini Google Search grounding.
        searchUnavailableNote =
          'Pencarian internet tidak tersedia (layanan web search gagal atau TAVILY_API_KEY belum dikonfigurasi). ' +
          'Jika pengguna meminta informasi terkini, jawab dari pengetahuan Anda, sebutkan keterbatasannya dengan jujur, ' +
          'dan jangan mengklaim telah melakukan pencarian internet atau mengutip sumber internet. ' +
          'Pengecualian: bila Anda benar-benar menerima hasil Google Search grounding pada giliran ini, gunakan hasil tersebut sebagai sumber.';
      }
    }

    // ── System instruction (date + existing prompt + internet policy) ────
    const systemParts = [];
    if (!hasDateContext(existingSystemText)) systemParts.push(dateContext);
    if (existingSystemText) systemParts.push(existingSystemText);
    systemParts.push(INTERNET_ACCESS_POLICY);
    if (searchUnavailableNote) systemParts.push(searchUnavailableNote);
    const systemText = systemParts.join('\n\n');

    console.log(
      '[JINI Live] date context:', dateContext.slice(0, 72),
      '| web search:', searchMeta ? 'YES' : 'no',
      '| search wanted:', wantsWebSearch ? 'yes' : 'no',
      '| system prompt length:', systemText.length
    );

    const contents = [];
    for (const m of messages) {
      if (!m || m.role === 'system') continue;

      // Preserve multimodal image attachments for Gemini Vision instead of
      // flattening them to the literal placeholder "[gambar terlampir]".
      const parts = [];
      const rawParts = Array.isArray(m.content) ? m.content : null;
      if (rawParts) {
        for (const part of rawParts) {
          if (typeof part === 'string') {
            if (part.trim()) parts.push({ text: part });
            continue;
          }
          if (part && typeof part.text === 'string' && part.text.trim()) {
            parts.push({ text: part.text });
            continue;
          }
          const imageUrl = part?.type === 'image_url' ? (typeof part.image_url === 'string' ? part.image_url : part.image_url?.url) : '';
          const dataMatch = typeof imageUrl === 'string' ? imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/) : null;
          if (dataMatch) {
            parts.push({ inlineData: { mimeType: dataMatch[1], data: dataMatch[2] } });
          } else if (typeof imageUrl === 'string' && /^https?:\/\//i.test(imageUrl)) {
            // Gemini inlineData requires bytes; don't silently pretend a remote
            // image was analyzed. Preserve a clear marker for unsupported URLs.
            parts.push({ text: '[Gambar terlampir melalui URL; diperlukan URL gambar yang dapat diakses server.]' });
          }
        }
      } else {
        const text = toPlainText(m.content);
        if (text) parts.push({ text });
      }

      if (!parts.length) continue;
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts
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

    // Model fallback chain: Gemini retires model ids per project tier, so a
    // hardcoded name can start returning 404 ("no longer available to new
    // users") while other families keep working. Try the configured model
    // first, then the current stable aliases.
    const textModels = (() => {
      const configured = (process.env.GEMINI_TEXT_MODEL || '').trim();
      const list = [configured, 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash']
        .map(m => m.replace(/^models\//, ''))
        .filter(Boolean);
      return [...new Set(list)];
    })();

    // ── Generation with an automatic internet fallback ───────────────────
    // 1st pass: plain Gemini (Tavily evidence, if any, is already in `contents`).
    // If the user needs live info but Tavily produced no evidence, retry with
    // Gemini native Google Search grounding so Live can still browse the web.
    const groundingModes = (wantsWebSearch && !searchContext) ? [true, false] : [false];
    const generationDeadline = Date.now() + 42000;
    let generationError = '';

    searchGeneration:
    for (const textModel of textModels) {
      for (const useGrounding of groundingModes) {
        let modelUnavailable = 0;
        for (const key of textKeys) {
          if (Date.now() > generationDeadline) {
            generationError = generationError || 'Batas waktu pembuatan jawaban habis.';
            break searchGeneration;
          }
          try {
            const requestBody = { contents, generationConfig: { temperature: 0.7, maxOutputTokens: 2048 } };
            if (systemText) requestBody.systemInstruction = { parts: [{ text: systemText }] };
            if (useGrounding) requestBody.tools = [{ google_search: {} }];

            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${textModel}:generateContent?key=${encodeURIComponent(key)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
              signal: AbortSignal.timeout(useGrounding ? 28000 : 20000)
            });

            if (!geminiRes.ok) {
              const errText = await geminiRes.text().catch(() => '');
              generationError = `HTTP ${geminiRes.status}`;
              // 404 = this model id is retired for this key's tier. Two in a
              // row means the whole key pool rejects the model -> next model.
              if (geminiRes.status === 404) {
                if (++modelUnavailable >= 2) break;
                continue;
              }
              // 400 while grounded usually means the tool is unsupported here;
              // skip grounding for this model and use a plain call instead.
              if (useGrounding && geminiRes.status === 400) break;
              if (geminiRes.status === 429 || geminiRes.status >= 500) continue;
              console.warn('[GeminiCloud] HTTP', geminiRes.status, maskSecrets(errText).slice(0, 180));
              continue;
            }

            const gData = await geminiRes.json();
            const candidate = gData.candidates?.[0];
            const candidateText = candidate?.content?.parts?.[0]?.text;
            if (!candidateText) {
              generationError = candidate?.finishReason
                ? `Jawaban kosong (finishReason: ${candidate.finishReason}).`
                : 'Model tidak mengembalikan teks.';
              continue;
            }

            assistantReply = candidateText;

            if (useGrounding && !searchMeta) {
              const groundedSources = extractGroundingSources(candidate.groundingMetadata);
              if (groundedSources.length) {
                searchMeta = {
                  intent: 'WEB_SEARCH',
                  toolsUsed: ['web.search', 'google.search'],
                  provider: 'GEMINI_GOOGLE_SEARCH',
                  query: userPrompt,
                  generationId,
                  messageId,
                  sources: groundedSources
                };
              }
            }

            break searchGeneration; // success — stop key/mode/model rotation
          } catch (geminiErr) {
            generationError = geminiErr.name === 'TimeoutError' ? 'Timeout ke Gemini API.' : geminiErr.message;
            console.warn('[GeminiCloud] Error:', maskSecrets(geminiErr.message));
          }
        }
      }
    }

    console.log(
      '[JINI Live] generation done | grounding:',
      searchMeta?.provider === 'GEMINI_GOOGLE_SEARCH' ? 'YES' : 'no',
      '| sources:', searchMeta?.sources?.length || 0,
      '| ok:', assistantReply ? 'yes' : 'NO'
    );

    // Fallback: if all Gemini keys/models fail but we already fetched live web
    // evidence (Tavily/external fallback), synthesize an answer directly from
    // that evidence so JINI still "checks the internet" for the user.
    if (!assistantReply && searchContext && searchMeta?.sources?.length) {
      const top = searchMeta.sources.slice(0, 6);
      const bullets = top
        .map((s, i) => {
          const title = s.title || s.domain || `Sumber ${i + 1}`;
          const url = s.url || '';
          return url ? `- [${title}](${url})` : `- ${title}`;
        })
        .join('\n');

      const providerLabel = searchMeta.provider === 'DUCKDUCKGO' ? 'pencarian web independen'
        : searchMeta.provider === 'BRAVE_SEARCH' ? 'Brave Search'
        : searchMeta.provider === 'GOOGLE_CSE' ? 'Google CSE'
        : 'Tavily';

      assistantReply =
        `Berikut hasil terkini dari internet (${providerLabel}) untuk: **${userPrompt}**\n\n` +
        `${bullets}\n\n` +
        `Berdasarkan sumber-sumber di atas, saya merangkum secara ringkas:\n\n` +
        (searchMeta.query ? `_Kata kunci pencarian: "${searchMeta.query}"_\n\n` : '') +
        `Untuk detail lengkap, silakan buka salah satu tautan di atas. ` +
        `(Jawaban ini dirangkum langsung dari hasil pencarian live karena koneksi ke model AI sementara tidak tersedia.)`;

      if (!searchMeta.toolsUsed?.includes('web.search')) {
        searchMeta.toolsUsed = ['web.search', ...(searchMeta.toolsUsed || [])];
      }
    }

    if (!assistantReply) {
      const reason = generationError ? ` (${maskSecrets(generationError)})` : '';
      assistantReply =
        `Maaf, mesin AI JINI sedang tidak dapat menjawab saat ini${reason}. ` +
        'Semua kunci API Gemini yang tersedia gagal atau kuotanya habis. ' +
        'Silakan coba lagi beberapa saat lagi.';

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
          model: model || 'jini-live',
          choices: [{ index: 0, delta: { content: assistantReply }, finish_reason: 'stop' }],
          _agent: { intent: 'ERROR', toolsUsed: [], provider: 'NONE', error: true }
        })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      }
      return res.status(502).json({
        error: {
          message: assistantReply,
          type: 'upstream_unavailable',
          code: generationError || 'GEMINI_UNAVAILABLE'
        }
      });
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


