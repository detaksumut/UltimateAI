/**
 * QwenEvidenceReasoner.mjs
 * PHASE 3 — Qwen Evidence Boundary.
 * PHASE 6 — Analytical Reasoning Contract (FACT / ANALYSIS / INFERENCE).
 *
 * HARD CONTRACT (both directions enforced):
 *   IN  (9Router -> Qwen): { documentId, query, evidence[] }
 *       evidence[] items: { evidenceId, page, type, content, confidence }
 *       NEVER: pdfBytes, documentText mentah, OCR mentah.
 *   OUT (Qwen -> Verifier):
 *       { answer, claims: [{ text, evidenceIds[], kind }] }
 *       kind ∈ { FACT, ANALYSIS, INFERENCE } — default FACT (backward compatible).
 *
 * PHASE 6 layers (kontrak document-analysis):
 *   FACT      — eksplisit di dokumen, evidenceIds wajib, verifier: VERIFIED/...
 *   ANALYSIS  — pola/hubungan antar-evidence, evidenceIds wajib (>=1, dianjurkan 2),
 *               tanpa evidence -> REJECT oleh verifier (bukan VERIFIED).
 *   INFERENCE — interpretasi JIN melampaui dokumen, TANPA klaim fakta,
 *               wajib membawa penanda "Inferensi JIN" di teks, dilabel di report,
 *               tidak pernah VERIFIED (max INSUFFICIENT/labeled).
 *
 * Strategy: adapter, NOT big-bang replacement.
 *   reasonOverEvidence() runs Qwen :8080 over evidence-tagged context,
 *   then parses claims with evidenceIds. Legacy synthesis path stays
 *   available; production wires this as evidence-gated reasoning.
 */
import { nineRouterChatAdapterInstance } from '../providers/NineRouterChatAdapter.mjs';

const BOUNDARY_VERSION = 'qwen-evidence-boundary-v1';
const FORBIDDEN_INPUT_KEYS = ['pdfBytes', 'documentText', 'rawOcr', 'rawText', 'buffer', 'dataUrl'];
export const QWEN_EVIDENCE_TIMEOUT_MS = Number(process.env.QWEN_EVIDENCE_TIMEOUT_MS || 600000);
// Default 600s: streaming adapter sudah memakai inactivity-watchdog 120s, jadi
// batas ini hanya pengaman akhir — generate lambat di CPU tidak boleh dipotong.

function assertBoundaryInput(input = {}) {
  for (const k of FORBIDDEN_INPUT_KEYS) {
    if (input[k] !== undefined && input[k] !== null) {
      throw new Error(`[QwenEvidenceBoundary] FORBIDDEN input key "${k}" — Qwen hanya boleh menerima {documentId,query,evidence}.`);
    }
  }
  if (!input.documentId) throw new Error('[QwenEvidenceBoundary] documentId required.');
  if (!Array.isArray(input.evidence) || input.evidence.length === 0) {
    throw new Error('[QwenEvidenceBoundary] evidence[] kosong — Qwen tidak boleh bernalar tanpa evidence.');
  }
}

export function buildEvidenceContext(evidence = [], maxChars = 12000) {
  const blocks = [];
  let used = 0;
  for (const ev of (evidence || [])) {
    const body = typeof ev?.content === 'string' ? ev.content.trim() : '';
    if (!body) continue;
    const tag = `[${ev.evidenceId} | hal ${ev.page} | ${ev.type}]`;
    const chunk = `${tag}\n${body}`;
    if (used + chunk.length > maxChars) break;
    blocks.push(chunk);
    used += chunk.length;
  }
  return blocks.join('\n\n');
}

export const CLAIM_KINDS = Object.freeze({
  FACT: 'FACT',
  ANALYSIS: 'ANALYSIS',
  INFERENCE: 'INFERENCE'
});

const INFERENCE_LABEL = 'Inferensi JIN';

