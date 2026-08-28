import assert from 'assert';
import { agentRuntimeInstance } from '../../server/agent/AgentRuntime.mjs';

console.log('========================================================================');
console.log('  TEST: MemoryAgentTest — Memory Vault Storage & Recall Integration');
console.log('========================================================================\n');

async function testMemoryAgent() {
  console.log('[1] Step 1: Storing Long-Term Fact in Memory Vault');
  const storeGoal = 'Simpan fakta bahwa arsitektur UltimateAI menggunakan 7 pool Antigravity independen.';
  
  const storeResult = await agentRuntimeInstance.runGoal(storeGoal, {
    semanticDecision: {
      intent: 'MEMORY_STORE',
      goal: storeGoal,
      memoryContent: 'UltimateAI beroperasi dengan 7 pool inferensi Antigravity independen tanpa dependensi IDE.',
      memoryKey: 'system_architecture_facts'
    }
  }, {
    forcedModel: 'gemini-3.6-flash-high'
  });

  console.log('  Store Success:', storeResult.success);
  console.log('  JIN Store Speech:', storeResult.responseMessage);
  assert(storeResult.success, 'Memory store must succeed');
  assert(storeResult.provenance.executionTools.includes('memory.vault'), 'memory.vault tool must be executed');

  console.log('\n[2] Step 2: Retrieving Facts from Memory Vault');
  const recallGoal = 'Apa informasi yang tersimpan mengenai arsitektur pool inferensi UltimateAI?';

  const recallResult = await agentRuntimeInstance.runGoal(recallGoal, {
    semanticDecision: {
      intent: 'MEMORY_RETRIEVAL',
      goal: recallGoal,
      query: 'arsitektur pool Antigravity'
    }
  }, {
    forcedModel: 'gemini-3.6-flash-high'
  });

  console.log('  Recall Success:', recallResult.success);
  console.log('  JIN Recall Speech:', recallResult.responseMessage);
  assert(recallResult.success, 'Memory retrieval must succeed');
  assert(recallResult.provenance.executionTools.includes('memory.vault'), 'memory.vault tool must be executed');

  console.log('\n========================================================================');
  console.log('  ✅ [PASS] MemoryAgentTest: 100% SUCCESS');
  console.log('========================================================================\n');
}

testMemoryAgent().catch(err => {
  console.error('❌ [FAIL] MemoryAgentTest:', err);
  process.exit(1);
});
