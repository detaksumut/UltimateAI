/**
 * ChatCompletionsLiveTest.mjs
 * Fokus test untuk backend LIVE (Vercel) JINI:
 *   api/v1/chat/completions.js
 *
 * Dijalankan:
 *   node tests/api/ChatCompletionsLiveTest.mjs
 *
 * Cakupan:
 *   [1] Date/time awareness (Asia/Jakarta) — konstruksi + injeksi system instruction.
 *   [2] Web search Tavily — intent gate, evidence block, kegagalan (HTTP/timeout/key hilang).
 *   [3] Regresi 9Router image generation tetap utuh.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

import handler, {
  buildDateContext,
  buildSearchEvidenceBlock,
  buildSearchQuery,
  detectWebSearchIntent,
  hasDateContext,
  searchTavily,
  toPlainText
} from '../../api/v1/chat/completions.js';

const API_SRC_PATH = path.resolve('api/v1/chat/completions.js');
const API_SRC = fs.readFileSync(API_SRC_PATH, 'utf8');

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ [FAIL] ${name} — ${err.message}`);
  }
}
async function checkAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ [FAIL] ${name} — ${err.message}`);
  }
}

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: ChatCompletionsLiveTest — date awareness + Tavily web search');
console.log('═══════════════════════════════════════════════════════════════════════\n');

/* ── helpers ─────────────────────────────────────────────────────────────── */

function mockRes() {
  const chunks = [];
  return {
    statusCode: null,
    headers: {},
    body: null,
    chunks,
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(code, h) { this.statusCode = code; Object.assign(this.headers, h || {}); },
    write(c) { chunks.push(String(c)); },
    end(c) { if (c !== undefined) chunks.push(String(c)); },
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
    get sse() { return chunks.join(''); },
    get sseEvents() {
      return chunks
        .join('')
        .split('\n')
        .filter(l => l.trim().startsWith('data:'))
        .map(l => l.trim().replace(/^data:\s*/, ''))
        .filter(d => d !== '[DONE]')
        .map(d => { try { return JSON.parse(d); } catch { return null; } })
        .filter(Boolean);
    }
  };
}

const REAL_FETCH = globalThis.fetch;
let fetchCalls = [];

/** Stub global fetch; `routes` maps a URL substring -> handler(url, opts). */
function stubFetch(routes) {
  fetchCalls = [];
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    fetchCalls.push({ url: u, opts });
    for (const [needle, fn] of routes) {
      if (u.includes(needle)) return fn(u, opts);
    }
    throw new Error(`[stubFetch] unrouted URL: ${u}`);
  };
}
function restoreFetch() { globalThis.fetch = REAL_FETCH; }

const jsonResponse = (obj, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => obj,
  text: async () => JSON.stringify(obj)
});

const GEMINI_URL = 'generativelanguage.googleapis.com';
const TAVILY_URL = 'api.tavily.com/search';

function geminiOk(text = 'Halo dari JINI.') {
  return jsonResponse({ candidates: [{ content: { parts: [{ text }] } }] });
}

/* ── [1] Date awareness ──────────────────────────────────────────────────── */

console.log('[1] Date/time awareness (Asia/Jakarta)');

check('buildDateContext memuat tahun, bulan, hari, dan jam WIB', () => {
  const ctx = buildDateContext(new Date('2026-03-14T06:30:15Z')); // 13:30:15 WIB
  assert.ok(ctx.includes('2026'), 'tahun hilang: ' + ctx);
  assert.ok(/Maret/i.test(ctx), 'bulan hilang: ' + ctx);
  assert.ok(ctx.includes('14'), 'tanggal hilang: ' + ctx);
  assert.ok(ctx.includes('13.30.15'), 'jam WIB (UTC+7) salah: ' + ctx);
  assert.ok(ctx.includes('WIB'), 'label WIB hilang: ' + ctx);
  assert.ok(ctx.includes('Asia/Jakarta'), 'timezone hilang: ' + ctx);
});