function detectKind(sentence = '', currentSection = 'FACT') {
  const s = String(sentence || '');
  if (/\[ANALYSIS\]/i.test(s) || /^bukti-[A-D]\s*:/i.test(s.trim())) return CLAIM_KINDS.ANALYSIS;
  if (/\[INFERENCE\]/i.test(s) || /inferensi\s+jin/i.test(s)) return CLAIM_KINDS.INFERENCE;
  if (/\[FACT\]/i.test(s) || /\[FAKTA\]/i.test(s)) return CLAIM_KINDS.FACT;
  return CLAIM_KINDS[currentSection] || CLAIM_KINDS.FACT;
}

/**
 * PHASE 6b — baris "Bukti-A/B/C/D: [EV-..] [EV-..]" adalah KELANJUTAN dari baris
 * tahap A-D di atasnya (pemisahan penalaran vs kutipan yang dipaksa kontrak).
 * Baris bukti tidak berdiri sendiri: ia mewariskan evidenceIds ke klaim tahapnya.
 */
function mergeBuktiLines(answer = '', knownIds = []) {
  const idSet = new Set(knownIds);
  const merged = [];
  let pending = null;
  for (const rawLine of String(answer || '').split('\n')) {
    const line = rawLine;
    const m = line.match(/^\s*bukti-([A-D])\s*:\s*(.*)$/i);
    if (m && pending) {
      const cited = [...m[2].matchAll(/\b(EV-[A-Z0-9]+)/g)].map((x) => x[1]).filter((id) => idSet.has(id));
      if (cited.length > 0) {
        pending = `${pending.trim()} ${line.trim()}`;
      }
      // baris Bukti- tidak pernah menjadi klaim sendiri
      continue;
    }
    if (pending) { merged.push(pending); pending = null; }
    pending = line;
  }
  if (pending) merged.push(pending);
  return merged.join('\n');
}

function detectSection(line = '') {
  const s = String(line || '').toLowerCase();
  if (/inferensi/.test(s)) return CLAIM_KINDS.INFERENCE;
  if (/analisis|hubungan antar|implikasi|kelemahan|konsistensi|metodolog|anomali|pemeriksaan|perlu verifikasi/.test(s)) return CLAIM_KINDS.ANALYSIS;
  if (/fakta|ringkasan|temuan|kesimpulan/.test(s)) return CLAIM_KINDS.FACT;
  return null;
}

/** Exported for deterministic testing of the layered claim parser (PHASE 6). */
export function parseClaims(answer = '', knownIds = []) {
  const claims = [];
  // PHASE 6b: gabungkan baris Bukti-A/B/C/D ke baris tahapnya DULU,
  // lalu parse seperti biasa — tidak ada provenance yang difabrikasi.
  const lines = mergeBuktiLines(answer, knownIds).split('\n');
  let section = 'FACT';
  const seenTexts = new Set();
  for (const line of lines) {
    const sec = detectSection(line);
    if (sec && line.length < 80) { section = sec; continue; }
    const sentences = String(line || '').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    for (const s of sentences.slice(0, 24)) {
      if (claims.length >= 24) break;
      const cited = [...s.matchAll(/\b(EV-[A-Z0-9]+)/g)].map((m) => m[1]).filter((id) => new Set(knownIds).has(id));
      const kind = detectKind(s, section);
      // INFERENCE boleh tanpa kutipan (dilabel, bukan fakta); FACT/ANALYSIS wajib berkutipan.
      if (cited.length === 0 && kind !== CLAIM_KINDS.INFERENCE) continue;
      const text = kind === CLAIM_KINDS.INFERENCE && !/inferensi\s+jin/i.test(s)
        ? `${INFERENCE_LABEL}: ${s}`.slice(0, 500)
        : s.slice(0, 500);
      // Dedupe: jawaban Qwen bisa mengulang kalimat sama antar seksi
      // (FAKTA KUNCI vs KESIMPULAN) — satu klaim unik per teks.
      const norm = text.toLowerCase().replace(/\s+/g, ' ').trim();
      if (seenTexts.has(norm)) continue;
      seenTexts.add(norm);
      claims.push({ text, evidenceIds: [...new Set(cited)], kind });
    }
  }
  return claims;
}

