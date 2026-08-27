/**
 * SimulatorOrchestrator.js
 * Central glue coordinator translating user actions & 9Router streams into JIN Avatar FSM Events.
 * Decouples ChatSimulator.jsx from underlying backend, voice, and AI logic.
 */

import { conversationEngineInstance } from '../conversation/ConversationEngine.js';
import { nineRouterClient } from '../router/NineRouterClient.js';
import { jinAvatarController } from '../avatar/JinAvatarController.js';
import { AVATAR_EVENTS } from '../avatar/JinAvatarStates.js';
import { voiceControllerInstance } from '../voice/VoiceController.js';

export class SimulatorOrchestrator {
  constructor() {
    this.conversation = conversationEngineInstance;
    this.router = nineRouterClient;
    this.avatar = jinAvatarController;
    this.voice = voiceControllerInstance;

    // Connect barge-in listener defensively
    if (this.voice && typeof this.voice.setBargeInHandler === 'function') {
      this.voice.setBargeInHandler(() => {
        this.avatar.dispatch({ type: AVATAR_EVENTS.USER_BARGE_IN });
      });
    }
  }

  /**
   * Execute user command via voice or text input
   */
  async executeUserPrompt(promptText, { onStreamChunk, onResponseReady, isVoiceTrigger = false } = {}) {
    if (!promptText || !promptText.trim()) return;

    // 1. Record in conversation history
    this.conversation.addMessage('user', promptText);

    // 2. Dispatch state to Avatar: PROCESSING
    this.avatar.dispatch({ type: AVATAR_EVENTS.REQUEST_STARTED });

    // 3. Build payload with context and memory
    const { messages } = this.conversation.buildPayload(promptText);

    try {
      // 4. Send to 9Router with streaming callback
      const result = await this.router.routeAndExecute(
        messages,
        {},
        (chunk, full) => {
          if (onStreamChunk) onStreamChunk(chunk, full);
        }
      );

      const responseText = result.text || '';
      
      // 5. Add assistant message to conversation history
      this.conversation.addMessage('assistant', responseText, {
        routing: result.routing
      });

      if (onResponseReady) {
        onResponseReady(responseText, result.routing);
      }

      // 6. Transition avatar: SPEAKING via Voice Engine
      this.avatar.dispatch({ type: AVATAR_EVENTS.RESPONSE_READY });

      this.voice.speak(responseText, {
        onEnd: () => {
          this.avatar.dispatch({ type: AVATAR_EVENTS.SPEECH_FINISHED });
        },
        onError: () => {
          this.avatar.dispatch({ type: AVATAR_EVENTS.SPEECH_FINISHED });
        }
      });

      return result;
    } catch (err) {
      console.error('SimulatorOrchestrator execution error:', err);
      this.avatar.dispatch({ type: AVATAR_EVENTS.FAILURE, error: err.message });
      setTimeout(() => {
        this.avatar.dispatch({ type: AVATAR_EVENTS.RESET });
      }, 4000);
      throw err;
    }
  }

  startVoiceInput({ onTranscript, onFinalTranscript } = {}) {
    this.avatar.dispatch({ type: AVATAR_EVENTS.MIC_ACTIVATED });
    
    return this.voice.startListening({
      onTranscript: (t, isFinal) => {
        if (onTranscript) onTranscript(t, isFinal);
      },
      onFinalTranscript: (finalText) => {
        this.avatar.dispatch({ type: AVATAR_EVENTS.INPUT_COMPLETED });
        if (onFinalTranscript) onFinalTranscript(finalText);
        this.executeUserPrompt(finalText, { isVoiceTrigger: true });
      },
      onError: () => {
        this.avatar.dispatch({ type: AVATAR_EVENTS.RESET });
      },
      onEnd: () => {
        // Safe end check
      }
    });
  }

  stopVoiceInput() {
    this.voice.stopListening();
    this.avatar.dispatch({ type: AVATAR_EVENTS.RESET });
  }

  stopAll() {
    this.voice.stopAll();
    this.avatar.dispatch({ type: AVATAR_EVENTS.RESET });
  }
}

export const simulatorOrchestratorInstance = new SimulatorOrchestrator();
export default simulatorOrchestratorInstance;
