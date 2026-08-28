import assert from 'assert';
import { voicePipelineCoordinatorInstance, VOICE_STATES } from '../../server/voice/VoicePipelineCoordinator.mjs';

console.log('========================================================================');
console.log('  TEST: HumanBargeInTest — Verbal Interruption & Seamless Resume Flow');
console.log('========================================================================\n');

async function testHumanBargeIn() {
  const coordinator = voicePipelineCoordinatorInstance;
  coordinator.startListening('barge-in-session');

  // 1. Initial execution starts JIN speaking
  console.log('[1] User: "Analisis performa sistem dan jelaskan secara detail."');
  const initialTask = await coordinator.processSTTTranscript('Analisis performa sistem dan jelaskan secara detail.', true);
  
  assert.strictEqual(coordinator.state, VOICE_STATES.SPEAKING, 'JIN must be in SPEAKING state');
  console.log('  JIN Speaking:', initialTask.speechOutput);

  // 2. Human Interruption occurs while JIN is speaking
  const bargeInPhrase = 'Tunggu, jangan lanjut dulu.';
  console.log(`\n[2] Human Interruption Detected: "${bargeInPhrase}"`);
  
  const interruptionResult = coordinator.processSTTTranscript(bargeInPhrase, true);
  assert(interruptionResult.interrupted, 'Interruption must be registered');
  assert(coordinator.preservedContext, 'Conversation context must be preserved');
  console.log('  Preserved Context Goal:', coordinator.preservedContext.lastGoal);
  console.log('  State after Barge-In:   ', coordinator.state);

  // 3. User says "Lanjutkan"
  const resumePhrase = 'Lanjutkan.';
  console.log(`\n[3] User Instructs: "${resumePhrase}"`);
  
  const resumeResult = await coordinator.processSTTTranscript(resumePhrase, true);
  assert(resumeResult.success, 'Resumed task must succeed');
  assert.strictEqual(coordinator.state, VOICE_STATES.SPEAKING, 'JIN resumes speech output');
  console.log('  JIN Resumed Speech:', resumeResult.speechOutput);

  console.log('\n========================================================================');
  console.log('  ✅ [PASS] HumanBargeInTest: 100% SUCCESS');
  console.log('========================================================================\n');
}

testHumanBargeIn().catch(err => {
  console.error('❌ [FAIL] HumanBargeInTest:', err);
  process.exit(1);
});
