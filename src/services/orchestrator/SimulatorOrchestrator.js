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
import { speechDecisionGateInstance } from '../voice/SpeechDecisionGate.js';

export class SimulatorOrchestrator {
  constructor() {
    this.conversation = conversationEngineInstance;
    this.router = nineRouterClient;
    this.avatar = jinAvatarController;
    this.voice = voiceControllerInstance;
    this.gate = speechDecisionGateInstance;

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
  async executeUserPrompt(promptText, { onStreamChunk, onResponseReady, isVoiceTrigger = false, attachedImage = null } = {}) {
    if (!promptText && !attachedImage) return;

    const cleanPrompt = (promptText || '').trim() || (attachedImage ? 'Analisis gambar ini' : '');
    console.log(`[CHAT] INPUT_RECEIVED | IsVoice: ${isVoiceTrigger} | Content: "${cleanPrompt}" | HasImage: ${Boolean(attachedImage)}`);

    // 1. Check for verbal resume of interrupted speech
    if (/^lanjutkan\b|^teruskan\b|^lanjut\b/i.test(cleanPrompt) && this.voice.hasResidualContext()) {
      console.log('[CHAT] 🔁 Resuming interrupted speech context from JinAudioQueue');
      this.conversation.addMessage('user', cleanPrompt);
      this.voice.resume({
        onEnd: () => {
          this.avatar.dispatch({ type: AVATAR_EVENTS.SPEECH_FINISHED });
        }
      });
      return;
    }

    // 2. Authorize Speech Interaction Window
    const interactionId = this.gate.beginUserInteraction(`INT-${Date.now()}`);

    // 3. Record in conversation history with image metadata
    this.conversation.addMessage('user', cleanPrompt, { imageUrl: attachedImage });

    // 4. Dispatch state to Avatar: PROCESSING
    this.avatar.dispatch({ type: AVATAR_EVENTS.REQUEST_STARTED });

    // 5. Build payload with context and memory
    const { messages } = this.conversation.buildPayload(cleanPrompt, null, { imageUrl: attachedImage });
    console.log(`[CHAT] AGENT_DISPATCHED | Messages Count: ${messages.length}`);

    try {
      // 6. Send to 9Router / LocalRouter with streaming callback
      const result = await this.router.routeAndExecute(
        messages,
        {},
        (chunk, full) => {
          if (onStreamChunk) onStreamChunk(chunk, full);
        }
      );

      const responseText = result.text || '';
      console.log(`[CHAT] RESPONSE_RECEIVED | Output Length: ${responseText.length} chars`);
      
      // 7. Add assistant message to conversation history
      this.conversation.addMessage('assistant', responseText, {
        routing: result.routing
      });

      if (onResponseReady) {
        onResponseReady(responseText, result.routing);
      }
      
      console.log('[VOG] JIN_RESPONSE_RECEIVED');

      // 8. Transition avatar: SPEAKING via Voice Engine (Pass through Hard Speech Gate)
      this.avatar.dispatch({ type: AVATAR_EVENTS.RESPONSE_READY });

      this.voice.speak(responseText, {
        interactionId,
        userPrompt: cleanPrompt,
        isVoiceTrigger,
        eventType: 'USER_RESPONSE',
        onEnd: () => {
          this.avatar.dispatch({ type: AVATAR_EVENTS.SPEECH_FINISHED });
          this.gate.endUserInteraction(interactionId);
        },
        onError: () => {
          this.avatar.dispatch({ type: AVATAR_EVENTS.SPEECH_FINISHED });
          this.gate.endUserInteraction(interactionId);
        }
      });

      return result;
    } catch (err) {
      console.error('SimulatorOrchestrator execution error:', err);
      this.gate.endUserInteraction(interactionId);
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
        if (finalText && finalText.trim()) {
          this.avatar.dispatch({ type: AVATAR_EVENTS.INPUT_COMPLETED });
          if (onFinalTranscript) {
            onFinalTranscript(finalText.trim());
          } else {
            this.executeUserPrompt(finalText.trim(), { isVoiceTrigger: true });
          }
        } else {
          this.avatar.dispatch({ type: AVATAR_EVENTS.RESET });
        }
      },
      onError: () => {
        this.avatar.dispatch({ type: AVATAR_EVENTS.RESET });
      },
      onEnd: () => {
        // Handled cleanly
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
