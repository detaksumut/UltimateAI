/**
 * YouTubeSongSearch.mjs — SATU-SATUNYA modul pencarian lagu/video YouTube JINI.
 *
 * Menggantikan SEMUA modul lama yang dihapus total:
 *   - LiveVideoResolver.mjs (bug: title[i] dipasangkan ke videoId[i] sehingga
 *     judul nyasar; mis. video drama Tl-mneAoSV0 dikira "Hau Lai"; skor hanya
 *     boost channel berita, nol relevansi judul)
 *   - YouTubeLauncherTool.mjs (percaya hasil Tavily mentah tanpa verifikasi judul)
 *   - YouTubeSongVerifier.mjs (kontrak verifikasi tak pernah dipanggil siapa pun)
 *
 * Kontrak fail-closed: SEARCH RESULT !== VERIFIED SONG.
 *   DISCOVER (Tavily + scrape) -> VERIFY (title gate + non-music gate) -> RESPOND.
 *   Satu gate gagal = kandidat gugur. Tidak ada kandidat lolos = NO_MATCH
 *   (JINI wajib bilang tidak ketemu, BUKAN memutar video pertama).
 */

const YT_HOST_RE = /(^|\.)(youtube\.com|youtu\.be|m\.youtube\.com|music\.youtube\.com)$/i;

export const YT_SONG_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  NO_MATCH: 'NO_MATCH',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
});

// Sinyal non-musik: kandidat mengandung ini = BUKAN lagu -> gugur langsung.
const NON_MUSIC_SIGNALS = [
  'sold that piece of land', 'taking their child', 'while linh',
  'story', 'cerita', 'drama', 'film pendek', 'short film', 'shortfilm',
  'news', 'berita', 'documentary', 'dokumenter', 'podcast',
  'commentary', 'komentar bola', 'vlog', 'daily vlog', 'recap',
  'episode', 'sinetron', 'trailer film',
  'breaking news', 'kompas', 'tvone', 'tribun', 'metrotv', 'detik', 'inews', 'liputan6',
  'musim hujan', 'cuaca', 'bencana'
];

// Alias ejaan wajar untuk discovery.
// "Hau Lai" (Vietnam) -> "Hou Lai / столица" (Rene Liu / Liu Ruo Ying).
const TITLE_ALIASES = [
  [/^hau\s*lai$/i, ['hou lai', 'rene liu hou lai', 'liu ruo ying later']],
  [/^hou\s*lai$/i, ['hou lai', 'rene liu']],
];

export function isYouTubeUrl(url = '') {
  try {
    const u = new URL(String(url));
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return YT_HOST_RE.test(u.hostname);
  } catch { return false; }
}

