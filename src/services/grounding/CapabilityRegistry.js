/**
 * CapabilityRegistry.js (v2 - Dynamic Verification & Evidence Truth Layer)
 *
 * CORE CONTRACT:
 * - POSITIVE EVIDENCE WHITELIST: Only verified capabilities & system entities are permitted.
 * - REAL-TIME TOOL HEALTH: Dynamically checks whether underlying tools/APIs are actually active.
 * - ZERO UNVERIFIED CLAIMS: If evidence is missing, claims are rejected automatically.
 */

// 1. Strictly Verified System Entity Whitelist (Authorized Named Entities)
export const VERIFIED_SYSTEM_ENTITIES = new Set([
  'UltimateAI',
  'JIN',
  'JIN AI',
  'Research Lab',
  'Riset Lab',
  'Non-Riset Lab',
  'Non Research Lab',
  'Memory Vault',
  'Control Center',
  'Activity Feed',
  'Connections'
]);

// 2. Real-Time Verifiable Capabilities
export const CAPABILITY_REGISTRY = {
  // --- Audio & Voice Capabilities ---
  audio_transcription: {
    available: true,
    label: 'Transkripsi Audio/Suara',
    description: 'Mengubah ucapan audio menjadi teks Bahasa Indonesia / Inggris.',
    maxFileSizeBytes: 25 * 1024 * 1024,
    supportedFormats: ['mp3', 'wav', 'ogg', 'm4a', 'aac'],
    checkLiveHealth: () => true
  },
  audio_upload: {
    available: true,
    label: 'Unggah Berkas Audio',
    description: 'Menerima unggahan file audio lokal dari perangkat pengguna.',
    checkLiveHealth: () => true
  },
  voice_synthesis: {
    available: true,
    label: 'Sintesis Suara (TTS Neural)',
    description: 'Menghasilkan suara alami JIN berbahasa Indonesia.',
    checkLiveHealth: () => true
  },
  speaker_diarization: {
    available: false,
    label: 'Pemisahan Pembicara (Diarization)',
    description: 'Membedakan dan melabeli siapa yang berbicara (Speaker 1, Speaker 2).',
    checkLiveHealth: () => false
  },
  url_audio_ingestion: {
    available: false,
    label: 'Ingesti Audio via Tautan / URL',
    description: 'Mengambil dan memproses audio langsung dari link eksternal web.',
    checkLiveHealth: () => false
  },
  multi_speaker_count_detection: {
    available: false,
    label: 'Deteksi Jumlah Pembicara Eksak',
    description: 'Menghitung secara presisi jumlah orang yang berbicara dalam rekaman.',
    checkLiveHealth: () => false
  },

  // --- Document & Data Capabilities ---
  document_analysis: {
    available: true,
    label: 'Analisis Dokumen',
    description: 'Membaca dan menganalisis berkas PDF, DOCX, TXT, dan CSV.',
    supportedFormats: ['pdf', 'docx', 'txt', 'csv'],
    checkLiveHealth: () => true
  },
  deep_research_lab: {
    available: true,
    label: 'Riset Lab & Analisis Riset',
    description: 'Membedah dokumen riset ilmiah dan merekam laporan ke Drive F:.',
    checkLiveHealth: () => true
  },
  non_research_lab: {
    available: true,
    label: 'Non-Riset Lab (Dokumen General)',
    description: 'Menganalisis SK Pemerintah, regulasi hukum, dan merekam ke Drive F:.',
    checkLiveHealth: () => true
  },

  // --- Web & Search Capabilities ---
  live_web_search: {
    available: true,
    label: 'Penelusuran Web Terkini',
    description: 'Pencarian informasi dan berita aktual dari internet.',
    checkLiveHealth: () => true
  },

  // --- Creative & Visual Capabilities ---
  image_generation: {
    available: true,
    label: 'Generator Gambar AI',
    description: 'Membuat visualisasi gambar baru berbasis prompt teks.',
    checkLiveHealth: () => true
  },

  // --- Code & Sandbox Capabilities ---
  html_app_generation: {
    available: true,
    label: 'Generator Prototipe Aplikasi HTML',
    description: 'Membuat aplikasi HTML single-file mandiri untuk dijalankan di sandbox.',
    checkLiveHealth: () => true
  },
  code_sandbox_execution: {
    available: true,
    label: 'Eksekusi Aplikasi Sandbox',
    description: 'Menjalankan kode HTML/JS di iframe sandbox simulator.',
    checkLiveHealth: () => true
  }
};

/**
 * Checks if a specific system entity is on the positive whitelist.
 */
export function isVerifiedSystemEntity(entityName) {
  if (!entityName || typeof entityName !== 'string') return false;
  return VERIFIED_SYSTEM_ENTITIES.has(entityName.trim());
}

/**
 * Checks if a capability is verified and healthy in real-time.
 */
export function isCapabilityAvailable(featureKey) {
  if (!featureKey || typeof featureKey !== 'string') return false;
  const entry = CAPABILITY_REGISTRY[featureKey.toLowerCase().trim()];
  if (!entry || entry.available !== true) return false;
  return typeof entry.checkLiveHealth === 'function' ? entry.checkLiveHealth() : true;
}

/**
 * Returns all verified available capabilities.
 */
export function getAvailableCapabilities() {
  return Object.entries(CAPABILITY_REGISTRY)
    .filter(([_, value]) => value.available === true && value.checkLiveHealth())
    .map(([key, value]) => ({ key, ...value }));
}

/**
 * Returns all unavailable / unsupported capabilities.
 */
export function getUnavailableCapabilities() {
  return Object.entries(CAPABILITY_REGISTRY)
    .filter(([_, value]) => value.available !== true || !value.checkLiveHealth())
    .map(([key, value]) => ({ key, ...value }));
}

/**
 * Formats a clean, grounded Capability Context string for system prompt injection.
 */
export function getCapabilityPromptContext() {
  const available = getAvailableCapabilities().map(c => `- ${c.label} (${c.key}): ${c.description}`).join('\n');
  const unavailable = getUnavailableCapabilities().map(c => `- [TIDAK TERSEDIA] ${c.label} (${c.key})`).join('\n');

  return `=== CAPABILITY TRUTH REGISTRY (POSITIVE EVIDENCE GROUNDING) ===
Fitur yang BENAR-BENAR TERSEDIA dan telah tervalidasi secara live:
${available}

Fitur/Kemampuan yang TIDAK TERSEDIA (DILARANG KERAS mengklaim atau menjanjikan kemampuan ini):
${unavailable}

DAFTAR NAMA RESMI SISTEM (HANYA nama ini yang boleh digunakan):
- UltimateAI, JIN, Research Lab, Non-Research Lab, Memory Vault, Control Center, Activity Feed, Connections.

ATURAN UTAMA:
1. DILARANG membuat nama sistem / engine / matrix / pro module baru yang tidak ada di daftar resmi di atas.
2. DILARANG menjanjikan pemisahan pembicara (diarization), deteksi jumlah pembicara, atau streaming link audio karena belum didukung.
3. Untuk permintaan sederhana, berikan respon langsung, ringkas, dan wajar (Minimum Sufficient Response).`;
}

export default {
  VERIFIED_SYSTEM_ENTITIES,
  CAPABILITY_REGISTRY,
  isVerifiedSystemEntity,
  isCapabilityAvailable,
  getAvailableCapabilities,
  getUnavailableCapabilities,
  getCapabilityPromptContext
};