check('buildDateContext memakai tanggal yang diberikan (tidak hardcode)', () => {
  const a = buildDateContext(new Date('2031-12-25T10:00:00Z'));
  const b = buildDateContext(new Date('2024-01-02T10:00:00Z'));
  assert.ok(a.includes('2031') && a.includes('Desember'), a);
  assert.ok(b.includes('2024') && b.includes('Januari'), b);
  assert.ok(!a.includes('2026'), 'tahun hardcoded terdeteksi: ' + a);
});

check('buildDateContext memakai waktu SEKARANG (request-time, bukan build-time)', () => {
  const now = new Date();
  const ctx = buildDateContext();
  const expectedIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
  assert.ok(ctx.includes(expectedIso), `tanggal hari ini (${expectedIso}) tidak ada di: ${ctx}`);
});

check('buildDateContext aman untuk input tidak valid', () => {
  const ctx = buildDateContext(new Date('bukan tanggal'));
  assert.ok(typeof ctx === 'string' && ctx.includes('WIB'), ctx);
});

check('hasDateContext mendeteksi konteks tanggal yang sudah ada', () => {
  assert.strictEqual(hasDateContext('Tanggal dan waktu saat ini: Senin, 1 Januari 2026'), true);
  assert.strictEqual(hasDateContext('Informasi waktu saat ini: Senin'), true);
  assert.strictEqual(hasDateContext('You are JIN, an AI partner.'), false);
  assert.strictEqual(hasDateContext(''), false);
  assert.strictEqual(hasDateContext(null), false);
});

await checkAsync('handler menyuntik date context ke systemInstruction Gemini', async () => {
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  delete process.env.TAVILY_API_KEY;
  let captured = null;
  stubFetch([[GEMINI_URL, async (u, o) => { captured = JSON.parse(o.body); return geminiOk(); }]]);

  const res = mockRes();
  await handler({
    method: 'POST',
    body: {
      model: 'auto',
      messages: [
        { role: 'system', content: 'You are JIN, an AI partner in UltimateAI.' },
        { role: 'user', content: 'Halo JINI' }
      ]
    }
  }, res);

  restoreFetch();
  assert.ok(captured, 'request ke Gemini tidak terjadi');
  const sys = captured.systemInstruction?.parts?.[0]?.text || '';
  const expectedIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  assert.ok(sys.includes(expectedIso), `date context tidak ada di systemInstruction: ${sys}`);
  assert.ok(sys.includes('WIB'), 'WIB tidak ada di systemInstruction');
  assert.ok(sys.includes('You are JIN, an AI partner in UltimateAI.'), 'system prompt asli tidak dipertahankan');
});

await checkAsync('handler tidak menduplikasi date context yang sudah dikirim client', async () => {
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  let captured = null;
  stubFetch([[GEMINI_URL, async (u, o) => { captured = JSON.parse(o.body); return geminiOk(); }]]);

  const res = mockRes();
  await handler({
    method: 'POST',
    body: {
      messages: [
        { role: 'system', content: 'Tanggal dan waktu saat ini: 1 Januari 2026 00.00 WIB (Asia/Jakarta).' },
        { role: 'user', content: 'Halo' }
      ]
    }
  }, res);

  restoreFetch();
  const sys = captured.systemInstruction?.parts?.[0]?.text || '';
  const occurrences = (sys.match(/Tanggal dan waktu saat ini/g) || []).length;
  assert.strictEqual(occurrences, 1, `date context terduplikasi (${occurrences}x): ${sys}`);
});

