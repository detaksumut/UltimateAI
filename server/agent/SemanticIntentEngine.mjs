/**
 * SemanticIntentEngine.mjs
 * LLM-powered semantic goal and intent interpreter.
 * Replaces shallow regex with deep context & entity understanding.
 */

export class SemanticIntentEngine {
  constructor(proxyUrl = 'http://localhost:20128/v1', apiKey = 'sk-25619842026f00d') {
    this.proxyUrl = proxyUrl;
    this.apiKey = apiKey;
  }

  /**
   * Interprets natural language input into a structured semantic goal
   * @param {string} input - User utterance / query
   * @param {Object} context - Conversational memory & history
   * @returns {Promise<Object>} semanticGoal
   */
  async interpret(input, context = {}) {
    if (!input || !input.trim()) {
      return {
        intent: 'IDLE',
        goal: '',
        actionRequired: false,
        entities: [],
        freshDataRequired: false,
        toolsNeeded: [],
        confidence: 1.0,
        reason: 'Empty user utterance.'
      };
    }

    const raw = input.trim();

    // 1. Live LLM Semantic Interpretation via 9Router Proxy
    try {
      const systemPrompt = `You are the Semantic Intent Engine for UltimateAI Agent.
Analyze the user's natural language input and output STRICT valid JSON with:
{
  "intent": "CASUAL_CHAT" | "LIVE_NEWS" | "MEDIA_PLAYBACK" | "DATA_ANALYTICS" | "APP_SYNTHESIS" | "RESEARCH_QUESTION" | "SENSITIVE_ENVIRONMENT",
  "goal": "Concise high-level goal description",
  "actionRequired": boolean,
  "entities": ["entity1", "entity2"],
  "freshDataRequired": boolean,
  "toolsNeeded": ["tool1", "tool2"],
  "confidence": number (0.0 to 1.0),
  "reason": "Brief rationale for this decision"
}`;

      const response = await fetch(`${this.proxyUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gemini-3.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Input: "${raw}"\nContext: ${JSON.stringify(context.recentTurns || [])}` }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        }),
        signal: AbortSignal.timeout(3000)
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          return {
            ...parsed,
            source: 'LLM_SEMANTIC_INTERPRETATION'
          };
        }
      }
    } catch {}

    // 2. High-Accuracy Heuristic Semantic Fallback (if offline)
    const p = raw.toLowerCase();
    const isGreeting = /^(halo|hai|salam|pagi|siang|malam|who are you|siapa kamu)\b/i.test(p);
    const hasMedia = /video|lagu|musik|dj|song|youtube|putar|play/i.test(p);
    const hasNews = /berita|demo|dpr|politik|terkini|hari ini|kondisi pasar|isu/i.test(p);
    const hasApp = /aplikasi|buatkan|bikin|dashboard|prototype|app|sistem/i.test(p);
    const hasData = /data|tabel|grafik|chart|statistik|metrik|analisis/i.test(p);
    const isSensitive = /hapus|delete|format|destroy|drop/i.test(p);

    if (isGreeting && !hasMedia && !hasNews && !hasApp && !hasData) {
      return {
        intent: 'CASUAL_CHAT',
        goal: 'Engage in natural conversation',
        actionRequired: false,
        entities: [],
        freshDataRequired: false,
        toolsNeeded: [],
        confidence: 0.95,
        reason: 'Casual conversation without explicit task delegation.',
        source: 'SEMANTIC_HEURISTIC_FALLBACK'
      };
    }

    let intent = 'RESEARCH_QUESTION';
    let toolsNeeded = ['intel.multilayer_search'];

    if (hasNews) {
      intent = 'LIVE_NEWS';
      toolsNeeded = ['intel.multilayer_search', 'media.video_resolver'];
    } else if (hasMedia) {
      intent = 'MEDIA_PLAYBACK';
      toolsNeeded = ['media.video_resolver'];
    } else if (hasApp) {
      intent = 'APP_SYNTHESIS';
      toolsNeeded = ['spec.blueprint_architect', 'code.synthesizer', 'ui.render_app_sandbox'];
    } else if (hasData) {
      intent = 'DATA_ANALYTICS';
      toolsNeeded = ['intel.multilayer_search', 'data.matrix_generator'];
    }

    return {
      intent,
      goal: raw,
      actionRequired: true,
      entities: [raw],
      freshDataRequired: hasNews || hasData,
      toolsNeeded,
      confidence: 0.88,
      sensitiveAction: isSensitive,
      reason: `Interpreted intent as ${intent} requiring action.`,
      source: 'SEMANTIC_HEURISTIC_FALLBACK'
    };
  }
}

export const semanticIntentEngineInstance = new SemanticIntentEngine();
export default semanticIntentEngineInstance;
