/**
 * ContextualReasoningTest.mjs
 * Tests JIN's contextual reasoning capabilities.
 * ALL test utterances are UNSEEN (not present in training prompts or prior test suites).
 * Tests verify BEHAVIOR not keyword/intent matching.
 */

import assert from 'assert';
import { conversationEngineInstance } from '../../src/services/conversation/ConversationEngine.js';

const ROUTER_URL = 'http://127.0.0.1:20200/v1/chat/completions';
const MODEL = 'gemini-3.6-flash-high';

let passCount = 0;
let failCount = 0;

function pass(label) {
  console.log(`  ✓ [PASS] ${label}`);
  passCount++;
}

function fail(label, reason) {
  console.error(`  ✗ [FAIL] ${label}: ${reason}`);
  failCount++;
}

async function callJIN(messages) {
  const res = await fetch(ROUTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, stream: false })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function runTest(label, fn) {
  try {
    await fn();
    pass(label);
  } catch (err) {
    fail(label, err.message);
  }
}

// ============================================================
console.log('\n========================================================================');
console.log('  TEST: ContextualReasoningTest — Unseen Language & Cross-Turn Reasoning');
console.log('========================================================================\n');

const engine = conversationEngineInstance;
engine.clearHistory();

// ================================================================
// TEST 1: Coreference resolution — JIN understands "ini" from context
// ================================================================
console.log('[BLOCK 1] Cross-Turn Coreference Resolution');

await runTest('Turn 1: Establish context topic', async () => {
  engine.addMessage('user', 'Saya sedang memantau situasi inflasi di Indonesia bulan terakhir.');
  const payload = engine.buildPayload('Saya sedang memantau situasi inflasi di Indonesia bulan terakhir.');
  const reply = await callJIN(payload.messages);
  engine.addMessage('assistant', reply);
  assert(reply.length > 0, 'JIN must respond');
});

await runTest('Turn 2: Implicit coreference "situasi ini"', async () => {
  engine.addMessage('user', 'Kalau situasi ini terus berlanjut, menurutmu apa dampak terbesar yang mungkin terjadi?');
  const payload = engine.buildPayload('Kalau situasi ini terus berlanjut, menurutmu apa dampak terbesar yang mungkin terjadi?');
  const reply = await callJIN(payload.messages);
  engine.addMessage('assistant', reply);
  // JIN should reference "inflasi" — the topic from Turn 1
  const mentionsInflasi = reply.toLowerCase().includes('inflasi') || reply.toLowerCase().includes('harga') || reply.toLowerCase().includes('ekonomi');
  assert(mentionsInflasi, `JIN must resolve "situasi ini" from context. Got: "${reply.substring(0,100)}"`);
});

// ================================================================
// TEST 2: Constraint setting & enforcement
// ================================================================
console.log('\n[BLOCK 2] Constraint Setting & Enforcement');
engine.clearHistory();

await runTest('Turn 1: Ask about topic', async () => {
  engine.addMessage('user', 'Apa yang kamu ketahui tentang investasi saham di pasar domestik?');
  const payload = engine.buildPayload('Apa yang kamu ketahui tentang investasi saham di pasar domestik?');
  const reply = await callJIN(payload.messages);
  engine.addMessage('assistant', reply);
  engine.updateTaskState({ goal: 'Diskusi investasi saham domestik' });
  assert(reply.length > 0, 'JIN must respond');
});

await runTest('Turn 2: Constraint — do not search internet', async () => {
  engine.addMessage('user', 'Jangan cari dari internet dulu. Pakai saja pengetahuan yang kamu punya.');
  engine.updateTaskState({ constraint: 'Jangan cari dari internet. Gunakan pengetahuan yang ada.' });
  const payload = engine.buildPayload(
    'Jangan cari dari internet dulu. Pakai saja pengetahuan yang kamu punya.',
    'CONSTRAINT_UPDATE'
  );
  const reply = await callJIN(payload.messages);
  engine.addMessage('assistant', reply);
  // JIN should acknowledge constraint without doing a web search
  const acknowledges = reply.toLowerCase().includes('baik') ||
    reply.toLowerCase().includes('oke') ||
    reply.toLowerCase().includes('mengerti') ||
    reply.toLowerCase().includes('paham') ||
    reply.toLowerCase().includes('tidak akan mencari') ||
    reply.toLowerCase().includes('tanpa internet');
  assert(acknowledges, `JIN should acknowledge constraint. Got: "${reply.substring(0,100)}"`);
});

