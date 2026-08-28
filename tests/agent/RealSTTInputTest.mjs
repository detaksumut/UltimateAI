import assert from 'assert';
import { voicePipelineCoordinatorInstance, VOICE_STATES } from '../../server/voice/VoicePipelineCoordinator.mjs';

console.log('========================================================================');
console.log('  TEST: RealSTTInputTest — Microphone STT Transcript Direct Flow');
console.log('========================================================================\n');

async function testRealSTTInput() {
  const coordinator = voicePipelineCoordinatorInstance;
  coordinator.startListening('test-stt-session-001');

  const voicePrompt = 'Halo JIN, apakah kamu mendengar saya?';
  console.log('[VOG] MIC_STARTED');
  console.log('[VOG] VAD_SPEECH_START');
  console.log(`[VOG] STT_RESULT: "${voicePrompt}" (isFinal: true)`);
  console.log('[VOG] VAD_SPEECH_END');
  console.log(`[VOG] AGENT_INPUT_RECEIVED: "${voicePrompt}"`);

  const execRes = await coordinator.processSTTTranscript(voicePrompt, true);

  assert(execRes.success, 'STT-driven execution must succeed');
  assert.strictEqual(coordinator.state, VOICE_STATES.SPEAKING, 'JIN must reach SPEAKING state');
  console.log('[VOG] JIN_RESPONSE_RECEIVED:');
  console.log(`  "${execRes.speechOutput}"\n`);

  console.log('========================================================================');
  console.log('  ✅ [PASS] RealSTTInputTest: 100% SUCCESS');
  console.log('========================================================================\n');
}

testRealSTTInput().catch(err => {
  console.error('❌ [FAIL] RealSTTInputTest:', err);
  process.exit(1);
});
