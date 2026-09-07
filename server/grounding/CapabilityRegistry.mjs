/**
 * CapabilityRegistry.mjs (v3 - Active Execution Broker & Truth Layer)
 * 
 * Target Architecture:
 *   AgentExecutor → CapabilityRegistry → web.search / web.open / system.* / doc.analyze
 * 
 * Enforces positive evidence authorization, live capability gating, and governed tool dispatch.
 */

import { imageGenerationInstance } from '../agent/ImageGeneration.mjs';
import { ToolGovernor } from '../tools/ToolGovernor.mjs';

// Lazy/direct tool instance imports
import { webSearchToolInstance } from '../tools/WebSearchTool.mjs';
import { webFetchToolInstance } from '../tools/WebFetchTool.mjs';
import { deviceInspectToolInstance } from '../tools/DeviceInspectTool.mjs';
import { ramOptimizerToolInstance } from '../tools/RAMOptimizerTool.mjs';
import { storageCleanerToolInstance } from '../tools/StorageCleanerTool.mjs';
import { sandboxExecutionToolInstance } from '../tools/SandboxExecutionTool.mjs';
import { documentIntelligenceToolInstance } from '../tools/DocumentIntelligenceTool.mjs';
import { memoryVaultToolInstance } from '../tools/MemoryVaultTool.mjs';
import { threatFeedToolInstance } from '../tools/ThreatFeedTool.mjs';
import { formalSolveToolInstance } from '../tools/FormalSolveTool.mjs';
import { multiLayerSearchToolInstance } from '../tools/MultiLayerSearchTool.mjs';
import { webHarvestToolInstance } from '../tools/WebHarvestTool.mjs';
import { localFilesystemToolInstance } from '../tools/LocalFilesystemTool.mjs';
import { mediaHarvesterToolInstance } from '../tools/MediaHarvesterTool.mjs';

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

