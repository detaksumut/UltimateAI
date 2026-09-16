/**
 * tests/test_slide_studio_routing_invariants.mjs
 * Complete 10-Point Verification Test Suite for Studio Routing Invariants.
 */

import fs from 'fs';
import { unifiedStudioRouterInstance } from '../server/studio/core/UnifiedStudioRouter.mjs';
import { studioContinuationRouterInstance } from '../server/studio/core/StudioContinuationRouter.mjs';
import { studioSessionManagerInstance } from '../server/studio/core/StudioSessionManager.mjs';
import { studioCommandParserInstance } from '../server/studio/core/StudioCommandParser.mjs';
import { slideCommandNormalizerInstance } from '../server/studio/slide/SlideCommandNormalizer.mjs';

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('    TEST MATRIX: SLIDE_STUDIO 10 INVARIANT CONTRACT VERIFICATION       ');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const sessionPath = 'd:/Users/ultimateai/artifacts/studio_session.json';
  const sessionBackup = fs.existsSync(sessionPath) ? fs.readFileSync(sessionPath, 'utf8') : null;

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1: Initial Presentation Creation ("Buatkan draft presentasi ... 10 slide")
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[TEST 1] Initial Presentation Creation:');
  const input1 = 'Buatkan draft presentasi dengan tema "Arsitektur Sistem AI Terdistribusi" utk 10 slide';
  const decision1 = unifiedStudioRouterInstance.route(input1, { requestId: 'req-test-1' });

  assert(decision1.action === 'CREATE_STUDIO', `Router action must be CREATE_STUDIO (got: ${decision1.action})`);
  assert(decision1.route === 'SLIDE_STUDIO', `Router route must be SLIDE_STUDIO (got: ${decision1.route})`);
  assert(decision1.priority === 'P3', `Router priority must be P3 (got: ${decision1.priority})`);
  assert(decision1.parameters?.requestedCount === 10, `Requested count must be 10 (got: ${decision1.parameters?.requestedCount})`);

  const continuationResult1 = await studioContinuationRouterInstance.evaluate(input1, { requestId: 'req-test-1' });
  assert(continuationResult1.handled === false, 'StudioContinuationRouter must NOT handle CREATE_STUDIO directly (must fall through to LLM)');
  assert(continuationResult1.session !== undefined, 'Must return the initialized technical session');

  const activeSession = studioSessionManagerInstance.getActiveSession();
  assert(activeSession !== null, 'Active session must be active in StudioSessionManager');
  assert(studioSessionManagerInstance.activeStudio === 'SLIDE_STUDIO', `activeStudio must be SLIDE_STUDIO (got: ${studioSessionManagerInstance.activeStudio})`);
  assert(activeSession.slidePlan && activeSession.slidePlan.length === 0, `slidePlan must be empty pending AI generation (got: ${activeSession?.slidePlan?.length})`);



  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2: "Slide 1" (Exact canonical slide command)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST 2] "Slide 1" Exact Command:');
  const input2 = 'Slide 1';
  const parsed2 = studioCommandParserInstance.parse(input2, activeSession);
  assert(parsed2.action === 'GENERATE_SLIDE', `Parser action must be GENERATE_SLIDE (got: ${parsed2.action})`);
  assert(parsed2.parameters?.slideNumber === 1, `Target must be 1 (got: ${parsed2.parameters?.slideNumber})`);

  const decision2 = unifiedStudioRouterInstance.route(input2, { activeStudio: activeSession, requestId: 'req-test-2' });
  assert(decision2.action === 'GENERATE_SLIDE', `Router action must be GENERATE_SLIDE (got: ${decision2.action})`);
  assert(decision2.priority === 'P1', `Priority must be P1 (got: ${decision2.priority})`);
  assert(decision2.parameters?.slideNumber === 1, `Target must be 1 (got: ${decision2.parameters?.slideNumber})`);

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3: "buat visual Slide 1 sekarang"
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST 3] "buat visual Slide 1 sekarang":');
  const input3 = 'buat visual Slide 1 sekarang';
  const parsed3 = studioCommandParserInstance.parse(input3, activeSession);
  assert(parsed3.action === 'GENERATE_SLIDE', `Parser action must be GENERATE_SLIDE (got: ${parsed3.action})`);
  assert(parsed3.parameters?.slideNumber === 1, `Target must be 1 (got: ${parsed3.parameters?.slideNumber})`);

  const decision3 = unifiedStudioRouterInstance.route(input3, { activeStudio: activeSession, requestId: 'req-test-3' });
  assert(decision3.action === 'GENERATE_SLIDE', `Router action must be GENERATE_SLIDE (got: ${decision3.action})`);
  assert(decision3.priority === 'P1', `Priority must be P1 (got: ${decision3.priority})`);

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4: "ganti visual Slide 1, gaya enterprise" (Slide revision + style)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST 4] "ganti visual Slide 1, gaya enterprise" (Slide Revision):');
  const input4 = 'ganti visual Slide 1, gaya enterprise';
  const normalized4 = slideCommandNormalizerInstance.normalize(input4, activeSession);
  assert(normalized4.matched === true, 'SlideCommandNormalizer must match');
  assert(normalized4.target === 1, `Target must be 1 (got: ${normalized4.target})`);
  assert(normalized4.operation === 'REVISION', `Operation must be REVISION (got: ${normalized4.operation})`);
  assert(normalized4.style === 'enterprise', `Style must be enterprise (got: ${normalized4.style})`);

  const parsed4 = studioCommandParserInstance.parse(input4, activeSession);
  assert(parsed4.studio === 'SLIDE_STUDIO', `Parser studio must be SLIDE_STUDIO (got: ${parsed4.studio})`);
  assert(parsed4.action === 'REVISE_SLIDE', `Parser action must be REVISE_SLIDE (got: ${parsed4.action})`);
  assert(parsed4.parameters?.slideNumber === 1, `Target must be 1 (got: ${parsed4.parameters?.slideNumber})`);
  assert(parsed4.parameters?.style === 'enterprise', `Style must be enterprise (got: ${parsed4.parameters?.style})`);

  const decision4 = unifiedStudioRouterInstance.route(input4, { activeStudio: activeSession, requestId: 'req-test-4' });
  assert(decision4.route === 'SLIDE_STUDIO', `Router route must be SLIDE_STUDIO (got: ${decision4.route})`);
  assert(decision4.action === 'REVISE_SLIDE', `Router action must be REVISE_SLIDE (got: ${decision4.action})`);
  assert(decision4.bypassImageGeneration === true, 'Must BYPASS generic image generation');

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 5: "Slide 1, style korporat"
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST 5] "Slide 1, style korporat":');
  const input5 = 'Slide 1, style korporat';
  const normalized5 = slideCommandNormalizerInstance.normalize(input5, activeSession);
  assert(normalized5.matched === true, 'SlideCommandNormalizer must match');
  assert(normalized5.target === 1, `Target must be 1 (got: ${normalized5.target})`);
  assert(normalized5.style === 'korporat', `Style must be korporat (got: ${normalized5.style})`);

  const parsed5 = studioCommandParserInstance.parse(input5, activeSession);
  assert(parsed5.studio === 'SLIDE_STUDIO', `Parser studio must be SLIDE_STUDIO (got: ${parsed5.studio})`);
  assert(parsed5.parameters?.slideNumber === 1, `Target must be 1 (got: ${parsed5.parameters?.slideNumber})`);

  const decision5 = unifiedStudioRouterInstance.route(input5, { activeStudio: activeSession, requestId: 'req-test-5' });
  assert(decision5.route === 'SLIDE_STUDIO', `Router route must be SLIDE_STUDIO (got: ${decision5.route})`);
  assert(decision5.priority === 'P1', `Priority must be P1 (got: ${decision5.priority})`);
  assert(decision5.bypassSemanticIntentEngine === true, 'Must BYPASS generic LLM');

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 6: "buat visualnya" (Contextual continuation referencing current slide)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST 6] "buat visualnya" (Contextual Resolution):');
  activeSession.currentSlide = 1; // Explicitly ensure currentSlide = 1
  const input6 = 'buat visualnya';
  const normalized6 = slideCommandNormalizerInstance.normalize(input6, activeSession);
  assert(normalized6.matched === true, 'SlideCommandNormalizer must match contextual reference');
  assert(normalized6.target === 1, `Target must resolve to currentSlide=1 (got: ${normalized6.target})`);
  assert(normalized6.isContextual === true, 'Must be flagged as isContextual=true');

  const parsed6 = studioCommandParserInstance.parse(input6, activeSession);
  assert(parsed6.studio === 'SLIDE_STUDIO', `Parser studio must be SLIDE_STUDIO (got: ${parsed6.studio})`);
  assert(parsed6.parameters?.slideNumber === 1, `Target must be currentSlide=1 (got: ${parsed6.parameters?.slideNumber})`);

  const decision6 = unifiedStudioRouterInstance.route(input6, { activeStudio: activeSession, requestId: 'req-test-6' });
  assert(decision6.route === 'SLIDE_STUDIO', `Router route must be SLIDE_STUDIO (got: ${decision6.route})`);
  assert(decision6.action === 'GENERATE_SLIDE', `Router action must be GENERATE_SLIDE (got: ${decision6.action})`);
  assert(decision6.bypassImageGeneration === true, 'Must NOT trigger generic ImageGeneration "Create a high-quality image of nya."');

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 7: "lanjut slide 2"
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST 7] "lanjut slide 2":');
  const input7 = 'lanjut slide 2';
  const parsed7 = studioCommandParserInstance.parse(input7, activeSession);
  assert(parsed7.action === 'GENERATE_SLIDE', `Parser action must be GENERATE_SLIDE (got: ${parsed7.action})`);
  assert(parsed7.parameters?.slideNumber === 2, `Target slide must be 2 (got: ${parsed7.parameters?.slideNumber})`);

  const decision7 = unifiedStudioRouterInstance.route(input7, { activeStudio: activeSession, requestId: 'req-test-7' });
  assert(decision7.action === 'GENERATE_SLIDE', `Router action must be GENERATE_SLIDE (got: ${decision7.action})`);
  assert(decision7.priority === 'P1', `Priority must be P1 (got: ${decision7.priority})`);
  assert(decision7.parameters?.slideNumber === 2, `Target must be 2 (got: ${decision7.parameters?.slideNumber})`);

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 8: "buat gambar kapal di laut saat sunset" (General image request)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST 8] "buat gambar kapal di laut saat sunset" (Generic Image Isolation):');
  const input8 = 'buat gambar kapal di laut saat sunset';
  const normalized8 = slideCommandNormalizerInstance.normalize(input8, activeSession);
  assert(normalized8.matched === false, `SlideCommandNormalizer must reject unbound image (reason: ${normalized8.reason})`);

  const parsed8 = studioCommandParserInstance.parse(input8, activeSession);
  assert(parsed8.matchType === 'NONE', `Command parser must return NONE (got: ${parsed8.matchType})`);

  const decision8 = unifiedStudioRouterInstance.route(input8, { activeStudio: activeSession, requestId: 'req-test-8' });
  assert(decision8.route === 'IMAGE_GENERATION', `Router must route to IMAGE_GENERATION (got: ${decision8.route})`);
  assert(decision8.action === 'GENERATE_IMAGE', `Action must be GENERATE_IMAGE (got: ${decision8.action})`);
  assert(decision8.priority === 'P4', `Priority must be P4 (got: ${decision8.priority})`);

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 9: "Halo JIN, apa kabar hari ini?" (Casual Chat)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST 9] "Halo JIN, apa kabar hari ini?" (Direct LLM fast path):');
  const input9 = 'Halo JIN, apa kabar hari ini?';
  const parsed9 = studioCommandParserInstance.parse(input9, activeSession);
  assert(parsed9.matchType === 'NONE', `Command parser must return NONE for casual chat (got: ${parsed9.matchType})`);

  const decision9 = unifiedStudioRouterInstance.route(input9, { activeStudio: activeSession, requestId: 'req-test-9' });
  assert(decision9.route === 'GENERIC_AGENT', `Router must route to GENERIC_AGENT (got: ${decision9.route})`);
  assert(decision9.action === 'CHAT_COMPLETION', `Action must be CHAT_COMPLETION (got: ${decision9.action})`);
  assert(decision9.priority === 'P6', `Priority must be P6 (got: ${decision9.priority})`);

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 10: Router Single Invocation Verification (requestId correlation)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST 10] Router Invocation Count & Deduplication Proof:');
  const testReqId = 'req-dedup-audit-' + Date.now();
  let logCallCount = 0;
  const originalLog = console.log;
  console.log = (...args) => {
    const msg = args.join(' ');
    if (msg.includes(testReqId) && msg.includes('[UNIFIED_ROUTER]')) {
      logCallCount++;
    }
    originalLog(...args);
  };

  try {
    const testDecision = unifiedStudioRouterInstance.route('Slide 1', { activeStudio: activeSession, requestId: testReqId });
    assert(testDecision.action === 'GENERATE_SLIDE', 'Decision must be GENERATE_SLIDE');
    assert(logCallCount === 1, `Router must be invoked exactly ONCE per request (call count: ${logCallCount})`);
  } finally {
    console.log = originalLog;
  }
  } finally {
    if (sessionBackup) {
      fs.writeFileSync(sessionPath, sessionBackup, 'utf8');
      console.log('[TEST CLEANUP] Live studio_session.json restored.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('═══════════════════════════════════════════════════════════════════════');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
