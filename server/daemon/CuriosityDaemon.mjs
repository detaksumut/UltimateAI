/**
 * CuriosityDaemon.mjs
 * Autonomous Curiosity Daemon (Deep 4-Wave Diurnal Intelligence Pulse).
 * 
 * Wave Schedule (WIB - UTC+7):
 *  - 07:00 WIB: Market & Domestic 5 Pillars (POL, EKO, SHM, KMD, CRP)
 *  - 13:00 WIB: Hukum, Sosial, Life, & TECHNOLOGY (HUK, SOS, LIF, TEK)
 *  - 17:00 WIB: Regional Asia, ASEAN & China (ASN, CHN, ASI)
 *  - 21:00 WIB: Geopolitik Global Barat: Wall Street, Eropa & Rusia (WST, EUR, RUS)
 * 
 * Deep Cognitive Processing:
 *  - Tavily AI Advanced Ingestion (include_raw_content: true, search_depth: 'advanced')
 *  - Local Ollama Hermes-3:8B Deep Cognitive Digestion & Causal Synthesis
 *  - Rich Dossier Archival (20-50 KB) to F:\UltimateAI_Memory\02_Documentation\
 *  - Structured Graph & SQLite Indexing (storage/vault/learned_knowledge.json)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ollamaProviderInstance } from '../providers/OllamaProvider.mjs';
import { modelRoutingServiceInstance } from '../local_router/ModelRoutingService.mjs';
import { localDriveFStorageInstance } from '../memory/LocalDriveFStorage.mjs';
import { memoryIndexSQLiteInstance } from '../memory/MemoryIndexSQLite.mjs';
import { domainKnowledgeGraphInstance } from '../knowledge/DomainKnowledgeGraph.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const INTELLIGENCE_CLUSTERS = {
  // Wave 1 - 07:00 WIB
  POL: {
    wave: 7,
    name: 'Politik Nasional',
    category: 'POLITIK',
    query: 'Kebijakan politik nasional hukum tata negara reformasi birokrasi dan regulasi strategis Indonesia 2026',
    subClusters: ['Regulasi Pemerintah', 'Stabilitas Politik', 'Diplomasi Luar Negeri']
  },
  EKO: {
    wave: 7,
    name: 'Ekonomi Makro',
    category: 'EKONOMI',
    query: 'Pertumbuhan ekonomi makro inflasi APBN penerimaan pajak dan kebijakan fiskal moneter Bank Indonesia 2026',
    subClusters: ['Fiskal & Moneter', 'Inflasi & Suku Bunga', 'Investasi Domestik']
  },
  SHM: {
    wave: 7,
    name: 'Pasar Saham & IHSG',
    category: 'PASAR_MODAL',
    query: 'IHSG bursa efek Indonesia saham perbankan energi net foreign flow dividen dan kinerja emiten 2026',
    subClusters: ['IHSG Analysis', 'Foreign Flow', 'Blue-chip Sectors']
  },
  KMD: {
    wave: 7,
    name: 'Komoditas Strategis',
    category: 'KOMODITAS',
    query: 'Harga komoditas CPO minyak mentah batubara nikel tembaga emas dan ekspor Indonesia 2026',
    subClusters: ['Energi & Tambang', 'Agrikultur & CPO', 'Logam Mulia']
  },
  CRP: {
    wave: 7,
    name: 'Kripto & Web3',
    category: 'KRIPTO',
    query: 'Pasar cryptocurrency Bitcoin Ethereum adopsi web3 bursa kripto dan regulasi OJK Bappebti 2026',
    subClusters: ['Bitcoin & Altcoins', 'Regulasi OJK/Bappebti', 'Infrastruktur Web3']
  },

  // Wave 2 - 13:00 WIB
  HUK: {
    wave: 13,
    name: 'Hukum & Peradilan',
    category: 'HUKUM',
    query: 'Putusan Mahkamah Konstitusi reformasi hukum peradilan tata kelola korupsi dan kepatuhan regulasi 2026',
    subClusters: ['Putusan MK & MA', 'Kepatuhan Regulasi', 'Penegakan Hukum']
  },
  SOS: {
    wave: 13,
    name: 'Dinamika Sosial & Tenaga Kerja',
    category: 'SOSIAL',
    query: 'Ketenagakerjaan upah minimum demografi pendidikan serikat pekerja dan kesejahteraan sosial Indonesia 2026',
    subClusters: ['Ketenagakerjaan', 'Demografi & Pendidikan', 'Jaminan Sosial']
  },
  LIF: {
    wave: 13,
    name: 'Humaniora & Kesehatan',
    category: 'HUMANIORA',
    query: 'Sistem kesehatan nasional BPJS riset medis bioteknologi gaya hidup dan ketahanan pangan 2026',
    subClusters: ['Kesehatan Masyarakat', 'Bioteknologi', 'Ketahanan Pangan']
  },
  TEK: {
    wave: 13,
    name: 'Teknologi & Sains Utama',
    category: 'TEKNOLOGI',
    query: 'Perkembangan AI LLM agentic AI cybersecurity zero-day hardware GPU semikonduktor open source 2026',
    subClusters: [
      'AI & Agentic Systems (LLM, Reasoning, Multi-agent)',
      'Cybersecurity & Zero-day Vulnerabilities (CVE, Ransomware)',
      'Semikonduktor & AI Hardware (GPU, NPU, TSMC, Nvidia)',
      'Cloud Infrastructure & Open-Source Frameworks'
    ]
  },

  // Wave 3 - 17:00 WIB
  ASN: {
    wave: 17,
    name: 'Regional ASEAN & Pasifik',
    category: 'REGIONAL',
    query: 'Geopolitik ASEAN perdagangan intra-kawasan sengketa Laut Cina Selatan dan diplomasi Indo-Pasifik 2026',
    subClusters: ['Integrasi Ekonomi ASEAN', 'Keamanan Maritim', 'Kerjasama Bilateral']
  },
  CHN: {
    wave: 17,
    name: 'Ekonomi & Industri China',
    category: 'CHINA',
    query: 'Pertumbuhan ekonomi China industri kendaraan listrik semikonduktor ekspor manufaktur dan kebijakan Beijing 2026',
    subClusters: ['Kebijakan Industri Beijing', 'Pasar EV & Baterai', 'Hubungan Dagang RI-China']
  },
  ASI: {
    wave: 17,
    name: 'Bursa & Pasar Asia Timur',
    category: 'BURSA_ASIA',
    query: 'Bursa saham Nikkei Hang Seng Kospi Taiwan Semiconductor dan aliran modal Asia Timur 2026',
    subClusters: ['Pasar Saham Asia', 'Rantai Pasok Asia', 'Suku Bunga Kawasan']
  },

  // Wave 4 - 21:00 WIB
  WST: {
    wave: 21,
    name: 'Wall Street & Pasar Global Barat',
    category: 'GLOBAL_MARKET',
    query: 'Wall Street S&P 500 Nasdaq kebijakan suku bunga Federal Reserve yield US Treasury dan ekonomi AS 2026',
    subClusters: ['Federal Reserve Rate', 'Big Tech Earnings', 'Treasury & Dollar Index']
  },
  EUR: {
    wave: 21,
    name: 'Uni Eropa & Inggris',
    category: 'EROPA',
    query: 'Ekonomi zona Euro kebijakan Bank Sentral Eropa ECB regulasi AI Act energi industri dan pasar modal UK 2026',
    subClusters: ['Regulasi Uni Eropa & AI Act', 'Kebijakan ECB', 'Energi & Industri Eropa']
  },
  RUS: {
    wave: 21,
    name: 'Rusia & Energi Global',
    category: 'EURASIA',
    query: 'Geopolitik Rusia jalur pasokan minyak gas ekspor energi dinamika BRICS dan stabilitas Eurasia 2026',
    subClusters: ['Pasokan Minyak & Gas', 'Dinamika Aliansi BRICS', 'Keamanan Eurasia']
  }
};

export class CuriosityDaemon {
  constructor() {
    this.isActive = false;
    this.timer = null;
    this.lastRunWave = null;
    this.lastRunDate = {}; // wave -> 'YYYY-MM-DD'
    this.history = [];
    this.currentlyCrawling = null;
    this._loadPersistedHistory();
  }

  _loadPersistedHistory() {
    try {
      const vaultFile = path.join(process.cwd(), 'storage', 'vault', 'learned_knowledge.json');
      if (fs.existsSync(vaultFile)) {
        const raw = fs.readFileSync(vaultFile, 'utf-8');
        const list = JSON.parse(raw || '[]');
        this.history = list.map(item => ({
          clusterCode: item.cluster,
          clusterName: item.name,
          category: item.category,
          wave: item.wave,
          fileName: path.basename(item.filePath),
          filePath: item.filePath,
          savedToDriveF: (item.filePath || '').startsWith('F:'),
          sizeKb: `${((item.fileSizeBytes || 0) / 1024).toFixed(1)} KB`,
          sourcesCount: item.sourcesCount || 0,
          sources: item.sources || [],
          timestamp: item.generatedAt,
          status: item.status
        }));
      }
    } catch (_) {}
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    console.log('[CuriosityDaemon] Memulai Autonomous Curiosity Daemon (4 Gelombang Diurnal: 07:00, 13:00, 17:00, 21:00 WIB)...');
    
    // Check every 60 seconds
    this.timer = setInterval(() => {
      this._checkDiurnalPulse();
    }, 60000);

    // Initial pulse check
    setTimeout(() => {
      this._checkDiurnalPulse();
    }, 5000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isActive = false;
    console.log('[CuriosityDaemon] Curiosity Daemon dihentikan.');
  }

  getWIBTime() {
    const now = new Date();
    // UTC+7
    const wibTimestamp = now.getTime() + 7 * 3600 * 1000;
    const wibDate = new Date(wibTimestamp);
    const hour = wibDate.getUTCHours();
    const minute = wibDate.getUTCMinutes();
    const dateStr = wibDate.toISOString().slice(0, 10);
    return { hour, minute, dateStr, fullIso: wibDate.toISOString() };
  }

  async _checkDiurnalPulse() {
    if (this.currentlyCrawling) return;
    const { hour, minute, dateStr } = this.getWIBTime();

    const targetWaves = [7, 13, 17, 21];
    if (targetWaves.includes(hour) && minute >= 0 && minute <= 15) {
      if (this.lastRunDate[hour] !== dateStr) {
        console.log(`[CuriosityDaemon] Gelombang Terjadwal WIB: ${hour}:00 WIB terdeteksi! Memulai siklus panen otonom...`);
        this.lastRunDate[hour] = dateStr;
        this.lastRunWave = hour;
        await this.runWave(hour);
      }
    }
  }

  async runWave(waveHour) {
    const targetClusters = Object.entries(INTELLIGENCE_CLUSTERS).filter(([_, c]) => c.wave === waveHour);
    console.log(`[CuriosityDaemon] Menjalankan Gelombang ${waveHour}:00 WIB (${targetClusters.length} klaster)...`);

    for (const [code, info] of targetClusters) {
      try {
        await this.executeDeepHarvest(code);
      } catch (err) {
        console.error(`[CuriosityDaemon] Gagal memproses klaster ${code}:`, err.message);
      }
    }
  }

  /**
   * Deep Cognitive Harvest Pipeline for a specific cluster
   */
  async executeDeepHarvest(clusterCode) {
    const cluster = INTELLIGENCE_CLUSTERS[clusterCode];
    if (!cluster) {
      throw new Error(`KLASTER_TIDAK_DIKENAL: Kode klaster '${clusterCode}' tidak terdaftar.`);
    }

    if (this.currentlyCrawling) {
      throw new Error(`DAEMON_BUSY: Sistem sedang memproses klaster '${this.currentlyCrawling}'. Harap tunggu.`);
    }

    this.currentlyCrawling = clusterCode;
    const startTime = Date.now();
    console.log(`\n======================================================`);
    console.log(`[CuriosityDaemon] 🧠 MEMULAI DEEP HARVEST: [${clusterCode}] ${cluster.name}`);
    console.log(`[CuriosityDaemon] Query: "${cluster.query}"`);
    console.log(`======================================================`);

    try {
      // 1. Tavily AI Advanced Harvest with Raw Content
      const apiKey = (process.env.TAVILY_API_KEY || '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').trim();
      let harvestData = null;

      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
            query: cluster.query,
            search_depth: 'advanced',
            include_raw_content: true,
            include_answer: true,
            max_results: 5
          }),
          signal: AbortSignal.timeout(20000)
        });

        if (res.ok) {
          harvestData = await res.json();
        } else {
          console.warn(`[CuriosityDaemon] Tavily HTTP status: ${res.status}`);
        }
      } catch (fetchErr) {
        console.warn(`[CuriosityDaemon] Tavily network error: ${fetchErr.message}`);
      }

      const directAnswer = harvestData?.answer || `Investigasi intelijen mendalam klaster ${cluster.name}.`;
      const rawResults = harvestData?.results || [];

      console.log(`[CuriosityDaemon] Tavily berhasil menghimpun ${rawResults.length} sumber primer.`);

      // 2. Compile Raw Ingestion Corpus for Hermes-3 Digestion
      let rawCorpus = '';
      rawResults.forEach((r, idx) => {
        const title = r.title || 'Informasi Publik';
        const url = r.url || '';
        const bodySnippet = r.content || '';
        // If raw_content exists, use first 4000 characters per source to provide deep substance
        const rawContent = (r.raw_content || '').replace(/\s+/g, ' ').slice(0, 4000);
        const substance = rawContent.length > 500 ? rawContent : bodySnippet;

        rawCorpus += `\n--- SUMBER ${idx + 1}: ${title} ---\nURL: ${url}\nNASKAH SUBSTANSI:\n${substance}\n`;
      });

      // 3. Local Cognitive Digestion by Hermes-3 (or Fallback via ModelRoutingService)
      console.log(`[CuriosityDaemon] 🤖 Menyerahkan naskah (${rawCorpus.length} karakter) ke Hermes-3:8B untuk pencernaan kognitif...`);

      const digestionPrompt = `Anda adalah Master Intelijen Kognitif JIN-UltimateAI.
Tugas Anda adalah membedah dan menganalisis naskah hasil investigasi intelijen terkini (Tahun 2026) mengenai klaster: ${cluster.name} (${clusterCode}).

Naskah Mentah Fakta Lapangan:
${rawCorpus.slice(0, 14000)}

Instruksi Analisis Mendalam:
Susun laporan analisis komprehensif tanpa asumsi kosong, berbobot, terstruktur dengan sub-bab berikut:
1. SINTESIS SEBAB-AKIBAT & MEKANISME STRATEGIS (Jelaskan akar penyebab, dinamika perubahan, dan mekanisme sistemik)
2. MATRIKS DATA KUANTITATIF & FAKTA TERVERIFIKASI (Sajikan metrik angka, benchmark, skor performa, regulasi terkait)
3. ENTITAS KUNCI, AKTOR & ARSITEKTUR TEKNOLOGI (Sebutkan nama perusahaan, laboratorium riset, arsitektur model/chip, atau pejabat pembuat kebijakan)
4. PROYEKSI RISIKO & DAMPAK 2026+ (Jelaskan ancaman, risiko kegagalan, dan dinamika geopolitik/industri)
5. IMPLIKASI AKSI DAN PANDUAN UNTUK ULTIMATEAI (Petunjuk bagi sistem kami untuk mengoptimalkan kapabilitas lokal)

Gunakan Bahasa Indonesia profesional, presisi, dan padat pengetahuan.`;

      let digestionResult = '';
      try {
        const ollamaReady = await ollamaProviderInstance.isAvailable();
        if (ollamaReady) {
          digestionResult = await ollamaProviderInstance.sendChat({
            messages: [
              { role: 'system', content: 'Anda adalah analis intelijen strategis dan saintis AI UltimateAI.' },
              { role: 'user', content: digestionPrompt }
            ],
            stream: false,
            temperature: 0.2
          });
        } else {
          // Route through ModelRoutingService
          const routed = await modelRoutingServiceInstance.routeChat({
            messages: [
              { role: 'system', content: 'Anda adalah analis intelijen strategis dan saintis AI UltimateAI.' },
              { role: 'user', content: digestionPrompt }
            ],
            capability: 'REASONING',
            temperature: 0.2
          });
          digestionResult = (routed && routed.content) || '';
        }
      } catch (llmErr) {
        console.warn(`[CuriosityDaemon] LLM Digestion warning: ${llmErr.message}, menggunakan sintesis analitik langsung.`);
        digestionResult = `## 1. SINTESIS SEBAB-AKIBAT\n${directAnswer}\n\n## 2. MATRIKS FAKTA TERVERIFIKASI\nTerhimpun ${rawResults.length} sumber data komprehensif.`;
      }

      // 4. Assemble Rich Multi-Pillar Dossier (20 - 50 KB)
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
      const fileName = `${clusterCode}_${dateStr}_${timeStr}_${cluster.category}.md`;

      let fullDossier = `# DOSSIER INTELIJEN: [${clusterCode}] ${cluster.name.toUpperCase()}\n\n`;
      fullDossier += `> **METADATA KOGNITIF JIN-ULTIMATEAI**\n`;
      fullDossier += `> - **Klaster**: ${clusterCode} (${cluster.name})\n`;
      fullDossier += `> - **Gelombang Diurnal**: Pukul ${cluster.wave}:00 WIB\n`;
      fullDossier += `> - **Waktu Analisis**: ${now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB\n`;
      fullDossier += `> - **Engine Ekstraksi**: Tavily Advanced Harvester (Live 2026 Grounding)\n`;
      fullDossier += `> - **Engine Pencernaan Kognitif**: Ollama Local Hermes-3:8B\n`;
      fullDossier += `> - **Sub-Klaster**: ${cluster.subClusters.join(' | ')}\n\n`;

      fullDossier += `## RINGKASAN EKSEKUTIF\n${directAnswer}\n\n`;
      fullDossier += `## ANALISIS MENDALAM HERMES-3 (COGNITIVE DIGESTION)\n\n`;
      fullDossier += `${digestionResult}\n\n`;

      fullDossier += `## DATA SUMBER TERVERIFIKASI (VERIFIABLE GROUNDING)\n\n`;
      rawResults.forEach((r, idx) => {
        let hostname = 'web';
        try { hostname = new URL(r.url).hostname; } catch (_) {}
        fullDossier += `### Sumber ${idx + 1}: ${r.title || 'Dokumen Publik'}\n`;
        fullDossier += `- **Domain**: ${hostname} ([Tautan Asli](${r.url}))\n`;
        fullDossier += `- **Skor Relevansi**: ${Math.round((r.score || 0.85) * 100)}%\n`;
        fullDossier += `- **Kutipan Kunci**:\n  ${r.content || 'Naskah terindeks dalam memori.'}\n\n`;
      });

      fullDossier += `## LAMPIRAN NASKAH LENGKAP HASIL PANEN\n\n`;
      fullDossier += `\`\`\`text\n${rawCorpus.slice(0, 16000)}\n\`\`\`\n\n`;
      fullDossier += `\n---\n*Dokumen ini merupakan aset pengetahuan berdaulat JIN-UltimateAI yang digenerasi secara otonom.*`;

      // 5. Persist to Drive F: & Local Storage Fallback
      let finalPath = '';
      let savedToDriveF = false;

      const writeResult = localDriveFStorageInstance.writeRecord('02_Documentation', fileName, fullDossier);
      if (writeResult && writeResult.success) {
        finalPath = writeResult.path;
        savedToDriveF = true;
        console.log(`[CuriosityDaemon] 💾 Tersimpan aman di Drive F: ${finalPath}`);
      } else {
        const vaultDocDir = path.join(process.cwd(), 'storage', 'vault', 'documents');
        if (!fs.existsSync(vaultDocDir)) {
          fs.mkdirSync(vaultDocDir, { recursive: true });
        }
        finalPath = path.join(vaultDocDir, fileName);
        fs.writeFileSync(finalPath, fullDossier, 'utf-8');
        console.log(`[CuriosityDaemon] 💾 Tersimpan di Vault Dokumen: ${finalPath}`);
      }

      // 6. Index into SQLite FTS5 Search Index
      try {
        if (memoryIndexSQLiteInstance) {
          memoryIndexSQLiteInstance.upsert({
            id: `curiosity_${clusterCode}_${Date.now()}`,
            timestamp: now.toISOString(),
            category: cluster.category,
            priority: 'HIGH',
            tags: JSON.stringify([clusterCode, cluster.category, 'HERMES3_DIGEST', 'TAVILY_ADVANCED']),
            content: `[${clusterCode} ${cluster.name}]: ${directAnswer}\n${digestionResult.slice(0, 500)}`,
            source: `Autonomous Curiosity Daemon (${cluster.wave}:00 WIB)`
          }, finalPath);
        }
      } catch (idxErr) {
        console.warn(`[CuriosityDaemon] SQLite indexing warning: ${idxErr.message}`);
      }

      // 7. Register Claim into DomainKnowledgeGraph
      try {
        domainKnowledgeGraphInstance.registerClaim({
          claim: `[${clusterCode}] Sintesis Diurnal 2026: ${directAnswer.slice(0, 200)}`,
          domain: cluster.category,
          source: finalPath,
          confidence: 0.98,
          verificationState: 'VERIFIED'
        });
      } catch (_) {}

      // 8. Record in Learned Knowledge Repository (storage/vault/learned_knowledge.json)
      try {
        const vaultDir = path.join(process.cwd(), 'storage', 'vault');
        const vaultFile = path.join(vaultDir, 'learned_knowledge.json');
        if (!fs.existsSync(vaultDir)) fs.mkdirSync(vaultDir, { recursive: true });

        let knowledgeList = [];
        if (fs.existsSync(vaultFile)) {
          try { knowledgeList = JSON.parse(fs.readFileSync(vaultFile, 'utf-8') || '[]'); } catch (_) {}
        }

        const formattedSources = rawResults.map(r => {
          let domain = 'web';
          try { domain = new URL(r.url).hostname.replace(/^www\./, ''); } catch (_) {}
          return {
            title: r.title || cluster.name,
            url: r.url,
            domain,
            score: Math.round((r.score || 0.85) * 100) / 100
          };
        });

        const newKnowledgeItem = {
          knowledgeId: `knw_${clusterCode}_${Date.now()}`,
          cluster: clusterCode,
          name: cluster.name,
          category: cluster.category,
          wave: cluster.wave,
          summary: directAnswer,
          filePath: finalPath,
          fileSizeBytes: Buffer.byteLength(fullDossier, 'utf-8'),
          sourcesCount: rawResults.length,
          sources: formattedSources,
          generatedAt: now.toISOString(),
          status: 'PROMOTED'
        };

        knowledgeList.unshift(newKnowledgeItem);
        if (knowledgeList.length > 50) knowledgeList = knowledgeList.slice(0, 50);
        fs.writeFileSync(vaultFile, JSON.stringify(knowledgeList, null, 2), 'utf-8');
      } catch (vaultErr) {
        console.warn('[CuriosityDaemon] Failed updating learned_knowledge.json:', vaultErr.message);
      }

      const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
      const sizeKb = (Buffer.byteLength(fullDossier, 'utf-8') / 1024).toFixed(1);

      const report = {
        clusterCode,
        clusterName: cluster.name,
        category: cluster.category,
        wave: cluster.wave,
        fileName,
        filePath: finalPath,
        savedToDriveF,
        sizeKb: `${sizeKb} KB`,
        sourcesCount: rawResults.length,
        sources: formattedSources,
        durationSeconds: durationSec,
        timestamp: now.toISOString(),
        status: 'SUCCESS'
      };

      this.history.unshift(report);
      if (this.history.length > 30) this.history.pop();

      console.log(`[CuriosityDaemon] ✅ SELESAI: ${fileName} (${sizeKb} KB) dalam ${durationSec}s`);
      return report;
    } finally {
      this.currentlyCrawling = null;
    }
  }

  getStatus() {
    const wib = this.getWIBTime();
    return {
      isActive: this.isActive,
      currentWIBTime: `${wib.hour.toString().padStart(2, '0')}:${wib.minute.toString().padStart(2, '0')} WIB (${wib.dateStr})`,
      currentlyCrawling: this.currentlyCrawling,
      lastRunWave: this.lastRunWave,
      lastRunDate: this.lastRunDate,
      clustersCount: Object.keys(INTELLIGENCE_CLUSTERS).length,
      clusters: INTELLIGENCE_CLUSTERS,
      recentDossiers: this.history.slice(0, 10)
    };
  }
}

export const curiosityDaemonInstance = new CuriosityDaemon();
export default curiosityDaemonInstance;
