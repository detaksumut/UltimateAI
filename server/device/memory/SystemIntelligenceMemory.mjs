/**
 * SystemIntelligenceMemory.mjs
 * FASE 1A (C) — Memory Integration adapter.
 * Bounded, categorized, sanitized LOCAL memory for Device Intelligence
 * insights, baselines, significant changes, and actions.
 *
 * Rules:
 *  - Store insights, baselines, significant changes, performed actions.
 *  - NEVER store secrets, tokens, credentials, or sensitive file contents.
 *  - Purely additive. Does NOT touch memory.vault (F: drive vault,
 *    ActiveMemoryCore, MemoryVaultEngine, SQLite index, knowledge graph).
 *  - LOCAL ONLY. No external telemetry.
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const MEMORY_FILE = path.join(DATA_DIR, 'device_system_memory.json');
const MAX_ENTRIES = 60;
const MAX_TEXT_LEN = 500;

export const DEVICE_MEMORY_TYPES = {
  CONVERSATIONAL: 'CONVERSATIONAL', // what the user asked / said about their device
  SYSTEM: 'SYSTEM',                 // observed system metrics / baseline snapshots
  OPERATIONAL: 'OPERATIONAL',       // performed analyze/diagnose activities
  INCIDENT: 'INCIDENT',             // anomalies / suspected problems (NOT confirmed)
  PREFERENCE: 'PREFERENCE'          // user preferences about device handling
};

const SECRET_KEY_PATTERN = /(token|secret|key|password|credential|authorization|bearer|vault|api[_-]?key)/i;
const SECRET_VALUE_PATTERN = /(refresh_token|access_token|api[_-]?key|password|passwd|authorization\s*[:=])/i;

function readFile() {
  try {
    if (!fs.existsSync(MEMORY_FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFile(entries) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(entries.slice(0, MAX_ENTRIES), null, 2), 'utf8');
  } catch {}
}

function cutText(value) {
  if (typeof value !== 'string') return value;
  return value.length > MAX_TEXT_LEN ? value.slice(0, MAX_TEXT_LEN) + '…' : value;
}

/** Scrubs secret-shaped keys and values before persistence. */
function sanitizeEntry(input) {
  const safe = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (SECRET_KEY_PATTERN.test(key)) continue;
    if (typeof value === 'string' && SECRET_VALUE_PATTERN.test(value)) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      safe[key] = sanitizeEntry(value);
    } else {
      safe[key] = cutText(value);
    }
  }
  return safe;
}

export function sanitizeDeviceMemoryEntry(entry) {
  return sanitizeEntry(entry);
}

export class SystemIntelligenceMemory {
  constructor({ maxEntries = MAX_ENTRIES } = {}) {
    this.maxEntries = maxEntries;
  }

  /**
   * Records a memory entry.
   * @param {Object} params
   * @param {'CONVERSATIONAL'|'SYSTEM'|'OPERATIONAL'|'INCIDENT'|'PREFERENCE'} params.type
   * @param {string} params.insight   - short human insight (required)
   * @param {Object} [params.baseline] - baseline snapshot when storing one
   * @param {Object} [params.change]   - significant change descriptor
   * @param {Object} [params.action]   - action performed descriptor
   */
  record({ type = 'OPERATIONAL', insight = '', baseline = null, change = null, action = null, context = {} }) {
    if (!Object.values(DEVICE_MEMORY_TYPES).includes(type)) {
      throw new Error(`Unknown device memory type: ${type}`);
    }
    const entries = readFile();
    entries.unshift(sanitizeEntry({
      id: `dsm-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type,
      insight: cutText(insight),
      baseline,
      change,
      action,
      context,
      source: 'DEVICE_INTELLIGENCE'
    }));
    writeFile(entries);
    return entries[0];
  }

  getMemories({ type = null, limit = 20 } = {}) {
    let entries = readFile();
    if (type) entries = entries.filter(e => e.type === type);
    return entries.slice(0, limit);
  }

  recent(limit = 20) {
    return readFile().slice(0, limit);
  }

  count() {
    return readFile().length;
  }
}

export const systemIntelligenceMemoryInstance = new SystemIntelligenceMemory();
export default systemIntelligenceMemoryInstance;