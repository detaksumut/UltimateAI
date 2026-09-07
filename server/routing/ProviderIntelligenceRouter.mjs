/**
 * ProviderIntelligenceRouter.mjs
 * TAHAP 3B-2C: Formal Provider Intelligence Routing
 *
 * Two Forces Principle:
 *   OLLAMA  = INTERNAL / LOCAL INTELLIGENCE (device, files, docs, memory, coding)
 *   ANTIGRAVITY = EXTERNAL / INTERNET INTELLIGENCE (web, news, prices, research)
 *
 * Routing is based on WHERE DATA LIVES, not message complexity.
 *
 * Scope Types:
 *   LOCAL_ONLY       → Ollama only (no internet needed)
 *   EXTERNAL_REQUIRED → Antigravity first, Ollama fallback with restrictions
 *   HYBRID           → Ollama for local context + Antigravity for internet evidence
 *
 * Critical Rule:
 *   Ollama MUST NEVER fabricate live internet data when Antigravity is unavailable.
 *   Fallback restriction: NO_FRESH_EXTERNAL_CLAIMS
 */

export const SCOPE = {
  LOCAL_ONLY: 'LOCAL_ONLY',
  EXTERNAL_REQUIRED: 'EXTERNAL_REQUIRED',
  HYBRID: 'HYBRID'
};

export const PROVIDER = {
  OLLAMA: 'OLLAMA',
  ANTIGRAVITY: 'ANTIGRAVITY'
};

export const FALLBACK_RESTRICTION = {
  NONE: 'NONE',
  NO_FRESH_EXTERNAL_CLAIMS: 'NO_FRESH_EXTERNAL_CLAIMS'
};

// ── INTERNAL / LOCAL patterns ────────────────────────────────────────────────
const LOCAL_PATTERNS = [
  // Device inspection
  /kondisi\s+(komputer|pc|laptop|sistem|device)/i,
  /(cek|periksa|lihat|tampilkan|check)\s+.*\s*(ram|memory|cpu|disk|storage|spesifikasi|device|sistem)/i,
  /berapa\s+(ram|memory|cpu|disk|storage)/i,
  /(ram|cpu|disk)\s+(usage|saya|ku)/i,
  /system\s+info|device\s+info|info\s+device|cek\s+device/i,
  /proses\s+(berjalan|memakai|paling|terbanyak)/i,
  /apa\s+yang\s+membuat\s+(komputer|pc|laptop)\s+(berat|lambat|lemot)/i,
  /(komputer|pc|laptop)\s+(saya\s+)?(berat|lambat|lemot)/i,

  // Local files and documents
  /baca\s+(file|dokumen|pdf|dokumen\s+ini|file\s+ini)/i,
  /ringkas\s+(dokumen|file|pdf)/i,
  /analisis\s+(dokumen|file|pdf)/i,
  /ekstrak\s+(isi|data)\s+dari\s+(dokumen|file)/i,
  /file\s+(ini|tersebut)\s+(ada|berisi|isinya)/i,

  // Local coding and synthesis
  /buatkan?\s+(kode|code|script|program|function|class|module|component|app|website|form|button|modal)/i,
  /generate\s+code|create\s+(app|function|class|module)/i,
  /bangun\s+(aplikasi|website|sistem|tool)/i,
  /refactor|debug|fix\s+(kode|code|bug)/i,

  // Local data analysis
  /hitung|kalkulasi|statistik|olah\s+data|proses\s+data/i,
  /visualisasi|grafik|chart|matrix|tabel\s+data/i,

  // Memory and context
  /simpan\s+(ke|di)\s+(memory|vault|drive)/i,
  /ingat\s+(ini|hal\s+ini|fakta\s+ini)/i,

  // Runtime inspection
  /kondisi\s+(ultimate\s*ai|vite|local\s+router|backend|server)/i,
  /status\s+(server|service|provider)/i
];

