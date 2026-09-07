/**
 * StorageCleanerTool.mjs
 * Clean temp files, cache, logs with safety checks.
 * Respects SafetyLayer protected folders and file classification.
 */

import { ToolContract, PERMISSION_LEVELS } from './ToolContract.mjs';
import { safetyLayerInstance } from '../device/policy/SafetyLayer.mjs';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const MB = 1024 * 1024;

/** Directories considered safe to scan for cleanup targets. */
const CLEAN_TARGETS = [
  { label: 'Windows Temp', path: os.tmpdir(), maxAge: 7 * 24 * 60 * 60 * 1000, risky: false },
  { label: 'User Temp', path: path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Temp'), maxAge: 7 * 24 * 60 * 60 * 1000, risky: false },
  { label: 'npm Cache', path: path.join(process.env.APPDATA || '', 'npm-cache'), maxAge: 30 * 24 * 60 * 60 * 1000, risky: false },
  { label: 'pip Cache', path: path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'pip', 'cache'), maxAge: 30 * 24 * 60 * 60 * 1000, risky: false },
  { label: 'JIN Sandbox', path: path.join(os.tmpdir(), 'jin_sandbox_isolated'), maxAge: 0, risky: false },
  { label: 'Thumbnails', path: path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Microsoft', 'Windows', 'Explorer'), maxAge: 0, risky: false, filesOnly: true }
];

export class StorageCleanerTool extends ToolContract {
  constructor() {
    super({
      name: 'device.storage_cleaner',
      version: '1.0.0',
      description: 'Scan and clean temporary files, cache, and logs. Safety-checked against protected folders.',
      inputSchema: { action: 'string', target: 'string' },
      outputSchema: { action: 'string', result: 'object' },
      permissionLevel: PERMISSION_LEVELS.READ_ONLY,
      timeoutMs: 20000,
      maxRetries: 1
    });
  }

  async execute(params = {}, signal = null) {
    const action = params?.action || 'scan';

    switch (action) {
      case 'scan': return this._scan(params.path);
      case 'clean': return this._clean(params.targets, params.dryRun);
      case 'clean_temp': return this._cleanTemp();
      case 'clean_cache': return this._cleanCache();
      case 'clean_logs': return this._cleanLogs(params.maxAgeDays);
      case 'estimate': return this._estimate();
      default: return this._scan(params.path);
    }
  }

  /** Scan a directory or all clean targets for removable files. */
  async _scan(specificPath) {
    const targets = specificPath
      ? [{ label: 'Custom Path', path: specificPath, maxAge: 0, risky: false }]
      : CLEAN_TARGETS;

    const results = [];
    let totalSize = 0;
    let totalFiles = 0;

    for (const target of targets) {
      // Safety check
      if (safetyLayerInstance._isProtectedPath(target.path)) {
        results.push({
          label: target.label,
          path: target.path,
          status: 'skipped',
          reason: 'Protected path'
        });
        continue;
      }

      try {
        if (!fs.existsSync(target.path)) continue;
        const stats = this._scanDir(target.path, target.maxAge, target.filesOnly);
        totalSize += stats.size;
        totalFiles += stats.count;
        results.push({
          label: target.label,
          path: target.path,
          fileCount: stats.count,
          totalSizeMB: (stats.size / MB).toFixed(2),
          totalSizeFormatted: this._formatSize(stats.size),
          status: 'scanned',
          risky: target.risky,
          classification: safetyLayerInstance.classifyFile(target.path)
        });
      } catch (err) {
        results.push({
          label: target.label,
          path: target.path,
          status: 'error',
          error: err.message
        });
      }
    }

    return {
      action: 'scan',
      timestamp: new Date().toISOString(),
      targets: results,
      summary: {
        totalFiles,
        totalSizeMB: (totalSize / MB).toFixed(2),
        totalSizeFormatted: this._formatSize(totalSize),
        targetsScanned: results.filter(r => r.status === 'scanned').length,
        targetsSkipped: results.filter(r => r.status === 'skipped').length
      }
    };
  }

  /** Clean specified targets (or all safe targets). */
  async _clean(targets, dryRun = true) {
    const check = safetyLayerInstance.guard('clean_temp');
    if (!check.allowed) {
      return { action: 'clean', success: false, error: check.reason };
    }

    const scanResult = await this._scan();
    const toClean = targets
      ? scanResult.targets.filter(t => targets.includes(t.label))
      : scanResult.targets.filter(t => t.status === 'scanned' && !t.risky && !t.classification?.risky);

    if (toClean.length === 0) {
      return {
        action: 'clean',
        success: true,
        dryRun,
        message: 'Tidak ada file yang perlu dibersihkan.',
        cleaned: []
      };
    }

    const cleaned = [];
    let totalFreed = 0;

    for (const target of toClean) {
      try {
        if (dryRun) {
          cleaned.push({
            label: target.label,
            path: target.path,
            wouldFree: target.totalSizeFormatted,
            fileCount: target.fileCount,
            status: 'dry_run'
          });
          totalFreed += parseFloat(target.totalSizeMB) * MB;
          continue;
        }

        // Actual cleanup
        const freed = this._cleanDir(target.path, target.classification?.risky);
        totalFreed += freed;
        cleaned.push({
          label: target.label,
          path: target.path,
          freed: this._formatSize(freed),
          status: 'cleaned'
        });
        safetyLayerInstance._audit('CLEANED', { label: target.label, path: target.path, freed });
      } catch (err) {
        cleaned.push({
          label: target.label,
          path: target.path,
          status: 'error',
          error: err.message
        });
      }
    }

    return {
      action: 'clean',
      success: true,
      dryRun,
      timestamp: new Date().toISOString(),
      cleaned,
      summary: {
        targetsCleaned: cleaned.filter(c => c.status === 'cleaned').length,
        totalFreed: this._formatSize(totalFreed),
        totalFreedBytes: totalFreed
      }
    };
  }

  /** Quick clean: temp files only. */
  async _cleanTemp() {
    const tempDir = os.tmpdir();
    const userTemp = path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Temp');
    return this._clean([
      { label: 'Windows Temp', path: tempDir, maxAge: 7 * 24 * 60 * 60 * 1000, risky: false },
      { label: 'User Temp', path: userTemp, maxAge: 7 * 24 * 60 * 60 * 1000, risky: false }
    ], false);
  }

  /** Quick clean: cache files only. */
  async _cleanCache() {
    const npmCache = path.join(process.env.APPDATA || '', 'npm-cache');
    const pipCache = path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'pip', 'cache');
    return this._clean([
      { label: 'npm Cache', path: npmCache, maxAge: 30 * 24 * 60 * 60 * 1000, risky: false },
      { label: 'pip Cache', path: pipCache, maxAge: 30 * 24 * 60 * 60 * 1000, risky: false }
    ], false);
  }

  /** Quick clean: old log files. */
  async _cleanLogs(maxAgeDays = 7) {
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
    // Scan common log locations
    const logDirs = [
      path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Temp')
    ];
    const results = [];
    for (const dir of logDirs) {
      if (!fs.existsSync(dir)) continue;
      try {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.log'));
        let freed = 0;
        let count = 0;
        const now = Date.now();
        for (const file of files) {
          const fp = path.join(dir, file);
          try {
            const stat = fs.statSync(fp);
            if (now - stat.mtimeMs > maxAge) {
              freed += stat.size;
              fs.unlinkSync(fp);
              count++;
            }
          } catch { /* skip */ }
        }
        results.push({ dir, filesRemoved: count, freed: this._formatSize(freed) });
      } catch (err) {
        results.push({ dir, error: err.message });
      }
    }
    return { action: 'clean_logs', results };
  }

  /** Estimate how much space can be freed (dry run). */
  async _estimate() {
    return this._scan().then(scan => ({
      action: 'estimate',
      ...scan,
      recommendation: scan.summary.totalFiles > 0
        ? `Ditemukan ${scan.summary.totalFiles} file (${scan.summary.totalSizeFormatted}) yang bisa dibersihkan.`
        : 'Tidak ada file yang perlu dibersihkan.'
    }));
  }

  _scanDir(dirPath, maxAge = 0, filesOnly = false) {
    let size = 0;
    let count = 0;
    const now = Date.now();

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        try {
          const stat = fs.statSync(fullPath);
          if (entry.isDirectory()) {
            if (!filesOnly) {
              const sub = this._scanDir(fullPath, maxAge, filesOnly);
              size += sub.size;
              count += sub.count;
            }
          } else {
            const age = now - stat.mtimeMs;
            if (maxAge === 0 || age > maxAge) {
              size += stat.size;
              count++;
            }
          }
        } catch { /* skip inaccessible */ }
      }
    } catch { /* skip inaccessible dir */ }

    return { size, count };
  }

  _cleanDir(dirPath, forceRisky = false) {
    let freed = 0;
    const now = Date.now();

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        try {
          const stat = fs.statSync(fullPath);
          if (entry.isDirectory()) {
            freed += this._cleanDir(fullPath, forceRisky);
          } else {
            const classification = safetyLayerInstance.classifyFile(fullPath);
            if (!classification.risky || forceRisky) {
              freed += stat.size;
              fs.unlinkSync(fullPath);
            }
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }

    return freed;
  }

  _formatSize(bytes) {
    if (bytes > GB) return `${(bytes / GB).toFixed(2)} GB`;
    if (bytes > MB) return `${(bytes / MB).toFixed(2)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
}

export const storageCleanerToolInstance = new StorageCleanerTool();
export default storageCleanerToolInstance;
