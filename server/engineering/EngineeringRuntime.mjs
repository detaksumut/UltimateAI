/**
 * EngineeringRuntime.mjs
 * Supervised closed-loop self-repair runtime.
 *
 * Automatic phases: detect -> diagnose -> isolated worktree -> generate patch
 * + regression test -> execute tests/build -> persist evidence -> await approval.
 * Production source is never changed by the automatic phase. A separate explicit
 * approval method re-tests and fast-forwards the verified repair branch.
 */

import { frontendTelemetryGatewayInstance } from './observer/FrontendTelemetryGateway.mjs';
import { incidentQueueInstance } from './queue/IncidentQueue.mjs';
import { diagnosticEngineInstance } from './diagnostic/DiagnosticEngine.mjs';
import { gitCheckpointManagerInstance } from './checkpoint/GitCheckpointManager.mjs';
import { gitWorktreeSandboxInstance } from './repair/GitWorktreeSandbox.mjs';
import { repairPlannerInstance } from './repair/RepairPlanner.mjs';
import { TestOrchestrator } from './test/TestOrchestrator.mjs';
import { policyGateInstance } from './policy/PolicyGate.mjs';
import { incidentMemoryInstance } from './memory/IncidentMemory.mjs';
import { IncidentStatus } from './types/IncidentTypes.mjs';

export class EngineeringRuntime {
  constructor(options = {}) {
    this.workspaceRoot = options.workspaceRoot || process.cwd();
    this.telemetryGateway = options.telemetryGateway || frontendTelemetryGatewayInstance;
    this.queue = options.queue || incidentQueueInstance;
    this.diagnostic = options.diagnostic || diagnosticEngineInstance;
    this.checkpointMgr = options.checkpointMgr || gitCheckpointManagerInstance;
    this.sandbox = options.sandbox || gitWorktreeSandboxInstance;
    this.repairPlanner = options.repairPlanner || repairPlannerInstance;
    this.policy = options.policy || policyGateInstance;
    this.memory = options.memory || incidentMemoryInstance;

    this.isProcessing = false;
    this.pendingIncidentIds = [];
    this.processingIncidentIds = new Set();
    this.initListeners();
  }

  initListeners() {
    if (this._listenerInitialized) return;
    this._listenerInitialized = true;
    this.queue.on('incident_enqueued', (ticket) => {
      if (this.policy.canAutoDiagnose()) {
        this.processIncident(ticket.incidentId).catch((err) => {
          console.error('[EngineeringRuntime] Queue pump error:', err.message);
        });
      }
    });
  }

  async processIncident(incidentId) {
    const id = String(incidentId || '');
    if (!id) return { success: false, error: 'INCIDENT_ID_REQUIRED' };
    if (this.processingIncidentIds.has(id) || this.pendingIncidentIds.includes(id)) {
      return { success: true, status: 'ALREADY_QUEUED', incidentId: id };
    }

    this.pendingIncidentIds.push(id);
    if (this.isProcessing) return { success: true, status: 'QUEUED', incidentId: id };

    this.isProcessing = true;
    const results = [];
    try {
      while (this.pendingIncidentIds.length) {
        const nextId = this.pendingIncidentIds.shift();
        this.processingIncidentIds.add(nextId);
        try {
          results.push(await this._processIncident(nextId));
        } catch (err) {
          console.error('[EngineeringRuntime] Incident pipeline failed:', err.message);
          this.queue.updateStatus(nextId, IncidentStatus.REJECTED, {
            failureReason: err.message,
            validationStatus: 'FAILED',
            runtimePatched: false
          });
          this.policy.recordAudit(nextId, 'SELF_REPAIR_PIPELINE', { success: false, error: err.message });
          results.push({ success: false, incidentId: nextId, error: err.message });
        } finally {
          this.processingIncidentIds.delete(nextId);
        }
      }
    } finally {
      this.isProcessing = false;
    }
    return results.length === 1 ? results[0] : { success: results.every((x) => x.success), results };
  }

