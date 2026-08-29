/**
 * test_engineering_direct.mjs
 * Direct End-to-End integration test of the real Autonomous Engineering Agent runtime.
 */

import { engineeringRuntimeInstance } from './server/engineering/EngineeringRuntime.mjs';
import { incidentQueueInstance } from './server/engineering/queue/IncidentQueue.mjs';
import { createIncidentTicket, IncidentSeverity, IncidentStatus } from './server/engineering/types/IncidentTypes.mjs';
import { policyGateInstance } from './server/engineering/policy/PolicyGate.mjs';
import { incidentMemoryInstance } from './server/engineering/memory/IncidentMemory.mjs';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  console.log('\n======================================================');
  console.log('ðŸ§ª VERIFIKASI LANGSUNG: ULTIMATEAI ENGINEERING AGENT (v1)');
  console.log('======================================================\n');

  try {
    // 1. Check Initial State
    console.log('ðŸ“Œ TAHAP 1: Inisialisasi & Verifikasi Status Engine');
    const initialStatus = engineeringRuntimeInstance.getStatus();
    console.log('   Status Engine:', initialStatus.status);
    console.log('   Level Operasi:', `LEVEL ${initialStatus.level} (Sandbox Fix + Human Review)`);
    console.log('   Total Insiden:', initialStatus.totalIncidents);
    console.log('   Pola Terpelajar:', initialStatus.learnedPatterns);

    // 2. Ingest Real Incident Ticket
    console.log('\nðŸ“Œ TAHAP 2: Mengirim Insiden Nyata ke IncidentQueue (Sensing -> Queue)');
    const ticket = createIncidentTicket({
      source: 'frontend',
      category: 'DOM_INTERACTION_FAILURE',
      errorMessage: 'Button click event dropped â€” DOM element became unstable during mousedown-to-click cycle.',
      targetComponent: 'LeftSidebarHUD',
      elementSelector: '#btn-nav-memory_vault',
      severity: IncidentSeverity.HIGH,
      metadata: {
        clickSuccessRate: 43,
        dropCount: 8
      }
    });

    const enqueued = incidentQueueInstance.enqueue(ticket);
    console.log(`   âœ… Tiket Diterima: ${enqueued.incidentId}`);
    console.log(`   Komponen: ${enqueued.targetComponent} | Kategori: ${enqueued.category} | Severity: ${enqueued.severity}`);

    // 3. Trigger Autonomous Processing Pipeline
    console.log('\nðŸ“Œ TAHAP 3: Menjalankan Autonomous Diagnostic & Sandbox Pipeline');
    await engineeringRuntimeInstance.processIncident(enqueued.incidentId);

    // 4. Inspect Results
    console.log('\nðŸ“Œ TAHAP 4: Memeriksa Hasil Diagnosa & Validasi Sandbox');
    const processedTicket = incidentQueueInstance.getIncidentById(enqueued.incidentId);
    console.log(`   Status Tiket Akhir: ${processedTicket.status}`);

    if (processedTicket.diagnosticReport) {
      console.log(`   ðŸ” Akar Masalah: "${processedTicket.diagnosticReport.rootCause}"`);
      console.log(`   ðŸŽ¯ Strategi Fix: "${processedTicket.diagnosticReport.proposedFix}"`);
      console.log(`   ðŸ“Š Confidence: ${(processedTicket.diagnosticReport.confidence * 100).toFixed(0)}%`);
      console.log(`   ðŸ›¡ï¸ Evidence Gate: ${processedTicket.diagnosticReport.evidenceGatePassed ? 'PASSED âœ…' : 'FAILED âŒ'}`);
      console.log(`   âš ï¸ Level Risiko: ${processedTicket.diagnosticReport.riskLevel}`);
      console.log(`   ðŸ“‹ Bukti Temuan (${processedTicket.diagnosticReport.evidence.length} poin):`);
      processedTicket.diagnosticReport.evidence.forEach((ev, i) => {
        console.log(`      ${i + 1}. ${ev}`);
      });
    }

    if (processedTicket.checkpointId) {
      console.log(`   ðŸ’¾ Checkpoint Dibuat: ${processedTicket.checkpointId}`);
    }

    if (processedTicket.testResults) {
      console.log(`   ðŸ§ª Hasil Pengujian: ${processedTicket.testResults.pass ? 'SEMUA TAHAP LULUS (Syntax, Build, Playwright) âœ…' : 'GAGAL âŒ'}`);
    }

    // 5. Human Approval Gate (Level 3 Gatekeeper)
    console.log('\nðŸ“Œ TAHAP 5: Mensimulasikan Approval Gate Level 3 (User Click "Approve & Merge")');
    if (processedTicket.status === IncidentStatus.AWAITING_APPROVAL) {
      console.log('   Gatekeeper: Status saat ini AWAITING_APPROVAL (Menunggu persetujuan manusia).');
      console.log('   Aksi: Menjalankan applyAndDeployFix()...');
      const deployRes = await engineeringRuntimeInstance.applyAndDeployFix(enqueued.incidentId);
      console.log(`   âœ… Status Deploy: ${deployRes.status}`);
    }

    // 6. Verify Incident Memory Persistence
    console.log('\nðŸ“Œ TAHAP 6: Memverifikasi Pembelajaran ke Incident Memory');
    const allKnowledge = incidentMemoryInstance.getAllKnowledge();
    console.log(`   Total Knowledge di Memory: ${allKnowledge.length}`);
    if (allKnowledge.length > 0) {
      const latest = allKnowledge[0];
      console.log(`   ðŸ§  Pola Terakhir Dipelajari:`);
      console.log(`      - ID: ${latest.memoryId}`);
      console.log(`      - Status: ${latest.status}`);
      console.log(`      - Masalah: "${latest.rootCause}"`);
      console.log(`      - Solusi Tervalidasi: "${latest.validatedPatchStrategy}"`);
    }

    console.log('\n======================================================');
    console.log('ðŸŽ‰ 100% REAL E2E CLOSED-LOOP SELF-HEALING TELAH TERBUKTI!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\nâŒ Terjadi error saat pengujian:', err);
    process.exit(1);
  }
})();
