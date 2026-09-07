/**
 * RAMOptimizerTool.mjs
 * Detect memory-hogging processes, recommend safe closures, stop processes with permission.
 * Safety: checks SafetyLayer before any destructive action.
 */

import { ToolContract, PERMISSION_LEVELS } from './ToolContract.mjs';
import { safetyLayerInstance } from '../device/policy/SafetyLayer.mjs';
import { processInspectorInstance } from '../device/system/ProcessInspector.mjs';
import os from 'os';
import { execSync } from 'child_process';

const MB = 1024 * 1024;
const GB = 1024 * MB;

/** Known memory-intensive apps that are generally safe to close. */
const KNOWN_SAFE_TO_CLOSE = [
  { names: ['chrome', 'msedge', 'firefox', 'opera', 'brave'], label: 'Browser', risk: 'low' },
  { names: ['code', 'code.exe'], label: 'VS Code', risk: 'low' },
  { names: ['slack', 'discord', 'telegram', 'whatsapp'], label: 'Messaging', risk: 'low' },
  { names: ['spotify', 'vlc', 'potplayer'], label: 'Media Player', risk: 'low' },
  { names: ['explorer'], label: 'File Explorer', risk: 'medium' },
  { names: ['photoshop', 'illustrator', 'figma'], label: 'Creative App', risk: 'medium' },
  { names: ['outlook', 'thunderbird'], label: 'Email Client', risk: 'low' }
];

export class RAMOptimizerTool extends ToolContract {
  constructor() {
    super({
      name: 'device.ram_optimizer',
      version: '1.0.0',
      description: 'Analyze RAM usage, detect memory hogs, recommend safe process closures, stop processes with safety checks.',
      inputSchema: { action: 'string', target: 'string' },
      outputSchema: { action: 'string', result: 'object' },
      permissionLevel: PERMISSION_LEVELS.READ_ONLY,
      timeoutMs: 15000,
      maxRetries: 1
    });
  }

  async execute(params = {}, signal = null) {
    const action = params?.action || 'analyze';

    switch (action) {
      case 'analyze': return this._analyze();
      case 'recommend': return this._recommend();
      case 'stop_process': return this._stopProcess(params.pid, params.processName);
      case 'mode': return this._setMode(params.mode);
      default: return this._analyze();
    }
  }

  /** Full RAM analysis with top consumers and recommendations. */
  async _analyze() {
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const usedBytes = totalBytes - freeBytes;
    const usagePercent = ((usedBytes / totalBytes) * 100).toFixed(1);

    const processList = await processInspectorInstance.getProcessList().catch(() => []);
    const sorted = processList.sort((a, b) => b.wsMB - a.wsMB);
    const top10 = sorted.slice(0, 10);

    // Classify processes
    const classified = top10.map(p => {
      const classification = this._classifyProcess(p.name);
      return {
        pid: p.pid,
        name: p.name,
        wsMB: p.wsMB,
        wsFormatted: p.wsMB > 1024 ? `${(p.wsMB / 1024).toFixed(1)} GB` : `${p.wsMB} MB`,
        cpuSec: p.cpuSec,
        kind: p.isNode ? 'node' : p.isBrowser ? 'browser' : 'other',
        category: classification.category,
        canClose: classification.canClose,
        riskLevel: classification.risk
      };
    });

    // Calculate reclaimable memory
    const reclaimable = classified
      .filter(p => p.canClose && p.riskLevel === 'low')
      .reduce((sum, p) => sum + p.wsMB, 0);

    const totalProcessMemory = processList.reduce((sum, p) => sum + (p.wsMB || 0), 0);

    return {
      action: 'analyze',
      timestamp: new Date().toISOString(),
      ram: {
        totalGB: (totalBytes / GB).toFixed(2),
        usedGB: (usedBytes / GB).toFixed(2),
        freeGB: (freeBytes / GB).toFixed(2),
        usagePercent: parseFloat(usagePercent),
        status: usagePercent > 90 ? 'critical' : usagePercent > 75 ? 'warning' : 'healthy'
      },
      processes: {
        total: processList.length,
        totalMemoryMB: totalProcessMemory.toFixed(0),
        topConsumers: classified,
        reclaimableMB: reclaimable.toFixed(0),
        reclaimableFormatted: reclaimable > 1024 ? `${(reclaimable / 1024).toFixed(1)} GB` : `${reclaimable} MB`
      },
      recommendation: this._generateRecommendation(parseFloat(usagePercent), classified, reclaimable)
    };
  }

