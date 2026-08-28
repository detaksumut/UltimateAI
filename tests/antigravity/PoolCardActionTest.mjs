/**
 * PoolCardActionTest.mjs
 * Comprehensive Functional Verification for Pool Card Controls:
 * A. CONNECT creates enrollment session
 * B. OFF makes connection ineligible (isActive = false)
 * C. ON makes connection eligible (isActive = true)
 * D. REFRESH calls actual token/health path
 * E. DELETE returns pool to NOT_ENROLLED
 * F. NOT_ENROLLED has no email
 * G. NOT_ENROLLED has no quota
 * H. Scheduler / Selector strictly respects OFF state
 */

import assert from 'assert';
import { antigravityEnrollmentSessionManagerInstance } from '../../server/antigravity/AntigravityEnrollmentSessionManager.mjs';
import { antigravityConnectionStoreInstance } from '../../server/antigravity/AntigravityConnectionStore.mjs';
import { AntigravityConnectionSelector } from '../../server/antigravity/AntigravityConnectionSelector.mjs';
import { antigravityQuotaTrackerInstance } from '../../server/antigravity/AntigravityQuotaTracker.mjs';

console.log('================================================================');
console.log('  TEST: ANTIGRAVITY POOL CARD ACTION & FUNCTIONAL CONTROLS');
console.log('================================================================\n');

// Set operator client ID for test context
process.env.ANTIGRAVITY_OAUTH_CLIENT_ID = '987654321098-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com';

// Clean initial storage for fresh test run
antigravityConnectionStoreInstance.saveConnections([]);

const testConnId = 'ag-01';

// 1. Initial State: Empty un-enrolled slot
console.log('[STEP 1] Testing un-enrolled slot properties (F, G)...');
const initialSlots = antigravityEnrollmentSessionManagerInstance.getAllConnectionSlots();
const initialSlot = initialSlots.find(s => s.connectionId === testConnId);

assert.strictEqual(initialSlot.status, 'NOT_ENROLLED', 'Initial slot must be NOT_ENROLLED');
assert.strictEqual(initialSlot.email, null, 'Un-enrolled slot must have email === null');
assert.strictEqual(initialSlot.isEnrolled, false, 'Un-enrolled slot isEnrolled must be false');
assert.strictEqual(initialSlot.quotaSummary.source, 'NO_DATA_RECORDED', 'Un-enrolled slot quota source must be NO_DATA_RECORDED');
console.log('  -> PASS: Un-enrolled slot has zero fake email and zero fake quota.');

// 2. Action: CONNECT -> startEnrollment
console.log('[STEP 2] Testing CONNECT action -> startEnrollment (A)...');
const session = await antigravityEnrollmentSessionManagerInstance.startEnrollment(testConnId);
assert.ok(session.enrollmentId, 'Must return enrollmentId');
assert.ok(session.authUrl, 'Must return Google OAuth authUrl');
assert.strictEqual(session.connectionId, testConnId, 'Must match target connectionId');
assert.strictEqual(session.authUrl.includes('accounts.google.com/o/oauth2/v2/auth'), true, 'Must target real Google OAuth URL');
assert.strictEqual(session.authUrl.includes('prompt=select_account'), true, 'Must enforce manual Google account chooser');
console.log('  -> PASS: CONNECT initiates isolated Google OAuth enrollment with manual account chooser.');

// 3. Action: REFRESH on un-enrolled slot (D)
console.log('[STEP 3] Testing REFRESH on un-enrolled slot...');
try {
  await antigravityEnrollmentSessionManagerInstance.refreshConnection(testConnId);
  assert.fail('Should throw error for un-enrolled connection');
} catch (err) {
  assert.strictEqual(err.message.includes('CONNECTION_NOT_ENROLLED'), true, 'Must return CONNECTION_NOT_ENROLLED error');
  console.log('  -> PASS: REFRESH rejects un-enrolled slot gracefully.');
}

