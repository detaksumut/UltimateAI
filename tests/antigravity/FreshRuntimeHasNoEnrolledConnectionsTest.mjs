/**
 * FreshRuntimeHasNoEnrolledConnectionsTest.mjs
 * Invariant: On a fresh installation / runtime, AG-01..AG-07 must exist ONLY as empty slots:
 * - status = NOT_ENROLLED
 * - credentialPresent / hasAccessToken = false
 * - isEnrolled = false
 * - email = null
 * - quotaSource = NO_DATA_RECORDED
 */

import assert from 'assert';
import { antigravityEnrollmentSessionManagerInstance } from '../../server/antigravity/AntigravityEnrollmentSessionManager.mjs';

console.log('================================================================');
console.log('  TEST: FRESH RUNTIME HAS NO ENROLLED CONNECTIONS');
console.log('================================================================\n');

const slots = antigravityEnrollmentSessionManagerInstance.getAllConnectionSlots();

assert.strictEqual(Array.isArray(slots), true, 'Slots must be an array');
assert.strictEqual(slots.length, 7, 'Must have exactly 7 slots');

for (let i = 1; i <= 7; i++) {
  const connId = `ag-0${i}`;
  const slot = slots.find(s => s.connectionId === connId);
  assert.ok(slot, `Slot ${connId} must exist`);

  console.log(`[SLOT ${connId.toUpperCase()}] Checking initial fresh runtime state...`);
  assert.strictEqual(slot.status, 'NOT_ENROLLED', `Fresh slot ${connId} must be NOT_ENROLLED`);
  assert.strictEqual(slot.isEnrolled, false, `Fresh slot ${connId} isEnrolled must be false`);
  assert.strictEqual(slot.hasAccessToken, false, `Fresh slot ${connId} hasAccessToken must be false`);
  assert.strictEqual(slot.hasRefreshToken, false, `Fresh slot ${connId} hasRefreshToken must be false`);
  assert.strictEqual(slot.email, null, `Fresh slot ${connId} email must be null`);
  assert.strictEqual(slot.quotaSummary.source, 'NO_DATA_RECORDED', `Fresh slot ${connId} quota source must be NO_DATA_RECORDED`);
  console.log(`  -> PASS: ${connId.toUpperCase()} is an empty un-enrolled slot.`);
}

console.log('\n================================================================');
console.log('  🏆 FRESH RUNTIME ZERO-FABRICATION INVARIANT VERIFIED 100%');
console.log('================================================================');
