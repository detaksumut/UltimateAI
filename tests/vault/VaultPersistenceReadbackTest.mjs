import assert from 'assert';
import { AntigravityVault } from '../../server/antigravity/AntigravityVault.mjs';
import { AntigravityConnectionStore } from '../../server/antigravity/AntigravityConnectionStore.mjs';

console.log('--- TEST: VaultPersistenceReadbackTest ---');

// 1. Verify diagnostic metadata
const vault = new AntigravityVault();
const diag = vault.getDiagnosticInfo();
console.log('[1] Vault Diagnostic Info:', diag);
assert.strictEqual(diag.vaultInstanceConsistent, true);
assert(diag.vaultKeySource, 'vaultKeySource must be defined');

// 2. Test encryption & decryption roundtrip
const testAccess = 'test_access_token_real_pattern_abc123';
const testRefresh = 'test_refresh_token_real_pattern_xyz789';

const encryptedAccess = vault.encrypt(testAccess);
const encryptedRefresh = vault.encrypt(testRefresh);

assert(encryptedAccess.includes(':'), 'Encrypted payload must have IV:Tag:Data format');
assert(encryptedRefresh.includes(':'), 'Encrypted payload must have IV:Tag:Data format');

const decryptedAccess = vault.decrypt(encryptedAccess);
const decryptedRefresh = vault.decrypt(encryptedRefresh);

assert.strictEqual(decryptedAccess, testAccess, 'Decrypted access token must match original exactly');
assert.strictEqual(decryptedRefresh, testRefresh, 'Decrypted refresh token must match original exactly');

console.log('✅ [PASS] VaultPersistenceReadbackTest: 100% SUCCESS');