export class QwenEvidenceReasoner {
  constructor() {
    this.version = BOUNDARY_VERSION;
  }

  contractFromEnvelope(envelope, query = '') {
    return {
      documentId: envelope?.document?.documentId || null,
      query,
      evidence: (envelope?.evidence || [])
        .filter((e) => typeof e?.content === 'string' && e.content.trim())
        .map((e) => ({
          evidenceId: e.evidenceId, page: e.page, type: e.type,
          content: String(e.content).slice(0, 6000), confidence: e.confidence
        }))
    };
  }

  async reasonOverEvidence(input = {}, opts = {}) {
    assertBoundaryInput(input);
    const fetchFn = opts.fetchFn || globalThis.fetch;
    void fetchFn;
    const evidenceCtx = buildEvidenceContext(input.evidence);
    if (!evidenceCtx) {
      return {
        status: 'INSUFFICIENT_EVIDENCE', answer: '',
        claims: [], reason: 'Tidak ada evidence tekstual untuk reasoning.',
        boundary: this.version
      };
    }
    const knownIds = input.evidence.map((e) => e.evidenceId);
    const systemPrompt = [
      'Kamu adalah Qwen, reasoning engine JIN atas evidence dokumen dari 9Router.',
      'ATURAN KERAS:',
      '- Bernalar HANYA atas evidence ber-tag [EV-xxx] di bawah.',
      '- Lapisan FAKTA: setiap kalimat faktual WAJIB mengutip tag evidenceId yang mendukungnya, mis. [EV-ABC123].',
      '- Lapisan ANALISIS — WAJIB 4 tahap berurutan, tiap tahap WAJIB ada di jawaban:',
      '  A. HUBUNGAN: baca hubungan antarvariabel/antar-temuan dari evidence',
      '     (siapa mempengaruhi apa, lewat apa) — bukan sekadar menyebut hasil.',
      '  B. KONSISTENSI KONSEP: BILA hasil menyebut "positif"/"signifikan", WAJIB tulis',
      '     kalimat: "Arah positif tidak otomatis berarti baik — makna hubungan bergantung pada',
      '     definisi operasional dan instrumen variabel." lalu kutip [EV-xxx] evidence hasil.',
      '     Jangan menukar arah hasil menjadi penilaian normatif.',
      '  C. METODOLOGI: BILA penelitian menyebut metode TETAPI hasil memakai istilah kuantitatif',
      '     ("efek signifikan", "taraf signifikan"), WAJIB tulis "Perlu verifikasi metodologis:"',
      '     + daftar yang harus diperiksa (responden, instrumen, pengujian statistik) — kutip',
      '     [EV-xxx] evidence metode DAN evidence hasil.',
      '  D. ANOMALI: BILA beberapa variabel semuanya dilaporkan arah yang sama (mis. semuanya',
      '     positif signifikan), WAJIB tandai pertanyaan: "Mengapa arah seragam? perlu',
      '     pemeriksaan konstruk instrumen." — kutip [EV-xxx]. JAWABAN "tidak ada anomali"',
      '     TANPA pemeriksaan itu dilarang. Bila temuan berlawanan konsep umum (mis. belanja',
      '     impulsif dilaporkan berpengaruh positif), tandai sebagai pertanyaan analitis —',
      '     jangan dibalik, jangan dipaksa selaras, jangan diabaikan.',
      '  BUKTI PER TAHAP (wajib — ini yang membuat analisis bisa diverifikasi):',
      '  - Di bawah baris A tulis bukti: "Bukti-A: [EV-xxx] [EV-yyy]" (1-3 tag).',
      '  - Di bawah baris B tulis bukti: "Bukti-B: [EV-xxx]" (tag evidence hasil).',
      '  - Di bawah baris C tulis bukti: "Bukti-C: [EV-xxx] [EV-yyy]" (tag metode + tag hasil).',
      '  - Di bawah baris D tulis bukti: "Bukti-D: [EV-xxx] [EV-yyy]" (tag-tag temuan terkait).',
      '  Baris tahap yang tidak diikuti baris Bukti-= dibuang verifier (= gagal bernalar).',
      '- Lapisan INFERENSI: interpretasi JIN yang melampaui dokumen — TANPA klaim fakta baru,',
      '  WAJIB diawali label "Inferensi JIN:" dan TIDAK boleh mengutip [EV-xxx] sebagai bukti fakta.',
      '- DILARANG mengarang isi di luar evidence, menebak nomor halaman, atau menambah fakta luar.',
      '- Jika evidence tidak cukup: jawab "Tidak ditemukan evidence yang cukup dalam dokumen."',
      'FORMAT WAJIB:',
      '1) RINGKASAN EKSEKUTIF (3-6 kalimat, tiap kalimat kutip [EV-xxx])',
      '2) FAKTA KUNCI (butir faktual eksplisit, tiap butir kutip [EV-xxx])',
      '3) ANALISIS JIN (tahap A Hubungan, B Konsistensi konsep, C Metodologi, D Anomali —',
      '   tiap kalimat kutip [EV-xxx]; kalau hanya mengulang FAKTA KUNCI itu BUKAN analisis)',
      '4) INFERENSI JIN (1-3 kalimat, tiap kalimat diawali "Inferensi JIN:", tanpa kutipan EV sebagai bukti)',
      '5) KESIMPULAN (1 paragraf sintesis fakta+analisis; WAJIB kutip [EV-xxx] —',
      '   kesimpulan tanpa kutipan akan dibuang verifier dan tidak disajikan)'
    ].join('\n');
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Dokumen ${input.documentId}.\n\nEVIDENCE:\n${evidenceCtx}\n\n---\nPertanyaan: ${input.query || 'Baca, rangkum, dan simpulkan dokumen ini.'}\nTulis jawaban dengan kutipan [EV-xxx] pada tiap klaim faktual.` }
    ];
    let answer = '';
    try {
      const timeoutMs = Number(opts.timeoutMs || QWEN_EVIDENCE_TIMEOUT_MS);
      const res = await Promise.race([
        nineRouterChatAdapterInstance.sendChat({
          // stream:true => adapter memakai inactivity-timeout (token mengalir =
          // tidak dipotong) alih-alih hard-timeout 120s non-stream. Di sini kita
          // tetap mengonsumsi jawaban penuh tanpa callback chunk.
          messages, stream: true,
          model: opts.model || undefined, temperature: 0.2, maxTokens: opts.maxTokens || 2048
        }, () => {}),
        new Promise((_, reject) => setTimeout(() => reject(new Error('QWEN_EVIDENCE_TIMEOUT')), timeoutMs))
      ]);
      answer = String(typeof res === 'string' ? res : (res?.content || res?.text || '')).trim();
    } catch (err) {
      return {
        status: 'REASONER_UNAVAILABLE', answer: '', claims: [],
        reason: `Qwen :8080 tidak tersedia: ${err.message}`,
        boundary: this.version
      };
    }
    if (!answer) {
      return {
        status: 'INSUFFICIENT_EVIDENCE', answer: '', claims: [],
        reason: 'Qwen mengembalikan jawaban kosong.', boundary: this.version
      };
    }
    const claims = parseClaims(answer, knownIds);
    return {
      status: claims.length > 0 ? 'OK' : 'NO_CITED_CLAIMS',
      answer, claims, knownIds,
      reason: claims.length > 0 ? 'claims ber-evidenceId' : 'jawaban tanpa kutipan EV-xxx',
      boundary: this.version
    };
  }
}

export const qwenEvidenceReasonerInstance = new QwenEvidenceReasoner();
export default qwenEvidenceReasonerInstance;