  async _processIncident(incidentId) {
    const ticket = this.queue.getIncidentById(incidentId);
    if (!ticket) return { success: false, incidentId, error: 'INCIDENT_NOT_FOUND' };
    if ([IncidentStatus.AWAITING_APPROVAL, IncidentStatus.MERGED_AWAITING_DEPLOY, IncidentStatus.STABLE].includes(ticket.status)) {
      return { success: true, incidentId, status: ticket.status, skipped: true };
    }

    console.log('[EngineeringRuntime] Starting supervised repair lifecycle for', incidentId);
    this.queue.updateStatus(incidentId, IncidentStatus.DIAGNOSING);

    const diagnosticReport = await this.diagnostic.diagnose(ticket);
    this.queue.updateStatus(incidentId, IncidentStatus.DIAGNOSING, { diagnosticReport });

    if (!diagnosticReport?.evidenceGatePassed) {
      const reason = 'Diagnostic evidence gate did not pass; no source code was changed.';
      this.queue.updateStatus(incidentId, IncidentStatus.NEEDS_MANUAL_REVIEW, {
        failureReason: reason,
        validationStatus: 'NOT_RUN',
        runtimePatched: false
      });
      this.policy.recordAudit(incidentId, 'DIAGNOSE', { success: false, reason });
      return { success: false, incidentId, status: IncidentStatus.NEEDS_MANUAL_REVIEW, reason };
    }

    if (!this.policy.canPatchInSandbox()) {
      const reason = 'Current policy permits diagnosis only; sandbox patching is disabled.';
      this.queue.updateStatus(incidentId, IncidentStatus.NEEDS_MANUAL_REVIEW, { failureReason: reason, runtimePatched: false });
      this.policy.recordAudit(incidentId, 'SANDBOX_POLICY_GATE', { success: false, reason });
      return { success: false, incidentId, status: IncidentStatus.NEEDS_MANUAL_REVIEW, reason };
    }

    const checkpoint = await this.checkpointMgr.createCheckpoint(
      incidentId,
      'Before supervised self-repair: ' + String(diagnosticReport.rootCause || '').slice(0, 180)
    );
    this.queue.updateStatus(incidentId, IncidentStatus.REPAIRING_IN_SANDBOX, { checkpointId: checkpoint.checkpointId });

    const sandboxInfo = await this.sandbox.createSandbox(incidentId);
    let keepSandboxForReview = false;

    try {
      const patchPlan = await this.repairPlanner.generatePatch(diagnosticReport);
      if (!patchPlan?.readyForSandbox || !Array.isArray(patchPlan.changes) || patchPlan.changes.length < 2) {
        await this.sandbox.cleanupSandbox(sandboxInfo.sandboxId);
        const reason = patchPlan?.error || 'Repair planner did not return a guarded source patch and regression test.';
        this.queue.updateStatus(incidentId, IncidentStatus.NEEDS_MANUAL_REVIEW, {
          patchPlan,
          failureReason: reason,
          validationStatus: 'NOT_RUN',
          runtimePatched: false,
          sandboxId: null
        });
        this.policy.recordAudit(incidentId, 'PATCH_PLANNING', { success: false, reason });
        return { success: false, incidentId, status: IncidentStatus.NEEDS_MANUAL_REVIEW, reason };
      }

      for (const change of patchPlan.changes) {
        await this.sandbox.applyPatchToSandbox(sandboxInfo.sandboxId, change.path, change.content, {
          expectedSha256: change.expectedSha256
        });
      }

      this.queue.updateStatus(incidentId, IncidentStatus.TESTING, {
        patchPlan,
        sandboxId: sandboxInfo.sandboxId,
        sandboxPath: sandboxInfo.path,
        branchName: sandboxInfo.branchName,
        baseCommit: sandboxInfo.baseCommit
      });

      const testRunner = new TestOrchestrator(sandboxInfo.path);
      const testSyntax = await testRunner.runSyntaxValidation(patchPlan.testFiles);
      if (!testSyntax.pass) {
        const failed = {
          pass: false,
          failedStage: 'REGRESSION_TEST_SYNTAX',
          error: 'Generated regression test does not parse.',
          results: [testSyntax]
        };
        await this.sandbox.cleanupSandbox(sandboxInfo.sandboxId);
        this.queue.updateStatus(incidentId, IncidentStatus.REJECTED, {
          testResults: failed,
          failureReason: failed.error,
          validationStatus: 'FAILED',
          runtimePatched: false
        });
        this.policy.recordAudit(incidentId, 'VERIFY_REGRESSION_TEST', { success: false, failedStage: failed.failedStage });
        return { success: false, incidentId, status: IncidentStatus.REJECTED, testResults: failed, reason: failed.error };
      }

      // Prove the generated regression test is not vacuous: run it against the
      // exact committed baseline first. Only an assertion failure proves that
      // it catches the original behavior; import/syntax/runtime failures do not.
      const sourceChanges = patchPlan.changes.filter((change) => change.kind === 'SOURCE');
      let baselineGate = null;
      if (!sourceChanges.length) {
        baselineGate = { stage: 'BASELINE_REGRESSION', pass: false, error: 'No source file was supplied for baseline comparison.' };
      } else {
        const baselineContents = [];
        try {
          for (const change of sourceChanges) {
            baselineContents.push({
              path: change.path,
              content: await this.sandbox.readFileAtBaseCommit(sandboxInfo.sandboxId, change.path)
            });
          }
          for (const baseline of baselineContents) {
            await this.sandbox.applyPatchToSandbox(sandboxInfo.sandboxId, baseline.path, baseline.content);
          }
          const baselineResults = await testRunner.runRegressionTests(patchPlan.testFiles);
          const assertionFailureOnly = baselineResults.results.length > 0 &&
            baselineResults.results.every((result) => {
              if (result.pass) return false;
              const combined = String(result.error || '') + '\n' + String(result.output || '');
              return /AssertionError|ERR_ASSERTION|Assertion failed/i.test(combined);
            });
          baselineGate = {
            stage: 'BASELINE_REGRESSION',
            pass: assertionFailureOnly,
            assertionFailureObserved: assertionFailureOnly,
            results: baselineResults.results,
            error: assertionFailureOnly ? null : 'Regression test did not fail specifically on a baseline assertion; test may be vacuous or invalid.'
          };
        } catch (err) {
          baselineGate = {
            stage: 'BASELINE_REGRESSION',
            pass: false,
            error: 'Baseline preflight failed: ' + String(err.message || err)
          };
        } finally {
          // Always restore the proposed candidate before proceeding or cleanup.
          for (const change of sourceChanges) {
            try {
              await this.sandbox.applyPatchToSandbox(sandboxInfo.sandboxId, change.path, change.content);
            } catch (restoreErr) {
              baselineGate = {
                stage: 'BASELINE_REGRESSION',
                pass: false,
                error: 'Could not restore proposed patch after baseline test: ' + String(restoreErr.message || restoreErr)
              };
            }
          }
        }
      }

      if (!baselineGate || !baselineGate.pass) {
        const reason = baselineGate?.error || 'Regression test was not demonstrated to fail on the original implementation.';
        const failed = { pass: false, failedStage: 'BASELINE_REGRESSION', error: reason, results: [testSyntax, baselineGate] };
        await this.sandbox.cleanupSandbox(sandboxInfo.sandboxId);
        this.queue.updateStatus(incidentId, IncidentStatus.REJECTED, {
          testResults: failed,
          failureReason: reason,
          validationStatus: 'FAILED',
          runtimePatched: false,
          sandboxId: null,
          sandboxPath: null,
          branchName: null
        });
        this.policy.recordAudit(incidentId, 'VERIFY_BASELINE_REGRESSION', { success: false, reason });
        return { success: false, incidentId, status: IncidentStatus.REJECTED, testResults: failed, reason };
      }

      const verification = await testRunner.runFullVerificationPipeline({
        changedFiles: patchPlan.changes.map((change) => change.path),
        testFiles: patchPlan.testFiles
      });
      const testResults = {
        ...verification,
        baselineRegression: baselineGate,
        results: [baselineGate, ...(verification.results || [])],
        baselineRegressionVerified: true
      };
      this.queue.updateStatus(incidentId, IncidentStatus.TESTING, { testResults });

      if (!testResults.pass) {
        await this.sandbox.cleanupSandbox(sandboxInfo.sandboxId);
        const reason = testResults.error || 'Syntax, regression test, or build validation failed.';
        this.queue.updateStatus(incidentId, IncidentStatus.REJECTED, {
          failureReason: reason,
          validationStatus: 'FAILED',
          runtimePatched: false,
          sandboxId: null,
          sandboxPath: null,
          branchName: null
        });
        this.policy.recordAudit(incidentId, 'VERIFY_PATCH', { success: false, failedStage: testResults.failedStage, reason });
        return { success: false, incidentId, status: IncidentStatus.REJECTED, testResults, reason };
      }

      const inspection = await this.sandbox.inspectSandbox(sandboxInfo.sandboxId);
      if (!inspection.status.trim() && !inspection.diff.trim()) {
        await this.sandbox.cleanupSandbox(sandboxInfo.sandboxId);
        const reason = 'PATCH_EMPTY: validation passed but no source diff exists.';
        this.queue.updateStatus(incidentId, IncidentStatus.REJECTED, { failureReason: reason, validationStatus: 'FAILED', runtimePatched: false });
        return { success: false, incidentId, status: IncidentStatus.REJECTED, reason };
      }

      let commitResult = null;
      let commitWarning = null;
      try {
        commitResult = await this.sandbox.commitSandboxChanges(sandboxInfo.sandboxId, 'fix: supervised JINI repair ' + incidentId);
      } catch (err) {
        // Git identity may not be configured. A passing, reviewable worktree is
        // kept; approval can retry the commit after the operator configures Git.
        commitWarning = err.message;
        console.warn('[EngineeringRuntime] Patch passed tests but could not be committed yet:', err.message);
      }

      keepSandboxForReview = true;
      const validatedAt = new Date().toISOString();
      this.queue.updateStatus(incidentId, IncidentStatus.AWAITING_APPROVAL, {
        sandboxId: sandboxInfo.sandboxId,
        sandboxPath: sandboxInfo.path,
        branchName: sandboxInfo.branchName,
        baseCommit: sandboxInfo.baseCommit,
        repairCommit: commitResult?.commit || null,
        changedFiles: patchPlan.changes.map((change) => change.path),
        patchPlan,
        diffSummary: patchPlan.diffSummary,
        testResults,
        validationStatus: 'PASSED',
        verifiedAt: validatedAt,
        approvalRequired: true,
        approvedBy: null,
        runtimePatched: false,
        commitWarning
      });

      this.memory.proposePattern({
        category: ticket.category,
        targetComponent: ticket.targetComponent,
        symptoms: ticket.errorMessage,
        rootCause: diagnosticReport.rootCause,
        candidateStrategy: patchPlan.diffSummary,
        validationEvidence: JSON.stringify({
          status: 'PASSED_IN_ISOLATED_WORKTREE',
          testResults: testResults.results,
          branchName: sandboxInfo.branchName,
          repairCommit: commitResult?.commit || null
        })
      });
      this.policy.recordAudit(incidentId, 'VERIFY_PATCH', {
        success: true,
        status: IncidentStatus.AWAITING_APPROVAL,
        branchName: sandboxInfo.branchName,
        testStages: testResults.results.map((item) => ({ stage: item.stage, pass: item.pass }))
      });

      return {
        success: true,
        incidentId,
        status: IncidentStatus.AWAITING_APPROVAL,
        validationStatus: 'PASSED',
        branchName: sandboxInfo.branchName,
        repairCommit: commitResult?.commit || null,
        testResults,
        approvalRequired: true
      };
    } catch (err) {
      if (!keepSandboxForReview) {
        await this.sandbox.cleanupSandbox(sandboxInfo.sandboxId).catch(() => {});
      }
      throw err;
    }
  }

