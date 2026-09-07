/**
 * JunkClassifier.mjs
 * Classifies candidate files/folders as SAFE / REVIEW / PROTECTED.
 *
 * SAFE     — disposable temp & regenerable cache (analysis only in this phase).
 * REVIEW   — needs human judgment (installers, archives, old downloads).
 * PROTECTED— must never be touched automatically.
 *
 * PROTECTED rules are conservative: Windows, Program Files, ProgramData,
 * active source, .git, .env, credential/token storage, user Documents/Desktop.
 */

import os from 'os';
import path from 'path';

const WIN_PROTECTED = /(^|[\\/])(Windows|Program Files|Program Files \(x86\)|ProgramData)([\\/]|$)/i;
const HOME = os.homedir().replace(/[\\/]+$/, '');
const DOCUMENTS = path.join(HOME, 'Documents').toLowerCase();
const DESKTOP = path.join(HOME, 'Desktop').toLowerCase();

const SECRET_TOKENS = /(\\|^)(\.env|\.npmrc|credentials|tokens?|secrets|\.ssh|vault|keystore)[\\/]?$/i;
const GIT_SENSITIVE = /([\\/])(\.git|\.github)([\\/]|$)/i;
const USER_DATA_ROOTS = [DOCUMENTS, DESKTOP];

const SAFE_TEMP_RE = /(\\tmp[\\/]|\\Temp[\\/]|\\npm-cache[\\/]|_cacache[\\/]|\\Yarn\\Cache[\\/]|\bpnpm\b|\bstore\b|\.vite[\\/]|\.cache[\\/]|\.parcel-cache[\\/]|\\browser?caches?[\\/])/i;
const SAFE_EXT_RE = /\.(tmp|part|crdownload|cache)$/i;
const REVIEW_EXT_RE = /\.(zip|7z|rar|tar|gz|bz2|xz|iso|dmg|msi|exe|bak|old|nupkg|whl|pyc)$/i;

function normalize(p) {
  return path.normalize(p).replace(/\\/g, '\\');
}

export class JunkClassifier {
  /**
   * @param {string} absPath
   * @returns {{ category:'SAFE'|'REVIEW'|'PROTECTED', reason:string, path:string }}
   */
  classifyPath(absPath) {
    const p = normalize(absPath);
    const lower = p.toLowerCase();

    // PROTECTED gates (highest priority)
    if (WIN_PROTECTED.test(p)) {
      return { category: 'PROTECTED', reason: 'Di bawah direktori sistem / program.', path: absPath };
    }
    if (GIT_SENSITIVE.test(p)) {
      return { category: 'PROTECTED', reason: 'Termasuk penyimpanan Git aktif.', path: absPath };
    }
    if (SECRET_TOKENS.test(p)) {
      return { category: 'PROTECTED', reason: 'Berpotensi menyimpan kredensial/rahasia.', path: absPath };
    }
    if (USER_DATA_ROOTS.some(root => lower.startsWith(root))) {
      return { category: 'PROTECTED', reason: 'Dokumen/Desktop pengguna dilindungi (perlu izin eksplisit).', path: absPath };
    }

    // SAFE gates
    if (SAFE_TEMP_RE.test(p) || SAFE_EXT_RE.test(p)) {
      return { category: 'SAFE', reason: 'File temporer / cache yang dapat dibuat ulang.', path: absPath };
    }

    // REVIEW gates
    if (REVIEW_EXT_RE.test(p)) {
      return { category: 'REVIEW', reason: 'Arsip/installer — butuh peninjauan manual.', path: absPath };
    }

    return { category: 'REVIEW', reason: 'Tidak dikenal, butuh peninjauan.', path: absPath };
  }

  classifyMany(items) {
    return (items || []).map(i => {
      const cls = this.classifyPath(i.path);
      return { ...i, ...cls, sizeBytes: i.sizeBytes || i.bytes || 0 };
    });
  }

  summarize(classified) {
    const summary = { SAFE: 0, REVIEW: 0, PROTECTED: 0 };
    const bytes = { SAFE: 0, REVIEW: 0, PROTECTED: 0 };
    for (const item of classified || []) {
      summary[item.category] = (summary[item.category] || 0) + 1;
      bytes[item.category] = (bytes[item.category] || 0) + (item.sizeBytes || 0);
    }
    return { counts: summary, bytes };
  }
}

export const junkClassifierInstance = new JunkClassifier();
export default junkClassifierInstance;