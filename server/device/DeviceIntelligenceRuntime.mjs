/**
 * DeviceIntelligenceRuntime.mjs
 * JIN Device Intelligence coordinator — OBSERVE + ANALYZE + DIAGNOSE.
 *
 * Aggregates system snapshot, memory intelligence, process intelligence,
 * UltimateAI runtime intelligence, storage intelligence, and produces an
 * honest human-readable diagnosis + recommendations. Writes bounded local
 * journal/history only (no secrets). No destructive actions.
 * LOCAL ONLY.
 */

import { systemSnapshotCollectorInstance } from './system/SystemSnapshotCollector.mjs';
import { processInspectorInstance } from './system/ProcessInspector.mjs';
import { memoryMonitorInstance } from './memory/MemoryMonitor.mjs';
import { processMemoryAnalyzerInstance } from './memory/ProcessMemoryAnalyzer.mjs';
import { memoryTrendAnalyzerInstance } from './memory/MemoryTrendAnalyzer.mjs';
import { memoryLeakDetectorInstance } from './memory/MemoryLeakDetector.mjs';
import { ultimateAIRuntimeInspectorInstance } from './memory/UltimateAIRuntimeInspector.mjs';
import { storageAnalyzerInstance } from './storage/StorageAnalyzer.mjs';
import { junkClassifierInstance } from './storage/JunkClassifier.mjs';
import { cleanupPolicyInstance } from './policy/CleanupPolicy.mjs';
import { devicePolicyInstance, DEVICE_ACTION_LEVELS } from './policy/DevicePolicy.mjs';
import { baselineInterpreterInstance } from './policy/BaselineInterpreter.mjs';
import { deviceIntelligenceJournalInstance } from './journal/DeviceIntelligenceJournal.mjs';
import { systemIntelligenceMemoryInstance } from './memory/SystemIntelligenceMemory.mjs';

const MB = 1024 * 1024;

const DEFAULT_META = {
  userIntent: 'API (LOKAL)',
  action: 'OBSERVE',
  scope: 'overview',
  artifactReference: null,
  riskLevel: 'LOW'
};

/** Builds the confirmation state honestly: only NOT_REQUIRED while OBSERVE_ONLY. */
function confirmationStateFor() {
  return devicePolicyInstance.isAllowed(DEVICE_ACTION_LEVELS.SAFE_ACTION) ? 'PROPOSED' : 'NOT_REQUIRED';
}

export class DeviceIntelligenceRuntime {
  async getSystemSnapshotReport(meta = {}) {
    const processList = await processInspectorInstance.getProcessList().catch(() => []);
    const summary = {
      total: processList.length,
      topByMemory: processList
        .slice()
        .sort((a, b) => b.wsMB - a.wsMB)
        .slice(0, 12)
        .map(p => ({ pid: p.pid, name: p.name, wsMB: p.wsMB, cpuSec: p.cpuSec, kind: p.isNode ? 'node' : p.isBrowser ? 'browser' : 'other' }))
    };
    const snapshot = await systemSnapshotCollectorInstance.getSystemSnapshot({ list: processList, summary });

    // Feed memory trend history
    memoryTrendAnalyzerInstance.push({
      timestamp: snapshot.timestamp,
      totalBytes: snapshot.memory.totalBytes,
      usedBytes: snapshot.memory.usedBytes,
      freeBytes: snapshot.memory.freeBytes,
      percentUsed: snapshot.memory.percentUsed,
      topNodeProcesses: processList.filter(p => p.isNode).map(p => ({ pid: p.pid, name: p.name, wsMB: p.wsMB }))
    });

    if (meta !== null) {
      this._journalAction({ ...DEFAULT_META, ...meta, scope: 'system', action: 'OBSERVE_SYSTEM' }, {
        memoryPercent: snapshot.memory.percentUsed,
        cpuLoadPercent: snapshot.cpu.loadPercent,
        processTotal: snapshot.processesSummary?.total ?? summary.total
      });
    }

    return snapshot;
  }

