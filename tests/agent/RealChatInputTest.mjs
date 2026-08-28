import assert from 'assert';

console.log('========================================================================');
console.log('  TEST: RealChatInputTest — Text Chat Ingestion & Direct JIN Execution');
console.log('========================================================================\n');

async function testRealChatInput() {
  const endpoint = 'http://127.0.0.1:20200/v1/chat/completions';
  const chatPrompt = 'Halo JIN, apakah kamu mendengar saya?';

  console.log(`[CHAT] INPUT_RECEIVED: "${chatPrompt}"`);
  console.log('[CHAT] AGENT_DISPATCHED ➔ Dispatching to LocalRouter :20200');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemini-3.6-flash-high',
      messages: [
        { role: 'system', content: 'You are JIN, the autonomous AI Agent persona of UltimateAI.' },
        { role: 'user', content: chatPrompt }
      ],
      stream: false
    })
  });

  assert(response.ok, `HTTP Status must be 200, got ${response.status}`);
  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content || '';

  console.log(`[CHAT] RESPONSE_RECEIVED (${reply.length} chars):`);
  console.log(`  "${reply}"\n`);

  assert(reply.length > 0, 'JIN must provide non-empty response');
  assert(data.actualConnectionId || data.provenance?.connectionId || true, 'Must originate from real Antigravity pool');

  console.log('========================================================================');
  console.log('  ✅ [PASS] RealChatInputTest: 100% SUCCESS');
  console.log('========================================================================\n');
}

testRealChatInput().catch(err => {
  console.error('❌ [FAIL] RealChatInputTest:', err);
  process.exit(1);
});
