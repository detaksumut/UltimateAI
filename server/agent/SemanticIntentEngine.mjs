/**
 * SemanticIntentEngine.mjs
 * LLM-powered semantic goal and intent interpreter.
 * Strictly adheres to Zero Secret Exposure: credentials resolved via server env configuration.
 */

import { config } from '../config/env.mjs';

export class SemanticIntentEngine {
  constructor(proxyUrl = null, apiKey = null) {
    this.proxyUrl = proxyUrl || process.env.ROUTER_PROXY_URL || 'http://localhost:20128/v1';
    this.apiKey = apiKey || process.env.ROUTER_API_KEY || config.keys.gemini || '';
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
        intent: 'CASUAL_CHAT',
        goal: '',
        actionRequired: false,
        entities: [],
        freshDataRequired: false,
        toolsNeeded: [],
        confidence: 1.0,
        reason: 'Empty user utterance.',
        mode: 'STANDBY'
      };
    }

    const raw = input.trim();

    // 1. PRIMARY: Live LLM Semantic Interpretation via 9Router Proxy
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

      const headers = { 'Content-Type': 'application/json' };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.proxyUrl}/chat/completions`, {
        method: 'POST',
        headers,
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
            interpretationSource: 'PRIMARY_LLM_SEMANTIC'
          };
        }
      }
    } catch {}

    // 2. FALLBACK: High-Accuracy Heuristic Semantic Parser (Explicitly Labeled)
    const p = raw.toLowerCase();
    
    // Explicit Casual / Venting / Personal State Detection (No Action Required)
    const isVenting = /capek|lelah|letih|pusing|lemas|istirahat|santai|ngantuk|seharian|istirahat dulu/i.test(p);
    const isGreeting = /^(halo|hai|salam|pagi|siang|malam|who are you|siapa kamu)\b/i.test(p);
    const hasExplicitInstruction = /cari|carikan|putar|putarkan|buatkan|bikin|analisis|tampilkan|ekstrak|bandingkan|search|play|create|analyze/i.test(p);

    if ((isVenting || isGreeting) && !hasExplicitInstruction) {
      return {
        intent: 'CASUAL_CHAT',
        goal: isVenting ? 'Express empathy and support' : 'Engage in natural conversation',
        actionRequired: false,
        entities: [],
        freshDataRequired: false,
        toolsNeeded: [],
        confidence: 0.95,
        reason: isVenting ? 'User is venting / sharing personal state without task delegation.' : 'Casual greeting.',
        interpretationSource: 'FALLBACK_HEURISTIC_PARSER'
      };
    }

    const hasMedia = /video|lagu|musik|dj|song|youtube|putar|play/i.test(p);
    const hasNews = /berita|demo|dpr|politik|terkini|sidang/i.test(p);
    const hasApp = /aplikasi|buatkan|bikin|dashboard|prototype|app|kalkulator|sistem/i.test(p);
    const hasData = /data|tabel|grafik|chart|statistik|metrik|analisis|angka janggal/i.test(p);
    const isSensitive = /hapus|delete|format|destroy|drop|bersihkan seluruh/i.test(p);

    let intent = 'RESEARCH_QUESTION';
    let toolsNeeded = ['intel.multilayer_search'];

    if (isSensitive) {
      intent = 'SENSITIVE_ENVIRONMENT';
      toolsNeeded = ['system.governance'];
    } else if (hasNews) {
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
      confidence: 0.92,
      sensitiveAction: isSensitive,
      reason: `Heuristic parser classified intent as ${intent}.`,
      interpretationSource: 'FALLBACK_HEURISTIC_PARSER'
    };
  }
}

export const semanticIntentEngineInstance = new SemanticIntentEngine();
export default semanticIntentEngineInstance;