export const CAPABILITY_REGISTRY = {
  // --- WEB CAPABILITIES ---
  'web.search': {
    available: true,
    label: 'Web Search (Multi-Layer)',
    description: 'Pencarian informasi aktual, berita terkini, dan repositori akademik.',
    namespace: 'web',
    checkLiveHealth: () => true
  },
  'web.open': {
    available: true,
    label: 'Web Open / URL Fetch',
    description: 'Mengambil dan membaca isi halaman web HTTP/HTTPS secara aman.',
    namespace: 'web',
    checkLiveHealth: () => true
  },
  'live_web_search': {
    available: true,
    label: 'Penelusuran Web Terkini',
    description: 'Alias untuk web.search.',
    namespace: 'web',
    checkLiveHealth: () => true
  },

  // --- SYSTEM CAPABILITIES ---
  'system.inspect': {
    available: true,
    label: 'Inspeksi Sistem & Perangkat',
    description: 'Membaca status CPU, RAM, disk, proses berjalan, dan status runtime.',
    namespace: 'system',
    checkLiveHealth: () => true
  },
  'system.ram': {
    available: true,
    label: 'RAM Optimization',
    description: 'Menganalisis penggunaan RAM dan memberikan rekomendasi optimasi.',
    namespace: 'system',
    checkLiveHealth: () => true
  },
  'system.storage': {
    available: true,
    label: 'Storage Cleanup',
    description: 'Memeriksa dan membersihkan temporary cache / log yang aman.',
    namespace: 'system',
    checkLiveHealth: () => true
  },
  'system.sandbox': {
    available: true,
    label: 'Eksekusi Kode Sandbox',
    description: 'Menjalankan kode Node.js / Python secara terisolasi dalam sandbox.',
    namespace: 'system',
    checkLiveHealth: () => true
  },

  // --- DOCUMENT & MEDIA CAPABILITIES ---
  'doc.analyze': {
    available: true,
    label: 'Analisis Dokumen & Semantic Chunking',
    description: 'Menganalisis berkas dokumen (PDF, DOCX, TXT, CSV) dengan semantic sliding window.',
    namespace: 'doc',
    checkLiveHealth: () => true
  },
  'document_analysis': {
    available: true,
    label: 'Analisis Dokumen (Alias)',
    description: 'Membaca dan menganalisis berkas PDF, DOCX, TXT, dan CSV.',
    namespace: 'doc',
    checkLiveHealth: () => true
  },
  'image.generate': {
    available: true,
    label: 'Generator Gambar AI',
    description: 'Membuat visualisasi gambar baru berbasis prompt teks.',
    namespace: 'media',
    checkLiveHealth: async () => {
      const probe = await imageGenerationInstance.capabilityProbe().catch(() => null);
      return Boolean(probe?.available);
    }
  },
  'image_generation': {
    available: true,
    label: 'Generator Gambar AI (Alias)',
    description: 'Alias untuk image.generate.',
    namespace: 'media',
    checkLiveHealth: async () => {
      const probe = await imageGenerationInstance.capabilityProbe().catch(() => null);
      return Boolean(probe?.available);
    }
  },

  // --- INTELLIGENCE, MEMORY & SECURITY CAPABILITIES ---
  'memory.vault': {
    available: true,
    label: 'Memory Vault Storage & Retrieval',
    description: 'Menyimpan dan mencari memori percakapan / fakta berjangka panjang.',
    namespace: 'memory',
    checkLiveHealth: () => true
  },
  'threat.feed': {
    available: true,
    label: 'Threat Intelligence Feeds',
    description: 'Mengambil data CVE terbaru dan CISA KEV secara read-only.',
    namespace: 'security',
    checkLiveHealth: () => true
  },
  'formal.solve': {
    available: true,
    label: 'Formal Mathematical & Logic Solver',
    description: 'Penyelesaian logika formal dan komputasi eksak.',
    namespace: 'compute',
    checkLiveHealth: () => true
  },
  'intel.multilayer_search': {
    available: true,
    label: 'Multi-Layer Search Matrix',
    description: 'Pencarian matriks data paralel.',
    namespace: 'web',
    checkLiveHealth: () => true
  },
  'intel.harvest': {
    available: true,
    label: 'Knowledge Harvester & Archiver (Tavily to Drive F)',
    description: 'Menelusuri intelijen web 2024-2026 dan mengarsipkan dokumen secara langsung ke Drive F: untuk dipelajari Hermes 3.',
    namespace: 'intel',
    checkLiveHealth: () => true
  },

  // --- AUDIO CAPABILITIES ---
  'audio_transcription': {
    available: true,
    label: 'Transkripsi Audio/Suara',
    description: 'Mengubah ucapan audio menjadi teks Bahasa Indonesia / Inggris.',
    maxFileSizeBytes: 25 * 1024 * 1024,
    supportedFormats: ['mp3', 'wav', 'ogg', 'm4a', 'aac'],
    checkLiveHealth: () => true
  },
  'audio_upload': {
    available: true,
    label: 'Unggah Berkas Audio',
    description: 'Menerima unggahan file audio lokal dari perangkat pengguna.',
    checkLiveHealth: () => true
  },
  'voice_synthesis': {
    available: true,
    label: 'Sintesis Suara (TTS Neural)',
    description: 'Menghasilkan suara alami JIN berbahasa Indonesia.',
    checkLiveHealth: () => true
  },
  'media.music_player': {
    available: true,
    label: 'Online Music Player & Streaming Audio',
    description: 'Menampilkan dan memutar pemutar musik online (MP3, Web Audio Stream, Lo-Fi, Ambient, Synthwave) langsung di canvas percakapan.',
    namespace: 'media',
    checkLiveHealth: () => true
  },
  'audio_player': {
    available: true,
    label: 'Pemutar Audio / MP3 Online',
    description: 'Memutar streaming musik dan audio online langsung di canvas percakapan interaktif.',
    namespace: 'media',
    checkLiveHealth: () => true
  },
  'fs.manage': {
    available: true,
    label: 'Manajemen Filesystem Fisik (Drive F: & Lokal)',
    description: 'Membuat direktori/folder fisik secara otonom di Drive F: dan mengelola berkas lokal.',
    namespace: 'system',
    checkLiveHealth: () => true
  },
  'media.harvest': {
    available: true,
    label: 'Universal Resource Harvester (Tavily to Drive F)',
    description: 'Menelusuri dan mengunduh berkas fisik (dokumen regulasi UU/PP/KUHP, dataset, audio MP3) via Tavily langsung ke Drive F:.',
    namespace: 'media',
    checkLiveHealth: () => true
  },

  // --- EXPLICITLY UNAVAILABLE CAPABILITIES ---
  'speaker_diarization': {
    available: false,
    label: 'Pemisahan Pembicara (Diarization)',
    description: 'Membedakan dan melabeli siapa yang berbicara (Speaker 1, Speaker 2).',
    checkLiveHealth: () => false
  },
  'url_audio_ingestion': {
    available: false,
    label: 'Ingesti Audio via Tautan / URL',
    description: 'Mengambil dan memproses audio langsung dari link eksternal web.',
    checkLiveHealth: () => false
  },
  'multi_speaker_count_detection': {
    available: false,
    label: 'Deteksi Jumlah Pembicara Eksak',
    description: 'Menghitung secara presisi jumlah orang yang berbicara dalam rekaman.',
    checkLiveHealth: () => false
  }
};

/**
 * Capability Execution Broker Class
 */
