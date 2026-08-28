import assert from 'assert';
import { agentRuntimeInstance } from '../../server/agent/AgentRuntime.mjs';

console.log('========================================================================');
console.log('  TEST: DocumentAgentTest — Document Intelligence & Semantic Analysis');
console.log('========================================================================\n');

async function testDocumentAgent() {
  console.log('[1] Providing Unstructured Document Text for Semantic Chunking & Analysis');
  const sampleDoc = `
LAPORAN EVALUASI PERFORMA SISTEM ULTIMATEAI 2026

1. Ringkasan Eksekutif
Sistem UltimateAI telah mengintegrasikan 7 pool inferensi Antigravity secara mandiri.
Hasil pengukuran selama kuartal 3 menunjukkan peningkatan throughput sebesar 48% dibandingkan baseline sebelumnya.
Customer Acquisition Cost (CAC) tercatat turun hingga 65% dengan efisiensi alokasi biaya token.

2. Identifikasi Deviasi & Anomali
Ditemukan deviasi sebesar +33.8% di atas rata-rata industri terhadap benchmark industri pada rasio konversi pengguna aktif.
Faktor penyebab utama adalah implementasi zero-latency rollover antar akun Antigravity.

3. Rekomendasi
- Pertahankan alokasi sticky connection pada pool AG-01 untuk menjaga konsistensi state.
- Lakukan penyegaran token otomatis secara berkala sebelum mencapai batas waktu kedaluwarsa.
  `;

  const goal = 'Analisis dokumen performa sistem ini dan ekstraksi metrik deviasi serta rekomendasinya.';

  const result = await agentRuntimeInstance.runGoal(goal, {
    documentText: sampleDoc,
    fileName: 'evaluasi_performa_2026.pdf',
    semanticDecision: {
      intent: 'DOCUMENT_ANALYSIS',
      goal,
      documentText: sampleDoc,
      query: 'deviasi anomali rekomendasi performa',
      toolsNeeded: ['doc.analyze', 'data.matrix_generator']
    }
  }, {
    forcedModel: 'gemini-3.6-flash-high'
  });

  console.log('  Goal:', result.goal);
  console.log('  Success:', result.success);
  console.log('  Tools Used:', result.provenance.executionTools);
  console.log('  JIN Speech:', result.responseMessage);
  console.log('  Artifact Generated:', result.artifact?.name);

  assert(result.success, 'Document Agent must complete successfully');
  assert(result.provenance.executionTools.includes('doc.analyze'), 'doc.analyze tool must be executed');
  assert(result.responseMessage && result.responseMessage.length > 0, 'JIN must provide response');

  console.log('\n========================================================================');
  console.log('  ✅ [PASS] DocumentAgentTest: 100% SUCCESS');
  console.log('========================================================================\n');
}

testDocumentAgent().catch(err => {
  console.error('❌ [FAIL] DocumentAgentTest:', err);
  process.exit(1);
});
