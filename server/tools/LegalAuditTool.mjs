/**
 * LegalAuditTool.mjs
 * NATIVE Audit Engine (Audit Hukum + Audit Kebijakan) — kemampuan penuh seperti
 * aj.beritaindonesia.news (Audit Justice), TANPA ketergantungan ke situs eksternal.
 *
 * 2 MESIN AUDIT (mode dipilih otomatis dari isi dokumen):
 *  - hukum     : Audit Hukum — putusan/BAP/dakwaan/gugatan/replik/eksepsi/
 *                dokumen proses penegakan hukum Indonesia (laporan A–H +
 *                SKOR INTEGRITAS 0–100).
 *  - kebijakan : Audit Kebijakan (AKP) — Peraturan Pemerintah/UU/Perda/APBN/
 *                APBD/kebijakan publik (ringkasan eksekutif + skor 0–100 +
 *                risk level + analisis konstitusi UUD 1945 + risiko KKN +
 *                konflik kepentingan + rekomendasi).
 *
 * Ditenagai 9Router proxy (http://localhost:20128) dengan NINEROUTER_KEY —
 * bukan model lokal lemah.
 */

import { ToolContract, PERMISSION_LEVELS } from './ToolContract.mjs';
import '../../server/config/env.mjs';

const MAX_DOC_CHARS = 120000;

const NINEROUTER_DEFAULT_URL = 'http://127.0.0.1:20128';
const DEFAULT_MODEL = process.env.LEGAL_AUDIT_MODEL || 'cx/gpt-5.6-luna';

const MODE_PROMPTS = {

  hukum: {
    label: 'Audit Hukum',
    intro: 'Anda adalah Auditor Hukum AI tingkat tinggi dengan prinsip Keadilan Objektif, berspesialisasi mengaudit dokumen proses penegakan hukum Indonesia (putusan pengadilan, surat dakwaan JPU, BAP penyidikan Polri, gugatan/eksepsi/replik/duplik perkara perdata-agama, atau dokumen hukum acara lainnya).',
    sections: [
      'A. RINGKASAN DOKUMEN HUKUM SECARA OBJEKTIF',
      'B. AUDIT SYARAT FORMIL',
      'C. AUDIT HUKUM MATERIIL / UJI KORELASI FAKTA DENGAN UNSUR PASAL',
      'D. EVALUASI KEKUATAN ALAT BUKTI DAN PEMBUKTIAN',
      'E. TEMUAN CACAT HUKUM, KELEMAHAN FATAL, ATAU ANOMALI PROSES',
      'F. PEMENUHAN ASAS KEADILAN DAN DUE PROCESS OF LAW',
      'G. KESIMPULAN DAN REKOMENDASI OBJEKTIF',
      'H. SKOR INTEGRITAS DOKUMEN (0-100)'
    ]
  },

  kebijakan: {
    label: 'Audit Kebijakan',
    intro: 'Anda adalah sistem Audit Kebijakan Publik (AKP) Republik Indonesia — auditor kebijakan negara yang mencermati Integritas Kebijakan Publik, kepatuhan terhadap Undang-Undang Dasar 1945, asas konstitusi, dan keadilan distributif atas dokumen peraturan perundang-undangan (Peraturan Pemerintah, Perda, UU, keputusan/kebijakan publik) dan dokumen anggaran (APBN/APBD).',
    sections: [
      'A. RINGKASAN EKSEKUTIF (Judul Laporan + Skor 0-100 + Risk Level TINGGI/SEDANG/RENDAH)',
      'B. ANALISIS KONSTITUSI (kesesuaian dengan UUD 1945, pasal-pasal yang terlibat)',
      'C. ANALISIS DAMPAK PUBLIK (keadilan distributif, dampak sosial-ekonomi masyarakat)',
      'D. RISIKO KKN (penyimpangan anggaran, korupsi, kolusi, nepotisme, deviasi anggaran)',
      'E. POTENSI KONFLIK KEPENTINGAN',
      'F. PENYIMPANGAN UUD 1945 / PERATURAN DI ATASNYA (lex superior, uji materiil)',
      'G. REKOMENDASI AKP (rekomendasi kebijakan perbaikan yang berkeadilan)',
      'H. KESIMPULAN AKHIR + DAFTAR TEMUAN + JEJAK INVESTIGASI LANJUTAN + REFERENSI KONSTITUSI'
    ]
  }
};

