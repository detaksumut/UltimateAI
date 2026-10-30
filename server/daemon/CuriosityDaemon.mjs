/**
 * CuriosityDaemon.mjs
 * Gold JINI Tavily ingestion — four scheduled WIB waves.
 * Search results are stored as market intelligence; they are not sent to an LLM.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localDriveFStorageInstance } from '../memory/LocalDriveFStorage.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const STATE_FILE = path.join(DATA_DIR, 'gold-news-session-state.json');
const VAULT_DIR = path.resolve(__dirname, '../../storage/vault');
const TZ = 'Asia/Jakarta';
const WAVES = [
  { key: 'wave-0700', hour: 7, label: 'Gelombang 1 — Pagi' },
  { key: 'wave-1300', hour: 13, label: 'Gelombang 2 — Siang' },
  { key: 'wave-1700', hour: 17, label: 'Gelombang 3 — Sore' },
  { key: 'wave-2100', hour: 21, label: 'Gelombang 4 — Malam' }
];
const GOLD_QUERY = [
  'latest XAUUSD spot gold price drivers and market-moving gold news',
  'Federal Reserve interest rate policy FOMC speeches US CPI PCE inflation NFP jobs data',
  'US Treasury real yields DXY US dollar central bank gold purchases ETF flows',
  'geopolitical risk oil prices and economic calendar events affecting gold'
].join('; ');

function wibParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
}
function dayKey(p) { return `${p.year}-${p.month}-${p.day}`; }
function loadState() {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return { runs: Array.isArray(state.runs) ? state.runs : [], lastRun: state.lastRun || null };
  } catch { return { runs: [], lastRun: null }; }
}
function saveState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const safe = { runs: (state.runs || []).slice(-90), lastRun: state.lastRun || null };
  const temp = STATE_FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(safe, null, 2), 'utf8');
  fs.renameSync(temp, STATE_FILE);
}
function safeText(value, max = 12000) {
  return String(value || '').replace(/\u0000/g, '').slice(0, max);
}

export class CuriosityDaemon {
  constructor() {
    this.isActive = false;
    this.timer = null;
    this.currentlyCrawling = null;
    this.lastRunWave = null;
    this.lastRunDate = {};
    this.history = [];
    this._loadPersistedHistory();
  }

  _loadPersistedHistory() {
    try {
      const file = path.join(VAULT_DIR, 'learned_knowledge.json');
      if (fs.existsSync(file)) {
        const items = JSON.parse(fs.readFileSync(file, 'utf8') || '[]');
        this.history = items.map(item => ({
          clusterCode: item.cluster || 'GOLD',
          clusterName: item.name || 'Gold JINI Market Intelligence',
          category: item.category || 'GOLD_MARKET',
          wave: item.wave,
          fileName: path.basename(item.filePath || ''),
          filePath: item.filePath,
          savedToDriveF: (item.filePath || '').startsWith('F:'),
          sourcesCount: item.sourcesCount || 0,
          sources: item.sources || [],
          timestamp: item.generatedAt,
          status: item.status || 'SAVED'
        }));
      }
    } catch {}
    try {
      const file = path.join(VAULT_DIR, 'daemon_state.json');
      const saved = JSON.parse(fs.readFileSync(file, 'utf8') || '{}');
      this.lastRunDate = saved.lastRunDate || {};
    } catch {}
  }

  _persistRunDate() {
    try {
      fs.mkdirSync(VAULT_DIR, { recursive: true });
      fs.writeFileSync(path.join(VAULT_DIR, 'daemon_state.json'), JSON.stringify({
        lastRunDate: this.lastRunDate,
        lastRunWave: this.lastRunWave,
        updatedAt: new Date().toISOString()
      }, null, 2), 'utf8');
    } catch (error) {
      console.warn('[CuriosityDaemon] Cannot persist schedule state:', error.message);
    }
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    console.log('[CuriosityDaemon] Gold JINI Tavily ingestion enabled: 07:00, 13:00, 17:00, 21:00 WIB.');
    this._checkDiurnalPulse().catch(e => console.warn('[CuriosityDaemon] Initial check:', e.message));
    this.timer = setInterval(() => {
      this._checkDiurnalPulse().catch(e => console.warn('[CuriosityDaemon] Schedule check:', e.message));
    }, 15000);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.isActive = false;
    console.log('[CuriosityDaemon] Curiosity Daemon dihentikan.');
  }

  getWIBTime() {
    const p = wibParts();
    return { hour: Number(p.hour), minute: Number(p.minute), dateStr: dayKey(p), fullIso: new Date().toISOString() };
  }

  async _checkDiurnalPulse() {
    if (this.currentlyCrawling) return;
    const p = wibParts();
    const day = dayKey(p);
    const minuteOfDay = Number(p.hour) * 60 + Number(p.minute);
    for (const wave of WAVES) {
      const target = wave.hour * 60;
      if (minuteOfDay < target || minuteOfDay >= target + 2) continue;
      const state = loadState();
      const alreadyRan = (state.runs || []).some(r => r.dayKey === day && r.session === wave.key);
      if (alreadyRan) continue;
      this.lastRunDate[wave.hour] = day;
      this.lastRunWave = wave.hour;
      this._persistRunDate();
      await this.executeDeepHarvest(wave, day, 'scheduled');
      break;
    }
  }

  async executeDeepHarvest(wave, day = dayKey(wibParts()), reason = 'manual') {
    if (this.currentlyCrawling) throw new Error('DAEMON_BUSY: Gold JINI ingestion is already running.');
    this.currentlyCrawling = wave.key;
    const startedAt = new Date().toISOString();
    console.log(`[CuriosityDaemon] Tavily Gold JINI ${wave.label} — query XAUUSD/fundamental news`);
    try {
      const apiKey = (process.env.TAVILY_API_KEY || '').trim();
      if (!apiKey) throw new Error('TAVILY_API_KEY is missing from the server environment; no hard-coded key fallback is used.');
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: GOLD_QUERY,
          search_depth: 'advanced',
          include_raw_content: true,
          include_answer: true,
          max_results: 8
        }),
        signal: AbortSignal.timeout(25000)
      });
      if (!response.ok) throw new Error(`Tavily HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
      const data = await response.json();
      const rawResults = Array.isArray(data.results) ? data.results : [];
      if (!rawResults.length && !data.answer) throw new Error('Tavily returned no usable answer or sources.');

      const fetchedAt = new Date().toISOString();
      const sources = rawResults.map((r, i) => {
        let domain = '';
        try { domain = new URL(r.url).hostname.replace(/^www\./, ''); } catch {}
        return {
          key: `gold-tavily-${Date.now()}-${i + 1}`,
          label: safeText(r.title || 'Gold market source', 300),
          title: safeText(r.title || 'Gold market source', 300),
          url: r.url || '',
          domain,
          status: 'READ',
          fetchedAt,
          score: Number.isFinite(r.score) ? r.score : null,
          content: safeText(r.raw_content || r.content || '', 12000),
          snippet: safeText(r.content || '', 3000)
        };
      }).filter(s => /^https?:\/\//i.test(s.url));

      const record = {
        session: wave.key,
        sessionLabel: wave.label,
        dayKey: day,
        scheduledAtWIB: `${day} ${String(wave.hour).padStart(2, '0')}:00 WIB`,
        startedAt,
        completedAt: new Date().toISOString(),
        reason,
        success: true,
        provider: 'TAVILY_AI',
        query: GOLD_QUERY,
        directAnswer: safeText(data.answer || '', 12000),
        fetchedAt,
        sources
      };
      const state = loadState();
      state.runs = [...state.runs, record].slice(-90);
      state.lastRun = record;
      saveState(state);

      const now = new Date();
      const dateStamp = day.replace(/-/g, '');
      const timeStamp = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
        .format(now).replace(/:/g, '');
      const fileName = `GOLD_JINI_${wave.hour}_${dateStamp}_${timeStamp}.md`;
      const dossier = [
        '# Gold JINI — Tavily Market Intelligence',
        '',
        `- Gelombang: ${wave.label} (${wave.hour}:00 WIB)`,
        `- Waktu pengambilan: ${now.toLocaleString('id-ID', { timeZone: TZ })} WIB`,
        '- Provider: Tavily AI Advanced Search',
        '- Tujuan: intelijen berita dan fundamental Gold JINI; bukan sinyal trading otomatis.',
        '',
        '## Ringkasan Tavily',
        safeText(data.answer || 'Tavily tidak memberikan ringkasan langsung.', 12000),
        '',
        '## Sumber',
        ...sources.flatMap((s, i) => [
          `### ${i + 1}. ${s.title}`,
          `- URL: ${s.url}`,
          `- Domain: ${s.domain}`,
          `- Relevance: ${s.score ?? 'n/a'}`,
          '',
          safeText(s.content || s.snippet, 12000),
          ''
        ])
      ].join('\n');

      let finalPath = '';
      let savedToDriveF = false;
      try {
        const written = localDriveFStorageInstance.writeRecord('02_Documentation', fileName, dossier);
        if (written?.success) {
          finalPath = written.path;
          savedToDriveF = true;
        }
      } catch (e) {
        console.warn('[CuriosityDaemon] Drive F save unavailable:', e.message);
      }
      if (!finalPath) {
        const localDir = path.join(VAULT_DIR, 'gold-jini');
        fs.mkdirSync(localDir, { recursive: true });
        finalPath = path.join(localDir, fileName);
        fs.writeFileSync(finalPath, dossier, 'utf8');
      }

      const report = {
        clusterCode: 'GOLD',
        clusterName: 'Gold JINI Market Intelligence',
        category: 'GOLD_MARKET',
        wave: wave.hour,
        fileName,
        filePath: finalPath,
        savedToDriveF,
        sizeKb: `${(Buffer.byteLength(dossier, 'utf8') / 1024).toFixed(1)} KB`,
        sourcesCount: sources.length,
        sources: sources.map(s => ({ title: s.title, url: s.url, domain: s.domain, score: s.score })),
        durationSeconds: ((Date.now() - new Date(startedAt).getTime()) / 1000).toFixed(1),
        timestamp: record.completedAt,
        status: 'SUCCESS'
      };
      this.history.unshift(report);
      this.history = this.history.slice(0, 30);

      try {
        fs.mkdirSync(VAULT_DIR, { recursive: true });
        const vaultFile = path.join(VAULT_DIR, 'learned_knowledge.json');
        let items = [];
        try { items = JSON.parse(fs.readFileSync(vaultFile, 'utf8') || '[]'); } catch {}
        items.unshift({
          knowledgeId: `gold_${wave.hour}_${Date.now()}`,
          cluster: 'GOLD',
          name: report.clusterName,
          category: report.category,
          wave: wave.hour,
          summary: record.directAnswer,
          filePath: finalPath,
          fileSizeBytes: Buffer.byteLength(dossier, 'utf8'),
          sourcesCount: sources.length,
          sources: report.sources,
          generatedAt: record.completedAt,
          status: 'SAVED'
        });
        fs.writeFileSync(vaultFile, JSON.stringify(items.slice(0, 50), null, 2), 'utf8');
      } catch (e) {
        console.warn('[CuriosityDaemon] History index save warning:', e.message);
      }
      console.log(`[CuriosityDaemon] Gold JINI saved: ${sources.length} Tavily sources; provider=TAVILY_AI; ${finalPath}`);
      return report;
    } catch (error) {
      const state = loadState();
      const failed = {
        session: wave.key, sessionLabel: wave.label, dayKey: day, startedAt,
        completedAt: new Date().toISOString(), reason, success: false,
        provider: 'TAVILY_AI', error: error.message, sources: []
      };
      state.runs = [...state.runs, failed].slice(-90);
      state.lastRun = failed;
      try { saveState(state); } catch {}
      console.error('[CuriosityDaemon] Gold JINI Tavily ingestion failed:', error.message);
      return { status: 'FAILED', error: error.message, wave: wave.hour };
    } finally {
      this.currentlyCrawling = null;
    }
  }

  getStatus() {
    const wib = this.getWIBTime();
    const state = loadState();
    return {
      isActive: this.isActive,
      currentWIBTime: `${String(wib.hour).padStart(2, '0')}:${String(wib.minute).padStart(2, '0')} WIB (${wib.dateStr})`,
      currentlyCrawling: this.currentlyCrawling,
      lastRunWave: this.lastRunWave,
      lastRunDate: this.lastRunDate,
      clustersCount: 1,
      clusters: Object.fromEntries(WAVES.map(w => [w.key, { wave: w.hour, name: 'Gold JINI Market Intelligence', query: GOLD_QUERY }])),
      recentDossiers: this.history.slice(0, 10),
      goldNewsLastRun: state.lastRun,
      schedule: WAVES.map(w => ({ session: w.key, searchAtWIB: `${String(w.hour).padStart(2, '0')}:00` }))
    };
  }
}

export const curiosityDaemonInstance = new CuriosityDaemon();
export default curiosityDaemonInstance;