  async getMemoryReport(meta = {}) {
    const processList = await processInspectorInstance.getProcessList().catch(() => []);
    const current = await memoryMonitorInstance.getMemorySnapshot();
    const ecAnalytic = processMemoryAnalyzerInstance.analyze(processList);
    const history = memoryTrendAnalyzerInstance.getHistory();
    const trend = memoryTrendAnalyzerInstance.getTrendSummary();
    const leak = memoryLeakDetectorInstance.evaluate(history);

    if (meta !== null) {
      this._journalAction({ ...DEFAULT_META, ...meta, scope: 'memory', action: 'ANALYZE_MEMORY' }, {
        percentUsed: current.percentUsed,
        leakStatus: leak.status,
        totalProcesses: ecAnalytic.totalProcesses
      });
    }

    return {
      current,
      analysis: ecAnalytic,
      historySamples: history.length,
      trend,
      leak
    };
  }

  async getProcessReport(meta = {}) {
    const processList = await processInspectorInstance.getProcessList().catch(() => []);
    const analyzed = processMemoryAnalyzerInstance.analyze(processList);

    if (meta !== null) {
      this._journalAction({ ...DEFAULT_META, ...meta, scope: 'process', action: 'ANALYZE_PROCESS' }, {
        totalProcesses: analyzed.totalProcesses,
        totalMB: analyzed.totalMemoryMB,
        topProcess: analyzed.topByMemory[0] ? `${analyzed.topByMemory[0].name} (${analyzed.topByMemory[0].wsMB} MB)` : null
      });
    }

    return {
      totalProcesses: analyzed.totalProcesses,
      memorySummary: {
        totalMB: analyzed.totalMemoryMB,
        nodeMB: analyzed.nodeMemoryMB,
        browserMB: analyzed.browserMemoryMB,
        ultimateAIMB: analyzed.ultimateAIMemoryMB,
        unknownCount: analyzed.unknownCount
      },
      topByMemory: analyzed.topByMemory.slice(0, 15)
    };
  }

  async getStorageReport(meta = {}, { mode = 'FAST', deepRoots = [] } = {}) {
    const { drives, errors } = await storageAnalyzerInstance.getDriveInfo();

    if (mode === 'DEEP') {
      const deep = await storageAnalyzerInstance.deepScan({ roots: deepRoots });
      if (meta !== null) {
        this._journalAction({ ...DEFAULT_META, ...meta, scope: 'storage', action: 'SCAN_STORAGE_DEEP' }, {
          mode: 'DEEP',
          roots: (deepRoots || []).slice(0, 5),
          findings: deep.bigFiles?.length ?? 0
        });
      }
      return { drives, errors, scan: deep, policy: devicePolicyInstance.describe() };
    }

    const fast = await storageAnalyzerInstance.fastScan();
    const classified = junkClassifierInstance.classifyMany(fast.results);
    const summary = junkClassifierInstance.summarize(classified);
    const cleanupPlan = cleanupPolicyInstance.buildPlan(classified);

    if (meta !== null) {
      this._journalAction({ ...DEFAULT_META, ...meta, scope: 'storage', action: 'SCAN_STORAGE_FAST' }, {
        scannedTargets: fast.scannedTargets,
        totalBytes: fast.totalBytes,
        safe: summary.safeCount ?? 0,
        review: summary.reviewCount ?? 0,
        plans: cleanupPlan.plan.length
      });
    }

    return {
      drives,
      errors,
      scan: {
        mode: 'FAST',
        scannedTargets: fast.scannedTargets,
        totalBytes: fast.totalBytes,
        results: classified
      },
      classification: summary,
      cleanupPlan,
      policy: devicePolicyInstance.describe()
    };
  }

  async getUltimateAIRuntimeReport(meta = {}) {
    const report = await ultimateAIRuntimeInspectorInstance.detect();
    if (meta !== null) {
      this._journalAction({ ...DEFAULT_META, ...meta, scope: 'runtime', action: 'OBSERVE_RUNTIME' }, {
        status: report.status,
        servicesDown: (report.services || []).filter(s => s.state === 'DOWN').length,
        duplicates: (report.risks?.duplicates || []).length,
        orphans: (report.risks?.orphans || []).length
      });
    }
    return report;
  }

  async getDeviceSnapshotFull() {
    const [system, memory, storage, runtime, process] = await Promise.all([
      this.getSystemSnapshotReport(null),
      this.getMemoryReport(null),
      this.getStorageReport(null, { mode: 'FAST' }),
      this.getUltimateAIRuntimeReport(null),
      this.getProcessReport(null)
    ]);
    return { system, memory, storage, runtime, process, policy: devicePolicyInstance.describe() };
  }