// ── EXTERNAL / INTERNET patterns ─────────────────────────────────────────────
const EXTERNAL_PATTERNS = [
  // Explicit internet/search keywords
  /cari\s+(di\s+)?(internet|web|online)|search\s+(for|online)/i,
  /berita|news|kabar|informasi\s+(terbaru|terkini|terkini|latest|recent|current)/i,
  /what\s+is\s+the\s+(current|latest|recent|newest)/i,
  /what\s+(are|is)\+the\s+(current\s+)?(price|rate|value|cost)/i,

  // Price and market data
  /harga\s+(saham|komoditas|emas|minyak|kripto|crypto|bitcoin)/i,
  /stock\s+(price|market)|share\s+price/i,
  /market\s+(price|data|rate)|exchange\s+rate/i,
  /kurs\s+(dollar|usd|eur|rupiah|idr)/i,
  /komoditas|commodity|crude\s+oil|gold\s+price/i,

  // Weather and real-time
  /cuaca|weather|temperature|suhu\s+udara/i,
  /what\s+is\s+the\s+weather/i,
  /how\s+is\s+the\s+(weather|temperature)/i,

  // Live/real-time indicators
  /\b(real-time|realtime|live|currently|right\s+now|today|hari\s+ini|saat\s+ini)\b/i,
  /\b(latest|newest|recent|fresh|updated|up-to-date|upToDate)\b/i,

  // Company/business intelligence
  /profil\s+(perusahaan|usahaan|company)/i,
  /revenue|annual\s+report|quarterly/i,
  /regulasi\s+(terbaru|baru)|peraturan\s+(terbaru|baru)/i,

  // Research requiring internet
  /riset|research|telusuri|investigasi|deep\s+dive/i,
  /benchmark|perbandingan\s+komprehensif/i,
  /review\s+literatur|studi\s+kasus/i,

  // URL presence
  /https?:\/\/[^\s]+/i,

  // Validation of external info
  /validasi\s+(info|informasi|berita|data)/i,
  /verify\s+(this|it|info|information|claim)/i,
  /konfirmasi\s+(info|informasi|berita)/i
];

// ── HYBRID patterns (need both local + internet) ─────────────────────────────
const HYBRID_PATTERNS = [
  // Compare local data with external standards
  /bandingkan\s+(dengan|vs|dgn)\s+(internet|web|online|standar|pasar|harga\s+pasar)/i,
  /compare\s+(with|to)\s+(online|internet|market|standard)/i,

  // Analyze local file using external knowledge
  /analisis\s+(dokumen|file)\s+(dengan|menggunakan|berdasarkan)\s+(internet|web|data\s+eksternal)/i,

  // Document with external validation
  /cek\s+(dokumen|file)\s+(ini|tersebut)\s+(di|ke|dengan)\s+(internet|web)/i,

  // Report requiring both local data and external context
  /buat\s+laporan\s+(tentang|perihal)\s+(pasar|kompetitor|industri|tren)/i,
  /report\s+(on|about)\s+(market|industry|competitor|trend)/i,

  // Analysis that needs external benchmarking
  /benchmark\s+(file|kode|data|aplikasi)\s+(saya|ini)/i,
  /evaluasi\s+(kode|aplikasi|sistem)\s+(terhadap|vs|dengan)\s+(best\s+practice|standar\s+industri)/i
];

// ── Real-time data indicators (require fresh external data) ──────────────────
const REALTIME_INDICATORS = /\b(real-time|realtime|live|currently|right\s+now|hari\s+ini|saat\s+ini|latest|recent|fresh|updated|up-to-date|what\s+is\s+the\s+current|harga\s+sekarang|price\s+now)\b/i;

class ProviderIntelligenceRouter {
  constructor() {
    this.stats = {
      totalRoutes: 0,
      localOnly: 0,
      externalRequired: 0,
      hybrid: 0
    };
  }

  /**
   * Classify the intelligence scope of a user request.
   * @param {string} userGoal - Raw user input
   * @param {Object} context - Conversation context
   * @returns {Object} RoutingDecision
   */
  classifyScope(userGoal, context = {}) {
    const raw = (userGoal || '').trim();
    const lower = raw.toLowerCase();

    // Check each category
    const localMatches = LOCAL_PATTERNS.filter(p => p.test(raw));
    const externalMatches = EXTERNAL_PATTERNS.filter(p => p.test(raw));
    const hybridMatches = HYBRID_PATTERNS.filter(p => p.test(raw));
    const isRealtime = REALTIME_INDICATORS.test(raw);

    // Priority: HYBRID > EXTERNAL > LOCAL
    let scope, preferredProvider, fallbackProvider, fallbackRestriction, restrictions;

    if (hybridMatches.length > 0) {
      scope = SCOPE.HYBRID;
      preferredProvider = PROVIDER.OLLAMA;
      fallbackProvider = PROVIDER.ANTIGRAVITY;
      fallbackRestriction = FALLBACK_RESTRICTION.NONE;
      restrictions = [];
    } else if (externalMatches.length > 0 || isRealtime) {
      scope = SCOPE.EXTERNAL_REQUIRED;
      preferredProvider = PROVIDER.ANTIGRAVITY;
      fallbackProvider = PROVIDER.OLLAMA;
      fallbackRestriction = FALLBACK_RESTRICTION.NO_FRESH_EXTERNAL_CLAIMS;
      restrictions = ['NO_FRESH_EXTERNAL_CLAIMS'];
    } else {
      scope = SCOPE.LOCAL_ONLY;
      preferredProvider = PROVIDER.OLLAMA;
      fallbackProvider = null;
      fallbackRestriction = FALLBACK_RESTRICTION.NONE;
      restrictions = [];
    }

    // Update stats
    this.stats.totalRoutes++;
    if (scope === SCOPE.LOCAL_ONLY) this.stats.localOnly++;
    else if (scope === SCOPE.EXTERNAL_REQUIRED) this.stats.externalRequired++;
    else this.stats.hybrid++;

    return {
      scope,
      preferredProvider,
      fallbackProvider,
      fallbackRestriction,
      restrictions,
      requiresRealTimeData: isRealtime,
      confidence: this._calcConfidence(localMatches, externalMatches, hybridMatches),
      matchedPatterns: {
        local: localMatches.length,
        external: externalMatches.length,
        hybrid: hybridMatches.length
      }
    };
  }

