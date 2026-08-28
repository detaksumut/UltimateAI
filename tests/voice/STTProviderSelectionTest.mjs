/**
 * STTProviderSelectionTest.mjs
 * Verifies explicit STT provider selection and diagnostics reporting.
 */

import assert from 'assert';
import { SpeechToText } from '../../src/services/voice/SpeechToText.js';
import { BrowserSTTProvider } from '../../src/services/voice/BrowserSTTProvider.js';
import { LocalBackendSTTProvider } from '../../src/services/voice/LocalBackendSTTProvider.js';

let pass = 0;
let fail = 0;

function test(label, fn) {
  try {
    fn();
    console.log(`  ✓ [PASS] ${label}`);
    pass++;
  } catch (e) {
    console.error(`  ✗ [FAIL] ${label}: ${e.message}`);
    fail++;
  }
}

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  TEST: STTProviderSelectionTest — Explicit STT Provider Architecture');
console.log('═══════════════════════════════════════════════════════════════════════\n');

const stt = new SpeechToText();

test('BrowserSTTProvider is instantiated with correct provider name', () => {
  const browser = new BrowserSTTProvider();
  assert.strictEqual(browser.getProviderName(), 'BROWSER_STT');
});

test('LocalBackendSTTProvider is instantiated with correct provider name', () => {
  const local = new LocalBackendSTTProvider();
  assert.strictEqual(local.getProviderName(), 'LOCAL_BACKEND_STT');
});

test('SpeechToText selects active provider explicitly', () => {
  stt.setProvider('LOCAL_BACKEND_STT');
  const active = stt.getActiveProvider();
  assert.strictEqual(active.getProviderName(), 'LOCAL_BACKEND_STT');
});

test('Rejects invalid provider names safely', () => {
  stt.setProvider('INVALID_NAME');
  assert.strictEqual(stt.activeProviderName, 'LOCAL_BACKEND_STT');
});

console.log('\n═══════════════════════════════════════════════════════════════════════');
if (fail === 0) {
  console.log(`  ✅ [PASS] STTProviderSelectionTest: ${pass}/${pass + fail}`);
} else {
  console.log(`  ❌ [PARTIAL] STTProviderSelectionTest: ${pass} PASS / ${fail} FAIL`);
}
console.log('═══════════════════════════════════════════════════════════════════════\n');

if (fail > 0) process.exit(1);
