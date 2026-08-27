/**
 * StorageIsolationTest.mjs
 * Rigorously asserts that running tests and in-memory stores NEVER creates or mutates storage/antigravity_connections.json.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { spawnSync } from 'child_process';

async function runStorageIsolationTest() {
  console.log('================================================================');
  console.log('  TEST STORAGE ISOLATION INTEGRITY VERIFICATION');
  console.log('================================================================\n');

  const prodStoragePath = path.resolve('storage/antigravity_connections.json');
  const existsBefore = fs.existsSync(prodStoragePath);
  const mtimeBefore = existsBefore ? fs.statSync(prodStoragePath).mtimeMs : null;

  console.log(`[CHECK 1] Production storage exists before test: ${existsBefore}`);

  // Run RolloverCertificationHarness
  console.log('[CHECK 2] Running RolloverCertificationHarness...');
  const res1 = spawnSync('node', ['tests/antigravity/RolloverCertificationHarness.mjs'], { encoding: 'utf8' });
  assert.strictEqual(res1.status, 0, `RolloverCertificationHarness failed: ${res1.stderr}`);

  // Run VaultAndStoreTest
  console.log('[CHECK 3] Running VaultAndStoreTest...');
  const res2 = spawnSync('node', ['tests/antigravity/VaultAndStoreTest.mjs'], { encoding: 'utf8' });
  assert.strictEqual(res2.status, 0, `VaultAndStoreTest failed: ${res2.stderr}`);

  const existsAfter = fs.existsSync(prodStoragePath);
  const mtimeAfter = existsAfter ? fs.statSync(prodStoragePath).mtimeMs : null;

  if (!existsBefore) {
    assert.strictEqual(existsAfter, false, 'VIOLATION: Test run created storage/antigravity_connections.json in production storage directory!');
  } else {
    assert.strictEqual(mtimeBefore, mtimeAfter, 'VIOLATION: Test run mutated storage/antigravity_connections.json in production storage directory!');
  }

  console.log('\n  -> PASS: Production storage file remained 100% untouched and unpolluted.');
  console.log('================================================================');
  console.log('  🏆 STORAGE ISOLATION TEST PASSED 100%');
  console.log('================================================================\n');
}

runStorageIsolationTest().catch(err => {
  console.error('❌ Storage Isolation Failed:', err);
  process.exit(1);
});
