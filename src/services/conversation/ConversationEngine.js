/**
 * ConversationEngine.js (Hardened Edition)
 * Manages multi-turn history, dynamic context routing, and budgeted memory retrieval.
 */

import { contextManagerInstance } from './ContextManager.js';
import { memoryAdapterInstance } from './MemoryAdapter.js';

export class ConversationEngine {
  constructor() {
    this.history = [];
    this.MAX_HISTORY_TURNS = 12; // Maintain conversation focus within budget
    this.MAX_INJECTED_MEMORIES = 4; // Context budget limit
    this.systemPrompt = `You are JIN, the embodied intelligence persona and interactive cyber-HUD voice/text interface of UltimateAI 9Router.
UltimateAI 9Router is the central orchestration brain with 9 active routing engines.
Provide clear, intelligent, structured, and insightful responses in the language of the user (Indonesian by default).`;
  }

  getHistory() {
    return [...this.history];
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
   * Budgeted & Ranked Memory Retrieval
   * Prioritizes: 1. Pinned Memories, 2. Keyword Relevance to User Query, 3. Recency
   */
  retrieveRelevantMemories(query) {
    const allMemories = memoryAdapterInstance.getFacts();
    if (!allMemories || allMemories.length === 0) return [];

    const q = (query || '').toLowerCase();
    const scored = allMemories.map(m => {
      let score = 0;
      if (m.isPinned) score += 50; // High priority for pinned knowledge

      const keyLower = m.key.toLowerCase();
      const valLower = m.value.toLowerCase();

      // Word matching relevance
      const words = q.split(/\s+/).filter(w => w.length > 2);
      for (const w of words) {
        if (keyLower.includes(w)) score += 20;
        if (valLower.includes(w)) score += 10;
      }

      return { ...m, score };
    });

    // Sort descending by score and pick top items within budget
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, this.MAX_INJECTED_MEMORIES);
  }

  buildPayload(userMessage) {
    const intent = contextManagerInstance.detectIntent(userMessage);
    const context = contextManagerInstance.getContext();
    const relevantMemories = this.retrieveRelevantMemories(userMessage);
    const memoryString = relevantMemories.map(f => `[${f.category}] ${f.key}: ${f.value}`).join('; ');

    const augmentedSystemPrompt = `${this.systemPrompt}
[Runtime Context: Domain=${context.activeDomain}, User=${context.userRole}, Intent=${intent}]
${memoryString ? `[Retrieved Knowledge Context: ${memoryString}]` : ''}`;

    const messages = [
      { role: 'system', content: augmentedSystemPrompt },
      ...this.history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage }
    ];

    return { messages, intent, context, retrievedMemories: relevantMemories };
  }

  clearHistory() {
    this.history = [];
  }
}

export const conversationEngineInstance = new ConversationEngine();
export default conversationEngineInstance;
