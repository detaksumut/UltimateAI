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
import { displaySpeechSeparationEngineInstance } from '../voice/DisplaySpeechSeparationEngine.js';
import { responseGroundingGuardInstance } from '../grounding/ResponseGroundingGuard.js';

export class SimulatorOrchestrator {
  constructor() {
    this.conversation = conversationEngineInstance;
    this.router = nineRouterClient;
    this.avatar = jinAvatarController;
    this.voice = voiceControllerInstance;
    this.gate = speechDecisionGateInstance;
    this.separator = displaySpeechSeparationEngineInstance;

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
    const cleanPrompt = (promptText || '').trim() || (attachedImage ? 'Analisis gambar ini' : '');
    const isoNow = () => new Date().toISOString();
    console.log(`[TRACE] ${isoNow()} | INPUT_RECEIVED | "${cleanPrompt}" | IsVoice: ${isVoiceTrigger}`);

    // 1. Check for verbal resume of interrupted speech
    if (/^lanjutkan\b|^teruskan\b|^lanjut\b/i.test(cleanPrompt) && this.voice.hasResidualContext()) {
      console.log('[CHAT] ðŸ” Resuming interrupted speech context from JinAudioQueue');
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
    console.log(`[TRACE] ${isoNow()} | AGENT_DISPATCHED | MessagesCount: ${messages.length}`);

    try {
      // 6. Hard Timeout Race: 8500ms deadline to prevent indefinite hanging
      const routerPromise = this.router.routeAndExecute(
        messages,
        {},
        (chunk, full) => {
          if (onStreamChunk) onStreamChunk(chunk, full);
        }
      );

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('ROUTER_EXECUTION_TIMEOUT')), 8500);
      });

      let result;
      try {
        result = await Promise.race([routerPromise, timeoutPromise]);
      } catch (timeoutOrRouterErr) {
        console.warn(`[TRACE] ${isoNow()} | ROUTER_FALLBACK_TRIGGERED | ${timeoutOrRouterErr.message}`);
        result = await this.router.fallbackSynthesis(messages, onStreamChunk);
      }

      const responseText = result?.text || 'Saya siap membantu Anda. Silakan sampaikan pesan atau berkas Anda.';
      console.log(`[TRACE] ${isoNow()} | LLM_RESPONSE_RECEIVED | Length: ${responseText.length}`);

      // 7. GROUNDING GUARD: Strip fabricated system names, fake UI references, and unverified claims
      const grounded = responseGroundingGuardInstance.guard(responseText, cleanPrompt);
      const groundedText = grounded.cleanedText || responseText;
      if (grounded.violationsDetected.length > 0) {
        console.log(`[GROUNDING_GUARD] ðŸ›¡ï¸ Corrected ${grounded.violationsDetected.length} violations:`, grounded.violationsDetected.map(v => v.type).join(', '));
      }

      // 8. SEPARATION ENGINE: Separate Display Content (Screen) from Speech Content (Voice)
      const separated = this.separator.separate(groundedText, cleanPrompt);
      const displayContent = separated.displayContent || groundedText;
      const speechContent = separated.speechContent || displayContent;

      console.log(`[TRACE] ${isoNow()} | RESPONSE_DISPLAYED | DisplayLength: ${displayContent.length} | SpeechLength: ${speechContent.length}`);

      // 9. Add assistant message to conversation history (Full display content on screen)
      this.conversation.addMessage('assistant', displayContent, {
        routing: result.routing,
        speechContent,
        speechToDisplayRatio: separated.speechToDisplayRatio
      });

      if (onResponseReady) {
        onResponseReady(displayContent, result.routing);
      }

      // 10. Transition avatar: SPEAKING via Voice Engine
      this.avatar.dispatch({ type: AVATAR_EVENTS.RESPONSE_READY });

      this.voice.speak(speechContent, {
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
      console.error(`[TRACE] ${isoNow()} | TERMINAL_ERROR_HANDLED |`, err.message);
      this.gate.endUserInteraction(interactionId);

      const safeFallback = 'Mohon maaf, terjadi kendala sesaat pada sistem. Silakan ulangi permintaan Anda.';
      this.conversation.addMessage('assistant', safeFallback);
      if (onResponseReady) onResponseReady(safeFallback, { orchestratedBy: 'Safety-Fallback' });

      this.avatar.dispatch({ type: AVATAR_EVENTS.SPEECH_FINISHED });
      return { text: safeFallback, routing: { orchestratedBy: 'Safety-Fallback' } };
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
