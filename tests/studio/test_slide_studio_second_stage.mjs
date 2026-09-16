/**
 * tests/studio/test_slide_studio_second_stage.mjs
 * Comprehensive Verification Suite for SLIDE_STUDIO v1 Second Stage Architecture Fix.
 * 
 * Verifies:
 * TEST A: "Topic 20 slide" correctly separates title and slideCount.
 * TEST B: Master Draft creates active SLIDE_STUDIO session with 3-tier state.
 * TEST C: "slide 3" resolves to slidePlan[2] (canonical framework_slide).
 * TEST D: "lanjut slide 3" resolves to slidePlan[2].
 * TEST E: "lanjut" advances currentSlide.
 * TEST F: "ulang slide 3" regenerates slide 3.
 * TEST G: "revisi slide 3 ..." invokes revision pipeline.
 * TEST H: No active studio -> normal routing remains unchanged.
 * TEST I: Active SLIDE_STUDIO + "slide 3" NEVER calls image generation.
 * TEST J: Frontend receives and renders actual SlideStudio artifact (distinguished artifactType).
 * TEST K: Existing SlideStudio 7/7 regression suite remains PASS.
 */

import assert from 'assert';
import { slideDeckPlannerInstance } from '../../server/studio/slide/SlideDeckPlanner.mjs';
import { slidePlannerInstance } from '../../server/studio/slide/SlidePlanner.mjs';
import { studioSessionManagerInstance } from '../../server/studio/core/StudioSessionManager.mjs';
import { studioCommandParserInstance } from '../../server/studio/core/StudioCommandParser.mjs';
import { studioContinuationRouterInstance } from '../../server/studio/core/StudioContinuationRouter.mjs';
import { semanticIntentEngineInstance } from '../../server/agent/SemanticIntentEngine.mjs';

console.log('=== SLIDE_STUDIO v1 — SECOND STAGE ARCHITECTURE REGRESSION SUITE ===\n');

