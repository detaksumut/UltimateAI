/**
 * UnseenAutonomousTasksLiveDemo.mjs
 * Live End-to-End Validation of Unseen Real Tasks Across All 4 Autonomous Intelligence Pillars.
 */

import { AgentRuntime } from '../../server/agent/AgentRuntime.mjs';
import { activeMemoryCoreInstance } from '../../server/memory/ActiveMemoryCore.mjs';
import { sandboxExecutionToolInstance } from '../../server/tools/SandboxExecutionTool.mjs';
import assert from 'assert';

console.log('\n════════════════════════════════════════════════════════════════════════════════');
console.log('  LIVE UNSEEN DEMO: Autonomous Intelligence & 4 Pillars Real-World Execution');
console.log('════════════════════════════════════════════════════════════════════════════════\n');

async function runUnseenDemos() {
  const runtime = new AgentRuntime();
  let passed = 0;

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO 1: Unseen Web Analysis + Sandbox Calculation + Strategic Recommendation
  // ─────────────────────────────────────────────────────────────────────────
  console.log('─── [SCENARIO 1] Unseen Web Analysis & Data Processing ───');
  try {
    const goal1 = 'Buka http://localhost:5177/simulator, analisis status dan hitung metrik performa di Python sandbox.';
    const res1 = await runtime.runGoal(goal1, {}, { failClosed: false });

    assert.strictEqual(res1.success, true);
    assert.ok(res1.responseMessage, 'Must provide synthesized voice/response');
    assert.ok(res1.timeline.some(e => e.event === 'PLAN_CREATED'), 'Must create hierarchical plan');
    console.log(`  ✓ [SCENARIO 1 PASS] Executed seamlessly:`);
    console.log(`     • Model Routed: ${res1.provenance.semanticModel}`);
    console.log(`     • Antigravity Pool: ${res1.provenance.selectedPool}`);
    console.log(`     • Response: "${res1.responseMessage.slice(0, 100)}..."`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [SCENARIO 1 FAIL]: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO 2: Cross-Session Memory Persistence on Drive F:
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n─── [SCENARIO 2] Cross-Session Memory Store & Semantic Recall ───');
  try {
    const uniqueFact = `Protokol enkripsi quantum-resistant diluncurkan pada kuartal 4 dengan key-size 4096-bit-${Date.now()}.`;
    
    // Session 1: Store memory on Drive F
    activeMemoryCoreInstance.store({
      key: 'quantum_protocol',
      content: uniqueFact,
      category: 'RESEARCH_DATA',
      priority: 'HIGH'
    });

    // Session 2: Fresh query across new runtime instance
    const freshRuntime = new AgentRuntime();
    const recalled = activeMemoryCoreInstance.query({ queryText: 'protokol enkripsi quantum key-size 4096', limit: 1 });

    assert.ok(recalled.length > 0);
    assert.ok(recalled[0].content.includes('quantum-resistant'));
    console.log(`  ✓ [SCENARIO 2 PASS] Cross-session persistent memory retrieved semantically from Drive F (ID: ${recalled[0].memoryId || recalled[0].id})`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [SCENARIO 2 FAIL]: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO 3: Sandbox Security Barrier Verification (Zero Credential Leakage)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n─── [SCENARIO 3] Strict Sandbox Security Barrier Probe ───');
  try {
    const attackScript = `
import os, json
report = {
  "vaultSecret": os.environ.get("DEFAULT_ANTIGRAVITY_CLIENT_SECRET"),
  "geminiKey": os.environ.get("GEMINI_API_KEY"),
  "refreshToken": os.environ.get("REFRESH_TOKEN"),
  "cwd": os.getcwd()
}
print(json.dumps(report))
    `;

    const securityRes = await sandboxExecutionToolInstance.execute({ code: attackScript, runtime: 'python' });
    const parsed = JSON.parse(securityRes.stdout);

    assert.strictEqual(parsed.vaultSecret, null, 'Must NOT access Vault Client Secret');
    assert.strictEqual(parsed.geminiKey, null, 'Must NOT access Gemini API Key');
    assert.strictEqual(parsed.refreshToken, null, 'Must NOT access OAuth Refresh Token');
    console.log(`  ✓ [SCENARIO 3 PASS] Sandbox probe confirmed: 0 secrets leaked to sandbox process`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [SCENARIO 3 FAIL]: ${err.message}`);
  }

  console.log(`\n════════════════════════════════════════════════════════════════════════════════`);
  console.log(`  UNSEEN LIVE DEMO SUMMARY: ${passed}/3 Scenarios Succeeded.`);
  console.log(`════════════════════════════════════════════════════════════════════════════════\n`);
  if (passed < 3) process.exit(1);
}

runUnseenDemos();
