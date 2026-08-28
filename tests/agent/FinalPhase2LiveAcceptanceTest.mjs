import assert from 'assert';
import { agentRuntimeInstance } from '../../server/agent/AgentRuntime.mjs';

console.log('========================================================================');
console.log('  ULTIMATEAI PHASE 2 — FINAL LIVE AGENT ACCEPTANCE TASK');
console.log('  Testing: Plan ➔ Document Tool ➔ Search Tool ➔ Model ➔ Pool ➔ Verifier ➔ JIN');
console.log('========================================================================\n');

async function runLiveAgentAcceptance() {
  const sampleDocument = `
LAPORAN STRATEGIS: INTEGRASI DAN EFISIENSI MULTI-POOL ULTIMATEAI 2026

1. Metrik Kinerja Operasional:
- Rasio Pemanfaatan Resource Pool: 85% rata-rata di seluruh 7 pool
- Penurunan Waktu Respons Inferensi: 42% lebih cepat dengan native Cloud Code transport
- Angka Kegagalan Token Refresh: 0% dalam 24 jam pengujian berkelanjutan

2. Temuan dan Analisis Komparatif:
- Melalui eliminasi dependensi IDE, reliabilitas daemon meningkat drastis.
- Terjadi deviasi positif sebesar +33.8% di atas rata-rata industri terhadap benchmark industri pada throughput eksekusi tugas multi-langkah.

3. Rekomendasi Utama:
- Pertahankan konfigurasi fallback fail-closed untuk integritas enterprise.
- Terapkan prioritas routing cerdas berbasis kuota sisa yang diobservasi secara real-time.
  `;

  const userPrompt = 'Analisis dokumen ini, cari informasi pendukung benchmark web, bandingkan temuannya, lalu berikan rekomendasi.';
  console.log(`[USER / RAHMAN]: "${userPrompt}"\n`);

  const taskResult = await agentRuntimeInstance.runGoal(userPrompt, {
    documentText: sampleDocument,
    fileName: 'laporan_strategis_multipool_2026.pdf',
    userRole: 'Rahman (Enterprise Admin)'
  }, {
    forcedModel: 'gemini-3.6-flash-high'
  });

  console.log('========================================================================');
  console.log('  AGENT EXECUTION PROVENANCE & SUMMARY');
  console.log('========================================================================');
  console.log('  - Goal:                   ', taskResult.goal);
  console.log('  - Execution Status:       ', taskResult.success ? 'SUCCESS (100% Verified)' : 'FAILED');
  console.log('  - Intent Classified:      ', taskResult.intent || 'MULTI_STEP_TASK');
  console.log('  - Tools Executed:         ', taskResult.provenance.executionTools);
  console.log('  - Semantic Model:         ', taskResult.provenance.semanticModel);
  console.log('  - Transport Gateway:      ', taskResult.provenance.transport);
  console.log('  - Total Steps Executed:   ', taskResult.telemetry?.totalStepsExecuted);
  console.log('  - Response Source:        ', taskResult.responseSource);
  console.log('  - JIN Voice Speech (TTS):\n   ', `"${taskResult.responseMessage}"`);
  console.log('  - JIN HUD Detailed Text Display:\n', taskResult.detailedDisplay);
  console.log('  - Execution Duration:     ', `${taskResult.durationMs}ms`);

  assert(taskResult.success, 'Live acceptance task must complete successfully');
  assert(taskResult.provenance.executionTools.includes('doc.analyze'), 'doc.analyze must be executed');
  assert(taskResult.provenance.executionTools.includes('web.search'), 'web.search must be executed');
  assert(taskResult.responseMessage && taskResult.responseMessage.length > 0, 'JIN must speak natural synthesis');

  // Verify on Control Center API
  const controlCenterSnap = await fetch('http://127.0.0.1:20200/api/control-center').then(r => r.json());
  console.log('\n[CONTROL CENTER TELEMETRY VERIFICATION]');
  console.log('  - System Health:          ', controlCenterSnap.overview.systemHealth);
  console.log('  - Enrolled Pools:         ', `${controlCenterSnap.overview.enrolledCount}/7`);
  console.log('  - Available Pools:        ', `${controlCenterSnap.overview.availableCount}/7`);
  console.log('  - Recent Tasks Recorded:  ', controlCenterSnap.recentTasks.length);
  console.log('  - Latest Task ID:         ', controlCenterSnap.recentTasks[0]?.taskId);
  console.log('  - Latest Task Pool Used:  ', controlCenterSnap.recentTasks[0]?.connectionId?.toUpperCase());

  console.log('\n========================================================================');
  console.log('  🏆 PHASE 2 FINAL LIVE AGENT ACCEPTANCE: 100% COMPLETED');
  console.log('========================================================================\n');
}

runLiveAgentAcceptance().catch(err => {
  console.error('❌ Live Acceptance Failed:', err);
  process.exit(1);
});
