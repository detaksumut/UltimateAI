/**
 * VoiceController.js (Enterprise Resilient Full-Duplex Edition)
 * Coordinated audio controller with Session Ownership, Protected TTS, and Safe Barge-In.
 */

import { textToSpeechInstance } from './TextToSpeech.js';
import { speechToTextInstance } from './SpeechToText.js';
import { jinAvatarControllerInstance } from '../avatar/JinAvatarController.js';
import { AVATAR_EVENTS, AVATAR_STATES } from '../avatar/JinAvatarStates.js';
import { conversationSessionControllerInstance } from './ConversationSessionController.js';
import { wakeWordEngineInstance } from './WakeWordEngine.js';

export class VoiceController {
  constructor() {
    this.stt = speechToTextInstance;
    this.tts = textToSpeechInstance;
    this.fsm = jinAvatarControllerInstance;
    this.sessionController = conversationSessionControllerInstance;
    this.wakeWord = wakeWordEngineInstance;
    this.bargeInHandler = null;

    // Connect wake word listener safely
    this.wakeWord.onWakeWord(({ transcript, sessionId }) => {
      // Only activate wake word if JIN is not currently speaking
      if (!this.tts.isPlaying) {
        this.fsm.dispatch({ type: AVATAR_EVENTS.MIC_ACTIVATED, sessionId });
      }
    });
  }

  enableWakeWord() {
    return this.wakeWord.startAlwaysOn();
  }

  setBargeInHandler(handler) {
    this.bargeInHandler = handler;
  }

  handleUserBargeIn() {
    // Only trigger barge-in if TTS is actively speaking
    if (this.tts.isPlaying) {
      console.log('[VOICE] ⚡ Active Speech Barge-In detected, stopping TTS.');
      this.tts.stop();
      this.sessionController.handleBargeIn('USER_BARGE_IN_TRIGGERED');
      if (this.bargeInHandler) {
        try {
          this.bargeInHandler();
        } catch {}
      }
    }
  }

  async startListeningSession(callbacks = {}) {
    // 1. Safe barge in check (only if speaking)
    this.handleUserBargeIn();

    // 2. Reuse active session if still active, or start fresh session
    let session = this.sessionController.getActiveSession();
    if (!session || !session.isActive) {
      session = this.sessionController.startNewSession('MIC_PUSH_TO_TALK');
    }

    return this.stt.startListening({
      onStart: () => {
        if (!this.sessionController.isCurrentSession(session.id)) return;
        this.fsm.dispatch({ type: AVATAR_EVENTS.MIC_ACTIVATED, sessionId: session.id });
        if (callbacks.onStart) callbacks.onStart();
      },
      onResult: (text) => {
        if (!this.sessionController.isCurrentSession(session.id)) return;
        if (callbacks.onResult) callbacks.onResult(text);
      },
      onEnd: (finalTranscript) => {
        if (!this.sessionController.isCurrentSession(session.id)) return;
        if (finalTranscript && finalTranscript.trim()) {
          console.log(`[VOG] AGENT_INPUT_RECEIVED: "${finalTranscript.trim()}"`);
          this.fsm.dispatch({ type: AVATAR_EVENTS.INPUT_COMPLETED, sessionId: session.id });
        } else {
          this.fsm.dispatch({ type: AVATAR_EVENTS.RESET, sessionId: session.id });
        }
        if (callbacks.onFinalTranscript) callbacks.onFinalTranscript(finalTranscript);
      },
      onError: (err) => {
        if (!this.sessionController.isCurrentSession(session.id)) return;
        this.fsm.dispatch({ type: AVATAR_EVENTS.FAILURE, payload: err, sessionId: session.id });
        if (callbacks.onError) callbacks.onError(err);
      }
    });
  }

  startListening(callbacks = {}) {
    return this.startListeningSession({
      onStart: callbacks.onStart,
      onResult: callbacks.onResult || callbacks.onTranscript,
      onFinalTranscript: callbacks.onFinalTranscript || callbacks.onEnd,
      onError: callbacks.onError
    });
  }

  stopListening() {
    this.stt.stopListening();
  }

  speak(text, options = {}, callbackEnd = null) {
    const onStart = typeof options === 'function' ? options : options?.onStart;
    const onEnd = typeof callbackEnd === 'function' ? callbackEnd : (typeof options === 'object' ? options?.onEnd : null);
    const sessionId = this.sessionController.getActiveSessionId();

    return this.tts.speak(
      text,
      {
        onStart: () => {
          this.fsm.dispatch({ type: AVATAR_EVENTS.RESPONSE_READY, sessionId });
          if (onStart) onStart();
        },
        onEnd: () => {
          this.fsm.dispatch({ type: AVATAR_EVENTS.SPEECH_FINISHED, sessionId });
          if (onEnd) onEnd();
        },
        onError: (err) => {
          this.fsm.dispatch({ type: AVATAR_EVENTS.SPEECH_FINISHED, sessionId });
          if (options?.onError) options.onError(err);
        }
      }
    );
  }

  resume(callbacks = {}) {
    const sessionId = this.sessionController.getActiveSessionId();
    this.fsm.dispatch({ type: AVATAR_EVENTS.RESPONSE_READY, sessionId });
    return this.tts.resume({
      onStart: () => {
        if (callbacks.onStart) callbacks.onStart();
      },
      onEnd: () => {
        this.fsm.dispatch({ type: AVATAR_EVENTS.SPEECH_FINISHED, sessionId });
        if (callbacks.onEnd) callbacks.onEnd();
      },
      onError: (err) => {
        this.fsm.dispatch({ type: AVATAR_EVENTS.SPEECH_FINISHED, sessionId });
        if (callbacks.onError) callbacks.onError(err);
      }
    });
  }

  hasResidualContext() {
    return this.tts.hasResidualContext();
  }

  stopAll() {
    this.stt.stopListening();
    this.tts.stop();
  }
}

export const voiceControllerInstance = new VoiceController();
export default voiceControllerInstance;
