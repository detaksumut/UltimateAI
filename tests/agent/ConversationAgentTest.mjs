import assert from 'assert';
import { agentRuntimeInstance } from '../../server/agent/AgentRuntime.mjs';

console.log('========================================================================');
console.log('  TEST: ConversationAgentTest — Multi-Turn Autonomous JIN Dialogue');
console.log('========================================================================\n');

async function testConversationAgent() {
  console.log('[1] Turn 1: User Introduces Topic');
  const turn1 = await agentRuntimeInstance.runGoal('Halo JIN, saya Rahman. Kita sedang merancang arsitektur AI agent di UltimateAI.', {
    userRole: 'Rahman'
  }, {
    forcedModel: 'gemini-3.6-flash-high'
  });

  console.log('  JIN Speech 1:', turn1.responseMessage);
  assert(turn1.success, 'Turn 1 must succeed');
  assert(turn1.responseMessage && turn1.responseMessage.length > 0, 'JIN must speak');

  console.log('\n[2] Turn 2: Contextual Follow-Up Query');
  const turn2 = await agentRuntimeInstance.runGoal('Menurutmu, apa tantangan terbesar saat mengelola banyak pool inferensi secara bersamaan?', {
    recentTurns: [
      { role: 'user', content: 'Halo JIN, saya Rahman. Kita sedang merancang arsitektur AI agent di UltimateAI.' },
      { role: 'assistant', content: turn1.responseMessage }
    ]
  }, {
    forcedModel: 'gemini-3.6-flash-high'
  });

  console.log('  JIN Speech 2:', turn2.responseMessage);
  assert(turn2.success, 'Turn 2 must succeed');
  assert(turn2.responseMessage && turn2.responseMessage.length > 0, 'JIN must speak');

  console.log('\n========================================================================');
  console.log('  ✅ [PASS] ConversationAgentTest: 100% SUCCESS');
  console.log('========================================================================\n');
}

testConversationAgent().catch(err => {
  console.error('❌ [FAIL] ConversationAgentTest:', err);
  process.exit(1);
});
