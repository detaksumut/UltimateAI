import assert from 'assert';
import { voicePipelineCoordinatorInstance, VOICE_STATES } from '../../server/voice/VoicePipelineCoordinator.mjs';

console.log('========================================================================');
console.log('  TEST: VoicePipelineTest — Full Voice State Machine & Execution Flow');
console.log('========================================================================\n');

async function testVoicePipeline() {
  const coordinator = voicePipelineCoordinatorInstance;

  // 1. Initial State Check
  assert.strictEqual(coordinator.state, VOICE_STATES.IDLE, 'Initial state must be IDLE');
  console.log('[1] Initial State Verified: IDLE');

  // 2. Start Listening
  coordinator.startListening('session-test-001');
  assert.strictEqual(coordinator.state, VOICE_STATES.LISTENING, 'State must transition to LISTENING');
  console.log('[2] Start Listening Verified: State = LISTENING');

  // 3. Process STT Transcript and Execute Goal
  console.log('\n[3] Ingesting Voice Transcript: "Analisis laporan efisiensi sistem."');
  const executionPromise = coordinator.processSTTTranscript('Analisis laporan efisiensi sistem.', true);
  
  // Verify transient states
  assert(
    coordinator.state === VOICE_STATES.THINKING || 
    coordinator.state === VOICE_STATES.TOOL_EXECUTION || 
    coordinator.state === VOICE_STATES.TRANSCRIBING ||
    coordinator.state === VOICE_STATES.SPEAKING
  );

  const res = await executionPromise;
  assert(res.success, 'Voice execution must succeed');
  assert.strictEqual(coordinator.state, VOICE_STATES.SPEAKING, 'State must reach SPEAKING upon response synthesis');
  assert(res.speechOutput && res.speechOutput.length > 0, 'Must produce voice speech output');
  console.log('  JIN Spoke:', res.speechOutput);
  console.log('[3] Voice Execution Complete: State = SPEAKING');

  // 4. Speech Completion
  coordinator.completeSpeech();
  assert.strictEqual(coordinator.state, VOICE_STATES.IDLE, 'State must return to IDLE after speech');
  console.log('[4] Speech Completion Verified: State = IDLE');

  console.log('\n========================================================================');
  console.log('  ✅ [PASS] VoicePipelineTest: 100% SUCCESS');
  console.log('========================================================================\n');
}

testVoicePipeline().catch(err => {
  console.error('❌ [FAIL] VoicePipelineTest:', err);
  process.exit(1);
});
