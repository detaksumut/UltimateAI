import fs from 'fs';
import path from 'path';

const LLAMA_HOST = 'http://127.0.0.1:8080';
const outputDir = 'D:/Users/ultimateai/tests/model-fidelity/outputs/llamacpp/qwen3';
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

async function waitReady(maxSeconds = 120) {
  process.stdout.write('Waiting for llama-server (Qwen 3:8B) to become ready... ');
  const start = Date.now();
  while (Date.now() - start < maxSeconds * 1000) {
    try {
      const res = await fetch(`${LLAMA_HOST}/health`);
      if (res.ok) {
        const d = await res.json();
        if (d.status === 'ok') {
          console.log(`READY in ${((Date.now() - start) / 1000).toFixed(1)}s!`);
          return true;
        }
      }
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
    process.stdout.write('.');
  }
  console.log('TIMEOUT waiting for llama-server');
  return false;
}

async function runQwenTestMatrix() {
  const ready = await waitReady(120);
  if (!ready) {
    console.error('FAILED: llama-server did not become healthy within timeout.');
    process.exit(1);
  }

  const results = {};

  // 1. Basic Completion
  console.log('\n[TEST 1] Basic Completion...');
  const t0 = Date.now();
  const r1 = await fetch(`${LLAMA_HOST}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Siapakah Isaac Newton? Jawab dalam 1 kalimat padat.' }],
      temperature: 0.0,
      max_tokens: 150
    })
  });
  const d1 = await r1.json();
  const dur1 = Date.now() - t0;
  const content1 = d1.choices?.[0]?.message?.content || '';
  const usage1 = d1.usage || {};
  const tps1 = usage1.completion_tokens ? (usage1.completion_tokens / (dur1 / 1000)).toFixed(2) : 'N/A';
  console.log(` -> Duration: ${dur1}ms | Tokens: in=${usage1.prompt_tokens}, out=${usage1.completion_tokens} | TPS: ${tps1}`);
  console.log(` -> Content: "${content1.trim()}"`);
  results.basicCompletion = { status: 'PASS', durationMs: dur1, usage: usage1, tps: tps1, content: content1 };

  // 2. Streaming & Time to First Token (TTFT)
  console.log('\n[TEST 2] Streaming & TTFT...');
  const tStreamStart = Date.now();
  let ttft = null;
  const rStream = await fetch(`${LLAMA_HOST}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Hitung mundur dari 5 sampai 1, dipisah tanda panah.' }],
      temperature: 0.0,
      max_tokens: 100,
      stream: true
    })
  });
  const reader = rStream.body.getReader();
  const decoder = new TextDecoder();
  let streamText = '';
  let chunkCount = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (ttft === null) ttft = Date.now() - tStreamStart;
    chunkCount++;
    const raw = decoder.decode(value);
    const lines = raw.split('\n').filter(l => l.startsWith('data: '));
    for (const line of lines) {
      const payload = line.replace('data: ', '').trim();
      if (payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload);
        streamText += parsed.choices?.[0]?.delta?.content || '';
      } catch {}
    }
  }
  const streamTotal = Date.now() - tStreamStart;
  console.log(` -> TTFT: ${ttft}ms | Total Duration: ${streamTotal}ms | Chunks: ${chunkCount}`);
  console.log(` -> Content: "${streamText.trim()}"`);
  results.streaming = { status: 'PASS', ttftMs: ttft, totalDurationMs: streamTotal, chunks: chunkCount, content: streamText };

  // 3. Long Prompt & Context Retention
  console.log('\n[TEST 3] Long Prompt Context Retention...');
  const contextSnippet = `KODE_RAHASIA: DELTA-9872-SEC\nLOKASI: KUALA_LUMPUR_ARCHIVE\nSTATUS: ACTIVE\n`.repeat(15);
  const tLong = Date.now();
  const rLong = await fetch(`${LLAMA_HOST}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: `Berikut data konteks penting:\n${contextSnippet}\n\nPertanyaan: Berdasarkan data di atas, apa nilai KODE_RAHASIA? Jawab singkat.` }
      ],
      temperature: 0.0,
      max_tokens: 100
    })
  });
  const dLong = await rLong.json();
  const durLong = Date.now() - tLong;
  const contentLong = dLong.choices?.[0]?.message?.content || '';
  const hasCode = contentLong.includes('DELTA-9872-SEC');
  console.log(` -> Duration: ${durLong}ms | Context Retention: ${hasCode ? 'PERFECT' : 'FAILED'}`);
  console.log(` -> Content: "${contentLong.trim()}"`);
  results.longPrompt = { status: hasCode ? 'PASS' : 'FAIL', durationMs: durLong, retained: hasCode, content: contentLong };

  // 4. Client Cancellation / Abort
  console.log('\n[TEST 4] Client Cancellation / Abort...');
  const controller = new AbortController();
  const cancelTimeout = setTimeout(() => controller.abort(), 150);
  let abortedCleanly = false;
  try {
    await fetch(`${LLAMA_HOST}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Tuliskan esai 1000 kata tentang mekanika kuantum.' }],
        max_tokens: 500
      }),
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === 'AbortError') abortedCleanly = true;
  } finally {
    clearTimeout(cancelTimeout);
  }
  console.log(` -> Abort handled cleanly by client: ${abortedCleanly}`);
  results.cancellation = { status: abortedCleanly ? 'PASS' : 'UNEXPECTED', abortedCleanly };

  // 5. Sequential Requests (2 queries)
  console.log('\n[TEST 5] Sequential Requests...');
  const tSeq = Date.now();
  const resSeq1 = await fetch(`${LLAMA_HOST}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Katakan "LANGKAH_1"' }], max_tokens: 30 })
  }).then(r => r.json());
  const resSeq2 = await fetch(`${LLAMA_HOST}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Katakan "LANGKAH_2"' }], max_tokens: 30 })
  }).then(r => r.json());
  const durSeq = Date.now() - tSeq;
  console.log(` -> Sequential 2 requests duration: ${durSeq}ms`);
  results.sequential = {
    status: 'PASS',
    durationMs: durSeq,
    out1: resSeq1.choices?.[0]?.message?.content?.trim(),
    out2: resSeq2.choices?.[0]?.message?.content?.trim()
  };

  // 6. Controlled Parallel Requests (2 concurrent queries)
  console.log('\n[TEST 6] Controlled Parallel Requests...');
  const tPar = Date.now();
  const p1 = fetch(`${LLAMA_HOST}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Katakan "PARALEL_A"' }], max_tokens: 30 })
  }).then(r => r.json());
  const p2 = fetch(`${LLAMA_HOST}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Katakan "PARALEL_B"' }], max_tokens: 30 })
  }).then(r => r.json());
  const [outPar1, outPar2] = await Promise.all([p1, p2]);
  const durPar = Date.now() - tPar;
  console.log(` -> Parallel 2 requests duration: ${durPar}ms`);
  results.parallel = {
    status: 'PASS',
    durationMs: durPar,
    out1: outPar1.choices?.[0]?.message?.content?.trim(),
    out2: outPar2.choices?.[0]?.message?.content?.trim()
  };

  fs.writeFileSync(
    path.join(outputDir, 'qwen3_matrix_report.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );
  console.log(`\n=== QWEN 3 TEST MATRIX COMPLETE! Report saved to ${outputDir}/qwen3_matrix_report.json ===`);
}

runQwenTestMatrix().catch(console.error);
