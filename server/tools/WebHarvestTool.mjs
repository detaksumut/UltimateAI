/**
 * WebHarvestTool.mjs
 * Autonomous Web Intelligence Harvester & Drive F: Document Archiver.
 * 
 * Flow:
 *  Tavily AI (2024-2026 Live Web Intelligence) 
 *    → Synthesize Structured Knowledge Document (.md)
 *    → Archive to F:\UltimateAI_Memory\02_Documentation\
 *    → Index into SQLite Semantic Database for Hermes 3 offline ingestion.
 */

import { ToolContract, PERMISSION_LEVELS } from './ToolContract.mjs';
import { localDriveFStorageInstance } from '../memory/LocalDriveFStorage.mjs';
import { WebSearchTool, webSearchToolInstance } from './WebSearchTool.mjs';
import { memoryIndexSQLiteInstance } from '../memory/MemoryIndexSQLite.mjs';
import fs from 'fs';
import path from 'path';

export const latestHarvestStatus = {
  active: false,
  stage: 'IDLE',
  topic: '',
  startYear: null,
  endYear: new Date().getFullYear(),
  sourcesCount: 0,
  sources: [],
  lastSavedFile: null,
  sourceProvider: null,
  error: null,
  updatedAt: new Date().toISOString()
};

export class WebHarvestTool extends ToolContract {
  constructor() {
    super({
      name: 'intel.harvest',
      version: '1.0.0',
      description: 'Harvets latest 2024-2026 web intelligence via Tavily AI and archives structured documentation directly to Drive F: for Hermes 3 local analysis.',
      inputSchema: { topic: 'string', startYear: 'number', maxResults: 'number', category: 'string' },
      outputSchema: { topic: 'string', filePath: 'string', savedToF: 'boolean', sourcesCount: 'number', summary: 'string' },
      permissionLevel: PERMISSION_LEVELS.SAFE_EXECUTE,
      timeoutMs: 15000
    });
  }