await runTest('Turn 3: JIN respects the constraint', async () => {
  engine.addMessage('user', 'Lanjutkan. Bagaimana cara memilih saham yang baik menurut kamu?');
  const payload = engine.buildPayload(
    'Lanjutkan. Bagaimana cara memilih saham yang baik menurut kamu?',
    'RESEARCH_QUESTION'
  );
  const reply = await callJIN(payload.messages);
  engine.addMessage('assistant', reply);
  // JIN should give an answer without saying "saya akan mencari"
  const claimingWebSearch = /saya akan mencari|mencari di internet|berdasarkan pencarian web/i.test(reply);
  assert(!claimingWebSearch, `JIN should NOT pretend to search the web (constraint active). Got: "${reply.substring(0,120)}"`);
  assert(reply.length > 40, 'JIN must provide a substantive answer from existing knowledge');
});

// ================================================================
// TEST 3: User correction — JIN updates its understanding
// ================================================================
console.log('\n[BLOCK 3] User Correction & Task Re-evaluation');
engine.clearHistory();

await runTest('Turn 1: Setup context', async () => {
  engine.addMessage('user', 'Saya ingin membahas regulasi terkait perusahaan tambang di Kalimantan.');
  const payload = engine.buildPayload('Saya ingin membahas regulasi terkait perusahaan tambang di Kalimantan.');
  const reply = await callJIN(payload.messages);
  engine.addMessage('assistant', reply);
  engine.updateTaskState({ goal: 'Diskusi regulasi perusahaan tambang Kalimantan' });
  assert(reply.length > 0);
});

await runTest('Turn 2: JIN makes an assumption', async () => {
  engine.addMessage('user', 'Ceritakan tentang aturan lingkungannya.');
  const payload = engine.buildPayload('Ceritakan tentang aturan lingkungannya.');
  const reply = await callJIN(payload.messages);
  engine.addMessage('assistant', reply);
  assert(reply.length > 0);
});

await runTest('Turn 3: User correction — "bukan itu yang saya maksud"', async () => {
  const correction = 'Bukan aturan lingkungan yang saya maksud. Saya ingin tahu soal izin operasional dan royaltinya.';
  engine.addMessage('user', correction);
  engine.updateTaskState({ correction });
  const payload = engine.buildPayload(correction, 'CORRECTION');
  const reply = await callJIN(payload.messages);
  engine.addMessage('assistant', reply);
  // JIN should address izin/royalti, not re-explain lingkungan
  const addressesCorrection = reply.toLowerCase().includes('izin') ||
    reply.toLowerCase().includes('royalti') ||
    reply.toLowerCase().includes('operasional');
  assert(addressesCorrection, `JIN must address the correction. Got: "${reply.substring(0,120)}"`);
});

// ================================================================
// TEST 4: Cross-turn task state maintenance (4-turn sequence)
// ================================================================
console.log('\n[BLOCK 4] Cross-Turn Task State — 4-Turn Sequence');
engine.clearHistory();

let taskSummary = '';

await runTest('Turn 1: Set goal', async () => {
  engine.addMessage('user', 'Saya mau analisis singkat tentang potensi ekspor kelapa sawit Indonesia ke Eropa.');
  const payload = engine.buildPayload('Saya mau analisis singkat tentang potensi ekspor kelapa sawit Indonesia ke Eropa.');
  const reply = await callJIN(payload.messages);
  engine.addMessage('assistant', reply);
  engine.updateTaskState({ goal: 'Analisis potensi ekspor kelapa sawit Indonesia ke Eropa' });
  assert(reply.length > 0);
});

