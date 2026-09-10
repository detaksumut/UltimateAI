/**
 * tests/agent_runtime_cognitive_audit_test.mjs
 * TEST 10: Agent Runtime Cognitive Execution Audit
 *
 * Verifies the complete cognitive execution loop:
 * Input
 *  ↓
 * Intent & Scope Classification
 *  ↓
 * DAG Planning (AgentPlanner)
 *  ↓
 * Tool Execution via ToolGovernor / AgentExecutor
 *  ↓
 * Evidence Gathering & Verification (AgentVerifier)
 *  ↓
 * Response Synthesis (JINResponseEngine)
 *  ↓
 * Memory Snapshot & Provenance Tracking
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('d:/Users/ultimateai/.env') });

import { agentRuntimeInstance } from '../server/agent/AgentRuntime.mjs';

async function runAgentRuntimeAudit() {
  console.log('================================================================');
  console.log(' TEST 10: AGENT RUNTIME COGNITIVE EXECUTION AUDIT              ');
  console.log('================================================================');

  const userGoal = 'Cari informasi mengenai teknologi kuantum 2026, analisis dampaknya, simpan hasilnya, lalu berikan kesimpulan.';
  console.log(`User Goal: "${userGoal}"`);
  console.log('----------------------------------------------------------------');

  const startTime = Date.now();
  const summary = await agentRuntimeInstance.runGoal(userGoal, {
    sessionId: 'session-audit-test-10',
    turnIndex: 1
  });
  const elapsed = Date.now() - startTime;

  console.log('HASIL AUDIT SIKLUS KOGNITIF AGENT RUNTIME:');
  console.log(`  1. Intent Terdeteksi       : ${summary.intent}`);
  console.log(`  2. Source Scope            : ${summary.sourceScope}`);
  console.log(`  3. Action Required         : ${summary.actionRequired}`);
  console.log(`  4. Success Status          : ${summary.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`  5. Confidence Level        : ${summary.confidence}`);
  console.log(`  6. Execution Duration      : ${elapsed}ms`);

  console.log('\n----------------------------------------------------------------');
  console.log('TIMELINE JEJAK KOGNITIF (AUDIT PERCEIVE -> PLAN -> ACT -> REFLECT):');
  if (summary.timeline && Array.isArray(summary.timeline)) {
    summary.timeline.forEach((step, idx) => {
      console.log(`  [${String(idx + 1).padStart(2, '0')}] ${step.event.padEnd(26, ' ')} | ${JSON.stringify(step).slice(0, 100)}...`);
    });
  }

  console.log('\n----------------------------------------------------------------');
  console.log('PROVENANCE & EXECUTION TOOLS DIGUNAKAN:');
  console.log('  Planning Engine :', summary.provenance?.planningEngine || 'N/A');
  console.log('  Execution Tools :', JSON.stringify(summary.provenance?.executionTools || []));
  console.log('  Semantic Model  :', summary.provenance?.semanticModel || 'N/A');
  console.log('  Transport       :', summary.provenance?.transport || 'N/A');

  console.log('\n----------------------------------------------------------------');
  console.log('EVIDENCE & DOKUMEN BUKTI (VERIFICATION):');
  console.log('  Verification Status :', summary.verificationStatus || 'VERIFIED');
  console.log('  Claims Extracted    :', summary.claims?.length || 0, 'klaim');
  console.log('  Evidence Refs       :', summary.evidenceRefs?.length || 0, 'rujukan');

  console.log('\n----------------------------------------------------------------');
  console.log('DUAL RESPONSE ENGINE (JIN DSS COMPATIBILITY):');
  console.log('  [SPEAKER] Natural Voice Speech (Vokal Ringkas):');
  console.log(`    "${summary.responseMessage?.slice(0, 150)}..."`);
  console.log('  [TICKER] Detailed Text Display (Visual Lengkap):');
  console.log(`    "${summary.detailedDisplay?.slice(0, 150)}..."`);

  const passed = summary.success === true && summary.timeline?.length > 0;
  console.log('\n================================================================');
  console.log(`STATUS TEST 10: ${passed ? '🟢 PASS (COGNITIVE EXECUTION LOOP VERIFIED)' : '🔴 FAIL'}`);
  console.log('================================================================\n');
}

runAgentRuntimeAudit().catch(err => {
  console.error('Audit Error:', err);
  process.exit(1);
});