await checkAsync('handler aman untuk content null / non-string / array parts', async () => {
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  delete process.env.TAVILY_API_KEY;
  let captured = null;
  stubFetch([[GEMINI_URL, async (u, o) => { captured = JSON.parse(o.body); return geminiOk(); }]]);

  const res = mockRes();
  await handler({
    method: 'POST',
    body: {
      messages: [
        { role: 'system', content: null },
        { role: 'user', content: [{ type: 'text', text: 'Halo dari parts' }] },
        { role: 'assistant', content: undefined }
      ]
    }
  }, res);

  restoreFetch();
  assert.strictEqual(res.statusCode, 200);
  assert.ok(captured, 'request ke Gemini tidak terjadi');
  const texts = captured.contents.map(c => c.parts[0].text);
  assert.ok(texts.some(t => t.includes('Halo dari parts')), 'teks parts tidak diteruskan');
  assert.ok(captured.contents.every(c => typeof c.parts[0].text === 'string' && c.parts[0].text.length > 0),
    'ada part kosong yang dikirim ke Gemini');
});

check('toPlainText menangani semua bentuk content', () => {
  assert.strictEqual(toPlainText('halo'), 'halo');
  assert.strictEqual(toPlainText(null), '');
  assert.strictEqual(toPlainText(undefined), '');
  assert.strictEqual(toPlainText([{ type: 'text', text: 'a' }]), 'a');
  assert.strictEqual(toPlainText([{ type: 'image_url', image_url: { url: 'data:...' } }]), '[gambar terlampir]');
  const circular = {}; circular.self = circular;
  assert.strictEqual(toPlainText(circular), '');
});

/* ── [2] Web search (Tavily) ────────────────────────────────────────────── */

console.log('\n[2] Web search Tavily');

check('intent gate: hanya permintaan internet eksplisit yang memicu search', () => {
  assert.strictEqual(detectWebSearchIntent('cek internet berita terbaru Indonesia'), true);
  assert.strictEqual(detectWebSearchIntent('tolong carikan di internet harga emas hari ini'), true);
  assert.strictEqual(detectWebSearchIntent('cari informasi terkini tentang AI'), true);
  assert.strictEqual(detectWebSearchIntent('search the web for latest news'), true);
  assert.strictEqual(detectWebSearchIntent('berita terbaru TOKEN'), true);
  assert.strictEqual(detectWebSearchIntent('latest news about elections'), true);
  assert.strictEqual(detectWebSearchIntent('apa kabar?'), false);
  assert.strictEqual(detectWebSearchIntent('halo JINI, apa kabar hari ini?'), false);
  assert.strictEqual(detectWebSearchIntent('tahun berapa sekarang?'), false);
  assert.strictEqual(detectWebSearchIntent('hari ini tanggal berapa?'), false);
  assert.strictEqual(detectWebSearchIntent('buatkan gambar kucing'), false);
  assert.strictEqual(detectWebSearchIntent('rangkum dokumen ini'), false);
  assert.strictEqual(detectWebSearchIntent(''), false);
  assert.strictEqual(detectWebSearchIntent(null), false);
});

check('buildSearchQuery membersihkan scaffolding "cek internet"', () => {
  const q = buildSearchQuery('Tolong cek internet berita terbaru tentang AI');
  assert.ok(!/internet/i.test(q), q);
  assert.ok(!/tolong/i.test(q), q);
  assert.ok(/berita/i.test(q), q);
  assert.ok(/AI/i.test(q), q);
});

check('buildSearchEvidenceBlock memuat judul + URL sumber', () => {
  const block = buildSearchEvidenceBlock({
    answer: 'Ringkasan berita.',
    sources: [{ id: 'tavily_1', title: 'Judul Berita', url: 'https://news.example/a', domain: 'news.example', snippet: 'cuplikan' }]
  }, 'berita terbaru');
  assert.ok(block.includes('DATA FAKTA TERVERIFIKASI INTERNET'), block);
  assert.ok(block.includes('Judul Berita'), block);
  assert.ok(block.includes('https://news.example/a'), block);
  assert.ok(block.includes('Ringkasan berita.'), block);
});

check('buildSearchEvidenceBlock kosong bila tidak ada sumber', () => {
  assert.strictEqual(buildSearchEvidenceBlock(null), '');
  assert.strictEqual(buildSearchEvidenceBlock({ sources: [] }), '');
});

