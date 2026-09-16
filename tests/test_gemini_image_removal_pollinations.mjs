/**
 * test_gemini_image_removal_pollinations.mjs
 * Verification suite for: REMOVE POLLINATIONS FROM IMAGE GENERATION
 * Tests IMAGE-01 through IMAGE-08.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { imageGenerationInstance } from '../server/agent/ImageGeneration.mjs';
import { geminiImageAdapterInstance, assertNoPollinationsImageProvider } from '../server/agent/adapters/GeminiImageAdapter.mjs';
import { MAX_IMAGE_BYTES } from '../server/agent/ImageOutputSizePolicy.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Create valid JPEG > 1024 bytes to satisfy MIN_ARTIFACT_BYTES and magic byte verification
function createValidTestJpeg() {
  const header = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00]);
  const commentLength = 2048;
  const comment = Buffer.alloc(commentLength + 2);
  comment[0] = 0xFF;
  comment[1] = 0xFE;
  comment.writeUInt16BE(commentLength, 2);
  const eoi = Buffer.from([0xFF, 0xD9]);
  return Buffer.concat([header, comment, eoi]);
}

const VALID_TEST_JPEG_BUFFER = createValidTestJpeg();
const VALID_TEST_JPEG_BASE64 = VALID_TEST_JPEG_BUFFER.toString('base64');

// Simulated transport producing valid Gemini image response
function createMockGeminiFetch(success = true, errorPayload = null) {
  return async (url, options) => {
    // Hard gate check on outgoing URL
    if (url.includes('pollinations.ai')) {
      throw new Error('[HARD_GATE_BREACH] Attempted to call pollinations.ai!');
    }

    if (!success) {
      return {
        ok: false,
        status: errorPayload?.status || 429,
        text: async () => JSON.stringify(errorPayload || { error: { code: 429, message: 'Resource exhausted / quota exceeded' } }),
        json: async () => errorPayload || { error: { code: 429, message: 'Resource exhausted / quota exceeded' } }
      };
    }

    return {
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: VALID_TEST_JPEG_BASE64
                  }
                }
              ]
            }
          }
        ]
      })
    };
  };
}

const testResults = [];

function recordTest(testId, name, passed, details = '') {
  testResults.push({ testId, name, passed, details });
  const mark = passed ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${testId}: ${name} ${details ? '(' + details + ')' : ''}`);
}

async function runTests() {
  console.log('===============================================================');
  console.log('  RUNNING TESTS: REMOVAL OF POLLINATIONS & GEMINI IMAGE PIPELINE');
  console.log('===============================================================\n');

  // -------------------------------------------------------------
  // TEST IMAGE-01: Presentation image request
  // -------------------------------------------------------------
  try {
    const fetchFn = createMockGeminiFetch(true);
    const result = await imageGenerationInstance.generateImage({
      prompt: 'Minimalist tech keynote background visual',
      intent: 'SLIDE_STUDIO',
      requestId: 'req-test-slide-01'
    }, { fetch: fetchFn });

    const passed = result.success === true &&
                   result.artifact?.provider === 'GEMINI' &&
                   result.artifact?.model === 'gemini-2.5-flash-image';
    recordTest('IMAGE-01', 'Presentation image request', passed, `provider=${result.artifact?.provider}, model=${result.artifact?.model}`);
  } catch (err) {
    recordTest('IMAGE-01', 'Presentation image request', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST IMAGE-02: House design image request
  // -------------------------------------------------------------
  try {
    const fetchFn = createMockGeminiFetch(true);
    const result = await imageGenerationInstance.generateImage({
      prompt: 'Desain fasad rumah tropis minimalis 2 lantai',
      intent: 'HOUSE_DESIGN',
      requestId: 'req-test-house-02'
    }, { fetch: fetchFn });

    const passed = result.success === true &&
                   result.artifact?.provider === 'GEMINI' &&
                   result.artifact?.model === 'gemini-2.5-flash-image';
    recordTest('IMAGE-02', 'House design image request', passed, `provider=${result.artifact?.provider}, model=${result.artifact?.model}`);
  } catch (err) {
    recordTest('IMAGE-02', 'House design image request', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST IMAGE-03: Generic image request
  // -------------------------------------------------------------
  try {
    const fetchFn = createMockGeminiFetch(true);
    const result = await imageGenerationInstance.generateImage({
      prompt: 'Abstract holographic neural network glowing in dark',
      intent: 'IMAGE_GENERATION',
      requestId: 'req-test-gen-03'
    }, { fetch: fetchFn });

    const passed = result.success === true &&
                   result.artifact?.provider === 'GEMINI' &&
                   result.artifact?.model === 'gemini-2.5-flash-image';
    recordTest('IMAGE-03', 'Generic image request', passed, `provider=${result.artifact?.provider}, model=${result.artifact?.model}`);
  } catch (err) {
    recordTest('IMAGE-03', 'Generic image request', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST IMAGE-04: Gemini image failure
  // -------------------------------------------------------------
  try {
    const fetchFn = createMockGeminiFetch(false, { error: { code: 429, message: 'All Gemini API keys exhausted' } });
    const result = await imageGenerationInstance.generateImage({
      prompt: 'A test image that should fail gracefully',
      intent: 'IMAGE_GENERATION',
      requestId: 'req-test-fail-04'
    }, { fetch: fetchFn });

    const isFailed = result.success === false;
    const isExplicitError = result.error && result.error.includes('IMAGE_GENERATION_FAILED');
    const noFallback = result.artifact === undefined;

    let hardGateCaught = false;
    try {
      assertNoPollinationsImageProvider('https://image.pollinations.ai/prompt/test');
    } catch (e) {
      if (e.code === 'POLLINATIONS_FORBIDDEN') hardGateCaught = true;
    }

    const passed = isFailed && isExplicitError && noFallback && hardGateCaught;
    recordTest('IMAGE-04', 'Gemini image failure -> IMAGE_GENERATION_FAILED & NO POLLINATIONS FALLBACK', passed,
      `success=${result.success}, code=${result.reasonCode}, hardGate=${hardGateCaught}`);
  } catch (err) {
    recordTest('IMAGE-04', 'Gemini image failure', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST IMAGE-05: Search repository for: pollinations.ai
  // -------------------------------------------------------------
  try {
    const serverDir = path.join(rootDir, 'server');
    let activeCallsFound = 0;
    const scannedFiles = [];

    function scanDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (/\.(mjs|js|ts)$/.test(entry.name)) {
          scannedFiles.push(fullPath);
          const content = fs.readFileSync(fullPath, 'utf8');
          // Match any active URL or network call to pollinations.ai
          const matchUrl = content.match(/https?:\/\/[^\s'"`]*pollinations\.ai[^\s'"`]*/g);
          if (matchUrl) {
            // Check if it is within assertNoPollinationsImageProvider or a disabled comment
            for (const u of matchUrl) {
              // If it is in an executable fetch or assignment to an active endpoint
              if (/fetch\s*\(\s*[`'"]https?:\/\/[^`'"]*pollinations/i.test(content) ||
                  /endpoint\s*:\s*[`'"]https?:\/\/[^`'"]*pollinations/i.test(content)) {
                activeCallsFound++;
                console.error(`[IMAGE-05 FAIL] Found active pollinations call in: ${fullPath}`);
              }
            }
          }
        }
      }
    }

    scanDir(serverDir);
    const passed = activeCallsFound === 0;
    recordTest('IMAGE-05', 'Search repository for pollinations.ai (NO ACTIVE IMAGE-GENERATION PATH)', passed,
      `scanned=${scannedFiles.length} files, activeCallsFound=${activeCallsFound}`);
  } catch (err) {
    recordTest('IMAGE-05', 'Search repository for pollinations.ai', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST IMAGE-06: Verify API key masking
  // -------------------------------------------------------------
  try {
    const sampleApiKey = 'AIzaSy' + 'TESTKEYMASKING1234567890abcdefgh';
    const sampleVertexKey = 'AQ.' + 'TESTVERTEXMASKING1234567890abcdefghij1234567890abcde';
    const rawErrorText = `Error occurred when connecting with key=${sampleApiKey} and token ${sampleVertexKey}`;

    const masked = geminiImageAdapterInstance._maskSecrets(rawErrorText);
    const noRawKey = !masked.includes(sampleApiKey) && !masked.includes(sampleVertexKey);
    const containsRedacted = masked.includes('[REDACTED_GEMINI_KEY]') || masked.includes('[REDACTED_KEY]');

    const passed = noRawKey && containsRedacted;
    recordTest('IMAGE-06', 'Verify API key masking in diagnostics and logs', passed,
      `rawKeyExposed=${!noRawKey}, maskedOutput="${masked}"`);
  } catch (err) {
    recordTest('IMAGE-06', 'Verify API key masking', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST IMAGE-07: Verify image bytes
  // -------------------------------------------------------------
  try {
    const fetchFn = createMockGeminiFetch(true);
    const result = await geminiImageAdapterInstance.generateImage({
      prompt: 'Real bytes verification test',
      requestId: 'req-test-bytes-07',
      fetchFn
    });

    const isNonEmpty = result.buffer && result.buffer.length > 0;
    const isUnder1MB = result.buffer.length < MAX_IMAGE_BYTES;
    const isRealBuffer = Buffer.isBuffer(result.buffer);
    const passed = result.success === true && isNonEmpty && isUnder1MB && isRealBuffer;

    recordTest('IMAGE-07', 'Verify image bytes (real non-empty bytes < 1MB)', passed,
      `bytes=${result.buffer?.length}, isUnder1MB=${isUnder1MB}`);
  } catch (err) {
    recordTest('IMAGE-07', 'Verify image bytes', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST IMAGE-08: Verify requestId propagation
  // -------------------------------------------------------------
  try {
    const targetRequestId = 'req-intent-gate-audit-8899-xyz';
    const fetchFn = createMockGeminiFetch(true);
    const result = await imageGenerationInstance.generateImage({
      prompt: 'End to end requestId propagation test',
      requestId: targetRequestId
    }, { fetch: fetchFn });

    const returnedRequestId = result.artifact?.requestId;
    const passed = result.success === true && returnedRequestId === targetRequestId;

    recordTest('IMAGE-08', 'Verify requestId propagation (Intent Gate → ImageGeneration → Gemini)', passed,
      `expected="${targetRequestId}", received="${returnedRequestId}"`);
  } catch (err) {
    recordTest('IMAGE-08', 'Verify requestId propagation', false, err.message);
  }

  // -------------------------------------------------------------
  // SUMMARY TABLE
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('                        TEST SUMMARY');
  console.log('===============================================================');
  let allPass = true;
  for (const t of testResults) {
    const statusStr = t.passed ? 'PASS' : 'FAIL';
    if (!t.passed) allPass = false;
    console.log(`${t.testId.padEnd(10)} ${statusStr.padEnd(8)} ${t.name}`);
  }
  console.log('===============================================================');

  const configuredModel = geminiImageAdapterInstance.resolveImageModel();
  console.log(`Configured Gemini Image Provider: GEMINI`);
  console.log(`Configured Gemini Image Model   : ${configuredModel}`);
  console.log(`Overall Result                  : ${allPass ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log('===============================================================');

  process.exit(allPass ? 0 : 1);
}

runTests();
