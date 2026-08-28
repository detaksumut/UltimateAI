import assert from 'assert';
import { agentRuntimeInstance } from '../../server/agent/AgentRuntime.mjs';

console.log('========================================================================');
console.log('  TEST: MultiStepAgentTest — End-to-End Autonomous Multi-Skill DAG Plan');
console.log('========================================================================\n');

async function testMultiStepAgent() {
  const sampleDoc = `
DOKUMEN STRATEGIS: EVALUASI PERTUMBUHAN AI ENTERPRISE

Data Internal:
- Pertumbuhan pendapatan Q3: +48% (Target Baseline: +12%)
- Biaya akuisisi pengguna (CAC): -65%
- Tingkat retensi pengguna: 78%

Tantangan:
- Terjadi deviasi signifikan terhadap ekspektasi normal industri.
- Diperlukan cross-check dengan benchmark eksternal industri AI 2026.
  `;

  const goal = 'Analisis dokumen ini, cari informasi pendukung benchmark web, bandingkan temuannya, lalu berikan rekomendasi.';
  console.log(`[1] User Goal: "${goal}"`);

  const result = await agentRuntimeInstance.runGoal(goal, {
    documentText: sampleDoc,
    fileName: 'evaluasi_strategis_q3.pdf',
    semanticDecision: {
      intent: 'MULTI_STEP_TASK',
      goal,
      documentText: sampleDoc,
      toolsNeeded: ['doc.analyze', 'web.search', 'data.matrix_generator']
    }
  }, {
    forcedModel: 'gemini-3.6-flash-high'
  });

  console.log('\n[2] Multi-Step Execution Results:');
  console.log('  - Goal:                   ', result.goal);
  console.log('  - Success:                ', result.success);
  console.log('  - Total Steps Executed:   ', result.telemetry?.totalStepsExecuted);
  console.log('  - Tools Executed:         ', result.provenance.executionTools);
  console.log('  - JIN Voice Speech:\n    ', `"${result.responseMessage}"`);
  console.log('  - JIN HUD Detailed Text:\n', result.detailedDisplay);

  assert(result.success, 'Multi-Step task must complete successfully');
  assert(result.provenance.executionTools.includes('doc.analyze'), 'doc.analyze must be in executionTools');
  assert(result.provenance.executionTools.includes('web.search'), 'web.search must be in executionTools');
  assert(result.provenance.executionTools.includes('data.matrix_generator'), 'data.matrix_generator must be in executionTools');
  assert(result.responseMessage && result.responseMessage.length > 0, 'JIN must provide response');

  console.log('\n========================================================================');
  console.log('  ✅ [PASS] MultiStepAgentTest: 100% SUCCESS');
  console.log('========================================================================\n');
}

testMultiStepAgent().catch(err => {
  console.error('❌ [FAIL] MultiStepAgentTest:', err);
  process.exit(1);
});
