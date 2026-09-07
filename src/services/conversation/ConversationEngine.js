/**
 * ConversationEngine.js
 * Multi-turn context manager for JIN.
 * Builds rich contextual payloads for the agent runtime.
 * Intent detection is LLM-driven via SemanticIntentEngine â€” NOT keyword-based.
 *
 * This engine also maintains the Task State Model:
 * { goal, subGoals, constraints, assumptions, userCorrections, previousToolResults, completedActions }
 */

import { contextManagerInstance } from './ContextManager.js';
import { memoryAdapterInstance } from './MemoryAdapter.js';
import { getCapabilityPromptContext } from '../grounding/CapabilityRegistry.js';
import { uiStateResolverInstance } from '../grounding/UIStateResolver.js';

export class ConversationEngine {
  constructor() {
    this.history = [];
    this.MAX_HISTORY_TURNS = 24;
    this.MAX_INJECTED_MEMORIES = 6;
    this._saveTimer = null;
    this._conversationId = null;

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

    this.systemPrompt = `You are JIN, an autonomous, grounded, and empathetic AI partner in UltimateAI.
You are fully bilingual in English and Indonesian.
LANGUAGE ADAPTATION RULE:
- If the user asks you to speak in English (e.g. "coba berbahasa inggris", "speak English", "use English"), or speaks to you in English, respond immediately and completely in fluent, natural, professional English.
- If the user speaks in Indonesian, respond naturally in Indonesian.

8 PILAR KEMAMPUAN & PRINSIP KOGNISI JIN:
1. ANALISIS DOKUMEN & RANGKUMAN: Membaca dokumen mendalam, memahami konteks, menganalisis, dan menyajikan rangkuman eksekutif.
2. VISION & PEMAHAMAN CITRA: Menganalisis gambar, diagram, dan foto secara multimodal.
3. GENERASI VISUAL MULTI-FORMAT SESUAI KONTEKS: Mampu merancang dan memproduksi aset gambar, infografis, slide presentasi (16:9), dan materi promosi/poster (9:16) yang selaras dengan topik pembicaraan saat diminta, secara adaptif tanpa memaksakan template mati.
4. KONEKTIVITAS SIMULTAN MULTI-PROVIDER: Terhubung harmonis dengan Gemini, Ollama, Tavily AI, dan sistem lokal.
5. SURFING & PEREKAMAN PENGETAHUAN: Menjelajah web via Tavily, memproses hasil secara kritis, dan merekam intisari ke basis pengetahuan lokal.
6. PEMBARUAN PENGETAHUAN HARIAN: Menjaga pembaruan perkembangan zaman secara harian dari internet.
7. AKSES & PEMAHAMAN PERANGKAT LOKAL: Mengenali ruang kerja lokal, Drive F:\\, dan telemetri perangkat.
8. KONTINUITAS KONTEKS & ANTI-LOOPING: Selalu berpijak pada konteks pembicaraan. Jika terjadi pengulangan (looping) atau instruksi kurang dipahami, pertanyakan kembali apa konteksnya secara santun kepada pengguna alih-alih menebak atau menjawab tanpa paham.`;
  }

  getHistory() {
    return [...this.history];
  }

  /**
   * Load conversation history from server
   */
  async loadFromServer(conversationId) {
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.messages && Array.isArray(data.messages)) {
        this.history = data.messages;
        this._conversationId = conversationId;
        return true;
      }
    } catch (err) {
      console.warn('[ConversationEngine] Load from server failed:', err.message);
    }
    return false;
  }

  /**
   * Debounced save to server — batches rapid addMessage calls
   */
  _scheduleSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._saveToServer(), 2000);
  }

  async _saveToServer() {
    if (this.history.length === 0) return;
    try {
      const id = this._conversationId || `conv_${Date.now()}`;
      await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: id,
          messages: this.history,
          metadata: { taskState: this.taskState.goal ? { goal: this.taskState.goal } : null }
        }),
        signal: AbortSignal.timeout(5000)
      });
      this._conversationId = id;
    } catch (err) {
      console.warn('[ConversationEngine] Save to server failed:', err.message);
    }
  }

  /**
   * Summarize older messages into a compact context when sliding window is exceeded
   */
  _summarizeOldMessages(messages) {
    if (messages.length <= 4) return null;
    // Create a compact summary of old conversation turns
    const userMsgs = messages.filter(m => m.role === 'user').map(m => m.content?.slice(0, 100));
    const assistantMsgs = messages.filter(m => m.role === 'assistant').map(m => m.content?.slice(0, 100));
    const topics = userMsgs.slice(0, 5).join('; ');
    return `[Ringkasan percakapan sebelumnya: ${topics}${userMsgs.length > 5 ? '...' : ''}]`;
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
      imageUrl: metadata?.imageUrl || null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    this.history.push(msg);

    // Keep history within sliding window budget
    if (this.history.length > this.MAX_HISTORY_TURNS * 2) {
      const excess = this.history.slice(0, this.history.length - this.MAX_HISTORY_TURNS * 2);
      // Summarize excess messages before discarding
      const summary = this._summarizeOldMessages(excess);
      if (summary) {
        // Prepend summary as first system message
        this.history = [
          { id: 'msg_summary_' + Date.now(), role: 'system', content: summary, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
          ...this.history.slice(-this.MAX_HISTORY_TURNS * 2)
        ];
      } else {
        this.history = this.history.slice(-this.MAX_HISTORY_TURNS * 2);
      }
    }

    // Auto-save to server (debounced)
    this._scheduleSave();

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
   * Supports multimodal image payloads seamlessly.
   *
   * @param {string} userMessage - Current user utterance
   * @param {string} [resolvedIntent] - Intent from SemanticIntentEngine
   * @param {Object} [options] - { imageUrl }
   * @returns {Object} { messages, intent, context, retrievedMemories }
   */
  buildPayload(userMessage, resolvedIntent = null, options = {}) {
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
    const capabilityContext = getCapabilityPromptContext();
    const uiContext = uiStateResolverInstance.getUIPromptContext();

    const augmentedSystemPrompt = `${this.systemPrompt}
[Runtime Context: Domain=${context.activeDomain}, User=${context.userRole}]${taskBlock}${constraintBlock}${correctionBlock}
${memoryString ? `[Retrieved Knowledge Context: ${memoryString}]` : ''}

${capabilityContext}

${uiContext}`;

    const recentHistory = this.history.slice(-8);
    const historyMessages = recentHistory.map(m => {
      if (m.imageUrl) {
        return {
          role: m.role,
          content: [
            { type: 'text', text: m.content || 'Gambar terlampir' },
            { type: 'image_url', image_url: { url: m.imageUrl } }
          ]
        };
      }
      return { role: m.role, content: m.content };
    });

    const lastHistory = this.history[this.history.length - 1];

    // Include userMessage only if not already the last item in history
    let finalMessages;
    if (lastHistory && lastHistory.role === 'user' && lastHistory.content === userMessage) {
      finalMessages = [{ role: 'system', content: augmentedSystemPrompt }, ...historyMessages];
    } else {
      const userPayloadContent = options.imageUrl
        ? [
            { type: 'text', text: userMessage || 'Analisis gambar ini' },
            { type: 'image_url', image_url: { url: options.imageUrl } }
          ]
        : (userMessage || '');

      finalMessages = [
        { role: 'system', content: augmentedSystemPrompt },
        ...historyMessages,
        { role: 'user', content: userPayloadContent }
      ];
    }

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