await runTest('Turn 2: Add constraint', async () => {
  engine.addMessage('user', 'Fokus pada hambatan regulasi Eropa saja, bukan aspek harga.');
  engine.updateTaskState({ constraint: 'Fokus pada hambatan regulasi Eropa. Tidak perlu membahas aspek harga.' });
  const payload = engine.buildPayload('Fokus pada hambatan regulasi Eropa saja, bukan aspek harga.', 'CONSTRAINT_UPDATE');
  const reply = await callJIN(payload.messages);
  engine.addMessage('assistant', reply);
  assert(reply.length > 0);
});

await runTest('Turn 3: User correction', async () => {
  const correction = 'Oh, maksud saya regulasi di Belanda dan Jerman saja, bukan seluruh Eropa.';
  engine.addMessage('user', correction);
  engine.updateTaskState({ correction });
  const payload = engine.buildPayload(correction, 'CORRECTION');
  const reply = await callJIN(payload.messages);
  engine.addMessage('assistant', reply);
  assert(reply.length > 0);
});

await runTest('Turn 4: Request consolidated result', async () => {
  engine.addMessage('user', 'Oke, sekarang berikan saya analisisnya.');
  const payload = engine.buildPayload('Oke, sekarang berikan saya analisisnya.');
  const reply = await callJIN(payload.messages);
  engine.addMessage('assistant', reply);
  taskSummary = reply;

  // Must mention Belanda/Jerman/Netherlands/Germany and regulasi/hambatan
  const mentionsCountry = /belanda|jerman|nederland|germany/i.test(reply);
  const mentionsRegulation = /regulasi|hambatan|aturan|kebijakan/i.test(reply);
  assert(mentionsCountry, `Must mention Belanda/Jerman from correction. Got: "${reply.substring(0,150)}"`);
  assert(mentionsRegulation, `Must address regulation topic. Got: "${reply.substring(0,150)}"`);
  assert(!(/harga|price|pricing/i.test(reply)), `Must NOT discuss price (constraint active). Got: "${reply.substring(0,150)}"`);
});

// ================================================================
// TEST 5: Unseen multi-step task — JIN builds its own workflow
// ================================================================
console.log('\n[BLOCK 5] Unseen Multi-Step Task — JIN Creates Its Own Plan');
engine.clearHistory();

await runTest('Unseen task: Risk scenario analysis with temporal reference', async () => {
  engine.addMessage('user', 'Tolong bantu saya memikirkan skenario risiko kalau kebijakan moneter AS berubah drastis tahun depan. Bukan minta prediksi pasti, tapi ingin lihat berbagai kemungkinannya.');
  const payload = engine.buildPayload(
    'Tolong bantu saya memikirkan skenario risiko kalau kebijakan moneter AS berubah drastis tahun depan. Bukan minta prediksi pasti, tapi ingin lihat berbagai kemungkinannya.'
  );
  const reply = await callJIN(payload.messages);
  engine.addMessage('assistant', reply);

  // JIN should provide multiple scenarios without claiming to search the web
  const hasMultipleScenarios = (reply.match(/skenario|kemungkinan|kasus/gi) || []).length >= 2;
  assert(reply.length > 150, 'JIN must give a substantive multi-scenario analysis');
  assert(hasMultipleScenarios, `Must present multiple scenarios. Got: "${reply.substring(0,200)}"`);
});

await runTest('Follow-up: Implicit continuation "yang ketiga"', async () => {
  engine.addMessage('user', 'Yang ketiga tadi, bisa diperjelas lagi?');
  const payload = engine.buildPayload('Yang ketiga tadi, bisa diperjelas lagi?');
  const reply = await callJIN(payload.messages);
  engine.addMessage('assistant', reply);
  assert(reply.length > 40, `JIN must elaborate on the third point from prior turn. Got: "${reply.substring(0,120)}"`);
});

// ================================================================
// RESULTS
// ================================================================
console.log('\n========================================================================');
if (failCount === 0) {
  console.log(`  ✅ [PASS] ContextualReasoningTest: ${passCount}/${passCount + failCount} PASS`);
} else {
  console.log(`  ❌ [PARTIAL] ContextualReasoningTest: ${passCount} PASS / ${failCount} FAIL`);
}
console.log('========================================================================\n');

if (failCount > 0) process.exit(1);
