/**
 * SemanticIntentEngine.mjs
 * Phase 4B & 4G & 4H: LLM-Powered Contextual Goal & Intent Interpreter.
 * 
 * Capabilities:
 *  - Dynamic Intent Derivation (Goal, Entities, Constraints, Unknowns, Context).
 *  - Deep Coreference Resolution ("itu", "yang tadi", "yang kedua", "di situs itu", "yang saya maksud", "lanjutkan").
 *  - Real-time Task Control ("tunggu", "berhenti", "lanjutkan", "ubah", "jangan lakukan itu", "cukup sampai sini").
 *  - Negative & Positive Constraint Enforcement ("Jangan pakai internet" -> forbids web tools).
 *  - Dynamic Tool Selection: web.fetch, web.search, sandbox.execute, threat.feed, doc.analyze, memory.vault.
 *  - Zero hardcoded keyword mappings in primary cognitive path.
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
        const res = await resolved.provider.generateCompletion({
          model: resolved.model,
          prompt: `${systemPrompt}\n\n${userMessage}`,
          temperature: 0.1,
          jsonMode: true
        });

        if (res?.content) {
          const parsed = JSON.parse(res.content);
          return {
            ...parsed,
            interpretationSource: 'DIRECT_PROVIDER',
            semanticModel: resolved.model,
            transportUsed: 'DIRECT_PROVIDER',
            fallbackUsed: false
          };
        }
      } catch (err) {
        if (options.failClosed) {
          throw new Error(`[FAIL_CLOSED • DIRECT_PROVIDER] Provider failure: ${err.message}`);
        }
      }
    }

    // 3. STRUCTURAL CONTEXTUAL FALLBACK (Offline Resilient Mode)
    return this._offlineContextualReasoning(raw, context, options);
  }

  _buildSystemPrompt() {
    return `You are the Autonomous Cognitive Intent & Planning Engine for JIN.
Your role is to deeply analyze user utterances in the context of the ongoing conversation history.

Rules:
1. Reason about the USER'S TRUE GOAL, context, constraints, and implicit references.
2. Resolve COREFERENCES dynamically ("itu", "yang tadi", "yang kedua", "di situs itu", "dokumen yang barusan").
3. Detect USER CORRECTIONS and redirect/update task goals accordingly without blind restarts.
4. Detect REAL-TIME TASK CONTROLS ("tunggu", "berhenti", "lanjutkan", "ubah", "jangan lakukan itu", "cukup sampai sini").
5. Enforce CONSTRAINTS strictly (e.g. if user says "Jangan pakai internet", NEVER select web tools).
6. Tool selection is DYNAMIC based purely on necessity:
   - web.fetch: Direct live URL reading & DOM inspection (when URL is provided or referenced).
   - web.search: Broad search for recent news or external queries.
   - sandbox.execute: Isolated safe code execution, transformations, or calculations.
   - threat.feed: Ingesting/scoring cybersecurity threat feeds.
   - doc.analyze: Document analysis.
   - memory.vault: Storing or querying persistent facts.

Output STRICT valid JSON:
{
  "intent": "<CASUAL_CHAT|RESEARCH_QUESTION|URL_INSPECTION|DOCUMENT_ANALYSIS|DATA_ANALYTICS|MEMORY_STORE|MEMORY_RETRIEVAL|MULTI_STEP_TASK|APP_SYNTHESIS|MEDIA_PLAYBACK|CONSTRAINT_UPDATE|CORRECTION|TASK_CONTROL|CLARIFICATION_REQUEST>",
  "goal": "<concise resolved goal>",
  "resolvedReferences": ["<resolved coreference entities>"],
  "actionRequired": <boolean>,
  "taskControlAction": "<PAUSE|RESUME|STOP|MODIFY|null>",
  "entities": ["<key entities>"],
  "constraints": ["<active constraints>"],
  "isCorrecting": <boolean>,
  "isContinuing": <boolean>,
  "freshDataRequired": <boolean>,
  "toolsNeeded": ["<tool_id>"],
  "toolReason": "<rationale for tool choice or omission>",
  "needsClarification": <boolean>,
  "clarificationQuestion": "<question if clarification needed>",
  "confidence": <0.0 to 1.0>,
  "reason": "<brief cognitive chain>"
}`;
  }

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

ACTIVE CONSTRAINTS:
${constraints}

USER CORRECTIONS:
${userCorrections}

PREVIOUS TOOL RESULTS:
${previousToolResults}

RELEVANT LONG-TERM MEMORY:
${longTermMemory}

Analyze contextually and output strict JSON.`;
  }

  /**
   * Offline Contextual Reasoning Engine:
   * Resolves coreferences, negative constraints, URL inspections, and task controls.
   */
  _offlineContextualReasoning(raw, context, options) {
    const rawLower = raw.toLowerCase();
    const history = context.recentTurns || [];
    const activeConstraints = [...(context.constraints || [])];

    // 1. Task Controls: "tunggu", "berhenti", "lanjutkan", "cukup", "jangan lakukan itu"
    if (/^(tunggu|pause|berhenti|stop|batalkan|cancel)\b/i.test(raw)) {
      return {
        intent: 'TASK_CONTROL',
        goal: 'Hentikan / Jeda eksekusi tugas yang sedang berlangsung',
        taskControlAction: 'PAUSE',
        actionRequired: false,
        resolvedReferences: [],
        entities: [],
        constraints: activeConstraints,
        isCorrecting: false,
        isContinuing: false,
        freshDataRequired: false,
        toolsNeeded: [],
        toolReason: 'Perintah kontrol langsung dari pengguna untuk menjeda/menghentikan.',
        confidence: 0.95,
        reason: 'User issued a pause/stop control command.',
        interpretationSource: 'OFFLINE_CONTEXTUAL_ENGINE',
        transportUsed: 'LOCAL_REASONING',
        fallbackUsed: true
      };
    }

    if (/^(lanjutkan|teruskan|resume|jalan lagi)\b/i.test(raw)) {
      return {
        intent: 'TASK_CONTROL',
        goal: 'Lanjutkan eksekusi langkah tugas sebelumnya',
        taskControlAction: 'RESUME',
        actionRequired: true,
        resolvedReferences: [],
        entities: [],
        constraints: activeConstraints,
        isCorrecting: false,
        isContinuing: true,
        freshDataRequired: false,
        toolsNeeded: context.activeTask?.pendingTools || [],
        toolReason: 'Melanjutkan tugas yang tertunda sesuai konteks sesi.',
        confidence: 0.95,
        reason: 'User issued a resume command.',
        interpretationSource: 'OFFLINE_CONTEXTUAL_ENGINE',
        transportUsed: 'LOCAL_REASONING',
        fallbackUsed: true
      };
    }

    // 2. Negative Constraints: "Jangan pakai internet", "tanpa internet", "jangan cari web"
    const hasNegativeInternetConstraint = /jangan\s+(pakai|gunakan|cari|akses)?\s*(internet|web|online)|tanpa\s+internet/i.test(raw);
    if (hasNegativeInternetConstraint) {
      activeConstraints.push('NO_INTERNET_ACCESS');
    }

    const isNoInternetRestricted = activeConstraints.some(c => /no_internet|jangan pakai internet|tanpa internet/i.test(c)) || hasNegativeInternetConstraint;

    // 3. User Correction & Redirection: "Bukan yang itu", "Saya maksud dokumen kedua", "Kembali ke poin kedua"
    const isCorrection = /bukan\s+(yang\s+itu|itu)|maksud\s+saya|koreksi|ralat|kembali\s+ke\s+poin/i.test(raw);
    let resolvedRefs = [];

    // Coreference extraction: look up previous entities/URLs in turn history
    const urlInUtterance = raw.match(/https?:\/\/[^\s]+/i);
    let targetUrl = urlInUtterance ? urlInUtterance[0] : null;

    if (!targetUrl) {
      // Look back for URLs in previous conversation turns
      for (let i = history.length - 1; i >= 0; i--) {
        const turnText = history[i].content || '';
        const prevUrlMatch = turnText.match(/https?:\/\/[^\s]+/i);
        if (prevUrlMatch) {
          targetUrl = prevUrlMatch[0];
          resolvedRefs.push(`URL: ${targetUrl}`);
          break;
        }
      }
    }

    // Reference to "dokumen kedua" / "poin kedua"
    if (/kedua|kedua\s+tadi|dokumen\s+2|poin\s+2/i.test(raw)) {
      resolvedRefs.push('ITEM_INDEX_2');
    }

    // Reference to "situs itu" / "yang tadi"
    if (/situs\s+(itu|tersebut)|yang\s+tadi/i.test(raw) && targetUrl) {
      resolvedRefs.push(`TARGET_WEBSITE: ${targetUrl}`);
    }

    // 4. Determine toolsNeeded strictly respecting constraints
    let toolsNeeded = [];
    let toolReason = 'Analisis murni berbasis konteks dan memori percakapan.';

    if (!isNoInternetRestricted) {
      if (targetUrl && /buka|periksa|cek|analisis|kunjungi|fetch/i.test(raw)) {
        toolsNeeded.push('web.fetch');
        toolReason = `Membuka dan memeriksa konten langsung dari URL: ${targetUrl}`;
      } else if (/cari|search|berita|informasi terbaru/i.test(raw)) {
        toolsNeeded.push('web.search');
        toolReason = 'Mencari informasi relevan terkini dari web.';
      }
    } else {
      toolReason = 'Akses internet dilarang oleh batasan aktif pengguna (NO_INTERNET_ACCESS). Menggunakan data konteks yang sudah ada.';
    }

    // Safe Code Computation
    if (/hitung|kalkulasi|jalankan kode|transformasi data|eksekusi/i.test(raw) && !/jangan eksekusi/i.test(raw)) {
      toolsNeeded.push('sandbox.execute');
      toolReason = 'Eksekusi kalkulasi atau transformasi kode dalam sandbox aman terisolasi.';
    }

    // Memory storage
    if (/simpan|ingat|catat ke vault/i.test(raw)) {
      toolsNeeded.push('memory.vault');
      toolReason = 'Penyimpanan entitas pengetahuan ke Memory Vault.';
    }

    return {
      intent: targetUrl ? 'URL_INSPECTION' : (isCorrection ? 'CORRECTION' : 'RESEARCH_QUESTION'),
      goal: raw,
      resolvedReferences: resolvedRefs,
      actionRequired: toolsNeeded.length > 0 || isCorrection,
      entities: resolvedRefs,
      constraints: activeConstraints,
      isCorrecting: isCorrection,
      isContinuing: Boolean(context.activeTask),
      freshDataRequired: toolsNeeded.includes('web.fetch') || toolsNeeded.includes('web.search'),
      toolsNeeded,
      toolReason,
      needsClarification: false,
      clarificationQuestion: null,
      confidence: 0.90,
      reason: 'Offline contextual reasoning resolved references, constraints, and tools dynamically.',
      interpretationSource: 'OFFLINE_CONTEXTUAL_ENGINE',
      transportUsed: 'LOCAL_REASONING',
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
      constraints: [],
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
