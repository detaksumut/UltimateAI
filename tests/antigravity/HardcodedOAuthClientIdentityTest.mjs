/**
 * HardcodedOAuthClientIdentityTest.mjs
 * Strict Verification: Zero Hardcoded / Inferred OAuth Client IDs in Production Flow.
 * 
 * Invariants:
 * 1. ANTIGRAVITY_OAUTH_CLIENT_ID must come ONLY from explicit operator configuration.
 * 2. If missing, must fail-closed with AUTH_CONFIGURATION_MISSING.
 * 3. Diagnostic reports only clientIdPresent: true/false and clientIdSource: OPERATOR_CONFIGURED / MISSING.
 * 4. Production Antigravity enrollment source code contains ZERO literal hardcoded client IDs.
 * 5. Never substitutes or infers third-party client IDs (Cloud SDK, VS Code, Gemini, 9Router).
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { AntigravityOAuthEnrollment } from '../../server/antigravity/AntigravityOAuthEnrollment.mjs';

console.log('================================================================');
console.log('  TEST: ZERO HARDCODED OAUTH CLIENT IDENTITY IN PRODUCTION');
console.log('================================================================\n');

// 1. Static AST/Source Code Audit: Production enrollment must contain NO literal Google client IDs
console.log('[CHECK 1] Scanning production enrollment sources for hardcoded Google client IDs...');

const filesToScan = [
  path.join(process.cwd(), 'server', 'antigravity', 'AntigravityOAuthEnrollment.mjs'),
  path.join(process.cwd(), 'server', 'antigravity', 'AntigravityEnrollmentSessionManager.mjs'),
  path.join(process.cwd(), 'server', 'antigravity', 'AntigravityConnectionStore.mjs'),
  path.join(process.cwd(), 'server', 'antigravity', 'enrollAccount.mjs'),
  path.join(process.cwd(), 'src', 'ui', 'simulator', 'modals', 'ConnectionsModal.jsx')
];

const literalClientIdPattern = /[0-9]{8,}-[a-z0-9_.-]+\.apps\.googleusercontent\.com/i;

for (const filePath of filesToScan) {
  if (!fs.existsSync(filePath)) continue;
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(literalClientIdPattern);
  assert.strictEqual(
    match,
    null,
    `VIOLATION: Found hardcoded Google OAuth Client ID '${match?.[0]}' in ${path.basename(filePath)}!`
  );
}
console.log('  -> PASS: Zero hardcoded client IDs found in production enrollment sources.');

// 2. Behavioral Check: Missing Client ID must return AUTH_CONFIGURATION_MISSING
console.log('\n[CHECK 2] Verifying fail-closed behavior when operator has not configured Client ID...');
const missingConfig = AntigravityOAuthEnrollment.validateOAuthClientConfig({});
assert.strictEqual(missingConfig.valid, false, 'Config must be invalid when missing');
assert.strictEqual(missingConfig.error, 'AUTH_CONFIGURATION_MISSING', 'Error must be AUTH_CONFIGURATION_MISSING');
assert.strictEqual(missingConfig.clientIdPresent, false, 'clientIdPresent must be false');
assert.strictEqual(missingConfig.clientIdSource, 'MISSING', 'clientIdSource must be MISSING');
assert.strictEqual(missingConfig.clientId, null, 'clientId must be null');
console.log('  -> PASS: Unconfigured environment cleanly returns AUTH_CONFIGURATION_MISSING.');

// 3. Behavioral Check: Operator-supplied Client ID is strictly accepted and attributed
console.log('\n[CHECK 3] Verifying explicit operator-configured Client ID acceptance...');
const operatorProvidedId = '987654321098-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com';
const operatorConfig = AntigravityOAuthEnrollment.validateOAuthClientConfig({
  ANTIGRAVITY_OAUTH_CLIENT_ID: operatorProvidedId
});

assert.strictEqual(operatorConfig.valid, true, 'Config must be valid for operator-provided ID');
assert.strictEqual(operatorConfig.clientId, operatorProvidedId, 'Must use exact operator-provided client ID');
assert.strictEqual(operatorConfig.clientIdPresent, true, 'clientIdPresent must be true');
assert.strictEqual(operatorConfig.clientIdSource, 'OPERATOR_CONFIGURED', 'clientIdSource must be OPERATOR_CONFIGURED');
console.log('  -> PASS: Operator-configured client ID used verbatim without substitution.');

// 4. Placeholder values must be rejected as missing
console.log('\n[CHECK 4] Verifying rejection of placeholders without substituting third-party IDs...');
const placeholderConfig = AntigravityOAuthEnrollment.validateOAuthClientConfig({
  ANTIGRAVITY_OAUTH_CLIENT_ID: 'your_client_id_here'
});
assert.strictEqual(placeholderConfig.valid, false, 'Placeholder must be rejected');
assert.strictEqual(placeholderConfig.error, 'AUTH_CONFIGURATION_MISSING', 'Placeholder must trigger AUTH_CONFIGURATION_MISSING');
assert.strictEqual(placeholderConfig.clientIdPresent, false, 'clientIdPresent must be false');
console.log('  -> PASS: Placeholders rejected; zero third-party substitution performed.\n');

console.log('================================================================');
console.log('  🏆 HARDCODED OAUTH CLIENT IDENTITY TEST PASSED 100%');
console.log('================================================================');
