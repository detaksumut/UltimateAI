import assert from 'assert';
import { agentRuntimeInstance } from '../../server/agent/AgentRuntime.mjs';

console.log('========================================================================');
console.log('  TEST: SearchAgentTest — Live Web Search & Intelligence Integration');
console.log('========================================================================\n');

async function testSearchAgent() {
  console.log('[1] Executing Web Search Agent Goal');
  const goal = 'Cari perkembangan terbaru mengenai AI Agent autonomous workflow dan multi-pool routing.';
  
  const result = await agentRuntimeInstance.runGoal(goal, {
    semanticDecision: {
      intent: 'WEB_SEARCH',
      goal,
      query: 'AI agent autonomous workflow multi pool routing',
      toolsNeeded: ['web.search']
    }
  }, {
    forcedModel: 'gemini-3.6-flash-high'
  });

  console.log('  Goal:', result.goal);
  console.log('  Success:', result.success);
  console.log('  Tools Used:', result.provenance.executionTools);
  console.log('  JIN Speech:', result.responseMessage);
  console.log('  Artifact Type:', result.artifact?.type);

  assert(result.success, 'Search Agent must complete successfully');
  assert(result.provenance.executionTools.includes('web.search'), 'web.search tool must be executed');
  assert(result.responseMessage && result.responseMessage.length > 0, 'JIN must provide response');

  console.log('\n========================================================================');
  console.log('  ✅ [PASS] SearchAgentTest: 100% SUCCESS');
  console.log('========================================================================\n');
}

testSearchAgent().catch(err => {
  console.error('❌ [FAIL] SearchAgentTest:', err);
  process.exit(1);
});
