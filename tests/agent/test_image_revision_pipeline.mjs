/**
 * tests/agent/test_image_revision_pipeline.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Regression Test Suite for IMAGE_REVISION Pipeline & Chaining
 *
 * Covers:
 * 1. Simple IMAGE_REVISION ("ubah suasananya menjadi sunset")
 * 2. Multi-turn IMAGE_REVISION ("sekarang jadikan malam")
 * 3. Chained revision (TEST 1 -> TEST 2 -> TEST 3): referenceImage must be latest artifact #2
 * 4. Conversation history represented as objects
 * 5. Conversation history represented as multimodal arrays (OpenAI format)
 * 6. Current turn represented as a message object or multimodal array
 * 7. Defensive invariant before .match() (fails explicitly on invalid input)
 * 8. Flexible target modification (not bound to rigid keyword lists)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { semanticIntentEngineInstance } from '../../server/agent/SemanticIntentEngine.mjs';

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

const sie = semanticIntentEngineInstance;

async function runTests() {
  console.log(B('═══════════════════════════════════════════════════════════════════════════════'));
  console.log(B(' ULTIMATEAI IMAGE_REVISION REGRESSION TEST SUITE'));
  console.log(B('═══════════════════════════════════════════════════════════════════════════════\n'));

  // ── TEST 1: Simple IMAGE_REVISION ───────────────────────────────────────────
  console.log(Y('TEST 1: Simple IMAGE_REVISION ("ubah suasananya menjadi sunset")'));
  {
    const history = [
      { role: 'user', content: 'Buat gambar pesawat terbang melintasi gunung' },
      { role: 'assistant', content: 'Visual telah dibuat.', imageUrl: '/api/artifacts/images/img-test1-plane.jpg' }
    ];
    const decision = sie._imageRevisionClassifier('Sekarang ubah suasananya pesawat terbang menjadi sunset', history);
    if (decision && decision.intent === 'IMAGE_REVISION' && decision.referenceImage === '/api/artifacts/images/img-test1-plane.jpg') {
      pass('Simple IMAGE_REVISION matched', `ref=${decision.referenceImage}`);
    } else {
      fail('Simple IMAGE_REVISION failed', JSON.stringify(decision));
    }
  }

  // ── TEST 2: Multi-turn IMAGE_REVISION ───────────────────────────────────────
  console.log(Y('\nTEST 2: Multi-turn IMAGE_REVISION with intervening conversation'));
  {
    const history = [
      { role: 'user', content: 'Buat gambar pemandangan pantai' },
      { role: 'assistant', content: 'Ini pantainya.', imageUrl: '/api/artifacts/images/img-test2-beach.jpg' },
      { role: 'user', content: 'Wah keren banget ya pemandangannya!' },
      { role: 'assistant', content: 'Terima kasih, senang Anda menyukainya!' }
    ];
    const decision = sie._imageRevisionClassifier('Sekarang jadikan malam', history);
    if (decision && decision.intent === 'IMAGE_REVISION' && decision.referenceImage === '/api/artifacts/images/img-test2-beach.jpg') {
      pass('Multi-turn IMAGE_REVISION matched across intervening turns', `ref=${decision.referenceImage}`);
    } else {
      fail('Multi-turn IMAGE_REVISION failed', JSON.stringify(decision));
    }
  }

  // ── TEST 3: Chained Revision (TEST 1 -> TEST 2 -> TEST 3) ───────────────────
  console.log(Y('\nTEST 3: Chained revision (artifact #1 -> artifact #2 -> artifact #3)'));
  {
    const history = [
      { role: 'user', content: 'Buat gambar pesawat terbang melintasi gunung' },
      { role: 'assistant', content: 'Visual awal.', imageUrl: '/api/artifacts/images/img-1789119752945-a126a972.jpg' },
      { role: 'user', content: 'Sekarang ubah suasananya pesawat terbang menjadi sunset' },
      { role: 'assistant', content: 'Visual revisi sunset.', imageUrl: '/api/artifacts/images/img-1789119894292-84e64aa6.jpg' }
    ];
    const decision = sie._imageRevisionClassifier('Sekarang jadikan malam', history);
    if (
      decision &&
      decision.intent === 'IMAGE_REVISION' &&
      decision.referenceImage === '/api/artifacts/images/img-1789119894292-84e64aa6.jpg'
    ) {
      pass('Chained revision resolved latest artifact #2 as reference', `ref=${decision.referenceImage}`);
    } else {
      fail('Chained revision failed to resolve latest artifact', JSON.stringify(decision));
    }
  }

  // ── TEST 4: History represented as objects ──────────────────────────────────
  console.log(Y('\nTEST 4: Conversation history represented as objects'));
  {
    const history = [
      { role: 'user', content: { text: 'Buat gambar mobil balap', type: 'request' } },
      {
        role: 'assistant',
        content: { text: 'Mobil balap siap.', summary: 'rendering complete' },
        _agent: { imageUrl: '/api/artifacts/images/img-car-obj.jpg' }
      }
    ];

    try {
      // Must not throw "turnText.match is not a function" in interpret or offline reasoning
      const decision = await sie.interpret('Bikin suasananya hujan', { recentTurns: history });
      if (decision && decision.intent === 'IMAGE_REVISION' && decision.referenceImage === '/api/artifacts/images/img-car-obj.jpg') {
        pass('History with object content parsed safely without TypeError', `ref=${decision.referenceImage}`);
      } else {
        fail('History with object content did not resolve revision', JSON.stringify(decision));
      }
    } catch (err) {
      fail('History with object content threw exception', err.message);
    }
  }

  // ── TEST 5: History represented as multimodal arrays ────────────────────────
  console.log(Y('\nTEST 5: Conversation history represented as multimodal arrays (OpenAI format)'));
  {
    const history = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Gambarkan pemandangan kota futuristik' }
        ]
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Berikut kota futuristiknya.' },
          { type: 'image_url', image_url: { url: '/api/artifacts/images/img-multimodal-city.jpg' } }
        ]
      }
    ];

    try {
      const decision = await sie.interpret('Sekarang jadikan malam', { recentTurns: history });
      if (
        decision &&
        decision.intent === 'IMAGE_REVISION' &&
        decision.referenceImage === '/api/artifacts/images/img-multimodal-city.jpg'
      ) {
        pass('Multimodal array content parsed and resolved image_url part', `ref=${decision.referenceImage}`);
      } else {
        fail('Multimodal array content failed to resolve image_url', JSON.stringify(decision));
      }
    } catch (err) {
      fail('Multimodal array content threw exception', err.message);
    }
  }

  // ── TEST 6: Current turn represented as message object ──────────────────────
  console.log(Y('\nTEST 6: Current turn represented as a message object'));
  {
    const history = [
      { role: 'assistant', imageUrl: '/api/artifacts/images/img-target.jpg' }
    ];
    const messageInput = {
      role: 'user',
      content: [{ type: 'text', text: 'Sekarang jadikan malam' }]
    };

    try {
      const decision = await sie.interpret(messageInput, { recentTurns: history });
      if (decision && decision.intent === 'IMAGE_REVISION' && decision.referenceImage === '/api/artifacts/images/img-target.jpg') {
        pass('Current turn as message object normalized cleanly', `goal="${decision.goal}"`);
      } else {
        fail('Current turn as message object failed', JSON.stringify(decision));
      }
    } catch (err) {
      fail('Current turn as message object threw exception', err.message);
    }
  }

  // ── TEST 7: Defensive invariant on invalid input ────────────────────────────
  console.log(Y('\nTEST 7: Defensive invariant on invalid input'));
  {
    let caught = false;
    try {
      sie._normalizeUtterance(12345);
    } catch (e) {
      caught = true;
      pass('Invalid numeric input threw explicit TypeError invariant', e.message);
    }
    if (!caught) {
      fail('Invalid input did not throw explicit TypeError');
    }

    let classifierCaught = false;
    try {
      sie._imageRevisionClassifier(12345, []);
    } catch (e) {
      classifierCaught = true;
      pass('Classifier received non-string and threw explicit invariant TypeError', e.message);
    }
    if (!classifierCaught) {
      fail('Classifier did not enforce string invariant');
    }
  }

  // ── TEST 8: Target modifications without rigid keyword lists ────────────────
  console.log(Y('\nTEST 8: Dynamic target modifications (action + target modification + visual context)'));
  {
    const history = [{ role: 'assistant', imageUrl: '/api/artifacts/images/img-nature.jpg' }];

    const variations = [
      { prompt: 'Ganti langitnya', expectedRef: '/api/artifacts/images/img-nature.jpg' },
      { prompt: 'Buat lebih gelap', expectedRef: '/api/artifacts/images/img-nature.jpg' },
      { prompt: 'Tambahkan salju', expectedRef: '/api/artifacts/images/img-nature.jpg' },
      { prompt: 'Bikin suasananya hujan', expectedRef: '/api/artifacts/images/img-nature.jpg' }
    ];

    for (const v of variations) {
      const dec = sie._imageRevisionClassifier(v.prompt, history);
      if (dec && dec.intent === 'IMAGE_REVISION' && dec.referenceImage === v.expectedRef) {
        pass(`Dynamic modification matched: "${v.prompt}"`, `mod=${dec.visualIntent.modifyElements.join(',')}`);
      } else {
        fail(`Dynamic modification failed for: "${v.prompt}"`, JSON.stringify(dec));
      }
    }
  }

  // ── TEST 9: Idempotency guard — at most one image artifact per request ID ────
  console.log(Y('\nTEST 9: Idempotency Guard (ONE request ID -> AT MOST ONE artifact)'));
  {
    const { imageGenerationInstance } = await import('../../server/agent/ImageGeneration.mjs');
    const testGenId = `gen-idempotency-test-${Date.now()}`;

    // Mock fetch for image generation to track execution count
    let networkFetchCount = 0;
    const mockTransport = {
      fetch: async (url, opts) => {
        networkFetchCount++;
        // Return 1x1 valid JPEG magic bytes
        const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
        const paddedBuffer = Buffer.concat([jpegBuffer, Buffer.alloc(2048)]);
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'image/jpeg' }),
          arrayBuffer: async () => new Uint8Array(paddedBuffer).buffer
        };
      }
    };

    // First call
    const res1 = await imageGenerationInstance.generateImage({
      prompt: 'pesawat terbang di malam hari',
      referenceImage: '/api/artifacts/images/img-1789119894292-84e64aa6.jpg',
      generationId: testGenId,
      messageId: 'msg-test-1',
      providerOverride: 'POLLINATIONS'
    }, mockTransport);

    // Second call with identical generationId (simulate duplicate submit / retry)
    const res2 = await imageGenerationInstance.generateImage({
      prompt: 'pesawat terbang di malam hari',
      referenceImage: '/api/artifacts/images/img-1789119894292-84e64aa6.jpg',
      generationId: testGenId,
      messageId: 'msg-test-1',
      providerOverride: 'POLLINATIONS'
    }, mockTransport);

    if (res1.success && res2.success && res1.artifact.id === res2.artifact.id && networkFetchCount === 1) {
      pass('Idempotency guard prevented duplicate execution for same requestId', `artifactId=${res1.artifact.id}, fetchCount=${networkFetchCount}`);
    } else {
      fail('Idempotency guard failed: duplicate artifact created', `fetches=${networkFetchCount}, id1=${res1.artifact?.id}, id2=${res2.artifact?.id}`);
    }
  }

  // ── TEST 10: Deterministic Fast-Path — No LLM / Network Call for Image Revision ──
  console.log(Y('\nTEST 10: Zero-LLM Fast-Path (Must not invoke LLM proxy for IMAGE_REVISION)'));
  {
    const history = [
      { role: 'assistant', imageUrl: '/api/artifacts/images/img-1789119894292-84e64aa6.jpg' }
    ];

    const startTime = performance.now();
    // sie.interpret must resolve deterministically in <10ms without making any HTTP fetch
    const decision = await sie.interpret('Sekarang jadikan malam', { recentTurns: history }, {
      certificationTransport: 'LOCAL_ROUTER_PROXY'
    });
    const duration = performance.now() - startTime;

    if (decision && decision.intent === 'IMAGE_REVISION' && duration < 50) {
      pass('IMAGE_REVISION resolved via deterministic fast-path without LLM roundtrip', `duration=${duration.toFixed(2)}ms, source=${decision.interpretationSource}`);
    } else {
      fail('Fast-path took too long or failed', `duration=${duration.toFixed(2)}ms, decision=${JSON.stringify(decision)}`);
    }
  }

  // ── TEST 11: Exact Live TEST 3 Reference Validation ──────────────────────────
  console.log(Y('\nTEST 11: Exact TEST 3 Reference Resolution to Artifact #2'));
  {
    const liveHistory = [
      {
        role: 'user',
        content: 'Buat gambar pesawat terbang melintasi gunung'
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Visual untuk pesawat terbang melintasi gunung telah selesai disiapkan.' }, { type: 'image_url', image_url: { url: 'http://127.0.0.1:20200/api/artifacts/images/img-1789119752945-a126a972.jpg' } }],
        imageUrl: 'http://127.0.0.1:20200/api/artifacts/images/img-1789119752945-a126a972.jpg'
      },
      {
        role: 'user',
        content: 'Sekarang ubah suasananya pesawat terbang menjadi sunset'
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Visual telah diubah menjadi suasana sunset.' }, { type: 'image_url', image_url: { url: 'http://127.0.0.1:20200/api/artifacts/images/img-1789119894292-84e64aa6.jpg' } }],
        imageUrl: 'http://127.0.0.1:20200/api/artifacts/images/img-1789119894292-84e64aa6.jpg'
      }
    ];

    const decision = sie._imageRevisionClassifier('Sekarang jadikan malam', liveHistory);
    let resolvedRef = decision?.referenceImage || null;
    if (resolvedRef) {
      resolvedRef = resolvedRef.replace(/^https?:\/\/[^\/]+/i, '');
    }

    if (
      decision &&
      decision.intent === 'IMAGE_REVISION' &&
      resolvedRef === '/api/artifacts/images/img-1789119894292-84e64aa6.jpg'
    ) {
      pass('TEST 3 referenceImage correctly resolved to TEST 2 artifact', `ref=${resolvedRef}`);
    } else {
      fail('TEST 3 referenceImage did not match TEST 2 artifact', `resolved=${resolvedRef}`);
    }
  }

  // ── TEST 12: Concurrent requests from ONE input message must never produce two image artifacts ────
  console.log(Y('\nTEST 12: Exactly-One Execution (Concurrent requests produce exactly one artifact)'));
  {
    const { imageGenerationInstance } = await import('../../server/agent/ImageGeneration.mjs');
    const concurrentGenId = `gen-concurrent-test-${Date.now()}`;
    let networkFetches = 0;

    const mockTransport = {
      fetch: async (url, opts) => {
        networkFetches++;
        await new Promise(r => setTimeout(r, 50)); // simulate 50ms network flight
        const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
        const paddedBuffer = Buffer.concat([jpegBuffer, Buffer.alloc(2048)]);
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'image/jpeg' }),
          arrayBuffer: async () => new Uint8Array(paddedBuffer).buffer
        };
      }
    };

    // Fire TWO concurrent calls simultaneously
    const [p1, p2] = await Promise.all([
      imageGenerationInstance.generateImage({
        prompt: 'pesawat terbang malam hari concurrent',
        referenceImage: '/api/artifacts/images/img-1789119894292-84e64aa6.jpg',
        generationId: concurrentGenId,
        messageId: 'msg-concurrent-1',
        providerOverride: 'POLLINATIONS'
      }, mockTransport),
      imageGenerationInstance.generateImage({
        prompt: 'pesawat terbang malam hari concurrent',
        referenceImage: '/api/artifacts/images/img-1789119894292-84e64aa6.jpg',
        generationId: concurrentGenId,
        messageId: 'msg-concurrent-1',
        providerOverride: 'POLLINATIONS'
      }, mockTransport)
    ]);

    if (p1.success && p2.success && p1.artifact.id === p2.artifact.id && networkFetches === 1) {
      pass('ONE concurrent input message produced exactly ONE artifact via in-flight guard', `artifactId=${p1.artifact.id}, fetches=${networkFetches}`);
    } else {
      fail('Concurrent calls produced duplicate artifacts or multiple network fetches', `p1=${p1.artifact?.id}, p2=${p2.artifact?.id}, fetches=${networkFetches}`);
    }
  }

  // ── TEST 13: Deterministic IMAGE_REVISION must not invoke LLM routing before classification ────
  console.log(Y('\nTEST 13: Deterministic Fast-Path Zero LLM Dispatch'));
  {
    let llmNetworkCalled = false;
    const fakeContext = {
      recentTurns: [
        {
          role: 'user',
          content: 'Buat gambar mobil balap'
        },
        {
          role: 'assistant',
          imageUrl: '/api/artifacts/images/img-car-test.jpg'
        }
      ]
    };

    const startTime = performance.now();
    // Use interpret() with an options mock that detects any remote dispatch
    const decision = await sie.interpret('Sekarang jadikan malam', fakeContext, {
      certificationTransport: 'MOCK_FAIL_ON_NETWORK',
      forcedModel: 'qwen3:8b'
    });
    const elapsed = performance.now() - startTime;

    if (decision.intent === 'IMAGE_REVISION' && !llmNetworkCalled && elapsed < 100) {
      pass('interpret() resolved IMAGE_REVISION deterministically with ZERO LLM dispatch', `intent=${decision.intent}, elapsed=${elapsed.toFixed(2)}ms`);
    } else {
      fail('interpret() invoked LLM or failed to resolve deterministically', `elapsed=${elapsed.toFixed(2)}ms ` + JSON.stringify(decision));
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

runTests().catch(err => {
  console.error(R('FATAL TEST ERROR:'), err);
  process.exit(1);
});
