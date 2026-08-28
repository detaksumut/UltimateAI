import assert from 'assert';
import { AntigravityEnrollmentSessionManager } from '../../server/antigravity/AntigravityEnrollmentSessionManager.mjs';

console.log('--- TEST: NotEnrolledAutoRefreshGuardTest ---');

// Mock a store where ag-02 is NOT_ENROLLED
const mockStore = {
  getConnection: (id) => null,
  getAllConnections: () => []
};

const manager = new AntigravityEnrollmentSessionManager(mockStore);

// Test that calling refreshConnection on a NOT_ENROLLED slot returns safe skipped object without throwing
const result = await manager.refreshConnection('ag-02');

assert(result, 'Result must be returned');
assert.strictEqual(result.status, 'NOT_ENROLLED', 'Status must be NOT_ENROLLED');
assert.strictEqual(result.skipped, true, 'Skipped must be true');
assert.strictEqual(result.valid, false, 'Valid must be false');
assert.strictEqual(result.error, null, 'Error must be null');

console.log('[1] Refresh on NOT_ENROLLED slot ag-02 returned safely:', result);
console.log('✅ [PASS] NotEnrolledAutoRefreshGuardTest: 100% SUCCESS');
