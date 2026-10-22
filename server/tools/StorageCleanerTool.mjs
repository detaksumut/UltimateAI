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

const MB = 1024 * 1024;
const GB = 1024 * MB;

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
      permissionLevel: PERMISSION_LEVELS.SAFE_EXECUTE,
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
        const isAllowlistedTarget = CLEAN_TARGETS.some(known =>
          path.resolve(known.path).toLowerCase() === path.resolve(target.path).toLowerCase() &&
          known.label === target.label
        );
        results.push({
          label: target.label,
          path: target.path,
          fileCount: stats.count,
          totalSizeMB: (stats.size / MB).toFixed(2),
          totalSizeFormatted: this._formatSize(stats.size),
          maxAgeMs: target.maxAge,
          filesOnly: Boolean(target.filesOnly),
          status: 'scanned',
          risky: Boolean(target.risky) || !isAllowlistedTarget,
          classification: isAllowlistedTarget && !target.risky
            ? { safe: true, label: 'Allowlisted cleanup target', risky: false }
            : { safe: false, label: 'Custom or review-required path', risky: true }
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

  /** Clean only explicitly allowlisted targets. Dry-run is the default. */
  async _clean(targets, dryRun = true) {
    const check = safetyLayerInstance.guard('clean_temp');
    if (!check.allowed) {
      return { action: 'clean', success: false, dryRun, error: check.reason };
    }

    const requestedLabels = Array.isArray(targets)
      ? targets.map(item => typeof item === 'string' ? item : item?.label).filter(Boolean)
      : null;
    const approvedTargets = CLEAN_TARGETS.filter(target =>
      !target.risky && (!requestedLabels || requestedLabels.includes(target.label))
    );

    if (requestedLabels && requestedLabels.some(label => !CLEAN_TARGETS.some(t => t.label === label))) {
      return {
        action: 'clean',
        success: false,
        dryRun,
        error: 'Target cleanup tidak dikenal. Hanya lokasi yang masuk daftar aman yang boleh dibersihkan.',
        allowedTargets: CLEAN_TARGETS.filter(t => !t.risky).map(t => t.label)
      };
    }

    const scanResult = await this._scan();
    const toClean = scanResult.targets.filter(scanned =>
      scanned.status === 'scanned' &&
      !scanned.risky &&
      !scanned.classification?.risky &&
      approvedTargets.some(target =>
        target.label === scanned.label &&
        path.resolve(target.path).toLowerCase() === path.resolve(scanned.path).toLowerCase()
      )
    );

    if (toClean.length === 0) {
      return {
        action: 'clean',
        success: true,
        dryRun,
        message: requestedLabels
          ? 'Target yang dipilih tidak tersedia atau tidak memenuhi kebijakan aman.'
          : 'Tidak ada file yang memenuhi kriteria pembersihan aman.',
        cleaned: [],
        summary: { targetsCleaned: 0, totalFreed: '0.0 KB', totalFreedBytes: 0 }
      };
    }

    const cleaned = [];
    let totalFreed = 0;

    for (const target of toClean) {
      const policy = CLEAN_TARGETS.find(known =>
        known.label === target.label &&
        path.resolve(known.path).toLowerCase() === path.resolve(target.path).toLowerCase()
      );
      if (!policy || safetyLayerInstance._isProtectedPath(target.path)) {
        cleaned.push({ label: target.label, path: target.path, status: 'skipped', reason: 'Protected or non-allowlisted path' });
        continue;
      }

      try {
        if (dryRun) {
          cleaned.push({
            label: target.label,
            path: target.path,
            wouldFree: target.totalSizeFormatted,
            fileCount: target.fileCount,
            status: 'dry_run'
          });
          totalFreed += this._scanDir(policy.path, policy.maxAge, policy.filesOnly).size;
          continue;
        }

        const freed = this._cleanDir(policy.path, {
          maxAge: policy.maxAge,
          filesOnly: Boolean(policy.filesOnly),
          allowAllAges: policy.maxAge === 0 && policy.label === 'JIN Sandbox'
        });
        totalFreed += freed;
        cleaned.push({
          label: target.label,
          path: target.path,
          freed: this._formatSize(freed),
          status: 'cleaned',
          maxAgeDays: policy.maxAge ? Math.ceil(policy.maxAge / (24 * 60 * 60 * 1000)) : 0
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
      success: !cleaned.some(item => item.status === 'error'),
      dryRun,
      timestamp: new Date().toISOString(),
      cleaned,
      summary: {
        targetsCleaned: cleaned.filter(item => item.status === 'cleaned').length,
        totalFreed: this._formatSize(totalFreed),
        totalFreedBytes: totalFreed
      }
    };
  }

  /** Quick clean: temp files only. */
  async _cleanTemp() {
    const tempDir = os.tmpdir();
    const userTemp = path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Temp');
    const labels = CLEAN_TARGETS
      .filter(target => ['Windows Temp', 'User Temp'].includes(target.label) &&
        path.resolve(target.path).toLowerCase() !== path.resolve('').toLowerCase())
      .filter(target => [tempDir, userTemp].some(dir =>
        path.resolve(dir).toLowerCase() === path.resolve(target.path).toLowerCase()
      ))
      .map(target => target.label);
    return this._clean(labels, false);
  }

  /** Quick clean: cache files only. */
  async _cleanCache() {
    const npmCache = path.join(process.env.APPDATA || '', 'npm-cache');
    const pipCache = path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'pip', 'cache');
    const labels = CLEAN_TARGETS
      .filter(target => ['npm Cache', 'pip Cache'].includes(target.label) &&
        [npmCache, pipCache].some(dir =>
          path.resolve(dir).toLowerCase() === path.resolve(target.path).toLowerCase()
        ))
      .map(target => target.label);
    return this._clean(labels, false);
  }

  /** Quick clean: delete only old regular .log files in the allowlisted user temp folder. */
  async _cleanLogs(maxAgeDays = 7) {
    const check = safetyLayerInstance.guard('clean_log');
    if (!check.allowed) {
      return { action: 'clean_logs', success: false, error: check.reason, results: [] };
    }

    const ageDays = Number.isFinite(Number(maxAgeDays))
      ? Math.min(3650, Math.max(1, Number(maxAgeDays)))
      : 7;
    const maxAge = ageDays * 24 * 60 * 60 * 1000;
    const logDirs = [...new Set([
      path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Temp'),
      os.tmpdir()
    ].map(dir => path.resolve(dir).toLowerCase()))];
    const results = [];
    const seen = new Set();
    const now = Date.now();

    for (const normalizedDir of logDirs) {
      const dir = normalizedDir;
      if (seen.has(dir)) continue;
      seen.add(dir);
      if (safetyLayerInstance._isProtectedPath(dir) || !fs.existsSync(dir)) continue;

      let freed = 0;
      let count = 0;
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.log')) continue;
          const fp = path.join(dir, entry.name);
          try {
            const stat = fs.lstatSync(fp);
            if (!stat.isFile() || stat.isSymbolicLink() || now - stat.mtimeMs <= maxAge) continue;
            if (safetyLayerInstance.classifyFile(fp).risky) continue;
            fs.unlinkSync(fp);
            freed += stat.size;
            count++;
          } catch { /* skip locked/inaccessible files */ }
        }
        results.push({ dir, filesRemoved: count, freed: this._formatSize(freed) });
      } catch (err) {
        results.push({ dir, error: err.message });
      }
    }
    safetyLayerInstance._audit('CLEAN_LOGS', { ageDays, results });
    return { action: 'clean_logs', success: true, ageDays, results };
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
      for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const fullPath = path.join(dirPath, entry.name);
        try {
          const stat = fs.lstatSync(fullPath);
          // Do not follow symlinks or junction-like entries while scanning.
          if (stat.isSymbolicLink()) continue;
          if (stat.isDirectory()) {
            if (!filesOnly) {
              const sub = this._scanDir(fullPath, maxAge, false);
              size += sub.size;
              count += sub.count;
            }
          } else if (stat.isFile()) {
            const age = now - stat.mtimeMs;
            if (maxAge === 0 || age > maxAge) {
              size += stat.size;
              count++;
            }
          }
        } catch { /* skip inaccessible entries */ }
      }
    } catch { /* skip inaccessible directory */ }

    return { size, count };
  }

  _cleanDir(dirPath, options = {}) {
    const { maxAge = 0, filesOnly = false, allowAllAges = false } = options;
    let freed = 0;
    const now = Date.now();

    try {
      for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const fullPath = path.join(dirPath, entry.name);
        try {
          const stat = fs.lstatSync(fullPath);
          // Never traverse symbolic links/reparse points; only handle regular files.
          if (stat.isSymbolicLink()) continue;
          if (stat.isDirectory()) {
            if (!filesOnly) {
              freed += this._cleanDir(fullPath, { maxAge, filesOnly: false, allowAllAges });
            }
            continue;
          }
          if (!stat.isFile()) continue;

          const age = now - stat.mtimeMs;
          if (!allowAllAges && maxAge > 0 && age <= maxAge) continue;

          const classification = safetyLayerInstance.classifyFile(fullPath);
          if (!classification.safe || classification.risky) continue;

          // Delete only the file that passed the age, allowlist and policy checks.
          fs.unlinkSync(fullPath);
          freed += stat.size;
        } catch { /* locked or inaccessible: skip without interrupting cleanup */ }
      }
    } catch { /* skip inaccessible directory */ }

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
