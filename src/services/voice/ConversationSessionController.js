/**
 * ConversationSessionController.js
 * Single Authority Lifecycle Coordinator for True Full-Duplex Voice & Barge-in.
 * 
 * CORE RESPONSIBILITIES:
 * 1. Monotonic Session Ownership: Each turn receives an incrementing Session ID (#101, #102...).
 * 2. Cascading Cancellation: When barge-in occurs, cancels active LLM request, flushes TTS queue,
 *    stops audio playback, and invalidates delayed callbacks to prevent ghost/zombie audio.
 * 3. FSM Synchronization: Maintains single source of truth alignment with JinAvatarController.
 */

import { jinAvatarControllerInstance } from '../avatar/JinAvatarController.js';
import { AVATAR_EVENTS, AVATAR_STATES } from '../avatar/JinAvatarStates.js';
import { textToSpeechInstance } from './TextToSpeech.js';
import { speechToTextInstance } from './SpeechToText.js';

export class ConversationSessionController {
  constructor() {
    this.currentSessionId = 100;
    this.activeSession = null;
    this.fsm = jinAvatarControllerInstance;
    this.tts = textToSpeechInstance;
    this.stt = speechToTextInstance;
  }

  /**
   * Start a new Voice/Chat Conversation Session with unique monotonic ownership
   */
  startNewSession(initiator = 'USER_VOICE') {
    // 1. Cancel previous session if still running
    if (this.activeSession && this.activeSession.isActive) {
      this.cancelSession(this.activeSession.id, 'NEW_SESSION_PREEMPTION');
    }

    this.currentSessionId++;
    const session = {
      id: this.currentSessionId,
      initiator,
      startTime: Date.now(),
      isActive: true,
      abortController: new AbortController(),
      ttsQueue: [],
      metrics: {
        sttDurationMs: 0,
        llmLatencyMs: 0,
        ttsDurationMs: 0
      }
    };

    this.activeSession = session;
    console.log(`[SESSION CONTROLLER] Started Session #${session.id} (Initiator: ${initiator})`);
    return session;
  }

  /**
   * True Full-Duplex Barge-in Interruption Handler
   */
  handleBargeIn(reason = 'USER_INTERRUPT') {
    if (!this.activeSession || !this.activeSession.isActive) return;

    const sessionId = this.activeSession.id;
    console.log(`[SESSION CONTROLLER] ⚡ Barge-in Triggered on Session #${sessionId} (Reason: ${reason})`);

    // 1. Abort ongoing LLM stream request
    try {
      this.activeSession.abortController.abort();
    } catch {}

    // 2. Cancel and flush audio playback
    if (this.tts && typeof this.tts.cancel === 'function') {
      this.tts.cancel();
    } else if (this.tts && typeof this.tts.stop === 'function') {
      this.tts.stop();
    }
    this.activeSession.ttsQueue = [];

    // 3. Mark session as cancelled
    this.activeSession.isActive = false;

    // 4. Update FSM State: SPEAKING -> INTERRUPTED -> LISTENING
    if (this.fsm.currentState === AVATAR_STATES.SPEAKING || this.fsm.currentState === AVATAR_STATES.PROCESSING) {
      this.fsm.dispatch({ type: AVATAR_EVENTS.USER_BARGE_IN, sessionId });
    }
  }

  /**
   * Cancel specific session
   */
  cancelSession(sessionId, reason = 'EXPLICIT_CANCEL') {
    if (this.activeSession && this.activeSession.id === sessionId) {
      this.activeSession.isActive = false;
      try {
        this.activeSession.abortController.abort();
      } catch {}
      this.tts.cancel();
    }
  }

  /**
   * Check if a callback belongs to the current active session
   */
  isCurrentSession(sessionId) {
    if (!sessionId) return true;
    return Boolean(!this.activeSession || (this.activeSession.id === sessionId && this.activeSession.isActive));
  }

  getActiveSessionId() {
    return this.activeSession?.id || this.currentSessionId;
  }
}

export const conversationSessionControllerInstance = new ConversationSessionController();
export default conversationSessionControllerInstance;
