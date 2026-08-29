/**
 * SpeechDecisionGate.js
 * ULTIMATEAI — SYSTEM-LEVEL JIN SPEECH GATE
 * "JIN ONLY SPEAKS WHEN USER INPUT REQUIRES A RESPONSE"
 *
 * Core Principles:
 * 1. DEFAULT = SILENCE: System events, daemons, background tools never speak by default.
 * 2. USER INPUT GATE: Speech allowed only within an authorized, user-initiated interaction window.
 * 3. NO RAW OUTPUT TO TTS: Sanitized and classified by UserResponsePolicy.
 * 4. ARTIFACT SILENCE: Code, charts, SVGs, and HTML are displayed silently (or acknowledged concisely).
 * 5. SAFE INTERRUPTIONS: Immediate stop without automated verbal fillers.
 */

export const RESPONSE_MODALITIES = {
  TEXT_ONLY: 'TEXT_ONLY',
  SPEECH_ONLY: 'SPEECH_ONLY',
  TEXT_AND_SPEECH: 'TEXT_AND_SPEECH',
  ARTIFACT_ONLY: 'ARTIFACT_ONLY',
  NO_OUTPUT: 'NO_OUTPUT'
};

export const SPEECH_DECISIONS = {
  SPEAK: 'SPEAK',
  NO_SPEECH: 'NO_SPEECH'
};

export const CRITICAL_EXCEPTIONS = [
  'SAFETY_CRITICAL',
  'SECURITY_CRITICAL',
  'USER_APPROVAL_REQUIRED',
  'TASK_BLOCKED_REQUIRES_USER',
  'USER_EXPLICITLY_REQUESTED_NOTIFICATION'
];

export const FORBIDDEN_EVENT_TYPES = [
  'STARTUP',
  'UI_OPENED',
  'POOL_CONNECTED',
  'MODEL_SELECTED',
  'TOOL_START',
  'TOOL_COMPLETE',
  'MEMORY_UPDATE',
  'PLAN_CREATED',
  'VERIFIER_COMPLETE',
  'CHART_CREATED',
  'IMAGE_CREATED',
  'SCRIPT_CREATED',
  'BACKGROUND_DAEMON_EVENT',
  'STATE_CHANGE',
  'USER_BARGE_IN',
  'INTERRUPT_FILLER'
];

export class UserResponsePolicy {
  /**
   * Classify response modality based on user input, content characteristics, and context.
   */
  static determineModality(userPrompt = '', rawContent = '', options = {}) {
    if (options.modality) return options.modality;
    if (options.isCriticalException) return RESPONSE_MODALITIES.TEXT_AND_SPEECH;

    const lowerPrompt = (userPrompt || '').toLowerCase().trim();
    const hasCodeBlock = /```(?:html|css|js|jsx|ts|tsx|json|sql|py|python|svg|xml)/i.test(rawContent);
    const isControlCommand = /^(tunggu|stop|berhenti|diam|pause|cancel|batal)\b/i.test(lowerPrompt);

    if (isControlCommand) {
      return RESPONSE_MODALITIES.NO_OUTPUT;
    }

    if (options.isVoiceInput) {
      if (hasCodeBlock) {
        return RESPONSE_MODALITIES.ARTIFACT_ONLY;
      }
      return RESPONSE_MODALITIES.TEXT_AND_SPEECH;
    }

    // Default for artifacts: Display visually
    if (hasCodeBlock) {
      return RESPONSE_MODALITIES.ARTIFACT_ONLY;
    }

    return RESPONSE_MODALITIES.TEXT_AND_SPEECH;
  }

  /**
   * Sanitize raw agent output into concise, natural conversational Indonesian for speech.
   * Strips code fences, raw markdown tables, URLs, ASCII graphics, and tags.
   */
  static sanitizeForSpeech(rawContent = '', modality = RESPONSE_MODALITIES.TEXT_AND_SPEECH) {
    if (!rawContent || typeof rawContent !== 'string') return '';
    if (modality === RESPONSE_MODALITIES.ARTIFACT_ONLY || modality === RESPONSE_MODALITIES.NO_OUTPUT) {
      return '';
    }

    let text = rawContent;

    // 1. Remove code blocks completely (```...```)
    text = text.replace(/```[\s\S]*?```/g, '');

    // 2. Remove inline code (`...`)
    text = text.replace(/`([^`]+)`/g, '$1');

    // 3. Remove Markdown tables (| col | col |)
    text = text.replace(/\|[^\n]+\|/g, '');

    // 4. Remove Markdown headers, bold, italics, links, images
    text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ''); // Images
    text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'); // Links
    text = text.replace(/#{1,6}\s*/g, ''); // Headers
    text = text.replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1'); // Bold/Italics
    text = text.replace(/^\s*[-*+]\s+/gm, ''); // Bullet points
    text = text.replace(/^\s*\d+\.\s+/gm, ''); // Numbered lists

    // 5. Remove HTML tags (<tag>...</tag>)
    text = text.replace(/<[^>]+>/g, '');

    // 6. Remove excess whitespace & newlines
    text = text.replace(/\n+/g, '. ').replace(/\s+/g, ' ').trim();

    // 7. Strip trailing periods/spaces
    text = text.replace(/\.+/g, '.').trim();

    return text;
  }
}

export class SpeechDecisionGate {
  constructor() {
    this.activeInteractionId = null;
    this.interactionResponseCount = 0;
    this.speechHistory = [];
  }

