import assert from 'assert';
import { jinResponseEngineInstance } from '../../server/agent/JINResponseEngine.mjs';

console.log('========================================================================');
console.log('  TEST: TTSSynthesisTest — Clean Speech Synthesis Formatting');
console.log('========================================================================\n');

async function testTTSSynthesis() {
  const result = await jinResponseEngineInstance.generateResponse({
    userUtterance: 'Bagaimana status sistem hari ini?',
    conversationContext: { recentTurns: [] },
    decision: { intent: 'CASUAL_CHAT', actionRequired: false }
  }, {
    forcedModel: 'gemini-3.6-flash-high'
  });

  assert(result.naturalVoiceSpeech, 'Must produce voice TTS speech');
  assert(result.detailedTextDisplay, 'Must produce HUD detailed text');
  
  // Verify speech text has no unparsed markdown or code blocks
  assert(!result.naturalVoiceSpeech.includes('```'), 'Voice speech must not include raw code fences');
  assert(!result.naturalVoiceSpeech.includes('<script>'), 'Voice speech must not include script tags');
  
  console.log('[1] JIN Voice TTS String:\n ', `"${result.naturalVoiceSpeech}"`);
  console.log('\n[2] JIN HUD Display Markdown:\n', result.detailedTextDisplay);

  console.log('\n========================================================================');
  console.log('  ✅ [PASS] TTSSynthesisTest: 100% SUCCESS');
  console.log('========================================================================\n');
}

testTTSSynthesis().catch(err => {
  console.error('❌ [FAIL] TTSSynthesisTest:', err);
  process.exit(1);
});
