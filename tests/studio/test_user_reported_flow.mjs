/**
 * tests/studio/test_user_reported_flow.mjs
 * Verification of the exact user prompt reported in screenshot:
 * 'Buat presentasi 20 slide dengan tema "Kelemahan dan kelebihan Regulasi Peraturan Desa"'
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { slideDeckPlannerInstance } from '../../server/studio/slide/SlideDeckPlanner.mjs';
import { slidePlannerInstance } from '../../server/studio/slide/SlidePlanner.mjs';
import { slideStudioInstance } from '../../server/studio/slide/SlideStudio.mjs';
import { studioSessionManagerInstance } from '../../server/studio/core/StudioSessionManager.mjs';
import { studioContinuationRouterInstance } from '../../server/studio/core/StudioContinuationRouter.mjs';

console.log('=== TEST SUITE: USER REPORTED PRESENTATION CREATION & CONTINUATION FLOW ===\n');

async function run() {
  const userPrompt = 'Buat presentasi 20 slide dengan tema "Kelemahan dan kelebihan Regulasi Peraturan Desa"';

  // 1. Verify Topic & Count Extraction
  console.log('[TEST 1] Testing Clean Topic & Count Extraction...');
  const detection = slideDeckPlannerInstance.detectDeckRequest(userPrompt);
  assert.strictEqual(detection.isDeck, true, 'Must detect as deck request');
  assert.strictEqual(detection.count, 20, 'Must extract 20 slides');
  console.log(`  Raw topic extracted: "${detection.rawTopic}"`);
  assert.strictEqual(
    detection.rawTopic.toLowerCase().includes('dengan tema'),
    false,
    'Topic must NOT include leftover "dengan tema"'
  );
  assert.ok(
    detection.rawTopic.toLowerCase().includes('kelemahan dan kelebihan regulasi peraturan desa'),
    'Topic must accurately capture core theme'
  );
  console.log('  ✓ TEST 1 PASSED: Topic cleanly extracted without command leftover\n');

  // 2. Verify Canonical Plan Generation
  console.log('[TEST 2] Testing Canonical Plan Sequence...');
  const canonicalPlan = slidePlannerInstance.createCanonicalDeckPlan(detection.rawTopic, detection.count);
  assert.strictEqual(canonicalPlan.length, 20, 'Must plan 20 slides');
  assert.strictEqual(canonicalPlan[0].archetype, 'title_slide', 'Slide 1 must be title_slide');
  assert.strictEqual(canonicalPlan[1].archetype, 'quote_slide', 'Slide 2 must be quote_slide');
  assert.strictEqual(canonicalPlan[2].archetype, 'hierarchy_slide', 'Slide 3 must be hierarchy_slide');
  assert.strictEqual(canonicalPlan[3].archetype, 'process_slide', 'Slide 4 must be process_slide');
  assert.strictEqual(canonicalPlan[4].archetype, 'grid_slide', 'Slide 5 must be grid_slide');
  console.log('  ✓ TEST 2 PASSED: 20-slide canonical sequence confirmed\n');

  // 3. Verify Slide 1 Generation as Cover/Title with Presenter
  console.log('[TEST 3] Testing Slide 1 Generation (Must be Cover/Title, NOT 2-column comparison)...');
  const coverPrompt = `Slide 1: ${canonicalPlan[0].title}, ${canonicalPlan[0].subtitle}, cover opening slide`;
  const slide1Result = await slideStudioInstance.createSlide(coverPrompt, {
    forceType: 'title_slide',
    title: canonicalPlan[0].title,
    subtitle: canonicalPlan[0].subtitle,
    presenter: canonicalPlan[0].presenter
  });

  assert.strictEqual(slide1Result.slideType, 'title_slide', 'Slide 1 must have slideType title_slide');
  assert.strictEqual(slide1Result.schema.slideType, 'title_slide', 'Schema must be title_slide');
  assert.ok(slide1Result.svg.includes('DOKUMEN STRATEGIS') || slide1Result.svg.includes('PRESENTASI EKSEKUTIF'), 'SVG must feature executive branding');
  assert.ok(!slide1Result.svg.includes('KEKURANGAN REGULASI PERDES'), 'SVG must NOT be comparison slide');
  console.log('  ✓ TEST 3 PASSED: Slide 1 generated as authentic Title slide with clean executive layout\n');

  // 4. Verify Session Setup & Turn-by-turn Continuation
  console.log('[TEST 4] Testing Active Session Establishment & Turn-by-Turn Flow...');
  const session = studioSessionManagerInstance.createOrUpdateSlideSession({
    projectId: `DECK-TEST-${Date.now().toString().slice(-4)}`,
    deckId: `DECK-TEST-${Date.now().toString().slice(-4)}`,
    projectTitle: detection.rawTopic,
    totalSlides: 20,
    currentSlide: 1,
    phase: 'ACTIVE',
    status: 'ACTIVE',
    slidePlan: canonicalPlan
  });

  session.updateSlideState(1, {
    status: 'LOCKED',
    artifact: {
      svg: slide1Result.files.svg.path,
      preview: slide1Result.files.preview.path,
      pptx: slide1Result.files.pptx.path
    }
  });

  // User sends "lanjut" -> must generate Slide 2 (quote_slide)
  console.log('  User sends: "lanjut"');
  const turn2 = await studioContinuationRouterInstance.evaluate('lanjut');
  assert.strictEqual(turn2.handled, true, '"lanjut" must be handled by studio continuation');
  assert.strictEqual(turn2.session.currentSlide, 2, 'Session must advance to Slide 2');
  assert.strictEqual(turn2.slideResult.slideType, 'quote_slide', 'Slide 2 must be quote_slide');
  assert.ok(!turn2.detailedTextDisplay.includes('MASTER DESIGN DRAFT'), 'Response must NOT contain MASTER DESIGN DRAFT');
  assert.ok(!turn2.detailedTextDisplay.includes('secara programatik'), 'Response must be polite conversational');
  console.log('  ✓ Slide 2 generated as quote_slide with polite conversational text');

  // User sends "slide 3" -> must generate Slide 3 (hierarchy_slide)
  console.log('  User sends: "slide 3"');
  const turn3 = await studioContinuationRouterInstance.evaluate('slide 3');
  assert.strictEqual(turn3.handled, true, '"slide 3" must be handled');
  assert.strictEqual(turn3.session.currentSlide, 3, 'Session must set currentSlide to 3');
  assert.strictEqual(turn3.slideResult.slideType, 'hierarchy_slide', 'Slide 3 must be hierarchy_slide');
  console.log('  ✓ Slide 3 generated as hierarchy_slide');

  // 5. Verify Zero "MASTER DESIGN DRAFT" and Zero Fake Stubs
  console.log('\n[TEST 5] Verifying Total Elimination of Fake Artifact Titles & Stubs...');
  assert.notStrictEqual(turn2.artifactType, 'MASTER_DRAFT_ARTIFACT', 'Artifact type must not be MASTER_DRAFT_ARTIFACT');
  assert.strictEqual(turn2.artifactType, 'SLIDE_ARTIFACT', 'Artifact type must be SLIDE_ARTIFACT');
  console.log('  ✓ TEST 5 PASSED: Artifact properly categorized as SLIDE_ARTIFACT');

  console.log('\n=============================================================');
  console.log('🎉 ALL TESTS IN USER REPORTED PRESENTATION FLOW PASSED 100%!');
  console.log('=============================================================');
}

run().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
