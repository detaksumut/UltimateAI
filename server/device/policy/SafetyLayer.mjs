/**
 * SafetyLayer.mjs
 * Tiered permission system for JIN Device Optimizer.
 *
 * Permission tiers:
 *   🟢 READ       — view system status (free)
 *   🟡 SUGGEST    — recommend actions (free)
 *   🟠 EXECUTE_SAFE — clean approved temp/cache (auto-allowed)
 *   🔴 EXECUTE_RISKY — stop processes, delete files (requires confirmation)
 *
 * Protected resources can never be touched regardless of tier.
 */

import { devicePolicyInstance, DEVICE_ACTION_LEVELS } from './DevicePolicy.mjs';
import fs from 'fs';
import path from 'path';

export const PERMISSION_TIER = {
  READ: 'READ',
  SUGGEST: 'SUGGEST',
  EXECUTE_SAFE: 'EXECUTE_SAFE',
  EXECUTE_RISKY: 'EXECUTE_RISKY'
};

const TIER_RANK = {
  READ: 0,
  SUGGEST: 1,
  EXECUTE_SAFE: 2,
  EXECUTE_RISKY: 3
};

/** Folders that JIN must NEVER delete or modify. */
const PROTECTED_FOLDERS = [
  process.env.USERPROFILE || 'C:\\Users\\default',
  'C:\\Users',
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'D:\\Users\\ultimateai\\.git',
  'D:\\Users\\ultimateai\\node_modules',
  'D:\\Users\\ultimateai\\.env',
  'D:\\Users\\ultimateai\\server\\.env',
  'D:\\Users\\ultimateai\\src',
  'F:\\UltimateAI_Memory',
  path.join(process.env.TEMP || 'C:\\Windows\\Temp', '..')
];

/** Processes that JIN must NEVER kill. */
const PROTECTED_PROCESSES = [
  'system',
  'svchost',
  'csrss',
  'smss',
  'wininit',
  'winlogon',
  'services',
  'lsass',
  'dwm',
  'fontdrvhost',
  'sihost',
  'explorer',
  'taskhostw',
  'runtimebroker',
  'shellexperiencehost',
  'startmenuexperiencehost',
  'searchui',
  'textinputhost',
  'jellyfinserver',
  'ollama',
  'node',
  'vite',
  'conhost'
];

/** Safe temp/cache patterns that can be cleaned without confirmation. */
const SAFE_CLEAN_PATTERNS = [
  { pattern: /\\Temp\\/, label: 'Windows Temp', risky: false },
  { pattern: /\\tmp\\/, label: 'Tmp folder', risky: false },
  { pattern: /\.log$/, label: 'Log files older than 7 days', risky: false },
  { pattern: /\\Cache\\/, label: 'Browser/app cache', risky: false },
  { pattern: /\\Code\\Cache\\/, label: 'VS Code cache', risky: false },
  { pattern: /\\npm-cache\\/, label: 'npm cache', risky: false },
  { pattern: /\\pip\\cache\\/, label: 'pip cache', risky: false },
  { pattern: /\\__pycache__\\/, label: 'Python __pycache__', risky: false },
  { pattern: /\\Thumbs\.db$/, label: 'Thumbs.db', risky: false },
  { pattern: /\\desktop\.ini$/, label: 'desktop.ini', risky: false },
  { pattern: /\\jin_sandbox_isolated\\/, label: 'JIN sandbox temp', risky: false },
  { pattern: /\\vite\\deps\\/, label: 'Vite dep cache', risky: false },
  { pattern: /\\dist\\/, label: 'Build output', risky: true },
  { pattern: /\\.env/, label: 'Environment file', risky: true },
  { pattern: /\\node_modules\\/, label: 'node_modules', risky: true },
  { pattern: /\\\.git\\/, label: 'Git repository', risky: true }
];

export class SafetyLayer {
  constructor() {
    this.currentTier = PERMISSION_TIER.READ;
    this.pendingConfirmations = new Map();
    this.auditLog = [];
  }

  setTier(tier) {
    if (!TIER_RANK[tier]) throw new Error(`Unknown permission tier: ${tier}`);
    const prev = this.currentTier;
    this.currentTier = tier;

    // Sync with DevicePolicy
    if (tier === PERMISSION_TIER.READ || tier === PERMISSION_TIER.SUGGEST) {
      devicePolicyInstance.setLevel(DEVICE_ACTION_LEVELS.OBSERVE_ONLY);
    } else if (tier === PERMISSION_TIER.EXECUTE_SAFE) {
      devicePolicyInstance.setLevel(DEVICE_ACTION_LEVELS.SAFE_ACTION);
    } else if (tier === PERMISSION_TIER.EXECUTE_RISKY) {
      devicePolicyInstance.setLevel(DEVICE_ACTION_LEVELS.CONFIRM_REQUIRED);
    }

    this._audit('SET_TIER', { from: prev, to: tier });
    return { previousTier: prev, currentTier: tier };
  }

  getTier() {
    return this.currentTier;
  }

