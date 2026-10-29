/**
 * GoldNewsSessionScheduler.mjs
 * Persistent-while-LocalRouter-running scheduler for XAUUSD macro news.
 * Runs ten minutes before the configured WIB session boundaries, once per
 * session/day. Does not poll news every 30 minutes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const STATE_FILE = path.join(DATA_DIR, 'gold-news-session-state.json');
const TZ = 'Asia/Jakarta';
const SESSIONS = [
  { key: 'asia', label: 'Asia', hour: 6, minute: 0 },
  { key: 'london', label: 'London', hour: 14, minute: 0 },
  { key: 'newyork', label: 'New York', hour: 19, minute: 0 },
];
const PRE_MINUTES = Number(process.env.JIN_GOLD_NEWS_PRE_SESSION_MINUTES || 10);
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
  const response = await fetch('http://127.0.0.1:' + (process.env.LOCAL_ROUTER_PORT || '20200') + '/api/trading/fundamental-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources: ['fed','bls','bea','treasury','cftc'], instrument: 'XAUUSD', scheduled: true, timezone: TZ }),
    signal: AbortSignal.timeout(45000)
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.error || 'Fundamental news source fetch failed');
  return payload;
}
async function runSession(session, dayKey, reason = 'scheduled') {
  if (running) return;
  running = true;
  const startedAt = new Date().toISOString();
  const state = loadState();
  try {
    const payload = await fetchSources();
    const record = {
      session: session.key, sessionLabel: session.label, dayKey,
      scheduledAtWIB: `${dayKey} ${String(session.hour).padStart(2,'0')}:${String(session.minute).padStart(2,'0')} WIB`,
      startedAt, completedAt: new Date().toISOString(), reason,
      success: true, fetchedAt: payload.fetchedAt || new Date().toISOString(),
      sources: (payload.sources || []).map(s => ({
        key: s.key, label: s.label, url: s.url, status: s.status,
        fetchedAt: s.fetchedAt, error: s.error || null, content: s.content || ''
      }))
    };
    state.runs = [...(state.runs || []), record].slice(-90);
    state.lastRun = record;
    saveState(state);
    console.log(`[GoldNewsScheduler] ${session.label} session news fetched: ${record.sources.filter(s => s.status === 'READ').length}/${record.sources.length} sources`);
  } catch (error) {
    const record = {
      session: session.key, sessionLabel: session.label, dayKey, startedAt,
      completedAt: new Date().toISOString(), reason, success: false, error: error.message,
      sources: []
    };
    state.runs = [...(state.runs || []), record].slice(-90);
    state.lastRun = record;
    try { saveState(state); } catch (saveError) { console.error('[GoldNewsScheduler] State save failed:', saveError.message); }
    console.warn('[GoldNewsScheduler] Session fetch failed:', error.message);
  } finally { running = false; }
}
function tick() {
  const p = parts();
  const day = currentKey(p);
  const minuteOfDay = Number(p.hour) * 60 + Number(p.minute);
  const state = loadState();
  for (const session of SESSIONS) {
    const boundary = session.hour * 60 + session.minute;
    const trigger = boundary - PRE_MINUTES;
    const key = `${day}:${session.key}`;
    const alreadyRan = (state.runs || []).some(r => `${r.dayKey}:${r.session}` === key);
    if (!alreadyRan && minuteOfDay >= trigger && minuteOfDay < boundary) {
      void runSession(session, day, 'pre-session');
      break;
    }
  }
}
export function getGoldNewsSchedulerStatus() {
  const state = loadState();
  return {
    enabled: true, timezone: TZ, preSessionMinutes: PRE_MINUTES,
    schedule: SESSIONS.map(s => ({ session: s.key, label: s.label, boundaryWIB: `${String(s.hour).padStart(2,'0')}:${String(s.minute).padStart(2,'0')}`, searchAtWIB: `${String(Math.floor((s.hour*60+s.minute-PRE_MINUTES)/60)).padStart(2,'0')}:${String((s.hour*60+s.minute-PRE_MINUTES)%60).padStart(2,'0')}` })),
    lastRun: state.lastRun, history: (state.runs || []).slice(-12)
  };
}
export function startGoldNewsSessionScheduler() {
  if (timer) return getGoldNewsSchedulerStatus();
  console.log(`[GoldNewsScheduler] Enabled; searches ${PRE_MINUTES} min before Asia/London/New York sessions (WIB).`);
  tick();
  timer = setInterval(tick, 15000);
  timer.unref?.();
  return getGoldNewsSchedulerStatus();
}
