/**
 * ConversationContextMemory.mjs
 * Maintains active conversational threads, entities, and intent stack during interruptions.
 */

export class ConversationContextMemory {
  constructor() {
    this.turns = [];
    this.currentTopic = null;
    this.activeEntities = new Map();
    this.intentHistory = [];
  }

  recordTurn(role, text, metadata = {}) {
    const turn = {
      id: Date.now(),
      role,
      text,
      metadata,
      timestamp: new Date().toISOString()
    };
    this.turns.push(turn);
    if (this.turns.length > 50) this.turns.shift();
    return turn;
  }

  handleBargeIn(interruptedTurnId, newUtterance) {
    // Retain context while registering the interruption
    const lastTurn = this.turns[this.turns.length - 1];
    if (lastTurn && lastTurn.role === 'assistant') {
      lastTurn.interrupted = true;
    }
    return this.recordTurn('user', newUtterance, { isBargeIn: true });
  }

  getContextSummary() {
    return {
      turnCount: this.turns.length,
      currentTopic: this.currentTopic,
      recentTurns: this.turns.slice(-6)
    };
  }

  clear() {
    this.turns = [];
    this.currentTopic = null;
    this.activeEntities.clear();
    this.intentHistory = [];
  }
}

export const conversationContextMemoryInstance = new ConversationContextMemory();
export default conversationContextMemoryInstance;
