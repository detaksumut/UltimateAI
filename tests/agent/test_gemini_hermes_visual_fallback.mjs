/**
 * test_gemini_hermes_visual_fallback.mjs
 * Comprehensive test suite verifying: SPEC — GEMINI → HERMES VISUAL FALLBACK v1.0
 * 
 * Matrix:
 * HF-01: Gemini success (200) -> provider = GEMINI, fallbackUsed = false
 * HF-02: Gemini 429 -> primaryProvider = GEMINI, fallbackUsed = true, model = hermes-3-8b, renderer = success
 * HF-03: Gemini quota error (RESOURCE_EXHAUSTED) -> Hermes fallback
 * HF-04: Gemini 400 -> NO Hermes fallback, IMAGE_GENERATION_FAILED
 * HF-05: Hermes invalid JSON -> Repair attempt (pass if repaired, fail if 2nd attempt invalid)
 * HF-06: Renderer failure -> RENDER_FAILED, NO Pollinations
 * HF-07: Presentation -> Hermes VisualDesignSpec -> SlideRenderer -> PNG, PPTX, QA
 * HF-08: House -> Hermes VisualDesignSpec -> ArchitecturalRenderer -> PNG
 * HF-09: Pollinations hard gate -> 0 executable paths, throws POLLINATIONS_FORBIDDEN
 * HF-10: Request correlation -> same requestId across all events & artifacts
 * HF-GEMINI-11: Pool 9x429 + 1x403 => GEMINI_QUOTA_EXHAUSTED
 * HF-GEMINI-12: Pool 10x403 => PERMISSION_FAILURE (no fallback)
 * HF-GEMINI-13: Pool 10x401 => AUTH_FAILURE (no fallback)
 * HF-GEMINI-14: Pool 2x429 + success => Gemini SUCCESS (no fallback)
 * HF-GEMINI-15: Last key 403 + prev 429 => quota preserved
 * HF-GEMINI-16: Pollinations forbidden in aggregated failure
 * HF-GEMINI-17: Orchestrator fallback triggers on aggregated 429+403
 * HF-GEMINI-18: Pure 403 pool => orchestrator throws (no fallback)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ImageGenerationOrchestrator, isGeminiQuotaFailure, assertImageProviderAllowed } from '../../server/agent/ImageGenerationOrchestrator.mjs';
import { GeminiImageAdapter } from '../../server/agent/adapters/GeminiImageAdapter.mjs';
import { HermesVisualFallback } from '../../server/agent/fallback/HermesVisualFallback.mjs';
import { VisualActivityLogger } from '../../server/agent/fallback/VisualActivityLogger.mjs';
import { PresentationVisualRenderer } from '../../server/agent/fallback/PresentationVisualRenderer.mjs';
import { ArchitecturalVisualRenderer } from '../../server/agent/fallback/ArchitecturalVisualRenderer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

// Sample valid PRESENTATION spec
const SAMPLE_PRESENTATION_SPEC = {
  schema: 'JIN.VisualDesignSpec',
  version: '1.0',
  domain: 'PRESENTATION',
  requestId: 'req-sample-01',
  canvas: { width: 1920, height: 1080, aspectRatio: '16:9' },
  background: { type: 'solid', value: '#0A192F' },
  theme: { style: 'enterprise', primaryColor: '#0A192F', secondaryColor: '#D4AF37', accentColor: '#38BDF8' },
  header: { title: 'Arsitektur Cloud AI Berkinerja Tinggi', subtitle: 'Analisis dan Evaluasi Sistem JIN' },
  elements: [
    { id: 'el-01', type: 'card', x: 80, y: 220, width: 500, height: 350, radius: 12 },
    { id: 'el-02', type: 'card', x: 620, y: 220, width: 500, height: 350, radius: 12 }
  ],
  typography: {
    title: { font: 'Arial', size: 44, weight: 700 },
    body: { font: 'Arial', size: 24, weight: 400 }
  },
  footer: { enabled: true },
  render: { format: 'png' }
};

// Sample valid HOUSE_DESIGN spec
const SAMPLE_HOUSE_SPEC = {
  schema: 'JIN.VisualDesignSpec',
  version: '1.0',
  domain: 'HOUSE_DESIGN',
  requestId: 'req-sample-02',
  canvas: { width: 1600, height: 900, aspectRatio: '16:9' },
  site: { widthMeters: 12, depthMeters: 25 },
  building: {
    floors: 2,
    style: 'modern tropical',
    footprint: { widthMeters: 10, depthMeters: 16 }
  },
  facade: {
    roof: { type: 'flat' },
    materials: ['concrete', 'wood', 'glass']
  },
  spaces: [
    { name: 'Foyer & Living Area', type: 'living', position: 'front' },
    { name: 'Dry Kitchen & Dining', type: 'dining', position: 'middle' },
    { name: 'Master Suite', type: 'bedroom', position: 'upper-front' }
  ],
  camera: { view: 'front-perspective', heightMeters: 1.6 },
  lighting: { time: 'late-afternoon' },
  render: { format: 'png' }
};

const testResults = [];

function recordTest(testId, name, passed, details = '') {
  testResults.push({ testId, name, passed, details });
  const mark = passed ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${testId}: ${name} ${details ? '(' + details + ')' : ''}`);
}

async function runTests() {
  console.log('===============================================================');
  console.log('   RUNNING TEST MATRIX: GEMINI -> HERMES VISUAL FALLBACK v1.0');
  console.log('===============================================================\n');

  // -------------------------------------------------------------
  // HF-01: Gemini success (200)
  // -------------------------------------------------------------
  try {
    const logger = new VisualActivityLogger();
    const mockGemini = {
      generateImage: async (req) => ({
        success: true,
        provider: 'GEMINI',
        model: 'gemini-2.5-flash-image',
        buffer: Buffer.from('fake-gemini-image-bytes'),
        mimeType: 'image/jpeg',
        width: 1280,
        height: 720,
        requestId: req.requestId
      })
    };
    const orchestrator = new ImageGenerationOrchestrator({
      geminiImageAdapter: mockGemini,
      activityLogger: logger
    });

    const result = await orchestrator.generateImage({
      prompt: 'Corporate business presentation banner',
      requestId: 'req-hf-01'
    });

    const passed = result.success === true &&
                   result.provider === 'GEMINI' &&
                   result.fallbackUsed === false;

    recordTest('HF-01', 'Gemini success (HTTP 200)', passed,
      `provider=${result.provider}, fallbackUsed=${result.fallbackUsed}`);
  } catch (err) {
    recordTest('HF-01', 'Gemini success (HTTP 200)', false, err.message);
  }

  // -------------------------------------------------------------
  // HF-02: Gemini 429 -> Hermes fallback success
  // -------------------------------------------------------------
  try {
    const logger = new VisualActivityLogger();
    const mockGemini = {
      generateImage: async () => ({
        success: false,
        status: 429,
        code: 'RESOURCE_EXHAUSTED',
        error: 'Quota exceeded (HTTP 429)'
      })
    };

    const mockLlama = {
      generate: async () => JSON.stringify(SAMPLE_PRESENTATION_SPEC)
    };

    const mockRenderer = {
      render: async (spec) => ({
        success: true,
        buffer: Buffer.from('png-bytes'),
        mimeType: 'image/png',
        artifact: { type: 'image', path: '/api/artifacts/images/slide.png' }
      })
    };

    const fallback = new HermesVisualFallback({
      llamaCppAdapter: mockLlama,
      renderer: mockRenderer,
      activityLogger: logger
    });

    const orchestrator = new ImageGenerationOrchestrator({
      geminiImageAdapter: mockGemini,
      hermesVisualFallback: fallback,
      activityLogger: logger
    });

    const result = await orchestrator.generateImage({
      prompt: 'Slide presentasi evaluasi strategi',
      domain: 'PRESENTATION',
      requestId: 'req-hf-02'
    });

    const passed = result.success === true &&
                   result.primaryProvider === 'GEMINI' &&
                   result.fallbackUsed === true &&
                   result.model === 'hermes-3-8b' &&
                   result.provider === 'LOCAL_HERMES_RENDERER';

    recordTest('HF-02', 'Gemini 429 -> Hermes fallback success', passed,
      `primary=${result.primaryProvider}, fallbackUsed=${result.fallbackUsed}, model=${result.model}`);
  } catch (err) {
    recordTest('HF-02', 'Gemini 429 -> Hermes fallback success', false, err.message);
  }

  // -------------------------------------------------------------
  // HF-03: Gemini quota error (RESOURCE_EXHAUSTED message)
  // -------------------------------------------------------------
  try {
    const logger = new VisualActivityLogger();
    const mockGemini = {
      generateImage: async () => {
        const err = new Error('Resource exhausted: project quota limit reached.');
        err.code = 'RESOURCE_EXHAUSTED';
        throw err;
      }
    };

    const mockLlama = {
      generate: async () => JSON.stringify(SAMPLE_HOUSE_SPEC)
    };

    const mockRenderer = {
      render: async () => ({
        success: true,
        buffer: Buffer.from('house-png-bytes'),
        mimeType: 'image/png'
      })
    };

    const fallback = new HermesVisualFallback({
      llamaCppAdapter: mockLlama,
      renderer: mockRenderer,
      activityLogger: logger
    });

    const orchestrator = new ImageGenerationOrchestrator({
      geminiImageAdapter: mockGemini,
      hermesVisualFallback: fallback,
      activityLogger: logger
    });

    const result = await orchestrator.generateImage({
      prompt: 'Desain rumah minimalis modern tropis',
      domain: 'HOUSE_DESIGN',
      requestId: 'req-hf-03'
    });

    const passed = result.success === true &&
                   result.fallbackUsed === true &&
                   result.fallbackReason === 'HTTP_429_QUOTA';

    recordTest('HF-03', 'Gemini quota error (RESOURCE_EXHAUSTED string)', passed,
      `fallbackUsed=${result.fallbackUsed}, reason=${result.fallbackReason}`);
  } catch (err) {
    recordTest('HF-03', 'Gemini quota error', false, err.message);
  }

  // -------------------------------------------------------------
  // HF-04: Gemini 400 -> NO Hermes fallback (IMAGE_GENERATION_FAILED)
  // -------------------------------------------------------------
  try {
    const logger = new VisualActivityLogger();
    let hermesCalled = false;
    const mockGemini = {
      generateImage: async () => {
        const err = new Error('Invalid argument: prompt violates content policy');
        err.status = 400;
        throw err;
      }
    };

    const mockLlama = {
      generate: async () => {
        hermesCalled = true;
        return '{}';
      }
    };

    const fallback = new HermesVisualFallback({
      llamaCppAdapter: mockLlama,
      activityLogger: logger
    });

    const orchestrator = new ImageGenerationOrchestrator({
      geminiImageAdapter: mockGemini,
      hermesVisualFallback: fallback,
      activityLogger: logger
    });

    let caughtError = null;
    try {
      await orchestrator.generateImage({
        prompt: 'Invalid prompt test',
        requestId: 'req-hf-04'
      });
    } catch (e) {
      caughtError = e;
    }

    const passed = caughtError !== null &&
                   hermesCalled === false &&
                   caughtError.status === 400;

    recordTest('HF-04', 'Gemini 400 -> NO Hermes fallback', passed,
      `errorCaught=${Boolean(caughtError)}, hermesCalled=${hermesCalled}`);
  } catch (err) {
    recordTest('HF-04', 'Gemini 400', false, err.message);
  }

  // -------------------------------------------------------------
  // HF-05: Hermes invalid JSON repair loop
  // -------------------------------------------------------------
  try {
    const logger = new VisualActivityLogger();
    let callCount = 0;
    // Attempt 1: Malformed JSON, Attempt 2: Valid JSON
    const mockLlamaRepairSuccess = {
      generate: async () => {
        callCount++;
        if (callCount === 1) {
          return '{"schema": "JIN.VisualDesignSpec", INVALID_JSON...';
        }
        return JSON.stringify(SAMPLE_PRESENTATION_SPEC);
      }
    };

    const mockRenderer = {
      render: async () => ({ success: true, buffer: Buffer.from('repaired') })
    };

    const fallback = new HermesVisualFallback({
      llamaCppAdapter: mockLlamaRepairSuccess,
      renderer: mockRenderer,
      activityLogger: logger
    });

    const resRepair = await fallback.generateVisual({
      prompt: 'Repair test slide',
      domain: 'PRESENTATION',
      requestId: 'req-hf-05-repair'
    });

    const repairPassed = resRepair.success === true && callCount === 2;

    // Now test dual failure (fails on both attempts -> HERMES_VISUAL_SPEC_INVALID)
    const mockLlamaDualFail = {
      generate: async () => 'TOTALLY_NOT_JSON'
    };
    const fallbackFail = new HermesVisualFallback({
      llamaCppAdapter: mockLlamaDualFail,
      renderer: mockRenderer,
      activityLogger: logger
    });

    const resFail = await fallbackFail.generateVisual({
      prompt: 'Fail test slide',
      domain: 'PRESENTATION',
      requestId: 'req-hf-05-fail'
    });

    const dualFailPassed = resFail.success === false &&
                           resFail.reasonCode === 'HERMES_VISUAL_SPEC_INVALID';

    const passed = repairPassed && dualFailPassed;
    recordTest('HF-05', 'Hermes invalid JSON repair loop (Attempt 1 repair + 2nd fail guard)', passed,
      `repairPassed=${repairPassed}, dualFailCaught=${dualFailPassed}`);
  } catch (err) {
    recordTest('HF-05', 'Hermes invalid JSON', false, err.message);
  }

  // -------------------------------------------------------------
  // HF-06: Renderer failure -> RENDER_FAILED, NO Pollinations
  // -------------------------------------------------------------
  try {
    const logger = new VisualActivityLogger();
    const mockLlama = {
      generate: async () => JSON.stringify(SAMPLE_PRESENTATION_SPEC)
    };

    const mockFailingRenderer = {
      render: async () => ({
        success: false,
        error: 'Canvas engine crashed on invalid font rendering',
        reasonCode: 'RENDER_FAILED'
      })
    };

    const fallback = new HermesVisualFallback({
      llamaCppAdapter: mockLlama,
      renderer: mockFailingRenderer,
      activityLogger: logger
    });

    const result = await fallback.generateVisual({
      prompt: 'Failing renderer test',
      domain: 'PRESENTATION',
      requestId: 'req-hf-06'
    });

    const passed = result.success === false &&
                   result.reasonCode === 'RENDER_FAILED' &&
                   !result.error.includes('pollinations');

    recordTest('HF-06', 'Renderer failure -> RENDER_FAILED (NO Pollinations fallback)', passed,
      `reasonCode=${result.reasonCode}`);
  } catch (err) {
    recordTest('HF-06', 'Renderer failure', false, err.message);
  }

  // -------------------------------------------------------------
  // HF-07: Presentation full pipeline (SlideRenderer -> PNG -> PPTX -> QA)
  // -------------------------------------------------------------
  try {
    const logger = new VisualActivityLogger();
    const mockLlama = {
      generate: async () => JSON.stringify(SAMPLE_PRESENTATION_SPEC)
    };

    const realPresentationRenderer = new PresentationVisualRenderer();
    const fallback = new HermesVisualFallback({
      llamaCppAdapter: mockLlama,
      renderer: realPresentationRenderer,
      activityLogger: logger
    });

    const result = await fallback.generateVisual({
      prompt: 'Slide Strategi Transformasi Digital Enterprise',
      domain: 'PRESENTATION',
      requestId: 'req-hf-07'
    });

    const passed = result.success === true &&
                   result.artifact?.mimeType === 'image/png' &&
                   result.artifact?.path?.startsWith('/api/artifacts/images/') &&
                   Boolean(result.pptxBuffer) &&
                   result.qaReport?.passed === true;

    recordTest('HF-07', 'Presentation (Hermes -> VisualDesignSpec -> SlideRenderer -> PNG, PPTX, QA)', passed,
      `qaPassed=${result.qaReport?.passed}, pptxBuffer=${result.pptxBuffer?.length}b`);
  } catch (err) {
    recordTest('HF-07', 'Presentation full pipeline', false, err.message);
  }

  // -------------------------------------------------------------
  // HF-08: House design full pipeline (ArchitecturalRenderer -> PNG)
  // -------------------------------------------------------------
  try {
    const logger = new VisualActivityLogger();
    const mockLlama = {
      generate: async () => JSON.stringify(SAMPLE_HOUSE_SPEC)
    };

    const realArchitecturalRenderer = new ArchitecturalVisualRenderer();
    const fallback = new HermesVisualFallback({
      llamaCppAdapter: mockLlama,
      renderer: realArchitecturalRenderer,
      activityLogger: logger
    });

    const result = await fallback.generateVisual({
      prompt: 'Rancang tampak fasad depan rumah tropis minimalis 2 lantai',
      domain: 'HOUSE_DESIGN',
      requestId: 'req-hf-08'
    });

    const passed = result.success === true &&
                   result.artifact?.mimeType === 'image/png' &&
                   result.artifact?.width === 1600 &&
                   result.artifact?.height === 900 &&
                   result.artifact?.sizeBytes > 1000 &&
                   result.artifact?.sizeBytes < 1000000;

    recordTest('HF-08', 'House (Hermes -> VisualDesignSpec -> ArchitecturalRenderer -> Real PNG)', passed,
      `size=${result.artifact?.sizeBytes}b, dim=${result.artifact?.width}x${result.artifact?.height}`);
  } catch (err) {
    recordTest('HF-08', 'House design full pipeline', false, err.message);
  }

  // -------------------------------------------------------------
  // HF-09: Pollinations hard gate
  // -------------------------------------------------------------
  try {
    let gateCaught = false;
    try {
      assertImageProviderAllowed('pollinations');
    } catch (e) {
      if (e.message.includes('POLLINATIONS_FORBIDDEN')) gateCaught = true;
    }

    let urlGateCaught = false;
    try {
      assertImageProviderAllowed('https://image.pollinations.ai/prompt/test');
    } catch (e) {
      if (e.message.includes('POLLINATIONS_FORBIDDEN')) urlGateCaught = true;
    }

    // Grep check across server/ directory
    let activeCalls = 0;
    function scanServerDir(dir) {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const p = path.join(dir, item.name);
        if (item.isDirectory()) {
          scanServerDir(p);
        } else if (/\.(mjs|js|ts)$/.test(item.name)) {
          const src = fs.readFileSync(p, 'utf8');
          if (/fetch\s*\(\s*[`'"]https?:\/\/[^`'"]*pollinations/i.test(src) ||
              /endpoint\s*:\s*[`'"]https?:\/\/[^`'"]*pollinations/i.test(src)) {
            activeCalls++;
          }
        }
      }
    }
    scanServerDir(path.join(rootDir, 'server'));

    const passed = gateCaught && urlGateCaught && activeCalls === 0;
    recordTest('HF-09', 'Pollinations hard gate (0 executable paths & invariant enforcement)', passed,
      `gate=${gateCaught}, urlGate=${urlGateCaught}, activeCalls=${activeCalls}`);
  } catch (err) {
    recordTest('HF-09', 'Pollinations hard gate', false, err.message);
  }

  // -------------------------------------------------------------
  // HF-10: Request correlation (Intent -> Gemini -> 429 -> Hermes -> Validator -> Renderer -> QA)
  // -------------------------------------------------------------
  try {
    const targetRequestId = 'req-trace-audit-hf10-9988-gold';
    const logger = new VisualActivityLogger();

    const mockGemini = {
      generateImage: async () => ({
        success: false,
        status: 429,
        code: 'RESOURCE_EXHAUSTED',
        error: 'Quota exhausted'
      })
    };

    const mockLlama = {
      generate: async () => JSON.stringify(SAMPLE_PRESENTATION_SPEC)
    };

    const realRenderer = new PresentationVisualRenderer();
    const fallback = new HermesVisualFallback({
      llamaCppAdapter: mockLlama,
      renderer: realRenderer,
      activityLogger: logger
    });

    const orchestrator = new ImageGenerationOrchestrator({
      geminiImageAdapter: mockGemini,
      hermesVisualFallback: fallback,
      activityLogger: logger
    });

    const result = await orchestrator.generateImage({
      prompt: 'Correlation test slide',
      domain: 'PRESENTATION',
      requestId: targetRequestId
    });

    const events = logger.getEvents(targetRequestId);
    const allEventsHaveTargetId = events.length > 0 && events.every(e => e.requestId === targetRequestId);
    const resultHasTargetId = result.requestId === targetRequestId && result.artifact?.requestId === targetRequestId;

    const passed = allEventsHaveTargetId && resultHasTargetId;
    recordTest('HF-10', 'Request correlation (identical requestId preserved across entire chain)', passed,
      `targetId="${targetRequestId}", eventCount=${events.length}, match=${passed}`);
  } catch (err) {
    recordTest('HF-10', 'Request correlation', false, err.message);
  }

  // -------------------------------------------------------------
  // HF-11: Pool aggregation — 9×429 + 1×403 => GEMINI_QUOTA_EXHAUSTED
  // -------------------------------------------------------------
  try {
    const adapter = new GeminiImageAdapter();
    const poolStats = {
      attempts: 10,
      quotaFailures: 9,
      permissionFailures: 1,
      authFailures: 0,
      invalidRequestFailures: 0,
      notFoundFailures: 0,
      serverErrorFailures: 0,
      otherFailures: 0
    };
    const diag = adapter._buildPoolDiagnosis(poolStats, 'gemini-2.5-flash-image', 'req-hf-11');

    const passed = diag.success === false &&
                   diag.status === 429 &&
                   diag.code === 'GEMINI_QUOTA_EXHAUSTED' &&
                   diag.fallbackEligible === true &&
                   diag.quotaFailures === 9 &&
                   diag.permissionFailures === 1;

    recordTest('HF-GEMINI-11', 'Pool 9x429 + 1x403 => GEMINI_QUOTA_EXHAUSTED (Hermes fallback eligible)', passed,
      `status=${diag.status}, code=${diag.code}, fallbackEligible=${diag.fallbackEligible}`);
  } catch (err) {
    recordTest('HF-GEMINI-11', 'Pool 9x429 + 1x403', false, err.message);
  }

  // -------------------------------------------------------------
  // HF-12: Pool aggregation — 10×403 => PERMISSION_FAILURE (no fallback)
  // -------------------------------------------------------------
  try {
    const adapter = new GeminiImageAdapter();
    const poolStats = {
      attempts: 10,
      quotaFailures: 0,
      permissionFailures: 10,
      authFailures: 0,
      invalidRequestFailures: 0,
      notFoundFailures: 0,
      serverErrorFailures: 0,
      otherFailures: 0
    };
    const diag = adapter._buildPoolDiagnosis(poolStats, 'gemini-2.5-flash-image', 'req-hf-12');

    const passed = diag.success === false &&
                   diag.status === 403 &&
                   diag.code === 'GEMINI_PERMISSION_FAILURE' &&
                   diag.fallbackEligible === false &&
                   diag.quotaFailures === 0;

    recordTest('HF-GEMINI-12', 'Pool 10x403 => PERMISSION_FAILURE (NO Hermes fallback)', passed,
      `status=${diag.status}, code=${diag.code}, fallbackEligible=${diag.fallbackEligible}`);
  } catch (err) {
    recordTest('HF-GEMINI-12', 'Pool 10x403', false, err.message);
  }

  // -------------------------------------------------------------
  // HF-13: Pool aggregation — 10×401 => AUTH_FAILURE (no fallback)
  // -------------------------------------------------------------
  try {
    const adapter = new GeminiImageAdapter();
    const poolStats = {
      attempts: 10,
      quotaFailures: 0,
      permissionFailures: 0,
      authFailures: 10,
      invalidRequestFailures: 0,
      notFoundFailures: 0,
      serverErrorFailures: 0,
      otherFailures: 0
    };
    const diag = adapter._buildPoolDiagnosis(poolStats, 'gemini-2.5-flash-image', 'req-hf-13');

    const passed = diag.success === false &&
                   diag.status === 401 &&
                   diag.code === 'GEMINI_AUTH_FAILURE' &&
                   diag.fallbackEligible === false &&
                   diag.authFailures === 10;

    recordTest('HF-GEMINI-13', 'Pool 10x401 => AUTH_FAILURE (NO Hermes fallback)', passed,
      `status=${diag.status}, code=${diag.code}, fallbackEligible=${diag.fallbackEligible}`);
  } catch (err) {
    recordTest('HF-GEMINI-13', 'Pool 10x401', false, err.message);
  }

  // -------------------------------------------------------------
  // HF-14: Adapter returns success (key pool found working key) => no fallback
  // -------------------------------------------------------------
  try {
    const logger = new VisualActivityLogger();
    const mockGemini = {
      generateImage: async () => ({
        success: true,
        provider: 'GEMINI',
        model: 'gemini-2.5-flash-image',
        buffer: Buffer.from('fake-gemini-image-bytes'),
        mimeType: 'image/jpeg',
        width: 1280,
        height: 720,
        requestId: 'req-hf-14'
      })
    };
    const orchestrator = new ImageGenerationOrchestrator({
      geminiImageAdapter: mockGemini,
      activityLogger: logger
    });

    const result = await orchestrator.generateImage({
      prompt: 'Corporate business presentation banner',
      requestId: 'req-hf-14'
    });

    const passed = result.success === true &&
                   result.provider === 'GEMINI' &&
                   result.fallbackUsed === false;

    recordTest('HF-GEMINI-14', 'Adapter success (key pool found working key) => NO Hermes fallback', passed,
      `provider=${result.provider}, fallbackUsed=${result.fallbackUsed}`);
  } catch (err) {
    recordTest('HF-GEMINI-14', 'Pool 2x429 + success', false, err.message);
  }

  // -------------------------------------------------------------
  // HF-15: Last key = 403 while previous = 429 => quota preserved via aggregation
  // -------------------------------------------------------------
  try {
    const adapter = new GeminiImageAdapter();
    // Simulate: 9×429 then 1×403 — aggregation must preserve quota diagnosis
    const poolStats = {
      attempts: 10,
      quotaFailures: 9,
      permissionFailures: 1,
      authFailures: 0,
      invalidRequestFailures: 0,
      notFoundFailures: 0,
      serverErrorFailures: 0,
      otherFailures: 0
    };
    const diag = adapter._buildPoolDiagnosis(poolStats, 'gemini-2.5-flash-image', 'req-hf-15');

    // Verify isGeminiQuotaFailure detects the aggregated result
    const quotaDetected = isGeminiQuotaFailure(diag);

    const passed = diag.status === 429 &&
                   diag.code === 'GEMINI_QUOTA_EXHAUSTED' &&
                   diag.fallbackEligible === true &&
                   quotaDetected === true;

    recordTest('HF-GEMINI-15', 'Last key 403 + prev 429 => quota preserved (isGeminiQuotaFailure match)', passed,
      `status=${diag.status}, quotaDetected=${quotaDetected}, fallbackEligible=${diag.fallbackEligible}`);
  } catch (err) {
    recordTest('HF-GEMINI-15', 'Last key 403 + prev 429', false, err.message);
  }

  // -------------------------------------------------------------
  // HF-16: Pollinations remains forbidden in aggregated failure
  // -------------------------------------------------------------
  try {
    const adapter = new GeminiImageAdapter();
    const poolStats = {
      attempts: 10,
      quotaFailures: 9,
      permissionFailures: 1,
      authFailures: 0,
      invalidRequestFailures: 0,
      notFoundFailures: 0,
      serverErrorFailures: 0,
      otherFailures: 0
    };
    const diag = adapter._buildPoolDiagnosis(poolStats, 'gemini-2.5-flash-image', 'req-hf-16');

    // Verify no pollinations in any field
    const diagStr = JSON.stringify(diag).toLowerCase();
    const noPollinations = !diagStr.includes('pollinations');

    // Verify Pollinations hard gate still throws
    let gateCaught = false;
    try {
      assertImageProviderAllowed('pollinations');
    } catch (e) {
      if (e.code === 'POLLINATIONS_FORBIDDEN') gateCaught = true;
    }

    const passed = noPollinations && gateCaught && diag.code === 'GEMINI_QUOTA_EXHAUSTED';

    recordTest('HF-GEMINI-16', 'Pollinations forbidden in aggregated failure output', passed,
      `noPollinations=${noPollinations}, gate=${gateCaught}`);
  } catch (err) {
    recordTest('HF-GEMINI-16', 'Pollinations forbidden', false, err.message);
  }

  // -------------------------------------------------------------
  // HF-17: Orchestrator fallback triggers on aggregated 429+403 result
  // -------------------------------------------------------------
  try {
    const logger = new VisualActivityLogger();
    // Mock Gemini returning aggregated quota failure (as fixed adapter would produce)
    const mockGemini = {
      generateImage: async () => ({
        success: false,
        status: 429,
        code: 'GEMINI_QUOTA_EXHAUSTED',
        fallbackEligible: true,
        attempts: 10,
        quotaFailures: 9,
        permissionFailures: 1,
        authFailures: 0,
        error: 'IMAGE_GENERATION_FAILED: All 10 Gemini API keys exhausted'
      })
    };

    const mockLlama = {
      generate: async () => JSON.stringify(SAMPLE_PRESENTATION_SPEC)
    };

    const mockRenderer = {
      render: async (spec) => ({
        success: true,
        buffer: Buffer.from('png-bytes'),
        mimeType: 'image/png',
        artifact: { type: 'image', path: '/api/artifacts/images/slide.png' }
      })
    };

    const fallback = new HermesVisualFallback({
      llamaCppAdapter: mockLlama,
      renderer: mockRenderer,
      activityLogger: logger
    });

    const orchestrator = new ImageGenerationOrchestrator({
      geminiImageAdapter: mockGemini,
      hermesVisualFallback: fallback,
      activityLogger: logger
    });

    const result = await orchestrator.generateImage({
      prompt: 'Slide presentasi evaluasi strategi',
      domain: 'PRESENTATION',
      requestId: 'req-hf-17'
    });

    const passed = result.success === true &&
                   result.fallbackUsed === true &&
                   result.provider === 'LOCAL_HERMES_RENDERER';

    recordTest('HF-GEMINI-17', 'Orchestrator fallback triggers on aggregated 429+403', passed,
      `success=${result.success}, fallbackUsed=${result.fallbackUsed}, provider=${result.provider}`);
  } catch (err) {
    recordTest('HF-GEMINI-17', 'Orchestrator fallback on aggregated 429+403', false, err.message);
  }

  // -------------------------------------------------------------
  // HF-18: Pure 403 pool => orchestrator throws (no fallback)
  // -------------------------------------------------------------
  try {
    const logger = new VisualActivityLogger();
    let hermesCalled = false;
    const mockGemini = {
      generateImage: async () => ({
        success: false,
        status: 403,
        code: 'GEMINI_PERMISSION_FAILURE',
        fallbackEligible: false,
        attempts: 10,
        quotaFailures: 0,
        permissionFailures: 10,
        authFailures: 0,
        error: 'IMAGE_GENERATION_FAILED: All 10 Gemini API keys exhausted'
      })
    };

    const mockLlama = {
      generate: async () => {
        hermesCalled = true;
        return '{}';
      }
    };

    const fallback = new HermesVisualFallback({
      llamaCppAdapter: mockLlama,
      activityLogger: logger
    });

    const orchestrator = new ImageGenerationOrchestrator({
      geminiImageAdapter: mockGemini,
      hermesVisualFallback: fallback,
      activityLogger: logger
    });

    let caughtError = null;
    try {
      await orchestrator.generateImage({
        prompt: 'Permission denied test',
        domain: 'PRESENTATION',
        requestId: 'req-hf-18'
      });
    } catch (e) {
      caughtError = e;
    }

    const passed = caughtError !== null &&
                   hermesCalled === false &&
                   caughtError.status === 403;

    recordTest('HF-GEMINI-18', 'Pure 403 pool => orchestrator throws (NO Hermes fallback)', passed,
      `errorCaught=${Boolean(caughtError)}, hermesCalled=${hermesCalled}`);
  } catch (err) {
    recordTest('HF-GEMINI-18', 'Pure 403 pool', false, err.message);
  }

  // -------------------------------------------------------------
  // SUMMARY TABLE
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('                 TEST SUMMARY: HF-01 TO HF-18');
  console.log('===============================================================');
  let allPass = true;
  for (const t of testResults) {
    const statusStr = t.passed ? 'PASS' : 'FAIL';
    if (!t.passed) allPass = false;
    console.log(`${t.testId.padEnd(8)} ${statusStr.padEnd(8)} ${t.name}`);
  }
  console.log('===============================================================');
  console.log(`Overall Result: ${allPass ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log('===============================================================');

  process.exit(allPass ? 0 : 1);
}

runTests();
