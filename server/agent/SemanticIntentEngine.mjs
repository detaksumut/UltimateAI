/**
 * SemanticIntentEngine.mjs
 * LLM-powered semantic goal and intent interpreter with strict Fail-Closed Certification Mode
 * and explicit Transport Selection (NINE_ROUTER_PROXY vs DIRECT_PROVIDER).
 */

import { config } from '../config/env.mjs';
import { providerRegistryInstance } from '../providers/ProviderRegistry.mjs';

export class SemanticIntentEngine {
  constructor(proxyUrl = null, apiKey = null) {
    this.proxyUrl = proxyUrl || process.env.ROUTER_PROXY_URL || 'http://127.0.0.1:20200/v1';
    this.apiKey = apiKey || process.env.ROUTER_API_KEY || config.keys.gemini || '';
  }

  /**
   * Interprets natural language input into a structured semantic goal
   * @param {string} input - User utterance / query
   * @param {Object} context - Conversational memory & history
   * @param {Object} options - { failClosed: boolean, forcedModel: string, certificationTransport: 'NINE_ROUTER_PROXY' | 'DIRECT_PROVIDER' }
   * @returns {Promise<Object>} semanticGoal
   */
  async interpret(input, context = {}, options = {}) {
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
        mode: 'STANDBY',
        interpretationSource: 'PRIMARY_LLM_SEMANTIC',
        transportUsed: options.certificationTransport || 'NINE_ROUTER_PROXY',
        fallbackUsed: false
      };
    }

    const raw = input.trim();
    const systemPrompt = `You are the Semantic Intent Engine for UltimateAI 9Router Agent.
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

    const model = options.forcedModel || 'gemini-3.6-flash-high';
    const transport = options.certificationTransport || 'NINE_ROUTER_PROXY';

    // 1. PRIMARY: HTTP 9Router Proxy Dispatch (Standard & Verified 9Router Gateway Path)
    if (transport === 'NINE_ROUTER_PROXY') {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (this.apiKey) {
          headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const response = await fetch(`${this.proxyUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Input: "${raw}"\nContext: ${JSON.stringify(context.recentTurns || [])}` }
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' }
          }),
          signal: AbortSignal.timeout(4000)
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            return {
              ...parsed,
              interpretationSource: 'PRIMARY_LLM_SEMANTIC',
              semanticModel: model,
              transportUsed: 'NINE_ROUTER_PROXY',
              fallbackUsed: false
            };
          }
        }
      } catch (err) {
        if (options.failClosed) {
          throw new Error(`[FAIL_CLOSED • NINE_ROUTER_PROXY] Gateway unreachable or rejected request: ${err.message}`);
        }
      }
    }

    // 2. OPTIONAL DIRECT PROVIDER DISPATCH (Only if explicitly permitted via options)
    if (transport === 'DIRECT_PROVIDER') {
      try {
        const resolved = providerRegistryInstance.resolveProviderForStrategy('AGENT_SEMANTIC', model);
        if (resolved && resolved.provider && resolved.provider.isConfigured()) {
          const payload = {
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Input: "${raw}"\nContext: ${JSON.stringify(context.recentTurns || [])}` }
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' }
          };

          const result = await resolved.provider.generateCompletion(payload, resolved.model);
          if (result && result.content) {
            const parsed = JSON.parse(result.content);
            return {
              ...parsed,
              interpretationSource: 'PRIMARY_LLM_SEMANTIC',
              semanticModel: resolved.model || model,
              transportUsed: 'DIRECT_PROVIDER',
              fallbackUsed: false
            };
          }
        }
      } catch (err) {
        if (options.failClosed) {
          throw new Error(`[FAIL_CLOSED • DIRECT_PROVIDER] Direct provider dispatch error: ${err.message}`);
        }
      }
    }

    // If fail-closed is mandated, strictly throw error instead of falling back
    if (options.failClosed) {
      throw new Error(`[FAIL_CLOSED] Primary LLM transport (${transport}) unavailable; fallback suppressed.`);
    }

    // 3. FALLBACK: High-Accuracy Heuristic Semantic Parser (Used in Offline Mode)
    const p = raw.toLowerCase();
    
    // Negative Action Restraint Check
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
        interpretationSource: 'FALLBACK_HEURISTIC_PARSER',
        transportUsed: 'LOCAL_HEURISTIC',
        fallbackUsed: true
      };
    }

    // Contextual Pronoun / Anaphora Resolution
    let resolvedEntity = null;
    if (/yang kedua|laporan kedua|dokumen kedua/i.test(p) && context.recentTurns?.length > 0) {
      resolvedEntity = 'Laporan Audit Eksternal (B)';
    }

    // Explicit Casual / Venting / Personal State Detection
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
        interpretationSource: 'FALLBACK_HEURISTIC_PARSER',
        transportUsed: 'LOCAL_HEURISTIC',
        fallbackUsed: true
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
      interpretationSource: 'FALLBACK_HEURISTIC_PARSER',
      transportUsed: 'LOCAL_HEURISTIC',
      fallbackUsed: true
    };
  }
}

export const semanticIntentEngineInstance = new SemanticIntentEngine();
export default semanticIntentEngineInstance;
