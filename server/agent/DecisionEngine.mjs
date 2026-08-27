/**
 * DecisionEngine.mjs
 * Evaluates conversational context to decide whether an action is needed and enforces Autonomy Levels.
 */

export const AUTONOMY_LEVELS = {
  LEVEL_0_CHAT_ONLY: 0,        // Pure conversation, no tool usage
  LEVEL_1_ASSISTED: 1,         // Read-only inspection and searches
  LEVEL_2_AUTONOMOUS: 2,       // Automatic safe creation, analysis, and sandbox execution
  LEVEL_3_SUPERVISED: 3        // Requires human confirmation for sensitive/destructive actions
};

export class DecisionEngine {
  constructor(defaultLevel = AUTONOMY_LEVELS.LEVEL_2_AUTONOMOUS) {
    this.currentLevel = defaultLevel;
  }

  setAutonomyLevel(level) {
    if (Object.values(AUTONOMY_LEVELS).includes(level)) {
      this.currentLevel = level;
    }
  }

  /**
   * Decides whether user input requires action, conversation, or clarification
   * @param {string} input - User utterance / prompt
   * @param {Object} context - Conversational memory and history
   * @returns {Object} decision - { actionRequired, intent, autonomyLevel, requiresApproval, reason }
   */
  decide(input, context = {}) {
    const raw = input || '';
    const p = raw.toLowerCase().trim();

    // 1. Casual Chat / Venting / Greeting (No Action Required)
    const isCasualChat = /^(halo|hai|salam|pagi|siang|malam|capek|lelah|terima kasih|makasih|ok|oke|sip|mantap|who are you|siapa kamu)\b/i.test(p);
    const hasExplicitInstruction = /cari|putar|buatkan|bikin|analisis|tampilkan|ekstrak|bandingkan|search|play|create|analyze/i.test(p);

    if (isCasualChat && !hasExplicitInstruction) {
      return {
        actionRequired: false,
        intent: 'CONVERSATION_ONLY',
        autonomyLevel: this.currentLevel,
        requiresApproval: false,
        reason: 'User is engaging in casual dialogue without task delegation.'
      };
    }

    // 2. Sensitive Action Detection (Requires Approval in Level 3)
    const isSensitive = /hapus|delete|format|kirim email|send email|drop|destroy|shutdown/i.test(p);
    const requiresApproval = this.currentLevel === AUTONOMY_LEVELS.LEVEL_3_SUPERVISED || isSensitive;

    return {
      actionRequired: true,
      intent: 'TASK_DELEGATION',
      autonomyLevel: this.currentLevel,
      requiresApproval,
      sensitiveAction: isSensitive,
      reason: isSensitive
        ? 'Sensitive environment action detected; governance requires authorization.'
        : 'Task delegation detected; autonomous execution graph planned.'
    };
  }
}

export const decisionEngineInstance = new DecisionEngine();
export default decisionEngineInstance;
