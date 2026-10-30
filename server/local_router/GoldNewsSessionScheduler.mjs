/**
 * GoldNewsSessionScheduler.mjs
 * Compatibility-only adapter for legacy Gold News status consumers.
 *
 * IMPORTANT:
 * - This module MUST NOT collect news or start a timer.
 * - CuriosityDaemon.mjs is the single owner of Gold JINI/Tavily ingestion.
 * - The canonical state file is server/data/gold-news-session-state.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.resolve(__dirname, '../data/gold-news-session-state.json');
const TZ = 'Asia/Jakarta';
const WAVES = [
  { key: 'wave-0700', label: 'Gelombang 1 — Pagi', hour: 7 },
  { key: 'wave-1300', label: 'Gelombang 2 — Siang', hour: 13 },
  { key: 'wave-1700', label: 'Gelombang 3 — Sore', hour: 17 },
  { key: 'wave-2100', label: 'Gelombang 4 — Malam', hour: 21 },
];

function loadState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return {
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
      lastRun: parsed.lastRun || null,
    };
  } catch {
    return { runs: [], lastRun: null };
  }
}

export function getGoldNewsSchedulerStatus() {
  const state = loadState();
  return {
    enabled: true,
    schedulerOwner: 'CuriosityDaemon',
    delegatedTo: 'CuriosityDaemon',
    compatibilityOnly: true,
    note: 'Status adapter only. No legacy news collection or scheduler runs from this module.',
    timezone: TZ,
    providerMode: 'TAVILY_ONLY',
    schedule: WAVES.map(w => ({
      session: w.key,
      label: w.label,
      searchAtWIB: `${String(w.hour).padStart(2, '0')}:00`,
    })),
    lastRun: state.lastRun,
    history: state.runs.slice(-12),
  };
}

export function startGoldNewsSessionScheduler() {
  // Keep the legacy export so existing imports do not break, but never start a second pipeline.
  console.log('[GoldNewsScheduler] Compatibility-only; no legacy collection started.');
  return getGoldNewsSchedulerStatus();
}
