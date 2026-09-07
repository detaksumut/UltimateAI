/**
 * DevicePolicy.mjs
 * Action-level policy gate for the JIN Device Intelligence module.
 *
 * Current phase = OBSERVE_ONLY. Everything is read/scan/analyze. No
 * destructive action is authorized yet; SAFE_ACTION / CONFIRM_REQUIRED /
 * HIGH_RISK foundations exist for the next phase but stay inert.
 */

export const DEVICE_ACTION_LEVELS = {
  OBSERVE_ONLY: 'OBSERVE_ONLY',             // Read status, scan, analyze, report (ACTIVE NOW)
  SAFE_ACTION: 'SAFE_ACTION',               // Future: cleanup whitelisted temp/cache
  CONFIRM_REQUIRED: 'CONFIRM_REQUIRED',     // Future: stop app, delete review candidate
  HIGH_RISK: 'HIGH_RISK'                    // Future: shutdown, destructive cleanup, registry
};

const LEVEL_RANK = {
  OBSERVE_ONLY: 0,
  SAFE_ACTION: 1,
  CONFIRM_REQUIRED: 2,
  HIGH_RISK: 3
};

/** Maps an action string to the minimum authorization level it needs. */
export const ACTION_LEVEL_MAP = {
  // Safe observation group — allowed in OBSERVE_ONLY
  scan: DEVICE_ACTION_LEVELS.OBSERVE_ONLY,
  analyze: DEVICE_ACTION_LEVELS.OBSERVE_ONLY,
  report: DEVICE_ACTION_LEVELS.OBSERVE_ONLY,
  classify: DEVICE_ACTION_LEVELS.OBSERVE_ONLY,
  diagnose: DEVICE_ACTION_LEVELS.OBSERVE_ONLY,

  // Future cleanup group — locked until a later phase
  cleanup_whitelisted_temp: DEVICE_ACTION_LEVELS.SAFE_ACTION,
  cleanup_safe_cache: DEVICE_ACTION_LEVELS.SAFE_ACTION,

  // Confirm-required group
  stop_application: DEVICE_ACTION_LEVELS.CONFIRM_REQUIRED,
  delete_review_candidate: DEVICE_ACTION_LEVELS.CONFIRM_REQUIRED,
  restart_runtime: DEVICE_ACTION_LEVELS.CONFIRM_REQUIRED,

  // High-risk group
  delete_user_files: DEVICE_ACTION_LEVELS.HIGH_RISK,
  delete_file: DEVICE_ACTION_LEVELS.HIGH_RISK,
  recursive_delete: DEVICE_ACTION_LEVELS.HIGH_RISK,
  destructive_cleanup: DEVICE_ACTION_LEVELS.HIGH_RISK,
  system_cleanup: DEVICE_ACTION_LEVELS.HIGH_RISK,
  shutdown: DEVICE_ACTION_LEVELS.HIGH_RISK,
  registry_modify: DEVICE_ACTION_LEVELS.HIGH_RISK,
  uninstall_software: DEVICE_ACTION_LEVELS.HIGH_RISK,
  process_kill: DEVICE_ACTION_LEVELS.HIGH_RISK,
  service_stop: DEVICE_ACTION_LEVELS.HIGH_RISK
};

export class DevicePolicy {
  constructor() {
    this.currentLevel = DEVICE_ACTION_LEVELS.OBSERVE_ONLY;
    this.auditLog = [];
    this.reason = 'Tahap pertama: OBSERVE + ANALYZE + DIAGNOSE. Tanpa tindakan destruktif.';
  }

  setLevel(level) {
    if (!LEVEL_RANK[level]) throw new Error(`Unknown device action level: ${level}`);
    this.currentLevel = level;
  }

  getLevel() {
    return this.currentLevel;
  }

  isAllowed(level) {
    return LEVEL_RANK[level] <= LEVEL_RANK[this.currentLevel];
  }

  /**
   * Guards an action.
   * @param {string} action - key from ACTION_LEVEL_MAP
   * @param {Object} [detail]
   * @returns {{ allowed: boolean, required: string, current: string, reason: string, action, detail }}
   */
  guard(action, detail = {}) {
    const required = ACTION_LEVEL_MAP[action] || DEVICE_ACTION_LEVELS.HIGH_RISK;
    const allowed = this.isAllowed(required);
    const entry = {
      action,
      required,
      current: this.currentLevel,
      allowed,
      reason: allowed ? 'Diizinkan oleh kebijakan berjalan.' : `Membutuhkan level ${required}, aktif saat ini ${this.currentLevel}.`,
      detail
    };
    this.auditLog.push({ ...entry, at: new Date().toISOString() });
    if (this.auditLog.length > 200) this.auditLog = this.auditLog.slice(-200);
    return entry;
  }

  /** Returns the decision matrix so callers/UI can show honest policy state. */
  describe() {
    return {
      currentLevel: this.currentLevel,
      reason: this.reason,
      phase: 'OBSERVE_ANALYZE_DIAGNOSE',
      allowed: {
        scan: this.isAllowed(DEVICE_ACTION_LEVELS.OBSERVE_ONLY),
        cleanup: this.isAllowed(DEVICE_ACTION_LEVELS.SAFE_ACTION),
        deleteReviewCandidate: this.isAllowed(DEVICE_ACTION_LEVELS.CONFIRM_REQUIRED),
        destructive: this.isAllowed(DEVICE_ACTION_LEVELS.HIGH_RISK)
      }
    };
  }
}

export const devicePolicyInstance = new DevicePolicy();
export default devicePolicyInstance;