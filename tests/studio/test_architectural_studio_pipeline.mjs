/**
 * tests/studio/test_architectural_studio_pipeline.mjs
 * Comprehensive End-to-End Test Suite for Autonomous Architectural Studio.
 * 
 * Verifies:
 * 1. SiteAnalyzer parsing and zoning metrics on "lahan 20 × 30 meter".
 * 2. DesignProgrammer 5-zone spatial program and floor calculations.
 * 3. MasterDesignDraft generation with Section A-E & explicit assumptions.
 * 4. ArchitecturalRenderer generating 8 distinct, standalone visual artifacts.
 * 5. ArchitecturalConsistencyQA enforcing single artifact rule and zero violations.
 * 6. ArchitecturalRevisionEngine localized revision propagation.
 * 7. SemanticIntentEngine & CapabilityRegistry routing.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

import { SiteAnalyzer } from '../../server/studio/architectural/SiteAnalyzer.mjs';
import { DesignProgrammer } from '../../server/studio/architectural/DesignProgrammer.mjs';
import { MasterDesignDraft } from '../../server/studio/architectural/MasterDesignDraft.mjs';
import { MasterDesignState, COMPONENT_STATUS } from '../../server/studio/architectural/MasterDesignState.mjs';
import { ArchitecturalRenderer } from '../../server/studio/architectural/ArchitecturalRenderer.mjs';
import { ArchitecturalConsistencyQA } from '../../server/studio/architectural/ArchitecturalConsistencyQA.mjs';
import { ArchitecturalRevisionEngine } from '../../server/studio/architectural/ArchitecturalRevisionEngine.mjs';
import { ArchitecturalStudio } from '../../server/studio/architectural/ArchitecturalStudio.mjs';
import { SemanticIntentEngine } from '../../server/agent/SemanticIntentEngine.mjs';
import { capabilityRegistryInstance } from '../../server/grounding/CapabilityRegistry.mjs';

async function runArchitecturalStudioTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING ARCHITECTURAL STUDIO END-TO-END VERIFICATION SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  const testDir = 'd:/Users/ultimateai/artifacts/architecture';

  // ---------------------------------------------------------------------------
  // TEST 1: SiteAnalyzer on "Buatkan desain rumah di lahan 20 × 30 meter."
  // ---------------------------------------------------------------------------
  console.log('👉 [TEST 1] SiteAnalyzer Parameter Extraction & Feasibility');
  const analyzer = new SiteAnalyzer();
  const site = analyzer.analyzeSite('Buatkan desain rumah di lahan 20 × 30 meter.');

  assert.strictEqual(site.dimensions.width, 20, 'Width must be 20m');
  assert.strictEqual(site.dimensions.length, 30, 'Length must be 30m');
  assert.strictEqual(site.dimensions.totalArea, 600, 'Total Area must be 600m²');
  assert.strictEqual(site.setbacks.front, 5.0, 'GSB Depan must be 5.0m for 20m frontage');
  assert.strictEqual(site.setbacks.rear, 3.0, 'Rear setback must be 3.0m');
  assert.strictEqual(site.setbacks.left, 2.5, 'Left setback must be 2.5m');
  assert.strictEqual(site.setbacks.right, 2.5, 'Right setback must be 2.5m');
  assert.strictEqual(site.regulations.kdbPercent, 55, 'Target KDB must be 55%');
  assert.strictEqual(site.regulations.kdhPercent, 45, 'Target KDH must be 45%');
  console.log('   ✅ PASS: Dimensions (20x30m), GSB (5m), KDB (55%), KDH (45%) strictly verified.\n');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 2: DesignProgrammer Spatial Zoning Allocation
  // ---------------------------------------------------------------------------
  console.log('👉 [TEST 2] DesignProgrammer Functional Zoning & Room Inventory');
  const programmer = new DesignProgrammer();
  const program = programmer.generateProgram(site);

  assert.ok(program.zoning.public.length >= 3, 'Public zone must have at least 3 spaces');
  assert.ok(program.zoning.semiPublic.length >= 3, 'Semi-Public zone must have at least 3 spaces');
  assert.ok(program.zoning.private.length >= 4, 'Private zone must have Master suite and kids bedrooms');
  assert.ok(program.zoning.service.length >= 3, 'Service zone must have kitchen, laundry, staff room');
  assert.ok(program.zoning.outdoor.length >= 2, 'Outdoor zone must have landscape & pool');
  assert.ok(program.metrics.totalBuiltArea > 250, 'Total built area must reflect 2-story luxury estate');
  console.log(`   ✅ PASS: 5 functional zones allocated. Total Built Area: ${program.metrics.totalBuiltArea} m².\n`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 3: MasterDesignDraft Generation & Explicit Assumptions
  // ---------------------------------------------------------------------------
  console.log('👉 [TEST 3] MasterDesignDraft Section Structure & Assumptions');
  const stateMgr = new MasterDesignState(testDir);
  const state = stateMgr.createProject('TEST-ARCH-01', site, program);
  const draftGen = new MasterDesignDraft();
  const draftMd = draftGen.generateDraft(site, program, state);

  assert.ok(draftMd.includes('MASTER DESIGN DRAFT'), 'Draft must contain master title');
  assert.ok(draftMd.includes('A. DATA LAHAN'), 'Draft must contain Section A');
  assert.ok(draftMd.includes('B. KONSEP ARSITEKTUR'), 'Draft must contain Section B');
  assert.ok(draftMd.includes('C. PROGRAM RUANG'), 'Draft must contain Section C');
  assert.ok(draftMd.includes('D. ZONASI SPASIAL'), 'Draft must contain Section D');
  assert.ok(draftMd.includes('E. RENCANA PRODUKSI VISUAL'), 'Draft must contain Section E');
  assert.ok(draftMd.includes('ASUMSI DESAIN — DAPAT DIUBAH'), 'Draft must explicitly flag assumptions');
  assert.ok(draftMd.includes('STEP 01') && draftMd.includes('STEP 08'), 'Draft must list the 8 visual steps');
  console.log('   ✅ PASS: Sections A through E generated with explicit assumption flags.\n');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 4: ArchitecturalRenderer Generating 8 Distinct Artifacts (RULE 1)
  // ---------------------------------------------------------------------------
  console.log('👉 [TEST 4] ArchitecturalRenderer 8 Independent Visual Artifacts');
  const renderer = new ArchitecturalRenderer(testDir);

  const a1 = await renderer.renderFloorPlan(state);
  const a2 = await renderer.renderStructuralFrame(state);
  const a3 = await renderer.renderFrontElevation(state);
  const a4 = await renderer.renderLeftElevation(state);
  const a5 = await renderer.renderRightElevation(state);
  const a6 = await renderer.renderRearElevation(state);
  const a7 = await renderer.render3DModel(state);
  const a8 = await renderer.renderHologram(state);

  const artifacts = {
    STEP_01_DENAH: a1,
    STEP_02_STRUKTUR: a2,
    STEP_03_TAMPAK_DEPAN: a3,
    STEP_04_TAMPAK_KIRI: a4,
    STEP_05_TAMPAK_KANAN: a5,
    STEP_06_TAMPAK_BELAKANG: a6,
    STEP_07_MODEL_3D: a7,
    STEP_08_HOLOGRAM_3D: a8
  };

  // Rule 1: One Design Component = One Visual Artifact Check
  const filenames = Object.values(artifacts).map(a => a.filename);
  const uniqueFilenames = new Set(filenames);
  assert.strictEqual(uniqueFilenames.size, 8, 'Must have exactly 8 unique artifact files (No collages!)');

  filenames.forEach(fn => {
    const fullPath = path.join(testDir, fn);
    assert.ok(fs.existsSync(fullPath), `Artifact file ${fn} must exist on disk`);
    const stats = fs.statSync(fullPath);
    assert.ok(stats.size > 1000, `Artifact file ${fn} must be valid drawing (>1KB)`);
  });

  console.log('   ✅ PASS: 8 distinct standalone SVG artifacts produced and verified on disk:\n' +
    filenames.map(f => `      • ${f}`).join('\n') + '\n');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 5: ArchitecturalConsistencyQA Evaluation
  // ---------------------------------------------------------------------------
  console.log('👉 [TEST 5] ArchitecturalConsistencyQA Standards Audit');
  const qa = new ArchitecturalConsistencyQA();
  const report = qa.evaluateProject(state, artifacts);

  assert.strictEqual(report.passed, true, 'QA audit must pass');
  assert.strictEqual(report.score, 100, 'QA audit score must be 100/100');
  assert.strictEqual(report.violations.length, 0, 'QA must find 0 violations');
  assert.ok(report.checks.some(c => c.id === 'SINGLE_ARTIFACT_PER_COMPONENT'), 'Must enforce single artifact rule');
  assert.ok(report.checks.some(c => c.id === 'GSB_COMPLIANCE'), 'Must enforce GSB compliance');
  assert.ok(report.checks.some(c => c.id === 'KDB_COMPLIANCE'), 'Must enforce KDB compliance');
  assert.ok(report.checks.some(c => c.id === 'ZONING_COMPLETENESS'), 'Must enforce zoning completeness');
  console.log(`   ✅ PASS: QA audit passed with score ${report.score}/100 and 0 violations.\n`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 6: ArchitecturalRevisionEngine Localized Revision Propagation
  // ---------------------------------------------------------------------------
  console.log('👉 [TEST 6] ArchitecturalRevisionEngine State & View Impact Propagation');
  const revEngine = new ArchitecturalRevisionEngine();
  const revEval = revEngine.evaluateRevision('Tolong geser kamar utama ke belakang menghadap taman dan pool.', state);

  assert.ok(revEval.affectedComponents.includes('floorPlan'), 'Floor plan must be flagged');
  assert.ok(revEval.affectedComponents.includes('rearElevation'), 'Rear elevation must be flagged');
  assert.ok(revEval.affectedComponents.includes('3dModel'), '3D Model must be flagged');
  assert.ok(revEval.requiresRegeneration, 'Must require re-generation of affected views');

  const updatedState = revEngine.applyRevision(revEval, stateMgr);
  assert.strictEqual(updatedState.floorPlan.status, COMPONENT_STATUS.UPDATE_REQUIRED, 'Floor plan status must be UPDATE_REQUIRED');
  assert.strictEqual(updatedState.elevations.rear.status, COMPONENT_STATUS.UPDATE_REQUIRED, 'Rear elevation status must be UPDATE_REQUIRED');
  console.log('   ✅ PASS: Revision propagated successfully. Affected views flagged UPDATE_REQUIRED.\n');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 7: ArchitecturalStudio Master Facade Integration
  // ---------------------------------------------------------------------------
  console.log('👉 [TEST 7] ArchitecturalStudio Facade Complete Lifecycle');
  const studio = new ArchitecturalStudio({ stateManager: stateMgr, renderer, qa, revisionEngine: revEngine });
  const initResult = studio.initiateDesignProject('Desain villa minimalis modern tropis ukuran 20x30 meter.');

  assert.strictEqual(initResult.status, 'AWAITING_APPROVAL', 'Initial status must await approval');
  assert.ok(initResult.masterDraft.length > 500, 'Master draft must be substantive markdown');

  const appResult = studio.approveProject(initResult.projectId);
  assert.strictEqual(appResult.status, 'APPROVED', 'Status must be APPROVED after approval');
  assert.strictEqual(appResult.currentStep, 'STEP_01_DENAH', 'Must transition to STEP_01_DENAH');

  const step1 = await studio.produceStep('STEP_01_DENAH');
  assert.strictEqual(step1.stepId, 'STEP_01_DENAH');
  assert.strictEqual(step1.nextStep, 'STEP_02_STRUKTUR');

  const allResult = await studio.produceAllSteps();
  assert.strictEqual(allResult.status, 'ALL_STEPS_COMPLETED');
  assert.strictEqual(allResult.stepsCount, 8);
  assert.strictEqual(allResult.qaReport.passed, true);
  console.log('   ✅ PASS: Studio lifecycle (Initiate -> Approve -> Step 1 -> All 8 Steps) verified.\n');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 8: SemanticIntentEngine & CapabilityRegistry Routing
  // ---------------------------------------------------------------------------
  console.log('👉 [TEST 8] SemanticIntentEngine & CapabilityRegistry Intent Binding');
  const sie = new SemanticIntentEngine();

  // Test architectural design classifier
  const classification = sie._architecturalDesignClassifier('Buatkan desain rumah di lahan 20 × 30 meter.');
  assert.ok(classification !== null, 'Must be classified by _architecturalDesignClassifier');
  assert.strictEqual(classification.intent, 'ARCHITECTURAL_DESIGN', 'Intent must be ARCHITECTURAL_DESIGN');
  assert.ok(classification.toolsNeeded.includes('architectural.studio'), 'Must request architectural.studio tool');

  // Verify CapabilityRegistry has registered architectural.studio
  assert.strictEqual(capabilityRegistryInstance.hasCapability('architectural.studio'), true, 'architectural.studio must be registered in CapabilityRegistry');
  assert.strictEqual(capabilityRegistryInstance.hasCapability('slide.studio'), true, 'slide.studio must be registered in CapabilityRegistry');
  console.log('   ✅ PASS: "Buatkan desain rumah di lahan 20 × 30 meter" -> ARCHITECTURAL_DESIGN -> architectural.studio.\n');
  passedTests++;

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('================================================================');
  console.log(`🎉 ALL ${passedTests}/${passedTests} ARCHITECTURAL STUDIO TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================\n');
}

runArchitecturalStudioTests().catch(err => {
  console.error('❌ Architectural Studio Test Suite Failed:', err);
  process.exit(1);
});