  /**
   * Check if an action is allowed at the current permission tier.
   * @param {string} action - 'read' | 'suggest' | 'clean_temp' | 'stop_process' | 'delete_file'
   * @param {Object} [detail] - additional context
   * @returns {{ allowed: boolean, tier: string, reason: string, needsConfirmation: boolean }}
   */
  guard(action, detail = {}) {
    const requiredTier = this._actionRequiredTier(action);
    const allowed = TIER_RANK[this.currentTier] >= TIER_RANK[requiredTier];

    // Check protected resources
    if (allowed && detail.path) {
      if (this._isProtectedPath(detail.path)) {
        this._audit('BLOCKED_PROTECTED', { action, path: detail.path });
        return {
          allowed: false,
          tier: this.currentTier,
          reason: `Path terlindungi: ${detail.path}`,
          needsConfirmation: false
        };
      }
    }

    if (allowed && detail.processName) {
      if (this._isProtectedProcess(detail.processName)) {
        this._audit('BLOCKED_PROTECTED', { action, process: detail.processName });
        return {
          allowed: false,
          tier: this.currentTier,
          reason: `Proses terlindungi: ${detail.processName}`,
          needsConfirmation: false
        };
      }
    }

    const needsConfirmation = allowed && requiredTier === PERMISSION_TIER.EXECUTE_RISKY;

    if (allowed) {
      this._audit('ALLOWED', { action, tier: this.currentTier, needsConfirmation });
    } else {
      this._audit('DENIED', { action, required: requiredTier, current: this.currentTier });
    }

    return {
      allowed,
      tier: this.currentTier,
      reason: allowed
        ? `Diizinkan pada tier ${this.currentTier}`
        : `Membutuhkan tier ${requiredTier}, saat ini ${this.currentTier}`,
      needsConfirmation
    };
  }

  /** Classify a file path as safe or risky to clean. */
  classifyFile(filePath) {
    for (const { pattern, label, risky } of SAFE_CLEAN_PATTERNS) {
      if (pattern.test(filePath)) {
        return { safe: !risky, label, risky };
      }
    }
    // Default: unknown files are risky
    return { safe: false, label: 'Unknown', risky: true };
  }

  /** Check if a path is protected. */
  _isProtectedPath(filePath) {
    const normalized = path.resolve(filePath).toLowerCase();
    return PROTECTED_FOLDERS.some(pf => normalized.startsWith(path.resolve(pf).toLowerCase()));
  }

  /** Check if a process is protected. */
  _isProtectedProcess(processName) {
    const lower = processName.toLowerCase();
    return PROTECTED_PROCESSES.some(pp => lower === pp || lower.includes(pp));
  }

  /** Map action to required permission tier. */
  _actionRequiredTier(action) {
    const map = {
      read: PERMISSION_TIER.READ,
      suggest: PERMISSION_TIER.SUGGEST,
      monitor: PERMISSION_TIER.READ,
      classify: PERMISSION_TIER.READ,
      clean_temp: PERMISSION_TIER.EXECUTE_SAFE,
      clean_cache: PERMISSION_TIER.EXECUTE_SAFE,
      clean_log: PERMISSION_TIER.EXECUTE_SAFE,
      stop_process: PERMISSION_TIER.EXECUTE_RISKY,
      delete_file: PERMISSION_TIER.EXECUTE_RISKY,
      kill_process: PERMISSION_TIER.EXECUTE_RISKY,
      restart_service: PERMISSION_TIER.EXECUTE_RISKY
    };
    return map[action] || PERMISSION_TIER.EXECUTE_RISKY;
  }

  /** Queue a risky action for user confirmation. */
  requestConfirmation(action, detail) {
    const id = `confirm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const request = {
      id,
      action,
      detail,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    this.pendingConfirmations.set(id, request);
    this._audit('CONFIRMATION_REQUESTED', { id, action });
    return request;
  }

  /** Resolve a pending confirmation. */
  resolveConfirmation(id, approved) {
    const request = this.pendingConfirmations.get(id);
    if (!request) return { error: 'Confirmation not found' };
    request.status = approved ? 'approved' : 'denied';
    request.resolvedAt = new Date().toISOString();
    this.pendingConfirmations.delete(id);
    this._audit('CONFIRMATION_RESOLVED', { id, approved });
    return request;
  }

  /** Get all pending confirmations. */
  getPendingConfirmations() {
    return Array.from(this.pendingConfirmations.values());
  }

  /** Get full safety status for UI. */
  describe() {
    return {
      currentTier: this.currentTier,
      tierRank: TIER_RANK[this.currentTier],
      allowed: {
        read: TIER_RANK[this.currentTier] >= TIER_RANK[PERMISSION_TIER.READ],
        suggest: TIER_RANK[this.currentTier] >= TIER_RANK[PERMISSION_TIER.SUGGEST],
        executeSafe: TIER_RANK[this.currentTier] >= TIER_RANK[PERMISSION_TIER.EXECUTE_SAFE],
        executeRisky: TIER_RANK[this.currentTier] >= TIER_RANK[PERMISSION_TIER.EXECUTE_RISKY]
      },
      protectedFolders: PROTECTED_FOLDERS.length,
      protectedProcesses: PROTECTED_PROCESSES.length,
      pendingConfirmations: this.pendingConfirmations.size,
      safeCleanPatterns: SAFE_CLEAN_PATTERNS.filter(p => !p.risky).length,
      riskyCleanPatterns: SAFE_CLEAN_PATTERNS.filter(p => p.risky).length
    };
  }

  _audit(action, detail) {
    this.auditLog.push({ action, detail, at: new Date().toISOString() });
    if (this.auditLog.length > 200) this.auditLog = this.auditLog.slice(-200);
  }
}

export const safetyLayerInstance = new SafetyLayer();
export default safetyLayerInstance;