const DETECTION_RULES = [
  { mode: 'kebijakan', weight: 30, re: /(?:peraturan\s+pemerintah|peraturan\s+presiden|kebijakan\s+publik|audit\s+kebijakan|anggaran\s+pendapatan|APBN|APBD|perda|perpu|undang-undang\s+(?:nomor|tentang)|deviasi\s+anggaran|keadilan\s+distributif|asas\s+konstitusi|omnibus\s+law|tata\s+kelola)/gi },
  { mode: 'hukum', weight: 30, re: /(?:putusan|surat\s+dakwaan|dakwaan\s+penuntut|JPU|penuntut\s+umum|kejaksaan|jaksa|berita\s+acara\s+pemeriksaan|BAP\s+penyidik|laporan\s+polisi|penyidikan|penyidik|polrestabes|pengadilan\s+agama|pengadilan\s+negeri|cerai\s+gugat|khulu|talak|perkara\s+waris|hadhanah|itsbat\s+nikah|gugatan\s+perdata|sengketa\s+perdata|KUHPerdata|wanprestasi|perbuatan\s+melawan\s+hukum|niet\s+ontvankelijk|rekonvensi|arbitrase|tindak\s+pidana|KUHP|KUHAP|pidana\s+penjara|korupsi|narkotika|terdakwa|tersangka|saksi|barang\s+bukti|sidang|perkara|litigasi|replik|duplik|eksepsi|memori\s+banding)/gi }
];

function detectMode(text = '') {
  const src = String(text || '').slice(0, 6000);
  let best = { mode: 'hukum', score: 0 };
  for (const rule of DETECTION_RULES) {
    const matches = src.match(rule.re) || [];
    const score = matches.length * rule.weight + (rule.re.test(src) ? rule.weight : 0);
    if (score > best.score) best = { mode: rule.mode, score };
  }
  return best.mode;
}

/**
 * Shared intent lexicon for Legal Audit (Audit Justice + Audit Kebijakan).
 * Single source of truth: the LocalRouter fast-path and SemanticIntentEngine
 * both classify legal/policy document audit through these expressions so the
 * deterministic gate and the agent pipeline can never disagree.
 */
export const LEGAL_AUDIT_VERB_RE = /(?:audit|bedah|kelemahan\s+hukum|cacat\s+hukum|skor\s+integritas|integritas\s+dokumen|analisis\s+putusan|analisis\s+dakwaan|analisis\s+bap|analisis\s+gugatan|analisis\s+lawan|bantahan|rekonvensi|uji\s+materiil|uji\s+formil|berita\s+acara\s+pemeriksaan|\bBAP\b|surat\s+dakwaan|putusan\s+pengadilan|gugatan\s+perdata|perkara\s+(?:pidana|perdata|agama)|dokumen\s+hukum|hukum\s+acara|litigasi|replik|duplik|eksepsi|kebijakan\s+publik|peraturan\s+pemerintah|deviasi\s+anggaran|anggaran\s+negara|apbn|apbd)\b/i;

export const LEGAL_AUDIT_DOC_RE = /(?:putusan|dakwaan|BAP|berita\s+acara|gugatan|eksepsi|replik|duplik|pengadilan|sidang|tersangka|terdakwa|warsita|perkara|hukum|peraturan\s+pemerintah|perda|kebijakan|anggaran|apbn|apbd|undang-undang|omnibus)/i;

/**
 * Deterministic Legal Audit intent gate.
 *
 * Contract: an audit is only triggered when the utterance carries BOTH a
 * legal/policy document marker AND an audit verb. This mirrors the existing
 * router fast-path and prevents bare mentions ("hukum acara") from hijacking
 * ordinary document analysis.
 *
 * @param {string} utterance - raw user turn (may contain embedded document blocks)
 * @param {Object} [options]
 * @param {boolean} [options.hasDocumentContext] - override document-context detection
 * @returns {{ isLegalAudit: boolean, reason: string, hasLegalDocMarker: boolean, hasLegalVerb: boolean }}
 */
export function detectLegalAuditIntent(utterance, options = {}) {
  const r = String(utterance || '');
  const hasDocumentContext = typeof options.hasDocumentContext === 'boolean'
    ? options.hasDocumentContext
    : (r.includes('--- [BERKAS DOKUMEN') || r.includes('--- [DOKUMEN') ||
       r.includes('--- [Konteks Dokumen') || r.includes('--- [STATUS DOKUMEN'));

  const hasLegalVerb = LEGAL_AUDIT_VERB_RE.test(r);
  const hasLegalDocMarker = hasDocumentContext && LEGAL_AUDIT_DOC_RE.test(r);

  return {
    isLegalAudit: hasLegalDocMarker && hasLegalVerb,
    reason: hasLegalDocMarker && hasLegalVerb
      ? 'Legal/policy document marker + audit verb detected.'
      : (hasLegalVerb && !hasDocumentContext
        ? 'Audit verb detected but no document context attached.'
        : 'No legal audit intent detected.'),
    hasLegalDocMarker,
    hasLegalVerb
  };
}

