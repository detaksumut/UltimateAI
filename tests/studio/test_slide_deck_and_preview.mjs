/**
 * tests/studio/test_slide_deck_and_preview.mjs
 * Verification of Multi-Slide Deck Planning and Raster Preview Text Rendering.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import Jimp from 'jimp';
import { slideStudioInstance } from '../../server/studio/slide/SlideStudio.mjs';
import { slideDeckPlannerInstance } from '../../server/studio/slide/SlideDeckPlanner.mjs';
import { semanticIntentEngineInstance } from '../../server/agent/SemanticIntentEngine.mjs';

console.log('=== TEST SUITE: SLIDE STUDIO PREVIEW & MULTI-SLIDE DECK PIPELINE ===\n');

async function runSuite() {
  // [1] Multi-Slide Deck Intent Detection & 20-Slide Planning
  console.log('[1] Testing Multi-Slide Deck Intent Detection & Planning...');
  const userPrompt = 'JIN buatkan draft PPT dengan Tema "Monev dan Problematika Aparatur Desa" sebanyak 20 slide';
  
  const detection = slideDeckPlannerInstance.detectDeckRequest(userPrompt);
  assert.strictEqual(detection.isDeck, true, 'Must detect as a deck project request');
  assert.strictEqual(detection.count, 20, 'Must extract exactly 20 slides');
  assert.ok(detection.rawTopic.includes('Monev dan Problematika Aparatur Desa'), `Topic correctly extracted: ${detection.rawTopic}`);
  console.log(`  ✓ Detected multi-slide project: ${detection.count} slides, topic: "${detection.rawTopic}"`);

  const deckPlan = slideDeckPlannerInstance.planDeck(detection.rawTopic, detection.count);
  assert.strictEqual(deckPlan.count, 20, 'Deck plan must contain 20 slides');
  assert.strictEqual(deckPlan.aspectRatio, '16:9', 'Aspect ratio must be 16:9');
  
  // Verify diverse archetypes (at least 6 different archetypes)
  const uniqueArchetypes = new Set(deckPlan.slides.map(s => s.archetype));
  assert.ok(uniqueArchetypes.size >= 8, `Deck must have diverse archetypes (found ${uniqueArchetypes.size})`);
  console.log(`  ✓ Diverse archetypes validated (${uniqueArchetypes.size} unique types): ${Array.from(uniqueArchetypes).join(', ')}`);

  const draftMarkdown = slideDeckPlannerInstance.generateMasterDraft(deckPlan);
  assert.ok(draftMarkdown.includes('MASTER DESIGN DRAFT'), 'Draft markdown must have Master title');
  assert.ok(draftMarkdown.includes('Slide 01'), 'Must include Slide 01');
  assert.ok(draftMarkdown.includes('Slide 20'), 'Must include Slide 20');
  assert.ok(draftMarkdown.includes('PENDING APPROVAL'), 'Must indicate pending approval status');
  console.log('  ✓ Master Draft document successfully formatted with executive structure & full 20-slide matrix');

  // [2] SlideStudio Single Slide Creation & Preview Quality Audit
  console.log('\n[2] Testing SlideStudio Raster Preview Image Quality & Font Rendering...');
  const slideRes = await slideStudioInstance.createSlide(
    'Buatkan visual slide presentasi "Kelebihan dan Kekurangan Regulasi Perdes", landscape, corporate enterprise'
  );

  assert.ok(slideRes.success, 'Slide creation must succeed');
  assert.ok(fs.existsSync(slideRes.files.preview.path), 'Preview image file must exist');

  const previewBuf = fs.readFileSync(slideRes.files.preview.path);
  assert.ok(previewBuf.length > 50000, `Preview size must be substantial (>50KB) to ensure text rendering, got ${previewBuf.length} bytes`);
  assert.ok(previewBuf.length < 500000, `Preview size must comply with <500KB policy, got ${previewBuf.length} bytes`);
  console.log(`  ✓ Raster preview file size verified: ${previewBuf.length} bytes (conforms to <500 KB policy)`);

  // [3] Inspect Jimp Image Dimensions & Non-Empty Card Content
  console.log('\n[3] Validating Image Pixels & Aspect Ratio via Jimp...');
  const img = await Jimp.read(previewBuf);
  assert.strictEqual(img.bitmap.width, 1280, 'Preview width must be 1280');
  assert.strictEqual(img.bitmap.height, 720, 'Preview height must be 720');
  assert.strictEqual(img.bitmap.width / img.bitmap.height, 16 / 9, 'Aspect ratio must strictly be 16:9');
  console.log('  ✓ 16:9 widescreen dimensions verified (1280x720)');

  // Sample pixel entropy in column 1 (X: 150-300, Y: 250-400) to confirm rendered text pixels exist (not blank white/grey)
  let nonUniformPixelCount = 0;
  const baseCardColor = img.getPixelColor(100, 250);
  for (let x = 120; x < 400; x += 10) {
    for (let y = 250; y < 450; y += 10) {
      if (img.getPixelColor(x, y) !== baseCardColor) {
        nonUniformPixelCount++;
      }
    }
  }
  assert.ok(nonUniformPixelCount > 30, `Text pixels must exist inside cards (found ${nonUniformPixelCount} variations)`);
  console.log(`  ✓ Text presence confirmed inside slide card body (${nonUniformPixelCount} non-blank pixel samples)`);

  console.log('\n================================================================');
  console.log('✅ ALL MULTI-SLIDE DECK & PREVIEW TESTS PASSED SUCCESSFULLY (4/4)');
  console.log('================================================================');
}

runSuite().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
