/**
 * paths.mjs
 * Canonical filesystem resolver for UltimateAI JIN.
 * 100% Windows Native & Standalone (No Drive F: dependency, No Linux mounts).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

export const IS_WINDOWS = true;
export const IS_LINUX = false;

/** Root of the project repository (Windows `D:\Users\ultimateai`). */
export const DRIVE_D_ROOT = path.resolve(process.cwd());

/** Local storage directory inside the project repository. */
export const MEMORY_BASE = path.join(DRIVE_D_ROOT, 'storage');

export const LOGS_DIR = path.join(MEMORY_BASE, 'logs');
export const DOC_DIR = path.join(MEMORY_BASE, 'documents');
export const BACKUP_DIR = path.join(DOC_DIR, 'Backups');
export const STATE_DIR = path.join(MEMORY_BASE, 'agent_state');
export const OUTPUTS_DIR = path.join(MEMORY_BASE, 'outputs');
export const VAULT_DIR = path.join(MEMORY_BASE, 'vault');

/** Music library stored locally in public folder. */
export const MUSIC_DIR = path.join(DRIVE_D_ROOT, 'public');

/** SQLite semantic index. */
export const MEMORY_DB_PATH = path.join(VAULT_DIR, 'index.sqlite');

/** Fallback local path. */
export const LOCAL_FALLBACK_DB_PATH = path.resolve(
  DRIVE_D_ROOT,
  'server',
  'data',
  'memory_index.sqlite'
);

export const DRIVE_F_ROOT = '';

function safeExists(target) {
  try {
    return fs.existsSync(target);
  } catch (_) {
    return false;
  }
}

/** Sovereign memory is active and hosted directly in local storage. */
export function isMemoryBaseAvailable() {
  return true;
}

/** Drive F is intentionally ignored and decommissioned. */
export function isDriveFAvailable() {
  return false;
}

/**
 * Ensure local storage folder layout exists.
 */
export function ensureMemoryDirectories() {
  for (const dir of [MEMORY_BASE, LOGS_DIR, DOC_DIR, STATE_DIR, OUTPUTS_DIR, VAULT_DIR]) {
    if (!safeExists(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (_) {
        return false;
      }
    }
  }
  return true;
}

/** Human-readable platform label for diagnostics and health reporting. */
export function platformMemoryLabel() {
  return `Windows (Local Storage) -> ${MEMORY_BASE}`;
}