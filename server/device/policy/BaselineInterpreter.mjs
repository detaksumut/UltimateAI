/**
 * BaselineInterpreter.mjs
 * FASE 1A (D) — Non-destructive baseline system intelligence.
 *
 * JIN compares CURRENT metrics against a locally-captured BASELINE and only
 * then classifies:
 *   NORMAL | ABOVE_BASELINE | ANOMALY_SUSPECTED | UNKNOWN (no comparator yet)
 *
 * Anomaly is NEVER claimed without a comparator: if there is no baseline and
 * not enough history samples, the result is UNKNOWN with `limited: true`.
 * Purely additive, bounded, LOCAL ONLY.
 */

import fs from 'fs';
import path from 'path';

import { memoryTrendAnalyzerInstance } from '../memory/MemoryTrendAnalyzer.mjs';

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const BASELINE_FILE = path.join(DATA_DIR, 'device_baseline.json');
const REQUIRED_SAMPLES = 3;

function readBaseline() {
  try {
    if (!fs.existsSync(BASELINE_FILE)) return null;
    const parsed = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeBaseline(baseline) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2), 'utf8');
  } catch {}
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

export class BaselineInterpreter {
  constructor({ requiredSamples = REQUIRED_SAMPLES } = {}) {
    this.requiredSamples = requiredSamples;
    this.baseline = readBaseline();
  }

  /**
   * Captures a baseline from available RAM history (non-destructive).
   * Only captures when enough samples exist. Returns the baseline or null.
   */
  capture() {
    const history = memoryTrendAnalyzerInstance.getHistory();
    if (history.length < this.requiredSamples) return null;
    const ramPcts = history.map(h => h.percentUsed).filter(v => v !== undefined && v !== null);
    if (!ramPcts.length) return null;
    const sorted = ramPcts.slice().sort((a, b) => a - b);
    const baseline = {
      capturedAt: new Date().toISOString(),
      samples: history.length,
      norm: {
        ramPercentAvg: Math.round(percentile(sorted, 0.5) * 10) / 10,
        ramPercentP90: Math.round(percentile(sorted, 0.9) * 10) / 10,
        ramPercentMax: Math.round(Math.max(...sorted) * 10) / 10
      }
    };
    this.baseline = baseline;
    writeBaseline(baseline);
    return baseline;
  }

  getBaseline() {
    return this.baseline;
  }

  /** Ensures a baseline exists when enough history has accumulated. */
  ensureBaseline({ force = false } = {}) {
    if (force || !this.baseline) {
      return this.capture();
    }
    // Refresh when history has grown meaningfully since capture.
    const history = memoryTrendAnalyzerInstance.getHistory();
    if (history.length >= this.baseline.samples + 5) {
      return this.capture();
    }
    return this.baseline;
  }

  /**
   * Classifies current metrics against the stored baseline.
   * @param {Object} current - { memoryPercent, topMemoryMB, processCount, runtimeActive, driveMaxPercent }
   * @returns {{ status, limited, deltas, thresholds, baselineSamples }}
   */
  evaluate(current = {}) {
    const baseline = this.ensureBaseline();
    const deltas = {};
    const thresholds = {};

    if (!baseline) {
      const limit = memoryTrendAnalyzerInstance.getHistory().length;
      return {
        status: 'UNKNOWN',
        limited: true,
        reason: 'Belum ada baseline pembanding (sampel tidak mencukupi).',
        baselineSamples: limit,
        requiredSamples: this.requiredSamples,
        deltas,
        thresholds
      };
    }

    const ramDeltaPct = current.memoryPercent != null
      ? Math.round((current.memoryPercent - baseline.norm.ramPercentAvg) * 10) / 10
      : null;
    deltas.ramPercentAboveAvg = ramDeltaPct;
    thresholds.ramFallbackMax = 90;

    let status = 'NORMAL';
    const reasons = [];

    if (baseline.norm.ramPercentAvg != null && ramDeltaPct != null) {
      if (ramDeltaPct >= 25) {
        status = 'ANOMALY_SUSPECTED';
        reasons.push(`RAM ${current.memoryPercent}% jauh di atas baseline ${baseline.norm.ramPercentAvg}% (delta +${ramDeltaPct}%).`);
      } else if (ramDeltaPct >= 10) {
        status = 'ABOVE_BASELINE';
        reasons.push(`RAM ${current.memoryPercent}% di atas baseline ${baseline.norm.ramPercentAvg}% (delta +${ramDeltaPct}%).`);
      }
    } else if (current.memoryPercent != null && current.memoryPercent >= thresholds.ramFallbackMax) {
      // Fallback only when baseline unavailable: hard ceiling claim, marked clearly.
      status = 'ABOVE_BASELINE';
      reasons.push(`Peringatan keras hanya berbasis ambang (${current.memoryPercent}% >= ${thresholds.ramFallbackMax}%), tanpa baseline penuh.`);
    }

    return {
      status,
      limited: status === 'ABOVE_BASELINE' && baseline.samples < this.requiredSamples * 2,
      reason: reasons.join(' ') || 'Pengamatan sesuai baseline.',
      baselineSamples: baseline.samples,
      requiredSamples: this.requiredSamples,
      deltas,
      thresholds
    };
  }
}

export const baselineInterpreterInstance = new BaselineInterpreter();
export default baselineInterpreterInstance;