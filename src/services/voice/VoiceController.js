/**
 * VoiceController.js (Enterprise Full-Duplex Edition)
 * Coordinated audio controller with Session Ownership and Cascading Barge-In.
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

    // Connect wake word listener
    this.wakeWord.onWakeWord(({ transcript, sessionId }) => {
      this.fsm.dispatch({ type: AVATAR_EVENTS.MIC_ACTIVATED, sessionId });
    });
  }

  enableWakeWord() {
    return this.wakeWord.startAlwaysOn();
  }

  setBargeInHandler(handler) {
    this.bargeInHandler = handler;
  }

  handleUserBargeIn() {
    this.sessionController.handleBargeIn('USER_BARGE_IN_TRIGGERED');
    if (this.bargeInHandler) {
      try {
        this.bargeInHandler();
      } catch {}
    }
  }

  async startListeningSession(callbacks = {}) {
    // 1. Instant Cascading Barge-in check
    this.handleUserBargeIn();

    // 2. Start a fresh session with unique ID
    const session = this.sessionController.startNewSession('MIC_PUSH_TO_TALK');

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
          if (!this.sessionController.isCurrentSession(sessionId)) return;
          this.fsm.dispatch({ type: AVATAR_EVENTS.RESPONSE_READY, sessionId });
          if (onStart) onStart();
        },
        onEnd: () => {
          if (!this.sessionController.isCurrentSession(sessionId)) return;
          this.fsm.dispatch({ type: AVATAR_EVENTS.SPEECH_FINISHED, sessionId });
          if (onEnd) onEnd();
        },
        onError: () => {
          if (!this.sessionController.isCurrentSession(sessionId)) return;
          this.fsm.dispatch({ type: AVATAR_EVENTS.SPEECH_FINISHED, sessionId });
          if (options?.onError) options.onError();
        }
      }
    );
  }
}

export const voiceControllerInstance = new VoiceController();
export default voiceControllerInstance;