  /**
   * One-call diagnosis used by JIN natural-language intents (komputer/ram/storage/process).
   * @param {Object} [meta] - { userIntent, action, artifactReference } for the action journal.
   */
  async runDiagnosis(meta = {}) {
    const [system, memory, runtime, process] = await Promise.all([
      this.getSystemSnapshotReport(null),
      this.getMemoryReport(null),
      this.getUltimateAIRuntimeReport(null),
      this.getProcessReport(null)
    ]);

    const anomalies = [];
    const recommendations = [];

    const memPct = memory.current.percentUsed;
    if (memPct >= 90) anomalies.push(`Penggunaan RAM tinggi (${memPct}%).`);
    else if (memPct >= 75) anomalies.push(`Penggunaan RAM cukup tinggi (${memPct}%).`);

    if (memory.leak.status === 'SUSPECTED') anomalies.push('Indikasi pertumbuhan memori konsisten (SUSPECTED) terdeteksi.');
    else if (memory.leak.status === 'WATCH') anomalies.push('Terdeteksi tren kenaikan memori (WATCH).');

    const heavyDisk = (system.disks || []).filter(d => d.percentUsed >= 88);
    for (const d of heavyDisk) anomalies.push(`Drive ${d.drive} penuh ${d.percentUsed}%.`);

    if (runtime.status !== 'ACTIVE') anomalies.push(`Runtime UltimateAI tidak sepenuhnya aktif (${runtime.status}).`);

    const runtimeRisks = runtime.risks || {};
    if ((runtimeRisks.duplicates || []).length) anomalies.push(`${runtimeRisks.duplicates.length} process runtime duplikat terdeteksi.`);
    if ((runtimeRisks.orphans || []).length) anomalies.push(`${runtimeRisks.orphans.length} process Node orphan terdeteksi.`);

    // Baseline comparison: never claim anomaly without a comparator (D).
    const baseline = baselineInterpreterInstance.evaluate({
      memoryPercent: memPct,
      processCount: process.totalProcesses,
      runtimeActive: runtime.status === 'ACTIVE',
      driveMaxPercent: heavyDisk.length ? Math.max(...heavyDisk.map(d => d.percentUsed)) : null
    });
    if (baseline.status === 'ANOMALY_SUSPECTED') {
      anomalies.push(`RAM ${memPct}% dibanding baseline (${baseline.baselineSamples} sampel) menunjukkan anomali tersangka.`);
    } else if (baseline.status === 'ABOVE_BASELINE' && !anomalies.some(a => /RAM/i.test(a))) {
      anomalies.push(`RAM ${memPct}% berada di atas baseline (${baseline.baselineSamples} sampel).`);
    }

    // Recommendations (analysis-only)
    if (memPct >= 75) recommendations.push('Pertimbangkan menutup aplikasi berat sebelum bekerja dengan beban tinggi.');
    if (memory.leak.status !== 'NORMAL') recommendations.push('Awasi process dengan pertumbuhan memori konsisten; jangan hentikan sebelum identifikasi.');
    if (heavyDisk.length) recommendations.push(`Tinjau isi drive ${heavyDisk.map(d => d.drive).join(', ')} untuk file besar.`);
    if ((process.memorySummary?.unknownCount || 0) > 3) recommendations.push('Terdapat sejumlah process tak dikenal — periksa sebelum mengambil tindakan.');
    if ((runtimeRisks.duplicates || []).length || (runtimeRisks.orphans || []).length) {
      recommendations.push('Tinjau process Node/Vite/UltimateAI duplikat atau orphan sebelum menghentikannya.');
    }
    if (baseline.status === 'ABOVE_BASELINE' || baseline.status === 'ANOMALY_SUSPECTED') {
      recommendations.push('Bandingkan dengan baseline; hindari beban tambahan sampai memori kembali normal.');
    }
    if (!recommendations.length) recommendations.push('Tidak ditemukan masalah signifikan; sistem dalam kondisi normal.');

    const diagnosis = {
      timestamp: new Date().toISOString(),
      summary: {
        cpuLoadPercent: system.cpu.loadPercent,
        memoryPercent: memPct,
        memoryTrend: memory.leak.status,
        topProcess: process.topByMemory[0] ? { name: process.topByMemory[0].name, wsMB: process.topByMemory[0].wsMB } : null,
        topMemoryMB: process.topByMemory[0] ? process.topByMemory[0].wsMB : 0,
        drivesHigh: heavyDisk.map(d => d.drive)
      },
      memoryStatus: memory.leak.status,
      runtimeStatus: runtime.status,
      baseline,
      anomalies,
      recommendations,
      policy: devicePolicyInstance.describe()
    };

    this._journalAction({ ...DEFAULT_META, ...meta, scope: 'overview', action: 'DIAGNOSE_SYSTEM' }, {
      memoryPercent: memPct,
      memoryStatus: memory.leak.status,
      runtimeStatus: runtime.status,
      baselineStatus: baseline.status,
      baselineSamples: baseline.baselineSamples,
      anomalyCount: anomalies.length
    });

    this._storeSystemMemory(diagnosis, anomalies.length);
    return diagnosis;
  }

