/**
 * tests/agent/test_revision_semantic_evaluator.mjs
 * 
 * Formal Regression & Verification Suite for JIN IMAGE_REVISION Gate Architecture
 * 
 * Validates the 5 Crucial Corrections:
 * 1. Evaluator does NOT pass on prompt text alone; it requires actual reference & output buffers.
 * 2. S3 is a HARD GATE: S3 < 0.75 strictly yields TECHNICAL_PASS_SEMANTIC_WEAK even if total score is high.
 * 3. Explicit API contract: evaluateRevision({ referenceBuffer, outputBuffer, requestedModification, subject }).
 * 4. Multi-factor S3: regional atmospheric analysis + color/lighting evidence + vision classifier hook.
 *    Explicit screeningType metadata (DETERMINISTIC_HEURISTIC_SCREENING vs MULTIMODAL_VISION_GROUND_TRUTH).
 * 5. EVALUATION_UNAVAILABLE / TECHNICAL_PASS_SEMANTIC_UNVERIFIED state when visual evaluator cannot execute,
 *    clearly separated from semantic failure.
 * 
 * Contract Under Test:
 * TECHNICAL_PASS = T1..T16 all PASS
 * SEMANTIC_PASS = Score >= 75 AND S1 >= 0.80 AND S2 >= 0.70 AND S3 >= 0.75 AND S4 >= 0.15 AND S5 >= 0.80
 * REVISION_PASS = TECHNICAL_PASS AND SEMANTIC_PASS
 * TECHNICAL_PASS_SEMANTIC_WEAK = TECHNICAL_PASS AND evaluation executed AND semantic threshold failed
 * TECHNICAL_PASS_SEMANTIC_UNVERIFIED = TECHNICAL_PASS AND evaluator could not run
 * REVISION_FAIL = Technical gate failed
 */

import Jimp from 'jimp';
import { RevisionSemanticEvaluator } from '../../server/agent/RevisionSemanticEvaluator.mjs';

const G   = s => `\x1b[32m${s}\x1b[0m`;
const R   = s => `\x1b[31m${s}\x1b[0m`;
const B   = s => `\x1b[36m${s}\x1b[0m`;
const Y   = s => `\x1b[33m${s}\x1b[0m`;
const DIM = s => `\x1b[2m${s}\x1b[0m`;

const results = [];
function pass(label, detail = '') {
  results.push({ label, ok: true });
  console.log(`  ${G('PASS')} ${label}${detail ? ' ' + DIM(`(${detail})`) : ''}`);
}
function fail(label, detail = '') {
  results.push({ label, ok: false, detail });
  console.log(`  ${R('FAIL')} ${label}${detail ? ' ' + DIM(`(${detail})`) : ''}`);
}

async function createTestImage({ width = 128, height = 128, skyColor = { r: 100, g: 150, b: 240 }, groundColor = { r: 50, g: 120, b: 50 } }) {
  const img = new Jimp(width, height);
  const horizon = Math.floor(height * 0.5);

  for (let y = 0; y < height; y++) {
    const isSky = y < horizon;
    const baseColor = isSky ? skyColor : groundColor;
    for (let x = 0; x < width; x++) {
      // Add slight center object (subject)
      const isCenter = x > width * 0.35 && x < width * 0.65 && y > height * 0.35 && y < height * 0.65;
      const r = isCenter ? 200 : baseColor.r;
      const g = isCenter ? 200 : baseColor.g;
      const b = isCenter ? 200 : baseColor.b;
      const hex = Jimp.rgbaToInt(r, g, b, 255);
      img.setPixelColor(hex, x, y);
    }
  }

  return await img.getBufferAsync(Jimp.MIME_JPEG);
}

