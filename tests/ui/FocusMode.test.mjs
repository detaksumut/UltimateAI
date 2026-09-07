/**
 * FocusMode.test.mjs
 * Integrity test for the reusable JIN Focus Mode state machine.
 *
 * Guards the core contract:
 *   - NORMAL / DIM / DEEP_FOCUS are the only three states.
 *   - Multiple focus panels can be open at once (multi-tenant stacking).
 *   - The strongest demand always wins.
 *   - Closing one panel NEVER undims while another is still open.
 *   - The dashboard returns to NORMAL exactly when the LAST panel closes.
 *
 * Run: node tests/ui/FocusMode.test.mjs
 */

import {
  focusModeController,
  FOCUS_NORMAL,
  FOCUS_DIM,
  FOCUS_DEEP
} from '../../src/services/focus/focusMode.js';

let passed = 0;
let total = 0;

function assert(condition, name, details = '') {
  total++;
  if (condition) {
    console.log(`  [PASS] ${name} ${details ? `(${details})` : ''}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${name} - FAILED`);
  }
}

console.log('================================================================');
console.log(' JIN FOCUS MODE — STATE MACHINE INTEGRITY TESTS');
console.log('================================================================');

// ---------------------------------------------------------------
// 1. Default state is NORMAL
// ---------------------------------------------------------------
console.log('\n[1] Fresh controller starts at NORMAL');
assert(focusModeController.state === FOCUS_NORMAL, 'starts NORMAL');
assert(focusModeController.isActive === false, 'isActive false');

// ---------------------------------------------------------------
// 2. Single DEEP_FOCUS demand activates the background state
// ---------------------------------------------------------------
console.log('\n[2] Open a studio panel -> DEEP_FOCUS');
focusModeController.setFocus('studio', FOCUS_DEEP);
assert(focusModeController.state === FOCUS_DEEP, 'state = DEEP_FOCUS');
assert(focusModeController.isActive === true, 'isActive true');
assert(focusModeController.scopeCount === 1, 'one scope held');

// ---------------------------------------------------------------
// 3. Lighter DIM demand must NOT downgrade an active DEEP_FOCUS
// ---------------------------------------------------------------
console.log('\n[3] strongest demand wins (DEEP stays while DIM opens)');
focusModeController.setFocus('activity', FOCUS_DIM);
assert(focusModeController.state === FOCUS_DEEP, 'still DEEP_FOCUS');
assert(focusModeController.scopeCount === 2, 'two scopes held');

// ---------------------------------------------------------------
// 4. Closing one panel never undims while another remains open
// ---------------------------------------------------------------
console.log('\n[4] closing ONE panel keeps the stronger one active');
focusModeController.releaseFocus('studio');
assert(focusModeController.state === FOCUS_DIM, 'falls back to DIM');
assert(focusModeController.isActive === true, 'still in background');
assert(focusModeController.scopeCount === 1, 'one scope remains');

// ---------------------------------------------------------------
// 5. Direct NORMAL should never downgrade below the active set
//    (guard: a weak demand cannot cancel a held stronger demand)
// ---------------------------------------------------------------
console.log('\n[5] weak demand cannot cancel a held stronger demand');
focusModeController.setFocus('control', FOCUS_DEEP);
focusModeController.setFocus('studio', FOCUS_DIM); // new lighter demand
assert(focusModeController.state === FOCUS_DEEP, 'risk of downgrade blocked');

// ---------------------------------------------------------------
// 6. Dashboard returns to NORMAL exactly when LAST panel closes
// ---------------------------------------------------------------
console.log('\n[6] last panel close -> NORMAL (no reload, state restored)');
focusModeController.releaseFocus('control');
assert(focusModeController.state === FOCUS_DIM, 'two remain -> DIM');
focusModeController.releaseFocus('activity');
assert(focusModeController.state === FOCUS_DIM, 'one remains -> DIM');
focusModeController.releaseFocus('studio');
assert(focusModeController.state === FOCUS_NORMAL, 'last close -> NORMAL');
assert(focusModeController.isActive === false, 'isActive false');
assert(focusModeController.scopeCount === 0, 'no scopes held');

// ---------------------------------------------------------------
// 7. clear() empties all demands at once
// ---------------------------------------------------------------
console.log('\n[7] clear() resets everything in one shot');
focusModeController.setFocus('evidence', FOCUS_DEEP);
focusModeController.setFocus('cert', FOCUS_DEEP);
focusModeController.clear();
assert(focusModeController.state === FOCUS_NORMAL, 'after clear = NORMAL');
assert(focusModeController.scopeCount === 0, 'no scopes remain');

// ---------------------------------------------------------------
// 8. subscription notifies on every state change
// ---------------------------------------------------------------
console.log('\n[8] listener receives live state transitions');
let seenStates = [];
const unsub = focusModeController.subscribe((s) => seenStates.push(s));
focusModeController.setFocus('memory', FOCUS_DEEP);
focusModeController.setFocus('connections', FOCUS_DIM);
focusModeController.releaseFocus('memory');
focusModeController.releaseFocus('connections');
unsub();
assert(seenStates.includes(FOCUS_DEEP), 'notified DEEP_FOCUS');
assert(seenStates.includes(FOCUS_DIM), 'notified DIM');
assert(seenStates.includes(FOCUS_NORMAL), 'notified NORMAL on last close');
assert(seenStates[seenStates.length - 1] === FOCUS_NORMAL, 'ends back on NORMAL');

console.log('================================================================');
console.log(` FOCUS MODE TEST RESULT: ${passed}/${total} PASSED`);
console.log('================================================================');
process.exit(passed === total ? 0 : 1);
