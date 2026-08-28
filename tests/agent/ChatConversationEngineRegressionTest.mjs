import assert from 'assert';
import { conversationEngineInstance } from '../../src/services/conversation/ConversationEngine.js';

console.log('========================================================================');
console.log('  TEST: ChatConversationEngineRegressionTest — Zero ReferenceError & Live Chat');
console.log('========================================================================\n');

async function testConversationEngine() {
  const engine = conversationEngineInstance;
  engine.clearHistory();

  // ----------------------------------------------------------------------
  // TEST 1: buildPayload Execution Without ReferenceError
  // ----------------------------------------------------------------------
  console.log('[1] Testing buildPayload("Halo JIN")...');
  engine.addMessage('user', 'Halo JIN');
  const payload1 = engine.buildPayload('Halo JIN');

  assert(payload1, 'Payload must not be null');
  assert(Array.isArray(payload1.messages), 'Messages must be an array');
  assert(payload1.messages.length >= 2, 'Must contain system prompt and user message');
  
  const lastMsg = payload1.messages[payload1.messages.length - 1];
  assert.strictEqual(lastMsg.role, 'user');
  assert.strictEqual(lastMsg.content, 'Halo JIN');
  console.log('  ✓ buildPayload executed cleanly (Zero ReferenceError).');

  // ----------------------------------------------------------------------
  // TEST 2: Live Chat Execution: "Halo JIN"
  // ----------------------------------------------------------------------
  console.log('\n[2] Executing Live Chat: "Halo JIN"...');
  const response1 = await fetch('http://127.0.0.1:20200/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemini-3.6-flash-high',
      messages: payload1.messages,
      stream: false
    })
  });

  assert(response1.ok, `HTTP Status must be 200, got ${response1.status}`);
  const data1 = await response1.json();
  const reply1 = data1.choices?.[0]?.message?.content || '';
  console.log(`  JIN Reply: "${reply1.substring(0, 100)}..."`);
  assert(reply1.length > 0, 'JIN must provide a real response');

  // Record assistant response
  engine.addMessage('assistant', reply1);

  // ----------------------------------------------------------------------
  // TEST 3: Live Current Information Query: "Cari berita hari ini terkait UU Perampasan Aset"
  // ----------------------------------------------------------------------
  const searchPrompt = 'Cari berita hari ini terkait UU Perampasan Aset';
  console.log(`\n[3] Testing Complex Search Query: "${searchPrompt}"...`);
  
  engine.addMessage('user', searchPrompt);
  const payload2 = engine.buildPayload(searchPrompt);
  
  assert.strictEqual(payload2.intent, 'GLOBAL_SEARCH', 'Intent detection must identify search intent');
  console.log('  ✓ Detected Intent:', payload2.intent);

  const response2 = await fetch('http://127.0.0.1:20200/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemini-3.6-flash-high',
      messages: payload2.messages,
      stream: false
    })
  });

  assert(response2.ok, `HTTP Status must be 200, got ${response2.status}`);
  const data2 = await response2.json();
  const reply2 = data2.choices?.[0]?.message?.content || '';
  console.log(`  JIN Search Reply: "${reply2.substring(0, 140)}..."`);
  assert(reply2.length > 0, 'Must produce non-empty search-augmented response');

  console.log('\n========================================================================');
  console.log('  ✅ [PASS] ChatConversationEngineRegressionTest: 100% SUCCESS');
  console.log('========================================================================\n');
}

testConversationEngine().catch(err => {
  console.error('❌ [FAIL] ChatConversationEngineRegressionTest:', err);
  process.exit(1);
});
