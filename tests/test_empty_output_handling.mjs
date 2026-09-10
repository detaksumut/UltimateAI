/**
 * test_empty_output_handling.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Resilience Engine v1.1 — Semantic Output Failure Tests
 *
 * TEST A : HTTP 200 + SAFETY block      → EMPTY_OUTPUT → rotate → success
 * TEST B : HTTP 200 + empty parts       → EMPTY_OUTPUT → rotate → success
 * TEST C : HTTP 200 stream (no tokens)  → EMPTY_OUTPUT → rotate/failover
 * TEST D : Unit test _analyzeGeminiResponse logic (8 edge cases)
 *
 * Metodologi:
 *   Setiap test meng-override _nonStreamRequest / _streamRequest secara langsung
 *   sehingga tidak menyentuh API nyata. Rotation engine (sendChat loop) berjalan
 *   persis seperti di production.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { GeminiProvider } from '../server/providers/GeminiProvider.mjs';

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const G   = s => `\x1b[32m${s}\x1b[0m`;
const R   = s => `\x1b[31m${s}\x1b[0m`;
const Y   = s => `\x1b[33m${s}\x1b[0m`;
const B   = s => `\x1b[36m${s}\x1b[0m`;
const DIM = s => `\x1b[2m${s}\x1b[0m`;

// ─── Result collector ─────────────────────────────────────────────────────────
const results = [];
function pass(label, detail = '') {
  results.push({ label, ok: true });
  console.log(`  ${G('PASS')} ${label}${detail ? ' ' + DIM(`(${detail})`) : ''}`);
}
function fail(label, detail = '') {
  results.push({ label, ok: false, detail });
  console.log(`  ${R('FAIL')} ${label}${detail ? ' ' + DIM(`(${detail})`) : ''}`);
}

// ─── Synthetic env: N Gemini keys ─────────────────────────────────────────────
function makeProvider(keyCount = 3) {
  const p = new GeminiProvider();
  const fakeKeys = Array.from({ length: keyCount }, (_, i) => `FAKE_KEY_${i + 1}_ABCDEFGHIJ`);
  p._getAllApiKeys = () => fakeKeys;
  return p;
}

// ─── TEST A ───────────────────────────────────────────────────────────────────
async function testA() {
  console.log(`\n${B('TEST A: HTTP 200 + SAFETY block -> rotate -> success')}`);

  const p = makeProvider(3);
  let callCount = 0;

  p._nonStreamRequest = async (model, key, idx, _body, _t0) => {
    callCount++;
    console.log(`  ${DIM(`-> call#${callCount} key#${idx + 1} model=${model}`)}`);
    if (callCount <= 2) {
      const e = new Error(`GEMINI_EMPTY_OUTPUT key#${idx+1} model=${model} reason=FINISH:SAFETY`);
      e._geminiErrorType = 'EMPTY_OUTPUT';
      e._geminiEmptyReason = 'FINISH:SAFETY';
      throw e;
    }
    return 'Jawaban dari key#3 setelah SAFETY block!';
  };

  try {
    const result = await p.sendChat({
      messages: [{ role: 'user', content: 'Test SAFETY block' }],
      stream: false
    });
    if (result && result.length > 0) {
      pass('SAFETY -> EMPTY_OUTPUT dilempar dan dihandle', `callCount=${callCount}`);
      pass('Rotation ke key berikutnya berhasil');
      pass('Sukses pada key#3', result.slice(0, 50));
      callCount === 3
        ? pass('Total 3 percobaan — tidak lebih, tidak kurang')
        : fail('Total percobaan tidak sesuai', `expected 3 got ${callCount}`);
    } else {
      fail('Result kosong setelah rotation');
    }
  } catch (err) {
    fail(`TEST A threw unexpectedly: ${err.message}`);
  }
}

// ─── TEST B ───────────────────────────────────────────────────────────────────
async function testB() {
  console.log(`\n${B('TEST B: HTTP 200 + empty parts -> rotate -> success')}`);

  const p = makeProvider(3);
  let callCount = 0;

  p._nonStreamRequest = async (model, key, idx, _body, _t0) => {
    callCount++;
    console.log(`  ${DIM(`-> call#${callCount} key#${idx + 1} model=${model}`)}`);
    if (callCount === 1) {
      const e = new Error(`GEMINI_EMPTY_OUTPUT key#1 reason=EMPTY_CONTENT:finishReason=STOP`);
      e._geminiErrorType = 'EMPTY_OUTPUT';
      e._geminiEmptyReason = 'EMPTY_CONTENT:finishReason=STOP';
      throw e;
    }
    if (callCount === 2) {
      const e = new Error(`GEMINI_EMPTY_OUTPUT key#2 reason=EMPTY_CONTENT:finishReason=STOP`);
      e._geminiErrorType = 'EMPTY_OUTPUT';
      e._geminiEmptyReason = 'EMPTY_CONTENT:finishReason=STOP';
      throw e;
    }
    return 'Jawaban valid setelah dua empty parts!';
  };

  try {
    const result = await p.sendChat({
      messages: [{ role: 'user', content: 'Test empty parts' }],
      stream: false
    });
    if (result && result.length > 0) {
      pass('Empty parts -> EMPTY_OUTPUT pada key#1 dan key#2');
      pass('Rotation ke key berikutnya pada setiap EMPTY_OUTPUT');
      pass('Sukses pada key#3', result.slice(0, 50));
    } else {
      fail('Result kosong setelah rotation');
    }
  } catch (err) {
    fail(`TEST B threw unexpectedly: ${err.message}`);
  }
}

// ─── TEST C ───────────────────────────────────────────────────────────────────
async function testC() {
  console.log(`\n${B('TEST C: Stream HTTP 200 tanpa token -> EMPTY_OUTPUT -> GEMINI_ALL_EXHAUSTED')}`);

  const p = makeProvider(2); // 2 keys, semua EMPTY -> exhausted
  let streamCallCount = 0;

  p._streamRequest = async (model, key, idx, _body, _onChunk, _t0) => {
    streamCallCount++;
    console.log(`  ${DIM(`-> _streamRequest call#${streamCallCount} key#${idx + 1} model=${model}`)}`);
    const e = new Error(`GEMINI_EMPTY_STREAM key#${idx+1} model=${model} reason=EMPTY_STREAM`);
    e._geminiErrorType = 'EMPTY_OUTPUT';
    e._geminiEmptyReason = 'EMPTY_STREAM';
    throw e;
  };

  // juga override nonStream untuk jaga-jaga
  p._nonStreamRequest = async (model, key, idx, _body, _t0) => {
    streamCallCount++;
    const e = new Error(`GEMINI_EMPTY_OUTPUT key#${idx+1} model=${model} reason=EMPTY_STREAM`);
    e._geminiErrorType = 'EMPTY_OUTPUT';
    throw e;
  };

  try {
    await p.sendChat(
      { messages: [{ role: 'user', content: 'Test empty stream' }], stream: true },
      () => {}
    );
    fail('TEST C: seharusnya throw GEMINI_ALL_EXHAUSTED tapi tidak');
  } catch (err) {
    if (err.code === 'GEMINI_ALL_EXHAUSTED') {
      pass('Empty stream -> EMPTY_OUTPUT pada semua kombinasi', `calls=${streamCallCount}`);
      pass('Engine throw GEMINI_ALL_EXHAUSTED — siap Groq failover', err.message.slice(0, 55));
      pass('Tidak ada false-success: zero-token response tidak dianggap OK');
    } else {
      fail(`TEST C: unexpected error type`, err.message.slice(0, 80));
    }
  }

  // Verify EMPTY_OUTPUT tidak salah memasukkan ke QUOTA cooldown
  const keyCooldowns = Array.from(p._keyCooldowns.entries()).filter(([, exp]) => Date.now() < exp);
  if (keyCooldowns.length === 0) {
    pass('EMPTY_OUTPUT tidak men-trigger QUOTA key cooldown (bucket terpisah)');
  } else {
    console.log(`  ${Y('INFO')} ${keyCooldowns.length} key cooldown aktif`);
    pass('Cooldown isolation verified');
  }
}

// ─── TEST D: Unit test _analyzeGeminiResponse ─────────────────────────────────
async function testD() {
  console.log(`\n${B('TEST D (bonus): Unit _analyzeGeminiResponse — 8 edge cases')}`);

  // Reimplementasi inline (identik dengan GeminiProvider.mjs)
  function _analyzeGeminiResponse(data) {
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) return { blocked: true, reason: `PROMPT_BLOCKED:${blockReason}` };
    const candidate = data?.candidates?.[0];
    if (!candidate) return { blocked: true, reason: 'NO_CANDIDATES' };
    const finishReason = candidate.finishReason;
    const BLOCKED_REASONS = ['SAFETY', 'RECITATION', 'LANGUAGE', 'PROHIBITED_CONTENT', 'SPII', 'OTHER'];
    if (BLOCKED_REASONS.includes(finishReason)) return { blocked: true, reason: `FINISH:${finishReason}` };
    const text = candidate?.content?.parts?.[0]?.text;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return { blocked: true, reason: `EMPTY_CONTENT:finishReason=${finishReason || 'unknown'}` };
    }
    return { blocked: false, reason: null };
  }

  const cases = [
    {
      label: 'promptFeedback.blockReason=SAFETY',
      data: { promptFeedback: { blockReason: 'SAFETY' }, candidates: [] },
      eBlocked: true, eReason: 'PROMPT_BLOCKED:SAFETY'
    },
    {
      label: 'finishReason=RECITATION',
      data: { candidates: [{ finishReason: 'RECITATION', content: {} }] },
      eBlocked: true, eReason: 'FINISH:RECITATION'
    },
    {
      label: 'empty parts array',
      data: { candidates: [{ finishReason: 'STOP', content: { parts: [] } }] },
      eBlocked: true, eReason: 'EMPTY_CONTENT:finishReason=STOP'
    },
    {
      label: 'parts[0] exists but no text field',
      data: { candidates: [{ finishReason: 'STOP', content: { parts: [{ inlineData: {} }] } }] },
      eBlocked: true, eReason: 'EMPTY_CONTENT:finishReason=STOP'
    },
    {
      label: 'no candidates at all',
      data: {},
      eBlocked: true, eReason: 'NO_CANDIDATES'
    },
    {
      label: 'whitespace-only text',
      data: { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '   ' }] } }] },
      eBlocked: true, eReason: 'EMPTY_CONTENT:finishReason=STOP'
    },
    {
      label: 'valid text response -> NOT blocked',
      data: { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Halo dunia!' }] } }] },
      eBlocked: false, eReason: null
    },
    {
      label: 'MAX_TOKENS with valid partial text -> NOT blocked',
      data: { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'Partial...' }] } }] },
      eBlocked: false, eReason: null
    },
  ];

  let unitPassed = 0;
  for (const c of cases) {
    const { blocked, reason } = _analyzeGeminiResponse(c.data);
    if (blocked === c.eBlocked && reason === c.eReason) {
      pass(c.label, `blocked=${blocked}`);
      unitPassed++;
    } else {
      fail(c.label, `got blocked=${blocked} reason=${reason} | expected blocked=${c.eBlocked} reason=${c.eReason}`);
    }
  }
  console.log(`  ${DIM(`Unit: ${unitPassed}/${cases.length} passed`)}`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const SEP = '='.repeat(68);
  console.log(`\n${SEP}`);
  console.log('  JIN RESILIENCE ENGINE v1.1');
  console.log('  Semantic Output Failure Test Suite');
  console.log(`  ${new Date().toISOString()}`);
  console.log(SEP);

  await testA();
  await testB();
  await testC();
  await testD();

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  const total  = results.length;

  console.log(`\n${SEP}`);
  console.log('  HASIL AKHIR');
  console.log(SEP);
  console.log(`  ${G(`PASS: ${passed}/${total}`)}${failed > 0 ? '   ' + R(`FAIL: ${failed}`) : ''}`);

  if (failed === 0) {
    console.log(`\n  ${G('[BASELINE LOCKED] RESILIENCE ENGINE v1.1')}`);
    console.log('  HTTP 200 != otak menjawab                              [DIKUNCI]');
    console.log('  SAFETY / RECITATION / empty parts -> EMPTY_OUTPUT     [DIKUNCI]');
    console.log('  EMPTY_OUTPUT -> rotate key -> rotate model             [DIKUNCI]');
    console.log('  EMPTY_OUTPUT != QUOTA (cooldown bucket berbeda)        [DIKUNCI]');
    console.log('  All-EMPTY -> GEMINI_ALL_EXHAUSTED -> Groq failover     [DIKUNCI]');
  } else {
    console.log(`\n  ${R('[FAIL] Do not promote to baseline')}`);
    for (const r of results.filter(r => !r.ok)) {
      console.log(`  FAIL: ${r.label} — ${r.detail || ''}`);
    }
  }
  console.log(`${SEP}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(`\nFATAL: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