await checkAsync('searchTavily mengembalikan answer + sources (sukses)', async () => {
  process.env.TAVILY_API_KEY = 'tvly-test-key';
  let body = null;
  stubFetch([[TAVILY_URL, async (u, o) => {
    body = JSON.parse(o.body);
    return jsonResponse({
      answer: 'Jawaban ringkas.',
      results: [
        { title: 'Sumber Satu', url: 'https://satu.example/x', content: 'isi satu', score: 0.9 },
        { title: 'Sumber Dua', url: 'https://dua.example/y', content: 'isi dua', score: 0.8 }
      ]
    });
  }]]);

  const res = await searchTavily('berita terbaru AI');
  restoreFetch();
  delete process.env.TAVILY_API_KEY;

  assert.ok(res, 'hasil null');
  assert.strictEqual(res.sources.length, 2);
  assert.strictEqual(res.sources[0].id, 'tavily_1');
  assert.strictEqual(res.sources[0].title, 'Sumber Satu');
  assert.strictEqual(res.sources[0].domain, 'satu.example');
  assert.strictEqual(res.answer, 'Jawaban ringkas.');
  assert.strictEqual(body.api_key, 'tvly-test-key', 'api key tidak diteruskan');
  assert.strictEqual(body.query, 'berita terbaru AI');
  assert.ok(body.max_results > 0);
});

await checkAsync('searchTavily null saat TAVILY_API_KEY tidak ada (tidak crash)', async () => {
  delete process.env.TAVILY_API_KEY;
  stubFetch([[TAVILY_URL, async () => { throw new Error('tidak boleh dipanggil'); }]]);
  const res = await searchTavily('berita terbaru');
  restoreFetch();
  assert.strictEqual(res, null);
});

await checkAsync('searchTavily null saat HTTP error (tidak crash)', async () => {
  process.env.TAVILY_API_KEY = 'tvly-test-key';
  stubFetch([[TAVILY_URL, async () => jsonResponse({ error: 'boom' }, 500)]]);
  const res = await searchTavily('berita terbaru');
  restoreFetch();
  delete process.env.TAVILY_API_KEY;
  assert.strictEqual(res, null);
});

await checkAsync('searchTavily null saat timeout / network error', async () => {
  process.env.TAVILY_API_KEY = 'tvly-test-key';
  stubFetch([[TAVILY_URL, async () => { throw new Error('The operation was aborted due to timeout'); }]]);
  const res = await searchTavily('berita terbaru');
  restoreFetch();
  delete process.env.TAVILY_API_KEY;
  assert.strictEqual(res, null);
});

await checkAsync('searchTavily null saat hasil kosong', async () => {
  process.env.TAVILY_API_KEY = 'tvly-test-key';
  stubFetch([[TAVILY_URL, async () => jsonResponse({ answer: '', results: [] })]]);
  const res = await searchTavily('berita terbaru');
  restoreFetch();
  delete process.env.TAVILY_API_KEY;
  assert.strictEqual(res, null);
});