  async execute(params = {}, signal = null) {
    const currentYear = new Date().getFullYear();
    const {
      topic = '',
      startYear = currentYear - 2,
      maxResults = 6,
      category = 'INTELLIGENCE'
    } = params;

    if (!topic || !topic.trim()) {
      throw new Error('Topik riset tidak boleh kosong.');
    }

    const sanitizedTopic = WebSearchTool.sanitizeText(topic.trim());
    const query = `${sanitizedTopic} perkembangan terbaru informasi terkini ${startYear}-${currentYear}`;
    const apiKey = (process.env.TAVILY_API_KEY || '').trim();

    // 0. Update state to CRAWLING
    latestHarvestStatus.active = true;
    latestHarvestStatus.stage = 'CRAWLING';
    latestHarvestStatus.topic = sanitizedTopic;
    latestHarvestStatus.startYear = startYear;
    latestHarvestStatus.endYear = currentYear;
    latestHarvestStatus.error = null;
    latestHarvestStatus.updatedAt = new Date().toISOString();

    console.log(`[WebHarvestTool] Memulai harvest inteligensi untuk: "${sanitizedTopic}" (Sejak ${startYear})`);

    // 1. Fetch live intelligence via Tavily AI
    let harvestData = null;
    if (apiKey && apiKey !== 'undefined') {
      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
            query,
            search_depth: 'advanced',
            include_answer: true,
            max_results: maxResults
          }),
          signal: signal || AbortSignal.timeout(10000)
        });

        if (res.ok) {
          harvestData = await res.json();
        }
      } catch (err) {
        console.warn(`[WebHarvestTool] Tavily harvest fetch error: ${err.message}`);
      }
    }

    let rawResults = Array.isArray(harvestData?.results) ? harvestData.results : [];
    let sourceProvider = rawResults.length ? 'TAVILY_AI' : null;
    let directAnswer = typeof harvestData?.answer === 'string' && harvestData.answer.trim()
      ? harvestData.answer.trim()
      : null;

    // If Tavily is absent, unavailable or empty, use the existing public
    // multi-layer search. Never invent source records or pretend the search succeeded.
    if (rawResults.length === 0) {
      try {
        const fallbackResult = await webSearchToolInstance.execute(
          { query, layer: 'ALL', maxResults },
          signal
        );
        const fallbackSources = Array.isArray(fallbackResult?.sources) ? fallbackResult.sources : [];
        if (fallbackSources.length > 0) {
          rawResults = fallbackSources.map(source => ({
            title: source.title || sanitizedTopic,
            url: source.url || '',
            content: source.snippet || '',
            score: typeof source.score === 'number' ? source.score : null,
            domain: source.domain || ''
          }));
          sourceProvider = fallbackResult.provider || 'MULTILAYER_SEARCH';
        }
      } catch (err) {
        console.warn('[WebHarvestTool] Fallback search failed:', err?.message || String(err));
      }
    }

    if (rawResults.length === 0) {
      latestHarvestStatus.active = false;
      latestHarvestStatus.stage = 'FAILED';
      latestHarvestStatus.sourcesCount = 0;
      latestHarvestStatus.sources = [];
      latestHarvestStatus.sourceProvider = null;
      latestHarvestStatus.error = apiKey && apiKey !== 'undefined'
        ? 'Tidak ada sumber yang berhasil diambil dari Tavily atau pencarian fallback.'
        : 'TAVILY_API_KEY tidak tersedia dan pencarian fallback tidak menghasilkan sumber.';
      latestHarvestStatus.updatedAt = new Date().toISOString();
      return {
        status: 'NO_SOURCES',
        topic: sanitizedTopic,
        query,
        sourcesCount: 0,
        savedToF: false,
        error: latestHarvestStatus.error
      };
    }

    if (!directAnswer) {
      directAnswer = 'Provider tidak menyediakan ringkasan sintesis. Dokumen ini menyimpan judul, cuplikan, dan tautan sumber yang dikumpulkan; perlakukan cuplikan sebagai bukti yang perlu diverifikasi silang, bukan kesimpulan final.';
    }

    latestHarvestStatus.stage = 'SYNTHESIZING';
    latestHarvestStatus.sourcesCount = rawResults.length;
    latestHarvestStatus.sourceProvider = sourceProvider;
    latestHarvestStatus.sources = rawResults.map(source => {
      let domain = '';
      try { domain = source.domain || new URL(source.url).hostname.replace(/^www\./, ''); }
      catch (_) { domain = 'web'; }
      return {
        title: source.title || sanitizedTopic,
        url: source.url || '',
        domain,
        score: typeof source.score === 'number' ? source.score : null
      };
    });

    // 2. Format Structured Markdown Documentation for Drive F:
    const safeSlug = sanitizedTopic.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `doc_${safeSlug}_${dateStr}_${Date.now().toString().slice(-4)}.md`;

    let docMarkdown = `# DOKUMEN PENGETAHUAN: ${sanitizedTopic.toUpperCase()}\n\n`;
    docMarkdown += `> **Metadata Arsip**\n`;
    docMarkdown += `> - Tanggal Ingesti: ${new Date().toLocaleString('id-ID')}\n`;
    docMarkdown += `> - Rentang Waktu: ${startYear} — ${currentYear} (Live Web Grounding)\n`;
    docMarkdown += `> - Sumber Ingesti: ${sourceProvider || 'UNKNOWN'}\n`;
    docMarkdown += `> - Klasifikasi: ${category}\n\n`;

    docMarkdown += `## 1. Rangkuman Eksekutif & Jawaban Terkini\n\n`;
    docMarkdown += `${directAnswer}\n\n`;

    docMarkdown += `## 2. Temuan Fakta & Data Lapangan\n\n`;
    if (rawResults.length > 0) {
      rawResults.forEach((r, idx) => {
        const cleanTitle = WebSearchTool.sanitizeText(r.title || 'Informasi Publik');
        const cleanContent = WebSearchTool.sanitizeText(r.content || '');
        let domain = '';
        try { domain = new URL(r.url).hostname; } catch (_) { domain = 'web'; }

        docMarkdown += `### ${idx + 1}. ${cleanTitle}\n`;
        docMarkdown += `- **Sumber**: ${domain} ([Tautan](${r.url}))\n`;
        docMarkdown += `- **Skor Relevansi**: ${Math.round((r.score || 0.8) * 100)}%\n`;
        docMarkdown += `- **Ringkasan Fakta**:\n  ${cleanContent}\n\n`;
      });
    } else {
      docMarkdown += `Informasi tersimpan dalam memori kerja sistem.\n\n`;
    }

    docMarkdown += `## 3. Catatan Untuk Hermes 3 (Local Inference Guidance)\n\n`;
    docMarkdown += `Rentang data yang diminta: ${startYear}-${currentYear}. Periksa tanggal pada setiap sumber sebelum menganggap fakta masih berlaku.\n`;
    docMarkdown += `Perlakukan cuplikan sebagai data eksternal yang perlu diverifikasi silang; jangan menganggapnya otomatis sebagai sumber kebenaran primer.\n`;

    // 3. Save to Drive F:\UltimateAI_Memory\02_Documentation\
    latestHarvestStatus.stage = 'COMMITTING_TO_F';

    let savedToF = false;
    let finalPath = '';
    const writeResult = localDriveFStorageInstance.writeRecord('02_Documentation', fileName, docMarkdown);
    if (writeResult?.success) {
      savedToF = true;
      finalPath = writeResult.path;
      console.log('[WebHarvestTool] Saved to Drive F:', finalPath);
    } else {
      // Actually write the fallback file; never return a path that does not exist.
      const fallbackDir = path.resolve(process.cwd(), 'storage', 'documents');
      try {
        fs.mkdirSync(fallbackDir, { recursive: true });
        finalPath = path.join(fallbackDir, fileName);
        fs.writeFileSync(finalPath, docMarkdown, 'utf8');
        console.warn('[WebHarvestTool] Drive F unavailable; saved locally:', finalPath);
      } catch (err) {
        latestHarvestStatus.active = false;
        latestHarvestStatus.stage = 'FAILED';
        latestHarvestStatus.error = 'Gagal menyimpan dokumen ke Drive F maupun fallback lokal: ' + err.message;
        latestHarvestStatus.updatedAt = new Date().toISOString();
        return { status: 'SAVE_FAILED', topic: sanitizedTopic, sourcesCount: rawResults.length, error: latestHarvestStatus.error };
      }
    }

    let indexStatus = 'INDEX_UNAVAILABLE';
    try {
      if (memoryIndexSQLiteInstance) {
        const indexResult = memoryIndexSQLiteInstance.upsert({
          id: 'harvest_' + Date.now(),
          timestamp: new Date().toISOString(),
          category: 'KNOWLEDGE_HARVEST',
          priority: 'HIGH',
          tags: JSON.stringify([sanitizedTopic, String(startYear) + '-' + String(currentYear), sourceProvider || 'WEB_SEARCH']),
          content: sanitizedTopic + ': ' + directAnswer,
          source: sourceProvider || 'WEB_SEARCH'
        }, finalPath);
        indexStatus = indexResult === false ? 'INDEX_FAILED' : 'SQLITE_FTS5_INDEXED';
      }
    } catch (err) {
      indexStatus = 'INDEX_FAILED';
      console.warn('[WebHarvestTool] SQLite indexing failed:', err?.message || String(err));
    }

    const sizeBytes = Buffer.byteLength(docMarkdown, 'utf-8');
    const sizeKb = (sizeBytes / 1024).toFixed(1) + ' KB';

    latestHarvestStatus.active = false;
    latestHarvestStatus.stage = 'SYNCED';
    latestHarvestStatus.sourceProvider = sourceProvider;
    latestHarvestStatus.error = null;
    latestHarvestStatus.lastSavedFile = {
      fileName,
      filePath: finalPath,
      sizeBytes,
      sizeKb,
      timestamp: new Date().toISOString(),
      topic: sanitizedTopic,
      indexStatus
    };
    latestHarvestStatus.updatedAt = new Date().toISOString();

    return {
      topic: sanitizedTopic,
      fileName,
      filePath: finalPath,
      savedToF,
      savedLocally: !savedToF,
      sourcesCount: rawResults.length,
      sourceProvider,
      startYear,
      endYear: currentYear,
      directSynthesis: directAnswer,
      contentPreview: docMarkdown.slice(0, 300) + '...',
      sizeKb,
      indexStatus,
      status: 'HARVEST_COMPLETE'
    };
  }
}

export function getHarvestStatus() {
  // Check Drive F free space if possible
  const docDir = path.join('F:\\UltimateAI_Memory', '02_Documentation');
  let totalDocs = 0;
  try {
    if (fs.existsSync(docDir)) {
      totalDocs = fs.readdirSync(docDir).filter(f => f.endsWith('.md')).length;
    }
  } catch (_) {}

  const driveFAvailable = fs.existsSync('F:\\');
  return {
    ...latestHarvestStatus,
    driveF: {
      isAvailable: driveFAvailable,
      targetDirectory: docDir,
      totalArchivedDocs: totalDocs,
      mountStatus: driveFAvailable ? 'MOUNTED_ONLINE' : 'UNAVAILABLE'
    }
  };
}

export const webHarvestToolInstance = new WebHarvestTool();
export default webHarvestToolInstance;
