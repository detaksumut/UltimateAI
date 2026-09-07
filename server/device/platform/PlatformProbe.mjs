/**
 * PlatformProbe.mjs
 * Thin local-only platform probe layer. Runs PowerShell (Windows) for
 * processes / ports / drives, with graceful in-process fallbacks so the
 * Device Intelligence module never crashes on any OS.
 *
 * LOCAL ONLY: everything stays on this machine. No network egress.
 */

import os from 'os';
import { spawnSync } from 'child_process';

const PS_EXE = process.platform === 'win32' ? 'powershell' : 'pwsh';

/**
 * Runs a PowerShell snippet and parses its JSON output.
 * @param {string} script - body that ends by emitting JSON via ConvertTo-Json
 * @param {number} timeoutMs
 * @returns {Promise<any>} parsed value, or null on any failure
 */
export async function runPowershell(script, timeoutMs = 12000) {
  try {
    const result = spawnSync(PS_EXE, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      encoding: 'utf8',
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024
    });
    if (result.status !== 0) return null;
    const stdout = (result.stdout || '').trim();
    if (!stdout) return null;
    try {
      return JSON.parse(stdout);
    } catch {
      // Some PS versions emit a leading BOM/format marker
      return JSON.parse(stdout.replace(/^\uFEFF/, ''));
    }
  } catch {
    return null;
  }
}

/**
 * Synchronous two-sample CPU load measurement using os.cpus() times.
 * @returns {Promise<{ loadPercent: number|null, cores: number, model: string, sampleIntervalMs: number }>}
 */
export async function getCpuUsage(intervalMs = 400) {
  try {
    const firstSlice = os.cpus();
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    const secondSlice = os.cpus();

    let idleDelta = 0;
    let totalDelta = 0;
    for (let i = 0; i < firstSlice.length; i++) {
      const a = firstSlice[i].times;
      const b = secondSlice[i].times;
      const idleA = a.idle + a.irq;
      const idleB = b.idle + b.irq;
      const totalA = a.user + a.nice + a.sys + a.idle + a.irq;
      const totalB = b.user + b.nice + b.sys + b.idle + b.irq;
      idleDelta += idleB - idleA;
      totalDelta += totalB - totalA;
    }
    const loadPercent = totalDelta > 0 ? Math.round(((totalDelta - idleDelta) / totalDelta) * 100) : 0;
    return {
      loadPercent,
      cores: firstSlice.length,
      model: firstSlice[0]?.model || 'unknown',
      sampleIntervalMs: intervalMs
    };
  } catch {
    return { loadPercent: null, cores: os.cpus().length, model: 'unknown', sampleIntervalMs: 0 };
  }
}

/** In-process memory snapshot (always available). */
export function getMemoryInfo() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = Math.max(totalBytes - freeBytes, 0);
  const percentUsed = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;
  return {
    totalBytes,
    freeBytes,
    usedBytes,
    percentUsed,
    fetch: `process.memoryUsage → ${JSON.stringify(process.memoryUsage())}`
  };
}

/** Platform identity snapshot. */
export function getPlatformInfo() {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    uptimeSec: Math.floor(os.uptime()),
    loadAverage: (() => {
      try {
        return os.loadavg().map(v => Math.round(v * 100) / 100);
      } catch {
        return null;
      }
    })()
  };
}