await checkAsync('handler: "cek internet" menyuntik evidence + sumber ke konteks model', async () => {
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.TAVILY_API_KEY = 'tvly-test-key';
  let geminiBody = null;
  stubFetch([
    [TAVILY_URL, async () => jsonResponse({
      answer: 'Ikhtisar dari web.',
      results: [{ title: 'Portal Berita', url: 'https://portal.example/berita', content: 'cuplikan berita', score: 0.95 }]
    })],
    [GEMINI_URL, async (u, o) => { geminiBody = JSON.parse(o.body); return geminiOk('Jawabannya.'); }]
  ]);

  const res = mockRes();
  await handler({
    method: 'POST',
    body: {
      stream: true,
      generationId: 'gen_1',
      messageId: 'jin_1',
      messages: [
        { role: 'system', content: 'You are JIN.' },
        { role: 'user', content: 'cek internet berita terbaru tentang AI' }
      ]
    }
  }, res);

  restoreFetch();
  delete process.env.TAVILY_API_KEY;

  assert.strictEqual(res.statusCode, 200);
  const userTurn = geminiBody.contents.filter(c => c.role === 'user').pop();
  const ctx = userTurn.parts[0].text;
  assert.ok(ctx.includes('DATA FAKTA TERVERIFIKASI INTERNET'), 'evidence block tidak ada: ' + ctx);
  assert.ok(ctx.includes('Portal Berita'), 'judul sumber tidak ada di context');
  assert.ok(ctx.includes('https://portal.example/berita'), 'URL sumber tidak ada di context');
  assert.ok(ctx.includes('Ikhtisar dari web.'), 'ringkasan tidak ada di context');

  const agentEvents = res.sseEvents.filter(e => e._agent);
  assert.strictEqual(agentEvents.length, 1, 'metadata _agent tidak terkirim');
  assert.strictEqual(agentEvents[0]._agent.intent, 'WEB_SEARCH');
  assert.strictEqual(agentEvents[0]._agent.provider, 'TAVILY_AI');
  assert.strictEqual(agentEvents[0]._agent.sources[0].title, 'Portal Berita');
  assert.strictEqual(agentEvents[0]._agent.sources[0].url, 'https://portal.example/berita');
});

await checkAsync('handler: kegagalan Tavily tidak mengklaim search berhasil', async () => {
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.TAVILY_API_KEY = 'tvly-test-key';
  let geminiBody = null;
  stubFetch([
    [TAVILY_URL, async () => jsonResponse({ error: 'rate limit' }, 429)],
    [GEMINI_URL, async (u, o) => { geminiBody = JSON.parse(o.body); return geminiOk('Jawab tanpa web.'); }]
  ]);

  const res = mockRes();
  await handler({
    method: 'POST',
    body: {
      messages: [
        { role: 'system', content: 'You are JIN.' },
        { role: 'user', content: 'cek internet berita terbaru' }
      ]
    }
  }, res);

  restoreFetch();
  delete process.env.TAVILY_API_KEY;

  assert.strictEqual(res.statusCode, 200, 'handler harus tetap 200 saat search gagal');
  const sys = geminiBody.systemInstruction?.parts?.[0]?.text || '';
  const ctx = geminiBody.contents.filter(c => c.role === 'user').pop().parts[0].text;
  assert.ok(sys.includes('Pencarian internet tidak tersedia'), 'catatan kegagalan tidak ada di system instruction: ' + sys);
  assert.ok(sys.includes('jangan mengklaim telah melakukan pencarian internet'), 'larangan klaim palsu tidak ada: ' + sys);
  assert.ok(!ctx.includes('DATA FAKTA TERVERIFIKASI'), 'evidence palsu ter-inject');
  assert.ok(!res.body._agent, 'tidak boleh ada metadata search saat search gagal');
});

await checkAsync('handler: TAVILY_API_KEY hilang -> tidak ada panggilan ke Tavily', async () => {
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  delete process.env.TAVILY_API_KEY;
  stubFetch([[GEMINI_URL, async () => geminiOk()]]);

  const res = mockRes();
  await handler({
    method: 'POST',
    body: { messages: [{ role: 'user', content: 'cek internet berita terbaru' }] }
  }, res);

  restoreFetch();
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(fetchCalls.filter(c => c.url.includes(TAVILY_URL)).length, 0, 'Tavily dipanggil tanpa API key');
});

await checkAsync('handler: obrolan biasa TIDAK menjalankan web search', async () => {
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.TAVILY_API_KEY = 'tvly-test-key';
  stubFetch([[GEMINI_URL, async () => geminiOk()]]);

  const res = mockRes();
  await handler({
    method: 'POST',
    body: { messages: [{ role: 'user', content: 'Halo JINI, apa kabar?' }] }
  }, res);

  restoreFetch();
  delete process.env.TAVILY_API_KEY;
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(fetchCalls.filter(c => c.url.includes(TAVILY_URL)).length, 0, 'web search jalan untuk obrolan biasa');
});

