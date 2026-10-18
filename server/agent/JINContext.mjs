/**
 * JINContext.mjs
 * Unified Conversation Context for JINI — Full Context Understanding.
 *
 * Carries complete user context through every layer of the execution pipeline:
 * LocalRouterServer -> AgentRuntime -> JINResponseEngine -> Tools/Providers.
 *
 * Guarantees JINI understands:
 *  - Who the user is (userId, sessionId)
 *  - What was said before (conversationHistory incl. images)
 *  - What the user wants now (currentIntent, currentUtterance)
 *  - What images are attached (imageContext)
 *  - What tools have been used (executionHistory)
 *  - System state (provider availability, routing decisions)
 */

export class JINContext {
  constructor({
    userId = 'anonymous',
    sessionId = null,
    conversationHistory = [],
    currentUtterance = '',
    currentIntent = null,
    imageContext = null,
    executionHistory = [],
    systemState = {},
    providerRouting = {},
    sourceScope = 'LOCAL_ONLY',
    timestamp = Date.now()
  } = {}) {
    this.userId = userId;
    this.sessionId = sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.conversationHistory = Array.isArray(conversationHistory) ? conversationHistory : [];
    this.currentUtterance = String(currentUtterance || '');
    this.currentIntent = currentIntent || null;
    this.imageContext = imageContext || null;
    this.executionHistory = Array.isArray(executionHistory) ? executionHistory : [];
    this.systemState = systemState || {};
    this.providerRouting = providerRouting || {};
    this.sourceScope = sourceScope || 'LOCAL_ONLY';
    this.timestamp = timestamp;
  }

  /** Returns true if any message in history contains image parts */
  hasImages() {
    for (const msg of this.conversationHistory) {
      if (!msg || !msg.content) continue;
      if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part && (part.type === 'image_url' || part.type === 'image' || part.image_url || part.inlineData)) {
            return true;
          }
        }
      }
      if (msg.images && Array.isArray(msg.images) && msg.images.length > 0) return true;
      if (msg.inlineData) return true;
    }
    return false;
  }

  /** Extract all image URLs from conversation history */
  getImageUrls() {
    const urls = [];
    for (const msg of this.conversationHistory) {
      if (!msg || !msg.content) continue;
      if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (!part) continue;
          const url = part.image_url?.url || part.image_url || part.dataUrl || null;
          if (url) urls.push(url);
        }
      }
      if (msg.images && Array.isArray(msg.images)) {
        for (const img of msg.images) if (img) urls.push(img);
      }
    }
    return urls;
  }

  /** Get last N turns as plain text for local LLM (text-only fallback) */
  getRecentTextTurns(limit = 6) {
    const turns = [];
    for (let i = this.conversationHistory.length - 1; i >= 0 && turns.length < limit; i--) {
      const msg = this.conversationHistory[i];
      if (!msg) continue;
      const text = typeof msg.content === 'string' ? msg.content
        : Array.isArray(msg.content) ? msg.content.map(p => (typeof p === 'string' ? p : p.text || '')).join('\n')
        : String(msg.content || '');
      if (text.trim()) turns.unshift({ role: msg.role || 'user', content: text });
    }
    return turns;
  }

  /** Convert full history to multimodal-capable message format for Gemini */
  toGeminiMessages() {
    const messages = [];
    for (const msg of this.conversationHistory) {
      if (!msg || !msg.content) continue;
      const textParts = [];
      const imageParts = [];
      if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (!part) continue;
          if (part.type === 'text' || typeof part === 'string') {
            textParts.push(typeof part === 'string' ? { text: part } : { text: part.text || part });
          } else if (part.type === 'image_url' || part.type === 'image' || part.image_url || part.inlineData) {
            const url = part.image_url?.url || part.image_url || part.dataUrl || null;
            if (url) imageParts.push(url);
          }
        }
      } else if (typeof msg.content === 'string') {
        textParts.push({ text: msg.content });
      }
      if (imageParts.length > 0) {
        messages.push({
          role: msg.role,
          parts: [
            ...textParts.map(t => ({ text: t.text })),
            ...imageParts.map(url => ({ inlineData: { mimeType: 'image/jpeg', data: url } }))
          ]
        });
      } else if (textParts.length > 0) {
        messages.push({
          role: msg.role,
          parts: textParts.map(t => ({ text: t.text }))
        });
      }
    }
    return messages;
  }

  /** Serialize to plain object for logging / debugging */
  toJSON() {
    return {
      userId: this.userId,
      sessionId: this.sessionId,
      conversationHistory: this.conversationHistory,
      currentUtterance: this.currentUtterance,
      currentIntent: this.currentIntent,
      hasImages: this.hasImages(),
      imageUrls: this.getImageUrls(),
      executionHistoryLength: this.executionHistory.length,
      sourceScope: this.sourceScope,
      timestamp: this.timestamp
    };
  }
}

export const jinContextInstance = new JINContext();
