#!/usr/bin/env node
/**
 * Explicit local approval for a verified JINI repair.
 *
 * Usage: node scripts/approve-jin-repair.mjs INC-...
 * The command re-runs regression tests and the build before merging the
 * isolated repair branch into the current local branch. It does NOT deploy,
 * push to GitHub, or trigger Vercel.
 */
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { engineeringRuntimeInstance } from '../server/engineering/EngineeringRuntime.mjs';
import { IncidentStatus } from '../server/engineering/types/IncidentTypes.mjs';

const incidentId = String(process.argv[2] || '').trim();
if (!incidentId) {
  console.error('Usage: node scripts/approve-jin-repair.mjs <incident-id>');
  process.exit(2);
}

const ticket = engineeringRuntimeInstance.queue.getIncidentById(incidentId);
if (!ticket) {
  console.error('Incident not found:', incidentId);
  process.exit(1);
}
if (ticket.status !== IncidentStatus.AWAITING_APPROVAL ||
    ticket.validationStatus !== 'PASSED' ||
    ticket.testResults?.pass !== true) {
  console.error('This incident is not a fully tested repair awaiting approval.');
  console.error(JSON.stringify({
    incidentId,
    status: ticket.status,
    validationStatus: ticket.validationStatus,
    testsPassed: Boolean(ticket.testResults?.pass)
  }, null, 2));
  process.exit(1);
}

console.log('\nJINI SELF-REPAIR REVIEW');
console.log('Incident     :', ticket.incidentId);
console.log('Summary      :', ticket.diffSummary || ticket.patchPlan?.diffSummary || '(no summary)');
console.log('Files        :', (ticket.changedFiles || []).join(', '));
console.log('Repair branch:', ticket.branchName);
console.log('Base commit  :', ticket.baseCommit);
console.log('Tests        :', (ticket.testResults.results || []).map((result) => result.stage + '=' + (result.pass ? 'PASS' : 'FAIL')).join(', '));
console.log('\nApproval will re-run tests/build and fast-forward merge into the current local Git branch.');
console.log('It will NOT push to GitHub or deploy to Vercel.\n');

const rl = readline.createInterface({ input, output });
try {
  const confirmation = (await rl.question('Type "MERGE ' + incidentId + '" to approve this exact repair: ')).trim();
  if (confirmation !== 'MERGE ' + incidentId) {
    console.log('Approval cancelled. No source changes made.');
    process.exitCode = 1;
  } else {
    const reviewer = (await rl.question('Reviewer identity (name/initials): ')).trim();
    if (!reviewer) {
      console.error('Reviewer identity is required. No source changes made.');
      process.exitCode = 1;
    } else {
      const result = await engineeringRuntimeInstance.approveAndMergeFix(incidentId, {
        approved: true,
        reviewer
      });
      console.log(JSON.stringify(result, null, 2));
      if (!result.success) process.exitCode = 1;
    }
  }
} finally {
  rl.close();
}
