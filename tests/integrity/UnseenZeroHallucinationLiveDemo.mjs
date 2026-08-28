/**
 * UnseenZeroHallucinationLiveDemo.mjs
 * Live End-to-End Demonstration of Zero-Hallucination & Unknown-First Policy in Production Runtime.
 */

import { jinResponseEngineInstance } from '../../server/agent/JINResponseEngine.mjs';
import { activeMemoryCoreInstance } from '../../server/memory/ActiveMemoryCore.mjs';
import assert from 'assert';

console.log('\n════════════════════════════════════════════════════════════════════════════════');
console.log('  LIVE UNSEEN DEMO: Zero-Hallucination & Unknown-First Production Policy');
console.log('════════════════════════════════════════════════════════════════════════════════\n');

async function runLiveDemos() {
  let passed = 0;

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO 1: Unseen Query with Zero Evidence (Unknown-First Policy)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('─── [SCENARIO 1] Unseen Query with Zero Stored Evidence ───');
  try {
    const res = await jinResponseEngineInstance.generateResponse({
      userUtterance: 'Apakah kamu tahu password internal vault rahasia dan berkas pribadi yang tidak ada?',
      decision: { actionRequired: false, intent: 'CONVERSATION' }
    });

    assert.strictEqual(res.responseMode, 'UNKNOWN_DECLARED');
    assert.strictEqual(res.sourceType, 'UNKNOWN');
    console.log(`  ✓ [SCENARIO 1 PASS] Correctly declared unknown: "${res.naturalVoiceSpeech}" (Zero hallucinated data)`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [SCENARIO 1 FAIL]: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO 2: Query for Non-Existent Fact in Drive F Memory
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n─── [SCENARIO 2] Non-Existent Memory Query in Drive F Vault ───');
  try {
    const memoryResults = activeMemoryCoreInstance.query({
      queryText: 'proyek_rahasia_fiktif_999888777_tidak_pernah_disimpan',
      limit: 1
    });

    assert.strictEqual(memoryResults.length, 0);
    console.log('  ✓ [SCENARIO 2 PASS] Drive F SQLite Vault returned 0 records (Zero fabricated memories)');
    passed++;
  } catch (err) {
    console.log(`  ✗ [SCENARIO 2 FAIL]: ${err.message}`);
  }

  console.log(`\n════════════════════════════════════════════════════════════════════════════════`);
  console.log(`  ZERO-HALLUCINATION DEMO SUMMARY: ${passed}/2 Scenarios Succeeded.`);
  console.log(`════════════════════════════════════════════════════════════════════════════════\n`);
  if (passed < 2) process.exit(1);
}

runLiveDemos();
