import assert from 'assert';
import { voicePipelineCoordinatorInstance } from '../../server/voice/VoicePipelineCoordinator.mjs';

console.log('========================================================================');
console.log('  TEST: STTAgentIntegrationTest — STT Transcript Direct Agent Execution');
console.log('========================================================================\n');

async function testSTTAgentIntegration() {
  const coordinator = voicePipelineCoordinatorInstance;
  coordinator.startListening('session-stt-002');

  const voiceSentence = 'Berikan ringkasan singkat strategi retensi pengguna.';
  console.log(`[1] STT Finalized Transcript: "${voiceSentence}"`);

  const execResult = await coordinator.processSTTTranscript(voiceSentence, true);

  assert(execResult.success, 'STT-driven agent task must complete successfully');
  assert(execResult.taskResult.provenance, 'Must contain full provenance');
  console.log('  Semantic Model: ', execResult.taskResult.provenance.semanticModel);
  console.log('  Execution Tools:', execResult.taskResult.provenance.executionTools);
  console.log('  JIN Synthesis:  ', execResult.speechOutput);

  console.log('\n========================================================================');
  console.log('  ✅ [PASS] STTAgentIntegrationTest: 100% SUCCESS');
  console.log('========================================================================\n');
}

testSTTAgentIntegration().catch(err => {
  console.error('❌ [FAIL] STTAgentIntegrationTest:', err);
  process.exit(1);
});
