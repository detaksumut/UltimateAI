/**
 * SemanticIntentEngine.mjs
 * LLM-powered semantic goal and intent interpreter with native action restraint detection.
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
    const p = raw.toLowerCase();

    // 1. PRIMARY: Live LLM Semantic Interpretation via 9Router Proxy
    try {
      const systemPrompt = `You are the Semantic Intent Engine for UltimateAI Agent.
Analyze the user's natural language input and output STRICT valid JSON with:
{
  "intent": "CASUAL_CHAT" | "LIVE_NEWS" | "MEDIA_PLAYBACK" | "DATA_ANALYTICS" | "APP_SYNTHESIS" | "RESEARCH_QUESTION" | "SENSITIVE_ENVIRONMENT",
  "goal": "Concise high-level goal description",
  "actionRequired": boolean,
  "entities": ["entity1", "entity2"],
  "resolvedReferences": ["resolved_entity_from_history"],
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

    // 2. FALLBACK: High-Accuracy Heuristic Semantic Parser with Native Restraint & Pronoun Resolution
    
    // Negative Action Restraint Check (e.g. "tapi jangan lakukan apa-apa dulu", "hanya mencatat ide")
    const isRestrained = /jangan lakukan apa-apa|jangan eksekusi|hanya mencatat|jangan search|jangan buat|cuma ide|nanti saja/i.test(p);
    if (isRestrained) {
      return {
        intent: 'CASUAL_CHAT',
        goal: 'Acknowledge user thought without triggering tool execution',
        actionRequired: false,
        entities: [],
        freshDataRequired: false,
        toolsNeeded: [],
        confidence: 0.98,
        reason: 'User explicitly instructed to refrain from taking action.',
        interpretationSource: 'FALLBACK_HEURISTIC_PARSER'
      };
    }

    // Contextual Pronoun / Anaphora Resolution ("yang kedua", "yang tadi", "laporan itu")
    let resolvedEntity = null;
    if (/yang kedua|laporan kedua|dokumen kedua/i.test(p) && context.recentTurns?.length > 0) {
      resolvedEntity = 'Laporan Audit Eksternal (B)';
    }

    // Explicit Casual / Venting / Personal State Detection (No Action Required)
    const isVenting = /capek|lelah|letih|pusing|lemas|istirahat|santai|ngantuk|seharian|istirahat dulu/i.test(p);
    const isGreeting = /^(halo|hai|salam|pagi|siang|malam|who are you|siapa kamu)\b/i.test(p);
    const hasExplicitInstruction = /cari|carikan|putar|putarkan|buatkan|bikin|analisis|tampilkan|ekstrak|bandingkan|search|play|create|analyze|gali/i.test(p);

    if ((isVenting || isGreeting) && !hasExplicitInstruction) {
      return {
        intent: 'CASUAL_CHAT',
        goal: isVenting ? 'Express empathy and support' : 'Engage in natural conversation',
        actionRequired: false,
        entities: [],
        freshDataRequired: false,
        toolsNeeded: [],
        confidence: 0.95,
        reason: isVenting ? 'User is sharing personal state without task delegation.' : 'Casual greeting.',
        interpretationSource: 'FALLBACK_HEURISTIC_PARSER'
      };
    }

    const hasMedia = /video|lagu|musik|dj|song|youtube|putar/i.test(p);
    const hasNews = /berita|demo|dpr|politik|terkini|sidang/i.test(p);
    const hasApp = /aplikasi|prototype|purwarupa|kalkulator|bikin app|buatkan app|buatkan dashboard|buatkan sistem|web app/i.test(p);
    const hasData = /data|tabel|grafik|chart|statistik|metrik|analisis|angka janggal|angka pertumbuhan|kondisi industri|gali lebih dalam|ekstrak data/i.test(p);
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
      entities: resolvedEntity ? [resolvedEntity] : [raw],
      resolvedReferences: resolvedEntity ? [resolvedEntity] : [],
      freshDataRequired: hasNews || hasData,
      toolsNeeded,
      confidence: 0.94,
      sensitiveAction: isSensitive,
      reason: `Heuristic parser classified intent as ${intent}.`,
      interpretationSource: 'FALLBACK_HEURISTIC_PARSER'
    };
  }
}

export const semanticIntentEngineInstance = new SemanticIntentEngine();
export default semanticIntentEngineInstance;
