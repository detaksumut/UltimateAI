import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import EventEmitter from 'node:events';

import { EngineeringRuntime } from '../../server/engineering/EngineeringRuntime.mjs';
import { GitWorktreeSandbox } from '../../server/engineering/repair/GitWorktreeSandbox.mjs';
import { GitCheckpointManager } from '../../server/engineering/checkpoint/GitCheckpointManager.mjs';
import { TestOrchestrator } from '../../server/engineering/test/TestOrchestrator.mjs';
import { IncidentStatus } from '../../server/engineering/types/IncidentTypes.mjs';

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function makeTempRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jin-self-repair-test-'));
  fs.mkdirSync(path.join(root, 'server'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    name: 'jin-self-repair-fixture',
    version: '1.0.0',
    type: 'module',
    scripts: { build: 'node --check server/subject.mjs' }
  }, null, 2));
  fs.writeFileSync(path.join(root, 'server', 'subject.mjs'), "export function describeSubject() { return 'wrong'; }\n");
  git(root, ['init', '-b', 'main']);
  git(root, ['config', 'user.name', 'JIN Repair Test']);
  git(root, ['config', 'user.email', 'jin-repair-test@example.invalid']);
  git(root, ['add', 'package.json', 'server/subject.mjs']);
  git(root, ['commit', '-m', 'test fixture']);
  return root;
}

class FakeQueue extends EventEmitter {
  constructor(ticket) {
    super();
    this.ticket = ticket;
  }
  getIncidentById(id) { return this.ticket.incidentId === id ? this.ticket : null; }
  getPendingIncidents() { return [this.ticket].filter((ticket) => [IncidentStatus.DETECTED, IncidentStatus.DIAGNOSING, IncidentStatus.AWAITING_APPROVAL, IncidentStatus.NEEDS_MANUAL_REVIEW].includes(ticket.status)); }
  getAllIncidents() { return [this.ticket]; }
  updateStatus(id, status, extra = {}) {
    if (id !== this.ticket.incidentId) return null;
    Object.assign(this.ticket, extra, { status, updatedAt: new Date().toISOString() });
    this.emit('incident_updated', this.ticket);
    return this.ticket;
  }
}

