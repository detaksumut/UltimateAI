/**
 * ConversationEngine.js
 * Multi-turn context manager for JIN.
 * Builds rich contextual payloads for the agent runtime.
 * Intent detection is LLM-driven via SemanticIntentEngine — NOT keyword-based.
 *
 * This engine also maintains the Task State Model:
 * { goal, subGoals, constraints, assumptions, userCorrections, previousToolResults, completedActions }
 */

import { contextManagerInstance } from './ContextManager.js';
import { memoryAdapterInstance } from './MemoryAdapter.js';

export class ConversationEngine {
  constructor() {
    this.history = [];
    this.MAX_HISTORY_TURNS = 12;
    this.MAX_INJECTED_MEMORIES = 4;

    // Dynamic Task State Model
    this.taskState = {
      goal: null,
      subGoals: [],
      constraints: [],
      assumptions: [],
      evidence: [],
      toolResults: [],
      completedActions: [],
      failedActions: [],
      pendingActions: [],
      userCorrections: [],
      nextBestAction: null
    };

    this.systemPrompt = `You are JIN, an autonomous AI agent and the intelligent core of UltimateAI.
You engage users with deep understanding, empathy, and reasoning.
Respond clearly, insightfully, and contextually in Indonesian by default.
You maintain full awareness of conversation history, user corrections, and active tasks.`;
  }

  getHistory() {
    return [...this.history];
  }

  /**
   * Returns the full conversation context object for use by SemanticIntentEngine and AgentRuntime.
   * This is the canonical "context" object consumed by all reasoning components.
   */
  getFullContext() {
    const recentHistory = this.history.slice(-10);
    const recentTurns = recentHistory.map(m => ({ role: m.role, content: m.content }));
    const ctx = contextManagerInstance.getContext();

    return {
      recentTurns,
      activeTask: this.taskState.goal ? this.taskState : null,
      constraints: [...this.taskState.constraints],
      userCorrections: [...this.taskState.userCorrections],
      previousToolResults: this.taskState.toolResults.slice(-3),
      longTermMemory: this.retrieveRelevantMemories('').slice(0, 4),
      entities: Object.keys(ctx.entities || {}),
      userRole: ctx.userRole,
      activeDomain: ctx.activeDomain
    };
  }

  /**
   * Updates the task state model after each turn.
   * @param {Object} updates - Partial task state updates
   */
  updateTaskState(updates = {}) {
    if (updates.goal) this.taskState.goal = updates.goal;
    if (updates.constraint) this.taskState.constraints = [...new Set([...this.taskState.constraints, updates.constraint])];
    if (updates.correction) this.taskState.userCorrections.push({ correction: updates.correction, timestamp: Date.now() });
    if (updates.toolResult) this.taskState.toolResults.push(updates.toolResult);
    if (updates.completedAction) this.taskState.completedActions.push(updates.completedAction);
    if (updates.clearGoal) {
      this.taskState.goal = null;
      this.taskState.subGoals = [];
      this.taskState.evidence = [];
    }
  }

  addMessage(role, content, metadata = {}) {
    const msg = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      role,
      content,
      metadata,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    this.history.push(msg);

    // Keep history within sliding window budget
    if (this.history.length > this.MAX_HISTORY_TURNS * 2) {
      this.history = this.history.slice(-this.MAX_HISTORY_TURNS * 2);
    }

    return msg;
  }

  /**
   * Context-aware memory retrieval: scores memories against the full conversation
   * rather than a single keyword.
   */
  retrieveRelevantMemories(query) {
    const allMemories = memoryAdapterInstance.getFacts();
    if (!allMemories || allMemories.length === 0) return [];

    // Build relevance context from recent conversation turns
    const recentContent = this.history.slice(-6).map(m => m.content).join(' ').toLowerCase();
    const q = ((query || '') + ' ' + recentContent).toLowerCase();

    const scored = allMemories.map(m => {
      let score = 0;
      if (m.isPinned) score += 50;

      const keyLower = m.key.toLowerCase();
      const valLower = m.value.toLowerCase();

      const words = q.split(/\s+/).filter(w => w.length > 2);
      for (const w of words) {
        if (keyLower.includes(w)) score += 20;
        if (valLower.includes(w)) score += 10;
      }

      return { ...m, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, this.MAX_INJECTED_MEMORIES);
  }

  /**
   * Builds the chat payload for direct dispatch to AgentRuntime / LocalRouter.
   * The system prompt includes the conversation context and task state.
   * Intent is provided by the caller from SemanticIntentEngine, NOT derived from keywords.
   *
   * @param {string} userMessage - Current user utterance
   * @param {string} [resolvedIntent] - Intent from SemanticIntentEngine (optional label for context)
   * @returns {Object} { messages, intent, context, retrievedMemories }
   */
  buildPayload(userMessage, resolvedIntent = null) {
    const context = contextManagerInstance.getContext();
    const relevantMemories = this.retrieveRelevantMemories(userMessage);
    const memoryString = relevantMemories.map(f => `[${f.category}] ${f.key}: ${f.value}`).join('; ');
    const intent = resolvedIntent || context.currentIntent || 'GENERAL_CONVERSATION';

    // Inject active task state and constraints into the system prompt
    const constraintBlock = this.taskState.constraints.length > 0
      ? `\n[Active Constraints: ${this.taskState.constraints.join('; ')}]`
      : '';
    const correctionBlock = this.taskState.userCorrections.length > 0
      ? `\n[User Corrections: ${this.taskState.userCorrections.map(c => c.correction).join('; ')}]`
      : '';
    const taskBlock = this.taskState.goal
      ? `\n[Active Task Goal: ${this.taskState.goal}]`
      : '';

    const augmentedSystemPrompt = `${this.systemPrompt}
[Runtime Context: Domain=${context.activeDomain}, User=${context.userRole}]${taskBlock}${constraintBlock}${correctionBlock}
${memoryString ? `[Retrieved Knowledge Context: ${memoryString}]` : ''}`;

    const historyMessages = this.history.map(m => ({ role: m.role, content: m.content }));
    const lastHistory = historyMessages[historyMessages.length - 1];

    // Include userMessage only if not already the last item in history
    const finalMessages = (lastHistory && lastHistory.role === 'user' && lastHistory.content === userMessage)
      ? [{ role: 'system', content: augmentedSystemPrompt }, ...historyMessages]
      : [{ role: 'system', content: augmentedSystemPrompt }, ...historyMessages, { role: 'user', content: userMessage }];

    return { messages: finalMessages, intent, context, retrievedMemories: relevantMemories };
  }

  clearHistory() {
    this.history = [];
    this.taskState = {
      goal: null,
      subGoals: [],
      constraints: [],
      assumptions: [],
      evidence: [],
      toolResults: [],
      completedActions: [],
      failedActions: [],
      pendingActions: [],
      userCorrections: [],
      nextBestAction: null
    };
  }
}

export const conversationEngineInstance = new ConversationEngine();
export default conversationEngineInstance;