function sanitizeFileName(name, fallback) {
  const clean = String(name || '')
    .replace(/[\\/:*?"<>|\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return clean || fallback;
}

function _baseUrl() {
  return (process.env.NINEROUTER_URL || NINEROUTER_DEFAULT_URL).replace(/\/+$/, '');
}

function _authHeaders() {
  const key = String(process.env.NINEROUTER_KEY || '').trim();
  return key && key.length > 0 && key !== 'NINEROUTER_KEY_ANDA' ? { Authorization: `Bearer ${key}` } : {};
}

function _maskSecrets(text = '') {
  const raw = String(text);
  const key = String(process.env.NINEROUTER_KEY || '').trim();
  let out = raw;
  if (key && key.length >= 8) out = out.split(key).join('[REDACTED]');
  return out.replace(/(sk-[A-Za-z0-9_-]{6,})/g, '[REDACTED]');
}

/**
 * Call the 9Router OpenAI-compatible chat endpoint (single source of truth for
 * LegalAuditTool). Non-stream → returns { content }. Stream → pipes tokens into
 * onChunk and returns { content }. No hardcoded Gemini keys — only NINEROUTER_KEY.
 */
export async function ninerouterChat({ messages, model = DEFAULT_MODEL, temperature = 0.3, maxTokens = 16000, stream = false }, onChunk = null) {
  const url = `${_baseUrl()}/v1/chat/completions`;
  const headers = { 'Content-Type': 'application/json', ..._authHeaders() };
  const body = JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream });

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(stream ? 240000 : 120000)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err = new Error(`LegalAuditTool 9Router HTTP ${res.status}: ${_maskSecrets(errText).slice(0, 240)}`);
    err.code = `NINEROUTER_HTTP_${res.status}`;
    throw err;
  }

  if (!stream) {
    const data = await res.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content || '';
    if (!content.trim()) {
      const err = new Error(`LegalAuditTool 9Router empty response: ${_maskSecrets(JSON.stringify(data).slice(0, 200))}`);
      err.code = 'NINEROUTER_EMPTY_RESPONSE';
      throw err;
    }
    return { content };
  }

  // SSE stream: data: {...} lines (OpenAI format)
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '', fullText = '';
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
        const chunk = parsed?.choices?.[0]?.delta?.content || '';
        if (chunk) { fullText += chunk; if (typeof onChunk === 'function') onChunk(chunk); }
      } catch { }
    }
  }
  if (!fullText.trim()) {
    const err = new Error('LegalAuditTool 9Router empty stream');
    err.code = 'NINEROUTER_EMPTY_STREAM';
    throw err;
  }
  return { content: fullText };
}

export class LegalAuditTool extends ToolContract {
  constructor() {
    super({
      name: 'legal.audit',
      version: '1.0.0',
      description: 'Mesin Audit native JIN (2 mode): "Audit Hukum" untuk dokumen proses penegakan hukum (putusan/BAP/dakwaan/gugatan/replik/eksepsi/perkara) menghasilkan laporan A-H + Skor Integritas 0-100; "Audit Kebijakan" (AKP) untuk peraturan pemerintah/UU/Perda/APBN-APBD/kebijakan publik menghasilkan ringkasan eksekutif + skor 0-100 + risk level + analisis konstitusi UUD 1945 + risiko KKN + konflik kepentingan + rekomendasi. Mode dipilih otomatis dari isi dokumen. Ditenagai 9Router.',
      inputSchema: { documentText: 'string', query: 'string', fileName: 'string', mode: 'string' },
      outputSchema: { mode: 'string', label: 'string', status: 'string', report: 'string', fileName: 'string', latencyMs: 'number' },
      permissionLevel: PERMISSION_LEVELS.READ_ONLY,
      timeoutMs: 60000
    });
  }

  /**
   * Synchronous readiness probe for CapabilityRegistry truth gating.
   * Verifies the 9Router gateway is configured (URL + non-placeholder key).
   * Kept synchronous on purpose: getAvailableCapabilities() calls
   * checkLiveHealth() without await.
   */
  capabilityProbe() {
    const key = String(process.env.NINEROUTER_KEY || '').trim();
    const url = _baseUrl();
    const keyConfigured = key.length > 0 && key !== 'NINEROUTER_KEY_ANDA';
    return {
      available: keyConfigured,
      provider: '9ROUTER',
      reason: keyConfigured
        ? `9Router gateway terkonfigurasi pada ${url} (model ${DEFAULT_MODEL}).`
        : 'NINEROUTER_KEY belum dikonfigurasi — Audit Justice/Audit Kebijakan tidak dapat dijalankan.',
      gateway: url,
      model: DEFAULT_MODEL,
      modes: Object.values(MODE_PROMPTS).map(m => m.label)
    };
  }

