/**
 * MemoryTrendAnalyzer.mjs
 * Bounded, persisted RAM history so the leak detector can compare multiple
 * samples instead of judging a single snapshot. Retention-capped.
 * LOCAL storage only.
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'device_memory_history.json');
const MAX_ENTRIES = 24;

function readHistory() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

function writeHistory(entries) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(entries.slice(0, MAX_ENTRIES), null, 2), 'utf8');
  } catch {}
}

export class MemoryTrendAnalyzer {
  constructor({ maxEntries = MAX_ENTRIES } = {}) {
    this.maxEntries = maxEntries;
    this.history = readHistory();
  }

  push(snapshot) {
    const entry = {
      timestamp: snapshot.timestamp || new Date().toISOString(),
      totalBytes: snapshot.totalBytes,
      usedBytes: snapshot.usedBytes,
      freeBytes: snapshot.freeBytes,
      percentUsed: snapshot.percentUsed,
      topNodeProcesses: (snapshot.topNodeProcesses || []).slice(0, 10).map(p => ({
        pid: p.pid,
        name: p.name,
        wsMB: Math.round(p.wsMB * 10) / 10
      }))
    };
    this.history.unshift(entry);
    this.history = this.history.slice(0, this.maxEntries);
    writeHistory(this.history);
    return entry;
  }

  getHistory() {
    return this.history;
  }

  getTrendSummary() {
    const h = this.history;
    if (!h.length) {
      return { samples: 0, usedDeltaMB: 0, percentUsedNow: null, direction: 'NO_DATA' };
    }
    const first = h[h.length - 1];
    const last = h[0];
    const deltaBytes = (last.usedBytes || 0) - (first.usedBytes || 0);
    const deltaMB = Math.round((deltaBytes / (1024 * 1024)) * 10) / 10;
    return {
      samples: h.length,
      usedDeltaMB: deltaMB,
      percentUsedNow: last.percentUsed,
      percentUsedFirst: first.percentUsed,
      direction: deltaMB > 64 ? 'RISING' : (deltaMB < -64 ? 'FALLING' : 'FLAT'),
      spanSec: Math.round((Date.parse(last.timestamp) - Date.parse(first.timestamp)) / 1000)
    };
  }
}

export const memoryTrendAnalyzerInstance = new MemoryTrendAnalyzer();
export default memoryTrendAnalyzerInstance;