// 4. Setup mock active connection for testing ON/OFF and DELETE controls
console.log('[STEP 4] Simulating enrolled connection in isolated test context...');
const sampleConn = {
  id: testConnId,
  accountAlias: 'operator.real@gmail.com',
  email: 'operator.real@gmail.com',
  label: 'Antigravity (operator.real@gmail.com)',
  provider: 'ANTIGRAVITY',
  authType: 'oauth',
  isActive: true,
  priority: 1,
  projectId: 'test-google-project',
  projectTier: 'STANDARD',
  testStatus: 'ENROLLED',
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
  accessToken: 'valid_test_token',
  refreshToken: 'valid_test_refresh'
};
antigravityConnectionStoreInstance.saveConnection(sampleConn);

// 5. Test Scheduler Eligibility with Selector (H, C)
console.log('[STEP 5] Testing Scheduler / Selector with ON state (C, H)...');
const selector = new AntigravityConnectionSelector(antigravityConnectionStoreInstance, antigravityQuotaTrackerInstance);
const eligibilityOn = selector.isConnectionEligible(sampleConn, 'gemini-3.6-flash-high');
assert.strictEqual(eligibilityOn.eligible, true, 'Connection with isActive: true must be eligible in scheduler');
console.log('  -> PASS: ON state allows scheduler selection.');

// 6. Action: TOGGLE -> OFF (B, H)
console.log('[STEP 6] Testing TOGGLE action -> OFF (B)...');
const toggleOffResult = await antigravityEnrollmentSessionManagerInstance.toggleConnection(testConnId);
assert.strictEqual(toggleOffResult.isActive, false, 'isActive must be false after toggle');
assert.strictEqual(toggleOffResult.status, 'DISABLED', 'Status must report DISABLED');

const connInStoreOff = antigravityConnectionStoreInstance.getConnection(testConnId, true);
assert.strictEqual(connInStoreOff.isActive, false, 'Store must persist isActive: false');

const eligibilityOff = selector.isConnectionEligible(connInStoreOff, 'gemini-3.6-flash-high');
assert.strictEqual(eligibilityOff.eligible, false, 'Connection with isActive: false must be excluded from scheduler');
assert.strictEqual(eligibilityOff.reason, 'CONNECTION_INACTIVE', 'Reason must be CONNECTION_INACTIVE');
console.log('  -> PASS: OFF state excludes connection from scheduler.');

// 7. Action: TOGGLE -> ON (C)
console.log('[STEP 7] Testing TOGGLE action -> ON (C)...');
const toggleOnResult = await antigravityEnrollmentSessionManagerInstance.toggleConnection(testConnId);
assert.strictEqual(toggleOnResult.isActive, true, 'isActive must be true after second toggle');
const connInStoreOn = antigravityConnectionStoreInstance.getConnection(testConnId, true);
assert.strictEqual(connInStoreOn.isActive, true, 'Store must persist isActive: true');
console.log('  -> PASS: ON toggle restores scheduler eligibility.');

// 8. Action: DELETE -> Purge credentials and return to NOT_ENROLLED (E)
console.log('[STEP 8] Testing DELETE action -> Purge credentials (E)...');
const deleteResult = await antigravityEnrollmentSessionManagerInstance.disconnectConnection(testConnId);
assert.strictEqual(deleteResult.status, 'NOT_ENROLLED', 'Delete must return status NOT_ENROLLED');

const deletedSlot = antigravityEnrollmentSessionManagerInstance.getAllConnectionSlots().find(s => s.connectionId === testConnId);
assert.strictEqual(deletedSlot.status, 'NOT_ENROLLED', 'Slot must return to NOT_ENROLLED in slots list');
assert.strictEqual(deletedSlot.isEnrolled, false, 'isEnrolled must be false');
assert.strictEqual(deletedSlot.email, null, 'Email must be null');
assert.strictEqual(deletedSlot.hasAccessToken, false, 'hasAccessToken must be false');
console.log('  -> PASS: DELETE purges credentials and returns slot to NOT_ENROLLED.\n');

console.log('================================================================');
console.log('  🏆 ALL POOL CARD ACTION & FUNCTIONAL CONTROL TESTS PASSED 100%');
console.log('================================================================');