  /** Stores insights/baselines (C). Never secrets; bounded; additive. */
  _storeSystemMemory(diagnosis, anomalyCount) {
    try {
      if (anomalyCount > 0) {
        systemIntelligenceMemoryInstance.record({
          type: 'INCIDENT',
          insight: `Ditemukan ${anomalyCount} anomali: ${diagnosis.anomalies[0]}`,
          change: {
            memoryPercent: diagnosis.summary.memoryPercent,
            memoryStatus: diagnosis.memoryStatus,
            runtimeStatus: diagnosis.runtimeStatus
          },
          action: { type: 'DIAGNOSE_SYSTEM', scope: 'overview' }
        });
      } else {
        systemIntelligenceMemoryInstance.record({
          type: 'SYSTEM',
          insight: 'Diagnosis rutin: sistem dalam kondisi normal.',
          baseline: {
            memoryPercent: diagnosis.summary.memoryPercent,
            memoryStatus: diagnosis.memoryStatus,
            runtimeStatus: diagnosis.runtimeStatus,
            baselineStatus: diagnosis.baseline?.status || 'UNKNOWN'
          }
        });
      }
    } catch {}
  }

  /**
   * Action Journal (E): every Device Intelligence activity has a clear record.
   */
  _journalAction(meta, result = {}) {
    try {
      const {
        userIntent = 'API (LOKAL)',
        action = 'OBSERVE',
        scope = 'overview',
        artifactReference = null,
        riskLevel = 'LOW'
      } = meta;
      deviceIntelligenceJournalInstance.append({
        type: 'DEVICE_ACTION',
        userIntent,
        action,
        scope,
        result,
        riskLevel,
        confirmationState: confirmationStateFor(),
        artifactReference,
        policyLevel: devicePolicyInstance.getLevel()
      });
    } catch {}
  }

  /** Binds a produced artifact to the latest Device Action journal record (E). */
  async attachArtifactReference(artifactId) {
    try {
      return deviceIntelligenceJournalInstance.attachReference(artifactId);
    } catch {
      return { attached: false };
    }
  }

  /** Human-style answer shaped for JIN voice/text (per product spec). */
  async composeHumanAnswer(scope = 'overview', meta = {}) {
    const diagnosis = await this.runDiagnosis(meta);
    const { summary, memoryStatus, runtimeStatus, anomalies, recommendations } = diagnosis;

    const topRows = (anomalies.length ? [
      'ANOMALI',
      ...anomalies.slice(0, 3).map(a => `- ${a}`),
      'REKOMENDASI',
      ...recommendations.slice(0, 3).map(r => `- ${r}`)
    ] : [
      'ANALISIS',
      '- Tidak ditemukan anomali signifikan pada pengamatan ini.',
      ...recommendations.slice(0, 3).map(r => `- ${r}`)
    ]).join('\n');

    const text = [
      'KONDISI DEVICE',
      '',
      `CPU: ${summary.cpuLoadPercent ?? 'tidak tersedia'}%`,
      `RAM: ${summary.memoryPercent ?? '?'}% terpakai (status memori: ${memoryStatus})`,
      runtimeStatus ? `Runtime UltimateAI: ${runtimeStatus}` : null,
      '',
      ...topRows.split('\n'),
      '',
      'JIN hanya membaca dan menganalisis — belum ada tindakan otomatis yang diizinkan.'
    ].filter(line => line !== null).join('\n');

    return { ...diagnosis, text };
  }

  getJournal(limit = 10) {
    return deviceIntelligenceJournalInstance.getRecent(limit);
  }

  getSystemMemory(limit = 20) {
    return systemIntelligenceMemoryInstance.recent(limit);
  }

  getPolicy() {
    return devicePolicyInstance.describe();
  }
}

export const deviceIntelligenceRuntimeInstance = new DeviceIntelligenceRuntime();
export default deviceIntelligenceRuntimeInstance;