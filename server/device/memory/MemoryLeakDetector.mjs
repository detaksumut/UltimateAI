/**
 * MemoryLeakDetector.mjs
 * Multi-sample heuristic for memory growth. NEVER claims a leak from a
 * single snapshot. Output statuses are intentionally conservative:
 *   NORMAL → WATCH → SUSPECTED   (never "CONFIRMED" in this phase)
 */

const MB = 1024 * 1024;

function linearSlopeMBPerSample(values) {
  if (values.length < 2) return 0;
  const n = values.length;
  const xs = values.map((_, i) => i);
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (values[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export class MemoryLeakDetector {
  /**
   * @param {Array} history - from MemoryTrendAnalyzer.getHistory()
   * @returns {{ status:'NORMAL'|'WATCH'|'SUSPECTED', focus:string, evidence:Array<string>, samplesUsed:number }}
   */
  evaluate(history) {
    const samples = (history || []).slice();
    const evidence = [];

    if (samples.length < 3) {
      return {
        status: 'NORMAL',
        focus: 'SYSTEM',
        evidence: ['Data sampel belum cukup (minimal 3 pengamatan untuk menarik kesimpulan).'],
        samplesUsed: samples.length
      };
    }

    // System-level trend
    const overlap = samples.filter(s => s.timestamp && s.usedBytes != null);
    const sysSequence = overlap.map(s => Math.round((s.usedBytes / MB)));
    const sysSlopeMB = linearSlopeMBPerSample(sysSequence);
    let increases = 0;
    for (let i = 0; i < sysSequence.length - 1; i++) {
      if (sysSequence[i + 1] - sysSequence[i] > 0) increases++;
    }
    const strictlyRising = increases === sysSequence.length - 1;
    const totalGrowthMB = sysSequence[sysSequence.length - 1] - sysSequence[0];

    let systemStatus = 'NORMAL';
    if (strictlyRising && sysSlopeMB >= 25 && totalGrowthMB >= 200) {
      systemStatus = 'SUSPECTED';
      evidence.push(`Penggunaan RAM sistem naik konsisten tiap sampel (~${Math.round(sysSlopeMB)} MB/sampel, total +${totalGrowthMB} MB).`);
    } else if (sysSlopeMB >= 15 || (strictlyRising && totalGrowthMB >= 96)) {
      systemStatus = 'WATCH';
      evidence.push(`Penggunaan RAM sistem menunjukkan tren naik (+${Math.round(totalGrowthMB)} MB, slope ${Math.round(sysSlopeMB)} MB/sampel).`);
    } else {
      evidence.push('Penggunaan RAM sistem relatif stabil pada jendela pengamatan.');
    }

    // Per-process tracking across samples for Node-family processes
    const procByName = new Map();
    for (const s of samples) {
      const seen = new Set();
      for (const p of s.topNodeProcesses || []) {
        const key = `${p.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!procByName.has(key)) procByName.set(key, []);
        procByName.get(key).push({ ts: s.timestamp, wsMB: Number(p.wsMB) || 0 });
      }
    }

    const processSuspicions = [];
    for (const [name, series] of procByName.entries()) {
      if (series.length < 3) continue;
      const seq = series.slice().reverse().map(x => x.wsMB);
      const slope = linearSlopeMBPerSample(seq);
      const diff = seq[seq.length - 1] - seq[0];
      let grew = 0;
      for (let i = 0; i < seq.length - 1; i++) if (seq[i + 1] - seq[i] > 0) grew++;
      if (grew === seq.length - 1 && slope >= 20 && diff >= 120) {
        processSuspicions.push({ name, status: 'SUSPECTED', slopeMB: Math.round(slope), growthMB: Math.round(diff) });
      } else if (diff >= 64) {
        processSuspicions.push({ name, status: 'WATCH', slopeMB: Math.round(slope), growthMB: Math.round(diff) });
      }
    }

    let focus = 'SYSTEM';
    let status = systemStatus;
    const worstProc = processSuspicions.find(p => p.status === 'SUSPECTED');
    if (worstProc) {
      status = 'SUSPECTED';
      focus = `PROCESS:${worstProc.name}`;
      evidence.push(`Process ${worstProc.name} tumbuh konsisten (+${worstProc.growthMB} MB, slope ~${worstProc.slopeMB} MB/sampel).`);
    } else if (processSuspicions.length && status === 'NORMAL') {
      status = 'WATCH';
      focus = `PROCESS:${processSuspicions[0].name}`;
      evidence.push(`Process ${processSuspicions[0].name} menunjukkan pertumbuhan (+${processSuspicions[0].growthMB} MB).`);
    }

    return { status, focus, evidence, samplesUsed: samples.length, processSuspicions, systemSlopeMB: Math.round(sysSlopeMB), systemGrowthMB: Math.round(totalGrowthMB) };
  }
}

export const memoryLeakDetectorInstance = new MemoryLeakDetector();
export default memoryLeakDetectorInstance;