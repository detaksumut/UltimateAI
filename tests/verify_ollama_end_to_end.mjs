/**
 * verify_ollama_end_to_end.mjs
 * End-to-end Verification Test for Ollama Integration in Local Router.
 * 
 * 1. Direct Health Check against Ollama daemon (127.0.0.1:11434/api/tags)
 * 2. Model Detection (hermes3:8b / qwen3:8b)
 * 3. LocalRouter Completion via POST :20200/v1/chat/completions with explicit model/provider
 * 4. Provenance & Antigravity Isolation verification
 */

import http from 'http';

console.log('====================================================');
console.log('  TEST: OLLAMA INTEGRATION END-TO-END VERIFICATION');
console.log('====================================================\n');

async function testOllamaTags() {
  console.log('[STEP 1] Probing Ollama daemon at http://127.0.0.1:11434/api/tags ...');
  const startTime = Date.now();
  try {
    const res = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(5000) });
    const latency = Date.now() - startTime;
    if (!res.ok) {
      console.log(`[FAIL] Ollama HTTP status: ${res.status}`);
      return { ok: false, error: `HTTP ${res.status}`, latency };
    }
    const data = await res.json();
    const models = (data.models || []).map(m => m.name || m.model || '');
    console.log(`[PASS] Ollama is ONLINE (${latency}ms). Models found: ${models.join(', ') || 'none'}`);
    return { ok: true, models, latency };
  } catch (err) {
    const latency = Date.now() - startTime;
    console.log(`[FAIL] Ollama unreachable: ${err.message} (${latency}ms)`);
    return { ok: false, error: err.message, latency };
  }
}

async function testLocalRouterOllamaRoute(modelName) {
  console.log(`\n[STEP 2] Sending chat completion to Local Router :20200 for model: ${modelName} ...`);
  const startTime = Date.now();
  try {
    const res = await fetch('http://127.0.0.1:20200/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        capability: 'FAST_CHAT',
        messages: [
          { role: 'user', content: 'Halo JIN, perkenalkan dirimu singkat dalam 1 kalimat.' }
        ]
      }),
      signal: AbortSignal.timeout(60000)
    });
    const latency = Date.now() - startTime;
    const data = await res.json();
    
    console.log(`[RESPONSE STATUS] HTTP ${res.status} in ${latency}ms`);
    console.log('[PROVENANCE]', JSON.stringify(data.provenance || {}, null, 2));
    console.log('[CHOICES]', JSON.stringify(data.choices || [], null, 2));

    return {
      status: res.status,
      data,
      latency
    };
  } catch (err) {
    const latency = Date.now() - startTime;
    console.log(`[FAIL] LocalRouter call failed: ${err.message} (${latency}ms)`);
    return {
      status: 500,
      error: err.message,
      latency
    };
  }
}

async function run() {
  const ollamaCheck = await testOllamaTags();
  
  let targetModel = 'hermes3:8b';
  if (ollamaCheck.ok && Array.isArray(ollamaCheck.models) && ollamaCheck.models.length > 0) {
    const foundHermes = ollamaCheck.models.find(m => m.includes('hermes3'));
    if (foundHermes) {
      targetModel = foundHermes;
    } else {
      targetModel = ollamaCheck.models[0];
    }
  }

  const routerCheck = await testLocalRouterOllamaRoute(targetModel);

  console.log('\n====================================================');
  console.log('  SUMMARY AUDIT REPORT');
  console.log('====================================================');
  console.log(`OLLAMA CONNECTION: ${ollamaCheck.ok ? 'PASS' : 'FAIL'}`);
  console.log(`MODEL DETECTED: ${ollamaCheck.models?.join(', ') || 'NONE'}`);
  
  const prov = routerCheck.data?.provenance;
  const routerPass = routerCheck.status === 200 && prov?.providerGateway === 'OLLAMA';
  console.log(`LOCAL ROUTER -> OLLAMA: ${routerPass ? 'PASS' : 'FAIL'}`);
  
  const content = routerCheck.data?.choices?.[0]?.message?.content;
  const hermesPass = routerPass && Boolean(content && content.length > 0);
  console.log(`HERMES RESPONSE: ${hermesPass ? 'PASS' : 'FAIL'}`);
  
  const antigravityCalled = prov?.providerGateway === 'ANTIGRAVITY' || prov?.fallbackUsed === true;
  console.log(`ANTIGRAVITY CALLED DURING TEST: ${antigravityCalled ? 'YES' : 'NO'}`);
  console.log(`ACTUAL MODEL THAT RESPONDED: ${prov?.actualModel || routerCheck.data?.model || 'NONE'}`);
  console.log(`LATENCY: ${routerCheck.latency}ms`);
  console.log(`ERROR: ${routerCheck.error || (routerCheck.data?.error?.message) || 'NONE'}`);
  console.log('====================================================\n');
}

run().catch(console.error);