  /** Generate actionable recommendations. */
  _recommend() {
    return this._analyze().then(analysis => ({
      ...analysis,
      action: 'recommend',
      suggestions: analysis.processes.topConsumers
        .filter(p => p.canClose)
        .map(p => ({
          pid: p.pid,
          name: p.name,
          category: p.category,
          saves: p.wsFormatted,
          risk: p.riskLevel,
          message: p.riskLevel === 'low'
            ? `✓ Aman ditutup — ${p.category} (${p.wsFormatted})`
            : `⚠ Perlu konfirmasi — ${p.category} (${p.wsFormatted})`
        }))
    }));
  }

  /** Stop a process by PID with safety checks. */
  async _stopProcess(pid, processName) {
    if (!pid && !processName) {
      return { action: 'stop_process', success: false, error: 'PID atau nama proses diperlukan' };
    }

    // Safety check
    const check = safetyLayerInstance.guard('stop_process', { processName: processName || '' });
    if (!check.allowed) {
      return {
        action: 'stop_process',
        success: false,
        error: check.reason,
        needsConfirmation: check.needsConfirmation
      };
    }

    try {
      // Get process info first
      const processList = await processInspectorInstance.getProcessList().catch(() => []);
      const target = processList.find(p => p.pid === parseInt(pid));
      if (!target) {
        return { action: 'stop_process', success: false, error: `Proses PID ${pid} tidak ditemukan` };
      }

      // Additional safety: don't stop critical processes
      if (target.isNode && target.name.includes('ollama')) {
        return { action: 'stop_process', success: false, error: 'Tidak bisa menghentikan Ollama' };
      }

      // Execute stop
      execSync(`taskkill /PID ${pid} /F`, { encoding: 'utf-8', timeout: 5000 });
      safetyLayerInstance._audit('PROCESS_STOPPED', { pid, name: target.name, wsMB: target.wsMB });

      return {
        action: 'stop_process',
        success: true,
        stopped: { pid: target.pid, name: target.name, wsMB: target.wsMB },
        freedMemory: `${target.wsMB} MB`
      };
    } catch (err) {
      return { action: 'stop_process', success: false, error: err.message };
    }
  }

  /** Set optimization mode. */
  _setMode(mode) {
    const modes = {
      normal: { tier: 'SUGGEST', description: 'Hanya memantau dan memberi saran' },
      optimize: { tier: 'EXECUTE_SAFE', description: 'Optimasi ringan yang aman (clean temp/cache)' },
      aggressive: { tier: 'EXECUTE_RISKY', description: 'Tutup proses dan bersihkan resource (perlu konfirmasi)' }
    };

    const selected = modes[mode];
    if (!selected) {
      return { action: 'mode', success: false, error: `Mode tidak dikenal: ${mode}. Pilih: normal, optimize, aggressive` };
    }

    safetyLayerInstance.setTier(selected.tier);
    return {
      action: 'mode',
      success: true,
      mode,
      description: selected.description,
      tier: selected.tier
    };
  }

  _classifyProcess(name) {
    const lower = (name || '').toLowerCase();
    for (const { names, label, risk } of KNOWN_SAFE_TO_CLOSE) {
      if (names.some(n => lower.includes(n))) {
        return { category: label, canClose: true, risk };
      }
    }
    // Unknown processes: don't auto-close
    return { category: 'Other', canClose: false, risk: 'unknown' };
  }

  _generateRecommendation(usagePercent, classified, reclaimableMB) {
    if (usagePercent > 90) {
      const safeClosable = classified.filter(p => p.canClose && p.riskLevel === 'low');
      if (safeClosable.length > 0) {
        const names = safeClosable.map(p => `${p.name} (${p.wsFormatted})`).join(', ');
        return `🔴 RAM kritis (${usagePercent}%). Tutup aplikasi ini untuk membebaskan ${reclaimableMB > 1024 ? (reclaimableMB / 1024).toFixed(1) + ' GB' : reclaimableMB + ' MB'}: ${names}`;
      }
      return `🔴 RAM kritis (${usagePercent}%). Tidak ada aplikasi aman untuk ditutup secara otomatis.`;
    }
    if (usagePercent > 75) {
      return `🟡 RAM cukup tinggi (${usagePercent}%). Pertimbangkan tutup browser atau aplikasi yang tidak aktif.`;
    }
    return `🟢 RAM sehat (${usagePercent}%). Tidak perlu optimasi saat ini.`;
  }
}

export const ramOptimizerToolInstance = new RAMOptimizerTool();
export default ramOptimizerToolInstance;
