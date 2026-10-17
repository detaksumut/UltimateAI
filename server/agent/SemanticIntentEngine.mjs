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
import { classifyMarketIntent, classifyAnalysisIntent } from '../market/marketIntentRouter.mjs';
import { detectLegalAuditIntent } from '../tools/LegalAuditTool.mjs';

export class SemanticIntentEngine {
  constructor(proxyUrl = null, apiKey = null) {
    this.proxyUrl = proxyUrl || process.env.ROUTER_PROXY_URL || 'http://127.0.0.1:20200/v1';
    this.apiKey = apiKey || process.env.ROUTER_API_KEY || '';
  }

  _normalizeUtterance(input) {
    if (typeof input === 'string') return input.trim();
    if (input === null || input === undefined) return '';
    if (Array.isArray(input)) {
      return input
        .map(part => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object') {
            return part.text || (part.type === 'text' ? part.text : '') || '';
          }
          return '';
        })
        .filter(Boolean)
        .join(' ')
        .trim();
    }
    if (typeof input === 'object') {
      if (typeof input.content === 'string') return input.content.trim();
      if (Array.isArray(input.content)) return this._normalizeUtterance(input.content);
      if (typeof input.text === 'string') return input.text.trim();
      if (typeof input.prompt === 'string') return input.prompt.trim();
      if (typeof input.message === 'string') return input.message.trim();
    }
    throw new TypeError(`[SemanticIntentEngine] Invariant failed: user utterance must be a string, message object, or parts array, received ${typeof input}`);
  }

  _extractTurnText(turn) {
    if (!turn) return '';
    if (typeof turn === 'string') return turn;
    if (typeof turn.content === 'string') return turn.content;
    if (Array.isArray(turn.content)) {
      return turn.content
        .map(part => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object') {
            return part.text || (part.type === 'text' ? part.text : '') || '';
          }
          return '';
        })
        .filter(Boolean)
        .join(' ');
    }
    if (typeof turn.text === 'string') return turn.text;
    if (typeof turn.prompt === 'string') return turn.prompt;
    if (typeof turn.message === 'string') return turn.message;
    if (typeof turn.content === 'object' && turn.content !== null) {
      return turn.content.text || turn.content.message || '';
    }
    return '';
  }

  _findLastVisualAsset(recentTurns = []) {
    if (!Array.isArray(recentTurns)) return null;
    for (let i = recentTurns.length - 1; i >= 0; i--) {
      const turn = recentTurns[i];
      if (!turn) continue;

      if (turn.imageUrl && typeof turn.imageUrl === 'string') {
        return turn.imageUrl;
      }
      if (turn._agent?.imageUrl && typeof turn._agent.imageUrl === 'string') {
        return turn._agent.imageUrl;
      }
      if (turn.artifact?.url && typeof turn.artifact.url === 'string') {
        return turn.artifact.url;
      }
      if (Array.isArray(turn.artifacts)) {
        const artWithUrl = turn.artifacts.find(a => a?.url && typeof a.url === 'string');
        if (artWithUrl) return artWithUrl.url;
      }
      if (Array.isArray(turn.content)) {
        for (const part of turn.content) {
          if (part?.type === 'image_url' && (part.image_url?.url || typeof part.image_url === 'string')) {
            return part.image_url?.url || part.image_url;
          }
          if (part?.imageUrl && typeof part.imageUrl === 'string') {
            return part.imageUrl;
          }
          if (typeof part?.text === 'string') {
            const m = part.text.match(/\/(?:api\/artifacts\/images|artifacts\/images)\/[a-zA-Z0-9_\-\.]+\.(?:jpg|jpeg|png|webp)/i)
              || part.text.match(/https?:\/\/[^\s\)\"\']+\.(?:png|jpg|jpeg|webp)/i);
            if (m) return m[0];
          }
        }
      }
      if (typeof turn.content === 'string') {
        const m = turn.content.match(/\/(?:api\/artifacts\/images|artifacts\/images)\/[a-zA-Z0-9_\-\.]+\.(?:jpg|jpeg|png|webp)/i)
          || turn.content.match(/https?:\/\/[^\s\)\"\']+\.(?:png|jpg|jpeg|webp)/i);
        if (m) return m[0];
      }
    }
    return null;
  }

  /**
   * Interprets natural language input into a structured semantic goal.
   */
  async interpret(input, context = {}, options = {}) {
    const raw = this._normalizeUtterance(input);
    if (!raw) {
      return this._emptyUtterance(options);
    }

    // FAST-PATH: Deterministic MARKET_ANALYSIS, SLIDE_STUDIO, IMAGE_REVISION, IMAGE_GENERATION
    // MIE ("Jin, tampilkan data Indeks Saham") harus ditangkap sebelum LLM agar
    // panel kiri membuka Market Intelligence, bukan jawaban naratif generik.
    const analysisDecision = classifyAnalysisIntent(raw);
    if (analysisDecision) {
      return this._injectScope(raw, {
        ...analysisDecision,
        interpretationSource: 'MARKET_INTELLIGENCE_CLASSIFIER',
        transportUsed: 'LOCAL_REASONING',
        fallbackUsed: false
      });
    }

    const fastDecision =
      this._imageRevisionClassifier(raw, context.recentTurns || []) ||
      this._imageGenerationClassifier(raw, context.constraints || []);
    if (fastDecision) {
      return this._injectScope(raw, {
        ...fastDecision,
        interpretationSource: fastDecision.interpretationSource || 'DETERMINISTIC_FAST_PATH',
        transportUsed: 'LOCAL_REASONING',
        fallbackUsed: false
      });
    }

    // Local engine identity from the live runtime (single source of truth).
    // 'qwen3:8b' belonged to the retired Ollama setup and is not installed here.
    const model = options.forcedModel || process.env.LLAMACPP_MODEL || 'qwen2.5-3b-instruct-q4_k_m.gguf';
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
- IMAGE_GENERATION: every request to create/generate a NEW image from scratch, including any 3D render or 3D object, uses only toolsNeeded=["image.generate"]. actionRequired=true.
- IMAGE_REVISION: every request to modify/re-render/update/revise an EXISTING visual that was created earlier in the conversation. The user references a previous visual using contextual cues like "nya", "yang tadi", "itu", "tersebut", "versi sebelumnya", or revision words like "revisi", "ubah", "ganti", "buat ulang", "edit", "modifikasi", "ulang". Uses toolsNeeded=["image.edit"]. actionRequired=true. MUST include referenceImage with the previous visual artifact URL.
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
    - legal.audit: Audit of Indonesian legal documents (putusan, dakwaan, BAP, gugatan, eksepsi, replik/duplik, perkara perdata/agama) → Audit Justice with Integrity Score 0-100, and audit of public policy documents (PP/UU/Perda/APBN-APBD) → Audit Kebijakan Publik with score 0-100, risk level, UUD 1945 analysis, KKN risk. Use this tool INSTEAD of doc.analyze when the user asks for an audit (audit/bedah/cacat hukum/skor integritas/uji formil-uji materiil/deviasi anggaran) on such a document.
   - memory.vault: Storing or querying persistent facts.
   - device.inspect: Local machine inspection (RAM, CPU, disk, processes, UltimateAI runtime). Purely read-only. Use when the user asks about their local computer ("kondisi komputer", "cek penggunaan RAM", "proses paling banyak pakai memory", "kondisi UltimateAI", "cek storage", "apa yang membuat komputer berat"). Output must include a "scope" field: "overview" | "memory" | "process" | "storage" | "runtime" | "diagnosis".
7. For IMAGE_GENERATION or IMAGE_REVISION, produce a visualIntent object from the user's meaning, not keyword substitution:
   {"mode":"GENERIC_IMAGE|SLIDE_VISUAL|ARCHITECTURAL_VISUAL","subject":"canonical subject","action":"requested action","environment":"requested setting","style":"requested style or realistic","composition":"requested composition","aspectRatio":"1:1|16:9|9:16","negativeConstraints":["incompatible subjects"],"providerPrompt":"complete faithful image prompt","referenceImage":"URL of previous visual artifact if IMAGE_REVISION, null otherwise","preserveElements":["elements to keep from previous visual if IMAGE_REVISION"],"modifyElements":["elements to change from previous visual if IMAGE_REVISION"]}
   The providerPrompt must explicitly identify the requested subject, preserve requested details, and never invent a person, character, wings, vehicle, or template.
   For IMAGE_REVISION, the providerPrompt must combine the preserved elements from the previous visual with the modification instructions.

Output STRICT valid JSON:
{
  "intent": "<CASUAL_CHAT|RESEARCH_QUESTION|URL_INSPECTION|DOCUMENT_ANALYSIS|LEGAL_AUDIT|DATA_ANALYTICS|MEMORY_STORE|MEMORY_RETRIEVAL|MULTI_STEP_TASK|APP_SYNTHESIS|MEDIA_PLAYBACK|DEVICE_INSPECTION|CONSTRAINT_UPDATE|CORRECTION|TASK_CONTROL|IMAGE_GENERATION|IMAGE_REVISION|RESEARCH_TASK|EXTERNAL_DATA>",
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

    // 2B. MEDIA PLAYBACK (YouTube song & music stream)
    const mediaDecision = this._mediaPlaybackClassifier(raw, activeConstraints);
    if (mediaDecision) {
      return mediaDecision;
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
        const turn = history[i];
        const turnText = this._extractTurnText(turn);
        if (typeof turnText !== 'string') {
          throw new TypeError(`[SemanticIntentEngine] Invariant failed: turnText must be a string, received ${typeof turnText}`);
        }
        const prevUrlMatch = turnText.match(/https?:\/\/[^\s]+/i);
        if (prevUrlMatch) {
          targetUrl = prevUrlMatch[0];
          resolvedRefs.push(`URL: ${targetUrl}`);
          break;
        }
        // Direct object URL inspection (multimodal or explicit fields)
        if (turn && typeof turn === 'object') {
          if (turn.url && typeof turn.url === 'string') {
            targetUrl = turn.url;
            resolvedRefs.push(`URL: ${targetUrl}`);
            break;
          }
          if (Array.isArray(turn.content)) {
            for (const part of turn.content) {
              if (part?.type === 'image_url' && (part.image_url?.url || typeof part.image_url === 'string')) {
                targetUrl = part.image_url?.url || part.image_url;
                resolvedRefs.push(`URL: ${targetUrl}`);
                break;
              }
            }
            if (targetUrl) break;
          }
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

    // Safe Code Computation — ONLY for explicit sandbox code execution requests
    if (/(?:jalankan|eksekusi)\s+(?:script|skrip|kode|bash|python|perintah|command)\s+(?:di\s+)?(?:sandbox|terminal)/i.test(raw) && !/jangan eksekusi/i.test(raw)) {
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
   * Media Playback Classifier — detects requests to search or play a song/music from YouTube.
   * Routes to MEDIA_PLAYBACK intent.
   */
  _mediaPlaybackClassifier(raw, activeConstraints = []) {
    const r = raw.trim();
    const isSongRequest = 
      /(?:carikan|cari|putar|putarkan|play|dengarkan|nyalakan|tampilkan|setel|mainkan)?\s*(?:lagu|musik|video|song|music|mv)\s+(?:di\s+youtube\s+)?(?:judul(?:nya)?|berjudul|called|titled)?\s*(.+)/i.test(r) ||
      /(?:di\s+youtube\s+)?(?:judul(?:nya)?|berjudul)\s+(?:lagu(?:nya)?\s+)?(.+)/i.test(r) ||
      /\b(?:carikan\s+lagu|putar\s+lagu|putarkan\s+lagu|play\s+lagu|setel\s+lagu|mainkan\s+lagu|dengarkan\s+lagu)\b/i.test(r) ||
      /\b(?:youtube|yt)\b.*?\b(?:putar|play|setel|mainkan|dengarkan|canvas)\b/i.test(r) ||
      /\b(?:putar|play|setel|mainkan|dengarkan)\b.*?\b(?:youtube|yt)\b/i.test(r) ||
      /\b(?:cari|carikan)\b.*?\b(?:youtube|yt)\b.*?\b(?:putar|play|canvas)\b/i.test(r);

    if (!isSongRequest) return null;

    return {
      intent: 'MEDIA_PLAYBACK',
      goal: r,
      resolvedReferences: [],
      actionRequired: true,
      entities: ['music', 'youtube'],
      constraints: activeConstraints,
      isCorrecting: false,
      isContinuing: false,
      freshDataRequired: true,
      toolsNeeded: ['youtube.search'],
      toolReason: 'Mencari lagu di YouTube dan memuat pemutar Canvas langsung.',
      needsClarification: false,
      clarificationQuestion: null,
      confidence: 0.98,
      reason: 'Deterministic media playback classifier: user requested YouTube song/music stream.',
      interpretationSource: 'DETERMINISTIC_MEDIA_PLAYBACK_CLASSIFIER',
      transportUsed: 'LOCAL_REASONING',
      fallbackUsed: false
    };
  }

  /**
   * Slide Studio Classifier — detects requests to create a slide/presentation via SLIDE_STUDIO engine.
   * Runs BEFORE generic task classifier to intercept deck/slide creation commands.
   * Returns SLIDE_STUDIO intent when a specific slide creation trigger is detected.
   */
  _slideStudioClassifier(raw, activeConstraints = []) {
    const r = raw;

    // Specific slide deck creation triggers — must be actionable (not just "buat outline")
    const isSlideStudio =
      /(?:buatkan?|buat|bikin|hasilkan|generate|create)\s+(?:deck|slide\s+deck|presentasi\s+slide|slide\s+presentasi|ppt|powerpoint|pptx)\b/i.test(r) ||
      /(?:slide\s+deck|deck\s+presentasi)\s+(?:tentang|mengenai|untuk|soal|topik)/i.test(r) ||
      /\bslide\s+\d+\s*[:—\-]\s*\S/i.test(r) || // "slide 1: Judul"
      /(?:buatkan?|buat)\s+\d+\s+slide\b/i.test(r); // "buat 5 slide"

    if (!isSlideStudio) return null;

    return {
      intent: 'SLIDE_STUDIO',
      goal: r,
      resolvedReferences: [],
      actionRequired: true,
      entities: ['slide', 'deck'],
      constraints: activeConstraints,
      isCorrecting: false,
      isContinuing: false,
      freshDataRequired: false,
      toolsNeeded: ['slide_studio'],
      toolReason: 'Permintaan pembuatan deck/slide → SLIDE_STUDIO engine.',
      needsClarification: false,
      clarificationQuestion: null,
      confidence: 0.97,
      reason: 'Slide deck creation intent detected.',
      interpretationSource: 'DETERMINISTIC_SLIDE_STUDIO_CLASSIFIER',
      transportUsed: 'LOCAL_REASONING',
      fallbackUsed: false
    };
  }

  /**
   * Architectural Design Classifier — detects system/software architecture diagram requests.
   * Routes to ARCHITECTURAL_STUDIO engine.
   */
  _architecturalDesignClassifier(raw, activeConstraints = []) {
    const r = raw;

    const isArchStudio =
      /(?:buatkan?|buat|bikin|hasilkan|generate|design|rancang)\s+(?:arsitektur|architecture|diagram\s+sistem|system\s+diagram|diagram\s+arsitektur|software\s+architecture|er\s+diagram|erd|uml|class\s+diagram|sequence\s+diagram|flowchart\s+sistem)\b/i.test(r) ||
      /(?:arsitektur|architecture)\s+(?:sistem|system|aplikasi|app|backend|frontend|microservice|cloud)\b/i.test(r);

    if (!isArchStudio) return null;

    return {
      intent: 'ARCHITECTURAL_STUDIO',
      goal: r,
      resolvedReferences: [],
      actionRequired: true,
      entities: ['architecture', 'diagram'],
      constraints: activeConstraints,
      isCorrecting: false,
      isContinuing: false,
      freshDataRequired: false,
      toolsNeeded: ['architectural_studio'],
      toolReason: 'Permintaan desain arsitektur sistem → ARCHITECTURAL_STUDIO engine.',
      needsClarification: false,
      clarificationQuestion: null,
      confidence: 0.96,
      reason: 'Architectural design intent detected.',
      interpretationSource: 'DETERMINISTIC_ARCH_STUDIO_CLASSIFIER',
      transportUsed: 'LOCAL_REASONING',
      fallbackUsed: false
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
        preferredProvider: PROVIDER.LOCAL_LLM,
        fallbackProvider: null,
        fallbackRestriction: FALLBACK_RESTRICTION.NONE,
        restrictions: [],
        requiresRealTimeData: false
      }
    };
  }

  /**
   * Deterministic Slide Studio Classifier — Only triggers when user explicitly requests
   * downloadable PowerPoint (.pptx) file generation. Does NOT hijack conversational slide outlines.
   */

  /**
   * Deterministic Image Generation Classifier — Runs BEFORE generic task classifier.
   * Detects image generation requests (including visual slide requests) and routes to IMAGE_GENERATION intent.
   * Matches Indonesian and English image creation vocabulary.
   */
  _imageGenerationClassifier(raw, activeConstraints = []) {
    const r = raw;

    // Slide visual generation intent (e.g. "buat visual slide 1", "visualkan slide ini")
    const isVisualSlideIntent = /(?:buatkan?|buat|bikin|render|tampilkan|hasilkan)\s+(?:.*\s+)?(?:visual\s+slide|slide\s+visual|visualnya|desain\s+slide)|(?:visual\s+slide\s+\d+|slide\s+\d+\s+visual|gambar\s+slide)/i.test(r);

    // General image creation patterns
    const createImagePattern = /(?:buatkan?|buat|generate|create|bikin|hasilkan|render|desain|lukis(?:kan)?|gambar(?:kan)?|ilustrasi(?:kan)?|visual(?:kan)?)\s+(?:.*\s+)?(?:gambar|image|ilustrasi|visual|poster|logo|wallpaper|foto|lukisan|karya\s+visual|desain\s+visual|artwork|anime|carton|kartun|3d|rendering)/i;
    const standaloneImageWord = /(?:generate|create|buatkan?|buat|bikin|tolong\s+bikin)\s+(?:sebuah\s+)?(?:gambar|image|ilustrasi|visual|foto|lukisan|poster|logo|wallpaper|artwork|anime|kartun|3d|rendering)/i;
    const directGenerateKeyword = /(?:generate\s+image|create\s+an?\s+image|buat\s+gambar|buatkan\s+gambar|generate\s+gambar|tolong\s+(?:buatkan?|generate|create)\s+(?:sebuah\s+)?(?:gambar|image|visual|foto|ilustrasi))/i;
    const gambarkanPattern = /^gambarkan\s+/i;

    // Negative patterns: exclude analysis/search/description of existing images
    const negativeExclude = /(?:analisis|analysis|jelaskan|deskripsikan|bedah|baca|cari|temukan|search|find|lihat|download|unduh|simpan|hapus)\s+(?:.*\s+)?(?:gambar|image|foto|lukisan|ilustrasi)/i;

    const isNegative = negativeExclude.test(r) && !isVisualSlideIntent;
    const matchesPositive = isVisualSlideIntent || createImagePattern.test(r) || standaloneImageWord.test(r) || directGenerateKeyword.test(r) || gambarkanPattern.test(r);

    if (matchesPositive && !isNegative) {
      const is169 = isVisualSlideIntent || /\b(?:16[:x]9|16\/9|landscape|horizontal|mendatar|lebar|panjang|slide|presentasi)\b/i.test(r);
      const is916 = /\b(?:9[:x]16|9\/16|portrait|vertikal|tegak|story|tiktok|reels|shorts|wallpaper(?:\s+hp|\s+ponsel)?)\b/i.test(r);
      const detectedAr = is169 ? '16:9' : is916 ? '9:16' : '1:1';
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
        toolReason: isVisualSlideIntent
          ? 'Pengguna meminta pembuatan visual slide presentasi 16:9 enterprise.'
          : 'User requests visual image generation. Must route to ImageGeneration service.',
        needsClarification: false,
        clarificationQuestion: null,
        confidence: 0.95,
        reason: 'Deterministic classifier: image/visual generation task detected.',
        interpretationSource: 'DETERMINISTIC_IMAGE_CLASSIFIER',
        transportUsed: 'LOCAL_REASONING',
        fallbackUsed: false,
        visualIntent: {
          mode: 'GENERIC_IMAGE',
          action: 'generate',
          aspectRatio: detectedAr,
          subject: r
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
    if (typeof raw !== 'string') {
      throw new TypeError(`[SemanticIntentEngine] Invariant violated: raw utterance must be a string, received ${typeof raw}`);
    }
    const r = raw.trim();
    if (!r) return null;

    // Guard: Exclude document reading, analysis, summary, and attached document context.
    // CRITICAL: Must check BEFORE revision pattern matching to prevent PDF+context misclassification.
    const hasDocumentMarker = r.includes('--- [BERKAS DOKUMEN') || r.includes('--- [DOKUMEN') ||
      r.includes('--- [Konteks Dokumen') || r.includes('--- [STATUS DOKUMEN');
    const isDocumentTask = /(?:baca\s+ini|baca\s+dokumen|point\s+point|poin\s+poin|outline|materi|rangkum\w*|ringkas\w*|slide\s+presentasi|buatkan\s+point|analisa\w*|analisis|analiz\w*|rangkuman|summary|kesimpulan|simpulkan|ekstrak\w*|jabarkan|jelaskan\s+isi|apa\s+isi|baca\s+dan|buat\s+analisa|buatkan\s+analisa)\b/i.test(r);
    const hasPdfReference = /\.pdf\b/i.test(r);
    if (hasDocumentMarker || isDocumentTask || hasPdfReference) {
      return null;
    }

    // Check if there is an active visual asset in conversation context
    const lastVisualAsset = this._findLastVisualAsset(recentTurns);
    if (!lastVisualAsset) {
      return null;
    }

    // 1. Revision / Change action verbs (Indonesian + English) with strict word boundaries
    const revisionActionPatterns = /\b(?:revisi|ubah|ganti|update|regenerate|buat\s+ulang|edit|modifikasi|timpa|jadikan|buat\s+jadi|bikin\s+jadi|ubah\s+jadi|ganti\s+jadi|ubah\s+ke|ganti\s+ke|jadikan\s+suasana|suasananya|buat\s+versi|bikin\s+versi|versi\s+baru|versi\s+lain|tambah(?:kan)?|kasih|taruh|pasang|hilang(?:kan)?|hapus|buang|tanpa|buat\s+lebih|bikin\s+lebih|jadikan\s+lebih|make\s+it|turn\s+into|change|modify|replace|add|remove)\b/i;

    // 2. Contextual reference patterns indicating continuation of previous visual
    const contextualReference = /\b(?:nya|yang\s+tadi|itu|tersebut|sebelumnya|versi\s+sebelumnya|yang\s+barusan|yang\s+kita\s+bicarakan|sekarang)\b/i;

    // 3. Target visual modification concepts (atmosphere, scenery, lighting, weather, style)
    const targetModificationPatterns = /\b(?:malam|night|sunset|senja|pagi|morning|siang|subuh|hujan|rain|badai|storm|salju|snow|cerah|sunny|mendung|cloudy|kabut|fog|gelap|dark|terang|bright|realistis|realistic|kartun|cartoon|anime|cyberpunk|3d|vintage|retro|hitam\s+putih|black\s+and\s+white|langit|sky|background|latar|pemandangan|view|suasana|warna|color|gambar|visual|foto|image)\b/i;

    const hasAction = revisionActionPatterns.test(r);
    const hasContextRef = contextualReference.test(r);
    const hasTargetMod = targetModificationPatterns.test(r);

    // Negative exclude: explicit commands unrelated to visual revision
    const nonVisualExclusion = /^(?:bukan\s+itu|maksud\s+saya\s+dokumen|ganti\s+model|ubah\s+suhu|hapus\s+chat|stop|berhenti)\b/i.test(r);
    if (nonVisualExclusion) return null;

    // Core rule: must involve target modification concept or explicit visual reference
    const isRevision = (hasAction && hasTargetMod) || (hasContextRef && hasTargetMod);

    if (isRevision) {
      // Extract modification instructions dynamically
      const modifyElements = [];
      if (/sunset|senja|matahari\s+tenggelam/i.test(r)) modifyElements.push('sunset atmosphere');
      if (/malam|night|gelap/i.test(r)) modifyElements.push('nighttime');
      if (/pagi|morning|subuh/i.test(r)) modifyElements.push('morning');
      if (/siang|daytime/i.test(r)) modifyElements.push('daytime');
      if (/hujan|rain/i.test(r)) modifyElements.push('rainy atmosphere');
      if (/salju|snow/i.test(r)) modifyElements.push('snow falling');
      if (/badai|storm/i.test(r)) modifyElements.push('stormy weather');
      if (/mendung|cloudy|awan/i.test(r)) modifyElements.push('cloudy sky');
      if (/cerah|clear|sunny/i.test(r)) modifyElements.push('clear sky');
      if (/kabut|foggy/i.test(r)) modifyElements.push('foggy mist');
      if (/dekat|close|besar/i.test(r)) modifyElements.push('closer view');
      if (/jauh|far|kecil/i.test(r)) modifyElements.push('farther view');
      if (/realistis|realistic/i.test(r)) modifyElements.push('more realistic');
      if (/cyberpunk/i.test(r)) modifyElements.push('cyberpunk neon style');
      if (/anime|kartun/i.test(r)) modifyElements.push('anime style');
      if (/3d/i.test(r)) modifyElements.push('3D render');
      if (/hitam\s+putih|black\s+and\s+white/i.test(r)) modifyElements.push('black and white');
      if (/langit|sky/i.test(r)) modifyElements.push('modified sky');
      if (/latar|background/i.test(r)) modifyElements.push('modified background');
      if (/gelap|darker/i.test(r) && !modifyElements.includes('nighttime')) modifyElements.push('darker lighting');
      if (/terang|brighter/i.test(r)) modifyElements.push('brighter lighting');
      if (modifyElements.length === 0) {
        const cleanMod = r.replace(/^(?:sekarang|coba|tolong)?\s*(?:jadikan|buat\s+jadi|bikin\s+jadi|ubah\s+jadi|ganti\s+jadi|ubah|ganti)\s*/i, '').trim();
        modifyElements.push(cleanMod || 'modified visual scene');
      }

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
        toolsNeeded: ['image.edit'],
        toolReason: 'User requests modification of existing visual asset. Must route to ImageEditing with reference.',
        needsClarification: false,
        clarificationQuestion: null,
        confidence: 0.95,
        reason: 'Deterministic classifier: image revision task detected from revision intent and active visual context.',
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
          aspectRatio: (/\b(?:16[:x]9|16\/9|landscape|horizontal|mendatar|lebar|panjang)\b/i.test(raw) ? '16:9' : /\b(?:9[:x]16|9\/16|portrait|vertikal|tegak|story|wallpaper)\b/i.test(raw) ? '9:16' : '1:1'),
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
   * Deterministic Task Classifier — Cleaned from over-engineering hijacking.
   * Pure generative, analytical, reporting, and presentation tasks MUST NOT
   * be hijacked into broken DAG AgentRuntime tool loops.
   * They must stream directly through the LLM for natural, articulate answers.
   */
  _deterministicTaskClassifier(raw, activeConstraints = []) {
    const r = raw;

    // LEGAL AUDIT (Audit Justice + Audit Kebijakan Publik) — MUST run before the
    // generic DOCUMENT_ANALYSIS branch below, otherwise a legal/policy audit
    // request would be downgraded into an ordinary document summary.
    // Shared lexicon with the LocalRouter fast-path (detectLegalAuditIntent).
    const legalAudit = detectLegalAuditIntent(r);
    if (legalAudit.isLegalAudit) {
      const policyHinted = /(?:audit\s+kebijakan|kebijakan\s+publik|peraturan\s+pemerintah|perda|perpu|apbn|apbd|deviasi\s+anggaran|anggaran\s+negara|omnibus|tata\s+kelola|kebijakan)/i.test(r);
      return {
        intent: 'LEGAL_AUDIT',
        goal: r,
        resolvedReferences: [],
        actionRequired: true,
        entities: [policyHinted ? 'public_policy_document' : 'legal_document', 'legal_audit'],
        constraints: activeConstraints,
        isCorrecting: false,
        isContinuing: false,
        freshDataRequired: false,
        toolsNeeded: ['legal.audit'],
        toolReason: policyHinted
          ? 'Permintaan audit kebijakan publik (PP/UU/Perda/APBN-APBD) → Audit Kebijakan Publik (AKP).'
          : 'Permintaan audit dokumen hukum Indonesia → Audit Justice.',
        auditFocus: policyHinted ? 'kebijakan publik' : 'hukum',
        needsClarification: false,
        clarificationQuestion: null,
        confidence: 0.98,
        reason: legalAudit.reason,
        interpretationSource: 'DETERMINISTIC_LEGAL_AUDIT_CLASSIFIER',
        transportUsed: 'LOCAL_REASONING',
        fallbackUsed: false
      };
    }

    // DOCUMENT ANALYSIS — user asks to analyze/read/extract from a document.
    // Handled via dedicated Document Pipeline. Juga mencakup follow-up
    // lintas giliran ("buat analisa kamu", "buat kesimpulannya") yang
    // membawa --- [Konteks Dokumen ...] hasil re-inject frontend.
    if (/--- \[BERKAS DOKUMEN|--- \[DOKUMEN|--- \[Konteks Dokumen|--- \[STATUS DOKUMEN|analisis\s+dokumen|dokumen\s+ini|file\s+ini|pdf\s+ini|upload.*analisis|ekstrak\s+isi|baca\s+dokumen|ringkas\s+dokumen|summary\s+dokumen|buat\s+ringkasan\s+dari|buat\s+summary\s+dari|buat\s+analisa|buatkan\s+analisa|analisa\s+kamu|buat\s+kesimpulan|kesimpul\w*|simpulkan/i.test(r)) {
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
        toolsNeeded: ['document_pipeline'],
        toolReason: 'Analisis dokumen diproses melalui dedicated Document Reading Pipeline.',
        needsClarification: false,
        clarificationQuestion: null,
        confidence: 0.98,
        reason: 'Dedicated Document Pipeline for document reading and analysis.',
        interpretationSource: 'DIRECT_REASONING',
        transportUsed: 'LOCAL_REASONING',
        fallbackUsed: false
      };
    }

    // PRESENTATION & OUTLINE GENERATION — direct cognitive LLM reasoning
    if (/presentasi|slide|ppt|outline|point\s+point|poin\s+poin/i.test(r)) {
      return {
        intent: 'PRESENTATION_REASONING',
        goal: r,
        resolvedReferences: [],
        actionRequired: false,
        entities: ['presentation'],
        constraints: activeConstraints,
        isCorrecting: false,
        isContinuing: false,
        freshDataRequired: false,
        toolsNeeded: [],
        toolReason: 'Penyusunan materi dan kerangka presentasi diproses langsung secara cerdas oleh LLM.',
        needsClarification: false,
        confidence: 0.95,
        reason: 'Direct LLM streaming for presentation drafting.',
        interpretationSource: 'DIRECT_REASONING',
        transportUsed: 'LOCAL_REASONING',
        fallbackUsed: false
      };
    }

    // ALL OTHER GENERATIVE & ANALYTICAL WORK: No hijacking, let LLM answer directly!
    return null;
  }
}

export const semanticIntentEngineInstance = new SemanticIntentEngine();
export default semanticIntentEngineInstance;
