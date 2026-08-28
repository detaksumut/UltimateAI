import assert from 'assert';
import { AntigravityEnrollmentSessionManager } from '../../server/antigravity/AntigravityEnrollmentSessionManager.mjs';
import { AntigravityConnectionStore } from '../../server/antigravity/AntigravityConnectionStore.mjs';

console.log('--- TEST: RestartStateRehydrationTest ---');

// Simulate clean restart by instantiating fresh store and fresh manager
const store = new AntigravityConnectionStore();
const manager = new AntigravityEnrollmentSessionManager(store);

const slots = manager.getAllConnectionSlots();

assert.strictEqual(slots.length, 7, 'Must have exactly 7 slots');

const ag01 = slots.find(s => s.connectionId === 'ag-01');
assert(ag01, 'AG-01 must exist');
assert.strictEqual(ag01.isEnrolled, true, 'AG-01 must be enrolled');
assert.strictEqual(ag01.email, 'hasibuanparida1@gmail.com');
assert.strictEqual(ag01.projectId, 'BOUND');

console.log('[1] AG-01 Rehydrated perfectly:', {
  connectionId: ag01.connectionId,
  email: ag01.email,
  status: ag01.status,
  isEnrolled: ag01.isEnrolled,
  projectId: ag01.projectId
});

console.log('✅ [PASS] RestartStateRehydrationTest: 100% SUCCESS');