  /**
   * Check if Ollama is allowed to answer a specific question based on restrictions.
   * @param {string} scope - Routing scope
   * @param {Array} restrictions - Active restrictions
   * @param {boolean} hasCachedEvidence - Whether cached evidence exists from prior Antigravity calls
   * @returns {Object} { allowed, reason }
   */
  checkOllamaFallbackPermission(scope, restrictions, hasCachedEvidence = false) {
    if (scope === SCOPE.LOCAL_ONLY) {
      return { allowed: true, reason: 'LOCAL_ONLY scope: Ollama is primary provider.' };
    }

    if (scope === SCOPE.HYBRID && !restrictions.includes(FALLBACK_RESTRICTION.NO_FRESH_EXTERNAL_CLAIMS)) {
      return { allowed: true, reason: 'HYBRID scope: Ollama handles local context portion.' };
    }

    if (scope === SCOPE.EXTERNAL_REQUIRED) {
      if (restrictions.includes(FALLBACK_RESTRICTION.NO_FRESH_EXTERNAL_CLAIMS)) {
        if (hasCachedEvidence) {
          return {
            allowed: true,
            reason: 'Antigravity unavailable. Ollama may analyze CACHED evidence only. NO new external claims.'
          };
        }
        return {
          allowed: false,
          reason: 'Antigravity unavailable and no cached evidence. Ollama CANNOT fabricate external data. Transparent limitation message required.'
        };
      }
    }

    return { allowed: true, reason: 'No restrictions blocking Ollama.' };
  }

  /**
   * Generate the transparent limitation message when Antigravity is unavailable.
   * @param {string} userGoal - Original user request
   * @returns {Object} Response payload
   */
  generateLimitationMessage(userGoal) {
    return {
      responseMessage: `Maaf, data eksternal terkini untuk "${userGoal}" tidak dapat diverifikasi saat ini karena koneksi ke sumber internet sedang tidak tersedia. Saya hanya dapat memberikan informasi berdasarkan data lokal yang tersedia di perangkat Anda.`,
      detailedDisplay: `## Keterbatasan Sistem\n\n**Permintaan:** ${userGoal}\n**Status:** Data eksternal tidak tersedia\n\n**Yang dapat saya lakukan:**\n- Analisis berdasarkan data lokal yang tersedia\n- Penjelasan berdasarkan pengetahuan umum (tanpa verifikasi real-time)\n\n**Yang tidak dapat saya lakukan saat ini:**\n- Memberikan data harga terkini\n- Memvalidasi informasi terbaru dari internet\n- Menyajikan berita atau peristiwa terkini\n\nSilakan coba lagi nanti ketika koneksi internet tersedia, atau ajukan pertanyaan yang tidak memerlukan data real-time.`,
      responseSource: 'TRANSPARENT_LIMITATION',
      claims: {},
      evidenceRefs: {},
      provenance: {
        semanticModel: 'none',
        planningEngine: 'none',
        executionTools: [],
        pool: 'none',
        transport: 'LOCAL_ONLY',
        limitationReason: 'ANTIGRAVITY_UNAVAILABLE'
      }
    };
  }

  _calcConfidence(local, external, hybrid) {
    const total = local.length + external.length + hybrid.length;
    if (total === 0) return 0.5;
    const max = Math.max(local.length, external.length, hybrid.length);
    return Math.min(0.99, 0.7 + (max / total) * 0.3);
  }

  getStats() {
    return { ...this.stats };
  }
}

export const providerIntelligenceRouterInstance = new ProviderIntelligenceRouter();
export default providerIntelligenceRouterInstance;
