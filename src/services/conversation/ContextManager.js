/**
 * ContextManager.js
 * Tracks active context, user intent, domain focus, and operational variables.
 */

export class ContextManager {
  constructor() {
    this.context = {
      userRole: 'Enterprise Admin',
      activeDomain: 'Research & Intelligence',
      currentIntent: 'GENERAL_INQUIRY',
      activeTopic: 'JIN Assistant Core',
      entities: {},
      lastInteractionTime: new Date()
    };
    this.listeners = new Set();
  }

  getContext() {
    return { ...this.context };
  }

  updateContext(partial) {
    this.context = {
      ...this.context,
      ...partial,
      lastInteractionTime: new Date()
    };
    this.notify();
  }

  /**
   * Accepts the LLM-resolved intent from SemanticIntentEngine and records it.
   * Does NOT use keyword detection — intent comes from the LLM reasoning engine.
   * @param {string} resolvedIntent - Intent string from SemanticIntentEngine
   * @returns {string} intent
   */
  recordIntent(resolvedIntent) {
    const intent = resolvedIntent || 'GENERAL_CONVERSATION';
    this.updateContext({ currentIntent: intent });
    return intent;
  }

  /**
   * @deprecated Use recordIntent(resolvedIntent) instead.
   * This method is kept ONLY for legacy callers.
   * It NO LONGER performs keyword-based intent detection.
   */
  detectIntent(input) {
    // Intent detection is performed by the LLM-based SemanticIntentEngine.
    // This method is a passthrough returning the last known intent.
    return this.context.currentIntent || 'GENERAL_CONVERSATION';
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    this.listeners.forEach(cb => cb(this.getContext()));
  }
}

export const contextManagerInstance = new ContextManager();
export default contextManagerInstance;
