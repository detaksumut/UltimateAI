/**
 * BackgroundEventSilenceTest.mjs
 * Validates that background daemons, cron tasks, and tool lifecycle events stay completely silent.
 */

import { strict as assert } from 'node:assert';
import { SpeechDecisionGate, SPEECH_DECISIONS } from '../../src/services/voice/SpeechDecisionGate.js';

console.log('=== TEST: BackgroundEventSilenceTest ===');

const gate = new SpeechDecisionGate();

const backgroundEvents = [
  { type: 'TOOL_START', text: 'Menjalankan tool ripgrep...' },
  { type: 'TOOL_COMPLETE', text: 'Pencarian berkas selesai 100%.' },
  { type: 'MEMORY_UPDATE', text: 'Memori sistem berhasil disinkronisasi.' },
  { type: 'PLAN_CREATED', text: 'Rencana kerja telah disusun.' },
  { type: 'VERIFIER_COMPLETE', text: 'Verifikasi kode selesai.' },
  { type: 'BACKGROUND_DAEMON_EVENT', text: 'Daemon pemantau kuota aktif.' },
  { type: 'STATE_CHANGE', text: 'Status beralih ke THINKING.' }
];

for (const ev of backgroundEvents) {
  const result = gate.shouldSpeak(ev);
  assert.equal(result.decision, SPEECH_DECISIONS.NO_SPEECH, `Background event ${ev.type} must remain silent`);
}

console.log('✔ All background daemon and tool lifecycle events remain 100% silent');
console.log('=== BackgroundEventSilenceTest PASSED ===\n');
