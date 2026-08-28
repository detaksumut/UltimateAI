import assert from 'assert';
import { voicePipelineCoordinatorInstance, VOICE_STATES } from '../../server/voice/VoicePipelineCoordinator.mjs';

console.log('========================================================================');
console.log('  TEST: VADIntegrationTest — Voice Activity Detection & Interruption Trigger');
console.log('========================================================================\n');

async function testVADIntegration() {
  const coordinator = voicePipelineCoordinatorInstance;

  // 1. When Idle / Listening, VAD starts speech
  coordinator.startListening();
  coordinator.processVADSpeechStart();
  assert.strictEqual(coordinator.state, VOICE_STATES.LISTENING);
  console.log('[1] VAD Speech Start in Listening State: Verified Normal Capture');

  // 2. Simulate SPEAKING state
  coordinator.state = VOICE_STATES.SPEAKING;
  console.log('[2] Simulated JIN State: SPEAKING');

  // 3. User begins speaking while JIN is speaking ➔ VAD triggers Instant Barge-In
  console.log('[3] VAD Detects Speech Energy during SPEAKING ➔ Triggering Barge-In');
  const bargeInResult = coordinator.processVADSpeechStart();

  assert(bargeInResult.interrupted, 'Barge-in must be marked as interrupted');
  assert.strictEqual(bargeInResult.reason, 'VAD_SPEECH_ACTIVITY_DETECTED');
  console.log('  Interruption Reason:', bargeInResult.reason);

  console.log('\n========================================================================');
  console.log('  ✅ [PASS] VADIntegrationTest: 100% SUCCESS');
  console.log('========================================================================\n');
}

testVADIntegration().catch(err => {
  console.error('❌ [FAIL] VADIntegrationTest:', err);
  process.exit(1);
});
