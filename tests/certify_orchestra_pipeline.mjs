/**
 * certify_orchestra_pipeline.mjs
 * End-to-End Certification for JIN Unified Cloud-First Pipeline:
 *  - Tavily Web Search
 *  - Gemini 2.5 Flash Fast Chat & Streaming
 *  - Image Generation (Gemini Imagen + Pollinations failover)
 *  - Memory usage & Latency benchmark
 */

import dotenv from 'dotenv';
dotenv.config();

import { capabilityRegistryInstance } from '../server/grounding/CapabilityRegistry.mjs';
import { modelRoutingServiceInstance } from '../server/local_router/ModelRoutingService.mjs';

async function runCertification() {
  console.log('================================================================');
  console.log('🚀 JIN UNIFIED ORCHESTRATION CERTIFICATION (TAVILY + GEMINI)');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, name, details = '') {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${name} ${details ? `(${details})` : ''}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} ${details ? `(${details})` : ''}`);
    }
  }

  // ── TEST 1: TAVILY WEB SEARCH CAPABILITY ──────────────────────────────────
  console.log('--- TEST 1: CapabilityRegistry -> web.search (Tavily AI) ---');
  const t0Search = Date.now();
  try {
    const searchRes = await capabilityRegistryInstance.executeCapability('web.search', {
      query: 'Ibu Kota Nusantara Indonesia terkini',
      maxResults: 4
    });
    const dtSearch = Date.now() - t0Search;

    assert(searchRes && searchRes.sourcesCount > 0, 'Search returned valid sources', `Count: ${searchRes.sourcesCount}`);
    assert(searchRes.provider === 'TAVILY_AI', 'Search used Tavily AI Cloud Engine', `Provider: ${searchRes.provider}`);
    assert(Boolean(searchRes.directAnswer || searchRes.sources[0]?.snippet), 'Search generated synthesized intelligence');
    assert(dtSearch < 6000, 'Search latency under 6 seconds', `${dtSearch} ms`);
    console.log(`   Sample Source: ${searchRes.sources[0]?.title} [${searchRes.sources[0]?.url}]`);
    if (searchRes.directAnswer) {
      console.log(`   Direct Synthesis: ${searchRes.directAnswer.slice(0, 100)}...`);
    }
  } catch (err) {
    assert(false, 'Tavily Search Capability', err.message);
  }

  // ── TEST 2: GEMINI 2.5 FLASH INFERENCE & STREAMING ────────────────────────
  console.log('\n--- TEST 2: ModelRoutingService -> Gemini 2.5 Flash Chat & Stream ---');
  const t0Chat = Date.now();
  try {
    let chunkCount = 0;
    let ttfb = 0;
    const streamRes = await modelRoutingServiceInstance.routeChat({
      messages: [
        { role: 'system', content: 'Anda adalah JIN, kecerdasan terpadu UltimateAI. Jawab sangat singkat dan padat.' },
        { role: 'user', content: 'Jelaskan hukum gravitasi Newton dalam 1 kalimat.' }
      ],
      stream: true
    }, (chunk) => {
      chunkCount++;
      if (chunkCount === 1) ttfb = Date.now() - t0Chat;
    });
    const dtChat = Date.now() - t0Chat;

    assert(streamRes && streamRes.providerGateway === 'GEMINI', 'Chat routed to Gemini 2.5 Flash', `Model: ${streamRes.actualModel}`);
    assert(chunkCount > 0, 'Stream successfully emitted token chunks', `Chunks: ${chunkCount}`);
    assert(ttfb < 3500, 'Time to first token (TTFB) fast', `${ttfb} ms`);
    assert(dtChat < 7000, 'Total chat response completed under 7 seconds', `${dtChat} ms`);
    console.log(`   Reply: ${streamRes.content.trim()}`);
  } catch (err) {
    assert(false, 'Gemini Chat & Stream', err.message);
  }

  // ── TEST 3: IMAGE GENERATION & AUTO-FAILOVER ──────────────────────────────
  console.log('\n--- TEST 3: CapabilityRegistry -> image.generate (Gemini + Pollinations Failover) ---');
  const t0Img = Date.now();
  try {
    const imgRes = await capabilityRegistryInstance.executeCapability('image.generate', {
      prompt: 'futuristic high-tech laboratory blue neon lighting',
      size: '512x512'
    });
    const dtImg = Date.now() - t0Img;

    assert(imgRes && imgRes.success === true, 'Image generation succeeded', `Provider: ${imgRes.artifact?.provider}`);
    assert(Boolean(imgRes.artifact?.url), 'Image artifact has valid renderable URL', `URL: ${imgRes.artifact?.url}`);
    assert(Boolean(imgRes.artifact?.localPath), 'Image saved locally to artifacts storage');
    console.log(`   Artifact generated in ${dtImg} ms: ${imgRes.artifact?.url}`);
  } catch (err) {
    assert(false, 'Image Generation Pipeline', err.message);
  }

  // ── TEST 4: MEMORY & RESOURCE PROFILE ─────────────────────────────────────
  console.log('\n--- TEST 4: System Resource Footprint ---');
  const mem = process.memoryUsage();
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const rssMB = Math.round(mem.rss / 1024 / 1024);
  assert(heapUsedMB < 150, 'Node.js Heap Memory ultra-light', `${heapUsedMB} MB`);
  assert(rssMB < 300, 'Process RSS memory well within limits', `${rssMB} MB`);

  console.log('\n================================================================');
  console.log(`🏆 CERTIFICATION SUMMARY: ${passed}/${total} TESTS PASSED (${Math.round(passed / total * 100)}%)`);
  console.log('================================================================');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runCertification().catch(err => {
  console.error('Fatal certification error:', err);
  process.exit(1);
});
