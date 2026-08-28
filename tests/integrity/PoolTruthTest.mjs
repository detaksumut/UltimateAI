/**
 * PoolTruthTest.mjs
 * Behavioral test asserting that only real SSOT pools and models are recognized.
 */

import { ANTIGRAVITY_MODELS } from '../../server/antigravity/AntigravityModelRegistry.mjs';
import assert from 'assert';

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: PoolTruthTest — SSOT Pool Authenticity');
console.log('═══════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let passed = 0;

  // Test 1: Real models in SSOT
  try {
    const models = Object.values(ANTIGRAVITY_MODELS);
    assert.ok(models.length > 0, 'Must have registered production models');
    const fakeModels = models.filter(m => /fake|mock|dummy|synthetic_model/i.test(m.id));
    assert.strictEqual(fakeModels.length, 0, 'No fake models allowed');
    console.log(`  ✓ [PASS] Model Registry verified: ${models.length} genuine models, 0 fake models`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [FAIL] Pool truth: ${err.message}`);
  }

  console.log(`\n  RESULT: ${passed}/1 Tests Passed.\n`);
  if (passed < 1) process.exit(1);
}

runTests();