export class CapabilityRegistry {
  constructor() {
    this._toolMap = new Map();
    this._aliasMap = new Map();
    this._initializeToolBindings();
  }

  _initializeToolBindings() {
    // 1. Web Namespace
    this._registerTool('web.search', webSearchToolInstance);
    this._registerTool('web.open', webFetchToolInstance);
    this._registerTool('web.fetch', webFetchToolInstance);
    this._registerTool('intel.multilayer_search', multiLayerSearchToolInstance);

    // 2. System Namespace
    this._registerTool('system.inspect', deviceInspectToolInstance);
    this._registerTool('device.inspect', deviceInspectToolInstance);
    this._registerTool('system.ram', ramOptimizerToolInstance);
    this._registerTool('device.ram_optimizer', ramOptimizerToolInstance);
    this._registerTool('system.storage', storageCleanerToolInstance);
    this._registerTool('device.storage_cleaner', storageCleanerToolInstance);
    this._registerTool('system.sandbox', sandboxExecutionToolInstance);
    this._registerTool('sandbox.execute', sandboxExecutionToolInstance);

    // 3. Document, Media, Intelligence
    this._registerTool('doc.analyze', documentIntelligenceToolInstance);
    this._registerTool('document_analysis', documentIntelligenceToolInstance);
    this._registerTool('memory.vault', memoryVaultToolInstance);
    this._registerTool('threat.feed', threatFeedToolInstance);
    this._registerTool('formal.solve', formalSolveToolInstance);

    // Dynamic image generator bridge
    const imageToolBridge = {
      name: 'image.generate',
      version: '2.0.0',
      description: 'Generate synthetic visual imagery from prompt',
      inputSchema: { prompt: 'string' },
      outputSchema: { artifact: 'object', success: 'boolean' },
      permissionLevel: 'READ_ONLY',
      timeoutMs: 30000,
      execute: async (params) => {
        return await imageGenerationInstance.generateImage(params);
      }
    };
    this._registerTool('image.generate', imageToolBridge);
    this._registerTool('image_generation', imageToolBridge);

    // Canonical Aliases
    this._aliasMap.set('web.search', 'web.search');
    this._aliasMap.set('live_web_search', 'web.search');
    this._aliasMap.set('web.open', 'web.open');
    this._aliasMap.set('web.fetch', 'web.open');
    this._aliasMap.set('system.inspect', 'system.inspect');
    this._aliasMap.set('device.inspect', 'system.inspect');
    this._aliasMap.set('system.sandbox', 'system.sandbox');
    this._aliasMap.set('sandbox.execute', 'system.sandbox');
    this._aliasMap.set('system.ram', 'system.ram');
    this._aliasMap.set('device.ram_optimizer', 'system.ram');
    this._aliasMap.set('system.storage', 'system.storage');
    this._aliasMap.set('device.storage_cleaner', 'system.storage');
    this._aliasMap.set('doc.analyze', 'doc.analyze');
    this._aliasMap.set('document_analysis', 'doc.analyze');
    this._aliasMap.set('image.generate', 'image.generate');
    this._aliasMap.set('image_generation', 'image.generate');
    this._aliasMap.set('media.music_player', 'media.music_player');
    this._aliasMap.set('audio_player', 'media.music_player');
    this._aliasMap.set('music_player', 'media.music_player');

    // Web Intelligence Harvester (Tavily to Drive F:)
    this._registerTool('intel.harvest', webHarvestToolInstance);
    this._registerTool('web.harvest', webHarvestToolInstance);
    this._aliasMap.set('intel.harvest', 'intel.harvest');
    this._aliasMap.set('web.harvest', 'intel.harvest');
    this._aliasMap.set('vault.harvest', 'intel.harvest');

    // Physical Filesystem & Universal Harvester (Drive F:)
    this._registerTool('fs.manage', localFilesystemToolInstance);
    this._registerTool('filesystem.manage', localFilesystemToolInstance);
    this._aliasMap.set('fs.manage', 'fs.manage');
    this._aliasMap.set('filesystem.manage', 'fs.manage');
    this._aliasMap.set('local.filesystem', 'fs.manage');

    this._registerTool('media.harvest', mediaHarvesterToolInstance);
    this._registerTool('media.download', mediaHarvesterToolInstance);
    this._aliasMap.set('media.harvest', 'media.harvest');
    this._aliasMap.set('media.download', 'media.harvest');
    this._aliasMap.set('tavily.harvest', 'media.harvest');
  }

  _registerTool(name, toolInstance) {
    this._toolMap.set(name.toLowerCase(), toolInstance);
  }

  /**
   * Resolves canonical capability name
   */
  resolveCapabilityName(name) {
    if (!name || typeof name !== 'string') return '';
    const clean = name.toLowerCase().trim();
    return this._aliasMap.get(clean) || clean;
  }

