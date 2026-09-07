/**
 * StorageAnalyzer.mjs
 * READ-ONLY storage analysis: drive capacity + bounded scans of known
 * temporary/cache locations (FAST) or explicit roots (DEEP). No writes,
 * no deletions, respects file-count caps so requests never hang.
 * LOCAL ONLY.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

const MAX_SCAN_FILES = 6000;
const MAX_RESULTS = 40;

/** Iterative directory walk with symlink skipping + file cap. */
export async function getDirectorySize(dir, { maxFiles = MAX_SCAN_FILES, onProgress = null } = {}) {
  let totalBytes = 0;
  let files = 0;
  let aborted = false;
  const stack = [dir];
  const visited = new Set();

  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      const real = fs.realpathSync(current);
      if (visited.has(real)) continue;
      visited.add(real);
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const full = path.join(current, entry.name);
      try {
        if (entry.isSymbolicLink()) continue; // avoid cycles / escapes
        if (entry.isDirectory()) {
          if (stack.length + 1 > 2000) { aborted = true; continue; }
          stack.push(full);
        } else if (entry.isFile()) {
          const st = fs.statSync(full, { bigint: false });
          totalBytes += st.size;
          files++;
          if (files >= maxFiles) {
            aborted = true;
            break;
          }
        }
      } catch {}
    }
    if (aborted) break;
    if (onProgress && files % 500 === 0) onProgress({ files, bytes: totalBytes, current });
  }

  return { bytes: totalBytes, files, aborted };
}

export class StorageAnalyzer {
  constructor({ rootDir = process.cwd() } = {}) {
    this.rootDir = rootDir;
  }

  async getDriveInfo() {
    const { diskInspectorInstance } = await import('../system/DiskInspector.mjs');
    const { drives, errors } = await diskInspectorInstance.getDiskDetails();
    return { drives, errors };
  }

  _exploreTargets() {
    const home = os.homedir();
    const localAppData = path.join(home, 'AppData', 'Local');
    const tmp = os.tmpdir();
    const project = this.rootDir;

    return [
      { label: 'OS_TEMP', path: tmp },
      { label: 'WINDOWS_TEMP', path: path.join(process.env.windir || 'C:\\Windows', 'Temp') },
      { label: 'NPM_CACHE', path: path.join(localAppData, 'npm-cache') },
      { label: 'YARN_CACHE', path: path.join(localAppData, 'Yarn', 'Cache') },
      { label: 'PNPM_STORE', path: path.join(localAppData, 'pnpm', 'store') },
      { label: 'NPM_CACACHE', path: path.join(home, '.npm', '_cacache') },
      { label: 'VITE_CACHE', path: path.join(project, 'node_modules', '.vite') },
      { label: 'PROJECT_CACHE', path: path.join(project, 'node_modules', '.cache') },
      { label: 'PROJECT_DIST', path: path.join(project, 'dist') },
      { label: 'CHROME_CACHE', path: path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Cache') },
      { label: 'EDGE_CACHE', path: path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache') },
      { label: 'FIREFOX_CACHE', path: path.join(home, 'AppData', 'Local', 'Mozilla', 'Firefox', 'Profiles') }
    ].filter(t => {
      try {
        return fs.existsSync(t.path);
      } catch {
        return false;
      }
    });
  }

  /**
   * FAST SCAN: known temp/cache/runtime-artifact dirs only.
   */
  async fastScan({ onProgress = null } = {}) {
    const targets = this._exploreTargets();
    const results = [];
    for (const t of targets) {
      const size = await getDirectorySize(t.path, { onProgress: item => onProgress && onProgress({ stage: t.label, ...item }) });
      results.push({ label: t.label, path: t.path, ...size });
    }
    const sorted = results.sort((a, b) => b.bytes - a.bytes);
    const totalBytes = sorted.reduce((s, r) => s + r.bytes, 0);
    return { mode: 'FAST', scannedTargets: sorted.length, totalBytes, results: sorted.slice(0, MAX_RESULTS), targets };
  }

  /**
   * DEEP SCAN: explicit roots only (user/request-driven). Bounded walk.
   */
  async deepScan({ roots = [], onProgress = null } = {}) {
    const safeRoots = (roots || []).slice(0, 8).filter(r => {
      try { return fs.existsSync(r); } catch { return false; }
    });
    const scanned = [];
    let totalBytes = 0;
    for (const root of safeRoots) {
      const size = await getDirectorySize(root, { onProgress });
      scanned.push({ path: root, ...size });
      totalBytes += size.bytes;
    }
    const topItems = [];
    for (const root of safeRoots) {
      const items = await this.largestItems(root, 8);
      topItems.push({ root, items });
    }
    return { mode: 'DEEP', rootCount: safeRoots.length, totalBytes, scanned, topItems };
  }

  async largestItems(dir, topN = 8) {
    const collect = [];
    const stack = [dir];
    try {
      while (stack.length && collect.length < 20000) {
        const current = stack.pop();
        let entries;
        try {
          entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const e of entries) {
          const full = path.join(current, e.name);
          if (e.isSymbolicLink()) continue;
          try {
            if (e.isDirectory()) {
              stack.push(full);
            } else if (e.isFile()) {
              const st = fs.statSync(full);
              collect.push({ path: full, sizeBytes: st.size });
            }
          } catch {}
        }
      }
    } catch {}
    return collect.sort((a, b) => b.sizeBytes - a.sizeBytes).slice(0, topN);
  }
}

export const storageAnalyzerInstance = new StorageAnalyzer();
export default storageAnalyzerInstance;