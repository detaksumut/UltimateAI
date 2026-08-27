/**
 * VaultAndStoreTest.mjs
 * Unit Test for AntigravityVault AES-256-GCM Encryption & AntigravityConnectionStore.
 */

import assert from 'assert';
import { AntigravityVault } from '../../server/antigravity/AntigravityVault.mjs';
import { InMemoryAntigravityConnectionStore } from '../../server/antigravity/InMemoryAntigravityConnectionStore.mjs';

async function runVaultAndStoreTest() {
  console.log('--- Testing AntigravityVault Encryption & Store Security ---');

  const vault = new AntigravityVault('test_secret_key_12345');
  const store = new InMemoryAntigravityConnectionStore(vault);

  const rawToken = 'ya29.a0AfH6SMD_very_secret_oauth_token_xyz_998877';
  const encrypted = vault.encrypt(rawToken);

  assert.notStrictEqual(encrypted, rawToken, 'Encrypted token must not match plaintext');
  assert(encrypted.includes(':'), 'Encrypted payload must contain IV, AuthTag, and Ciphertext delimiters');

  const decrypted = vault.decrypt(encrypted);
  assert.strictEqual(decrypted, rawToken, 'Decrypted token must match original plaintext');
  console.log('✅ Vault Encryption & Decryption Verified.');

  // Test Store with Masking
  store.saveConnection({
    id: 'ag-01',
    label: 'Account 1',
    accessToken: rawToken,
    refreshToken: 'refresh_secret_123'
  });

  const publicRecord = store.getConnection('ag-01', false);
  assert.strictEqual(publicRecord.accessToken, undefined, 'Public record must not contain accessToken');
  assert.strictEqual(publicRecord.refreshToken, undefined, 'Public record must not contain refreshToken');
  assert.strictEqual(publicRecord.hasAccessToken, true, 'Public record indicates token presence safely');
  console.log('✅ ConnectionStore Zero-Secret Masking Verified.');

  const hydratedRecord = store.getConnection('ag-01', true);
  assert.strictEqual(hydratedRecord.accessToken, rawToken, 'Hydrated record must contain decrypted accessToken');
  assert.strictEqual(hydratedRecord.refreshToken, 'refresh_secret_123', 'Hydrated record must contain decrypted refreshToken');
  console.log('✅ ConnectionStore Secret Hydration & Decryption Verified.');

  console.log('🏆 All Vault & Store Tests Passed!\n');
}

runVaultAndStoreTest().catch(err => {
  console.error('❌ Vault Test Failed:', err);
  process.exit(1);
});
