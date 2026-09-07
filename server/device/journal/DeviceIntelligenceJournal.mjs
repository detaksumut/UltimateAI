/**
 * DeviceIntelligenceJournal.mjs
 * Bounded local journal for device scans: timestamps, snapshot summaries,
 * anomalies, recommendations. Retention-capped. NEVER stores passwords,
 * tokens, API keys, credentials, or sensitive file contents.
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const JOURNAL_FILE = path.join(DATA_DIR, 'device_journal.json');
const MAX_ENTRIES = 50;

function readFile() {
  try {
    if (!fs.existsSync(JOURNAL_FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFile(entries) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(entries, null, 2), 'utf8');
  } catch {}
}

/** Scrubs anything that looks like a secret before journaling. */
function sanitize(entry) {
  const safe = { ...entry };
  for (const key of Object.keys(safe)) {
    const low = key.toLowerCase();
    if (/(token|secret|key|password|credential|authorization|bearer|vault)/.test(low)) {
      delete safe[key];
    }
  }
  const text = JSON.stringify(entry) || '';
  if (/(refresh_token|access_token|api[_-]?key|password|passwd)/i.test(text) && text.length > 400) {
    return safe;
  }
  return safe;
}

export class DeviceIntelligenceJournal {
  constructor({ maxEntries = MAX_ENTRIES } = {}) {
    this.maxEntries = maxEntries;
  }

  append(entry) {
    const batched = entries => {
      entries.unshift(sanitize({
        id: `dij-${Date.now()}`,
        timestamp: new Date().toISOString(),
        ...entry
      }));
      return entries.slice(0, this.maxEntries);
    };
    writeFile(batched(readFile()));
  }

  getEntries() {
    return readFile();
  }

  getRecent(limit = 10) {
    return readFile().slice(0, limit);
  }

  /**
   * Attaches an artifact reference to the most recent DEVICE_* entry that
   * does not already carry one. Best-effort: does nothing if none found.
   */
  attachReference(artifactId, { typePrefix = 'DEVICE_' } = {}) {
    const entries = readFile();
    const target = entries.find(e => (e.type || '').startsWith(typePrefix) && !e.artifactReference);
    if (!target) return { attached: false };
    target.artifactReference = artifactId;
    writeFile(entries);
    return { attached: true, id: target.id };
  }

  clear() {
    writeFile([]);
    return { cleared: true };
  }
}

export const deviceIntelligenceJournalInstance = new DeviceIntelligenceJournal();
export default deviceIntelligenceJournalInstance;