async function runSuite() {
  console.log(B('═══════════════════════════════════════════════════════════════════════════════'));
  console.log(B(' JIN IMAGE_REVISION TWO-GATE SEMANTIC EVALUATOR TEST SUITE'));
  console.log(B('═══════════════════════════════════════════════════════════════════════════════\n'));

  const validTechnicalReport = {
    intent: 'IMAGE_REVISION',
    referenceArtifactFound: true,
    referenceBufferLength: 50000,
    mode: 'IMAGE_TO_IMAGE',
    provider: 'COMFYUI',
    steps: 4,
    denoise: 0.75,
    promptQueued: true,
    executionStatus: 'success',
    historyCompleted: true,
    outputRetrieved: true,
    outputBufferLength: 48000,
    outputBytes: 48000,
    artifactPersisted: true,
    parentArtifactId: 'img-ref-12345',
    pollinationsCalls: 0,
    llmFallbackCalls: 0
  };

  // ── TEST 1: Gate A (Technical 16/16) Verification ───────────────────────────
  console.log(Y('TEST 1: Technical Gate A (T1..T16) Checklist Verification'));
  {
    const techPass = RevisionSemanticEvaluator.evaluateTechnicalGate(validTechnicalReport);
    if (techPass.passed && Object.keys(techPass.checklist).length === 16) {
      pass('Technical Gate passed 16/16 checklist with denoise=0.75', `T1..T16 all true`);
    } else {
      fail('Technical Gate failed valid report', JSON.stringify(techPass));
    }

    // Violation case: denoise > 0.75 (e.g. 0.85 destroys composition/subject)
    const badDenoiseReport = { ...validTechnicalReport, denoise: 0.85 };
    const techFailDenoise = RevisionSemanticEvaluator.evaluateTechnicalGate(badDenoiseReport);
    if (!techFailDenoise.passed && techFailDenoise.failedItems.includes('T7_denoiseSafe')) {
      pass('Technical Gate caught denoise > 0.75 violation', `failedItems=${techFailDenoise.failedItems.join(',')}`);
    } else {
      fail('Technical Gate did not flag denoise=0.85 violation', JSON.stringify(techFailDenoise));
    }

    // Violation case: steps !== 4
    const badStepsReport = { ...validTechnicalReport, steps: 20 };
    const techFailSteps = RevisionSemanticEvaluator.evaluateTechnicalGate(badStepsReport);
    if (!techFailSteps.passed && techFailSteps.failedItems.includes('T6_stepsStrict4')) {
      pass('Technical Gate caught steps !== 4 violation', `failedItems=${techFailSteps.failedItems.join(',')}`);
    } else {
      fail('Technical Gate did not flag steps=20 violation', JSON.stringify(techFailSteps));
    }
  }

  // ── TEST 2: Correction 1 & 5: Buffer Requirement & EVALUATION_UNAVAILABLE ─────
  console.log(Y('\nTEST 2: Correction 1 & 5: Evaluator rejects prompt-only and handles EVALUATION_UNAVAILABLE'));
  {
    const outcomeMissingBuffers = await RevisionSemanticEvaluator.evaluateRevision({
      referenceBuffer: null,
      outputBuffer: null,
      requestedModification: 'sunset atmosphere',
      technicalReport: validTechnicalReport
    });

    if (
      outcomeMissingBuffers.evaluationStatus === 'TECHNICAL_PASS_SEMANTIC_UNVERIFIED' &&
      outcomeMissingBuffers.technicalPass === true &&
      outcomeMissingBuffers.semanticPass === false &&
      outcomeMissingBuffers.reason.includes('EVALUATION_UNAVAILABLE')
    ) {
      pass('Missing buffers produced TECHNICAL_PASS_SEMANTIC_UNVERIFIED without false pass or semantic failure', outcomeMissingBuffers.reason);
    } else {
      fail('Missing buffers did not return TECHNICAL_PASS_SEMANTIC_UNVERIFIED', JSON.stringify(outcomeMissingBuffers));
    }
  }

  // ── TEST 3: Correction 2: S3 Hard Gate Enforcement ──────────────────────────
  console.log(Y('\nTEST 3: Correction 2: S3 as Hard Gate (S3 < 0.75 strictly yields TECHNICAL_PASS_SEMANTIC_WEAK)'));
  {
    // Generate daytime reference and an identical/near-identical output (insufficient sunset shift -> low S3)
    const daytimeSky = { r: 100, g: 150, b: 240 };
    const ground = { r: 50, g: 120, b: 50 };
    const refBuffer = await createTestImage({ skyColor: daytimeSky, groundColor: ground });
    // Slight tweak, but NOT sunset (blue remains dominant)
    const slightDiffSky = { r: 105, g: 152, b: 235 };
    const weakOutputBuffer = await createTestImage({ skyColor: slightDiffSky, groundColor: ground });

    const outcomeWeak = await RevisionSemanticEvaluator.evaluateRevision({
      referenceBuffer: refBuffer,
      outputBuffer: weakOutputBuffer,
      requestedModification: 'ubah menjadi sunset sore hari',
      subject: 'aircraft',
      technicalReport: validTechnicalReport
    });

    if (
      outcomeWeak.evaluationStatus === 'TECHNICAL_PASS_SEMANTIC_WEAK' &&
      outcomeWeak.technicalPass === true &&
      outcomeWeak.semanticPass === false &&
      outcomeWeak.semantic &&
      outcomeWeak.semantic.passed === false &&
      outcomeWeak.semantic.metrics.S3_modification < 0.75
    ) {
      pass(
        'Insufficient sunset modification caught by S3 Hard Gate',
        `S3=${outcomeWeak.semantic.metrics.S3_modification} status=${outcomeWeak.evaluationStatus}`
      );
    } else {
      fail('Weak modification was not classified as TECHNICAL_PASS_SEMANTIC_WEAK', JSON.stringify(outcomeWeak));
    }
  }

  // ── TEST 4: Correction 4: Multi-factor Sunset Atmosphere (Color + Regional Gradient) ───
  console.log(Y('\nTEST 4: Correction 4: Multi-factor S3 with Regional Atmospheric Sunset Gradient'));
  {
    // Create true sunset output: deep golden/amber horizon (warmth increase + blue reduction)
    const daytimeSky = { r: 90, g: 140, b: 240 };
    const ground = { r: 60, g: 110, b: 50 };
    const refBuffer = await createTestImage({ skyColor: daytimeSky, groundColor: ground });

    // Output with warm horizon glow
    const sunsetSky = { r: 230, g: 120, b: 40 };
    const sunsetOutputBuffer = await createTestImage({ skyColor: sunsetSky, groundColor: ground });

    const outcomePass = await RevisionSemanticEvaluator.evaluateRevision({
      referenceBuffer: refBuffer,
      outputBuffer: sunsetOutputBuffer,
      requestedModification: 'sunset atmosphere golden hour',
      subject: 'aircraft',
      technicalReport: validTechnicalReport
    });

    if (
      outcomePass.evaluationStatus === 'REVISION_PASS' &&
      outcomePass.technicalPass === true &&
      outcomePass.semanticPass === true &&
      outcomePass.semantic.passed === true &&
      outcomePass.semantic.metrics.S3_modification >= 0.75 &&
      outcomePass.semantic.semanticScore >= 75.0 &&
      outcomePass.semantic.screeningType === 'DETERMINISTIC_HEURISTIC_SCREENING'
    ) {
      pass(
        'True sunset image achieved REVISION_PASS with deterministic heuristic screening',
        `Score=${outcomePass.semantic.semanticScore} S1=${outcomePass.semantic.metrics.S1_subject} S2=${outcomePass.semantic.metrics.S2_composition} S3=${outcomePass.semantic.metrics.S3_modification} S4=${outcomePass.semantic.metrics.S4_delta} S5=${outcomePass.semantic.metrics.S5_integrity}`
      );
    } else {
      fail('Sunset modification failed to achieve REVISION_PASS', JSON.stringify(outcomePass));
    }
  }

  // ── TEST 5: Multimodal Vision Classifier Ground Truth Hook ──────────────────
  console.log(Y('\nTEST 5: Multimodal Vision Classifier Ground Truth Injection'));
  {
    const daytimeSky = { r: 90, g: 140, b: 240 };
    const ground = { r: 60, g: 110, b: 50 };
    const refBuffer = await createTestImage({ skyColor: daytimeSky, groundColor: ground });
    const sunsetSky = { r: 220, g: 130, b: 50 };
    const sunsetOutputBuffer = await createTestImage({ skyColor: sunsetSky, groundColor: ground });

    const outcomeWithVision = await RevisionSemanticEvaluator.evaluateRevision({
      referenceBuffer: refBuffer,
      outputBuffer: sunsetOutputBuffer,
      requestedModification: 'sunset',
      subject: 'aircraft',
      technicalReport: validTechnicalReport,
      visionClassifierScore: 0.95
    });

    if (
      outcomeWithVision.evaluationStatus === 'REVISION_PASS' &&
      outcomeWithVision.semantic.screeningType === 'MULTIMODAL_VISION_GROUND_TRUTH' &&
      outcomeWithVision.semantic.metrics.S3_modification >= 0.85
    ) {
      pass(
        'Injected vision ground truth score correctly recognized',
        `screeningType=${outcomeWithVision.semantic.screeningType} S3=${outcomeWithVision.semantic.metrics.S3_modification}`
      );
    } else {
      fail('Vision classifier score not applied correctly', JSON.stringify(outcomeWithVision));
    }
  }

  // ── TEST 6: Technical Gate Failure Overrides Semantic ────────────────────────
  console.log(Y('\nTEST 6: Technical Gate Failure Preempts Semantic Evaluation (REVISION_FAIL)'));
  {
    const failingTechReport = {
      ...validTechnicalReport,
      pollinationsCalls: 1 // Violates T15: zeroPollinations
    };
    const daytimeSky = { r: 90, g: 140, b: 240 };
    const sunsetSky = { r: 230, g: 120, b: 40 };
    const refBuffer = await createTestImage({ skyColor: daytimeSky });
    const outBuffer = await createTestImage({ skyColor: sunsetSky });

    const outcomeTechFail = await RevisionSemanticEvaluator.evaluateRevision({
      referenceBuffer: refBuffer,
      outputBuffer: outBuffer,
      requestedModification: 'sunset',
      technicalReport: failingTechReport
    });

    if (
      outcomeTechFail.evaluationStatus === 'REVISION_FAIL' &&
      outcomeTechFail.technicalPass === false &&
      outcomeTechFail.semanticPass === false &&
      outcomeTechFail.technical.failedItems.includes('T15_zeroPollinations')
    ) {
      pass('Technical violation preempted evaluation and returned REVISION_FAIL', outcomeTechFail.reason);
    } else {
      fail('Technical failure did not yield REVISION_FAIL', JSON.stringify(outcomeTechFail));
    }
  }

  console.log(B('\n═══════════════════════════════════════════════════════════════════════════════'));
  const passedCount = results.filter(r => r.ok).length;
  const failedCount = results.filter(r => !r.ok).length;
  console.log(` Results: ${passedCount > 0 ? G(`${passedCount} passed`) : '0 passed'}, ${failedCount > 0 ? R(`${failedCount} failed`) : '0 failed'}`);
  console.log(B('═══════════════════════════════════════════════════════════════════════════════\n'));

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error(R('FATAL SUITE ERROR:'), err);
  process.exit(1);
});