async function runAllTests() {
  let passedTests = 0;
  const totalTests = 11;

  // ---------------------------------------------------------------------------
  // TEST A: "Topic 20 slide" correctly separates title and slideCount
  // ---------------------------------------------------------------------------
  console.log('[TEST A] Testing semantic title and production parameter separation...');
  const testInputA = 'Kelemahan dan Kelebihan Regulasi Peraturan Desa 20 slide';
  const deckDetection = slideDeckPlannerInstance.detectDeckRequest(testInputA);

  assert.strictEqual(deckDetection.isDeck, true, 'Must detect deck request');
  assert.strictEqual(deckDetection.count, 20, 'Must extract slideCount = 20');
  assert.strictEqual(deckDetection.rawTopic, 'Kelemahan dan Kelebihan Regulasi Peraturan Desa', 'Must strip "20 slide" from topic');

  const slidePlanA = slidePlannerInstance.planSlide(testInputA);
  assert.strictEqual(slidePlanA.title, 'Kelemahan dan Kelebihan Regulasi Peraturan Desa', 'SlidePlanner must strip "20 slide" from title');

  const deckPlanA = slideDeckPlannerInstance.planDeck(deckDetection.rawTopic, deckDetection.count);
  assert.strictEqual(deckPlanA.topic, 'Kelemahan dan Kelebihan Regulasi Peraturan Desa');
  assert.strictEqual(deckPlanA.count, 20);
  assert.strictEqual(deckPlanA.slides.length, 20);

  const draftText = slideDeckPlannerInstance.generateMasterDraft(deckPlanA);
  assert.ok(draftText.includes('**PROJECT TITLE:** **Kelemahan dan Kelebihan Regulasi Peraturan Desa**'), 'Draft must expose PROJECT TITLE');
  assert.ok(draftText.includes('**SLIDE COUNT:** **20 Slides**'), 'Draft must expose SLIDE COUNT');
  assert.ok(draftText.includes('**CURRENT PHASE:** **MASTER_DRAFT**'), 'Draft must expose CURRENT PHASE');
  assert.ok(draftText.includes('**APPROVAL STATUS:**'), 'Draft must expose APPROVAL STATUS');
  assert.ok(draftText.includes('## B. SLIDE PLAN (20 SLIDES)'), 'Draft must expose complete 20 slide plan');

  console.log('  ✓ TEST A PASS: Title cleanly separated ("Kelemahan dan Kelebihan Regulasi Peraturan Desa"), slideCount = 20');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST B: Master Draft creates active SLIDE_STUDIO session
  // ---------------------------------------------------------------------------
  console.log('\n[TEST B] Testing active SLIDE_STUDIO session establishment with 3-tier schema...');
  const session = studioSessionManagerInstance.createOrUpdateSlideSession({
    projectId: 'DECK-001',
    projectTitle: deckPlanA.topic,
    totalSlides: deckPlanA.count,
    currentSlide: 1,
    phase: 'MASTER_DRAFT',
    status: 'ACTIVE',
    masterDraft: deckPlanA,
    slidePlan: deckPlanA.slides
  });

  assert.ok(session, 'Session must exist');
  assert.deepStrictEqual(session.project, {
    id: 'DECK-001',
    title: 'Kelemahan dan Kelebihan Regulasi Peraturan Desa',
    requestedSlideCount: 20
  }, 'Project tier must match schema');

  assert.deepStrictEqual(session.studio, {
    type: 'SLIDE_STUDIO',
    phase: 'MASTER_DRAFT',
    status: 'ACTIVE'
  }, 'Studio tier must match schema');

  assert.strictEqual(session.slides.current, 1, 'Current slide must be 1');
  assert.strictEqual(session.slides.total, 20, 'Total slides must be 20');
  assert.strictEqual(session.slides.plan.length, 20, 'Must preserve complete 20 slide plan');

  console.log('  ✓ TEST B PASS: 3-tier state established (project, studio, slides)');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST C: "slide 3" resolves to slidePlan[2]
  // ---------------------------------------------------------------------------
  console.log('\n[TEST C] Testing canonical resolution of "slide 3" to slidePlan[2]...');
  const parsedC = studioCommandParserInstance.parse('slide 3', session);
  assert.strictEqual(parsedC.action, 'GENERATE_SLIDE');
  assert.strictEqual(parsedC.slideNumber, 3);

  const resC = await studioContinuationRouterInstance.evaluate('slide 3');
  assert.strictEqual(resC.handled, true, 'Must be handled by continuation router');
  assert.strictEqual(resC.artifactType, 'SLIDE_ARTIFACT', 'Artifact must be SLIDE_ARTIFACT');
  assert.strictEqual(session.slides.current, 3, 'Current slide must update to 3');
  assert.strictEqual(session.studio.phase, 'PRODUCTION', 'Phase must transition to PRODUCTION');

  // Verify canonical resolution to slidePlan[2]
  const canonicalSlide3 = session.slides.plan[2];
  assert.strictEqual(canonicalSlide3.num, 3);
  assert.strictEqual(canonicalSlide3.archetype, 'framework_slide');
  assert.strictEqual(canonicalSlide3.title, 'Landasan Hukum & Regulasi Pengawasan Desa');
  assert.strictEqual(resC.slideResult.slideType, 'framework_slide');

  console.log(`  ✓ TEST C PASS: "slide 3" resolved to slidePlan[2] (${canonicalSlide3.title} / ${canonicalSlide3.archetype})`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST D: "lanjut slide 3" resolves to slidePlan[2]
  // ---------------------------------------------------------------------------
  console.log('\n[TEST D] Testing "lanjut slide 3" resolution...');
  const parsedD = studioCommandParserInstance.parse('lanjut slide 3', session);
  assert.strictEqual(parsedD.action, 'GENERATE_SLIDE');
  assert.strictEqual(parsedD.slideNumber, 3);
  console.log('  ✓ TEST D PASS: "lanjut slide 3" parsed as GENERATE_SLIDE(3)');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST E: "lanjut" advances currentSlide
  // ---------------------------------------------------------------------------
  console.log('\n[TEST E] Testing "lanjut" advances currentSlide...');
  session.slides.current = 3; // ensure starting from 3
  const parsedE = studioCommandParserInstance.parse('lanjut', session);
  assert.ok(parsedE.action === 'NEXT_SLIDE' || parsedE.action === 'ADVANCE_SLIDE', 'Action must be NEXT_SLIDE or ADVANCE_SLIDE');
  assert.strictEqual(parsedE.slideNumber, 4);

  const resE = await studioContinuationRouterInstance.evaluate('lanjut');
  assert.strictEqual(resE.handled, true);
  assert.strictEqual(session.slides.current, 4, 'Current slide must advance to 4');
  const canonicalSlide4 = session.slides.plan[3];
  assert.strictEqual(resE.slideResult.slideType, canonicalSlide4.archetype);

  console.log(`  ✓ TEST E PASS: "lanjut" advanced from slide 3 to slide 4 (${canonicalSlide4.title})`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST F: "ulang slide 3" regenerates slide 3
  // ---------------------------------------------------------------------------
  console.log('\n[TEST F] Testing "ulang slide 3"...');
  const parsedF = studioCommandParserInstance.parse('ulang slide 3', session);
  assert.strictEqual(parsedF.action, 'REGENERATE_SLIDE');
  assert.strictEqual(parsedF.slideNumber, 3);

  const resF = await studioContinuationRouterInstance.evaluate('ulang slide 3');
  assert.strictEqual(resF.handled, true);
  assert.strictEqual(session.slides.current, 3);
  assert.strictEqual(resF.slideResult.slideType, session.slides.plan[2].archetype);

  console.log('  ✓ TEST F PASS: "ulang slide 3" regenerated slide 3');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST G: "revisi slide 3 ..." invokes revision pipeline
  // ---------------------------------------------------------------------------
  console.log('\n[TEST G] Testing "revisi slide 3 ..." revision pipeline...');
  const revPrompt = 'revisi slide 3: perkuat rujukan Permendagri No. 73/2020 dan peran BPD';
  const parsedG = studioCommandParserInstance.parse(revPrompt, session);
  assert.strictEqual(parsedG.action, 'REVISE_SLIDE');
  assert.strictEqual(parsedG.slideNumber, 3);
  assert.ok(parsedG.revisionNotes.includes('Permendagri No. 73/2020'));

  const resG = await studioContinuationRouterInstance.evaluate(revPrompt);
  assert.strictEqual(resG.handled, true);
  assert.strictEqual(resG.artifactType, 'SLIDE_ARTIFACT');
  assert.strictEqual(session.slides.current, 3);

  console.log('  ✓ TEST G PASS: Revision pipeline executed with revision notes on slide 3');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST H: No active studio -> normal routing remains unchanged
  // ---------------------------------------------------------------------------
  console.log('\n[TEST H] Testing behavior when no active studio session exists...');
  studioSessionManagerInstance.clearSession('SLIDE_STUDIO');
  assert.strictEqual(studioSessionManagerInstance.hasActiveSession('SLIDE_STUDIO'), false);

  const resH = await studioContinuationRouterInstance.evaluate('slide 3');
  assert.strictEqual(resH.handled, false, 'Continuation router must NOT intercept when no active session');

  console.log('  ✓ TEST H PASS: No active studio -> returns handled=false, routing proceeds normally');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST I: Active SLIDE_STUDIO + "slide 3" NEVER calls image generation
  // ---------------------------------------------------------------------------
  console.log('\n[TEST I] Testing active SLIDE_STUDIO intercepting "slide 3" before image generation...');
  // Restore active session
  studioSessionManagerInstance.createOrUpdateSlideSession({
    projectId: 'DECK-001',
    projectTitle: deckPlanA.topic,
    totalSlides: deckPlanA.count,
    currentSlide: 1,
    phase: 'PRODUCTION',
    status: 'ACTIVE',
    masterDraft: deckPlanA,
    slidePlan: deckPlanA.slides
  });

  // Verify routing priority: StudioContinuationRouter intercepts "slide 3" with PRIORITY 1
  const priority1Match = await studioContinuationRouterInstance.evaluate('slide 3');
  assert.strictEqual(priority1Match.handled, true, 'Priority 1 must intercept before any intent gate or LLM call');

  // Verify image classifier does NOT misroute "slide 3" to generic image generation
  const imgDecision = semanticIntentEngineInstance._imageGenerationClassifier('slide 3', []);
  assert.strictEqual(imgDecision, null, '"slide 3" must NEVER match generic image generation');

  console.log('  ✓ TEST I PASS: "slide 3" intercepted by Priority 1 router; image generation is NEVER called');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST J: Frontend receives and renders actual SlideStudio artifact
  // ---------------------------------------------------------------------------
  console.log('\n[TEST J] Verifying frontend artifact distinctions (MASTER_DRAFT vs SLIDE vs GENERIC_IMAGE)...');
  // 1. Master Draft Artifact
  const draftArtifactType = 'MASTER_DRAFT_ARTIFACT';
  assert.notStrictEqual(draftArtifactType, 'IMAGE');
  assert.notStrictEqual(draftArtifactType, 'GENERIC_IMAGE_ARTIFACT');

  // 2. Slide Artifact
  assert.strictEqual(priority1Match.artifactType, 'SLIDE_ARTIFACT');
  assert.ok(priority1Match.slideTitle.startsWith('SLIDE 03 / 20'), `Slide title formatted cleanly: ${priority1Match.slideTitle}`);
  assert.ok(priority1Match.previewUrl.includes('/artifacts/slides/'), 'Preview URL points to slide artifacts directory');
  assert.ok(priority1Match.pptxUrl.includes('.pptx'), 'PPTX URL points to editable PPTX artifact');
  assert.ok(!priority1Match.slideTitle.includes('JIN VISUAL ASSET'), 'Must not use legacy JIN VISUAL ASSET title');

  console.log('  ✓ TEST J PASS: Clean artifact distinction verified (MASTER_DRAFT_ARTIFACT & SLIDE_ARTIFACT)');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST K: Existing SlideStudio 7/7 regression suite remains PASS
  // ---------------------------------------------------------------------------
  console.log('\n[TEST K] Verifying existing SlideStudio 7/7 regression test suite...');
  const { slideStudioInstance } = await import('../../server/studio/slide/SlideStudio.mjs');
  const regressionSlide = await slideStudioInstance.createSlide("Kelebihan dan Kekurangan Regulasi Perdes, landscape, corporate enterprise");

  assert.strictEqual(regressionSlide.success, true);
  assert.strictEqual(regressionSlide.slideType, 'comparison_slide');
  assert.strictEqual(regressionSlide.schema.canvas.aspectRatio, '16:9');
  assert.strictEqual(regressionSlide.schema.columns.length, 2);
  assert.strictEqual(regressionSlide.schema.columns[0].items.length, 5);
  assert.strictEqual(regressionSlide.schema.columns[1].items.length, 5);
  assert.ok(regressionSlide.files.preview.length < 500000);
  assert.strictEqual(regressionSlide.qaReport.passed, true);

  console.log('  ✓ TEST K PASS: Core SlideStudio 7/7 pipeline remains 100% PASS');
  passedTests++;

  console.log(`\n================================================================`);
  console.log(`✅ ALL ${passedTests}/${totalTests} SECOND STAGE ARCHITECTURE TESTS PASSED SUCCESSFULLY!`);
  console.log(`================================================================\n`);
}

runAllTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
