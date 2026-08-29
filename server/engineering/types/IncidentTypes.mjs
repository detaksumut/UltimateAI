/**
 * IncidentTypes.mjs
 * Data contracts and schemas for UltimateAI Autonomous Engineering Agent.
 */

export const IncidentSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

export const IncidentStatus = {
  DETECTED: 'DETECTED',
  DIAGNOSING: 'DIAGNOSING',
  REPAIRING_IN_SANDBOX: 'REPAIRING_IN_SANDBOX',
  TESTING: 'TESTING',
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  DEPLOYED: 'DEPLOYED',
  STABLE: 'STABLE',
  ROLLED_BACK: 'ROLLED_BACK',
  REJECTED: 'REJECTED'
};

export const SelfHealingLevel = {
  LEVEL_1_OBSERVE_ONLY: 1,
  LEVEL_2_AUTO_DIAGNOSE: 2,
  LEVEL_3_SANDBOX_WITH_APPROVAL: 3, // Default & Recommended
  LEVEL_4_AUTO_HEAL_LOW_RISK: 4,
  LEVEL_5_FULL_AUTONOMOUS: 5 // Locked by default
};

export const RiskClassification = {
  LOW_RISK: 'LOW_RISK',
  MEDIUM_RISK: 'MEDIUM_RISK',
  HIGH_RISK: 'HIGH_RISK',
  CRITICAL_RISK: 'CRITICAL_RISK'
};

export function createIncidentTicket({
  source = 'frontend',
  category = 'DOM_INTERACTION_FAILURE',
  errorMessage = '',
  targetComponent = '',
  elementSelector = '',
  stackTrace = '',
  severity = IncidentSeverity.MEDIUM,
  metadata = {}
}) {
  return {
    incidentId: `INC-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    source,
    category,
    errorMessage,
    targetComponent,
    elementSelector,
    stackTrace,
    severity,
    frequency: 1,
    status: IncidentStatus.DETECTED,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    evidence: [],
    diagnosticReport: null,
    checkpointId: null,
    appliedPatch: null,
    testResults: null,
    metadata
  };
}