  /**
   * Authorize a new user-initiated interaction window.
   * @param {string} interactionId - Unique ID for the user turn
   */
  beginUserInteraction(interactionId) {
    this.activeInteractionId = interactionId || `INT-${Date.now()}`;
    this.interactionResponseCount = 0;
    console.log(`[SPEECH_GATE] 🛡️ Authorized User Interaction Window: ${this.activeInteractionId}`);
    return this.activeInteractionId;
  }

  /**
   * Close the active interaction window.
   */
  endUserInteraction(interactionId) {
    if (this.activeInteractionId === interactionId) {
      console.log(`[SPEECH_GATE] 🔒 Closed User Interaction Window: ${this.activeInteractionId}`);
      this.activeInteractionId = null;
      this.interactionResponseCount = 0;
    }
  }

  /**
   * Core Hard Speech Gate: Evaluates whether an event / response is authorized to speak.
   * @param {Object} event - Event descriptor { type, interactionId, text, isVoiceTrigger, isCritical, criticalType, ... }
   * @param {Object} context - Optional environment & conversation context
   * @returns {Object} { decision: 'SPEAK' | 'NO_SPEECH', reason: string, modality: string, speechText: string }
   */
  shouldSpeak(event = {}, context = {}) {
    const eventType = (event.type || '').toUpperCase();
    const eventInteractionId = event.interactionId || null;
    const isCritical = Boolean(event.isCritical || (event.criticalType && CRITICAL_EXCEPTIONS.includes(event.criticalType)));

    // 1. Critical Exceptions Policy (Safety / Security / User Approval)
    if (isCritical) {
      const sanitized = UserResponsePolicy.sanitizeForSpeech(event.text || '', RESPONSE_MODALITIES.TEXT_AND_SPEECH);
      this._recordDecision(event, SPEECH_DECISIONS.SPEAK, `Critical exception authorized: ${event.criticalType || 'SECURITY_CRITICAL'}`);
      return {
        decision: SPEECH_DECISIONS.SPEAK,
        reason: `Critical exception authorized: ${event.criticalType || 'SECURITY_CRITICAL'}`,
        modality: RESPONSE_MODALITIES.TEXT_AND_SPEECH,
        speechText: sanitized
      };
    }

    // 2. Forbidden Event Types -> Always Silent
    if (FORBIDDEN_EVENT_TYPES.includes(eventType)) {
      this._recordDecision(event, SPEECH_DECISIONS.NO_SPEECH, `Event type ${eventType} is forbidden from generating speech.`);
      return {
        decision: SPEECH_DECISIONS.NO_SPEECH,
        reason: `Event type ${eventType} is forbidden from generating speech.`,
        modality: RESPONSE_MODALITIES.NO_OUTPUT,
        speechText: ''
      };
    }

    // 3. User Input Gate: Speech allowed ONLY for active user-initiated interactions
    if (!eventInteractionId || eventInteractionId !== this.activeInteractionId) {
      this._recordDecision(event, SPEECH_DECISIONS.NO_SPEECH, 'No active authorized user interaction window found.');
      return {
        decision: SPEECH_DECISIONS.NO_SPEECH,
        reason: 'No active authorized user interaction window found.',
        modality: RESPONSE_MODALITIES.TEXT_ONLY,
        speechText: ''
      };
    }

    // 4. One User Request = One Response Window
    if (this.interactionResponseCount >= 1 && !event.allowMultiPart) {
      this._recordDecision(event, SPEECH_DECISIONS.NO_SPEECH, 'Single response speech quota reached for this user interaction window.');
      return {
        decision: SPEECH_DECISIONS.NO_SPEECH,
        reason: 'Single response speech quota reached for this user interaction window.',
        modality: RESPONSE_MODALITIES.TEXT_ONLY,
        speechText: ''
      };
    }

    // 5. Determine Modality and sanitize speech
    const modality = UserResponsePolicy.determineModality(event.userPrompt, event.text, {
      isVoiceInput: event.isVoiceTrigger,
      modality: event.modality
    });

    if (modality === RESPONSE_MODALITIES.TEXT_ONLY || modality === RESPONSE_MODALITIES.ARTIFACT_ONLY || modality === RESPONSE_MODALITIES.NO_OUTPUT) {
      this._recordDecision(event, SPEECH_DECISIONS.NO_SPEECH, `Modality ${modality} dictates silent delivery.`);
      return {
        decision: SPEECH_DECISIONS.NO_SPEECH,
        reason: `Modality ${modality} dictates silent delivery.`,
        modality,
        speechText: ''
      };
    }

    const speechText = UserResponsePolicy.sanitizeForSpeech(event.text || '', modality);
    if (!speechText || speechText.trim().length === 0) {
      this._recordDecision(event, SPEECH_DECISIONS.NO_SPEECH, 'No speakable text content after sanitization.');
      return {
        decision: SPEECH_DECISIONS.NO_SPEECH,
        reason: 'No speakable text content after sanitization.',
        modality,
        speechText: ''
      };
    }

    // Speech Authorized!
    this.interactionResponseCount++;
    this._recordDecision(event, SPEECH_DECISIONS.SPEAK, 'Authorized user interaction response speech.');
    return {
      decision: SPEECH_DECISIONS.SPEAK,
      reason: 'Authorized user interaction response speech.',
      modality,
      speechText
    };
  }

  _recordDecision(event, decision, reason) {
    this.speechHistory.push({
      timestamp: Date.now(),
      type: event.type || 'UNKNOWN',
      interactionId: event.interactionId || null,
      decision,
      reason
    });
    if (this.speechHistory.length > 50) {
      this.speechHistory.shift();
    }
  }

  getDecisionHistory() {
    return [...this.speechHistory];
  }
}

export const speechDecisionGateInstance = new SpeechDecisionGate();