async function run() {
  const root = makeTempRepo();
  const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jin-self-repair-sandboxes-'));
  const originalSource = fs.readFileSync(path.join(root, 'server', 'subject.mjs'), 'utf8');
  const ticket = {
    incidentId: 'INC-SELF-REPAIR-TEST',
    source: 'test',
    category: 'API_TIMEOUT_FAILURE',
    errorMessage: 'Regression: subject label is wrong',
    targetComponent: 'server/subject.mjs',
    stackTrace: '',
    severity: 'LOW',
    metadata: {},
    status: IncidentStatus.DETECTED,
    frequency: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const queue = new FakeQueue(ticket);
  const learned = [];
  const proposed = [];
  const memory = {
    proposePattern(record) { proposed.push(record); return record; },
    learnPattern(record) { learned.push(record); return record; },
    getAllKnowledge() { return [...learned, ...proposed]; }
  };
  const policy = {
    canAutoDiagnose: () => true,
    canPatchInSandbox: () => true,
    getLevel: () => 3,
    canAutoDeploy: () => false,
    recordAudit() { return {}; }
  };
  const diagnostic = {
    async diagnose(currentTicket) {
      return {
        incidentId: currentTicket.incidentId,
        suspectedComponent: 'server/subject.mjs',
        targetFiles: ['server/subject.mjs'],
        category: currentTicket.category,
        errorMessage: currentTicket.errorMessage,
        rootCause: 'Regression fixture intentionally returns the wrong label.',
        proposedFix: 'TEST_REPAIR',
        confidence: 0.99,
        riskLevel: 'LOW_RISK',
        evidence: ['Test fixture is reproducible.', 'Target file was identified explicitly.'],
        evidenceGatePassed: true
      };
    }
  };
  const repairPlanner = {
    async generatePatch(report) {
      const sourcePath = path.join(root, 'server', 'subject.mjs');
      const sourceContent = "export function describeSubject() { return 'fixed'; }\n";
      const testPath = 'tests/engineering/repair-generated/INC-SELF-REPAIR-TEST.test.mjs';
      const testContent = [
        "import assert from 'node:assert/strict';",
        "import { describeSubject } from '../../../server/subject.mjs';",
        "assert.equal(describeSubject(), 'fixed');",
        "console.log('Regression test passed');",
        ''
      ].join('\n');
      return {
        incidentId: report.incidentId,
        strategy: 'TEST_REPAIR',
        targetFiles: ['server/subject.mjs'],
        testFiles: [testPath],
        changes: [
          {
            path: 'server/subject.mjs',
            content: sourceContent,
            expectedSha256: crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'),
            kind: 'SOURCE'
          },
          { path: testPath, content: testContent, kind: 'REGRESSION_TEST' }
        ],
        diffSummary: 'Make describeSubject return the expected stable label.',
        readyForSandbox: true,
        needsManualReview: false
      };
    }
  };

  try {
    const sandbox = new GitWorktreeSandbox(root, { sandboxBaseDir: sandboxRoot });
    const checkpointMgr = new GitCheckpointManager(root);
    const runtime = new EngineeringRuntime({
      workspaceRoot: root,
      queue,
      diagnostic,
      checkpointMgr,
      sandbox,
      repairPlanner,
      policy,
      memory,
      telemetryGateway: { getMetrics: () => ({}) }
    });

    const firstPhase = await runtime.processIncident(ticket.incidentId);
    assert.equal(firstPhase.success, true, 'repair should complete all automatic verification stages');
    assert.equal(firstPhase.status, IncidentStatus.AWAITING_APPROVAL, 'validated patch must await explicit approval');
    assert.equal(firstPhase.validationStatus, 'PASSED');
    assert.equal(firstPhase.testResults.pass, true);
    assert.deepEqual(firstPhase.testResults.results.map((item) => item.stage), ['BASELINE_REGRESSION', 'SYNTAX_CHECK', 'REGRESSION_TESTS', 'BUILD_VERIFY']);
    assert.equal(firstPhase.testResults.baselineRegressionVerified, true, 'regression test must fail on original code before it can validate a fix');
    assert.equal(firstPhase.testResults.baselineRegression.pass, true);
    assert.equal(ticket.runtimePatched, false, 'main tree must not be changed before approval');
    assert.equal(fs.readFileSync(path.join(root, 'server', 'subject.mjs'), 'utf8'), originalSource);
    assert.ok(ticket.branchName.startsWith('jin/repair/'));
    assert.equal(proposed.length, 1, 'an unmerged candidate must be recorded as proposed, not validated knowledge');

    const missingTest = await new TestOrchestrator(root).runFullVerificationPipeline({
      changedFiles: ['server/subject.mjs'],
      testFiles: []
    });
    assert.equal(missingTest.pass, false, 'missing regression test must not be reported as success');
    assert.equal(missingTest.failedStage, 'REGRESSION_TESTS');

    assert.throws(
      () => sandbox._resolveAllowedPath('../../outside.txt'),
      /PATCH_PATH_INVALID/
    );

    const approval = await runtime.approveAndMergeFix(ticket.incidentId, { approved: true, reviewer: 'integration-test' });
    assert.equal(approval.success, true, 'explicit approval should revalidate and fast-forward merge the tested patch');
    assert.equal(approval.status, IncidentStatus.MERGED_AWAITING_DEPLOY);
    assert.equal(approval.deploymentStatus, 'NOT_DEPLOYED', 'local merge must not falsely claim deployment');
    assert.equal(fs.readFileSync(path.join(root, 'server', 'subject.mjs'), 'utf8'), "export function describeSubject() { return 'fixed'; }\n");
    assert.equal(learned.length, 1, 'only the approved and merged repair may become validated memory');
    assert.equal(ticket.runtimePatched, true);
    console.log('[PASS] Self-repair lifecycle: diagnose -> worktree patch -> regression test -> real build -> approval -> local merge');
  } finally {
    // Remove any linked worktrees and temporary fixtures even when an assertion fails.
    try { execFileSync('git', ['worktree', 'prune'], { cwd: root, stdio: 'ignore' }); } catch {}
    try { fs.rmSync(sandboxRoot, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
  }
}

run().catch((err) => {
  console.error('[FAIL] Self-repair lifecycle:', err.stack || err.message);
  process.exitCode = 1;
});
