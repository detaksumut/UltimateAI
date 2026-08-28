import assert from 'assert';
import { conversationSessionControllerInstance } from '../../src/services/voice/ConversationSessionController.js';

console.log('========================================================================');
console.log('  TEST: VoiceSessionLifecycleTest — Prevent Duplicate Session Spawns');
console.log('========================================================================\n');

async function testSessionLifecycle() {
  const sessionCtrl = conversationSessionControllerInstance;

  // 1. Start Initial Session
  const session1 = sessionCtrl.startNewSession('MIC_PUSH_TO_TALK');
  console.log(`[1] Started Session #${session1.id}`);
  assert(session1.isActive, 'Session 1 must be active');
  assert.strictEqual(sessionCtrl.getActiveSession().id, session1.id);

  // 2. Querying active session should not increment session ID
  const retrievedSession = sessionCtrl.getActiveSession();
  assert.strictEqual(retrievedSession.id, session1.id, 'Must reuse active session without duplicate creation');
  console.log(`[2] Reused Active Session #${retrievedSession.id} (No duplicate spawned)`);

  // 3. Barge-In should safely cancel active session
  sessionCtrl.handleBargeIn('TEST_USER_BARGE_IN');
  assert.strictEqual(session1.isActive, false, 'Session 1 must be marked inactive after barge-in');
  console.log('[3] Session cancelled on Barge-In (Active = false)');

  console.log('\n========================================================================');
  console.log('  ✅ [PASS] VoiceSessionLifecycleTest: 100% SUCCESS');
  console.log('========================================================================\n');
}

testSessionLifecycle().catch(err => {
  console.error('❌ [FAIL] VoiceSessionLifecycleTest:', err);
  process.exit(1);
});
