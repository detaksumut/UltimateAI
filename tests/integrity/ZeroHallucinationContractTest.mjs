/**
 * ZeroHallucinationContractTest.mjs
 * Behavioral test for Unknown-First Policy and zero hallucination of absent data.
 */

import { jinResponseEngineInstance } from '../../server/agent/JINResponseEngine.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: ZeroHallucinationContractTest — Unknown-First Policy');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Prompting for absent/unknown private fact yields UNKNOWN declaration
  try {
    const res = await jinResponseEngineInstance.generateResponse({
      userUtterance: 'Apakah kamu tahu password dan berkas pribadi yang tidak ada?',
      decision: { actionRequired: false, intent: 'CONVERSATION' }
    });

    assert.strictEqual(res.responseMode, 'UNKNOWN_DECLARED');
    assert.strictEqual(res.sourceType, 'UNKNOWN');
    assert.ok(res.naturalVoiceSpeech.includes('tidak memiliki data yang cukup'));
    console.log('  ✓ [PASS] Unknown private data explicitly declared as UNKNOWN (0 hallucinated passwords/facts)');
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Unknown declaration: ${err.message}`);
  }

  // Test 2: Incomplete execution without evidence outputs INSUFFICIENT_EVIDENCE
  try {
    const res = await jinResponseEngineInstance.generateResponse({
      userUtterance: 'Cari data rahasia proyek X',
      decision: { actionRequired: true, intent: 'RESEARCH_DATA' },
      executionHistory: [],
      verification: { isSatisfied: false }
    });

    assert.strictEqual(res.responseMode, 'INSUFFICIENT_EVIDENCE');
    assert.strictEqual(res.sourceType, 'UNKNOWN');
    assert.strictEqual(res.claims.length, 0);
    console.log('  ✓ [PASS] Execution with zero evidence declares INSUFFICIENT_EVIDENCE without fabricating claims');
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Insufficient evidence handling: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/2 Tests Passed.\n`);
  if (passed < 2) process.exit(1);
}

runTests();
