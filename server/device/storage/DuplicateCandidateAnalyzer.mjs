/**
 * DuplicateCandidateAnalyzer.mjs
 * Finds duplicate-file CANDIDATES by (size + basename) within explicit
 * roots, optionally content-verified via SHA-256 for candidates ≥ 1 MB.
 * Read-only. Never deletes.
 * LOCAL ONLY.
 */

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

const VERIFY_SIZE_THRESHOLD = 1 * 1024 * 1024;

async function sha256(file) {
  try {
    const hash = crypto.createHash('sha256');
    const buf = Buffer.alloc(1024 * 256);
    const fd = fs.openSync(file, 'r');
    try {
      let read = 0;
      while ((read = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
        hash.update(buf.subarray(0, read));
      }
    } finally {
      fs.closeSync(fd);
    }
    return hash.digest('hex');
  } catch {
    return null;
  }
}

export class DuplicateCandidateAnalyzer {
  async collectFileMeta(roots, { verifyHashes = false, onProgress = null } = {}) {
    const entries = [];
    const stack = [...roots];
    const seen = new Set();
    let inspected = 0;

    while (stack.length && entries.length < 15000) {
      const dir = stack.pop();
      let real;
      try {
        real = fs.realpathSync(dir);
        if (seen.has(real)) continue;
        seen.add(real);
      } catch {
        continue;
      }
      let list;
      try {
        list = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of list) {
        const full = path.join(dir, e.name);
        if (e.isSymbolicLink()) continue;
        try {
          if (e.isDirectory()) {
            stack.push(full);
          } else if (e.isFile()) {
            const st = fs.statSync(full);
            if (st.size > 0) {
              entries.push({ path: full, name: e.name.toLowerCase(), sizeBytes: st.size });
            }
            inspected++;
          }
        } catch {}
      }
      if (onProgress && inspected % 500 === 0) onProgress({ files: inspected, scanned: dir });
    }

    return { entries, inspected };
  }

  async findCandidates({ roots = [], verifyHashes = false, onProgress = null } = {}) {
    const { entries, inspected } = await this.collectFileMeta(roots, { verifyHashes, onProgress });

    const groups = new Map();
    for (const e of entries) {
      const key = `${e.sizeBytes}|${e.name}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    }

    const candidates = [];
    for (const [key, group] of groups.entries()) {
      if (group.length < 2) continue;
      const primary = group[0];
      const hashMap = new Map();
      for (const item of group) {
        let hash = null;
        if (verifyHashes && item.sizeBytes >= VERIFY_SIZE_THRESHOLD) {
          hash = await sha256(item.path);
        }
        hashMap.set(hash, [...(hashMap.get(hash) || []), item]);
      }
      for (const [, same] of hashMap.entries()) {
        if (same.length < 2) continue;
        candidates.push({
          key,
          sizeBytes: primary.sizeBytes,
          count: same.length,
          files: same.map(s => s.path),
          verifiedByContent: verifyHashes && same[0].sizeBytes >= VERIFY_SIZE_THRESHOLD && same[0].hash !== null
        });
      }
    }

    candidates.sort((a, b) => b.sizeBytes - a.sizeBytes);
    return { candidates: candidates.slice(0, 50), inspected, duplicateCandidates: candidates.length, wastedBytes: candidates.reduce((s, c) => s + c.sizeBytes * (c.count - 1), 0) };
  }
}

export const duplicateCandidateAnalyzerInstance = new DuplicateCandidateAnalyzer();
export default duplicateCandidateAnalyzerInstance;