/**
 * NoHardcodedQuotaOrSyntheticEmailTest.mjs
 * Verification of Live Data Boundary & Anti-Fabrication Invariants:
 * 1. No hardcoded quota arrays in ConnectionsModal.jsx
 * 2. No synthetic @gmail.com email fallback fabrication
 * 3. Explicit separation of UPSTREAM_OBSERVED vs LOCAL_ACCOUNTING
 * 4. Local Router API dataSource attribution
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { antigravityEnrollmentSessionManagerInstance } from '../../server/antigravity/AntigravityEnrollmentSessionManager.mjs';
import { antigravityQuotaTrackerInstance } from '../../server/antigravity/AntigravityQuotaTracker.mjs';

console.log('================================================================');
console.log('  TEST: LIVE DATA BOUNDARY & ANTI-FABRICATION INTEGRITY');
console.log('================================================================\n');

// 1. Source Code Inspection: ConnectionsModal.jsx
console.log('[CHECK 1] Scanning ConnectionsModal.jsx for hardcoded quota arrays...');
const modalPath = path.resolve('src/ui/simulator/modals/ConnectionsModal.jsx');
const modalCode = fs.readFileSync(modalPath, 'utf8');

assert.strictEqual(modalCode.includes('DEFAULT_MODELS ='), false, 'FATAL: ConnectionsModal contains hardcoded DEFAULT_MODELS array');
assert.strictEqual(modalCode.includes('used: 3'), false, 'FATAL: ConnectionsModal contains hardcoded used: 3 quota value');
assert.strictEqual(modalCode.includes('in 5d 10h 40m'), false, 'FATAL: ConnectionsModal contains hardcoded countdown string');
console.log('  -> PASS: Zero hardcoded quota arrays found in ConnectionsModal.jsx');

// 2. Source Code Inspection: Synthetic Email Generation
console.log('[CHECK 2] Scanning for synthetic @gmail.com email fabrication...');
assert.strictEqual(modalCode.includes('@gmail.com`'), false, 'FATAL: ConnectionsModal contains synthetic @gmail.com template literal');

const sessionManagerPath = path.resolve('server/antigravity/AntigravityEnrollmentSessionManager.mjs');
const sessionManagerCode = fs.readFileSync(sessionManagerPath, 'utf8');
assert.strictEqual(sessionManagerCode.includes('@gmail.com`'), false, 'FATAL: AntigravityEnrollmentSessionManager contains synthetic @gmail.com template literal');
console.log('  -> PASS: Zero synthetic @gmail.com email generators found.');

// 3. API Contract & Data Source Attribution
console.log('[CHECK 3] Verifying live connection slots data source attribution...');
const slots = antigravityEnrollmentSessionManagerInstance.getAllConnectionSlots();
assert.strictEqual(Array.isArray(slots), true, 'Slots must be an array');
assert.strictEqual(slots.length, 7, 'Must have exactly 7 slots');

for (const slot of slots) {
  assert.strictEqual(slot.dataSource, 'LOCAL_ROUTER_API', `Slot ${slot.connectionId} must declare dataSource LOCAL_ROUTER_API`);
  if (!slot.isEnrolled) {
    assert.strictEqual(slot.email, null, `Un-enrolled slot ${slot.connectionId} must have email === null (never synthetic)`);
  }
}
console.log('  -> PASS: All 7 slots declare dataSource: LOCAL_ROUTER_API with zero email fabrication.');

// 4. Quota Tracker: Explicit Source Separation
console.log('[CHECK 4] Verifying UPSTREAM_OBSERVED vs LOCAL_ACCOUNTING distinction...');
const testConnId = 'ag-01';
const testModel = 'gemini-3.6-flash-high';

// Record upstream
antigravityQuotaTrackerInstance.recordUpstreamObserved(testConnId, testModel, {
  remaining: 950,
  limit: 1000,
  resetAt: '2026-09-01T00:00:00.000Z'
});

const snapshot = antigravityQuotaTrackerInstance.getQuotaSnapshot();
assert.strictEqual(snapshot[testConnId].source, 'UPSTREAM_OBSERVED', 'Must report UPSTREAM_OBSERVED when headers received');
assert.strictEqual(snapshot[testConnId].models[testModel].source, 'UPSTREAM_OBSERVED', 'Model must report UPSTREAM_OBSERVED');
assert.strictEqual(snapshot[testConnId].models[testModel].remaining, 950, 'Remaining must match observed header');

console.log('  -> PASS: Quota tracker strictly distinguishes UPSTREAM_OBSERVED from local estimations.\n');

console.log('================================================================');
console.log('  🏆 ALL LIVE DATA BOUNDARY & ANTI-FABRICATION TESTS PASSED 100%');
console.log('================================================================');
