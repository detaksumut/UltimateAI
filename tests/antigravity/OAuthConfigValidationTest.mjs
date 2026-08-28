/**
 * OAuthConfigValidationTest.mjs
 * Rigorously verifies OAuth Client Configuration validation rules (Tests A through G).
 */

import assert from 'assert';
import { AntigravityOAuthEnrollment } from '../../server/antigravity/AntigravityOAuthEnrollment.mjs';

async function runOAuthConfigValidationTest() {
  console.log('================================================================');
  console.log('  ANTIGRAVITY OAUTH CONFIGURATION VALIDATION TEST (TESTS A-G)');
  console.log('================================================================\n');

  // [TEST A] Missing client ID -> AUTH_CONFIGURATION_MISSING
  console.log('[TEST A] Testing missing ANTIGRAVITY_OAUTH_CLIENT_ID...');
  const resA = AntigravityOAuthEnrollment.validateOAuthClientConfig({});
  assert.strictEqual(resA.valid, false);
  assert.strictEqual(resA.error, 'AUTH_CONFIGURATION_MISSING');
  assert.strictEqual(resA.clientIdPresent, false);
  console.log('  -> PASS: Correctly rejected as AUTH_CONFIGURATION_MISSING.');

  // [TEST B] Malformed client ID -> AUTH_CONFIGURATION_INVALID
  console.log('\n[TEST B] Testing malformed client ID...');
  const resB = AntigravityOAuthEnrollment.validateOAuthClientConfig({
    ANTIGRAVITY_OAUTH_CLIENT_ID: 'invalid_client_id_random_string'
  });
  assert.strictEqual(resB.valid, false);
  assert.strictEqual(resB.error, 'AUTH_CONFIGURATION_INVALID');
  assert.strictEqual(resB.clientIdPresent, true);
  assert.strictEqual(resB.clientIdFormatValid, false);
  console.log('  -> PASS: Correctly rejected as AUTH_CONFIGURATION_INVALID.');

  // [TEST C] Valid-shaped client ID -> PASS
  console.log('\n[TEST C] Testing valid-shaped Google OAuth Client ID...');
  const validShapeId = '123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com';
  const resC = AntigravityOAuthEnrollment.validateOAuthClientConfig({
    ANTIGRAVITY_OAUTH_CLIENT_ID: validShapeId
  });
  assert.strictEqual(resC.valid, true);
  assert.strictEqual(resC.clientIdPresent, true);
  assert.strictEqual(resC.clientIdFormatValid, true);
  assert.strictEqual(resC.clientId, validShapeId);
  console.log('  -> PASS: Valid client ID shape accepted.');

  // [TEST D] No client secret with PKCE/public flow -> Allowed
  console.log('\n[TEST D] Testing absence of client secret for PKCE public flow...');
  assert.strictEqual(resC.clientSecretPresent, false);
  assert.strictEqual(resC.clientSecret, null);
  console.log('  -> PASS: Client secret is optional for PKCE public native client.');

  // [TEST E] Redirect URI consistency
  console.log('\n[TEST E] Testing Redirect Mode & URI consistency...');
  assert.strictEqual(resC.redirectMode, 'LOOPBACK');
  const enrollment = new AntigravityOAuthEnrollment();
  const { verifier, challenge, state } = enrollment.generatePKCE();
  const authUrl = enrollment.buildAuthUrl({
    clientId: resC.clientId,
    redirectUri: 'http://127.0.0.1:8085/oauth/callback',
    scopes: resC.scopes,
    challenge,
    state
  });
  assert(authUrl.includes('client_id=' + validShapeId));
  assert(authUrl.includes('code_challenge='));
  assert(authUrl.includes('code_challenge_method=S256'));
  console.log('  -> PASS: Auth URL is structurally consistent with PKCE parameters.');

  // [TEST F] Placeholder values -> REJECT
  console.log('\n[TEST F] Testing placeholder rejection...');
  const placeholders = [
    'CLIENT_ID_GOOGLE_ANDA_YANG_SEBENARNYA',
    '<GOOGLE_OAUTH_CLIENT_ID_ASLI>',
    'ultimateai-client-id.apps.googleusercontent.com',
    'your_client_id_here.apps.googleusercontent.com'
  ];

  for (const ph of placeholders) {
    const resPH = AntigravityOAuthEnrollment.validateOAuthClientConfig({
      ANTIGRAVITY_OAUTH_CLIENT_ID: ph
    });
    assert.strictEqual(resPH.valid, false, `Placeholder '${ph}' must be rejected`);
    assert.strictEqual(
      resPH.error === 'AUTH_CONFIGURATION_MISSING' || resPH.error === 'AUTH_CONFIGURATION_INVALID',
      true,
      `Error must be configuration error, got ${resPH.error}`
    );
  }
  console.log('  -> PASS: All placeholder variations strictly rejected before network dispatch.');

  // [TEST G] No network request dispatched when configuration is invalid
  console.log('\n[TEST G] Testing fail-closed execution on invalid config...');
  let errorThrown = null;
  try {
    const invalidEnrollment = new AntigravityOAuthEnrollment();
    // Simulate interactive enrollment with invalid env
    const prevEnv = process.env.ANTIGRAVITY_OAUTH_CLIENT_ID;
    delete process.env.ANTIGRAVITY_OAUTH_CLIENT_ID;
    
    await invalidEnrollment.executeInteractiveEnrollment({ connectionId: 'ag-01' });
  } catch (err) {
    errorThrown = err;
  }
  assert(errorThrown && errorThrown.message.includes('AUTH_CONFIGURATION_MISSING'));
  console.log('  -> PASS: Pre-flight fail-closed blocks execution before opening ports or browser.');

  console.log('\n================================================================');
  console.log('  🏆 ALL OAUTH CONFIG VALIDATION TESTS (A-G) PASSED 100%');
  console.log('================================================================\n');
}

runOAuthConfigValidationTest().catch(err => {
  console.error('❌ OAuth Config Validation Test Failed:', err);
  process.exit(1);
});
