/**
 * enrollAccount.mjs
 * CLI runner for Antigravity OAuth enrollment and configuration diagnostic.
 * 
 * Usage:
 *   node server/antigravity/enrollAccount.mjs --validate-config
 *   node server/antigravity/enrollAccount.mjs ag-01
 */

import { AntigravityOAuthEnrollment } from './AntigravityOAuthEnrollment.mjs';

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--validate-config') || args.includes('-v')) {
    console.log('================================================================');
    console.log('  ANTIGRAVITY OAUTH CONFIGURATION DIAGNOSTIC');
    console.log('================================================================\n');

    const config = AntigravityOAuthEnrollment.validateOAuthClientConfig(process.env);

    console.log('OAuth Configuration Diagnostic');
    console.log('------------------------------');
    console.log(`clientIdPresent:      ${config.clientIdPresent}`);
    console.log(`clientIdFormatValid:  ${config.clientIdFormatValid}`);
    console.log(`clientSecretPresent:  ${config.clientSecretPresent}`);
    console.log(`redirectMode:         ${config.redirectMode}`);
    console.log(`scopesConfigured:     ${config.scopesConfigured}`);

    if (config.valid) {
      console.log(`controlPlaneEndpoint: ${config.controlPlaneEndpoint}`);
      console.log(`\n🟢 Status: VALID CONFIGURATION DETECTED (Ready for enrollment).`);
      console.log('================================================================\n');
      process.exit(0);
    } else {
      console.log(`\n❌ Status: ${config.error}`);
      console.log(`   Message: ${config.message}`);
      console.log('\nPowerShell Configuration Guide:');
      console.log('  $env:ANTIGRAVITY_OAUTH_CLIENT_ID="<your-google-oauth-client-id>.apps.googleusercontent.com"');
      console.log('  # If client secret is required:');
      console.log('  $env:ANTIGRAVITY_OAUTH_CLIENT_SECRET="<your-client-secret>"');
      console.log('================================================================\n');
      process.exit(1);
    }
  }

  const targetId = args[0] || 'ag-01';
  const alias = `antigravity-${targetId.replace('ag-', '')}`;

  const enrollment = new AntigravityOAuthEnrollment();

  try {
    await enrollment.executeInteractiveEnrollment({
      connectionId: targetId,
      accountAlias: alias,
      label: `Antigravity Account ${targetId.toUpperCase()}`
    });
  } catch (err) {
    console.error(`\n❌ Enrollment Failed: ${err.message}`);
    process.exit(1);
  }
}

main();
