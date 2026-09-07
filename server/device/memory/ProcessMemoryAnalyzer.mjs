/**
 * ProcessMemoryAnalyzer.mjs
 * Sorts running processes by RAM, groups Node/browser/UltimateAI families,
 * and separates "known" vs "unknown" processes. Read-only; never signals.
 */

export class ProcessMemoryAnalyzer {
  analyze(processList) {
    const list = processList || [];
    const node = list.filter(p => p.isNode);
    const browser = list.filter(p => p.isBrowser);
    const ultimateAI = list.filter(p => p.isUltimateAI);

    const sum = procs => Math.round(procs.reduce((acc, p) => acc + (p.wsMB || 0), 0) * 10) / 10;

    return {
      totalProcesses: list.length,
      totalMemoryMB: sum(list),
      nodeProcesses: node.length,
      nodeMemoryMB: sum(node),
      browserProcesses: browser.length,
      browserMemoryMB: sum(browser),
      ultimateAIProcesses: ultimateAI.length,
      ultimateAIMemoryMB: sum(ultimateAI),
      knownCount: list.filter(p => p.isKnown).length,
      unknownCount: list.filter(p => !p.isKnown).length,
      topByMemory: [...list].sort((a, b) => (b.wsMB || 0) - (a.wsMB || 0)).slice(0, 15).map(p => ({
        pid: p.pid,
        name: p.name,
        wsMB: p.wsMB,
        cpuSec: p.cpuSec,
        isNode: Boolean(p.isNode),
        isBrowser: Boolean(p.isBrowser),
        isUltimateAI: Boolean(p.isUltimateAI),
        isKnown: Boolean(p.isKnown)
      }))
    };
  }
}

export const processMemoryAnalyzerInstance = new ProcessMemoryAnalyzer();
export default processMemoryAnalyzerInstance;