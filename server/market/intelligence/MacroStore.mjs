/**
 * MacroStore.mjs — MIE v1 Tahap 1
 * Honest manual macro store: PCE / NFP / Fed prob / Foreign flow.
 * NO fake live. Status is always MANUAL_SNAPSHOT with source link + updatedAt.
 * Persisted to server/market/intelligence/macro.snapshot.json (git-ignored content
 * is fine; file auto-creates with empty template).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const SNAPSHOT_PATH = path.join(__dirname, 'macro.snapshot.json');

const TEMPLATE = {
  updatedAt: null,
  updatedBy: 'manual',
  pce: { label: 'PCE YoY', actual: null, forecast: null, previous: null, period: '', source: '', sourceUrl: '' },
  nfp: { label: 'NFP (ribu)', actual: null, forecast: null, previous: null, period: '', source: '', sourceUrl: '' },
  fedProb: { label: 'Probabilitas kenaikan Fed', value: null, period: '', source: '', sourceUrl: '' },
  foreignFlow: { label: 'Foreign flow IHSG', direction: 'UNKNOWN', valueRpMiliar: null, period: '', source: '', sourceUrl: '' }
};

export function loadMacroSnapshot() {
  try {
    if (!fs.existsSync(SNAPSHOT_PATH)) return { ...TEMPLATE, updatedAt: null };
    const raw = fs.readFileSync(SNAPSHOT_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...TEMPLATE, ...parsed };
  } catch {
    return { ...TEMPLATE, updatedAt: null };
  }
}

export function saveMacroSnapshot(patch) {
  const cur = loadMacroSnapshot();
  const next = {
    ...cur,
    ...(patch || {}),
    pce: { ...cur.pce, ...((patch || {}).pce || {}) },
    nfp: { ...cur.nfp, ...((patch || {}).nfp || {}) },
    fedProb: { ...cur.fedProb, ...((patch || {}).fedProb || {}) },
    foreignFlow: { ...cur.foreignFlow, ...((patch || {}).foreignFlow || {}) },
    updatedAt: new Date().toISOString(),
    updatedBy: 'manual'
  };
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(next, null, 2));
  return next;
}

export function macroImpact(snapshot) {
  const items = [];
  const push = (factor, actual, forecast, sourceUrl) => {
    if (actual == null || forecast == null) {
      items.push({ factor, impact: 'UNKNOWN', strength: 0, confidence: 0.3, dataStatus: 'UNAVAILABLE', sourceUrl: sourceUrl || null });
      return;
    }
    const dovish = Number(actual) < Number(forecast);
    items.push({
      factor,
      impact: dovish ? 'POSITIVE' : 'NEGATIVE',
      strength: dovish ? 0.7 : 0.6,
      confidence: 0.65,
      dataStatus: 'MANUAL_SNAPSHOT',
      actual, forecast,
      sourceUrl: sourceUrl || null
    });
  };
  push('PCE', snapshot?.pce?.actual, snapshot?.pce?.forecast, snapshot?.pce?.sourceUrl);
  push('NFP', snapshot?.nfp?.actual, snapshot?.nfp?.forecast, snapshot?.nfp?.sourceUrl);
  return items;
}

export default { loadMacroSnapshot, saveMacroSnapshot, macroImpact, SNAPSHOT_PATH };
