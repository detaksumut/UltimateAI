/**
 * DeviceMonitorTool.mjs
 * Real-time system monitoring: RAM, CPU, Disk, Network.
 * READ-only — no destructive actions.
 */

import { ToolContract, PERMISSION_LEVELS } from './ToolContract.mjs';
import os from 'os';
import { execSync } from 'child_process';
import { processInspectorInstance } from '../device/system/ProcessInspector.mjs';
import { systemSnapshotCollectorInstance } from '../device/system/SystemSnapshotCollector.mjs';

const MB = 1024 * 1024;
const GB = 1024 * MB;

export class DeviceMonitorTool extends ToolContract {
  constructor() {
    super({
      name: 'device.monitor',
      version: '1.0.0',
      description: 'Monitor system resources in real-time: RAM usage, CPU load, disk space, running processes. Read-only.',
      inputSchema: { scope: 'string' },
      outputSchema: { scope: 'string', data: 'object' },
      permissionLevel: PERMISSION_LEVELS.READ_ONLY,
      timeoutMs: 10000,
      maxRetries: 1
    });
  }

  async execute(params = {}, signal = null) {
    const scope = params?.scope || 'all';

    switch (scope) {
      case 'ram': return this._getRamInfo();
      case 'cpu': return this._getCpuInfo();
      case 'disk': return this._getDiskInfo();
      case 'network': return this._getNetworkInfo();
      case 'processes': return this._getProcessInfo();
      case 'all':
      default: return this._getAll();
    }
  }

  _getRamInfo() {
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const usedBytes = totalBytes - freeBytes;
    const usagePercent = ((usedBytes / totalBytes) * 100).toFixed(1);

    return {
      scope: 'ram',
      totalGB: (totalBytes / GB).toFixed(2),
      usedGB: (usedBytes / GB).toFixed(2),
      freeGB: (freeBytes / GB).toFixed(2),
      usagePercent: parseFloat(usagePercent),
      totalBytes,
      usedBytes,
      freeBytes,
      status: usagePercent > 90 ? 'critical' : usagePercent > 75 ? 'warning' : 'healthy',
      recommendation: usagePercent > 90
        ? 'RAM sangat tinggi! Pertimbangkan tutup aplikasi boros.'
        : usagePercent > 75
          ? 'RAM mulai tinggi. Perhatikan aplikasi yang menggunakan banyak memori.'
          : 'RAM dalam kondisi baik.'
    };
  }

  async _getCpuInfo() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    const cpuCount = cpus.length;
    const model = cpus[0]?.model || 'Unknown';
    const speed = cpus[0]?.speed || 0;

    // Two-sample CPU measurement
    const sample1 = cpus.map(c => ({ user: c.times.user, nice: c.times.nice, sys: c.times.sys, idle: c.times.idle, irq: c.times.irq }));
    await new Promise(r => setTimeout(r, 200));
    const sample2 = cpus.map(c => ({ user: c.times.user, nice: c.times.nice, sys: c.times.sys, idle: c.times.idle, irq: c.times.irq }));

    const usagePerCore = sample1.map((s1, i) => {
      const s2 = sample2[i];
      const total = (s2.user - s1.user) + (s2.nice - s1.nice) + (s2.sys - s1.sys) + (s2.idle - s1.idle) + (s2.irq - s1.irq);
      const active = total - (s2.idle - s1.idle);
      return total > 0 ? ((active / total) * 100).toFixed(1) : '0.0';
    });

    const avgUsage = (usagePerCore.reduce((a, b) => a + parseFloat(b), 0) / cpuCount).toFixed(1);

    return {
      scope: 'cpu',
      model,
      speedMHz: speed,
      coreCount,
      loadAvg: { '1m': loadAvg[0].toFixed(2), '5m': loadAvg[1].toFixed(2), '15m': loadAvg[2].toFixed(2) },
      usagePercent: parseFloat(avgUsage),
      perCore: usagePerCore.map((u, i) => ({ core: i, usage: parseFloat(u) })),
      status: avgUsage > 90 ? 'critical' : avgUsage > 70 ? 'warning' : 'healthy'
    };
  }

  _getDiskInfo() {
    try {
      const raw = execSync('wmic logicaldisk get DeviceID,Size,FreeSpace,FileSystem /format:csv', {
        encoding: 'utf-8',
        timeout: 5000
      });
      const lines = raw.trim().split('\n').filter(l => l.includes(','));
      const disks = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].trim().split(',');
        if (parts.length >= 4) {
          const id = parts[1];
          const free = parseInt(parts[2]) || 0;
          const total = parseInt(parts[3]) || 0;
          const fs = parts[4] || '';
          if (total > 0) {
            disks.push({
              device: id,
              filesystem: fs,
              totalGB: (total / GB).toFixed(2),
              freeGB: (free / GB).toFixed(2),
              usedGB: ((total - free) / GB).toFixed(2),
              usagePercent: parseFloat((((total - free) / total) * 100).toFixed(1))
            });
          }
        }
      }
      return {
        scope: 'disk',
        disks,
        status: disks.some(d => d.usagePercent > 95) ? 'critical' : disks.some(d => d.usagePercent > 85) ? 'warning' : 'healthy'
      };
    } catch {
      return { scope: 'disk', disks: [], status: 'unknown', error: 'Failed to read disk info' };
    }
  }

  _getNetworkInfo() {
    try {
      const interfaces = os.networkInterfaces();
      const active = [];
      for (const [name, addrs] of Object.entries(interfaces)) {
        for (const addr of addrs) {
          if (!addr.internal && addr.family === 'IPv4') {
            active.push({ interface: name, address: addr.address, netmask: addr.netmask });
          }
        }
      }
      return { scope: 'network', interfaces: active, status: active.length > 0 ? 'connected' : 'disconnected' };
    } catch {
      return { scope: 'network', interfaces: [], status: 'unknown' };
    }
  }

  async _getProcessInfo() {
    try {
      const processList = await processInspectorInstance.getProcessList();
      const topByMemory = processList
        .sort((a, b) => b.wsMB - a.wsMB)
        .slice(0, 15)
        .map(p => ({
          pid: p.pid,
          name: p.name,
          wsMB: p.wsMB,
          cpuSec: p.cpuSec,
          kind: p.isNode ? 'node' : p.isBrowser ? 'browser' : 'other'
        }));

      const totalProcessMemory = processList.reduce((sum, p) => sum + (p.wsMB || 0), 0);

      return {
        scope: 'processes',
        total: processList.length,
        totalMemoryMB: totalProcessMemory.toFixed(0),
        topByMemory,
        nodeProcesses: processList.filter(p => p.isNode).length,
        browserProcesses: processList.filter(p => p.isBrowser).length
      };
    } catch {
      return { scope: 'processes', total: 0, topByMemory: [], error: 'Failed to list processes' };
    }
  }

  async _getAll() {
    const [ram, cpu, disk, network, processes] = await Promise.all([
      this._getRamInfo(),
      this._getCpuInfo(),
      this._getDiskInfo(),
      this._getNetworkInfo(),
      this._getProcessInfo()
    ]);

    return {
      scope: 'all',
      timestamp: new Date().toISOString(),
      ram,
      cpu,
      disk,
      network,
      processes,
      overallStatus: [ram.status, cpu.status, disk.status].includes('critical')
        ? 'critical'
        : [ram.status, cpu.status, disk.status].includes('warning')
          ? 'warning'
          : 'healthy'
    };
  }
}

export const deviceMonitorToolInstance = new DeviceMonitorTool();
export default deviceMonitorToolInstance;
