/**
 * EngineRoutingContract.mjs
 * FINAL JIN ROUTING CONTRACT — kontrak sistem, bukan konfigurasi provider.
 *
 *   Qwen Local (:8080) ............ SIMPLE CONVERSATION ONLY
 *   9Router (server/document/...) .. SELURUH document intelligence
 *   Gemini 3.1 Image + ComfyUI .... image generation / revision
 *
 * Invariants (R1-R15):
 *   R1  SIMPLE_CONVERSATION            -> QWEN
 *   R2  DOCUMENT_* (read/analyze/...)  -> 9ROUTER
 *   R3  PDF -> QWEN                    = FORBIDDEN
 *   R4  DOCUMENT_ANALYSIS -> QWEN      = FORBIDDEN (engine dokumen = 9Router)
 *   R5  IMAGE_GENERATION               -> GEMINI_3_1_IMAGE / COMFYUI
 *   R6  IMAGE_REVISION                 -> COMFYUI / GEMINI_3_1_IMAGE
 *   R7  QWEN tidak pernah menerima PDF mentah (pdfBytes/buffer/dataUrl/rawOcr)
 *   R8  QWEN tidak pernah menjadi PDF reader / OCR / VISION / TABLE dokumen
 *   R9  Document evidence harus berasal dari 9Router
 *   R10 Image output harus berasal dari image engine
 *   R11 Fallback harus eksplisit (tercatat), tidak boleh diam-diam
 *   R12 Tidak boleh silent provider switching lintas domain
 *   R13 Perception worker dipilih PER-HALAMAN (bukan per-file): PDF teks ->
 *       ekstraksi teks langsung TANPA render/Vision; scan -> render+OCR;
 *       mixed -> execution plan per halaman. Gemini Vision/OCR = PERCEPTION
 *       WORKER, bukan default PDF reader.
 *   R14 Prinsip terkunci diekspos sebagai kontrak
 *       (DOCUMENT_INTELLIGENCE_PRINCIPLES) dan disalin ke
 *       JIN_OPERATING_DOCTRINE.DOCUMENT_INTELLIGENCE_POLICY (dibaca planner).
 *   R15 STAGE4 synthesis untuk domain DOCUMENT_* WAJIB lewat resolveDocAnalysisEngine():
 *       engine AG (provider cloud gemini) pertama; model explicit-local
 *       (llamacpp:/hermes/ollama:) = ROUTING_VIOLATION; AG down => REPORT
 *       UNAVAILABLE (fail-closed, dilarang senyap ke Qwen).
 *
 * Fail-closed per domain: CONVERSATION gagal -> CONVERSATION_UNAVAILABLE
 * (dilarang ke 9Router). DOCUMENT gagal -> INSUFFICIENT_EVIDENCE /
 * DOCUMENT_READ_FAILED (dilarang ke Qwen). IMAGE: Gemini <-> ComfyUI eksplisit.
 */

export const ENGINES = Object.freeze({
  QWEN_LOCAL: 'QWEN_LOCAL',
  NINEROUTER: 'NINEROUTER',
  GEMINI_IMAGE: 'GEMINI_3_1_IMAGE',
  COMFYUI: 'COMFYUI'
});

export const DOMAINS = Object.freeze({
  SIMPLE_CONVERSATION: 'SIMPLE_CONVERSATION',
  GENERAL_CHAT: 'GENERAL_CHAT',
  DOCUMENT_READ: 'DOCUMENT_READ',
  DOCUMENT_ANALYSIS: 'DOCUMENT_ANALYSIS',
  DOCUMENT_COMPARISON: 'DOCUMENT_COMPARISON',
  LEGAL_RESEARCH_DOC: 'LEGAL_RESEARCH_DOC',
  IMAGE_GENERATION: 'IMAGE_GENERATION',
  IMAGE_REVISION: 'IMAGE_REVISION'
});


