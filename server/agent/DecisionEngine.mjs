/**
 * DecisionEngine.mjs
 * Evaluates semantic interpretation to decide whether an action is needed and enforces Autonomy Levels.
 * Propagates options (failClosed, forcedModel) to SemanticIntentEngine.
 */

import { semanticIntentEngineInstance } from './SemanticIntentEngine.mjs';

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
   * @param {Object} options - { failClosed: boolean, forcedModel: string }
   * @returns {Promise<Object>} decision
   */
  async decide(input, context = {}, options = {}) {
    // If semantic decision is explicitly provided in context, honor it directly
    if (context.semanticDecision) {
      return {
        ...context.semanticDecision,
        autonomyLevel: this.currentLevel,
        actionRequired: context.semanticDecision.actionRequired !== false,
        requiresApproval: false
      };
    }

    const semantic = await semanticIntentEngineInstance.interpret(input, context, options);

    // If level 0 (Chat only), force actionRequired = false
    if (this.currentLevel === AUTONOMY_LEVELS.LEVEL_0_CHAT_ONLY) {
      return {
        ...semantic,
        actionRequired: false,
        autonomyLevel: this.currentLevel,
        requiresApproval: false,
        reason: 'Autonomy Level 0 (Chat Only) active: tool execution suppressed.'
      };
    }

    // Check sensitive actions
    const requiresApproval = this.currentLevel === AUTONOMY_LEVELS.LEVEL_3_SUPERVISED || Boolean(semantic.sensitiveAction);

    return {
      ...semantic,
      autonomyLevel: this.currentLevel,
      requiresApproval
    };
  }
}

export const decisionEngineInstance = new DecisionEngine();
export default decisionEngineInstance;