  async approveAndMergeFix(incidentId, { approved = false, reviewer = '' } = {}) {
    const ticket = this.queue.getIncidentById(incidentId);
    if (!ticket) return { success: false, error: 'INCIDENT_NOT_FOUND' };
    if (approved !== true || !String(reviewer || '').trim()) {
      return { success: false, status: IncidentStatus.AWAITING_APPROVAL, error: 'Explicit approval and reviewer identity are required.' };
    }
    if (ticket.status !== IncidentStatus.AWAITING_APPROVAL ||
        ticket.validationStatus !== 'PASSED' ||
        ticket.testResults?.pass !== true) {
      return { success: false, error: 'REPAIR_NOT_VALIDATED: only a fully validated candidate can be approved.' };
    }

    const storedSandbox = {
      sandboxId: ticket.sandboxId,
      incidentId: ticket.incidentId,
      path: ticket.sandboxPath,
      branchName: ticket.branchName,
      baseCommit: ticket.baseCommit,
      repairCommit: ticket.repairCommit,
      changedFiles: ticket.changedFiles || [],
      status: 'AWAITING_APPROVAL'
    };
    let sandboxInfo = this.sandbox.activeSandboxes?.get(ticket.sandboxId);
    if (!sandboxInfo) sandboxInfo = await this.sandbox.restoreSandbox(storedSandbox);

    const { stdout: headRaw } = await this.sandbox.git(['rev-parse', 'HEAD'], { cwd: this.workspaceRoot });
    if (headRaw.trim() !== ticket.baseCommit) {
      return { success: false, error: 'BASE_MOVED: active branch changed since validation; rebase and re-run tests before approval.' };
    }
    const { stdout: statusRaw } = await this.sandbox.git(['status', '--porcelain', '--untracked-files=no'], { cwd: this.workspaceRoot });
    if (statusRaw.trim()) {
      return { success: false, error: 'ACTIVE_WORKTREE_DIRTY: commit or stash active changes before merge.' };
    }

    const testRunner = new TestOrchestrator(sandboxInfo.path);
    const revalidation = await testRunner.runFullVerificationPipeline({
      changedFiles: ticket.changedFiles || [],
      testFiles: ticket.patchPlan?.testFiles || []
    });
    if (!revalidation.pass) {
      this.queue.updateStatus(incidentId, IncidentStatus.REJECTED, {
        validationStatus: 'FAILED_ON_REVALIDATION',
        testResults: revalidation,
        failureReason: revalidation.error || 'Revalidation failed before approval merge.',
        runtimePatched: false
      });
      await this.sandbox.cleanupSandbox(ticket.sandboxId, { keepBranch: true });
      return { success: false, status: IncidentStatus.REJECTED, testResults: revalidation };
    }

    let commitResult;
    try {
      commitResult = await this.sandbox.commitSandboxChanges(ticket.sandboxId, 'fix: approved JINI repair ' + incidentId);
    } catch (err) {
      return { success: false, status: IncidentStatus.AWAITING_APPROVAL, error: 'COMMIT_FAILED: ' + err.message };
    }

    try {
      await this.sandbox.git(['merge', '--ff-only', sandboxInfo.branchName], { cwd: this.workspaceRoot, timeout: 30000 });
    } catch (err) {
      await this.sandbox.git(['merge', '--abort'], { cwd: this.workspaceRoot }).catch(() => {});
      this.queue.updateStatus(incidentId, IncidentStatus.AWAITING_APPROVAL, {
        repairCommit: commitResult.commit,
        commitWarning: 'Merge not completed: ' + err.message
      });
      return { success: false, status: IncidentStatus.AWAITING_APPROVAL, error: 'FAST_FORWARD_MERGE_FAILED: ' + err.message };
    }

    const finalStatus = IncidentStatus.MERGED_AWAITING_DEPLOY;
    this.queue.updateStatus(incidentId, finalStatus, {
      repairCommit: commitResult.commit,
      approvedBy: String(reviewer).trim().slice(0, 120),
      approvedAt: new Date().toISOString(),
      validationStatus: 'PASSED',
      testResults: revalidation,
      runtimePatched: true,
      deploymentStatus: 'NOT_DEPLOYED'
    });
    this.memory.learnPattern({
      category: ticket.category,
      targetComponent: ticket.targetComponent,
      symptoms: ticket.errorMessage,
      rootCause: ticket.diagnosticReport?.rootCause || 'Approved supervised repair',
      validatedPatchStrategy: ticket.patchPlan?.diffSummary || ticket.diagnosticReport?.proposedFix,
      validationEvidence: JSON.stringify({
        testResults: revalidation.results,
        commit: commitResult.commit,
        reviewer: String(reviewer).trim().slice(0, 120),
        approvalAt: new Date().toISOString()
      })
    });
    this.policy.recordAudit(incidentId, 'APPROVE_AND_MERGE', {
      success: true,
      reviewer: String(reviewer).trim().slice(0, 120),
      commit: commitResult.commit,
      deploymentStatus: 'NOT_DEPLOYED'
    });
    await this.sandbox.cleanupSandbox(ticket.sandboxId, { keepBranch: true });
    return {
      success: true,
      incidentId,
      status: finalStatus,
      commit: commitResult.commit,
      deploymentStatus: 'NOT_DEPLOYED',
      message: 'Repair was re-tested and merged locally. Production/Vercel deployment remains a separate step.'
    };
  }

  // Backwards-compatible name, but it no longer claims that a merge is a deploy.
  async applyAndDeployFix(incidentId, approval = {}) {
    return this.approveAndMergeFix(incidentId, approval);
  }

  getStatus() {
    return {
      status: 'ONLINE',
      level: this.policy.getLevel(),
      pendingIncidents: this.queue.getPendingIncidents().length,
      totalIncidents: this.queue.getAllIncidents().length,
      learnedPatterns: this.memory.getAllKnowledge().length,
      queuedRepairs: this.pendingIncidentIds.length,
      isProcessing: this.isProcessing,
      metrics: this.telemetryGateway.getMetrics()
    };
  }

  async getSystemHealth() {
    return {
      ...this.getStatus(),
      repairLifecycle: {
        automaticPhase: 'DIAGNOSE_PATCH_TEST_BUILD',
        productionMerge: 'EXPLICIT_APPROVAL_REQUIRED',
        deployment: 'SEPARATE_STEP',
        activeSandboxCount: this.sandbox.activeSandboxes?.size || 0
      }
    };
  }
}

export const engineeringRuntimeInstance = new EngineeringRuntime();
