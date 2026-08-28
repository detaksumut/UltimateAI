import assert from 'assert';
import { AntigravityVault } from '../../server/antigravity/AntigravityVault.mjs';
import { AntigravityConnectionStore } from '../../server/antigravity/AntigravityConnectionStore.mjs';

console.log('--- TEST: VaultRestartPersistenceTest ---');

// Instance 1: Before restart
const store1 = new AntigravityConnectionStore();
const conn1 = store1.getConnection('ag-01', false);

assert(conn1, 'AG-01 must exist in store');
assert(conn1.accessToken, 'AG-01 must have decrypted accessToken');
assert(conn1.refreshToken, 'AG-01 must have decrypted refreshToken');
assert.strictEqual(conn1.email, 'hasibuanparida1@gmail.com');

console.log('[1] Pre-restart read successful for AG-01:', {
  id: conn1.id,
  email: conn1.email,
  isActive: conn1.isActive,
  hasAccessToken: Boolean(conn1.accessToken),
  hasRefreshToken: Boolean(conn1.refreshToken)
});

// Instance 2: Simulated process restart (New Store and New Vault instance)
const store2 = new AntigravityConnectionStore(new AntigravityVault());
const conn2 = store2.getConnection('ag-01', false);

assert(conn2, 'AG-01 must exist in new store instance after restart');
assert.strictEqual(conn2.accessToken, conn1.accessToken, 'Access token across restarts must match');
assert.strictEqual(conn2.refreshToken, conn1.refreshToken, 'Refresh token across restarts must match');
assert.strictEqual(conn2.email, 'hasibuanparida1@gmail.com');

console.log('[2] Post-restart read successful for AG-01:', {
  id: conn2.id,
  email: conn2.email,
  isActive: conn2.isActive,
  hasAccessToken: Boolean(conn2.accessToken),
  hasRefreshToken: Boolean(conn2.refreshToken)
});

console.log('✅ [PASS] VaultRestartPersistenceTest: 100% SUCCESS');
