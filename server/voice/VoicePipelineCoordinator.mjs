/**
 * VoicePipelineCoordinator.mjs
 * Unified Real-Time Voice Agent State Machine & Barge-In Coordinator.
 * State Flow:
 *  IDLE ➔ LISTENING ➔ TRANSCRIBING ➔ THINKING ➔ TOOL_EXECUTION ➔ SPEAKING ➔ INTERRUPTED ➔ LISTENING
 * 
 * Strict Governance:
 *  1. Zero Second Pipeline: Dispatches exclusively to standard AgentRuntime and 7-Pool layer.
 *  2. Instant Human Barge-In: Cancels active speech instantly, preserves context.
 *  3. Telemetry Transparency: Exposes full state to Control Center & Provenance.
 */

import { agentRuntimeInstance } from '../agent/AgentRuntime.mjs';

export const VOICE_STATES = {
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  TRANSCRIBING: 'TRANSCRIBING',
  THINKING: 'THINKING',
  TOOL_EXECUTION: 'TOOL_EXECUTION',
  SPEAKING: 'SPEAKING',
  INTERRUPTED: 'INTERRUPTED'
};

export class VoicePipelineCoordinator {
  constructor(agentRuntime = agentRuntimeInstance) {
    this.agentRuntime = agentRuntime;
    this.state = VOICE_STATES.IDLE;
    this.currentSessionId = null;
    this.preservedContext = null;
    this.isBargeInActive = false;
    this.currentTTSUtterance = null;
    this.activeTask = null;
    this.listeners = new Set();
    this.telemetry = {
      mic: 'ACTIVE',
      vad: 'ACTIVE',
      stt: 'READY',
      agent: 'ONLINE',
      pool: 'AG-01',
      tts: 'READY',
      bargeIn: 'READY'
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _setState(newState, payload = {}) {
    const prevState = this.state;
    this.state = newState;
    const event = {
      prevState,
      state: newState,
      timestamp: new Date().toISOString(),
      payload
    };

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.warn('[VOICE_PIPELINE] Listener error:', err);
      }
    }
    return event;
  }

  getState() {
    return {
      state: this.state,
      sessionId: this.currentSessionId,
      isBargeInActive: this.isBargeInActive,
      telemetry: this.telemetry,
      hasPreservedContext: Boolean(this.preservedContext)
    };
  }

  startListening(sessionId = `voice-${Date.now()}`) {
    this.currentSessionId = sessionId;
    this.isBargeInActive = false;
    this._setState(VOICE_STATES.LISTENING, { sessionId });
  }

  processVADSpeechStart() {
    if (this.state === VOICE_STATES.SPEAKING) {
      // User started talking while JIN was speaking ➔ Instant Barge-In!
      return this.triggerBargeIn('VAD_SPEECH_ACTIVITY_DETECTED');
    }
    this._setState(VOICE_STATES.LISTENING, { vad: 'SPEECH_STARTED' });
  }

  processSTTTranscript(transcript, isFinal = false) {
    const clean = (transcript || '').trim();
    if (!clean) return;

    // Check for explicit verbal barge-in phrase
    if (this.state === VOICE_STATES.SPEAKING || this.isSpeaking()) {
      if (/tunggu|jangan lanjut|berhenti|stop|diam dulu|pause|tahan/i.test(clean)) {
        return this.triggerBargeIn('VERBAL_INTERRUPTION_PHRASE', clean);
      }
    }

    if (isFinal) {
      this._setState(VOICE_STATES.TRANSCRIBING, { transcript: clean, isFinal: true });
      return this.executeVoiceGoal(clean);
    }
  }

  async executeVoiceGoal(transcript) {
    const raw = transcript.trim();
    const sessionId = this.currentSessionId || `voice-${Date.now()}`;

    // Handle resume from interrupted context
    let executionGoal = raw;
    let executionContext = {
      isVoiceTask: true,
      sessionId,
      recentTurns: []
    };

    if (/lanjutkan|terus|lanjut|sambung lagi/i.test(raw) && this.preservedContext) {
      executionGoal = this.preservedContext.lastGoal || raw;
      executionContext = {
        ...this.preservedContext,
        isVoiceTask: true,
        resumedFromBargeIn: true
      };
      console.log('[VOICE_PIPELINE] 🔁 Resuming task from preserved context:', executionGoal);
    }

    this._setState(VOICE_STATES.THINKING, { goal: executionGoal });

    try {
      this._setState(VOICE_STATES.TOOL_EXECUTION, { goal: executionGoal });

      const taskResult = await this.agentRuntime.runGoal(executionGoal, executionContext, {
        forcedModel: 'gemini-3.6-flash-high'
      });

      this.activeTask = taskResult;
      const speechOutput = taskResult.responseMessage || taskResult.detailedDisplay || 'Saya telah menyelesaikan permintaan Anda.';

      // Preserve context in case of subsequent barge-in or follow-up
      this.preservedContext = {
        lastGoal: executionGoal,
        lastResult: taskResult,
        recentTurns: [
          ...(executionContext.recentTurns || []).slice(-4),
          { role: 'user', content: executionGoal },
          { role: 'assistant', content: speechOutput }
        ]
      };

      this._setState(VOICE_STATES.SPEAKING, {
        speechOutput,
        taskResult,
        provenance: taskResult.provenance
      });

      return {
        success: true,
        speechOutput,
        taskResult,
        state: this.state
      };
    } catch (err) {
      this._setState(VOICE_STATES.IDLE, { error: err.message });
      throw err;
    }
  }

  triggerBargeIn(reason = 'USER_INTERRUPT', transcript = '') {
    console.log(`[VOICE_PIPELINE] 🛑 Human Barge-In Triggered [Reason: ${reason}]`);
    this.isBargeInActive = true;

    // Immediately record interruption
    this._setState(VOICE_STATES.INTERRUPTED, {
      reason,
      transcript,
      preservedContext: this.preservedContext
    });

    // Seamlessly transition back to listening for operator's next instruction
    setTimeout(() => {
      if (this.state === VOICE_STATES.INTERRUPTED) {
        this._setState(VOICE_STATES.LISTENING, { readyForInput: true });
      }
    }, 50);

    return {
      interrupted: true,
      reason,
      state: VOICE_STATES.INTERRUPTED,
      hasPreservedContext: Boolean(this.preservedContext)
    };
  }

  isSpeaking() {
    return this.state === VOICE_STATES.SPEAKING;
  }

  completeSpeech() {
    if (this.state === VOICE_STATES.SPEAKING) {
      this._setState(VOICE_STATES.IDLE, { speechCompleted: true });
    }
  }
}

export const voicePipelineCoordinatorInstance = new VoicePipelineCoordinator();
export default voicePipelineCoordinatorInstance;