await checkAsync('handler: API key tidak pernah bocor ke response browser', async () => {
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.TAVILY_API_KEY = 'tvly-super-secret';
  stubFetch([
    [TAVILY_URL, async () => jsonResponse({ answer: 'ok', results: [{ title: 'T', url: 'https://e.example/1', content: 'c' }] })],
    [GEMINI_URL, async () => geminiOk('Jawaban.')]
  ]);

  const res = mockRes();
  await handler({
    method: 'POST',
    body: { stream: true, messages: [{ role: 'user', content: 'cek internet berita terbaru' }] }
  }, res);

  restoreFetch();
  delete process.env.TAVILY_API_KEY;
  assert.ok(!res.sse.includes('tvly-super-secret'), 'API key bocor ke SSE');
  assert.ok(!JSON.stringify(res.body || {}).includes('tvly-super-secret'), 'API key bocor ke payload');
});

/* ── [3] Regresi 9Router image generation ───────────────────────────────── */

console.log('\n[3] Regresi 9Router image generation');

check('kode 9Router tetap ada utuh (tidak dihapus / tidak dirouting ulang)', () => {
  assert.ok(API_SRC.includes('async function generateImageWithNineRouter'), 'fungsi 9Router hilang');
  assert.ok(API_SRC.includes('/v1/models/image'), 'discovery model image hilang');
  assert.ok(API_SRC.includes('/v1/images/generations'), 'endpoint generate image hilang');
  assert.ok(API_SRC.includes("process.env.NINEROUTER_URL || NINEROUTER_PUBLIC_URL"), 'routing URL 9Router berubah');
  assert.ok(API_SRC.includes("process.env.NINEROUTER_KEY"), 'pengambilan NINEROUTER_KEY berubah');
  assert.ok(API_SRC.includes("gateway: '9ROUTER'"), 'penanda gateway 9ROUTER hilang');
  assert.ok(API_SRC.includes('async function generateImageWithGemini'), 'fallback Gemini image hilang');
  assert.ok(API_SRC.includes('stageTimer'), 'budget 50s image stage hilang');
});

await checkAsync('handler: alur image 9Router tetap berfungsi (imageUrl dikembalikan)', async () => {
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.NINEROUTER_KEY = 'nr-test-key';
  process.env.NINEROUTER_URL = 'https://ninerouter.test';
  delete process.env.TAVILY_API_KEY;

  stubFetch([
    ['ninerouter.test/v1/models/image', async () => jsonResponse({ data: [{ id: 'ag/gemini-3.1-flash-image' }] })],
    ['ninerouter.test/v1/images/generations', async () => jsonResponse({ data: [{ url: 'https://cdn.example/img.png' }] })],
    [GEMINI_URL, async () => geminiOk()]
  ]);

  const res = mockRes();
  await handler({
    method: 'POST',
    body: {
      messages: [{ role: 'user', content: 'buatkan gambar kucing lucu rasio 16:9' }]
    }
  }, res);

  restoreFetch();
  delete process.env.NINEROUTER_KEY;
  delete process.env.NINEROUTER_URL;

  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.body._agent, '_agent image tidak ada');
  assert.strictEqual(res.body._agent.intent, 'IMAGE_GENERATION');
  assert.strictEqual(res.body._agent.artifactType, 'IMAGE');
  assert.strictEqual(res.body._agent.imageUrl, 'https://cdn.example/img.png');
  assert.strictEqual(fetchCalls.filter(c => c.url.includes(GEMINI_URL)).length, 0, 'chat Gemini dipanggil untuk intent gambar');
});

/* ── ringkasan ───────────────────────────────────────────────────────────── */

console.log(`\n  RESULT: ${passed}/${passed + failed} Tests Passed.\n`);
if (failed > 0) process.exit(1);