// Matriks utama: domain -> { primary, forbidden[], fallback }
export const ROUTING_MATRIX = Object.freeze({
  SIMPLE_CONVERSATION: Object.freeze({
    primary: ENGINES.QWEN_LOCAL, forbidden: [ENGINES.NINEROUTER],
    fallback: null, fallbackNote: 'RETRY terkontrol -> CONVERSATION_UNAVAILABLE'
  }),
  GENERAL_CHAT: Object.freeze({
    primary: ENGINES.QWEN_LOCAL, forbidden: [ENGINES.NINEROUTER],
    fallback: null, fallbackNote: 'specialist hanya bila intent berubah kompleks'
  }),
  DOCUMENT_READ: Object.freeze({
    primary: ENGINES.NINEROUTER, forbidden: [ENGINES.QWEN_LOCAL],
    fallback: null, fallbackNote: 'retry worker / cross-check -> INSUFFICIENT_EVIDENCE / DOCUMENT_READ_FAILED'
  }),
  DOCUMENT_ANALYSIS: Object.freeze({
    primary: ENGINES.NINEROUTER, forbidden: [ENGINES.QWEN_LOCAL],
    fallback: null, fallbackNote: '9Router pemilik domain; engine lain down -> REPORT UNAVAILABLE'
  }),
  DOCUMENT_COMPARISON: Object.freeze({
    primary: ENGINES.NINEROUTER, forbidden: [ENGINES.QWEN_LOCAL],
    fallback: null, fallbackNote: '9Router per dokumen'
  }),
  LEGAL_RESEARCH_DOC: Object.freeze({
    primary: ENGINES.NINEROUTER, forbidden: [ENGINES.QWEN_LOCAL],
    fallback: null, fallbackNote: 'specialist melalui 9Router AG'
  }),
  IMAGE_GENERATION: Object.freeze({
    primary: ENGINES.GEMINI_IMAGE, forbidden: [ENGINES.QWEN_LOCAL],
    fallback: ENGINES.COMFYUI, fallbackNote: 'fallback eksplisit tercatat'
  }),
  IMAGE_REVISION: Object.freeze({
    primary: ENGINES.COMFYUI, forbidden: [ENGINES.QWEN_LOCAL],
    fallback: ENGINES.GEMINI_IMAGE, fallbackNote: 'fallback eksplisit tercatat'
  })
});

/**
 * Prinsip terkunci arsitektur dokumen (Fase 1-7) — KONTRAK, bukan saran.
 * Sinkron dengan JIN_OPERATING_DOCTRINE.DOCUMENT_INTELLIGENCE_POLICY di
 * server/agent/AgentPolicy.mjs; keduanya ditegakkan oleh
 * tests/jin/EngineRoutingContractTest.mjs (R13/R14).
 */
export const DOCUMENT_INTELLIGENCE_PRINCIPLES = Object.freeze({
  PRIMARY_ENGINE: '9Router AG = PRIMARY DOCUMENT INTELLIGENCE ENGINE (bukan sekadar extractor)',
  PERCEPTION_WORKERS: 'Gemini Vision/OCR = PERCEPTION WORKER, bukan default PDF reader',
  LOCAL_CONVERSATION: 'Qwen = LOCAL CONVERSATION ENGINE (SIMPLE CONVERSATION ONLY), bukan document-analysis engine',
  TEXT_PDF: 'text layer valid -> ekstraksi teks langsung (pdf-parse), TANPA render->Vision (hindari latency, biaya, error)',
  SCAN_PDF: 'tanpa text layer tepercaya -> render halaman -> Gemini Vision/OCR -> evidence',
  MIXED_PDF: 'execution plan PER-HALAMAN: TEXT/OCR/TABLE/VISION hanya halaman yang membutuh',
  REASONING: 'analisis/kesimpulan -> specialist reasoning atas evidence (9Router AG), bukan Qwen 3B'
});

