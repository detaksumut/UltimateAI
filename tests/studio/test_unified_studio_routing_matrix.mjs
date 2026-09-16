/**
 * tests/studio/test_unified_studio_routing_matrix.mjs
 * ULTIMATEAI JIN — UNIFIED STUDIO ROUTING MATRIX REGRESSION SUITE (R01 - R18)
 *
 * Enforces:
 * 1. 7-Tier Priority Hierarchy (P0 - P6)
 * 2. Deterministic Grammar & Confidence (EXACT, STRONG, CONTEXTUAL, AMBIGUOUS, NONE)
 * 3. 18 Golden Invariants (R01 to R18)
 * 4. DataLab Functional Execution Validation
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { unifiedStudioRouterInstance } from '../../server/studio/core/UnifiedStudioRouter.mjs';
import { StudioSessionManager, studioSessionManagerInstance } from '../../server/studio/core/StudioSessionManager.mjs';
import { studioCommandParserInstance, MATCH_TYPES } from '../../server/studio/core/StudioCommandParser.mjs';
import { studioContinuationRouterInstance } from '../../server/studio/core/StudioContinuationRouter.mjs';
import { slideStudioInstance } from '../../server/studio/slide/SlideStudio.mjs';
import { imageGenerationInstance } from '../../server/agent/ImageGeneration.mjs';
import { dataLabStudioInstance } from '../../server/studio/data_lab/DataLabStudio.mjs';
import { ITEM_LIFECYCLE_STATUS, STUDIO_STATUSES, STUDIO_PHASES } from '../../server/studio/core/StudioContext.mjs';

async function runRegressionSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(' ULTIMATEAI JIN — UNIFIED STUDIO ROUTING MATRIX REGRESSION SUITE (R01 - R18)');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  // Reset all sessions before start
  studioSessionManagerInstance.clearSession();

  // ─────────────────────────────────────────────────────────────────────────────
  // R01: Active Studio + valid Studio command -> MUST route to active Studio.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('[TEST R01] Testing active Studio + valid command routing...');
  const slideDeckSession = studioSessionManagerInstance.createOrUpdateSlideSession({
    projectId: 'PROJ-TEST-001',
    projectTitle: 'Regulasi Desa',
    totalSlides: 20
  });

  const r01Decision = unifiedStudioRouterInstance.route('slide 3', { activeStudio: slideDeckSession });
  assert.strictEqual(r01Decision.route, 'SLIDE_STUDIO', 'R01: Must route to SLIDE_STUDIO');
  assert.strictEqual(r01Decision.priority, 'P1', 'R01: Must be Priority 1');
  assert.strictEqual(r01Decision.action, 'GENERATE_SLIDE', 'R01: Action must be GENERATE_SLIDE');
  assert.strictEqual(r01Decision.parameters.slideNumber, 3, 'R01: Parameter slideNumber must be 3');
  console.log('  ✓ R01 PASS: Active Studio + valid command routed to active Studio (P1)');

  // ─────────────────────────────────────────────────────────────────────────────
  // R02: Active SLIDE_STUDIO + "slide N" -> NEVER IMAGE_GENERATION.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R02] Testing Active SLIDE_STUDIO + "slide N" never routes to IMAGE_GENERATION...');
  const r02Decision = unifiedStudioRouterInstance.route('slide 5', { activeStudio: slideDeckSession });
  assert.notStrictEqual(r02Decision.route, 'IMAGE_GENERATION', 'R02: Must NEVER route to IMAGE_GENERATION');
  assert.strictEqual(r02Decision.bypassImageGeneration, true, 'R02: Must bypass Image Generation');
  assert.strictEqual(r02Decision.route, 'SLIDE_STUDIO');
  console.log('  ✓ R02 PASS: "slide 5" NEVER routed to IMAGE_GENERATION');

  // ─────────────────────────────────────────────────────────────────────────────
  // R03: Active ARCHITECTURAL_STUDIO + "tampak depan" -> NEVER IMAGE_GENERATION.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R03] Testing Active ARCHITECTURAL_STUDIO + "tampak depan" never routes to IMAGE_GENERATION...');
  const archSession = studioSessionManagerInstance.createOrUpdateArchSession({
    projectId: 'ARCH-TEST-001',
    projectTitle: 'Desain Villa 2 Lantai'
  });

  const r03Decision = unifiedStudioRouterInstance.route('tampak depan', { activeStudio: archSession });
  assert.strictEqual(r03Decision.route, 'ARCHITECTURAL_STUDIO', 'R03: Must route to ARCHITECTURAL_STUDIO');
  assert.notStrictEqual(r03Decision.route, 'IMAGE_GENERATION', 'R03: Must NEVER route to IMAGE_GENERATION');
  assert.strictEqual(r03Decision.bypassImageGeneration, true);
  console.log('  ✓ R03 PASS: "tampak depan" in ARCHITECTURAL_STUDIO NEVER routed to IMAGE_GENERATION');

  // ─────────────────────────────────────────────────────────────────────────────
  // R04: Active DATA_LAB + "buat grafik" -> NEVER IMAGE_GENERATION.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R04] Testing Active DATA_LAB + "buat grafik" never routes to IMAGE_GENERATION...');
  const dataSession = studioSessionManagerInstance.createOrUpdateDataSession({
    projectId: 'DATA-TEST-001',
    projectTitle: 'Analisis Keuangan'
  });

  const r04Decision = unifiedStudioRouterInstance.route('buat grafik kedua', { activeStudio: dataSession });
  assert.strictEqual(r04Decision.route, 'DATA_LAB', 'R04: Must route to DATA_LAB');
  assert.notStrictEqual(r04Decision.route, 'IMAGE_GENERATION', 'R04: Must NEVER route to IMAGE_GENERATION');
  assert.strictEqual(r04Decision.action, 'CREATE_CHART(2)');
  assert.strictEqual(r04Decision.parameters.chartIndex, 2);
  console.log('  ✓ R04 PASS: "buat grafik kedua" in DATA_LAB NEVER routed to IMAGE_GENERATION');

  // ─────────────────────────────────────────────────────────────────────────────
  // R05: No active Studio + "buat PPT" -> SLIDE_STUDIO.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R05] Testing No active Studio + "buat PPT 15 slide" -> SLIDE_STUDIO...');
  studioSessionManagerInstance.clearSession();

  const r05Decision = unifiedStudioRouterInstance.route('buat PPT 15 slide tentang mitigasi bencana', {});
  assert.strictEqual(r05Decision.route, 'SLIDE_STUDIO', 'R05: Must route to SLIDE_STUDIO');
  assert.strictEqual(r05Decision.priority, 'P3', 'R05: Priority must be P3');
  assert.strictEqual(r05Decision.parameters.requestedCount, 15);
  console.log('  ✓ R05 PASS: "buat PPT 15 slide" routed to SLIDE_STUDIO (P3)');

  // ─────────────────────────────────────────────────────────────────────────────
  // R06: No active Studio + "buat desain rumah" -> ARCHITECTURAL_STUDIO.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R06] Testing No active Studio + "buat desain rumah" -> ARCHITECTURAL_STUDIO...');
  const r06Decision = unifiedStudioRouterInstance.route('buat desain rumah di lahan 20x30 meter', {});
  assert.strictEqual(r06Decision.route, 'ARCHITECTURAL_STUDIO', 'R06: Must route to ARCHITECTURAL_STUDIO');
  assert.strictEqual(r06Decision.priority, 'P3', 'R06: Priority must be P3');
  console.log('  ✓ R06 PASS: "buat desain rumah di lahan 20x30" routed to ARCHITECTURAL_STUDIO (P3)');

  // ─────────────────────────────────────────────────────────────────────────────
  // R07: No active Studio + "buat grafik dari CSV" -> DATA_LAB.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R07] Testing No active Studio + "analisis data ini" -> DATA_LAB...');
  const r07Decision = unifiedStudioRouterInstance.route('analisis dataset penjualan dari csv', {});
  assert.strictEqual(r07Decision.route, 'DATA_LAB', 'R07: Must route to DATA_LAB');
  assert.strictEqual(r07Decision.priority, 'P3', 'R07: Priority must be P3');
  console.log('  ✓ R07 PASS: "analisis dataset penjualan" routed to DATA_LAB (P3)');

  // ─────────────────────────────────────────────────────────────────────────────
  // R08: Active Studio + unrelated request -> exits Studio routing.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R08] Testing Active Studio + unrelated request cleanly exits Studio...');
  const activeSlide = studioSessionManagerInstance.createOrUpdateSlideSession({
    projectId: 'PROJ-TEST-002',
    projectTitle: 'Slide Tata Kelola'
  });

  const r08Decision = unifiedStudioRouterInstance.route('jelaskan regulasi uu perdes nomor 6 tahun 2014', { activeStudio: activeSlide });
  assert.strictEqual(r08Decision.route, 'SEMANTIC_INTENT', 'R08: Must exit studio and route to SEMANTIC_INTENT');
  assert.strictEqual(r08Decision.priority, 'P5', 'R08: Priority must be P5');
  console.log('  ✓ R08 PASS: Knowledge question exited Studio routing to SEMANTIC_INTENT (P5)');

  // ─────────────────────────────────────────────────────────────────────────────
  // R09: Valid Studio continuation -> MUST NOT invoke LLM solely for routing.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R09] Testing Valid Studio continuation bypasses LLM solely for routing...');
  const r09Decision = unifiedStudioRouterInstance.route('lanjut', { activeStudio: activeSlide });
  assert.strictEqual(r09Decision.priority, 'P2');
  assert.strictEqual(r09Decision.action, 'NEXT_SLIDE');
  assert.strictEqual(r09Decision.bypassSemanticIntentEngine, true, 'R09: bypassSemanticIntentEngine must be true');
  console.log('  ✓ R09 PASS: "lanjut" continuation bypassed LLM dispatch entirely');

  // ─────────────────────────────────────────────────────────────────────────────
  // R10: Valid Studio command -> MUST NOT invoke IMAGE_GENERATION.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R10] Testing Valid Studio command bypasses IMAGE_GENERATION...');
  const r10Decision = unifiedStudioRouterInstance.route('buat slide 4', { activeStudio: activeSlide });
  assert.strictEqual(r10Decision.bypassImageGeneration, true, 'R10: bypassImageGeneration must be true');
  assert.strictEqual(r10Decision.route, 'SLIDE_STUDIO');
  console.log('  ✓ R10 PASS: "buat slide 4" bypassed IMAGE_GENERATION entirely');

  // ─────────────────────────────────────────────────────────────────────────────
  // R11: Context persistence: Create SLIDE_STUDIO -> send "slide 3" -> same projectId.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R11] Testing context persistence with consistent projectId...');
  const fixedId = 'PROJ-FIXED-DECK-777';
  const persistedSession = studioSessionManagerInstance.createOrUpdateSlideSession({
    projectId: fixedId,
    projectTitle: 'Desa Digital'
  });

  const r11Decision = unifiedStudioRouterInstance.route('slide 3', { activeStudio: persistedSession });
  assert.strictEqual(r11Decision.sessionId, persistedSession.sessionId);
  assert.strictEqual(persistedSession.project.projectId, fixedId);
  console.log('  ✓ R11 PASS: Session ID & Project ID persisted across continuation turns');

  // ─────────────────────────────────────────────────────────────────────────────
  // R12: No context leakage: SLIDE_STUDIO completes -> new ARCH project -> "slide 3" must not route to old project.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R12] Testing no context leakage after studio completion...');
  studioSessionManagerInstance.completeSession('SLIDE_STUDIO');

  const newArch = studioSessionManagerInstance.createOrUpdateArchSession({
    projectId: 'ARCH-VILLA-009',
    projectTitle: 'Villa Tropis'
  });

  const r12Decision = unifiedStudioRouterInstance.route('slide 3', { activeStudio: newArch });
  assert.notStrictEqual(r12Decision.route, 'SLIDE_STUDIO', 'R12: Must not route to completed slide project');
  console.log('  ✓ R12 PASS: No context leakage from completed SLIDE_STUDIO into ARCHITECTURAL_STUDIO');

  // ─────────────────────────────────────────────────────────────────────────────
  // R13: Project isolation: SLIDE, ARCH, DATA sessions do not cross-contaminate.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R13] Testing project isolation between 3 studios...');
  studioSessionManagerInstance.clearSession();
  const s1 = studioSessionManagerInstance.createOrUpdateSlideSession({ projectId: 'S1-SLIDE', projectTitle: 'Deck A' });
  const s2 = studioSessionManagerInstance.createOrUpdateArchSession({ projectId: 'S2-ARCH', projectTitle: 'House B' });
  const s3 = studioSessionManagerInstance.createOrUpdateDataSession({ projectId: 'S3-DATA', projectTitle: 'Data C' });

  assert.strictEqual(s1.studioType, 'SLIDE_STUDIO');
  assert.strictEqual(s2.studioType, 'ARCHITECTURAL_STUDIO');
  assert.strictEqual(s3.studioType, 'DATA_LAB');
  assert.strictEqual(s1.project.projectId, 'S1-SLIDE');
  assert.strictEqual(s2.project.projectId, 'S2-ARCH');
  assert.strictEqual(s3.project.projectId, 'S3-DATA');
  console.log('  ✓ R13 PASS: All 3 Studio sessions maintained isolated states without cross-contamination');

  // ─────────────────────────────────────────────────────────────────────────────
  // R14: Revision propagation: READY -> revisi slide 3 -> UPDATE_REQUIRED -> QA -> LOCKED.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R14] Testing revision propagation state machine lifecycle...');
  const testSlideDeck = studioSessionManagerInstance.createOrUpdateSlideSession({
    projectId: 'SLIDE-LIFECYCLE-TEST',
    projectTitle: 'Uji Lifecycle',
    totalSlides: 5,
    slidePlan: [
      { number: 1, title: 'Cover', archetype: 'title_slide', status: ITEM_LIFECYCLE_STATUS.LOCKED },
      { number: 2, title: 'Agenda', archetype: 'framework_slide', status: ITEM_LIFECYCLE_STATUS.LOCKED },
      { number: 3, title: 'Pembahasan', archetype: 'framework_slide', status: ITEM_LIFECYCLE_STATUS.READY }
    ]
  });

  // User requests revision on slide 3
  const targetSlide = testSlideDeck.requestSlideRevision(3, 'tambahkan poin transparansi APBDes');
  assert.strictEqual(targetSlide.status, ITEM_LIFECYCLE_STATUS.UPDATE_REQUIRED);
  assert.strictEqual(targetSlide.revisionNotes, 'tambahkan poin transparansi APBDes');
  assert.strictEqual(testSlideDeck.execution.phase, STUDIO_PHASES.REVISION);

  // System regenerates and performs QA
  testSlideDeck.updateSlideStatus(3, ITEM_LIFECYCLE_STATUS.QA);
  assert.strictEqual(targetSlide.status, ITEM_LIFECYCLE_STATUS.QA);

  // System locks the slide as canonical version
  testSlideDeck.updateSlideStatus(3, ITEM_LIFECYCLE_STATUS.LOCKED);
  assert.strictEqual(targetSlide.status, ITEM_LIFECYCLE_STATUS.LOCKED);
  console.log('  ✓ R14 PASS: Slide lifecycle transition verified: READY → UPDATE_REQUIRED → QA → LOCKED');

  // ─────────────────────────────────────────────────────────────────────────────
  // R15: Explicit image collision: Active SLIDE_STUDIO + "buat gambar rumah" -> IMAGE_GENERATION.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R15] Testing active SLIDE_STUDIO + standalone "buat gambar rumah" -> IMAGE_GENERATION...');
  const r15Decision = unifiedStudioRouterInstance.route('buat gambar rumah sunset di pegunungan', { activeStudio: testSlideDeck });
  assert.strictEqual(r15Decision.route, 'IMAGE_GENERATION', 'R15: Must route to IMAGE_GENERATION');
  assert.strictEqual(r15Decision.priority, 'P4', 'R15: Priority must be P4 (Explicit Image Intent)');
  assert.strictEqual(r15Decision.bypassImageGeneration, false);
  console.log('  ✓ R15 PASS: Standalone "buat gambar rumah" exited studio to IMAGE_GENERATION (P4)');

  // ─────────────────────────────────────────────────────────────────────────────
  // R16: Studio-bound image collision: Active SLIDE_STUDIO + "buat gambar rumah untuk slide 3" -> SLIDE_STUDIO.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R16] Testing active SLIDE_STUDIO + studio-bound image command -> SLIDE_STUDIO...');
  const r16Decision = unifiedStudioRouterInstance.route('buat gambar rumah adat untuk slide 3', { activeStudio: testSlideDeck });
  assert.strictEqual(r16Decision.route, 'SLIDE_STUDIO', 'R16: Must route to SLIDE_STUDIO');
  assert.strictEqual(r16Decision.priority, 'P1', 'R16: Priority must be P1');
  assert.strictEqual(r16Decision.parameters.slideNumber, 3);
  assert.strictEqual(r16Decision.parameters.imageSubject, 'rumah adat');
  console.log('  ✓ R16 PASS: "buat gambar rumah untuk slide 3" cleanly routed to SLIDE_STUDIO (P1)');

  // ─────────────────────────────────────────────────────────────────────────────
  // R17: Ambiguous command: Active SLIDE_STUDIO + "buat yang lebih bagus" -> AMBIGUOUS.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R17] Testing active SLIDE_STUDIO + ambiguous command does not trigger IMAGE_GENERATION...');
  const r17Decision = unifiedStudioRouterInstance.route('buat yang lebih bagus', { activeStudio: testSlideDeck });
  assert.strictEqual(r17Decision.matchType, MATCH_TYPES.AMBIGUOUS);
  assert.strictEqual(r17Decision.bypassImageGeneration, true, 'R17: Must NEVER accidentally trigger image generation');
  console.log('  ✓ R17 PASS: Ambiguous feedback classified as AMBIGUOUS and bypassed IMAGE_GENERATION');

  // ─────────────────────────────────────────────────────────────────────────────
  // R18: Completed studio: SLIDE_STUDIO COMPLETE -> "slide 3" does not use completed session.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R18] Testing completed studio does not act as active session without reopening...');
  testSlideDeck.markComplete();
  assert.strictEqual(testSlideDeck.project.status, STUDIO_STATUSES.COMPLETE);

  const activeAfterComplete = studioSessionManagerInstance.getActiveSession('SLIDE_STUDIO');
  assert.strictEqual(activeAfterComplete, null, 'R18: Completed studio must return null from getActiveSession');

  const r18Decision = unifiedStudioRouterInstance.route('slide 3', { activeStudio: activeAfterComplete });
  assert.notStrictEqual(r18Decision.priority, 'P1', 'R18: Must not resolve as P1 active studio command');
  console.log('  ✓ R18 PASS: Completed studio cannot accept commands as active without reopening');

  // ─────────────────────────────────────────────────────────────────────────────
  // DATA_LAB Functional Execution Tests
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(' DATA_LAB FUNCTIONAL EXECUTION ENGINE VALIDATION');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  console.log('[DATA_LAB TEST 1] Ingesting dataset...');
  const dataset = dataLabStudioInstance.ingestDataset([
    { Bulan: 'Jan', Pendapatan: 50, Biaya: 40 },
    { Bulan: 'Feb', Pendapatan: 65, Biaya: 45 },
    { Bulan: 'Mar', Pendapatan: 80, Biaya: 50 }
  ], 'Laporan Finansial Q1');
  assert.strictEqual(dataset.rowCount, 3);
  assert.deepStrictEqual(dataset.columns, ['Bulan', 'Pendapatan', 'Biaya']);
  console.log('  ✓ Dataset ingestion verified (3 rows, 3 columns)');

  console.log('\n[DATA_LAB TEST 2] Rendering SVG Chart #1 (Bar) & #2 (Line)...');
  const chart1 = dataLabStudioInstance.renderSvgChart(dataset, { chartIndex: 1, chartType: 'bar' });
  assert.ok(chart1.svg.includes('<svg'));
  assert.ok(chart1.svg.includes('<rect'));
  assert.strictEqual(chart1.chartIndex, 1);

  const chart2 = dataLabStudioInstance.renderSvgChart(dataset, { chartIndex: 2, chartType: 'line' });
  assert.ok(chart2.svg.includes('<svg'));
  assert.ok(chart2.svg.includes('<polyline'));
  assert.strictEqual(chart2.chartIndex, 2);
  console.log('  ✓ SVG Charts generated cleanly (Bar & Line formats)');

  console.log('\n[DATA_LAB TEST 3] Calculating statistics & generating formatted report...');
  const stats = dataLabStudioInstance.calculateStatistics(dataset, 'rata-rata');
  assert.strictEqual(stats.count, 3);
  assert.strictEqual(stats.mean, 65);
  assert.strictEqual(stats.median, 65);

  const report = dataLabStudioInstance.generateReport(dataset, stats);
  assert.ok(report.includes('### 📊 Laporan Analisis Data: Laporan Finansial Q1'));
  assert.ok(report.includes('| Bulan | Pendapatan | Biaya |'));
  assert.ok(report.includes('Rata-rata: 65'));
  console.log('  ✓ Statistics & Structured Report generated accurately');

  // ─────────────────────────────────────────────────────────────────────────────
  // R19: Real Multi-Turn Slide Execution (create -> approve -> slide 1 -> slide 3 -> lanjut -> slide 5)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(' REAL EXECUTION CONTINUITY & LIFECYCLE TESTS (R19 - R25)');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  console.log('[TEST R19] Testing Real Multi-Turn Slide Execution (SAME projectId, SAME sessionId, SAME slidePlan)...');
  studioSessionManagerInstance.clearSession();

  const canonicalPlan20 = Array.from({ length: 20 }, (_, i) => ({
    number: i + 1,
    title: `Slide ${i + 1}: Tata Kelola Desa Bagian ${i + 1}`,
    subtitle: `Analisis Kebijakan Mandat Pasal ${i + 1}`,
    archetype: i % 2 === 0 ? 'framework_slide' : 'dashboard_slide',
    purpose: `Mandat dan implementasi tata kelola pasal ${i + 1}`,
    status: ITEM_LIFECYCLE_STATUS.PENDING
  }));

  const multiTurnSession = studioSessionManagerInstance.createOrUpdateSlideSession({
    projectId: 'PROJ-PERDES-2026',
    projectTitle: 'Kelemahan dan Kelebihan Regulasi Peraturan Desa',
    totalSlides: 20,
    slidePlan: canonicalPlan20
  });

  const origProjectId = multiTurnSession.project.projectId;
  const origSessionId = multiTurnSession.sessionId;

  // Turn 1: Approval
  const turn1 = await studioContinuationRouterInstance.evaluate('approve');
  assert.strictEqual(turn1.handled, true, 'R19: Turn 1 approve must be handled');
  assert.strictEqual(multiTurnSession.project.projectId, origProjectId);
  assert.strictEqual(multiTurnSession.sessionId, origSessionId);
  assert.strictEqual(multiTurnSession.currentSlide, 1);
  assert.strictEqual(multiTurnSession.findSlide(1).status, ITEM_LIFECYCLE_STATUS.LOCKED);

  // Turn 2: "slide 3"
  const turn2 = await studioContinuationRouterInstance.evaluate('slide 3');
  assert.strictEqual(turn2.handled, true, 'R19: Turn 2 slide 3 must be handled');
  assert.strictEqual(multiTurnSession.project.projectId, origProjectId);
  assert.strictEqual(multiTurnSession.sessionId, origSessionId);
  assert.strictEqual(multiTurnSession.currentSlide, 3);
  assert.strictEqual(multiTurnSession.findSlide(3).status, ITEM_LIFECYCLE_STATUS.LOCKED);

  // Turn 3: "lanjut" -> should advance to slide 4
  const turn3 = await studioContinuationRouterInstance.evaluate('lanjut');
  assert.strictEqual(turn3.handled, true, 'R19: Turn 3 lanjut must be handled');
  assert.strictEqual(multiTurnSession.project.projectId, origProjectId);
  assert.strictEqual(multiTurnSession.sessionId, origSessionId);
  assert.strictEqual(multiTurnSession.currentSlide, 4);
  assert.strictEqual(multiTurnSession.findSlide(4).status, ITEM_LIFECYCLE_STATUS.LOCKED);

  // Turn 4: "slide 5"
  const turn4 = await studioContinuationRouterInstance.evaluate('slide 5');
  assert.strictEqual(turn4.handled, true, 'R19: Turn 4 slide 5 must be handled');
  assert.strictEqual(multiTurnSession.project.projectId, origProjectId);
  assert.strictEqual(multiTurnSession.sessionId, origSessionId);
  assert.strictEqual(multiTurnSession.currentSlide, 5);
  assert.strictEqual(multiTurnSession.findSlide(5).status, ITEM_LIFECYCLE_STATUS.LOCKED);

  assert.strictEqual(multiTurnSession.slidePlan.length, 20, 'R19: slidePlan must remain 20 canonical slides');
  console.log('  ✓ R19 PASS: Multi-turn progression maintained SAME projectId, SAME sessionId, and canonical plan');

  // ─────────────────────────────────────────────────────────────────────────────
  // R20: Restart / Persistence Reload
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R20] Testing Process Restart & Disk Persistence Reload...');
  // Force save the current state to disk
  studioSessionManagerInstance._savePersisted();

  // Instantiate brand new manager simulating process restart
  const restartedManager = new StudioSessionManager();
  assert.strictEqual(restartedManager.activeStudio, 'SLIDE_STUDIO', 'R20: activeStudio must restore to SLIDE_STUDIO');
  const restoredSession = restartedManager.getActiveSession('SLIDE_STUDIO');
  assert.ok(restoredSession, 'R20: Active session must be restored from disk');
  assert.strictEqual(restoredSession.project.projectId, origProjectId, 'R20: Restored project ID must match');
  assert.strictEqual(restoredSession.currentSlide, 5, 'R20: Current slide must be restored at 5');

  // Verify continuation with restarted manager instance
  studioContinuationRouterInstance.sessionManager = restartedManager;
  const turnResume = await studioContinuationRouterInstance.evaluate('lanjut');
  assert.strictEqual(turnResume.handled, true);
  assert.strictEqual(restoredSession.currentSlide, 6, 'R20: Lanjut after restart must advance to slide 6');
  assert.strictEqual(restoredSession.findSlide(6).status, ITEM_LIFECYCLE_STATUS.LOCKED);

  // Restore singleton manager
  studioContinuationRouterInstance.sessionManager = studioSessionManagerInstance;
  console.log('  ✓ R20 PASS: State restored from disk across restart; "lanjut" advanced to slide 6 seamlessly');

  // ─────────────────────────────────────────────────────────────────────────────
  // R21: Studio Isolation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R21] Testing Studio Isolation between SLIDE, ARCH, and DATA studios...');
  const projA = studioSessionManagerInstance.createOrUpdateSlideSession({
    projectId: 'PROJ-ALPHA-SLIDE',
    projectTitle: 'Slide Project Alpha',
    totalSlides: 10
  });

  const projB = studioSessionManagerInstance.createOrUpdateArchSession({
    projectId: 'PROJ-BETA-ARCH',
    projectTitle: 'Villa 2 Lantai Beta',
    totalSteps: 8
  });

  const projC = studioSessionManagerInstance.createOrUpdateDataSession({
    projectId: 'PROJ-GAMMA-DATA',
    projectTitle: 'Dataset Finansial Gamma'
  });

  // Make SLIDE_STUDIO active
  studioSessionManagerInstance.activeStudio = 'SLIDE_STUDIO';

  // Send "slide 3"
  const slideIsoTurn = await studioContinuationRouterInstance.evaluate('slide 3');
  assert.strictEqual(slideIsoTurn.handled, true);
  assert.strictEqual(projA.currentSlide, 3);

  // Check Project B remains completely isolated
  assert.strictEqual(projB.project.projectId, 'PROJ-BETA-ARCH');
  assert.strictEqual(projB.execution.currentIndex, 0);
  assert.strictEqual(projB.archSteps[0].stepNumber, 1);

  // Check Project C remains completely isolated
  assert.strictEqual(projC.project.projectId, 'PROJ-GAMMA-DATA');
  assert.strictEqual(projC.execution.currentStep, 'DATASET_PROFILE');
  console.log('  ✓ R21 PASS: Project states strictly isolated; zero cross-contamination between studios');

  // ─────────────────────────────────────────────────────────────────────────────
  // R22: Revision Propagation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R22] Testing Revision Propagation Lifecycle (READY/LOCKED -> UPDATE_REQUIRED -> QA -> LOCKED)...');
  const s3Before = projA.findSlide(3);
  assert.strictEqual(s3Before.status, ITEM_LIFECYCLE_STATUS.LOCKED);

  // Request revision on slide 3
  const revInstruction = 'tambahkan dasar hukum regulasi desa Permendagri No. 73/2020';
  const revTurn = await studioContinuationRouterInstance.evaluate(`revisi slide 3: ${revInstruction}`);
  assert.strictEqual(revTurn.handled, true);

  const s3After = projA.findSlide(3);
  assert.strictEqual(s3After.status, ITEM_LIFECYCLE_STATUS.LOCKED, 'R22: Slide 3 must return to LOCKED after regeneration');
  assert.strictEqual(s3After.revisionNotes, revInstruction, 'R22: Revision notes must be saved in slide definition');
  assert.ok(s3After.artifact?.path, 'R22: Updated artifact path must exist');
  console.log('  ✓ R22 PASS: Slide revision transitioned, regenerated, verified QA, and re-locked');

  // ─────────────────────────────────────────────────────────────────────────────
  // R23: Artifact/UI Continuity
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R23] Testing Artifact & UI Payload Continuity (SLIDE_ARTIFACT & SLIDE_DECK_ARTIFACT)...');
  assert.strictEqual(revTurn.artifactType, 'SLIDE_ARTIFACT');
  assert.ok(revTurn.previewUrl.startsWith('/artifacts/slides/'), 'R23: previewUrl must be valid');
  assert.ok(revTurn.pptxUrl.endsWith('.pptx'), 'R23: pptxUrl must be a .pptx file');
  assert.ok(revTurn.slideTitle.includes('SLIDE 03 / 10:'), 'R23: slideTitle must have structured title');
  assert.ok(revTurn.detailedTextDisplay.includes('Unduh Berkas Presentasi PowerPoint (.pptx)'), 'R23: Display text must include markdown link');
  assert.notStrictEqual(revTurn.artifactType, 'JIN VISUAL ASSET', 'R23: Must NEVER degrade to generic visual asset');

  // Test full deck export
  const exportTurn = await studioContinuationRouterInstance.evaluate('export PPT');
  assert.strictEqual(exportTurn.handled, true);
  assert.strictEqual(exportTurn.artifactType, 'SLIDE_DECK_ARTIFACT');
  assert.ok(exportTurn.pptxUrl.endsWith('.pptx'));
  assert.strictEqual(exportTurn.totalSlides, 10);
  console.log('  ✓ R23 PASS: Frontend payloads retain strict artifact types, valid URLs, and structured schemas');

  // ─────────────────────────────────────────────────────────────────────────────
  // R24: No Image Leakage Across Studio Workflows
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R24] Testing Zero Image Leakage across Studio Commands...');
  let imageCalls = 0;
  const originalGenerate = imageGenerationInstance.generateImage;
  imageGenerationInstance.generateImage = async (...args) => {
    imageCalls++;
    return originalGenerate.apply(imageGenerationInstance, args);
  };

  try {
    // 1. "slide 4" in active SLIDE_STUDIO
    await studioContinuationRouterInstance.evaluate('slide 4');
    // 2. "lanjut"
    await studioContinuationRouterInstance.evaluate('lanjut');
    // 3. "revisi slide 4: perjelas diagram"
    await studioContinuationRouterInstance.evaluate('revisi slide 4: perjelas diagram');

    // 4. In active ARCHITECTURAL_STUDIO: "tampak depan"
    studioSessionManagerInstance.activeStudio = 'ARCHITECTURAL_STUDIO';
    await studioContinuationRouterInstance.evaluate('tampak depan');

    // 5. In active DATA_LAB: "buat grafik kedua"
    studioSessionManagerInstance.activeStudio = 'DATA_LAB';
    await studioContinuationRouterInstance.evaluate('buat grafik kedua');

    assert.strictEqual(imageCalls, 0, `R24: Expected 0 ImageGeneration calls, but got ${imageCalls}`);
    console.log('  ✓ R24 PASS: 0 image generation calls during entire Studio sequence (IMAGE_GENERATION_CALLS = 0)');
  } finally {
    imageGenerationInstance.generateImage = originalGenerate;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // R25: Full Production Journey (20 Slides Canonical Deck + Export)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST R25] Testing Full Production Journey (20/20 Slides Canonical Deck + PPTX)...');
  studioSessionManagerInstance.clearSession();

  const fullDeckSession = studioSessionManagerInstance.createOrUpdateSlideSession({
    projectId: 'PROJ-FULL-20-DECK',
    projectTitle: 'Kelemahan dan Kelebihan Regulasi Peraturan Desa Lengkap',
    totalSlides: 20,
    slidePlan: Array.from({ length: 20 }, (_, i) => ({
      number: i + 1,
      title: `Slide ${i + 1}: Analisis Regulasi Desa Bab ${i + 1}`,
      subtitle: `Mandat Pengawasan dan Pelaksanaan Pasal ${i + 1}`,
      archetype: i % 3 === 0 ? 'title_slide' : (i % 2 === 0 ? 'framework_slide' : 'dashboard_slide'),
      purpose: `Hierarki hukum pasal ${i + 1}`,
      status: ITEM_LIFECYCLE_STATUS.PENDING
    }))
  });

  const fullProdResult = await studioContinuationRouterInstance.evaluate('buat semua slide');
  assert.strictEqual(fullProdResult.handled, true, 'R25: Full production must be handled');
  assert.strictEqual(fullProdResult.artifactType, 'SLIDE_DECK_ARTIFACT');
  assert.strictEqual(fullProdResult.totalSlides, 20, 'R25: Must produce all 20 slides');
  assert.strictEqual(fullProdResult.results.length, 20, 'R25: Must have 20 individual slide results');

  // Verify all 20 slides in session are LOCKED
  for (let sNum = 1; sNum <= 20; sNum++) {
    const s = fullDeckSession.findSlide(sNum);
    assert.strictEqual(s.status, ITEM_LIFECYCLE_STATUS.LOCKED, `R25: Slide ${sNum} must be LOCKED`);
    assert.ok(fs.existsSync(s.artifact.path), `R25: Slide ${sNum} preview file must exist on disk`);
    assert.ok(fs.existsSync(s.artifact.pptxPath), `R25: Slide ${sNum} PPTX file must exist on disk`);
  }

  // Verify master PPTX deck file exists on disk and is non-empty
  const masterDeckFile = path.join('d:/Users/ultimateai', fullProdResult.pptxUrl.replace(/^\//, ''));
  assert.ok(fs.existsSync(masterDeckFile), 'R25: Master PPTX deck file must exist on disk');
  const masterStats = fs.statSync(masterDeckFile);
  assert.ok(masterStats.size > 10000, `R25: Master PPTX deck must be valid size (>10KB), got ${masterStats.size} bytes`);

  console.log(`  ✓ R25 PASS: Full 20/20 slides produced, QA passed, 20/20 LOCKED, master PPTX generated (${Math.round(masterStats.size / 1024)} KB)`);

  console.log('\n================================================================');
  console.log('✅ ALL 25 INVARIANTS (R01 - R25) + DATA_LAB ENGINE PASSED (100%)!');
  console.log('================================================================');
}

runRegressionSuite().catch(err => {
  console.error('\n❌ REGRESSION TEST FAILED:', err);
  process.exit(1);
});
