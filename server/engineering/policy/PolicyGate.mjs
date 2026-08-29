/**
 * PolicyGate.mjs
 * Supervised Self-Healing Policy & Permission Gatekeeper.
 * Default Mode: LEVEL 3 (Sandbox Fix + Human Review & Approval).
 */

import { SelfHealingLevel, RiskClassification } from '../types/IncidentTypes.mjs';

export const LEVEL_4_AUTO_WHITELIST = [
  'RETRY_IDEMPOTENT_REQUEST',
  'RESTART_WHITELISTED_SERVICE',
  'CLEAR_DISPOSABLE_CACHE',
  'RECONNECT_KNOWN_SAFE_CONNECTION',
  'ROTATE_TEMPORARY_WORKER'
];

export class PolicyGate {
  constructor() {
    this.currentLevel = SelfHealingLevel.LEVEL_3_SANDBOX_WITH_APPROVAL;
    this.auditLog = [];
  }

  setLevel(level) {
    if (level === SelfHealingLevel.LEVEL_5_FULL_AUTONOMOUS) {
      console.warn('âš ï¸ [PolicyGate] Level 5 is DISABLED by build policy.');
      return false;
    }
    this.currentLevel = level;
    console.log(`ðŸ›¡ï¸ [PolicyGate] Operating level set to LEVEL ${level}`);
    return true;
  }

  getLevel() {
    return this.currentLevel;
  }

  canAutoDiagnose() {
    return this.currentLevel >= SelfHealingLevel.LEVEL_2_AUTO_DIAGNOSE;
  }

  canPatchInSandbox() {
    return this.currentLevel >= SelfHealingLevel.LEVEL_3_SANDBOX_WITH_APPROVAL;
  }

  canAutoDeploy(actionType, riskLevel) {
    if (this.currentLevel >= SelfHealingLevel.LEVEL_4_AUTO_HEAL_LOW_RISK) {
      // Must be explicitly whitelisted and strictly LOW_RISK
      const isWhitelisted = LEVEL_4_AUTO_WHITELIST.includes(actionType);
      const isLowRisk = riskLevel === RiskClassification.LOW_RISK;
      return isWhitelisted && isLowRisk;
    }
    return false;
  }

  recordAudit(incidentId, action, outcome) {
    const entry = {
      timestamp: new Date().toISOString(),
      incidentId,
      action,
      outcome,
      level: this.currentLevel
    };
    this.auditLog.push(entry);
    return entry;
  }
}

export const policyGateInstance = new PolicyGate();