export function extractVideoId(url = '') {
  const m = String(url).match(/(?:[?&]v=|\/(?:shorts|live|embed|v)\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function normalizeTitle(s = '') {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&[^;\s]+;/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function significantTokens(s = '') {
  return normalizeTitle(s).split(' ').filter((t) => t.length >= 3);
}

export function isTopicChannel(channel = '') {
  const ch = String(channel || '').trim().toLowerCase();
  return /[-–—]\s*topic$/i.test(ch) || /\btopic$/i.test(ch) || ch.endsWith('topic');
}

/** Discovery expansion: query user + official video / VEVO + alias resmi. */
export function expandDiscoveryQueries(rawQuery = '') {
  const base = String(rawQuery || '').trim();
  const out = [];
  if (!/^lagu\b/i.test(base)) {
    out.push(`lagu ${base}`);
  }
  out.push(base);
  out.push(`${base} official music video`);
  out.push(`${base} official`);
  out.push(`${base} vevo`);
  for (const [re, aliases] of TITLE_ALIASES) {
    if (re.test(base)) { for (const a of aliases) if (!out.includes(a)) out.push(a); }
  }
  return out.filter(Boolean).slice(0, 5);
}

/** Bersihkan prompt jadi judul lagu: "carikan lagu di youtube judulnya Hau Lai" -> "Hau Lai". */
export function extractSongQuery(userPrompt = '', history = []) {
  const raw = String(userPrompt || '');
  const m = raw.match(/(?:judul(?:\s+lagu)?(?:nya)?|berjudul|judul\s+adalah|namanya|titled|called)\s+(?:lagu(?:nya)?\s+)?(.{2,80}?)\s*[.?!]*$/i);
  let q = m ? m[1].trim() : '';
  if (q) {
    q = q
      .replace(/,\s*(?:penyanyi(?:nya)?|artis(?:nya)?|singer|vocalist)\s*(?:adalah|:)?\s*/gi, ' ')
      .replace(/\b(?:penyanyi(?:nya)?|artis(?:nya)?|singer|vocalist)\s*(?:adalah|:)?\s*/gi, ' ')
      .replace(/["'?!]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (!q) {
    q = raw
      .replace(/^\s*(hai|halo|hallo|hei|ok|okey|jin|hai jin)\b[\s,!]*/i, '')
      .replace(/\b(carikan|carilin|cari|tolong|coba|minta|bisa|boleh|putar|putarkan|play|dengarkan|mainkan|setel)\b/gi, ' ')
      .replace(/\b(di|dari)\b\s+youtube/gi, ' ')
      .replace(/\byoutube\b/gi, ' ')
      .replace(/\b(canvas|percakapan|langsung)\b/gi, ' ')
      .replace(/\b(lagu|musik|video|song|music|playlist|konsep|yang|aku|mau|jini|lalu)\b/gi, ' ')
      .replace(/\b(?:penyanyi(?:nya)?|artis(?:nya)?|singer|vocalist)\s*(?:adalah|:)?\s*/gi, ' ')
      .replace(/["'?!]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  // Jika prompt referensial (mis. "Yang aku mau JINI cari di Youtube lalu putar langsung di canvas"),
  // periksa riwayat percakapan sebelumnya untuk menemukan judul lagu yang dimaksud
  if (q.length < 2 && Array.isArray(history) && history.length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      const prev = history[i]?.content;
      if (typeof prev === 'string') {
        const found = extractSongQuery(prev);
        if (found && found.length >= 2 && !/\b(canvas|youtube|putar|cari)\b/i.test(found)) {
          return found;
        }
      }
    }
  }
  if (q.length < 2) q = raw.replace(/\s+/g, ' ').trim();
  return q;
}
/**
 * TITLE GATE — satu-satunya penentu VERIFIED:
 *  - EXACT : normalisasi sama persis.
 *  - STRONG: semua token penting query ada di judul kandidat, atau satu
 *    mengandung yang lain (mis. "hau lai" di "hau lai rene liu later").
 *  - selain itu GUGUR. Kemiripan samar TIDAK PERNAH cukup — inilah yang dulu
 *    membuat video drama lolos.
 */
export function titleGate(query = '', candidateTitle = '') {
  const req = normalizeTitle(query);
  const cand = normalizeTitle(candidateTitle);
  if (!req || !cand) return 'NO_MATCH';
  if (req === cand) return 'EXACT';
  const reqT = significantTokens(req);
  const candSet = new Set(significantTokens(cand));
  if (reqT.length > 0 && reqT.every((t) => candSet.has(t))) return 'STRONG';
  if (cand.includes(req) || req.includes(cand)) return 'STRONG';
  return 'NO_MATCH';
}

export function isNonMusic(candidate = {}) {
  const blob = normalizeTitle(`${candidate.title || ''} ${candidate.channel || ''} ${candidate.description || ''}`);
  return NON_MUSIC_SIGNALS.some((s) => blob.includes(s));
}

/** Verifikasi SATU kandidat. Gagal satu gate = REJECT (tanpa fallback ke yang ditolak). */
export function verifyCandidate(query = '', candidate = {}) {
  if (!candidate || !candidate.videoId) return { status: 'REJECT', reason: 'NO_CANDIDATE' };
  if (isNonMusic(candidate)) return { status: 'REJECT', reason: 'NON_MUSIC_CONTENT' };
  const gate = titleGate(query, candidate.title);
  if (gate === 'EXACT' || gate === 'STRONG') return { status: 'VERIFY', reason: gate };
  return { status: 'REJECT', reason: 'TITLE_MISMATCH' };
}

/**
 * Verifikasi kandidat dari SEMUA query discovery terhadap query VERIFIKASI
 * (query asli user + tiap aliasnya — alias boleh memverifikasi juga karena
 * "Hau Lai" memang ejaan alternatif "Hou Lai").
 *
 * FILTER PENTING EMBEDDING:
 * Prioritas 1: Kandidat NON-Topic Channel (VEVO, Official Artist, Label Channel).
 * Topic Channel (* - Topic) adalah rilis YouTube Music dengan DRM audio yang melarang
 * pemutaran di situs luar / iframe (menyebabkan YouTube Error 150 atau layar hitam).
 */
export function pickVerified(verifyQueries = [], candidates = []) {
  const list = Array.isArray(candidates) ? candidates : [];
  const vqs = (Array.isArray(verifyQueries) ? verifyQueries : [verifyQueries]).filter(Boolean);

  // PASS 1: Utamakan kandidat BUKAN Topic Channel agar embed Canvas 100% playable
  for (const vq of vqs) {
    for (const c of list) {
      if (isTopicChannel(c.channel)) continue;
      const r = verifyCandidate(vq, c);
      if (r.status === 'VERIFY') {
        return {
          status: YT_SONG_STATUS.VERIFIED,
          query: vq,
          candidate: { videoId: c.videoId, title: c.title || '', channel: c.channel || '' },
          gate: r.reason,
          isTopic: false,
        };
      }
    }
  }

  // PASS 2: Fallback jika seluruh kandidat hanya berasal dari Topic Channel
  for (const vq of vqs) {
    for (const c of list) {
      const r = verifyCandidate(vq, c);
      if (r.status === 'VERIFY') {
        return {
          status: YT_SONG_STATUS.VERIFIED,
          query: vq,
          candidate: { videoId: c.videoId, title: c.title || '', channel: c.channel || '' },
          gate: r.reason,
          isTopic: true,
        };
      }
    }
  }

  if (list.length === 0) return { status: YT_SONG_STATUS.NO_MATCH, query: vqs[0] || '', candidate: null, reason: 'NO_CANDIDATES' };
  return { status: YT_SONG_STATUS.NO_MATCH, query: vqs[0] || '', candidate: null, reason: 'ALL_CANDIDATES_REJECTED', checked: list.length };
}

async function discoverViaTavily(query = '', signal = null) {
  const apiKey = (process.env.TAVILY_API_KEY || '').trim();
  if (!apiKey) return [];
  const out = [];
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: `YouTube ${query} official music video`,
        search_depth: 'basic',
        include_answer: false,
        max_results: 8,
      }),
      signal: signal || AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    for (const r of data.results || []) {
      const id = extractVideoId(r.url || '');
      if (id) out.push({ videoId: id, title: r.title || '', channel: '', description: r.content || '', source: 'tavily' });
    }
  } catch { /* discovery gagal = lanjut sumber lain */ }
  return out;
}

async function discoverViaScrape(query = '', signal = null) {
  const out = [];
  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
      },
      signal: signal || AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const html = await res.text();

    // 1. Prioritaskan parsing terstruktur dari ytInitialData
    const jsonMatch = html.match(/var ytInitialData = ({[\s\S]*?});<\/script>/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        const sectionList = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
        for (const sec of sectionList) {
          const itemSection = sec.itemSectionRenderer?.contents || [];
          for (const item of itemSection) {
            const v = item.videoRenderer;
            if (v && v.videoId) {
              const title = v.title?.runs?.[0]?.text || v.title?.simpleText || '';
              const channel = v.ownerText?.runs?.[0]?.text || v.shortBylineText?.runs?.[0]?.text || '';
              // Guard anti-nyasar: title 1 videoRenderer milik videoId itu
              // sendiri (bukan pairing posisi). Tolak yang tak relevan agar
              // kasus "Kim Wilde & 80s" untuk query Nikita tak terulang.
              if (title && titleGate(query, title) !== 'NO_MATCH') {
                out.push({ videoId: v.videoId, title, channel, description: '', source: 'scrape_json' });
              }
            }
          }
        }
      } catch {}
    }

    // 2. Fallback regex jika ytInitialData tidak dapat diparse
    if (out.length === 0) {
      const positions = [];
      const seen = new Set();
      for (const m of html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})/g)) {
        if (!seen.has(m[1])) { seen.add(m[1]); positions.push({ id: m[1], index: m.index }); }
        if (positions.length >= 8) break;
      }
      const grab = (win, patterns) => {
        for (const re of patterns) { const m = win.match(re); if (m && m[1]) return m[1].trim(); }
        return '';
      };
      const T_RES = [
        /\"title\":\s*\{[^}]{0,400}?\"runs\":\s*\[\s*\{\s*\"text\":\s*\"([^\"]{2,150})\"/,
        /\"title\":\s*\{[^}]{0,400}?\"text\":\s*\"([^\"]{2,150})\"/
      ];
      const C_RES = [
        /\"ownerText\":\s*\{[^}]{0,400}?\"runs\":\s*\[\s*\{\s*\"text\":\s*\"([^\"]{2,80})\"/,
        /\"ownerText\":\s*\{[^}]{0,400}?\"text\":\s*\"([^\"]{2,80})\"/,
        /\"longBylineText\":\s*\{[^}]{0,400}?\"text\":\s*\"([^\"]{2,80})\"/
      ];
      positions.forEach((pos, k) => {
        const next = k + 1 < positions.length ? positions[k + 1].index : html.length;
        const win = html.slice(pos.index, Math.min(next, pos.index + 12000));
        const title = grab(win, T_RES);
        if (!title) return;
        // Guard anti-nyasar: pairing posisi rawan salah (judul video A
        // menempel ke videoId B). Tolak yang tak relevan dengan query.
        if (titleGate(query, title) === 'NO_MATCH') return;
        out.push({ videoId: pos.id, title, channel: grab(win, C_RES), description: '', source: 'scrape_regex' });
      });
    }
  } catch { /* abaikan */ }
  return out;
}
async function confirmPlayable(videoId = '') {
  // Konfirmasi ringan via oEmbed: video tidak ada/dihapus/private -> gagal.
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { title: data.title || '', channel: data.author_name || '' };
  } catch { return null; }
}

