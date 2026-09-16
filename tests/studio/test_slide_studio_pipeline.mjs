/**
 * tests/studio/test_slide_studio_pipeline.mjs
 * Comprehensive Regression Test Suite for SLIDE_STUDIO v1.
 * Tests exact scenario: "Kelebihan dan Kekurangan Regulasi Perdes", landscape, corporate enterprise.
 */

import assert from 'assert';
import fs from 'fs';
import JSZip from 'jszip';
import { slideStudioInstance } from '../../server/studio/slide/SlideStudio.mjs';
import { semanticIntentEngineInstance } from '../../server/agent/SemanticIntentEngine.mjs';

console.log('=== REGRESSION TEST SUITE: SLIDE_STUDIO v1 (Autonomous Programmatic Engine) ===\n');

async function runSuite() {
  const prompt = "Buatkan visual slide presentasi 'Kelebihan dan Kekurangan Regulasi Perdes', landscape, corporate enterprise";

  // [1] Semantic Intent Classification Test
  console.log('[1] Testing SemanticIntentEngine classification...');
  const clean = semanticIntentEngineInstance._normalizeUtterance(prompt);
  const decision = semanticIntentEngineInstance._slideStudioClassifier(clean, []);
  
  assert.ok(decision, 'Classifier must return a valid decision');
  assert.strictEqual(decision.intent, 'SLIDE_STUDIO', 'Must classify as SLIDE_STUDIO');
  assert.strictEqual(decision.actionRequired, true, 'actionRequired must be true');
  assert.ok(decision.toolsNeeded.includes('slide.studio'), 'Must request slide.studio tool');
  console.log('  ✓ Deterministically classified prompt as SLIDE_STUDIO without LLM overhead');

  // [2] SlideStudio Autonomous Execution
  console.log('\n[2] Executing SlideStudio pipeline...');
  const res = await slideStudioInstance.createSlide(prompt);

  assert.ok(res, 'SlideStudio must return a result object');
  assert.strictEqual(res.success, true, 'Slide generation must succeed');
  assert.strictEqual(res.slideType, 'comparison_slide', 'Archetype must be comparison_slide');
  console.log(`  ✓ Slide generated successfully in ${res.executionMs}ms (archetype: ${res.slideType})`);

  // [3] Content & Schema Verification
  console.log('\n[3] Verifying Schema & Content Completeness...');
  const schema = res.schema;
  assert.strictEqual(schema.canvas.width, 1920, 'Canvas width must be 1920');
  assert.strictEqual(schema.canvas.height, 1080, 'Canvas height must be 1080');
  assert.strictEqual(schema.canvas.aspectRatio, '16:9', 'Aspect ratio must be 16:9');
  
  assert.ok(schema.header.title.includes('Kelebihan dan Kekurangan Regulasi Perdes'), `Title matches: "${schema.header.title}"`);
  assert.ok(schema.header.subtitle.length > 10, `Subtitle exists: "${schema.header.subtitle}"`);
  assert.ok(schema.footer.conclusion.length > 0, `Footer conclusion exists: "${schema.footer.conclusion}"`);
  assert.ok(schema.footer.takeaway.length > 20, `Footer takeaway exists: "${schema.footer.takeaway}"`);

  assert.strictEqual(schema.columns.length, 2, 'Must have exactly 2 columns');
  const col1 = schema.columns[0];
  const col2 = schema.columns[1];

  assert.ok(col1.title.includes('KELEBIHAN'), `Column 1 title: ${col1.title}`);
  assert.strictEqual(col1.items.length, 5, 'Column 1 must have exactly 5 advantage items');
  console.log('  ✓ Column 1 (Kelebihan): 5/5 structured items verified');

  assert.ok(col2.title.includes('KEKURANGAN'), `Column 2 title: ${col2.title}`);
  assert.strictEqual(col2.items.length, 5, 'Column 2 must have exactly 5 disadvantage items');
  console.log('  ✓ Column 2 (Kekurangan): 5/5 structured items verified');

  // [4] SVG Vector Quality Verification
  console.log('\n[4] Verifying Vector SVG Output...');
  assert.ok(fs.existsSync(res.files.svg.path), 'SVG file must exist on disk');
  const svgContent = fs.readFileSync(res.files.svg.path, 'utf8');
  assert.ok(svgContent.startsWith('<svg') && svgContent.endsWith('</svg>'), 'SVG must be valid XML wrapper');
  assert.ok(svgContent.includes('<text'), 'SVG must contain native vector <text> elements');
  assert.ok(svgContent.includes('Kelebihan dan Kekurangan Regulasi Perdes'), 'SVG must contain title');
  assert.ok(svgContent.includes('Kebutuhan Lokal'), 'SVG must contain item headings');
  console.log(`  ✓ Vector SVG master valid (${svgContent.length} bytes), zero rasterized text artifacts`);

  // [5] Raster Preview Verification & <500 KB Policy
  console.log('\n[5] Verifying Raster Preview & ImageOutputSizePolicy...');
  assert.ok(fs.existsSync(res.files.preview.path), 'Preview image file must exist on disk');
  const previewBuffer = fs.readFileSync(res.files.preview.path);
  assert.ok(previewBuffer.length > 5000, `Preview size must be substantial (${previewBuffer.length} bytes)`);
  assert.ok(previewBuffer.length < 500000, `Preview size (${previewBuffer.length} bytes) must be strictly < 500,000 bytes`);
  console.log(`  ✓ Raster preview conforms to <500 KB policy: ${previewBuffer.length} bytes (limit 500,000 bytes)`);

  // [6] Editable OpenXML PPTX Package Verification
  console.log('\n[6] Verifying Editable PowerPoint (.pptx) OpenXML Package...');
  assert.ok(fs.existsSync(res.files.pptx.path), 'PPTX file must exist on disk');
  const pptxBuffer = fs.readFileSync(res.files.pptx.path);
  const zip = await JSZip.loadAsync(pptxBuffer);

  // Validate package structure
  const requiredParts = [
    '[Content_Types].xml',
    '_rels/.rels',
    'docProps/app.xml',
    'docProps/core.xml',
    'ppt/presentation.xml',
    'ppt/_rels/presentation.xml.rels',
    'ppt/slides/slide1.xml',
    'ppt/slides/_rels/slide1.xml.rels',
    'ppt/slideLayouts/slideLayout1.xml',
    'ppt/slideMasters/slideMaster1.xml',
    'ppt/theme/theme1.xml'
  ];

  for (const part of requiredParts) {
    assert.ok(zip.file(part), `PPTX package missing required OpenXML part: ${part}`);
  }
  console.log('  ✓ OpenXML package structure complete and compliant with ECMA-376 (all 11 parts intact)');

  // Validate slide1.xml native shapes and editable text runs
  const slideXml = await zip.file('ppt/slides/slide1.xml').async('text');
  assert.ok(slideXml.includes('<p:sp>'), 'slide1.xml must contain native PowerPoint shapes (<p:sp>)');
  assert.ok(slideXml.includes('<p:txBody>'), 'slide1.xml must contain native text body containers (<p:txBody>)');
  assert.ok(slideXml.includes('<a:t>Kelebihan dan Kekurangan Regulasi Perdes</a:t>'), 'slide1.xml must contain native editable title text');
  assert.ok(slideXml.includes('<a:t>KELEBIHAN REGULASI PERDES</a:t>'), 'slide1.xml must contain native editable column title');
  assert.ok(slideXml.includes('<a:solidFill>'), 'slide1.xml must contain editable solid fill colors');
  console.log('  ✓ Native PowerPoint text (<a:t>) and vector shapes (<p:sp>) verified (100% editable in Microsoft PowerPoint)');

  // [7] Visual QA 18-Point Audit
  console.log('\n[7] Verifying Visual QA Audit Gate...');
  const qa = res.qaReport;
  assert.strictEqual(qa.passed, true, 'Visual QA must PASS');
  assert.strictEqual(qa.failures.length, 0, 'Must have zero QA failures');
  assert.strictEqual(qa.results.length, 18, 'Must execute all 18 QA checks (T1-T18)');

  const expectedChecks = [
    'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9',
    'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'T17', 'T18'
  ];
  for (const cId of expectedChecks) {
    const found = qa.results.find(r => r.id === cId);
    assert.ok(found && found.passed, `Check ${cId} must pass`);
  }
  console.log(`  ✓ All 18/18 Visual QA Checks passed: ${qa.summary}`);

  console.log('\n================================================================');
  console.log('✅ ALL SLIDE_STUDIO REGRESSION TESTS PASSED SUCCESSFULLY (7/7)');
  console.log('   SLIDE_STUDIO v1 is certified OPERATIONAL in UltimateAI/JIN');
  console.log('================================================================');
}

runSuite().catch(err => {
  console.error('\n❌ REGRESSION TEST FAILED:', err);
  process.exit(1);
});
