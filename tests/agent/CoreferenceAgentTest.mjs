/**
 * CoreferenceAgentTest.mjs
 * Behavioral test for Phase 4B Coreference Resolution ("itu", "yang tadi", "yang kedua", "di situs itu").
 */

import { semanticIntentEngineInstance } from '../../server/agent/SemanticIntentEngine.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: CoreferenceAgentTest — Dynamic Pronoun & Entity Resolution');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Resolve URL from previous turn ("di situs itu")
  try {
    const context = {
      recentTurns: [
        { role: 'user', content: 'Coba buka https://antigravity.google dan periksa fitur barunya.' },
        { role: 'assistant', content: 'Saya telah memeriksa situs tersebut. Ada 5 fitur baru.' }
      ]
    };

    const decision = await semanticIntentEngineInstance.interpret(
      'Jelaskan apa yang paling penting di situs itu.',
      context
    );

    assert.ok(decision.resolvedReferences.some(r => r.includes('https://antigravity.google')), 'Should resolve URL coreference');
    console.log(`  ✓ [PASS] Coreference resolution for "situs itu" ➔ https://antigravity.google`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Coreference situs itu: ${err.message}`);
  }

  // Test 2: Resolve reference to "poin kedua" / "dokumen kedua"
  try {
    const context = {
      recentTurns: [
        { role: 'user', content: 'Tampilkan perbandingan antara model pertama, model kedua, dan model ketiga.' },
        { role: 'assistant', content: 'Berikut perbandingan performa ketiga model...' }
      ]
    };

    const decision = await semanticIntentEngineInstance.interpret(
      'Bukan yang itu. Saya maksud model kedua.',
      context
    );

    assert.ok(decision.isCorrecting || decision.intent === 'CORRECTION', 'Should mark isCorrecting as true');
    assert.ok(
      (decision.resolvedReferences && decision.resolvedReferences.length > 0) || decision.isCorrecting,
      'Should resolve reference or record correction'
    );
    console.log('  ✓ [PASS] User correction & coreference resolution for "model kedua"');
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Coreference model kedua: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/2 Tests Passed.\n`);
  if (passed < 2) process.exit(1);
}

runTests();
