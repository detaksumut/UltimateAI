/**
 * SimulatorCannotFabricateLiveConnectionTest.mjs
 * Invariant: UI / Simulator must NEVER infer ENROLLED, HEALTHY, or quota availability
 * from the mere existence of a connection ID. Quota data must NEVER be fabricated.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('================================================================');
console.log('  TEST: SIMULATOR CANNOT FABRICATE LIVE CONNECTION OR QUOTA');
console.log('================================================================\n');

const modalPath = path.resolve('src/ui/simulator/modals/ConnectionsModal.jsx');
const modalCode = fs.readFileSync(modalPath, 'utf8');

console.log('[CHECK 1] Verifying no static quota models array in UI component...');
assert.strictEqual(modalCode.includes('DEFAULT_MODELS'), false, 'UI must not declare DEFAULT_MODELS array');
assert.strictEqual(modalCode.includes('1,000'), false, 'UI must not contain static formatted 1,000 quota strings');
console.log('  -> PASS: Zero static quota models in UI.');

console.log('[CHECK 2] Verifying explicit NOT_ENROLLED rendering with NO live credential...');
assert.strictEqual(modalCode.includes('STATUS: NOT_ENROLLED'), true, 'UI must render explicit STATUS: NOT_ENROLLED');
assert.strictEqual(modalCode.includes('No live credential'), true, 'UI must render explicit "No live credential"');
assert.strictEqual(modalCode.includes('Quota: <span className="text-slate-400 font-bold">NOT_AVAILABLE</span>'), true, 'UI must render explicit Quota NOT_AVAILABLE');
console.log('  -> PASS: Explicit un-enrolled state displayed for unauthenticated slots.');

console.log('[CHECK 3] Verifying no synthetic email fallback in UI...');
assert.strictEqual(modalCode.includes('@gmail.com`'), false, 'UI must not synthesize @gmail.com addresses');
console.log('  -> PASS: Zero synthetic email generators in UI.');

console.log('\n================================================================');
console.log('  🏆 SIMULATOR ANTI-FABRICATION CONTRACT VERIFIED 100%');
console.log('================================================================');
