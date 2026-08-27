/**
 * enrollAccount.mjs
 * CLI runner to enroll a specific Antigravity connection (e.g. node server/antigravity/enrollAccount.mjs ag-01)
 */

import { AntigravityOAuthEnrollment } from './AntigravityOAuthEnrollment.mjs';

async function main() {
  const targetId = process.argv[2] || 'ag-01';
  const alias = `antigravity-${targetId.replace('ag-', '')}`;

  const enrollment = new AntigravityOAuthEnrollment();

  try {
    await enrollment.enrollConnection({
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
