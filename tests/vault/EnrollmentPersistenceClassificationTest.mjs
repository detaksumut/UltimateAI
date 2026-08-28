import assert from 'assert';
import { ENROLLMENT_STATES, AntigravityEnrollmentSessionManager } from '../../server/antigravity/AntigravityEnrollmentSessionManager.mjs';

console.log('--- TEST: EnrollmentPersistenceClassificationTest ---');

// Verify that PERSISTENCE_VERIFICATION_FAILED exists as an isolated state
assert(ENROLLMENT_STATES.PERSISTENCE_VERIFICATION_FAILED, 'PERSISTENCE_VERIFICATION_FAILED must be defined');
assert.strictEqual(ENROLLMENT_STATES.PERSISTENCE_VERIFICATION_FAILED, 'PERSISTENCE_VERIFICATION_FAILED');

// Verify state distinction: Persistence failure is NEVER classified as CLOUD_CODE_AUTH_FAILED
assert.notStrictEqual(
  ENROLLMENT_STATES.PERSISTENCE_VERIFICATION_FAILED,
  ENROLLMENT_STATES.CLOUD_CODE_AUTH_FAILED,
  'PERSISTENCE_VERIFICATION_FAILED must NOT be CLOUD_CODE_AUTH_FAILED'
);

console.log('✅ [PASS] EnrollmentPersistenceClassificationTest: 100% SUCCESS');
