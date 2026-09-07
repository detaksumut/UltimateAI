/**
 * SystemSnapshotCollector.mjs
 * Stable, single-shot snapshot of the local machine: system identity, CPU,
 * memory, disks, process summary, and listening ports. Never throws.
 * LOCAL ONLY.
 */

import fs from 'fs';
import { getCpuUsage, getMemoryInfo, getPlatformInfo, runPowershell } from '../platform/PlatformProbe.mjs';

const MB = 1024 * 1024;

function formatDisk(raw) {
  const totalBytes = Number(raw.TotalBytes) || 0;
  const freeBytes = Number(raw.FreeBytes) || 0;
  const usedBytes = Number(raw.UsedBytes) ?? Math.max(totalBytes - freeBytes, 0);
  return {
    drive: String(raw.Drive || '').replace(/^.*\\([A-Za-z]):.*$/, '$1').toUpperCase(),
    totalBytes,
    freeBytes,
    usedBytes,
    percentUsed: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0
  };
}

export class SystemSnapshotCollector {
  async getPlatformInfo() {
    return getPlatformInfo();
  }

  async getCpuUsage() {
    return getCpuUsage();
  }

  async getMemoryInfo() {
    return getMemoryInfo();
  }

  asSeconds(bytes) {
    return Math.round(bytes / MB);
  }

  async getDisks() {
    const errors = [];
    let disks = [];

    if (process.platform === 'win32') {
      const data = await runPowershell(
        `Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue | ` +
        `ForEach-Object { ` +
        `  try { [pscustomobject]@{ Drive = $_.Name; TotalBytes = [decimal]$_.Used + [decimal]$_.Free; FreeBytes = [decimal]$_.Free } } ` +
        `  catch { $null } } | ConvertTo-Json -Compress`
      );
      if (Array.isArray(data)) {
        disks = data.map(formatDisk).filter(d => d.drive && d.totalBytes > 0);
      }
      if (!disks.length) {
        errors.push('PowerShell drive probe tidak mengembalikan data; mencoba fallback statfs.');
      }
    }

    if (!disks.length) {
      if (process.platform === 'win32') {
        for (let code = 67; code <= 90; code++) { // C..Z
          const letter = String.fromCharCode(code);
          const root = `${letter}:/`;
          try {
            const st = fs.statfsSync(root);
            if (st && st.blocks > 0) {
              const totalBytes = st.bsize * st.blocks;
              const freeBytes = st.bsize * st.bfree;
              disks.push({
                drive: letter,
                totalBytes,
                freeBytes,
                usedBytes: Math.max(totalBytes - freeBytes, 0),
                percentUsed: totalBytes > 0 ? Math.round(100 - (freeBytes / totalBytes) * 100) : 0
              });
            }
          } catch {}
        }
      } else {
        try {
          const st = fs.statfsSync('/');
          const totalBytes = st.bsize * st.blocks;
          const freeBytes = st.bsize * st.bfree;
          disks.push({
            drive: '/',
            totalBytes,
            freeBytes,
            usedBytes: Math.max(totalBytes - freeBytes, 0),
            percentUsed: totalBytes > 0 ? Math.round(100 - (freeBytes / totalBytes) * 100) : 0
          });
        } catch {}
      }
    }

    return { disks, errors };
  }

  /**
   * Full stable snapshot used by the Device Intelligence runtime.
   * @param {Object} [processData] optional pre-fetched { list, summary }
   */
  async getSystemSnapshot(processData = null) {
    const errors = [];
    const [platform, cpu, memory, diskInfo] = await Promise.all([
      this.getPlatformInfo().catch(e => (errors.push(e.message), {})),
      this.getCpuUsage().catch(e => (errors.push(e.message), {})),
      this.getMemoryInfo(),
      this.getDisks()
    ]);
    errors.push(...(diskInfo.errors || []));

    const procs = processData?.list || [];
    const summary = processData?.summary || null;

    return {
      timestamp: new Date().toISOString(),
      system: platform,
      cpu,
      memory,
      disks: diskInfo.disks,
      processesSummary: summary || {
        total: procs.length,
        topByMemory: procs.slice(0, 10)
      },
      processCount: procs.length || null,
      errors
    };
  }
}

export const systemSnapshotCollectorInstance = new SystemSnapshotCollector();
export default systemSnapshotCollectorInstance;