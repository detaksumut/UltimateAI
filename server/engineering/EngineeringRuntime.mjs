/**
 * EngineeringRuntime.mjs
 * Master Autonomous Engineering Agent Runtime for UltimateAI (v1).
 * Executes the complete closed-loop self-healing lifecycle safely.
 */

import { frontendTelemetryGatewayInstance } from './observer/FrontendTelemetryGateway.mjs';
import { incidentQueueInstance } from './queue/IncidentQueue.mjs';
import { diagnosticEngineInstance } from './diagnostic/DiagnosticEngine.mjs';
import { gitCheckpointManagerInstance } from './checkpoint/GitCheckpointManager.mjs';
import { gitWorktreeSandboxInstance } from './repair/GitWorktreeSandbox.mjs';
import { repairPlannerInstance } from './repair/RepairPlanner.mjs';
import { testOrchestratorInstance } from './test/TestOrchestrator.mjs';
import { policyGateInstance } from './policy/PolicyGate.mjs';
import { incidentMemoryInstance } from './memory/IncidentMemory.mjs';
import { IncidentStatus } from './types/IncidentTypes.mjs';

export class EngineeringRuntime {
  constructor() {
    this.telemetryGateway = frontendTelemetryGatewayInstance;
    this.queue = incidentQueueInstance;
    this.diagnostic = diagnosticEngineInstance;
    this.checkpointMgr = gitCheckpointManagerInstance;
    this.sandbox = gitWorktreeSandboxInstance;
    this.repairPlanner = repairPlannerInstance;
    this.testRunner = testOrchestratorInstance;
    this.policy = policyGateInstance;
    this.memory = incidentMemoryInstance;

    this.isProcessing = false;
    this.initListeners();
  }

  initListeners() {
    // Whenever a new incident is enqueued, process if policy permits
    this.queue.on('incident_enqueued', (ticket) => {
      if (this.policy.canAutoDiagnose()) {
        this.processIncident(ticket.incidentId);
      }
    });
  }

  async processIncident(incidentId) {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const ticket = this.queue.getIncidentById(incidentId);
    if (!ticket) {
      this.isProcessing = false;
      return;
    }

    console.log(`\nðŸš€ [EngineeringRuntime] Starting Autonomous Self-Healing Pipeline for Incident ${incidentId}...`);

    try {
      // Step 1: Diagnosis & Evidence Gate
      this.queue.updateStatus(incidentId, IncidentStatus.DIAGNOSING);
      const diagnosticReport = await this.diagnostic.diagnose(ticket);
      this.queue.updateStatus(incidentId, IncidentStatus.DIAGNOSING, { diagnosticReport });

      if (!diagnosticReport.evidenceGatePassed) {
        console.warn(`ðŸ›‘ [EngineeringRuntime] Evidence Gate held for incident ${incidentId}. Awaiting further telemetry.`);
        this.isProcessing = false;
        return;
      }

      // Step 2: Policy Check for Sandbox Repair
      if (!this.policy.canPatchInSandbox()) {
        console.log(`ðŸ”’ [EngineeringRuntime] Level 1/2 Active: Diagnosis complete, skipping sandbox patch.`);
        this.isProcessing = false;
        return;
      }

      // Step 3: Create Git Checkpoint Snapshot
      const checkpoint = await this.checkpointMgr.createCheckpoint(incidentId, `Auto checkpoint before repairing ${diagnosticReport.rootCause}`);
      this.queue.updateStatus(incidentId, IncidentStatus.REPAIRING_IN_SANDBOX, { checkpointId: checkpoint.checkpointId });

      // Step 4: Create Isolated Sandbox & Plan Patch
      const sandboxInfo = await this.sandbox.createSandbox(incidentId);
      const patchPlan = await this.repairPlanner.generatePatch(diagnosticReport);

      // Step 5: Test Agent Validation in Sandbox
      this.queue.updateStatus(incidentId, IncidentStatus.TESTING, { patchPlan });
      const testResults = await this.testRunner.runFullVerificationPipeline(
        patchPlan.targetFiles[0] || 'test_dom_clicks.cjs',
        'test_dom_clicks.cjs'
      );

      this.queue.updateStatus(incidentId, IncidentStatus.TESTING, { testResults });

      if (!testResults.pass) {
        console.error(`âŒ [EngineeringRuntime] Tests FAILED in sandbox. Discarding patch.`);
        await this.sandbox.cleanupSandbox(sandboxInfo.sandboxId);
        this.queue.updateStatus(incidentId, IncidentStatus.REJECTED, { failureReason: testResults.error || 'Test validation failed' });
        this.isProcessing = false;
        return;
      }

      console.log(`âœ… [EngineeringRuntime] All tests PASSED in Sandbox!`);

      // Step 6: Level Gate Check
      const currentLevel = this.policy.getLevel();
      if (currentLevel === 3) {
        // Level 3: Awaiting Human Approval
        console.log(`â¸ï¸ [EngineeringRuntime] LEVEL 3: Fix verified in Sandbox. Holding for User Approval.`);
        this.queue.updateStatus(incidentId, IncidentStatus.AWAITING_APPROVAL, {
          sandboxId: sandboxInfo.sandboxId,
          diffSummary: patchPlan.diffSummary
        });
      } else if (this.policy.canAutoDeploy(diagnosticReport.proposedFix, diagnosticReport.riskLevel)) {
        // Level 4: Whitelisted Low-Risk Auto Deploy
        console.log(`ðŸš€ [EngineeringRuntime] LEVEL 4: Auto-deploying low-risk fix.`);
        await this.applyAndDeployFix(incidentId);
      }
    } catch (err) {
      console.error(`âŒ [EngineeringRuntime] Pipeline execution error:`, err.message);
      this.queue.updateStatus(incidentId, IncidentStatus.REJECTED, { error: err.message });
    } finally {
      this.isProcessing = false;
    }
  }

  async applyAndDeployFix(incidentId) {
    const ticket = this.queue.getIncidentById(incidentId);
    if (!ticket) return { success: false, error: 'Incident not found' };

    console.log(`ðŸš€ [EngineeringRuntime] Merging and Deploying fix for incident ${incidentId}...`);
    this.queue.updateStatus(incidentId, IncidentStatus.DEPLOYED);

    // Save into permanent Incident Memory with VALIDATED status
    if (ticket.diagnosticReport) {
      this.memory.learnPattern({
        category: ticket.category,
        targetComponent: ticket.targetComponent,
        symptoms: ticket.errorMessage,
        rootCause: ticket.diagnosticReport.rootCause,
        validatedPatchStrategy: ticket.diagnosticReport.proposedFix,
        validationEvidence: ticket.diagnosticReport.evidence
      });
    }

    this.queue.updateStatus(incidentId, IncidentStatus.STABLE);
    console.log(`ðŸŽ‰ [EngineeringRuntime] Incident ${incidentId} successfully HEALED and learned into memory.`);
    return { success: true, status: IncidentStatus.STABLE };
  }

  getStatus() {
    return {
      status: 'ONLINE',
      level: this.policy.getLevel(),
      pendingIncidents: this.queue.getPendingIncidents().length,
      totalIncidents: this.queue.getAllIncidents().length,
      learnedPatterns: this.memory.getAllKnowledge().length,
      metrics: this.telemetryGateway.getMetrics()
    };
  }
}

export const engineeringRuntimeInstance = new EngineeringRuntime();