  detectMode(documentText, query = '') {
    const hinted = String(query || '').toLowerCase();
    if (/(?:audit\s+kebijakan|kebijakan\s+publik|peraturan\s+pemerintah|perda|apbn|apbd|deviasi\s+anggaran|omnibus\s+law|tata\s+kelola)/.test(hinted)) return 'kebijakan';
    return detectMode(documentText);
  }

  buildMessages({ documentText, query, fileName, mode }) {
    const framework = MODE_PROMPTS[mode] || MODE_PROMPTS.hukum;
    const sectionLines = framework.sections.map((s, i) => `${i + 1}. ${s}`).join('\n');
    const trimmedDoc = String(documentText || '').slice(0, MAX_DOC_CHARS);
    const truncated = String(documentText || '').length > MAX_DOC_CHARS;

    const systemPrompt = [
      framework.intro,
      '',
      'TUGAS: Lakukan audit hukum menyeluruh terhadap dokumen di bawah ini. Bersikap objektif, berimbang, tegas terhadap cacat hukum, dan berpedoman pada asas keadilan, due process of law, serta hukum positif Indonesia.',
      '',
      'STRUKTUR LAPORAN — wajib menghasilkan bagian berikut lengkap dengan sub-pembahasan mendalam:',
      sectionLines,
      '',
      'ATURAN PENULISAN:',
      '- Gunakan Bahasa Indonesia baku dan formal kedinasan.',
      '- Setiap bagian diberi heading sesuai format di atas.',
      '- Pada bagian "SKOR INTEGRITAS", berikan angka 0-100, disertai rincian: Poin Kekuatan, Poin Kelemahan, dan Rekomendasi Perbaikan. Perjelas apakah dokumen layak/sah, berpotensi batal, atau mengandung cacat hukum fatal.',
      '- Bila dokumen terlalu pendek/ tidak jelas, tetap berikan analisis obyektif atas apa yang tersedia dan tandai area yang butuh data lanjutan.',
      '- Jangan pernah menolak menganalisis dokumen hukum. Tangani sensitivitas dengan sikap profesional auditor.'
    ].join('\n');

    const userContent = [
      `Nama Dokumen: ${fileName}`,
      `MODE AUDIT: ${framework.label}`,
      truncated ? `[PERHATIAN: Dokumen terpotong — hanya ${MAX_DOC_CHARS} karakter pertama dianalisis dari total ${String(documentText || '').length} karakter.]` : '',
      '',
      'BERIKUT ISI DOKUMEN LENGKAP YANG DIAUDIT:',
      '--------------------------------',
      trimmedDoc,
      '--------------------------------',
      '',
      query ? `INSTRUKSI / FOKUS AUDIT PENGGUNA: ${query}` : 'Lakukan audit menyeluruh berdasarkan seluruh isi dokumen.',
      ''
    ].filter(Boolean).join('\n');

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ];
  }

  async execute({ documentText = '', query = '', fileName = 'Dokumen Hukum.txt', mode = 'auto' }, onChunk = null) {
    const startTime = Date.now();
    const resolvedMode = mode && mode !== 'auto' && MODE_PROMPTS[mode] ? mode : this.detectMode(documentText, query);
    const framework = MODE_PROMPTS[resolvedMode];
    const fileNameSafe = sanitizeFileName(fileName, 'Dokumen Hukum.txt');

    const none = { mode: resolvedMode, label: framework.label, status: 'EMPTY_DOCUMENT', report: '', fileName: fileNameSafe, latencyMs: 0 };
    if (!documentText || !documentText.trim()) return none;

    const messages = this.buildMessages({ documentText, query, fileName: fileNameSafe, mode: resolvedMode });

    let report = '';
    if (typeof onChunk === 'function') {
      const result = await ninerouterChat({ messages, model: DEFAULT_MODEL, temperature: 0.3, stream: true }, onChunk);
      report = result.content;
    } else {
      const result = await ninerouterChat({ messages, model: DEFAULT_MODEL, temperature: 0.3, stream: false });
      report = result.content;
    }

    return {
      mode: resolvedMode,
      label: framework.label,
      status: 'OK',
      report,
      fileName: fileNameSafe,
      latencyMs: Date.now() - startTime
    };
  }
}

export const legalAuditToolInstance = new LegalAuditTool();
export default legalAuditToolInstance;