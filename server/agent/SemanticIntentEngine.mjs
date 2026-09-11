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
import { providerIntelligenceRouterInstance, SCOPE, PROVIDER, FALLBACK_RESTRICTION } from '../routing/ProviderIntelligenceRouter.mjs';
import { classifyMarketIntent } from '../market/marketIntentRouter.mjs';

export class SemanticIntentEngine {
  constructor(proxyUrl = null, apiKey = null) {
    this.proxyUrl = proxyUrl || process.env.ROUTER_PROXY_URL || 'http://127.0.0.1:20200/v1';
    this.apiKey = apiKey || process.env.ROUTER_API_KEY || '';
  }

  /**
   * Interprets natural language input into a structured semantic goal.
   */
  async interpret(input, context = {}, options = {}) {
    if (!input || !input.trim()) {
      return this._emptyUtterance(options);
    }

    const raw = input.trim();

    const model = options.forcedModel || 'qwen3:8b';
    const transport = options.certificationTransport || 'LOCAL_ROUTER_PROXY';

    // Build rich contextual prompt for the LLM
    const systemPrompt = this._buildSystemPrompt();
    const userMessage = this._buildUserMessage(raw, context);

    // 1. PRIMARY: HTTP Local Router Proxy Dispatch
    if (transport === 'LOCAL_ROUTER_PROXY') {
      try {
        const headers = { 'Content-Type': 'application/json', 'x-jin-agent': 'semantic_intent' };
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
            response_format: { type: 'json_object' },
            skipIntentGate: true
          }),
          signal: AbortSignal.timeout(60000)
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            return this._injectScope(raw, {
              ...parsed,
              interpretationSource: 'PRIMARY_LLM_SEMANTIC',
              semanticModel: model,
              transportUsed: 'LOCAL_ROUTER_PROXY',
              fallbackUsed: false
            });
          }
        }
      } catch (err) {
        if (options.failClosed) {
          throw new Error(`[FAIL_CLOSED • LOCAL_ROUTER_PROXY] Gateway unreachable: ${err.message}`);
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
          return this._injectScope(raw, {
            ...parsed,
            interpretationSource: 'DIRECT_PROVIDER',
            semanticModel: resolved.model,
            transportUsed: 'DIRECT_PROVIDER',
            fallbackUsed: false
          });
        }
      } catch (err) {
        if (options.failClosed) {
          throw new Error(`[FAIL_CLOSED • DIRECT_PROVIDER] Provider failure: ${err.message}`);
        }
      }
    }

    // 3. STRUCTURAL CONTEXTUAL FALLBACK (Offline Resilient Mode)
    const offlineDecision = this._offlineContextualReasoning(raw, context, options);
    return this._injectScope(raw, offlineDecision);
  }

  _deviceInspectionDecision(raw, context) {
    const activeConstraints = [...(context.constraints || [])];
    const deviceIntentPattern = /kondisi\s+(komputer|pc|laptop|sistem|device)|(cek|periksa|lihat|tampilkan|check|info)\s+(.*?\s+)?(ram|memory|memori|cpu|disk|storage|proses|process|spesifikasi|spec|device|sistem|system)|penggunaan\s+(ram|memory|memori|cpu|disk)|sisa\s+(ram|memory|memori|storage|disk|ruang)|\b(proses|process)\b.*\b(berjalan|memakai|paling|terbanyak|penggunaan|memory|memori|ram)\b|\b(memory|memori|ram)\b.*\b(proses|process)\b|berat\s+ini|lambat\s+ini|lemot|apa\s+yang\s+membuat\s+(komputer|pc|laptop)\s+(saya\s+)?(berat|lambat|lemot)|(komputer|pc|laptop)\s+(saya\s+)?(berat|lambat|lemot)\?|komputer\s+(berat|lambat|lemot)|kondisi\s+ultimate\s*ai|ultimate\s*ai|(cek|periksa|lihat)\s+(storage|disk|penyimpanan)|kesehatan\s+(komputer|sistem|pc|device)|berapa\s+(ram|memory|cpu|disk|storage)|disk\s+space|cpu\s+usage|ram\s+usage|system\s+info|info\s+system|device\s+info|info\s+device|cek\s+device|check\s+device/i;
    const nonDeviceContextPattern = /situs|website|url|berita|di\s+web|internet|dokumen|file\s+(ini|tersebut)|laporan|tugas|isi\s+dokumen|surat|kode\s+program|source\s+code/i;
    if (!deviceIntentPattern.test(raw) || nonDeviceContextPattern.test(raw)) {
      return null;
    }
    let scope = 'overview';
    if (/ultimate\s*ai|vite|local\s+router|backend|server\s+ultra|ollama|community\s+router/i.test(raw)) {
      scope = 'runtime';
    } else if (/proses|process/i.test(raw)) {
      scope = 'process';
    } else if (/ram|memory|memori/i.test(raw)) {
      scope = 'memory';
    } else if (/storage|disk|penyimpanan/i.test(raw)) {
      scope = 'storage';
    } else if (/berat|lambat|lemot/i.test(raw)) {
      scope = 'diagnosis';
    }
    return {
      intent: 'DEVICE_INSPECTION',
      goal: `Inspect local device: ${scope}`,
      scope,
      actionRequired: true,
      resolvedReferences: [],
      entities: [scope],
      constraints: activeConstraints,
      isCorrecting: false,
      isContinuing: Boolean(context.activeTask),
      freshDataRequired: false,
      toolsNeeded: ['device.inspect'],
      toolReason: 'Permintaan terkait kondisi komputer lokal: observasi langsung perangkat (read-only, DEVICE_INTELLIGENCE).',
      needsClarification: false,
      clarificationQuestion: null,
      confidence: 0.93,
      reason: 'Device inspection intent recognized from local machine vocabulary.',
      interpretationSource: 'OFFLINE_CONTEXTUAL_ENGINE',
      transportUsed: 'LOCAL_REASONING',
      fallbackUsed: true
    };
  }

  _buildSystemPrompt() {
    return `You are the Autonomous Cognitive Intent & Planning Engine for JIN.
Your role is to deeply analyze user utterances in the context of the ongoing conversation history.

AUTONOMY RULES (MANDATORY):
- NEVER ask for clarification. NEVER use CLARIFICATION_REQUEST intent.
- When intent is unclear, EXECUTE the most reasonable interpretation.
- When user asks to create something, DO IT immediately without questions.
- When multiple tasks are requested, ORCHESTRATE them sequentially.
- ALWAYS set needsClarification=false and clarificationQuestion=null.
- UNDERSTAND THE USER'S REAL CONTEXT from the goal text itself, not just fixed patterns.

ROUTING INTENTS (use when applicable):
- PRESENTATION_REQUEST: every request to create a presentation/PPT/slideshow. Keywords: "presentasi", "PPT", "slide presentation". Extract: topic, slideCount, optional speakerName, optional speakerPhoto. Uses toolsNeeded=["presentation.generate"]. actionRequired=true. Two-phase workflow: Phase 1 = draft outline, Phase 2 = visual generation per slide.
- IMAGE_GENERATION: every request to create/generate a NEW image from scratch, including any 3D render or 3D object, uses only toolsNeeded=["image.generate"]. actionRequired=true.
- IMAGE_REVISION: every request to modify/re-render/update/revise an EXISTING visual that was created earlier in the conversation. The user references a previous visual using contextual cues like "nya", "yang tadi", "itu", "tersebut", "versi sebelumnya", or revision words like "revisi", "ubah", "ganti", "buat ulang", "edit", "modifikasi", "ulang". Uses toolsNeeded=["image.generate"]. actionRequired=true. MUST include referenceImage with the previous visual artifact URL.
- A 3D request is a normal visual image request. Never classify it as architecture, never create plans/elevations/models, and never invoke a dedicated 3D script.
- RESEARCH_TASK: deep research, investigation, study, or comparing sources → toolsNeeded=["web.search"]. freshDataRequired=true.
- EXTERNAL_DATA: real-time or internet-dependent facts (weather, prices, news, current info) → toolsNeeded=["web.search"]. freshDataRequired=true.

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
   - device.inspect: Local machine inspection (RAM, CPU, disk, processes, UltimateAI runtime). Purely read-only. Use when the user asks about their local computer ("kondisi komputer", "cek penggunaan RAM", "proses paling banyak pakai memory", "kondisi UltimateAI", "cek storage", "apa yang membuat komputer berat"). Output must include a "scope" field: "overview" | "memory" | "process" | "storage" | "runtime" | "diagnosis".
7. For IMAGE_GENERATION or IMAGE_REVISION, produce a visualIntent object from the user's meaning, not keyword substitution:
   {"mode":"GENERIC_IMAGE|SLIDE_VISUAL|ARCHITECTURAL_VISUAL","subject":"canonical subject","action":"requested action","environment":"requested setting","style":"requested style or realistic","composition":"requested composition","aspectRatio":"1:1|16:9|9:16","negativeConstraints":["incompatible subjects"],"providerPrompt":"complete faithful image prompt","referenceImage":"URL of previous visual artifact if IMAGE_REVISION, null otherwise","preserveElements":["elements to keep from previous visual if IMAGE_REVISION"],"modifyElements":["elements to change from previous visual if IMAGE_REVISION"]}
   The providerPrompt must explicitly identify the requested subject, preserve requested details, and never invent a person, character, wings, vehicle, or template.
   For IMAGE_REVISION, the providerPrompt must combine the preserved elements from the previous visual with the modification instructions.

Output STRICT valid JSON:
{
  "intent": "<PRESENTATION_REQUEST|CASUAL_CHAT|RESEARCH_QUESTION|URL_INSPECTION|DOCUMENT_ANALYSIS|DATA_ANALYTICS|MEMORY_STORE|MEMORY_RETRIEVAL|MULTI_STEP_TASK|APP_SYNTHESIS|MEDIA_PLAYBACK|DEVICE_INSPECTION|CONSTRAINT_UPDATE|CORRECTION|TASK_CONTROL|IMAGE_GENERATION|IMAGE_REVISION|RESEARCH_TASK|EXTERNAL_DATA>",
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
  "visualIntent": {
    "mode": "<GENERIC_IMAGE|SLIDE_VISUAL|ARCHITECTURAL_VISUAL|null>",
    "subject": "<canonical subject|null>",
    "action": "<requested action|null>",
    "environment": "<requested setting|null>",
    "style": "<style|null>",
    "composition": "<composition|null>",
    "aspectRatio": "<1:1|16:9|9:16|null>",
    "negativeConstraints": ["<incompatible subject or detail>"],
    "providerPrompt": "<complete faithful provider prompt|null>",
    "referenceImage": "<URL of previous visual artifact if IMAGE_REVISION, null otherwise>",
    "preserveElements": ["<elements to keep from previous visual if IMAGE_REVISION>"],
    "modifyElements": ["<elements to change from previous visual if IMAGE_REVISION>"]
  },
  "presentationIntent": {
    "topic": "<presentation topic|null>",
    "slideCount": <number of slides or null>,
    "speakerName": "<speaker name if provided, null otherwise>",
    "speakerPhoto": "<speaker photo URL if provided, null otherwise>",
    "phase": "<DRAFT|VISUAL|null>",
    "currentSlide": <current slide number for visual phase, null otherwise>
  },
  "needsClarification": false,
  "clarificationQuestion": null,
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
    // These classifiers are an outage fallback only. The normal path above
    // always asks the LLM to interpret the complete request and its context.
    const fallbackDecision =
      this._deterministicCasualChatClassifier(raw) ||
      this._deviceInspectionDecision(raw, context, options) ||
      this._presentationClassifier(raw) ||
      this._imageRevisionClassifier(raw, context.recentTurns || []) ||
      this._imageGenerationClassifier(raw, context.constraints || []) ||
      this._deterministicTaskClassifier(raw, context.constraints || []);
    if (fallbackDecision) {
      return {
        ...fallbackDecision,
        interpretationSource: 'OFFLINE_FALLBACK_CLASSIFIER',
        fallbackUsed: true
      };
    }

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
        interpretationSource: 'DETERMINISTIC_TASK_CONTROL',
        transportUsed: 'LOCAL_REASONING',
        fallbackUsed: false
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
        interpretationSource: 'DETERMINISTIC_TASK_CONTROL',
        transportUsed: 'LOCAL_REASONING',
        fallbackUsed: false
      };
    }

    // 2. CASUAL CHAT in offline path — catch greetings that slipped through
    const casualDecision = this._deterministicCasualChatClassifier(raw);
    if (casualDecision) {
      return casualDecision;
    }

    // 3. Negative Constraints: "Jangan pakai internet", "tanpa internet", "jangan cari web"
    const hasNegativeInternetConstraint = /jangan\s+(pakai|gunakan|cari|akses)?\s*(internet|web|online)|tanpa\s+internet/i.test(raw);
    if (hasNegativeInternetConstraint) {
      activeConstraints.push('NO_INTERNET_ACCESS');
    }

    const isNoInternetRestricted = activeConstraints.some(c => /no_internet|jangan pakai internet|tanpa internet/i.test(c)) || hasNegativeInternetConstraint;

    // 3. DEVICE INSPECTION (local, read-only, never needs internet)
    const deviceDecision = this._deviceInspectionDecision(raw, context, options);
    if (deviceDecision) {
      return deviceDecision;
    }

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

    // 5. DETERMINISTIC TASK CLASSIFIER — Safety net for LLM timeout/fallback
    //    If the LLM didn't classify the task, use regex to detect action categories.
    const taskDecision = this._deterministicTaskClassifier(raw, activeConstraints);
    if (taskDecision) {
      return taskDecision;
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

  /**
   * Inject sourceScope into any semantic decision using ProviderIntelligenceRouter.
   * Called on every return path to ensure scope is always present.
   */
  _injectScope(raw, decision) {
    const routing = providerIntelligenceRouterInstance.classifyScope(raw);
    return {
      ...decision,
      sourceScope: routing.scope,
      providerRouting: {
        preferredProvider: routing.preferredProvider,
        fallbackProvider: routing.fallbackProvider,
        fallbackRestriction: routing.fallbackRestriction,
        restrictions: routing.restrictions,
        requiresRealTimeData: routing.requiresRealTimeData
      }
    };
  }

  /**
   * Deterministic Casual Chat Classifier — Fast-path for greetings, thanks, identity questions.
   * Must run BEFORE device inspection and task classifier.
   *
   * CRITICAL: Only matches SHORT pure greetings. If the input contains action words
   * after a greeting (e.g. "Halo, tolong riset..."), it must NOT match here.
   * Those will be caught by the task classifier downstream.
   */
  _deterministicCasualChatClassifier(raw) {
    const r = raw.trim();

    // Pure greetings — no action words, no question marks (except identity questions)
    // Must be SHORT (< 30 chars for greetings, < 50 for identity questions)
    const isShort = r.length < 50;

    // Greeting patterns (standalone, no trailing action verbs)
    const greetingPattern = /^(halo|hai|hi|hey|hello|horas|selamat\s+(pagi|siang|sore|malam)|good\s+(morning|afternoon|evening)|yo|oi|oy|woi|assalamualaikum|salam)\s*[!!.]?\s*$/i;

    // Thank you patterns
    const thanksPattern = /^(terima\s+kasih|makasih|thanks|thank\s*you|thx|ty|mantap|keren|bagus\s+sekali|hebat)\s*[!!.]?\s*$/i;

    // Identity questions — "siapa kamu?", "kamu siapa?"
    const identityPattern = /^(siapa\s+kamu|kamu\s+siapa|apa\s+nama\s+kamu|siapa\s+nama\s+anda|who\s+are\s+you|what('?s|\s+is)\s+your\s+name)\s*[?!.]?\s*$/i;

    // Simple "apa kabar" and variants (with optional "hari ini" / "today")
    const wellbeingPattern = /^(?:apa\s+kabar|how\s+are\s+you|bagaimana\s+kabar|kamu\s+baik\s+saja|kabar\s+(?:baik|gimana|apa))(?:\s+(?:hari\s+ini|today))?\s*[?!.]?\s*$/i;

    // Greeting + optional JIN/AI handle — "Halo JIN", "Hai JIN!"
    const greetingNamePattern = /^(halo|hai|hi|hey|hello|horas|selamat\s+(pagi|siang|sore|malam)|good\s+(morning|afternoon|evening)|assalamualaikum|salam)[\s,*]*(jin|ai|eja|ultimate[\s-]*ai)?[\s,*]*[!!.]?\s*$/i;

    // Greeting + optional handle + wellbeing — "Halo JIN, apa kabar hari ini?", "Hai, how are you today?"
    const greetingWellbeingPattern = /^(?:halo|hai|hi|hey|hello|horas|selamat\s+(?:pagi|siang|sore|malam)|good\s+(?:morning|afternoon|evening|day)|assalamualaikum|salam)[\s,]*(?:jin|ai|eja)?[\s,]+(?:apa\s+kabar|how\s+are\s+you|bagaimana\s+kabar|kamu\s+baik\s+saja)(?:\s+(?:hari\s+ini|today))?\s*[?!.]?\s*$/i;

    // Simple "tidak apa-apa" / "sama-sama" responses
    const acknowledgmentPattern = /^(tidak\s+apa[\s\-]?apa|sama[\s\-]?sama|oke|ok|siap|baik|noted|understood|akan\s+ku\.?\s*ingat)\s*[!!.]?\s*$/i;

    if (!isShort) return null;

    if (greetingPattern.test(r) || greetingNamePattern.test(r) || greetingWellbeingPattern.test(r) ||
        thanksPattern.test(r) || identityPattern.test(r) || wellbeingPattern.test(r) ||
        acknowledgmentPattern.test(r)) {
      return {
        intent: 'CASUAL_CHAT',
        goal: r,
        resolvedReferences: [],
        actionRequired: false,
        entities: [],
        constraints: [],
        isCorrecting: false,
        isContinuing: false,
        freshDataRequired: false,
        toolsNeeded: [],
        toolReason: 'Sapaan, ucapan, atau percakapan kasual — tidak memerlukan aksi.',
        needsClarification: false,
        clarificationQuestion: null,
        confidence: 0.97,
        reason: 'Deterministic casual chat classifier: pure greeting/acknowledgment detected.',
        interpretationSource: 'DETERMINISTIC_CASUAL_CLASSIFIER',
        transportUsed: 'LOCAL_REASONING',
        fallbackUsed: false
      };
    }

    return null;
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
      interpretationSource: 'DETERMINISTIC_EMPTY_UTTERANCE',
      transportUsed: 'LOCAL_REASONING',
      fallbackUsed: false,
      sourceScope: SCOPE.LOCAL_ONLY,
      providerRouting: {
        preferredProvider: PROVIDER.OLLAMA,
        fallbackProvider: null,
        fallbackRestriction: FALLBACK_RESTRICTION.NONE,
        restrictions: [],
        requiresRealTimeData: false
      }
    };
  }

  /**
   * Deterministic Image Generation Classifier — Runs BEFORE generic task classifier.
   * Detects image generation requests and routes to IMAGE_GENERATION intent.
   * Matches Indonesian and English image creation vocabulary.
   * Explicitly excludes analysis/search of existing images (cari/temukan/analisis images).
   */
  _imageGenerationClassifier(raw, activeConstraints = []) {
    const r = raw;

    // Positive patterns: image creation intent
    const createImagePattern = /(?:buatkan?|buat|generate|create|bikin|hasilkan|render|desain|lukis(?:kan)?|gambar(?:kan)?|ilustrasi(?:kan)?|visual(?:kan)?)\s+(?:.*\s+)?(?:gambar|image|ilustrasi|visual|poster|logo|wallpaper|foto|lukisan|karya\s+visual|desain\s+visual|artwork|anime|carton|kartun|3d|rendering)/i;

    const standaloneImageWord = /(?:generate|create|buatkan?|buat|bikin|tolong\s+bikin)\s+(?:sebuah\s+)?(?:gambar|image|ilustrasi|visual|foto|lukisan|poster|logo|wallpaper|artwork|anime|kartun|3d|rendering)/i;

    const directGenerateKeyword = /(?:generate\s+image|create\s+an?\s+image|buat\s+gambar|buatkan\s+gambar|generate\s+gambar|tolong\s+(?:buatkan?|generate|create)\s+(?:sebuah\s+)?(?:gambar|image|visual|foto|ilustrasi))/i;

    const gambarkanPattern = /^gambarkan\s+/i;

    // Negative patterns: exclude analysis/search/description of existing images
    const negativeExclude = /(?:analisis|analysis|jelaskan|deskripsikan|bedah|baca|cari|temukan|search|find|lihat|tampilkan|download|unduh|simpan|hapus)\s+(?:.*\s+)?(?:gambar|image|foto|lukisan|ilustrasi)/i;

    const isNegative = negativeExclude.test(r);
    const matchesPositive = createImagePattern.test(r) || standaloneImageWord.test(r) || directGenerateKeyword.test(r) || gambarkanPattern.test(r);

    if (matchesPositive && !isNegative) {
      return {
        intent: 'IMAGE_GENERATION',
        goal: r,
        resolvedReferences: [],
        actionRequired: true,
        entities: ['image_generation'],
        constraints: activeConstraints,
        isCorrecting: false,
        isContinuing: false,
        freshDataRequired: false,
        toolsNeeded: ['image.generate'],
        toolReason: 'User requests visual image generation. Must route to ImageGeneration service.',
        needsClarification: false,
        clarificationQuestion: null,
        confidence: 0.94,
        reason: 'Deterministic classifier: image generation task detected from creation vocabulary.',
        interpretationSource: 'DETERMINISTIC_IMAGE_CLASSIFIER',
        transportUsed: 'LOCAL_REASONING',
        fallbackUsed: false
      };
    }

    return null;
  }

  /**
   * Deterministic Presentation Classifier — Detects requests to create presentations/PPT/slides.
   * Matches keywords: presentasi, PPT, slide, presentation.
   * Extracts: topic, slideCount, optional speakerName.
   */
  _presentationClassifier(raw) {
    const r = raw;

    // Presentation keywords
    const presentationPattern = /(?:buat|bikin|create|generate|susun|rilis|publish)?\s*(?:presentasi|PPT|ppt|slide|slideshow|presentasi)/i;

    // Extract slide count
    const slideCountMatch = r.match(/(\d+)\s*(?:slide|halaman|lembar)/i);
    const slideCount = slideCountMatch ? parseInt(slideCountMatch[1]) : null;

    // Extract topic (text after "tema" or "tentang" or "about")
    const topicMatch = r.match(/(?:tema|tentang|about|topik|topic)[:\s]+(.+?)(?:\s*,|\s*\.|\s*dengan|\s*untuk|\s*yang|$)/i);
    const topic = topicMatch ? topicMatch[1].trim() : null;

    // Extract speaker name (optional)
    const speakerMatch = r.match(/(?:pembicara|speaker|oleh|presented\s+by)[:\s]+(.+?)(?:\s*,|\s*\.\s*|\s*dengan|\s*sertakan|$)/i);
    const speakerName = speakerMatch ? speakerMatch[1].trim() : null;

    // Check for presentation keywords
    if (presentationPattern.test(r) && (slideCount || topic)) {
      return {
        intent: 'PRESENTATION_REQUEST',
        goal: r,
        resolvedReferences: [],
        actionRequired: true,
        entities: ['presentation', 'slides'],
        constraints: [],
        isCorrecting: false,
        isContinuing: false,
        freshDataRequired: false,
        toolsNeeded: ['presentation.generate'],
        toolReason: 'User requests presentation/slideshow creation. Must route to PresentationGenerator.',
        needsClarification: false,
        clarificationQuestion: null,
        confidence: 0.94,
        reason: 'Deterministic classifier: presentation request detected from PPT/presentasi/slide keywords.',
        interpretationSource: 'DETERMINISTIC_PRESENTATION_CLASSIFIER',
        transportUsed: 'LOCAL_REASONING',
        fallbackUsed: false,
        presentationIntent: {
          topic: topic || r,
          slideCount: slideCount || 10,
          speakerName: speakerName,
          speakerPhoto: null,
          phase: 'DRAFT',
          currentSlide: null
        }
      };
    }

    return null;
  }

  /**
   * Deterministic Image Revision Classifier — Detects requests to modify/re-render
   * an existing visual from conversation context. Must run BEFORE image generation classifier.
   * Matches revision vocabulary AND checks for previous visual assets in conversation history.
   */
  _imageRevisionClassifier(raw, recentTurns = []) {
    const r = raw;

    // Revision vocabulary patterns (Indonesian + English)
    const revisionPatterns = /(?:revisi|ubah|ganti|update|regenerate|buat\s+ulang|edit|modifikasi|timpa|ulang|ubah\s+suasana|ganti\s+suasana|buat\s+versi|versi\s+baru|versi\s+lain|yang\s+tadi|nya|itu|tersebut|sebelumnya)/i;

    // Contextual reference patterns (don't require "gambar" noun)
    const contextualReference = /(?:nya|yang\s+tadi|itu|tersebut|sebelumnya|versi\s+sebelumnya|yang\s+barusan|yang\s+kita\s+bicarakan)/i;

    // Check if request contains revision vocabulary
    const hasRevisionVocab = revisionPatterns.test(r);

    // Check if request contains contextual references
    const hasContextualRef = contextualReference.test(r);

    // Check if there's a previous visual asset in conversation history
    let lastVisualAsset = null;
    for (let i = recentTurns.length - 1; i >= 0; i--) {
      const turn = recentTurns[i];
      if (turn.role === 'assistant' && turn.imageUrl) {
        lastVisualAsset = turn.imageUrl;
        break;
      }
      // Also check for image_url in content array (multimodal format)
      if (turn.role === 'assistant' && Array.isArray(turn.content)) {
        for (const part of turn.content) {
          if (part.type === 'image_url' && part.image_url?.url) {
            lastVisualAsset = part.image_url.url;
            break;
          }
        }
        if (lastVisualAsset) break;
      }
    }

    // IMAGE_REVISION requires: revision vocabulary OR contextual reference AND previous visual exists
    if ((hasRevisionVocab || hasContextualRef) && lastVisualAsset) {
      // Extract modification instructions
      const modifyElements = [];
      if (/sunset|senja|matahari\s+tenggelam/i.test(r)) modifyElements.push('sunset atmosphere');
      if (/malam|night|gelap/i.test(r)) modifyElements.push('nighttime');
      if (/pagi|morning|subuh/i.test(r)) modifyElements.push('morning');
      if (/dekat|close|besar/i.test(r)) modifyElements.push('closer view');
      if (/jauh|far|kecil/i.test(r)) modifyElements.push('farther view');
      if (/mendung|cloudy|awan/i.test(r)) modifyElements.push('cloudy sky');
      if (/cerah|clear|sunny/i.test(r)) modifyElements.push('clear sky');
      if (/realistis|realistic/i.test(r)) modifyElements.push('more realistic');

      return {
        intent: 'IMAGE_REVISION',
        goal: r,
        resolvedReferences: [`VISUAL_ASSET: ${lastVisualAsset}`],
        actionRequired: true,
        entities: ['image_revision', 'visual_asset'],
        constraints: [],
        isCorrecting: false,
        isContinuing: true,
        freshDataRequired: false,
        toolsNeeded: ['image.generate'],
        toolReason: 'User requests modification of existing visual asset. Must route to ImageGeneration with reference.',
        needsClarification: false,
        clarificationQuestion: null,
        confidence: 0.92,
        reason: 'Deterministic classifier: image revision task detected from revision vocabulary and existing visual context.',
        interpretationSource: 'DETERMINISTIC_IMAGE_REVISION_CLASSIFIER',
        transportUsed: 'LOCAL_REASONING',
        fallbackUsed: false,
        referenceImage: lastVisualAsset,
        visualIntent: {
          mode: 'GENERIC_IMAGE',
          subject: null,
          action: 'revision',
          environment: null,
          style: null,
          composition: null,
          aspectRatio: '1:1',
          negativeConstraints: [],
          providerPrompt: null,
          referenceImage: lastVisualAsset,
          preserveElements: [],
          modifyElements
        }
      };
    }

    return null;
  }

  /**
   * Deterministic Task Classifier — Safety net for when LLM times out or misclassifies.
   * Uses regex to detect action-requiring tasks and set actionRequired: true.
   * This ensures the full pipeline (PLAN → BUILD → VERIFY) is triggered.
   */
  _deterministicTaskClassifier(raw, activeConstraints = []) {
    const r = raw;

    // DOCUMENT ANALYSIS — user asks to analyze/read/extract from a document
    if (/analisis\s+dokumen|dokumen\s+ini|file\s+ini|pdf\s+ini|upload.*analisis|ekstrak\s+isi|baca\s+dokumen|ringkas\s+dokumen|summary\s+dokumen|buat\s+ringkasan\s+dari|buat\s+summary\s+dari/i.test(r)) {
      return {
        intent: 'DOCUMENT_ANALYSIS',
        goal: r,
        resolvedReferences: [],
        actionRequired: true,
        entities: ['document'],
        constraints: activeConstraints,
        isCorrecting: false,
        isContinuing: false,
        freshDataRequired: false,
        toolsNeeded: ['doc.analyze'],
        toolReason: 'Pengguna meminta analisis atau ekstraksi konten dari dokumen.',
        needsClarification: false,
        clarificationQuestion: null,
        confidence: 0.92,
        reason: 'Deterministic classifier: document analysis task detected.',
        interpretationSource: 'DETERMINISTIC_CLASSIFIER',
        transportUsed: 'LOCAL_REASONING',
        fallbackUsed: true
      };
    }

    // APP SYNTHESIS — user asks to build/create code, app, component
    if (/buatkan?\s+(kode|code|script|program|aplikasi|app|website|component|function|class|class|module|widget|halaman|page|form|button|modal|popup|layout|interface|ui|api|endpoint|route|rest|graphql)|generate\s+code|create\s+(app|application|component|function|class|module)|bangun\s+(aplikasi|website|sistem|tool|utility)/i.test(r)) {
      return {
        intent: 'APP_SYNTHESIS',
        goal: r,
        resolvedReferences: [],
        actionRequired: true,
        entities: ['code_generation'],
        constraints: activeConstraints,
        isCorrecting: false,
        isContinuing: false,
        freshDataRequired: false,
        toolsNeeded: ['sandbox.execute'],
        toolReason: 'Pengguna meminta pembuatan kode atau aplikasi.',
        needsClarification: false,
        clarificationQuestion: null,
        confidence: 0.93,
        reason: 'Deterministic classifier: code/app synthesis task detected.',
        interpretationSource: 'DETERMINISTIC_CLASSIFIER',
        transportUsed: 'LOCAL_REASONING',
        fallbackUsed: true
      };
    }

    // DATA ANALYTICS — user asks for computation, analysis, statistics
    if (/hitung|kalkulasi|statistik|data\s+analytics|analisis\s+data|rata-rata|persentase|growth|trend|perbandingan|komparasi|visualisasi|grafik|chart|matrix|tabel\s+data|olah\s+data|proses\s+data/i.test(r)) {
      return {
        intent: 'DATA_ANALYTICS',
        goal: r,
        resolvedReferences: [],
        actionRequired: true,
        entities: ['data_analysis'],
        constraints: activeConstraints,
        isCorrecting: false,
        isContinuing: false,
        freshDataRequired: false,
        toolsNeeded: ['sandbox.execute'],
        toolReason: 'Pengguna meminta analisis data, kalkulasi, atau visualisasi.',
        needsClarification: false,
        clarificationQuestion: null,
        confidence: 0.91,
        reason: 'Deterministic classifier: data analytics task detected.',
        interpretationSource: 'DETERMINISTIC_CLASSIFIER',
        transportUsed: 'LOCAL_REASONING',
        fallbackUsed: true
      };
    }

    // MULTI-STEP TASK — user asks for complex/sequential work
    if (/langkah|step|proses|pipeline|workflow|urutan|rentetan|rangkaian|secara\s+bertahap|berurutan| tahap|fase/i.test(r) && !/^(halo|hai|hi|hey|selamat|pagi|siang|sore|malam)/i.test(r)) {
      return {
        intent: 'MULTI_STEP_TASK',
        goal: r,
        resolvedReferences: [],
        actionRequired: true,
        entities: ['multi_step'],
        constraints: activeConstraints,
        isCorrecting: false,
        isContinuing: false,
        freshDataRequired: false,
        toolsNeeded: [],
        toolReason: 'Pengguna meminta tugas multi-langkah yang kompleks.',
        needsClarification: false,
        clarificationQuestion: null,
        confidence: 0.88,
        reason: 'Deterministic classifier: multi-step task detected.',
        interpretationSource: 'DETERMINISTIC_CLASSIFIER',
        transportUsed: 'LOCAL_REASONING',
        fallbackUsed: true
      };
    }

    // REPORT GENERATION — user asks to create a report, summary, document
    if (/buatkan?\s+(laporan|report|dokumen|artikel|tulisan|draft|surat|proposal|presentasi|ppt|makalah)|generate\s+(report|document|summary)|susun\s+(laporan|dokumen)/i.test(r)) {
      return {
        intent: 'MULTI_STEP_TASK',
        goal: r,
        resolvedReferences: [],
        actionRequired: true,
        entities: ['report_generation'],
        constraints: activeConstraints,
        isCorrecting: false,
        isContinuing: false,
        freshDataRequired: false,
        toolsNeeded: [],
        toolReason: 'Pengguna meminta pembuatan laporan atau dokumen.',
        needsClarification: false,
        clarificationQuestion: null,
        confidence: 0.90,
        reason: 'Deterministic classifier: report/document generation task detected.',
        interpretationSource: 'DETERMINISTIC_CLASSIFIER',
        transportUsed: 'LOCAL_REASONING',
        fallbackUsed: true
      };
    }

    // RESEARCH TASK — user asks for deep research, investigation
    if (/riset|research|telusuri|investigasi|kaji|review\s+literatur|studi\s+kasus|benchmark|perbandingan\s+komprehensif|deep\s+dive|penelitian/i.test(r)) {
      return {
        intent: 'RESEARCH_TASK',
        goal: r,
        resolvedReferences: [],
        actionRequired: true,
        entities: ['research'],
        constraints: activeConstraints,
        isCorrecting: false,
        isContinuing: false,
        freshDataRequired: true,
        toolsNeeded: ['web.search'],
        toolReason: 'Pengguna meminta riset atau investigasi mendalam.',
        needsClarification: false,
        clarificationQuestion: null,
        confidence: 0.89,
        reason: 'Deterministic classifier: deep research task detected.',
        interpretationSource: 'DETERMINISTIC_CLASSIFIER',
        transportUsed: 'LOCAL_REASONING',
        fallbackUsed: true
      };
    }

    // EXTERNAL DATA — user asks for live internet data (weather, prices, news, real-time info)
    if (/cuaca|weather|harga\s+(saham|komoditas|emas|minyak|kripto|crypto|bitcoin)|stock\s+price|market\s+data|exchange\s+rate|kurs|berita|news|informasi\s+(terbaru|terkini|latest|recent|current)|what\s+is\s+the\s+(current|latest|recent)|what\s+(are|is)\s+the\s+(current\s+)?(price|rate|value)|real-time|realtime|live\s+data|hari\s+ini|saat\s+ini|right\s+now|cari\s+(di\s+)?(internet|web|online)|search\s+(for|online)/i.test(r)) {
      return {
        intent: 'EXTERNAL_DATA',
        goal: r,
        resolvedReferences: [],
        actionRequired: true,
        entities: ['external_data'],
        constraints: activeConstraints,
        isCorrecting: false,
        isContinuing: false,
        freshDataRequired: true,
        toolsNeeded: ['web.search'],
        toolReason: 'User requests real-time or internet-dependent data. Must route to Antigravity.',
        needsClarification: false,
        clarificationQuestion: null,
        confidence: 0.94,
        reason: 'Deterministic classifier: external/real-time data request detected.',
        interpretationSource: 'DETERMINISTIC_CLASSIFIER',
        transportUsed: 'LOCAL_REASONING',
        fallbackUsed: true
      };
    }

    // No task detected — return null to let the default return handle it
    return null;
  }
}

export const semanticIntentEngineInstance = new SemanticIntentEngine();
export default semanticIntentEngineInstance;
