/**
 * server/studio/core/UnifiedStudioRouter.mjs
 * Master Deterministic Routing Engine for ULTIMATEAI JIN.
 *
 * Enforces the strict canonical 7-tier priority hierarchy:
 * P0: SYSTEM CONTROL GATE (stop, cancel, batalkan)
 * P1: ACTIVE STUDIO COMMAND (explicit commands: "slide 3", "buat denah", "buat grafik kedua")
 * P2: ACTIVE STUDIO CONTINUATION ("lanjut", "revisi slide 3", "ulang slide 5")
 * P3: STUDIO CREATION INTENT ("buat PPT 20 slide", "buat desain rumah 20x30", "analisis data ini")
 * P4: EXPLICIT IMAGE INTENT (standalone: "buat gambar rumah")
 * P5: SEMANTIC INTENT ENGINE (knowledge, documents, deep analysis)
 * P6: GENERIC AGENT / LLM (open dialogue)
 */

import { studioSessionManagerInstance } from './StudioSessionManager.mjs';
import { studioCommandParserInstance, MATCH_TYPES } from './StudioCommandParser.mjs';
import { studioCreationClassifierInstance } from './StudioCreationClassifier.mjs';

export class UnifiedStudioRouter {
  constructor() {
    this.sessionManager = studioSessionManagerInstance;
    this.commandParser = studioCommandParserInstance;
    this.creationClassifier = studioCreationClassifierInstance;
  }

  /**
   * P0 Check: System, Safety, and Control commands.
   */
  isSystemControl(input = '') {
    const text = String(input || '').toLowerCase().trim();
    return /^(?:jin\s+)?(?:stop|berhenti|cancel|batal|batalkan|pause|diam|tunggu|reset)$/i.test(text);
  }

  /**
   * P4 Check: Standalone explicit image generation requests.
   * Excludes any prompt with Studio tokens (slide, denah, grafik, ppt, etc.).
   */
  isExplicitImageRequest(input = '') {
    const text = String(input || '').toLowerCase().trim();

    // Rejection: Studio domain keywords must NOT be captured as standalone image generation
    if (/\b(?:slide|presentasi|deck|denah|fasad|tampak|grafik|tabel|dataset|csv)\b/i.test(text)) {
      return false;
    }

    return /^(?:jin\s+)?(?:buat(?:kan)?|generate|bikinkan?|lukiskan?)\s+(?:gambar|visual|foto|ilustrasi|wallpaper|potret)\b/i.test(text) ||
      /^(?:create|generate)\s+an?\s+image\s+of\b/i.test(text) ||
      /\b(?:gambar|foto|lukisan)\s+(?:pemandangan|sunset|mobil|pesawat|kucing|pantai|gunung|hutan)\b/i.test(text);
  }

