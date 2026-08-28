/**
 * SyntheticCredentialRejectedTest.mjs
 * Invariant: ConnectionStore must detect and REJECT any synthetic mock / fixture credential
 * patterns from being loaded into production runtime as valid connections.
 */

import assert from 'assert';
import { AntigravityConnectionStore } from '../../server/antigravity/AntigravityConnectionStore.mjs';
import { AntigravityVault } from '../../server/antigravity/AntigravityVault.mjs';

console.log('================================================================');
console.log('  TEST: SYNTHETIC CREDENTIAL REJECTION FROM RUNTIME');
console.log('================================================================\n');

const vault = new AntigravityVault();
const store = new AntigravityConnectionStore(vault);

console.log('[CHECK 1] Testing isSyntheticOrFixtureCredential pattern detector...');
const syntheticSamples = [
  'valid_oauth_access_token_ag-01',
  'valid_oauth_refresh_token_ag-01',
  'refreshed_access_token_12345',
  'test_secret_key_mock',
  'ya29.auth_token_ag-02',
  '1//refresh_token_ag-02',
  'mock_google_token',
  'dummy_token_xyz',
  'fake_token_abc'
];

for (const sample of syntheticSamples) {
  const isSynthetic = AntigravityConnectionStore.isSyntheticOrFixtureCredential(sample);
  assert.strictEqual(isSynthetic, true, `Pattern "${sample}" must be recognized as synthetic/fixture`);
}
console.log('  -> PASS: All synthetic credential patterns correctly identified.');

console.log('[CHECK 2] Testing genuine OAuth token acceptance...');
const authenticSamples = [
  'ya29.a0ARrdaM8Z3b...authentic_google_token_sample',
  '1//04_authentic_google_refresh_token_sample'
];

for (const sample of authenticSamples) {
  const isSynthetic = AntigravityConnectionStore.isSyntheticOrFixtureCredential(sample);
  assert.strictEqual(isSynthetic, false, `Authentic pattern "${sample}" must NOT be flagged as synthetic`);
}
console.log('  -> PASS: Authentic OAuth token format allowed.');

console.log('\n================================================================');
console.log('  🏆 SYNTHETIC CREDENTIAL REJECTION INVARIANT VERIFIED 100%');
console.log('================================================================');
