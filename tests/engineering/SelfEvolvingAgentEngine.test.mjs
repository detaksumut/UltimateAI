import assert from 'node:assert/strict';
import { SelfEvolvingAgentEngine } from '../../server/engineering/SelfEvolvingAgentEngine.mjs';

async function run() {
  const engine = new SelfEvolvingAgentEngine();

  // Explicit repair requests must not depend on a prior conversation history.
  assert.equal(
    engine.detectUserCorrection('Perbaiki kode JINI pada AgentRuntime'),
    true,
    'explicit repair intent should be recognized without history'
  );
  assert.equal(
    engine.detectUserCorrection('Please fix the source file that handles runtime errors'),
    true,
    'English explicit repair intent should be recognized without history'
  );

  // A generic complaint alone must not authorize a repair.
  assert.equal(engine.detectUserCorrection('Perbaiki gambar ini'), false);
  assert.equal(engine.detectUserCorrection('masih tidak bisa', []), false);
  assert.equal(
    engine.detectUserCorrection('masih tidak bisa', [
      { role: 'user', content: 'Jalankan tugas' },
      { role: 'assistant', content: 'Selesai' }
    ]),
    true,
    'a correction signal with prior conversation should be detected'
  );

  // The target gate must accept a concrete source and reject path traversal or sensitive locations.
  assert.equal(
    engine.validateRepairTarget('server/engineering/SelfEvolvingAgentEngine.mjs'),
    'server/engineering/SelfEvolvingAgentEngine.mjs'
  );
  assert.equal(engine.validateRepairTarget('../../outside.mjs'), null);
  assert.equal(engine.validateRepairTarget('server/.env'), null);
  assert.equal(engine.validateRepairTarget('server/engineering/policy/PolicyGate.mjs'), null);

  // Ensure the analysis contract treats the model output as an unverified candidate.
  const originalAdapter = engine.nineRouter;
  engine.nineRouter = {
    async sendChat() {
      return JSON.stringify({
        identifiedFailure: 'A reproducible failure was reported.',
        rootCause: 'Hypothesis requiring verification.',
        targetSubsystem: 'server/agent/AgentRuntime.mjs',
        evolvedRule: 'Add a focused regression test before promoting a fix.',
        actionCategory: 'SCRIPT_REFINEMENT',
        remediationSummary: 'Candidate analysis only.',
        suggestedOutput: 'The fix has not yet been verified.'
      });
    }
  };
  try {
    const analysis = await engine.introspectWithNineRouter({
      userComplaint: 'perbaiki kode JINI',
      lastUserPrompt: 'run action',
      lastAssistantResponse: 'The action failed.'
    });
    assert.equal(analysis.validationStatus, 'NOT_TESTED');
    assert.equal(analysis.analysisSource, 'NINEROUTER_CANDIDATE_ANALYSIS');
    assert.equal(analysis.targetSubsystem, 'server/agent/AgentRuntime.mjs');
  } finally {
    engine.nineRouter = originalAdapter;
  }

  console.log('[PASS] Self-evolving trigger, target policy, and unverified-analysis contract');
}

run().catch((error) => {
  console.error('[FAIL] Self-evolving engine regression:', error.stack || error.message);
  process.exitCode = 1;
});
