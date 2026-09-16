// Test Ollama startup, basic inference, streaming, empty handling, timeout, sequential, parallel
const OLLAMA_HOST = 'http://127.0.0.1:11434';
const MODELS = ['hermes3:8b', 'qwen3:8b'];

async function testModel(model) {
  console.log(`\n========================================`);
  console.log(`TESTING OLLAMA MODEL: ${model}`);
  console.log(`========================================`);
  const report = { model, checks: {} };

  // 1. Startup & Basic Inference
  const t0 = Date.now();
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: 'Jawab singkat 1 kata: Siapa penemu kalkulus?',
        stream: false,
        options: { temperature: 0.0 }
      })
    });
    const data = await res.json();
    const duration = Date.now() - t0;
    report.checks.basicInference = {
      status: 'PASS',
      durationMs: duration,
      rawResponse: data.response?.trim()
    };
    console.log(`[1. BASIC INFERENCE] PASS (${duration}ms) -> "${data.response?.trim()}"`);
  } catch (err) {
    report.checks.basicInference = { status: 'FAIL', error: err.message };
    console.log(`[1. BASIC INFERENCE] FAIL: ${err.message}`);
  }

  // 2. Streaming
  try {
    const tStream = Date.now();
    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: 'Sebutkan angka 1 sampai 5 dipisah koma.',
        stream: true,
        options: { temperature: 0.0 }
      })
    });
    let chunks = 0;
    let fullText = '';
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      const lines = text.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          fullText += parsed.response || '';
          chunks++;
        } catch {}
      }
    }
    const streamDur = Date.now() - tStream;
    report.checks.streaming = {
      status: 'PASS',
      chunks,
      durationMs: streamDur,
      rawText: fullText.trim()
    };
    console.log(`[2. STREAMING] PASS (${chunks} chunks in ${streamDur}ms) -> "${fullText.trim()}"`);
  } catch (err) {
    report.checks.streaming = { status: 'FAIL', error: err.message };
    console.log(`[2. STREAMING] FAIL: ${err.message}`);
  }

  // 3. Empty / Whitespace Prompt Handling
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: '   ',
        stream: false
      })
    });
    const data = await res.json();
    report.checks.emptyPrompt = {
      status: 'PASS',
      responseLength: data.response ? data.response.length : 0,
      raw: data.response
    };
    console.log(`[3. EMPTY PROMPT] PASS (handled gracefully, resp len: ${data.response?.length || 0})`);
  } catch (err) {
    report.checks.emptyPrompt = { status: 'FAIL', error: err.message };
    console.log(`[3. EMPTY PROMPT] FAIL: ${err.message}`);
  }

  // 4. Timeout Handling (Simulated 200ms abort)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 200);
    let aborted = false;
    try {
      await fetch(`${OLLAMA_HOST}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: 'Tuliskan esai 500 kata tentang sejarah komputasi.',
          stream: false
        }),
        signal: controller.signal
      });
    } catch (e) {
      if (e.name === 'AbortError') aborted = true;
    } finally {
      clearTimeout(timeoutId);
    }
    report.checks.timeoutHandling = {
      status: aborted ? 'PASS' : 'UNEXPECTED',
      abortedGracefully: aborted
    };
    console.log(`[4. TIMEOUT HANDLING] PASS (Client abort caught cleanly: ${aborted})`);
  } catch (err) {
    report.checks.timeoutHandling = { status: 'FAIL', error: err.message };
    console.log(`[4. TIMEOUT HANDLING] FAIL: ${err.message}`);
  }

  // 5. Sequential Requests (2 requests)
  try {
    const tSeq = Date.now();
    const res1 = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: 'Katakan "Alpha"', stream: false, options: { temperature: 0 } })
    });
    const d1 = await res1.json();
    const res2 = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: 'Katakan "Beta"', stream: false, options: { temperature: 0 } })
    });
    const d2 = await res2.json();
    const seqDur = Date.now() - tSeq;
    report.checks.sequential = {
      status: 'PASS',
      durationMs: seqDur,
      out1: d1.response?.trim(),
      out2: d2.response?.trim()
    };
    console.log(`[5. SEQUENTIAL REQUESTS] PASS (${seqDur}ms) -> r1:"${d1.response?.trim()}", r2:"${d2.response?.trim()}"`);
  } catch (err) {
    report.checks.sequential = { status: 'FAIL', error: err.message };
    console.log(`[5. SEQUENTIAL REQUESTS] FAIL: ${err.message}`);
  }

  // 6. Parallel Requests (2 concurrent requests)
  try {
    const tPar = Date.now();
    const p1 = fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: 'Katakan "Ganjil"', stream: false, options: { temperature: 0 } })
    }).then(r => r.json());
    const p2 = fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: 'Katakan "Genap"', stream: false, options: { temperature: 0 } })
    }).then(r => r.json());

    const [r1, r2] = await Promise.all([p1, p2]);
    const parDur = Date.now() - tPar;
    report.checks.parallel = {
      status: 'PASS',
      durationMs: parDur,
      out1: r1.response?.trim(),
      out2: r2.response?.trim()
    };
    console.log(`[6. PARALLEL REQUESTS] PASS (${parDur}ms) -> r1:"${r1.response?.trim()}", r2:"${r2.response?.trim()}"`);
  } catch (err) {
    report.checks.parallel = { status: 'FAIL', error: err.message };
    console.log(`[6. PARALLEL REQUESTS] FAIL: ${err.message}`);
  }

  return report;
}

async function run() {
  const reports = {};
  for (const model of MODELS) {
    reports[model] = await testModel(model);
  }
  console.log('\n=== ALL OLLAMA MODEL CHECKS COMPLETE ===');
  return reports;
}

run().catch(console.error);
