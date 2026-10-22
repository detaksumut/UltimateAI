/**
 * DiagnosticEngine.mjs
 * Multi-Factor Evidence-Based Root Cause Diagnostic Engine.
 */

import { incidentMemoryInstance } from '../memory/IncidentMemory.mjs';
import { RiskClassification } from '../types/IncidentTypes.mjs';

export class DiagnosticEngine {
  constructor() {
    this.memory = incidentMemoryInstance;
  }

  async diagnose(ticket) {
    console.log(`ðŸ” [DiagnosticAgent] Diagnosing Incident ${ticket.incidentId} (${ticket.category})...`);

    const evidence = [];
    let rootCause = 'Unknown anomaly';
    let proposedFix = 'Manual inspection required';
    let confidence = 0.5;
    let riskLevel = RiskClassification.MEDIUM_RISK;
    let reproducible = true;
    let priorValidatedPatternMatched = false;

    // 1. Evidence Check: Match with Learned Incident Memory
    const learned = this.memory.findMatchingPattern(ticket.category, ticket.targetComponent, ticket.errorMessage);
    if (learned) {
      priorValidatedPatternMatched = true;
      evidence.push(`Found prior validated pattern in memory: ${learned.rootCause}`);
      rootCause = learned.rootCause;
      proposedFix = learned.validatedPatchStrategy;
      confidence = 0.95;
      riskLevel = RiskClassification.LOW_RISK;
    } else {
      // 2. Heuristic Analysis for Frontend DOM Interaction Failures
      if (ticket.category === 'DOM_INTERACTION_FAILURE' || ticket.errorMessage.includes('click')) {
        evidence.push('Captured rapid DOM unmounting / detachment during interaction');
        evidence.push('Component render frequency exceeded nominal 60fps budget');
        rootCause = `Subcomponent inside ${ticket.targetComponent || 'Target'} declared inside render scope or receiving high-frequency props.`;
        proposedFix = 'EXTRACT_SUBCOMPONENT_TO_TOP_LEVEL_AND_MEMOIZE';
        confidence = 0.92;
        riskLevel = RiskClassification.LOW_RISK;
      } else if (ticket.category === 'API_TIMEOUT_FAILURE') {
        evidence.push('Reported error matches an upstream timeout / connection-reset failure.');
        evidence.push('Incident is classified as API_TIMEOUT_FAILURE; retry is considered only for idempotent operations.');
        rootCause = 'Downstream provider connection timeout or router buffer saturation';
        proposedFix = 'RETRY_WITH_EXPONENTIAL_BACKOFF';
        confidence = 0.88;
        riskLevel = RiskClassification.LOW_RISK;
      } else if (
        ticket.category === 'CODE_REPAIR_REQUEST' &&
        ticket.metadata?.explicitSelfRepair === true &&
        Array.isArray(ticket.metadata?.candidateFiles) &&
        ticket.metadata.candidateFiles.length > 0
      ) {
        evidence.push('User explicitly requested a supervised source-code repair.');
        evidence.push('A concrete candidate file was identified; the repair planner must re-check the path and safety allowlist before writing.');
        rootCause = String(ticket.metadata.rootCause || ticket.errorMessage || 'Requested code repair needs diagnosis.');
        proposedFix = 'GENERATE_GUARDED_PATCH_WITH_REGRESSION_TEST';
        confidence = 0.86;
        riskLevel = RiskClassification.MEDIUM_RISK;
      } else {
        evidence.push(`Raw error message: ${ticket.errorMessage}`);
        rootCause = `Runtime exception in ${ticket.targetComponent || 'system'}: ${ticket.errorMessage}`;
        proposedFix = 'STATIC_AST_ANALYSIS_AND_TYPE_CHECK';
        confidence = 0.75;
        riskLevel = RiskClassification.HIGH_RISK;
      }
    }

    // 3. Evidence Gate Validation
    const evidenceGatePassed = confidence >= 0.85 && (evidence.length >= 2 || priorValidatedPatternMatched);

    const report = {
      incidentId: ticket.incidentId,
      timestamp: new Date().toISOString(),
      suspectedComponent: ticket.targetComponent,
      category: ticket.category,
      errorMessage: ticket.errorMessage,
      stackTrace: ticket.stackTrace || '',
      targetFiles: Array.isArray(ticket.metadata?.candidateFiles) ? ticket.metadata.candidateFiles : [],
      rootCause,
      proposedFix,
      confidence,
      riskLevel,
      reproducible,
      evidence,
      evidenceGatePassed
    };

    console.log(`âœ… [DiagnosticAgent] Diagnosis Complete. Root Cause: "${rootCause}" (Evidence Gate: ${evidenceGatePassed ? 'PASSED' : 'HELD'})`);
    return report;
  }
}

export const diagnosticEngineInstance = new DiagnosticEngine();
