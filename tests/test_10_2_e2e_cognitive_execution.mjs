/**
 * test_10_2_e2e_cognitive_execution.mjs
 * ────────────────────────────────────────────────────────────────────────
 * TEST 10.2 — Real End-to-End Cognitive Execution
 *
 * Verifies live through LocalRouterServer HTTP port 20200:
 *
 * JALUR A: Real Research Request (Cognitive Loop)
 * User: "Carikan berita terbaru tentang teknologi AI, rangkum 3 sumber, dan berikan sumbernya."
 * Expected Chain:
 *   Intent Gate -> AgentRuntime -> Research Task -> web.search -> ToolGovernor
 *   -> Evidence -> Observer -> Verifier -> Final Response -> SSE Stream
 *
 * JALUR B: Casual Chat (Zero-Regression)
 * User: "Halo JIN, apa kabar hari ini?"
 * Expected:
 *   Intent Gate -> actionRequired: false -> Direct LLM Stream (Fast path)
 * ────────────────────────────────────────────────────────────────────────
 */

const ROUTER_ENDPOINT = 'http://127.0.0.1:20200/v1/chat/completions';

async function sendChatRequest(prompt, stream = true, model = 'auto') {
  const res = await fetch(ROUTER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullText = '';
  let agentMeta = null;
  let sseChunksCount = 0;
  let doneReceived = false;
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const dataStr = trimmed.replace(/^data:\s*/, '').trim();

      if (dataStr === '[DONE]') {
        doneReceived = true;
        continue;
      }

      try {
        const parsed = JSON.parse(dataStr);
        sseChunksCount++;

        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) fullText += delta;

        if (parsed._agent) {
          agentMeta = parsed._agent;
        }
      } catch (e) {
        // ignore incomplete JSON
      }
    }
  }

  return {
    fullText,
    agentMeta,
    sseChunksCount,
    doneReceived
  };
}

async function runTest10_2() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  TEST 10.2 — REAL END-TO-END COGNITIVE EXECUTION HARNESS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let passCount = 0;
  let totalCount = 0;

  function assert(title, condition, details = '') {
    totalCount++;
    if (condition) {
      passCount++;
      console.log(`  [PASS] ${title} ${details ? '(' + details + ')' : ''}`);
    } else {
      console.error(`  [FAIL] ${title} ${details ? '--> ' + details : ''}`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SUITE 1: COGNITIVE EXECUTION (Agentic Path)
  // ─────────────────────────────────────────────────────────────
  console.log('>>> RUNNING SUITE 1: REAL RESEARCH TASK (Cognitive Loop)...');
  const cognitivePrompt = 'Carikan berita terbaru tentang teknologi AI, rangkum 3 sumber, dan berikan sumbernya.';
  console.log(`Prompt: "${cognitivePrompt}"\nExecuting via HTTP :20200...\n`);

  const t0 = Date.now();
  try {
    const result = await sendChatRequest(cognitivePrompt, true);
    const duration = Date.now() - t0;

    console.log(`\nExecution finished in ${duration}ms.`);
    console.log(`SSE Chunks Received: ${result.sseChunksCount}`);
    console.log(`Response length: ${result.fullText.length} characters`);
    console.log(`Done signal received: ${result.doneReceived}`);
    console.log(`Agent Metadata:`, JSON.stringify(result.agentMeta, null, 2));

    console.log('\n--- RESPONSE PREVIEW ---');
    console.log(result.fullText.slice(0, 400) + (result.fullText.length > 400 ? '...' : ''));
    console.log('------------------------\n');

    assert('Cognitive: HTTP Stream closed with [DONE]', result.doneReceived === true);
    assert('Cognitive: Response is non-empty', result.fullText.trim().length > 50, `${result.fullText.trim().length} chars`);
    assert('Cognitive: Agent metadata was emitted in SSE', result.agentMeta !== null && result.agentMeta.cognitive === true);
    assert('Cognitive: Intent Gate correctly identified agentic intent', Boolean(result.agentMeta?.intent), `intent=${result.agentMeta?.intent}`);
    assert('Cognitive: Tool governance registered tool execution', Array.isArray(result.agentMeta?.toolsUsed), `tools=[${(result.agentMeta?.toolsUsed || []).join(', ')}]`);
  } catch (err) {
    console.error('[TEST 10.2 SUITE 1 ERROR]', err);
    assert('Cognitive: Request executed without network error', false, err.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SUITE 2: CASUAL CHAT (Zero-Regression Fast Path)
  // ─────────────────────────────────────────────────────────────
  console.log('\n>>> RUNNING SUITE 2: CASUAL CHAT (Zero-Regression Fast Path)...');
  const casualPrompt = 'Halo JIN, apa kabar hari ini?';
  console.log(`Prompt: "${casualPrompt}"\nExecuting via HTTP :20200...\n`);

  const t1 = Date.now();
  try {
    const resultCasual = await sendChatRequest(casualPrompt, true);
    const durCasual = Date.now() - t1;

    console.log(`\nCasual chat finished in ${durCasual}ms.`);
    console.log(`SSE Chunks Received: ${resultCasual.sseChunksCount}`);
    console.log(`Response length: ${resultCasual.fullText.length} characters`);
    console.log(`Agent Metadata:`, resultCasual.agentMeta);

    assert('Casual: HTTP Stream completed with [DONE]', resultCasual.doneReceived === true);
    assert('Casual: Response is non-empty', resultCasual.fullText.trim().length > 10, `${resultCasual.fullText.trim().length} chars`);
    assert('Casual: Zero-regression - bypassed AgentRuntime', resultCasual.agentMeta === null, 'No _agent metadata injected, direct LLM');
  } catch (err) {
    console.error('[TEST 10.2 SUITE 2 ERROR]', err);
    assert('Casual: Request executed without network error', false, err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  TEST 10.2 RESULTS: ${passCount}/${totalCount} PASS`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (passCount === totalCount) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTest10_2();
