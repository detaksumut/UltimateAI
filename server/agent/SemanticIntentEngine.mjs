/**
 * SemanticIntentEngine.mjs
 * LLM-powered contextual goal interpreter.
 * PRIMARY: LLM reasons about goal, context, constraints, and coreferences.
 * FALLBACK (offline only): Structural safe-mode with NO keyword-to-tool mapping.
 *
 * ARCHITECTURE RULE:
 * Keywords / regex are NEVER the intelligence authority.
 * The LLM reads the full conversation context and produces a structured decision.
 * Hardcoded intent-to-tool mapping is FORBIDDEN.
 */

import { config } from '../config/env.mjs';
import { providerRegistryInstance } from '../providers/ProviderRegistry.mjs';

export class SemanticIntentEngine {
  constructor(proxyUrl = null, apiKey = null) {
    this.proxyUrl = proxyUrl || process.env.ROUTER_PROXY_URL || 'http://127.0.0.1:20200/v1';
    this.apiKey = apiKey || process.env.ROUTER_API_KEY || config.keys.gemini || '';
  }

  /**
   * Interprets natural language input into a structured semantic goal.
   * The LLM receives full conversation history, active task state, user corrections,
   * and available tools. It reasons about the GOAL, not keyword presence.
   *
   * @param {string} input - Current user utterance
   * @param {Object} context - Full conversation context:
   *   {
   *     recentTurns,         // [{role, content}] last N conversation turns
   *     activeTask,          // Current in-progress task state
   *     entities,            // Resolved entities from prior turns
   *     constraints,         // Active user-set constraints (e.g., "do not search internet")
   *     userCorrections,     // Prior user corrections to JIN's assumptions
   *     previousToolResults, // Results from last tool invocations
   *     unresolvedQuestions, // What JIN asked but user hasn't answered yet
   *     longTermMemory       // Relevant facts from memory vault
   *   }
   * @param {Object} options - { failClosed, forcedModel, certificationTransport }
   * @returns {Promise<Object>} semanticGoal
   */
  async interpret(input, context = {}, options = {}) {
    if (!input || !input.trim()) {
      return this._emptyUtterance(options);
    }

    const raw = input.trim();
    const model = options.forcedModel || 'gemini-3.6-flash-high';
    const transport = options.certificationTransport || 'NINE_ROUTER_PROXY';

    // Build rich contextual prompt for the LLM
    const systemPrompt = this._buildSystemPrompt();
    const userMessage = this._buildUserMessage(raw, context);

    // 1. PRIMARY: HTTP 9Router Proxy Dispatch
    if (transport === 'NINE_ROUTER_PROXY') {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

        const response = await fetch(`${this.proxyUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage }
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' }
          }),
          signal: AbortSignal.timeout(5000)
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
          throw new Error(`[FAIL_CLOSED • NINE_ROUTER_PROXY] Gateway unreachable: ${err.message}`);
        }
      }
    }

    // 2. OPTIONAL DIRECT PROVIDER DISPATCH
    if (transport === 'DIRECT_PROVIDER') {
      try {
        const resolved = providerRegistryInstance.resolveProviderForStrategy('AGENT_SEMANTIC', model);
        if (resolved?.provider?.isConfigured()) {
          const result = await resolved.provider.generateCompletion({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage }
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' }
          }, resolved.model);
          if (result?.content) {
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
          throw new Error(`[FAIL_CLOSED • DIRECT_PROVIDER] Direct provider error: ${err.message}`);
        }
      }
    }

    if (options.failClosed) {
      throw new Error(`[FAIL_CLOSED] Primary LLM transport (${transport}) unavailable; fallback suppressed.`);
    }

    // 3. OFFLINE SAFE-MODE: Structural analysis with NO keyword→tool mapping.
    // This is a minimal triage, not intelligence. The LLM decides tools, not keywords.
    return this._offlineSafeMode(raw, context, options);
  }

  /**
   * System prompt that instructs the LLM to reason contextually, NOT keyword-match.
   */
  _buildSystemPrompt() {
    return `You are the Semantic Goal Interpreter for UltimateAI JIN Agent.

Your job is to deeply understand what the user ACTUALLY WANTS given the full conversation context.

CRITICAL RULES:
1. Resolve coreferences ("itu", "yang tadi", "lanjutkan", "yang kedua") from conversation history.
2. Detect user corrections and update your understanding of the active task.
3. Infer the GOAL, not just the surface words.
4. Identify whether the user is: starting a task, continuing a task, correcting JIN, asking a question, setting a constraint, or requesting an action.
5. Determine whether external real-time information is genuinely needed.
6. Respect active constraints (e.g., "jangan cari internet", "gunakan dokumen saja").
7. Tools should ONLY be selected if the goal cannot be achieved from context/memory alone.
8. Identify the intent type from the user's GOAL, NOT from keyword presence.

Available intents:
- CASUAL_CHAT: Greeting, personal expression, casual question answerable from general knowledge
- RESEARCH_QUESTION: Needs current or external information, search, or synthesis
- DOCUMENT_ANALYSIS: Requires reading/analyzing a user-provided document
- DATA_ANALYTICS: Requires structured data extraction, comparison, or statistical analysis
- MEMORY_STORE: User wants to save a fact or instruction for future use
- MEMORY_RETRIEVAL: User wants JIN to recall stored information
- MULTI_STEP_TASK: Complex goal requiring multiple coordinated steps
- APP_SYNTHESIS: Creating a software artifact, UI, or prototype
- MEDIA_PLAYBACK: Playing video, audio, or media content
- CONSTRAINT_UPDATE: User is setting or changing a constraint on JIN's behavior
- CORRECTION: User is correcting JIN's prior response or assumption
- CLARIFICATION_REQUEST: JIN needs more information before acting

Available tools (select ONLY when genuinely required by the goal):
- web.search: Real-time web search for current events, news, or external facts
- doc.analyze: Analyze user-provided document content
- data.matrix_generator: Generate structured data matrices and analytics
- memory.vault: Store or retrieve user-specified facts and context
- intel.multilayer_search: Multi-layer intelligence search including news
- media.video_resolver: Resolve and play video/audio media
- spec.blueprint_architect: Design software specifications
- code.synthesizer: Generate code artifacts
- ui.render_app_sandbox: Render UI previews

Output STRICT valid JSON:
{
  "intent": "<intent_type>",
  "goal": "<concise goal description resolved from full context>",
  "resolvedReferences": ["<resolved coreference entities>"],
  "actionRequired": <boolean - false for pure chat>,
  "entities": ["<key entities>"],
  "constraints": ["<active constraints from conversation>"],
  "isCorrecting": <boolean - true if user is correcting prior JIN output>,
  "isContinuing": <boolean - true if continuing a prior task>,
  "freshDataRequired": <boolean - true ONLY if real-time information is essential>,
  "toolsNeeded": ["<tool_id>"],
  "toolReason": "<one sentence: why these tools are needed, or why no tools are needed>",
  "needsClarification": <boolean - true if critical information is missing>,
  "clarificationQuestion": "<specific question to ask if needsClarification is true>",
  "confidence": <0.0 to 1.0>,
  "reason": "<brief reasoning chain>"
}`;
  }

  /**
   * Build the user message including full conversation context.
   */
  _buildUserMessage(utterance, context) {
    const recentTurns = (context.recentTurns || []).slice(-10);
    const activeTask = context.activeTask ? JSON.stringify(context.activeTask) : 'None';
    const constraints = (context.constraints || []).join('; ') || 'None';
    const userCorrections = (context.userCorrections || []).join('; ') || 'None';
    const previousToolResults = context.previousToolResults
      ? JSON.stringify(context.previousToolResults).substring(0, 400)
      : 'None';
    const longTermMemory = context.longTermMemory
      ? JSON.stringify(context.longTermMemory).substring(0, 300)
      : 'None';

    return `CURRENT USER UTTERANCE:
"${utterance}"

CONVERSATION HISTORY (last 10 turns):
${JSON.stringify(recentTurns, null, 2)}

ACTIVE TASK STATE:
${activeTask}

ACTIVE CONSTRAINTS (set by user):
${constraints}

USER CORRECTIONS IN THIS SESSION:
${userCorrections}

PREVIOUS TOOL RESULTS:
${previousToolResults}

RELEVANT LONG-TERM MEMORY:
${longTermMemory}

Analyze the above holistically. Resolve all references. Determine the user's true goal. Output JSON.`;
  }

  /**
   * Offline safe-mode: minimal structural analysis.
   * Does NOT map keywords to tools. Defaults to RESEARCH_QUESTION with web.search
   * only if fresh data is explicitly stated as needed by conversational context.
   * The LLM (when available) is the sole authority on tool selection.
   */
  _offlineSafeMode(raw, context, options) {
    // Only constraint detection is structural (respects explicit user commands)
    const isConstraintNo = /jangan\s+(cari|search|internet|gunakan internet|pakai internet|eksekusi)|gunakan\s+hanya\s+dokumen|hanya\s+dokumen|tunggu\s+dulu/i.test(raw);
    const isCorrection = /yang tadi salah|bukan itu|maksud saya|yang saya maksud|koreksi|ralat|ubah bagian/i.test(raw);
    const isMemStore = /simpan ini|ingat ini|catat ini|simpan ke vault|ingat fakta|ingat bahwa/i.test(raw);
    const isMemRecall = /apa yang kamu ingat|ingat tidak|apa yang tersimpan|cari di memory vault/i.test(raw);

    if (isConstraintNo) {
      return {
        intent: 'CONSTRAINT_UPDATE',
        goal: raw,
        resolvedReferences: [],
        actionRequired: false,
        entities: [],
        constraints: [raw],
        isCorrecting: false,
        isContinuing: false,
        freshDataRequired: false,
        toolsNeeded: [],
        toolReason: 'User explicitly set a constraint. No tools needed.',
        needsClarification: false,
        clarificationQuestion: null,
        confidence: 0.92,
        reason: 'User issued a behavioral constraint.',
        interpretationSource: 'OFFLINE_SAFE_MODE',
        transportUsed: 'LOCAL_SAFE_MODE',
        fallbackUsed: true
      };
    }

    if (isCorrection) {
      return {
        intent: 'CORRECTION',
        goal: raw,
        resolvedReferences: [],
        actionRequired: true,
        entities: [],
        constraints: context.constraints || [],
        isCorrecting: true,
        isContinuing: true,
        freshDataRequired: false,
        toolsNeeded: [],
        toolReason: 'User is correcting prior output. Re-evaluate task from context.',
        needsClarification: false,
        clarificationQuestion: null,
        confidence: 0.88,
        reason: 'User correction detected.',
        interpretationSource: 'OFFLINE_SAFE_MODE',
        transportUsed: 'LOCAL_SAFE_MODE',
        fallbackUsed: true
      };
    }

    if (isMemStore) {
      return {
        intent: 'MEMORY_STORE',
        goal: raw,
        resolvedReferences: [],
        actionRequired: true,
        entities: [],
        constraints: context.constraints || [],
        isCorrecting: false,
        isContinuing: false,
        freshDataRequired: false,
        toolsNeeded: ['memory.vault'],
        toolReason: 'User explicitly requested storing information.',
        needsClarification: false,
        clarificationQuestion: null,
        confidence: 0.90,
        reason: 'Explicit memory store instruction.',
        interpretationSource: 'OFFLINE_SAFE_MODE',
        transportUsed: 'LOCAL_SAFE_MODE',
        fallbackUsed: true
      };
    }

    if (isMemRecall) {
      return {
        intent: 'MEMORY_RETRIEVAL',
        goal: raw,
        resolvedReferences: [],
        actionRequired: true,
        entities: [],
        constraints: context.constraints || [],
        isCorrecting: false,
        isContinuing: false,
        freshDataRequired: false,
        toolsNeeded: ['memory.vault'],
        toolReason: 'User explicitly requested recalling stored information.',
        needsClarification: false,
        clarificationQuestion: null,
        confidence: 0.90,
        reason: 'Explicit memory recall instruction.',
        interpretationSource: 'OFFLINE_SAFE_MODE',
        transportUsed: 'LOCAL_SAFE_MODE',
        fallbackUsed: true
      };
    }

    // Default: RESEARCH_QUESTION — let the agent reason from context
    return {
      intent: 'RESEARCH_QUESTION',
      goal: raw,
      resolvedReferences: [],
      actionRequired: true,
      entities: [],
      constraints: context.constraints || [],
      isCorrecting: false,
      isContinuing: context.activeTask ? true : false,
      freshDataRequired: false,
      toolsNeeded: ['web.search'],
      toolReason: 'Offline safe mode: defaulting to research. LLM will refine when online.',
      needsClarification: false,
      clarificationQuestion: null,
      confidence: 0.70,
      reason: 'Offline safe mode structural fallback (LLM unavailable).',
      interpretationSource: 'OFFLINE_SAFE_MODE',
      transportUsed: 'LOCAL_SAFE_MODE',
      fallbackUsed: true
    };
  }

  _emptyUtterance(options) {
    return {
      intent: 'CASUAL_CHAT',
      goal: '',
      resolvedReferences: [],
      actionRequired: false,
      entities: [],
      freshDataRequired: false,
      toolsNeeded: [],
      toolReason: 'Empty utterance.',
      confidence: 1.0,
      reason: 'Empty user utterance.',
      needsClarification: false,
      clarificationQuestion: null,
      interpretationSource: 'PRIMARY_LLM_SEMANTIC',
      transportUsed: options.certificationTransport || 'NINE_ROUTER_PROXY',
      fallbackUsed: false
    };
  }
}

export const semanticIntentEngineInstance = new SemanticIntentEngine();
export default semanticIntentEngineInstance;
