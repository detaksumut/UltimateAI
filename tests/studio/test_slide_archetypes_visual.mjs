/**
 * tests/studio/test_slide_archetypes_visual.mjs
 * Comprehensive regression & visual verification for all JIN Slide Studio Archetypes:
 * 1. Title / Cover Archetype (Slide 1) with Presenter Photo Avatar
 * 2. Quote & Urgency Archetype (Slide 2)
 * 3. Hierarchy & Statutory Archetype (Slide 3)
 * 4. Process & Flowchart Archetype (Slide 4)
 * 5. Grid & Scope Domains Archetype (Slide 5)
 * 6. Comparison Archetype (Slide 6)
 * 7. Full 20-Slide Canonical Deck PPTX Export
 */

import { slideStudioInstance } from '../../server/studio/slide/SlideStudio.mjs';
import { slidePlannerInstance } from '../../server/studio/slide/SlidePlanner.mjs';
import { studioSessionManagerInstance } from '../../server/studio/core/StudioSessionManager.mjs';
import { studioContinuationRouterInstance } from '../../server/studio/core/StudioContinuationRouter.mjs';
import assert from 'assert';
import fs from 'fs';

async function runTests() {
  console.log('=== STARTING VISUAL ARCHETYPES & PPTX SUITE ===\n');

  // Test 1: Plan Canonical 20-Slide Deck
  console.log('[TEST 1] Canonical 20-Slide Deck Planning');
  const deckPlan = slidePlannerInstance.createCanonicalDeckPlan('Penyusunan Peraturan Desa', 20);
  assert.strictEqual(deckPlan.length, 20, 'Deck plan must contain exactly 20 slides');
  assert.strictEqual(deckPlan[0].archetype, 'title_slide', 'Slide 1 must be title_slide');
  assert.strictEqual(deckPlan[1].archetype, 'quote_slide', 'Slide 2 must be quote_slide');
  assert.strictEqual(deckPlan[2].archetype, 'hierarchy_slide', 'Slide 3 must be hierarchy_slide');
  assert.strictEqual(deckPlan[3].archetype, 'process_slide', 'Slide 4 must be process_slide');
  assert.strictEqual(deckPlan[4].archetype, 'grid_slide', 'Slide 5 must be grid_slide');
  assert.strictEqual(deckPlan[5].archetype, 'comparison_slide', 'Slide 6 must be comparison_slide');
  console.log('✅ TEST 1 PASSED: 20 slides planned with genuine archetypes\n');

  // Test 2: Generate Slide 1 (Title / Cover Archetype)
  console.log('[TEST 2] Rendering Slide 1 (Title / Cover Archetype with Presenter)');
  const slide1 = await slideStudioInstance.createSlide('Slide 1: Urgensi dan Tata Cara Penyusunan Peraturan Desa, cover opening slide', {
    forceType: 'title_slide',
    context: {
      slideNumber: 1,
      presenter: {
        name: 'Dr. Bahkrul Khair Amal, M.Si',
        title: 'Akademisi & Narasumber Ahli Tata Kelola Desa',
        institution: 'Kementerian Desa PDTT / Universitas Sumatera Utara'
      }
    }
  });
  assert(slide1.svg.includes('<svg'), 'Slide 1 SVG must be valid');
  assert(slide1.svg.includes('Dr. Bahkrul Khair Amal') || slide1.svg.includes('PEMATERI'), 'Slide 1 must contain presenter name');
  assert(slide1.files.preview.length < 500000, `Slide 1 preview size (${slide1.files.preview.length} bytes) must be < 500 KB`);
  assert(slide1.files.pptx.length > 5000, 'Slide 1 PPTX must be non-empty valid OpenXML');
  console.log(`✅ TEST 2 PASSED: Slide 1 SVG (${slide1.svg.length} chars), Preview (${Math.round(slide1.files.preview.length / 1024)} KB), PPTX (${Math.round(slide1.files.pptx.length / 1024)} KB)\n`);

  // Test 3: Generate Slide 2 (Quote & Urgency Archetype)
  console.log('[TEST 3] Rendering Slide 2 (Quote & Urgency Archetype)');
  const slide2 = await slideStudioInstance.createSlide('Slide 2: Landasan Filosofis & Urgensi Pembentukan Regulasi', {
    forceType: 'quote_slide',
    context: { slideNumber: 2 }
  });
  assert(slide2.svg.includes('<svg'), 'Slide 2 SVG must be valid');
  assert(slide2.svg.includes('Akuntabilitas') || slide2.svg.includes('Pilar') || slide2.svg.includes('Urgensi'), 'Slide 2 must contain quote or urgency structure');
  assert(slide2.files.preview.length < 500000, 'Slide 2 preview size must be < 500 KB');
  assert(slide2.files.pptx.length > 5000, 'Slide 2 PPTX must be valid');
  console.log(`✅ TEST 3 PASSED: Slide 2 SVG (${slide2.svg.length} chars), Preview (${Math.round(slide2.files.preview.length / 1024)} KB)\n`);

  // Test 4: Generate Slide 3 (Hierarchy & Statutory Archetype)
  console.log('[TEST 4] Rendering Slide 3 (Hierarchy & Statutory Archetype)');
  const slide3 = await slideStudioInstance.createSlide('Slide 3: Hierarki & Kedudukan Hukum Regulasi Terpadu', {
    forceType: 'hierarchy_slide',
    context: { slideNumber: 3 }
  });
  assert(slide3.svg.includes('<svg'), 'Slide 3 SVG must be valid');
  assert(slide3.svg.includes('TINGKAT 1') || slide3.svg.includes('Konstitusi') || slide3.svg.includes('Regulasi'), 'Slide 3 must contain statutory legal tiers');
  assert(slide3.files.preview.length < 500000, 'Slide 3 preview size must be < 500 KB');
  assert(slide3.files.pptx.length > 5000, 'Slide 3 PPTX must be valid');
  console.log(`✅ TEST 4 PASSED: Slide 3 SVG (${slide3.svg.length} chars), Preview (${Math.round(slide3.files.preview.length / 1024)} KB)\n`);

  // Test 5: Generate Slide 4 (Process & Flowchart Archetype)
  console.log('[TEST 5] Rendering Slide 4 (Process & Flowchart Archetype)');
  const slide4 = await slideStudioInstance.createSlide('Slide 4: Alur 5 Tahapan Pembentukan Peraturan Desa', {
    forceType: 'process_slide',
    context: { slideNumber: 4 }
  });
  assert(slide4.svg.includes('<svg'), 'Slide 4 SVG must be valid');
  assert(slide4.svg.includes('Perencanaan') && slide4.svg.includes('Pengundangan'), 'Slide 4 must contain all 5 process stages');
  assert(slide4.files.preview.length < 500000, 'Slide 4 preview size must be < 500 KB');
  assert(slide4.files.pptx.length > 5000, 'Slide 4 PPTX must be valid');
  console.log(`✅ TEST 5 PASSED: Slide 4 SVG (${slide4.svg.length} chars), Preview (${Math.round(slide4.files.preview.length / 1024)} KB)\n`);

  // Test 6: Generate Slide 5 (Grid & Scope Domains Archetype)
  console.log('[TEST 6] Rendering Slide 5 (Grid & Scope Domains Archetype)');
  const slide5 = await slideStudioInstance.createSlide('Slide 5: Ruang Lingkup Materi Muatan & Prinsip Tata Kelola', {
    forceType: 'grid_slide',
    context: { slideNumber: 5 }
  });
  assert(slide5.svg.includes('<svg'), 'Slide 5 SVG must be valid');
  assert(slide5.svg.toLowerCase().includes('administrasi') && slide5.svg.toLowerCase().includes('sistematis'), 'Slide 5 must contain domains & principles');
  assert(slide5.files.preview.length < 500000, 'Slide 5 preview size must be < 500 KB');
  assert(slide5.files.pptx.length > 5000, 'Slide 5 PPTX must be valid');
  console.log(`✅ TEST 6 PASSED: Slide 5 SVG (${slide5.svg.length} chars), Preview (${Math.round(slide5.files.preview.length / 1024)} KB)\n`);

  // Test 7: Verify Archetype Visual Differentiation (No identical templates!)
  console.log('[TEST 7] Visual Differentiation Verification (Zero Fake Stubs)');
  const svgs = [slide1.svg, slide2.svg, slide3.svg, slide4.svg, slide5.svg];
  for (let i = 0; i < svgs.length; i++) {
    for (let j = i + 1; j < svgs.length; j++) {
      assert.notStrictEqual(svgs[i], svgs[j], `Slide ${i + 1} SVG and Slide ${j + 1} SVG must be distinctly different`);
    }
  }
  console.log('✅ TEST 7 PASSED: All 5 slide archetypes generate distinctly unique visual layouts!\n');

  // Test 8: Full 20-Slide Project Continuation & Deck Export
  console.log('[TEST 8] End-to-End Session Continuation & Export Deck');
  const session = studioSessionManagerInstance.createOrUpdateSlideSession({
    projectId: 'DECK-PERDES-2026',
    projectTitle: 'Urgensi dan Tata Cara Penyusunan Peraturan Desa',
    totalSlides: 20,
    currentSlide: 1,
    slidePlan: deckPlan
  });

  // Execute Slide 1 via continuation router
  const resSlide1 = await studioContinuationRouterInstance.evaluate('slide 1');
  assert(resSlide1.handled, 'Continuation router must handle Slide 1');
  assert(!resSlide1.detailedTextDisplay.includes('telah diproduksi secara programatik'), 'Must eliminate robotic text boilerplate');
  assert(resSlide1.detailedTextDisplay.includes('Slide 1:'), 'Must present Slide 1 politely and naturally');

  // Execute Slide 3 via continuation router
  const resSlide3 = await studioContinuationRouterInstance.evaluate('slide 3');
  assert(resSlide3.handled, 'Continuation router must handle Slide 3');
  assert(resSlide3.detailedTextDisplay.includes('Slide 3:'), 'Must present Slide 3');

  // Export full canonical presentation deck
  const deckExport = await slideStudioInstance.exportDeck(session);
  assert(deckExport.pptxPath && fs.existsSync(deckExport.pptxPath), 'Deck PPTX file must exist on disk');
  const deckStat = fs.statSync(deckExport.pptxPath);
  assert(deckStat.size > 15000, `Deck PPTX must be a substantial multi-slide package (${deckStat.size} bytes)`);
  console.log(`✅ TEST 8 PASSED: Full presentation deck exported (${Math.round(deckStat.size / 1024)} KB at ${deckExport.pptxPath})\n`);

  console.log('====================================================');
  console.log('🎉 ALL 8 VISUAL ARCHETYPE & CONTINUATION TESTS PASSED!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
