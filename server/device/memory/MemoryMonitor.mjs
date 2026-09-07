/**
 * MemoryMonitor.mjs
 * Reads current system memory: total / used / free / percent / timestamp.
 * LOCAL ONLY, never throws.
 */

import { getMemoryInfo, getCpuUsage } from '../platform/PlatformProbe.mjs';

export class MemoryMonitor {
  async getMemorySnapshot() {
    const memory = getMemoryInfo();
    const cpu = await getCpuUsage(300).catch(() => ({ loadPercent: null }));
    return {
      timestamp: new Date().toISOString(),
      totalBytes: memory.totalBytes,
      usedBytes: memory.usedBytes,
      freeBytes: memory.freeBytes,
      percentUsed: memory.percentUsed,
      percentFree: Math.max(100 - memory.percentUsed, 0),
      cpuLoadPercent: cpu.loadPercent ?? null
    };
  }
}

export const memoryMonitorInstance = new MemoryMonitor();
export default memoryMonitorInstance;