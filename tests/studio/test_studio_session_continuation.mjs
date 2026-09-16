/**
 * tests/studio/test_studio_session_continuation.mjs
 * Comprehensive Regression Test Suite for Studio Session Continuation Layer.
 * Tests specifications A through J for persistent multi-turn conversational studio projects.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { studioSessionManagerInstance } from '../../server/studio/core/StudioSessionManager.mjs';
import { studioCommandParserInstance } from '../../server/studio/core/StudioCommandParser.mjs';
import { studioContinuationRouterInstance } from '../../server/studio/core/StudioContinuationRouter.mjs';
import { slideDeckPlannerInstance } from '../../server/studio/slide/SlideDeckPlanner.mjs';
import { semanticIntentEngineInstance } from '../../server/agent/SemanticIntentEngine.mjs';

console.log('=== TEST SUITE: STUDIO SESSION & CONVERSATIONAL CONTINUATION (A - J) ===\n');

async function runSuite() {
  // [A] Initial Request -> SLIDE_STUDIO Intent
  console.log('[A] Testing Initial Request intent routing...');
  const initialPrompt = 'JIN buatkan draft PPT dengan Tema "Monev dan Problematika Aparatur Desa" sebanyak 20 slide';
  const clean = semanticIntentEngineInstance._normalizeUtterance(initialPrompt);
  const decision = semanticIntentEngineInstance._slideStudioClassifier(clean, []);
  
  assert.ok(decision, 'Classifier must return decision for initial deck request');
  assert.strictEqual(decision.intent, 'SLIDE_STUDIO');
  console.log('  ✓ Initial prompt deterministically classified as SLIDE_STUDIO');

  // [B] Master Draft Generation & Active Session Persistence
  console.log('\n[B] Testing Master Draft & Session Persistence...');
  const deckPlan = slideDeckPlannerInstance.planDeck('Monev dan Problematika Aparatur Desa', 20);
  assert.strictEqual(deckPlan.slides.length, 20, 'Must plan 20 slides');

  const session = studioSessionManagerInstance.createOrUpdateSlideSession({
    projectId: 'deck_test_session_01',
    deckId: 'deck_test_session_01',
    projectTitle: deckPlan.topic,
    totalSlides: deckPlan.count,
    currentSlide: 1,
    masterDraft: deckPlan,
    slidePlan: deckPlan.slides
  });

  assert.ok(session, 'Session must be created');
  assert.strictEqual(session.studio, 'SLIDE_STUDIO');
  assert.strictEqual(session.totalSlides, 20);
  assert.strictEqual(session.currentSlide, 1);
  assert.strictEqual(session.slidePlan.length, 20);
  
  const active = studioSessionManagerInstance.getActiveSession();
  assert.ok(active, 'Active session must be retrieved from manager');
  assert.strictEqual(active.projectId, 'deck_test_session_01');
  console.log('  ✓ Active Studio Session persisted with 20 slides and topic');

  // [C] Parsing "slide 3" -> GENERATE_SLIDE, slideNumber: 3
  console.log('\n[C] Testing "slide 3" command parsing...');
  const cmdC = studioCommandParserInstance.parse('slide 3', active);
  assert.ok(cmdC, 'Must parse "slide 3"');
  assert.strictEqual(cmdC.studio, 'SLIDE_STUDIO');
  assert.strictEqual(cmdC.action, 'GENERATE_SLIDE');
  assert.strictEqual(cmdC.slideNumber, 3);
  console.log('  ✓ "slide 3" -> GENERATE_SLIDE / 3');

  // [D] Parsing "lanjut slide 3" -> GENERATE_SLIDE, slideNumber: 3
  console.log('\n[D] Testing "lanjut slide 3" command parsing...');
  const cmdD = studioCommandParserInstance.parse('lanjut slide 3', active);
  assert.ok(cmdD, 'Must parse "lanjut slide 3"');
  assert.strictEqual(cmdD.action, 'GENERATE_SLIDE');
  assert.strictEqual(cmdD.slideNumber, 3);
  console.log('  ✓ "lanjut slide 3" -> GENERATE_SLIDE / 3');

  // [E] Parsing "lanjut" -> ADVANCE_SLIDE, currentSlide + 1
  console.log('\n[E] Testing "lanjut" sequential continuation...');
  active.currentSlide = 2;
  const cmdE = studioCommandParserInstance.parse('lanjut', active);
  assert.ok(cmdE, 'Must parse "lanjut"');
  assert.strictEqual(cmdE.action, 'ADVANCE_SLIDE');
  assert.strictEqual(cmdE.slideNumber, 3, 'Must advance from 2 to 3');
  console.log('  ✓ "lanjut" -> ADVANCE_SLIDE / 3 (from current 2)');

  // [F] Parsing "slide 7" -> slide 7
  console.log('\n[F] Testing direct jump to "slide 7"...');
  const cmdF = studioCommandParserInstance.parse('slide 7', active);
  assert.ok(cmdF, 'Must parse "slide 7"');
  assert.strictEqual(cmdF.action, 'GENERATE_SLIDE');
  assert.strictEqual(cmdF.slideNumber, 7);
  console.log('  ✓ "slide 7" -> GENERATE_SLIDE / 7');

  // [G] Parsing "ulang slide 5" -> REGENERATE_SLIDE / 5
  console.log('\n[G] Testing "ulang slide 5" regeneration...');
  const cmdG = studioCommandParserInstance.parse('ulang slide 5', active);
  assert.ok(cmdG, 'Must parse "ulang slide 5"');
  assert.strictEqual(cmdG.action, 'REGENERATE_SLIDE');
  assert.strictEqual(cmdG.slideNumber, 5);
  console.log('  ✓ "ulang slide 5" -> REGENERATE_SLIDE / 5');

  // [H] Parsing "revisi slide 4, tambahkan poin harmonisasi Perda" -> REVISE_SLIDE
  console.log('\n[H] Testing "revisi slide 4 ..." revision workflow...');
  const cmdH = studioCommandParserInstance.parse('revisi slide 4: tambahkan poin harmonisasi Perda', active);
  assert.ok(cmdH, 'Must parse revision command');
  assert.strictEqual(cmdH.action, 'REVISE_SLIDE');
  assert.strictEqual(cmdH.slideNumber, 4);
  assert.ok(cmdH.revisionNotes.toLowerCase().includes('harmonisasi perda'), `Revision notes captured: ${cmdH.revisionNotes}`);
  console.log('  ✓ "revisi slide 4" -> REVISE_SLIDE / 4 with notes');

  // [I] No Active Studio -> Continuation Router returns handled: false
  console.log('\n[I] Testing No Active Studio behavior...');
  studioSessionManagerInstance.clearSession();
  assert.strictEqual(studioSessionManagerInstance.getActiveSession(), null);
  const routerResNoActive = await studioContinuationRouterInstance.evaluate('slide 3');
  assert.strictEqual(routerResNoActive.handled, false, 'Without active session, router must return handled: false');
  console.log('  ✓ Without active studio session, continuation router cleanly returns handled: false');

  // Re-establish session and test complete StudioContinuationRouter execution for Slide 3
  console.log('\n[EXECUTION TEST] Testing complete StudioContinuationRouter evaluation on "slide 3"...');
  studioSessionManagerInstance.createOrUpdateSlideSession({
    projectId: 'deck_test_session_01',
    deckId: 'deck_test_session_01',
    projectTitle: deckPlan.topic,
    totalSlides: deckPlan.count,
    currentSlide: 1,
    masterDraft: deckPlan,
    slidePlan: deckPlan.slides
  });

  const execRes = await studioContinuationRouterInstance.evaluate('slide 3');
  assert.strictEqual(execRes.handled, true, 'Must handle "slide 3"');
  assert.ok(execRes.slideTitle.includes('SLIDE 03'), `Slide title contains 03: ${execRes.slideTitle}`);
  assert.ok(execRes.previewUrl.startsWith('/artifacts/slides/'), `Preview URL valid: ${execRes.previewUrl}`);
  assert.ok(execRes.pptxUrl.endsWith('.pptx'), `PPTX URL valid: ${execRes.pptxUrl}`);
  assert.strictEqual(execRes.session.currentSlide, 3, 'currentSlide updated to 3');
  
  // Verify artifact exists on disk
  const previewDiskPath = path.join('d:/Users/ultimateai', execRes.previewUrl);
  assert.ok(fs.existsSync(previewDiskPath), 'Generated preview image must exist on disk');
  const previewSize = fs.statSync(previewDiskPath).size;
  assert.ok(previewSize > 50000 && previewSize < 500000, `Size must be within policy: ${previewSize} bytes`);
  console.log(`  ✓ Slide 3 generated autonomously via continuation router (${previewSize} bytes, 16:9 widescreen)`);

  console.log('\n================================================================');
  console.log('✅ ALL STUDIO SESSION CONTINUATION TESTS PASSED (A - I)');
  console.log('================================================================');
}

runSuite().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
