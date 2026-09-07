/**
 * LocalFilesystemTool.mjs
 * Autonomous Local Physical Filesystem Manager for JIN (Hermes 3).
 * Enables JIN to create folders, inspect contents, and write files directly
 * to external physical storage (Drive F:\) and project workspace safely.
 *
 * Enforces strict boundary protection: blocks sensitive OS paths (C:\Windows, etc.).
 */

import fs from 'fs';
import path from 'path';

// Restricted system directories to prevent OS corruption
const BLOCKED_DIRECTORIES = [
  'C:\\WINDOWS',
  'C:\\PROGRAM FILES',
  'C:\\PROGRAM FILES (X86)',
  'C:\\SYSTEM VOLUME INFORMATION'
];

export class LocalFilesystemTool {
  constructor() {
    this.name = 'fs.manage';
    this.version = '1.0.0';
    this.description = 'Autonomous Physical Filesystem Manager for JIN: creates directories, lists files, and safely manages physical storage on Drive F: and project directories.';
  }

  _isSafePath(targetPath) {
    if (!targetPath || typeof targetPath !== 'string') return false;
    const normalized = path.resolve(targetPath).toUpperCase();
    for (const blocked of BLOCKED_DIRECTORIES) {
      if (normalized.startsWith(blocked)) return false;
    }
    return true;
  }

  /**
   * Main Execution Handler
   * @param {Object} params - { action, targetPath, content, recursive }
   */
  async execute(params = {}) {
    const { action = 'create_directory', targetPath, content = '' } = params;

    if (!targetPath) {
      return { success: false, error: 'Target path is required.' };
    }

    if (!this._isSafePath(targetPath)) {
      return { success: false, error: `Access to restricted system directory is blocked: ${targetPath}` };
    }

    try {
      switch (action) {
        case 'create_directory':
        case 'mkdir': {
          if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
            return {
              success: true,
              action: 'create_directory',
              targetPath,
              created: true,
              message: `Direktori fisik berhasil dibuat di: ${targetPath}`
            };
          }
          return {
            success: true,
            action: 'create_directory',
            targetPath,
            created: false,
            message: `Direktori sudah ada: ${targetPath}`
          };
        }

        case 'list_directory':
        case 'ls': {
          if (!fs.existsSync(targetPath)) {
            return { success: false, error: `Direktori tidak ditemukan: ${targetPath}` };
          }
          const items = fs.readdirSync(targetPath, { withFileTypes: true });
          const fileList = items.map(item => {
            const fullPath = path.join(targetPath, item.name);
            let size = 0;
            try {
              const stat = fs.statSync(fullPath);
              size = stat.size;
            } catch {}
            return {
              name: item.name,
              isDirectory: item.isDirectory(),
              sizeBytes: size,
              sizeKb: (size / 1024).toFixed(1) + ' KB',
              path: fullPath
            };
          });

          return {
            success: true,
            action: 'list_directory',
            targetPath,
            totalItems: fileList.length,
            files: fileList
          };
        }

        case 'check_exists': {
          const exists = fs.existsSync(targetPath);
          return {
            success: true,
            targetPath,
            exists
          };
        }

        case 'write_file': {
          const parentDir = path.dirname(targetPath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }
          fs.writeFileSync(targetPath, content, 'utf8');
          const stat = fs.statSync(targetPath);
          return {
            success: true,
            action: 'write_file',
            targetPath,
            sizeBytes: stat.size,
            sizeKb: (stat.size / 1024).toFixed(1) + ' KB',
            message: `File berhasil disimpan ke: ${targetPath}`
          };
        }

        case 'read_file': {
          if (!fs.existsSync(targetPath)) {
            return { success: false, error: `File tidak ditemukan: ${targetPath}` };
          }
          const content = fs.readFileSync(targetPath, 'utf8');
          return {
            success: true,
            action: 'read_file',
            targetPath,
            sizeBytes: content.length,
            sizeKb: (content.length / 1024).toFixed(1) + ' KB',
            content
          };
        }

        default:
          return { success: false, error: `Action "${action}" is not supported.` };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

export const localFilesystemToolInstance = new LocalFilesystemTool();