const DOCUMENT_DOMAINS = new Set([
  'DOCUMENT_READ', 'DOCUMENT_ANALYSIS', 'DOCUMENT_COMPARISON', 'LEGAL_RESEARCH_DOC'
]);
const IMAGE_DOMAINS = new Set(['IMAGE_GENERATION', 'IMAGE_REVISION']);
const RAW_DOCUMENT_KEYS = ['pdfBytes', 'buffer', 'dataUrl', 'rawOcr', 'documentTextMentah'];

export function resolveEngine(domain) {
  const row = ROUTING_MATRIX[String(domain || '').toUpperCase()];
  if (!row) {
    const err = new Error(`ROUTING_VIOLATION: domain tidak dikenal "${domain}" — routing ditolak (fail-closed).`);
    err.code = 'ROUTING_VIOLATION';
    throw err;
  }
  return row;
}

export function assertEngineAllowed(domain, engine) {
  const row = resolveEngine(domain);
  const eng = String(engine || '').toUpperCase();
  if ((row.forbidden || []).map(String).includes(eng)) {
    const err = new Error(`ROUTING_VIOLATION: ${eng} FORBIDDEN untuk domain ${domain} (primary=${row.primary}).`);
    err.code = 'ROUTING_VIOLATION';
    err.domain = domain;
    err.engine = eng;
    throw err;
  }
  return row.primary;
}

export function assertQwenPayloadClean(payload = {}) {
  const hit = RAW_DOCUMENT_KEYS.filter((k) => payload[k] !== undefined && payload[k] !== null);
  if (hit.length > 0) {
    const err = new Error(`ROUTING_VIOLATION: payload Qwen membawa kunci dokumen mentah: ${hit.join(', ')} (R7).`);
    err.code = 'ROUTING_VIOLATION';
    throw err;
  }
  return true;
}

export function isDocumentDomain(domain) {
  return DOCUMENT_DOMAINS.has(String(domain || '').toUpperCase());
}

export function isImageDomain(domain) {
  return IMAGE_DOMAINS.has(String(domain || '').toUpperCase());
}

/**
 * R15 — STAGE4 synthesis engine untuk domain DOCUMENT_* (PURE, tanpa I/O).
 *
 * Engine AG (provider cloud gemini) adalah satu-satunya jawaban valid.
 * Model explicit-local (llamacpp:/hermes/ollama:) = ROUTING_VIOLATION
 * (hard guard: Qwen FORBIDDEN untuk DOCUMENT_ANALYSIS, R3/R4).
 * AG down => caller WAJIB fail-closed ke REPORT UNAVAILABLE
 * (dilarang senyap fallback ke Qwen — lihat routeChat strictCapability).
 *
 * Catatan arsitektur: "9Router AG" adalah peran, bukan provider terpisah.
 * Provider AG hari ini = Gemini cloud (GeminiProvider.sendChat). Bila suatu
 * saat provider AG fisik terpisah ada, cukup ubah return di sini —
 * seluruh caller (ModelRoutingService._resolveDocSynthesisEngine) ikut.
 */
export function resolveDocAnalysisEngine(model) {
  const clean = String(model || '').trim();
  const low = clean.toLowerCase();
  if (low.startsWith('llamacpp:') || low.startsWith('hermes') || low.startsWith('ollama:')) {
    const err = new Error(`ROUTING_VIOLATION: DOCUMENT_ANALYSIS synthesis FORBIDDEN ke model lokal "${clean}" (R15: engine dokumen = 9Router AG).`);
    err.code = 'ROUTING_VIOLATION';
    err.domain = 'DOCUMENT_ANALYSIS';
    err.engine = clean;
    throw err;
  }
  if (low.startsWith('gemini-')) {
    return { engine: 'NINEROUTER_AG', provider: 'gemini', model: clean };
  }
  return { engine: 'NINEROUTER_AG', provider: 'gemini', model: process.env.GEMINI_MODEL || 'gemini-3.6-flash' };
}

export default { ENGINES, DOMAINS, ROUTING_MATRIX, resolveEngine, assertEngineAllowed, assertQwenPayloadClean, isDocumentDomain, isImageDomain, resolveDocAnalysisEngine };