/**
 * API UTAMA: cari lagu -> kembalikan video TERVERIFIKASI atau NO_MATCH.
 * Tidak pernah mengembalikan "video pertama hasil search" tanpa verifikasi.
 */
export async function searchSong(userPromptOrQuery = '', options = {}) {
  const history = options.messages || [];
  const query = extractSongQuery(userPromptOrQuery, history);
  if (!query) return { status: YT_SONG_STATUS.INSUFFICIENT_EVIDENCE, query: '', candidate: null, reason: 'EMPTY_QUERY' };
  const discoveryQueries = expandDiscoveryQueries(query);
  const seen = new Set();
  const candidates = [];
  for (const dq of discoveryQueries) {
    const found = [
      ...await discoverViaTavily(dq, options.signal),
      ...await discoverViaScrape(dq, options.signal),
    ];
    for (const c of found) {
      if (!seen.has(c.videoId)) { seen.add(c.videoId); candidates.push(c); }
    }
    if (candidates.length >= 12) break;
  }
  // Verifikasi terhadap query asli + semua alias discovery.
  const verdict = pickVerified([query, ...discoveryQueries.slice(1)], candidates);
  if (verdict.status !== YT_SONG_STATUS.VERIFIED) return { ...verdict, discoveryQueries, checked: candidates.length };
  // Konfirmasi video benar-benar dapat diputar.
  const proof = await confirmPlayable(verdict.candidate.videoId);
  if (!proof) {
    return { status: YT_SONG_STATUS.INSUFFICIENT_EVIDENCE, query, candidate: verdict.candidate, reason: 'UNPLAYABLE', discoveryQueries, checked: candidates.length };
  }
  const watchUrl = `https://www.youtube.com/watch?v=${verdict.candidate.videoId}`;
  return {
    status: YT_SONG_STATUS.VERIFIED,
    query,
    candidate: { ...verdict.candidate, title: proof.title || verdict.candidate.title, channel: proof.channel || verdict.candidate.channel },
    gate: verdict.gate,
    isTopic: Boolean(verdict.isTopic),
    watchUrl,
    discoveryQueries,
    checked: candidates.length,
  };
}

export default { searchSong, extractSongQuery, expandDiscoveryQueries, titleGate, verifyCandidate, pickVerified, isYouTubeUrl, extractVideoId, normalizeTitle, YT_SONG_STATUS };