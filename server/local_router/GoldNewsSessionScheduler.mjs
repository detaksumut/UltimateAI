/**
 * GoldNewsSessionScheduler.mjs
 * Scheduled Tavily news ingestion for JIN Gold News Intelligence.
 * Runs at 07:00, 13:00, 17:00 and 21:00 WIB and stores bounded history
 * for the Gold News panel. This is no longer an LLM training/feeding pipeline.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const STATE_FILE = path.join(DATA_DIR, 'gold-news-session-state.json');
const TZ = 'Asia/Jakarta';
const WAVES = [
  { key: 'wave-0700', label: 'Wave 1 · Pagi', hour: 7, minute: 0 },
  { key: 'wave-1300', label: 'Wave 2 · Siang', hour: 13, minute: 0 },
  { key: 'wave-1700', label: 'Wave 3 · Sore', hour: 17, minute: 0 },
  { key: 'wave-2100', label: 'Wave 4 · Malam', hour: 21, minute: 0 },
];
let timer = null;
let running = false;

function parts(date = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(p.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
}
function currentKey(p) { return `${p.year}-${p.month}-${p.day}`; }
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return { runs: [], lastRun: null }; }
}
function saveState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const safe = { runs: (state.runs || []).slice(-90), lastRun: state.lastRun || null };
  const temp = STATE_FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(safe, null, 2), 'utf8');
  fs.renameSync(temp, STATE_FILE);
}
async function fetchSources() {
  const { webSearchToolInstance } = await import('../tools/WebSearchTool.mjs');
  const query = [
    'Latest gold XAUUSD financial news and official economic announcements',
    'Federal Reserve rates inflation CPI PCE NFP US Treasury yields US dollar',
    'gold price drivers geopolitical risk central bank gold purchases',
    'latest published headlines and upcoming economic releases'
  ].join('; ');
  const result = await webSearchToolInstance.execute(
    { query, maxResults: 8, layer: 'ALL' },
    AbortSignal.timeout(20000)
  );
  const sources = (Array.isArray(result.sources) ? result.sources : [])
    .filter(s => {
      try { return ['http:', 'https:'].includes(new URL(s.url).protocol); } catch { return false; }
    })
    .map((s, i) => ({
      key: s.id || `gold-news-${i + 1}`,
      label: String(s.title || s.domain || `Gold news ${i + 1}`).slice(0, 300),
      url: s.url,
      status: 'READ',
      fetchedAt: new Date().toISOString(),
      content: [
        `Provider: ${result.provider || 'UNKNOWN'}`,
        `Domain: ${s.domain || ''}`,
        `Search snippet (not full article text): ${s.snippet || ''}`,
        `Relevance score: ${s.score ?? 'not available'}`,
        `Category: ${s.category || 'GENERAL'}`
      ].join('\n'),
      score: Number.isFinite(s.score) ? s.score : null
    }));
  return {
    success: sources.length > 0,
    provider: result.provider || 'UNKNOWN',
    directAnswer: result.directAnswer || null,
    query: result.query || query,
    fetchedAt: new Date().toISOString(),
    sources
  };
}
async function runWave(wave, dayKey, reason = 'scheduled') {
  if (running) return;
  running = true;
  const startedAt = new Date().toISOString();
  const state = loadState();
  try {
    const payload = await fetchSources();
    if (!payload.success) throw new Error('Tavily/fallback search returned no usable sources');
    const record = {
      session: wave.key,
      sessionLabel: wave.label,
      dayKey,
      scheduledAtWIB: `${dayKey} ${String(wave.hour).padStart(2, '0')}:${String(wave.minute).padStart(2, '0')} WIB`,
      startedAt,
      completedAt: new Date().toISOString(),
      reason,
      success: true,
      provider: payload.provider,
      query: payload.query,
      directAnswer: payload.directAnswer,
      fetchedAt: payload.fetchedAt,
      sources: payload.sources
    };
    state.runs = [...(state.runs || []), record].slice(-90);
    state.lastRun = record;
    saveState(state);
    console.log(`[GoldNewsScheduler] ${wave.label}: ${record.provider}; ${record.sources.length} sources saved for Gold News panel.`);
  } catch (error) {
    const record = {
      session: wave.key, sessionLabel: wave.label, dayKey, startedAt,
      completedAt: new Date().toISOString(), reason, success: false,
      provider: 'UNAVAILABLE', error: error.message, sources: []
    };
    state.runs = [...(state.runs || []), record].slice(-90);
    state.lastRun = record;
    try { saveState(state); } catch (saveError) { console.error('[GoldNewsScheduler] State save failed:', saveError.message); }
    console.warn('[GoldNewsScheduler] Scheduled search failed:', error.message);
  } finally { running = false; }
}
function tick() {
  const p = parts();
  const day = currentKey(p);
  const minuteOfDay = Number(p.hour) * 60 + Number(p.minute);
  const state = loadState();
  for (const wave of WAVES) {
    const target = wave.hour * 60 + wave.minute;
    const key = `${day}:${wave.key}`;
    const alreadyRan = (state.runs || []).some(r => `${r.dayKey}:${r.session}` === key);
    // A two-minute catch-up window prevents missed waves if the timer drifts.
    if (!alreadyRan && minuteOfDay >= target && minuteOfDay < target + 2) {
      void runWave(wave, day, 'scheduled');
      break;
    }
  }
}
export function getGoldNewsSchedulerStatus() {
  const state = loadState();
  return {
    enabled: false,
    delegatedTo: 'CuriosityDaemon',
    note: 'Scheduled ingestion is owned by CuriosityDaemon; this module only exposes legacy status compatibility.',
    timezone: TZ,
    providerMode: 'TAVILY_ONLY',
    schedule: WAVES.map(w => ({
      session: w.key, label: w.label,
      searchAtWIB: `${String(w.hour).padStart(2, '0')}:${String(w.minute).padStart(2, '0')}`
    })),
    lastRun: state.lastRun,
    history: (state.runs || []).slice(-12)
  };
}
export function startGoldNewsSessionScheduler() {
  // Legacy compatibility only: CuriosityDaemon is the sole scheduled ingestion owner.
  console.log('[GoldNewsScheduler] Legacy scheduler disabled; CuriosityDaemon owns Gold JINI ingestion.');
  return getGoldNewsSchedulerStatus();
}