  /**
   * Main routing contract. Returns an auditable decision object.
   */
  route(input = '', context = {}) {
    const rawInput = String(input || '').trim();
    const reqId = context.requestId || '';

    // ═══════════════════════════════════════════════════════════════════════════
    // P0: SYSTEM / CONTROL COMMAND
    // ═══════════════════════════════════════════════════════════════════════════
    if (this.isSystemControl(rawInput)) {
      const decision = {
        route: 'SYSTEM_CONTROL',
        priority: 'P0',
        matchType: MATCH_TYPES.EXACT,
        confidence: 1.0,
        reason: 'system_control_command',
        action: 'STOP_OPERATION',
        parameters: {},
        sessionId: null,
        bypassSemanticIntentEngine: true,
        bypassImageGeneration: true
      };
      this._logDecision(rawInput, decision, 'NONE', reqId);
      return decision;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // P1 & P2: ACTIVE STUDIO CONTEXT COMMAND / CONTINUATION
    // ═══════════════════════════════════════════════════════════════════════════
    const activeSession = context.activeStudio || this.sessionManager.getActiveSession();
    const parsed = this.commandParser.parse(rawInput, activeSession);

    if (parsed.matchType !== MATCH_TYPES.NONE) {
      // P1: Exact or Strong Active Studio Command
      if (parsed.matchType === MATCH_TYPES.EXACT || parsed.matchType === MATCH_TYPES.STRONG) {
        const decision = {
          route: parsed.studio,
          priority: 'P1',
          matchType: parsed.matchType,
          confidence: parsed.matchType === MATCH_TYPES.EXACT ? 1.0 : 0.9,
          reason: parsed.reason,
          action: parsed.action,
          parameters: parsed.parameters,
          sessionId: activeSession?.sessionId || null,
          bypassSemanticIntentEngine: true,
          bypassImageGeneration: true
        };
        this._logDecision(rawInput, decision, parsed.studio, reqId);
        return decision;
      }

      // P2: Contextual Continuation / Revision
      if (parsed.matchType === MATCH_TYPES.CONTEXTUAL && parsed.isCompatible) {
        const decision = {
          route: parsed.studio,
          priority: 'P2',
          matchType: MATCH_TYPES.CONTEXTUAL,
          confidence: 0.85,
          reason: parsed.reason,
          action: parsed.action,
          parameters: parsed.parameters,
          sessionId: activeSession?.sessionId || null,
          bypassSemanticIntentEngine: true,
          bypassImageGeneration: true
        };
        this._logDecision(rawInput, decision, parsed.studio, reqId);
        return decision;
      }

      // Ambiguous Feedback: keep within studio context or request clarification, NEVER accidently invoke image generator
      if (parsed.matchType === MATCH_TYPES.AMBIGUOUS) {
        const decision = {
          route: parsed.studio,
          priority: 'P2',
          matchType: MATCH_TYPES.AMBIGUOUS,
          confidence: 0.5,
          reason: parsed.reason,
          action: parsed.action,
          parameters: parsed.parameters,
          sessionId: activeSession?.sessionId || null,
          bypassSemanticIntentEngine: true,
          bypassImageGeneration: true
        };
        this._logDecision(rawInput, decision, parsed.studio, reqId);
        return decision;
      }
    }

    const activeStudioName = activeSession?.studioType || 'NONE';


    // ═══════════════════════════════════════════════════════════════════════════
    // P3: STUDIO CREATION INTENT (Instantiate new studio project)
    // ═══════════════════════════════════════════════════════════════════════════
    const creationResult = this.creationClassifier.classify(rawInput);
    if (creationResult.matched) {
      const decision = {
        route: creationResult.studioType,
        priority: 'P3',
        matchType: MATCH_TYPES.EXACT,
        confidence: 0.95,
        reason: creationResult.reason,
        action: 'CREATE_STUDIO',
        parameters: creationResult.parameters,
        sessionId: null,
        bypassSemanticIntentEngine: true,
        bypassImageGeneration: true
      };
      this._logDecision(rawInput, decision, activeStudioName, reqId);
      return decision;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // P4: EXPLICIT IMAGE INTENT (Standalone image generation request)
    // ═══════════════════════════════════════════════════════════════════════════
    if (this.isExplicitImageRequest(rawInput)) {
      const decision = {
        route: 'IMAGE_GENERATION',
        priority: 'P4',
        matchType: MATCH_TYPES.EXACT,
        confidence: 0.95,
        reason: 'explicit_standalone_image_intent',
        action: 'GENERATE_IMAGE',
        parameters: { prompt: rawInput },
        sessionId: null,
        bypassSemanticIntentEngine: true,
        bypassImageGeneration: false
      };
      this._logDecision(rawInput, decision, activeStudioName, reqId);
      return decision;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // P5: SEMANTIC INTENT ENGINE (Knowledge / Agent tools / Deep analysis)
    // ═══════════════════════════════════════════════════════════════════════════
    const isDomainQuery = /\b(?:jelaskan|analisis|uu|undang-undang|peraturan|kebijakan|data|riset|laporan)\b/i.test(rawInput);
    if (isDomainQuery) {
      const decision = {
        route: 'SEMANTIC_INTENT',
        priority: 'P5',
        matchType: MATCH_TYPES.STRONG,
        confidence: 0.8,
        reason: 'domain_analysis_knowledge_query',
        action: 'DISPATCH_DOMAIN_AGENT',
        parameters: { query: rawInput },
        sessionId: null,
        bypassSemanticIntentEngine: false,
        bypassImageGeneration: true
      };
      this._logDecision(rawInput, decision, activeStudioName, reqId);
      return decision;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // P6: GENERIC AGENT / LLM (Open dialogue)
    // ═══════════════════════════════════════════════════════════════════════════
    const decision = {
      route: 'GENERIC_AGENT',
      priority: 'P6',
      matchType: MATCH_TYPES.NONE,
      confidence: 0.5,
      reason: 'general_conversational_turn',
      action: 'CHAT_COMPLETION',
      parameters: { prompt: rawInput },
      sessionId: null,
      bypassSemanticIntentEngine: false,
      bypassImageGeneration: true
    };
    this._logDecision(rawInput, decision, activeStudioName, reqId);
    return decision;
  }

  _logDecision(input, decision, activeStudio = 'NONE', requestId = '') {
    const slideNum = decision.parameters?.slideNumber || decision.parameters?.targetStep || 'N/A';
    const reqTag = requestId ? `[${requestId}] ` : '';
    console.log(`${reqTag}[UNIFIED_ROUTER] input="${input}" activeStudio=${activeStudio} matchType=${decision.matchType} priority=${decision.priority} action=${decision.action || 'NONE'} target=${slideNum} semanticIntentEngine=${decision.bypassSemanticIntentEngine ? 'SKIPPED' : 'EVALUATE'} imageGeneration=${decision.bypassImageGeneration ? 'SKIPPED' : 'EVALUATE'}`);
  }
}

export const unifiedStudioRouterInstance = new UnifiedStudioRouter();
export default unifiedStudioRouterInstance;