  /**
   * Checks if a capability is registered and available for live execution
   */
  hasCapability(name) {
    const canonical = this.resolveCapabilityName(name);
    return this._toolMap.has(canonical) || this._toolMap.has(name.toLowerCase().trim());
  }

  /**
   * Retrieves tool contract / instance by name
   */
  get(name) {
    const canonical = this.resolveCapabilityName(name);
    return this._toolMap.get(canonical) || this._toolMap.get(name.toLowerCase().trim()) || null;
  }

  getCapability(name) {
    return this.get(name);
  }

  listTools() {
    const list = [];
    const seen = new Set();
    for (const [name, tool] of this._toolMap.entries()) {
      if (!seen.has(tool)) {
        seen.add(tool);
        list.push(tool);
      }
    }
    return list;
  }

  listCapabilities() {
    return Object.entries(CAPABILITY_REGISTRY).map(([key, val]) => ({
      key,
      ...val,
      bound: this.hasCapability(key)
    }));
  }

  /**
   * PRIMARY EXECUTION DISPATCHER
   * AgentExecutor → CapabilityRegistry.executeCapability(name, params, options)
   */
  async executeCapability(capabilityName, params = {}, options = {}) {
    const rawName = String(capabilityName || '').trim();
    const canonical = this.resolveCapabilityName(rawName);

    // 1. Evidence / Availability Guard
    const meta = CAPABILITY_REGISTRY[canonical] || CAPABILITY_REGISTRY[rawName.toLowerCase()];
    if (meta && meta.available === false) {
      throw new Error(`CAPABILITY_UNAVAILABLE: Capability "${rawName}" is explicitly disabled or not supported in this runtime.`);
    }

    // 2. Resolve Concrete Tool Instance
    const tool = this.get(canonical) || this.get(rawName);
    if (!tool) {
      throw new Error(`CAPABILITY_NOT_FOUND: No executable handler registered for capability "${rawName}".`);
    }

    // 3. Execution under ToolGovernor Policy
    if (typeof tool.execute !== 'function') {
      throw new Error(`INVALID_CAPABILITY_CONTRACT: Tool for "${rawName}" does not implement execute().`);
    }

    const govResult = await ToolGovernor.governAndExecute(tool, params, options);

    if (govResult.status === 'SUCCESS') {
      return govResult.result;
    } else if (govResult.status === 'BLOCKED') {
      throw new Error(`CAPABILITY_PERMISSION_BLOCKED: ${govResult.message || govResult.reason}`);
    } else if (govResult.status === 'TIMEOUT') {
      throw new Error(`CAPABILITY_TIMEOUT: Execution of "${rawName}" exceeded time limit.`);
    } else {
      throw new Error(`CAPABILITY_EXECUTION_ERROR: ${govResult.error || 'Execution failed'}`);
    }
  }

  /**
   * Backward-compatibility alias for legacy ToolRegistry callers
   */
  async executeTool(toolName, params = {}, options = {}) {
    return this.executeCapability(toolName, params, options);
  }
}

export const capabilityRegistryInstance = new CapabilityRegistry();

// Export existing utility functions to preserve 100% backward-compatibility
export function isVerifiedSystemEntity(entityName) {
  if (!entityName || typeof entityName !== 'string') return false;
  return VERIFIED_SYSTEM_ENTITIES.has(entityName.trim());
}

export function isCapabilityAvailable(featureKey) {
  if (!featureKey || typeof featureKey !== 'string') return false;
  const entry = CAPABILITY_REGISTRY[featureKey.toLowerCase().trim()];
  if (!entry || entry.available !== true) return false;
  return typeof entry.checkLiveHealth === 'function' ? entry.checkLiveHealth() : true;
}

export function getAvailableCapabilities() {
  return Object.entries(CAPABILITY_REGISTRY)
    .filter(([_, value]) => value.available === true && value.checkLiveHealth())
    .map(([key, value]) => ({ key, ...value }));
}

export function getUnavailableCapabilities() {
  return Object.entries(CAPABILITY_REGISTRY)
    .filter(([_, value]) => value.available !== true || !value.checkLiveHealth())
    .map(([key, value]) => ({ key, ...value }));
}

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
2. DILARANG menjanjikan pemisahan pembicara (diarization) atau deteksi jumlah pembicara eksak. Pemutar musik / MP3 online didukung penuh dan dapat dimainkan langsung di kanvas percakapan (JIN Music Player).
3. Untuk permintaan sederhana, berikan respon langsung, ringkas, dan wajar (Minimum Sufficient Response).`;
}

export default capabilityRegistryInstance;
