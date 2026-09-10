/**
 * AgentRuntime.mjs
 * Central Autonomous Agent Loop Coordinator for UltimateAI.
 *
 * Two Forces Routing:
 *   INTERNAL → Ollama (direct, no planner needed)
 *   EXTERNAL → Antigravity (full pipeline)
 *   HYBRID   → Ollama (local context) + Antigravity (internet evidence)
 *
 * Full Autonomous Decision Loop:
 *  UNDERSTAND ➔ CLASSIFY SCOPE ➔ ROUTE ➔ PLAN ➔ EXPLORE ➔ EXECUTE ➔ VERIFY
 *  ➔ RESPOND ➔ STORE
 */

import { decisionEngineInstance } from './DecisionEngine.mjs';
import { AgentPlanner } from './AgentPlanner.mjs';
import { agentExecutorInstance } from './AgentExecutor.mjs';
import { AgentObserver } from './AgentObserver.mjs';
import { AgentVerifier } from './AgentVerifier.mjs';
import { replanEngineInstance } from './ReplanEngine.mjs';
import { jinResponseEngineInstance } from './JINResponseEngine.mjs';
import { JIN_OPERATING_DOCTRINE } from './AgentPolicy.mjs';
import { KnowledgeGapDetector } from './KnowledgeGapDetector.mjs';
import { routingOptimizerInstance } from '../routing/RoutingOptimizer.mjs';
import { activeMemoryCoreInstance } from '../memory/ActiveMemoryCore.mjs';
import { providerIntelligenceRouterInstance, SCOPE, PROVIDER } from '../routing/ProviderIntelligenceRouter.mjs';
import { ollamaProviderInstance } from '../providers/OllamaProvider.mjs';
import { exploreAgentInstance } from './ExploreAgent.mjs';
import { evidenceChainBuilderInstance, VERIFICATION_STATUS } from './EvidenceChain.mjs';
import { normalizeModelResponse } from './ResponseNormalizer.mjs';
import { imageGenerationInstance } from './ImageGeneration.mjs';
import { getMarketOverview } from '../market/MarketDataService.mjs';
import { getResilientMarketChart } from '../market/persistentMarket.mjs';
import crypto from 'crypto';

// Architectural Design Engine v1 (Fase 1 - 4)

// Professional Work System (FASE 0 + FASE 1 + FASE 2)
import { WorkSession, WorkExecutor, ArtifactStream, ConversationCanvas, IntelligenceOrchestrator, DomainRouter, TaskPlanner, ResearchService, DocumentService, ContentService, PPTService, DataService, AutomationService, VoiceService } from '../../src/services/work/index.js';

export class AgentRuntime {
  constructor() {
    this.sessionGoalHistory = [];
  }

  /**
   * Main Autonomous Execution Loop
   * @param {string} userGoal - User spoken/typed natural input
   * @param {Object} sessionContext - Context, previous turns, memory
   * @param {Object} options - { failClosed: boolean, forcedModel: string, certificationTransport: 'LOCAL_ROUTER_PROXY' | 'DIRECT_PROVIDER' }
   * @returns {Promise<Object>} executionSummary
   */
  async runGoal(userGoal, sessionContext = {}, options = {}) {
    const startTime = Date.now();
    const rawGoal = userGoal || '';
    const timeline = [];
    const generationId = options.generationId || crypto.randomUUID();
    const messageId = options.messageId || null;
    options.generationId = generationId;
    options.messageId = messageId;

    timeline.push({ event: 'TASK_CREATED', timestamp: new Date().toISOString(), goal: rawGoal });

    // 1. SEMANTIC DECISION ENGINE & SCOPE CLASSIFICATION
    const decision = await decisionEngineInstance.decide(rawGoal, sessionContext, options);
    const routing = providerIntelligenceRouterInstance.classifyScope(rawGoal, sessionContext);

    timeline.push({
      event: 'SCOPE_CLASSIFIED',
      intent: decision.intent,
      sourceScope: routing.scope,
      complexity: decision.complexityLevel || null,
      preferredProvider: routing.preferredProvider,
      timestamp: new Date().toISOString()
    });

    // If pure conversation without task delegation
    if (!decision.actionRequired) {
      // EXTERNALRequired conversations that reach here (actionRequired=false) must NOT be answered by Ollama
      // if they require real-time data. Check fabrication guard.
      if (routing.scope === SCOPE.EXTERNAL_REQUIRED && routing.requiresRealTimeData) {
        const ollamaPermission = providerIntelligenceRouterInstance.checkOllamaFallbackPermission(
          routing.scope, routing.restrictions, false
        );
        if (!ollamaPermission.allowed) {
          const limitation = providerIntelligenceRouterInstance.generateLimitationMessage(rawGoal);
          const summary = {
            goal: rawGoal,
            success: false,
            confidence: 0,
            actionRequired: false,
            intent: decision.intent,
            sourceScope: routing.scope,
            providerRouting: routing,
            responseMessage: limitation.responseMessage,
            detailedDisplay: limitation.detailedDisplay,
            responseSource: limitation.responseSource,
            claims: limitation.claims,
            evidenceRefs: limitation.evidenceRefs,
            provenance: limitation.provenance,
            timeline,
            durationMs: Date.now() - startTime
          };
          this.sessionGoalHistory.push(summary);
          return this._normalizeSummary(summary);
        }
      }

      const responsePayload = await jinResponseEngineInstance.generateResponse({
        userUtterance: rawGoal,
        conversationContext: sessionContext,
        decision,
        sourceScope: routing.scope,
        providerRouting: routing
      }, options);

      // Record performance telemetry
      routingOptimizerInstance.recordTaskOutcome({
        engine: decision.semanticModel || 'qwen3:8b',
        taskCategory: decision.intent,
        latencyMs: Date.now() - startTime,
        success: true,
        verified: true
      });

      const summary = {
        goal: rawGoal,
        success: true,
        confidence: 1.0,
        actionRequired: false,
        intent: decision.intent,
        sourceScope: routing.scope,
        providerRouting: routing,
        interpretationSource: decision.interpretationSource,
        responseSource: responsePayload.responseSource,
        transportUsed: decision.transportUsed || options.certificationTransport || 'LOCAL_ROUTER_PROXY',
        provenance: {
          semanticModel: decision.semanticModel || options.forcedModel || 'qwen3:8b',
          planningEngine: 'hierarchical_semantic_dag_planner',
          executionTools: [],
          modelInvocations: [
            {
              model: decision.semanticModel || options.forcedModel || 'qwen3:8b',
              purpose: 'semantic_intent_interpretation',
              transport: decision.transportUsed || options.certificationTransport || 'LOCAL_ROUTER_PROXY'
            }
          ],
          transport: decision.transportUsed || options.certificationTransport || 'LOCAL_ROUTER_PROXY'
        },
        fallbackUsed: decision.fallbackUsed,
        responseMessage: responsePayload.naturalVoiceSpeech,
        detailedDisplay: responsePayload.detailedTextDisplay,
        claims: responsePayload.claims,
        evidenceRefs: responsePayload.evidenceRefs,
        timeline,
        durationMs: Date.now() - startTime
      };

      this.sessionGoalHistory.push(summary);
      return this._normalizeSummary(summary);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 1B. IMAGE_GENERATION — Dedicated pipeline before scope routing
    // ═══════════════════════════════════════════════════════════════════════════
    if (decision.intent === 'IMAGE_GENERATION') {
      const executionResult = await this._executeImageGeneration(rawGoal, decision, routing, sessionContext, options, startTime, timeline);
      return this._normalizeSummary(executionResult);
    }

    // 1B. MARKET_DATA — Dedicated market pipeline before scope routing.
    //     Market instrument + market intent → Market Data engine (real feed), NEVER
    //     generic web.search / YouTube. Honest LIVE/DELAYED/SNAPSHOT/STALE labels.
    if (decision.intent === 'MARKET_DATA') {
      const executionResult = await this._executeMarketData(rawGoal, decision, routing, sessionContext, options, startTime, timeline);
      return this._normalizeSummary(executionResult);
    }

    // 1B3. PROFESSIONAL_WORK — Generic work execution via ProfessionalWorkExecutor
    if (decision.actionRequired && decision.intent !== 'IMAGE_GENERATION' && decision.intent !== 'MARKET_DATA') {
      const executionResult = await this._executeWork(rawGoal, decision, routing, sessionContext, options, startTime, timeline);
      return this._normalizeSummary(executionResult);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. SCOPE-BASED ROUTING
    // ═══════════════════════════════════════════════════════════════════════════

    let executionResult;
    if (routing.scope === SCOPE.LOCAL_ONLY) {
      // ── LOCAL_ONLY: Direct Ollama execution (skip planner) ──────────────
      executionResult = await this._executeLocalOnly(rawGoal, decision, routing, sessionContext, options, startTime, timeline);
    } else if (routing.scope === SCOPE.EXTERNAL_REQUIRED) {
      // ── EXTERNAL_REQUIRED: Full pipeline via Antigravity ────────────────
      executionResult = await this._executeExternalRequired(rawGoal, decision, routing, sessionContext, options, startTime, timeline);
    } else {
      // ── HYBRID: Full pipeline with both providers ─────────────────────────
      executionResult = await this._executeHybrid(rawGoal, decision, routing, sessionContext, options, startTime, timeline);
    }

    return this._normalizeSummary(executionResult);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMAGE_GENERATION PATH — Dedicated image generation pipeline
  // ═══════════════════════════════════════════════════════════════════════════
  async _executeImageGeneration(rawGoal, decision, routing, sessionContext, options, startTime, timeline) {
    const generationId = options.generationId;
    const messageId = options.messageId || null;

    // PLAN stage: use the dedicated 6-stage image plan from AgentPlanner
    timeline.push({
      event: 'PLAN_STARTED',
      planningEngine: 'image_generation_pipeline',
      scope: routing.scope,
      intent: 'IMAGE_GENERATION',
      timestamp: new Date().toISOString()
    });

    const planOptions = {
      ...sessionContext,
      semanticDecision: { ...decision },
      generationId,
      messageId,
      // Failure-injection / provider override propagation: options → plan → executor → image.generate
      ...(options.providerOverride ? { providerOverride: options.providerOverride } : {}),
      ...(options.negativePrompt ? { negativePrompt: options.negativePrompt } : {}),
      ...(options.size ? { size: options.size } : {})
    };
    let currentPlan = await AgentPlanner.planGoal(rawGoal, planOptions);

    timeline.push({
      event: 'PLAN_COMPLETED',
      goalId: currentPlan.goalId,
      stepCount: currentPlan.steps.length,
      planStrategy: 'image_generation_6stage',
      timestamp: new Date().toISOString()
    });

    // EXPLORE stage: only when factual/reference context is required
    const requiresReference = /akurat|persis|presisi|sesuai|asli|referensi|acuan|detail|landmark|bangunan\s+(?:asli|terkenal|ikonik)/i.test(rawGoal);
    let explorationResult = null;

    if (requiresReference) {
      timeline.push({
        event: 'EXPLORE_STARTED',
        scope: routing.scope,
        provider: 'LOCAL_REASONING',
        reason: 'Factual reference accuracy required',
        timestamp: new Date().toISOString()
      });
      explorationResult = await exploreAgentInstance.explore(currentPlan, decision, { ...sessionContext, explorationMode: 'LIGHT', skipLiveProbe: true });
      this._pushExplorationTimeline(timeline, explorationResult);
    } else {
      timeline.push({
        event: 'EXPLORE_SKIPPED',
        reason: 'Pure creative image — no factual reference context needed',
        timestamp: new Date().toISOString()
      });
    }

    // BUILD stage: execute the 6-stage image plan
    timeline.push({
      event: 'BUILD_STARTED',
      planStepCount: currentPlan.steps.length,
      timestamp: new Date().toISOString()
    });

    const currentHistory = [];
    let finalArtifact = null;

    for (const step of currentPlan.steps) {
      timeline.push({
        event: 'ACTION_EXECUTED',
        stepId: step.id,
        subgoal: step.subgoal,
        tool: step.tool,
        stage: step.params?.stage,
        provider: 'IMAGE_GENERATION',
        timestamp: new Date().toISOString()
      });

      const stepResult = await agentExecutorInstance.executeStep(step, {
        priorHistory: currentHistory,
        sessionContext,
        options: { ...options, forceProvider: 'IMAGE_GENERATION' },
        exploration: explorationResult,
        generationId,
        messageId,
        signal: options.signal || null
      });

      const observation = AgentObserver.observe(step, stepResult);
      currentHistory.push({ step, stepResult, observation, timestamp: new Date().toISOString() });

      // Capture the canonical image artifact from the GENERATE stage.
      // Single normalization point: the artifact that carries url/status/type is
      // the canonical ImageGeneration artifact (imageResult.artifact), surfaced at
      // the top level of stepResult.result — NOT the ArtifactManager wrapper.
      const stepResultArtifact =
        stepResult?.result?.artifact || (stepResult?.result?.type === 'IMAGE' ? stepResult.result : null);
      if (stepResultArtifact) {
        finalArtifact = stepResultArtifact;
      }

      if (!observation.valid) {
        timeline.push({
          event: 'ACTION_FAILED',
          stepId: step.id,
          error: observation.error || 'Image generation step failed',
          timestamp: new Date().toISOString()
        });
        break;
      }
    }

    // VERIFY stage
    timeline.push({ event: 'VERIFY_STARTED', provider: 'IMAGE_GENERATION', timestamp: new Date().toISOString() });

    let verification;
    if (finalArtifact) {
      const imageVerification = imageGenerationInstance.verifyArtifact(finalArtifact);
      const semanticVerification = imageGenerationInstance.verifyImageSemantic({
        prompt: finalArtifact.originalPrompt || rawGoal,
        normalizedPrompt: finalArtifact.normalizedPrompt || finalArtifact.prompt,
        image: finalArtifact
      });
      const artifactRenderable = imageVerification.renderable;
      const semanticCheckSatisfied = !semanticVerification.available || semanticVerification.verified;
      verification = {
        // A valid persisted/renderable artifact is a successful generation even
        // when optional semantic inspection is unavailable. Keep that limitation
        // visible in the verification status instead of reporting false failure.
        isSatisfied: artifactRenderable && semanticCheckSatisfied,
        artifact: finalArtifact,
        confidence: artifactRenderable && semanticVerification.verified
          ? 0.99
          : artifactRenderable
            ? 0.8
            : 0,
        verificationStatus: !artifactRenderable
          ? VERIFICATION_STATUS.UNVERIFIED
          : semanticVerification.available && semanticVerification.verified
            ? VERIFICATION_STATUS.VERIFIED
            : VERIFICATION_STATUS.PARTIALLY_VERIFIED,
        failureReason: !imageVerification.renderable
          ? imageVerification.reason
          : semanticVerification.available && !semanticVerification.verified
            ? semanticVerification.reason
            : null,
        semanticVerification
      };
    } else {
      // Canonical FAILURE contract: explicit failed artifact (never null-as-success),
      // carrying the real error. verificationStatus stays a valid enum value.
      const realFailure = (currentHistory.find(h => h.observation && h.observation.valid === false)?.observation?.error)
        || (currentHistory.find(h => h.stepResult && h.stepResult.success === false)?.stepResult?.error)
        || 'No image artifact was produced during generation.';

      verification = {
        isSatisfied: false,
        artifact: {
          id: `img-failed-${Date.now()}`,
          type: 'IMAGE',
          status: 'failed',
          url: null,
          thumbnailUrl: null,
          localPath: null,
          mimeType: null,
          width: null,
          height: null,
          provider: currentHistory.find(h => h.stepResult?.result?.provider)?.stepResult?.result?.provider || null,
          prompt: rawGoal,
          originalPrompt: rawGoal,
          normalizedPrompt: imageGenerationInstance.normalizeImagePrompt(rawGoal),
          generationId,
          messageId,
          bytesSize: 0,
          createdAt: new Date().toISOString(),
          renderable: false,
          error: realFailure
        },
        confidence: 0,
        verificationStatus: VERIFICATION_STATUS.FAILED,
        failureReason: realFailure
      };
    }

    timeline.push({
      event: 'VERIFICATION_EVALUATED',
      isSatisfied: verification.isSatisfied,
      verificationStatus: verification.verificationStatus,
      confidence: verification.confidence,
      timestamp: new Date().toISOString()
    });
    timeline.push({ event: 'VERIFY_COMPLETED', isSatisfied: verification.isSatisfied, timestamp: new Date().toISOString() });

    // Response synthesis: image-aware
    const responsePayload = await jinResponseEngineInstance.generateResponse({
      userUtterance: rawGoal,
      conversationContext: sessionContext,
      decision,
      executionHistory: currentHistory,
      artifact: verification.artifact,
      generationId,
      messageId,
      verification,
      sourceScope: routing.scope,
      providerRouting: routing,
      provenance: {
        semanticModel: 'image_generation_pipeline',
        planningEngine: 'image_generation_6stage',
        executionTools: ['image.generate'],
        pool: 'LOCAL_IMAGE',
        transport: verification.artifact?.provider || 'POLLINATIONS'
      }
    }, options);

    // Evidence chain
    const evidenceChain = evidenceChainBuilderInstance.buildChain({
      claim: rawGoal,
      goal: rawGoal,
      scope: routing.scope,
      explorationResult,
      executionHistory: currentHistory,
      verification,
      decision
    });

    const summary = {
      goal: rawGoal,
      generationId,
      messageId,
      success: verification.isSatisfied,
      confidence: verification.confidence,
      actionRequired: true,
      intent: 'IMAGE_GENERATION',
      sourceScope: routing.scope,
      providerRouting: routing,
      attempts: 1,
      responseMessage: responsePayload.naturalVoiceSpeech,
      detailedDisplay: responsePayload.detailedTextDisplay,
      claims: responsePayload.claims,
      evidenceRefs: responsePayload.evidenceRefs,
      responseSource: responsePayload.responseSource,
      artifact: verification.artifact,
      visualIntent: decision.visualIntent || null,
      presentation: {
        artifactType: 'IMAGE',
        mode: decision.visualIntent?.mode || 'GENERIC_IMAGE',
        surface: decision.visualIntent?.mode === 'SLIDE_VISUAL'
          ? 'CONVERSATION_CANVAS'
          : 'CONVERSATION_CANVAS'
      },
      verificationStatus: verification.verificationStatus,
      failureReason: verification.failureReason || null,
      evidenceChain,
      provenance: {
        semanticModel: 'image_generation_pipeline',
        planningEngine: 'image_generation_6stage',
        executionTools: ['image.generate'],
        selectedPool: 'LOCAL_IMAGE',
        transport: verification.artifact?.provider || 'POLLINATIONS'
      },
      interpretationSource: decision.interpretationSource,
      transportUsed: 'LOCAL_REASONING',
      fallbackUsed: false,
      timeline,
      durationMs: Date.now() - startTime,
      telemetry: {
        totalStepsExecuted: currentHistory.length,
        status: verification.isSatisfied ? 'VERIFIED_COMPLETED' : 'PARTIAL_COMPLETED'
      }
    };

    this.sessionGoalHistory.push(summary);
    return summary;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MARKET_DATA PATH — Dedicated market pipeline. Routes to the Market Data
  // engine (real feed), NEVER generic web.search / YouTube. Honest data labels.
  // ═══════════════════════════════════════════════════════════════════════════
  async _executeMarketData(rawGoal, decision, routing, sessionContext, options, startTime, timeline) {
    const now = () => new Date().toISOString();
    const panelId = decision.panelId || null;
    const instrument = decision.instrument || (panelId ? String(panelId).replace(/^market\./, '').toUpperCase() : 'UNKNOWN');
    const subIntent = decision.subIntent || 'current_price';
    const categoryLabel = decision.categoryLabel || 'MARKET';
    const instrumentName = decision.instrumentName || instrument;

    // Visible internal activity: router decision is logged explicitly so a market
    // request can never silently slide into generic web/video search.
    timeline.push({
      event: 'MARKET_DATA_ROUTED',
      intent: 'MARKET_DATA',
      instrument,
      panelId,
      subIntent,
      category: categoryLabel,
      router: 'MARKET_DATA_ENGINE',
      source: 'market_feed',
      timestamp: now()
    });

    let overview = null;
    let chartResult = null;
    let panel = null;
    let error = null;

    try {
      overview = await getMarketOverview();
      panel = (overview && Array.isArray(overview.panels) ? overview.panels : []).find((p) => p.id === panelId) || null;
    } catch (e) {
      error = (e && e.message) || String(e);
    }

    // Chart sub-intent: drive the resilient chart engine (JIN Persistent Intelligence).
    if (subIntent === 'chart') {
      try {
        chartResult = await getResilientMarketChart({ panelId: panelId || undefined });
      } catch (e2) {
        if (!error) error = (e2 && e2.message) || String(e2);
      }
    }

    // Honest data-state label: near-real-time quotes are SNAPSHOT, never fabricated LIVE.
    let dataState = 'SNAPSHOT';
    if (subIntent === 'chart' && chartResult && chartResult.ok && chartResult.chart && chartResult.chart.dataState) {
      dataState = String(chartResult.chart.dataState).toUpperCase();
    } else if (panel && panel.dataStatus) {
      dataState = String(panel.dataStatus).toUpperCase();
    }

    const succeeded = (subIntent === 'chart')
      ? Boolean(chartResult && chartResult.ok && chartResult.chart)
      : Boolean(panel);

    const source = panel && panel.source ? panel.source
      : (chartResult && chartResult.ok && chartResult.report && chartResult.report.providerUsed
          ? chartResult.report.providerUsed : 'market_feed');

    timeline.push({
      event: 'MARKET_DATA_RESULT',
      succeeded,
      dataState,
      router: 'MARKET_DATA_ENGINE',
      source,
      timestamp: now()
    });

    const activityLog = {
      'USER INTENT': 'MARKET_DATA',
      'INSTRUMENT': instrument,
      'INSTRUMENT_NAME': instrumentName,
      'ROUTER': 'MARKET_DATA_ENGINE',
      'SOURCE': succeeded ? source : 'unavailable',
      'STATUS': succeeded ? dataState : 'ERROR',
      'SUB_INTENT': subIntent
    };
    timeline.push({ event: 'MARKET_DATA_ACTIVITY', activity: activityLog, timestamp: now() });

    const priceInfo = panel ? {
      displayName: panel.name,
      symbol: panel.symbol,
      value: panel.value,
      changePercent: panel.changePercent,
      currency: panel.currency,
      marketState: panel.marketState,
      verificationStatus: panel.verificationStatus
    } : null;

    const responseMessage = succeeded
      ? (subIntent === 'chart'
          ? `Grafik ${instrumentName} dimuat dari sumber resmi (${dataState}).`
          : `${instrumentName} saat ini ${panel.value != null ? panel.value : '—'}${panel.currency ? ` ${panel.currency}` : ''} (${panel.changePercent != null ? panel.changePercent : 0}%) — sumber: ${source} (${dataState}).`)
      : `Belum dapat memuat data pasar untuk ${instrumentName} dari sumber resmi${error ? ` — ${error}` : ''}.`;

    const summary = {
      goal: rawGoal,
      success: succeeded,
      confidence: succeeded ? 0.95 : 0,
      actionRequired: true,
      intent: 'MARKET_DATA',
      subIntent,
      instrument,
      instrumentName,
      panelId,
      category: categoryLabel,
      dataState,
      source: 'MARKET_DATA_ENGINE',
      sourceScope: routing.scope,
      providerRouting: routing,
      attempts: 1,
      responseMessage,
      detailedDisplay: responseMessage,
      claims: [],
      evidenceRefs: [],
      responseSource: 'MARKET_DATA_ENGINE',
      resolutionSource: decision.interpretationSource || 'MARKET_DATA_CLASSIFIER',
      priceInfo,
      marketActivity: activityLog,
      provenance: {
        semanticModel: 'market_data_router',
        planningEngine: 'market_data_pipeline',
        executionTools: ['market.data'],
        selectedPool: 'MARKET_FEED',
        modelInvocations: [],
        transport: 'MARKET_FEED'
      },
      interpretationSource: decision.interpretationSource || 'MARKET_DATA_CLASSIFIER',
      transportUsed: 'LOCAL_REASONING',
      fallbackUsed: false,
      timeline,
      durationMs: Date.now() - startTime,
      telemetry: {
        totalStepsExecuted: 1,
        status: succeeded ? 'VERIFIED_COMPLETED' : 'PARTIAL_COMPLETED'
      }
    };

    this.sessionGoalHistory.push(summary);
    return summary;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOCAL_ONLY PATH — Ollama direct, no planner
  // ═══════════════════════════════════════════════════════════════════════════
  async _executeLocalOnly(rawGoal, decision, routing, sessionContext, options, startTime, timeline) {
    const gapAnalysis = KnowledgeGapDetector.analyzeGap(rawGoal, sessionContext);

    // PLAN stage (formal): minimal local plan — hierarchical goal → single step
    timeline.push({
      event: 'PLAN_STARTED',
      planningEngine: 'local_direct_executor',
      scope: SCOPE.LOCAL_ONLY,
      gap: gapAnalysis.hasGap ? gapAnalysis.gapDescription : null,
      timestamp: new Date().toISOString()
    });

    // Create a minimal plan for LOCAL_ONLY tasks
    const currentPlan = {
      goalId: `local_${Date.now()}`,
      goal: rawGoal,
      category: decision.intent,
      selectedEngine: 'llama3.2:3b',
      selectedPool: 'LOCAL_OLLAMA',
      sourceScope: SCOPE.LOCAL_ONLY,
      hierarchicalObjectives: [`Execute local task: ${decision.intent}`],
      steps: [{
        id: 'S1',
        subgoal: `Execute local task: ${rawGoal}`,
        action: 'execute_local',
        tool: decision.toolsNeeded?.[0] || null,
        providerDomain: PROVIDER.OLLAMA,
        params: { query: rawGoal },
        dependsOn: []
      }]
    };

    timeline.push({
      event: 'PLAN_COMPLETED',
      goalId: currentPlan.goalId,
      stepCount: currentPlan.steps.length,
      planStrategy: gapAnalysis.strategy,
      timestamp: new Date().toISOString()
    });

    timeline.push({
      event: 'LOCAL_ONLY_ROUTING',
      provider: 'OLLAMA',
      engine: 'llama3.2',
      timestamp: new Date().toISOString()
    });

    // EXPLORE stage (formal): light internal exploration, never external for LOCAL_ONLY
    timeline.push({
      event: 'EXPLORE_STARTED',
      scope: SCOPE.LOCAL_ONLY,
      provider: 'OLLAMA',
      timestamp: new Date().toISOString()
    });
    const explorationResult = await exploreAgentInstance.explore(
      currentPlan,
      decision,
      { ...sessionContext, explorationMode: 'LIGHT' }
    );
    this._pushExplorationTimeline(timeline, explorationResult);

    // Save active state
    activeMemoryCoreInstance.snapshotActiveState({
      taskId: currentPlan.goalId,
      goal: rawGoal,
      currentStep: 1,
      activeTools: currentPlan.steps.map(s => s.tool).filter(Boolean),
      selectedPool: 'LOCAL_OLLAMA',
      selectedModel: 'llama3.2:3b'
    });

    // BUILD stage
    timeline.push({ event: 'BUILD_STARTED', planStepCount: 1, timestamp: new Date().toISOString() });

    // Execute the single step directly with Ollama
    const currentHistory = [];
    const step = currentPlan.steps[0];

    timeline.push({
      event: 'ACTION_EXECUTED',
      stepId: step.id,
      subgoal: step.subgoal,
      tool: step.tool,
      provider: 'OLLAMA',
      timestamp: new Date().toISOString()
    });

    // Execute tool if needed, then get Ollama response
    let toolResult = null;
    if (step.tool) {
      toolResult = await agentExecutorInstance.executeStep(step, {
        priorHistory: [],
        sessionContext,
        options: { ...options, forceProvider: 'OLLAMA' },
        exploration: explorationResult
      });
    }

    // LOCAL_ONLY tool tasks carry verified structured data. For those we skip a
    // redundant Ollama narration pass (which both delays the reply by tens of
    // seconds and leaks role labels such as "assistant" into the answer) and let
    // the deterministic evidence-synthesis layer format the response from the
    // tool's own live data instead. A narration pass only runs when no tool result
    // is present (pure local reasoning).
    const hasToolData = Boolean(toolResult?.result) && !this._isEmptyResult(toolResult.result);
    const stepResult = hasToolData
      ? { ...toolResult, success: true }
      : {
          success: true,
          result: {
            text: await this._callOllamaDirect(rawGoal, decision, toolResult, sessionContext),
            source: 'LOCAL_OLLAMA',
            scope: 'INTERNAL'
          }
        };

    const observation = { valid: true, status: 'COMPLETED' };
    currentHistory.push({ step, stepResult, observation, timestamp: new Date().toISOString() });

    // Verify
    timeline.push({ event: 'VERIFY_STARTED', provider: 'OLLAMA', timestamp: new Date().toISOString() });
    const verification = AgentVerifier.verifyGoalCompletion(currentPlan, currentHistory);

    timeline.push({
      event: 'VERIFICATION_EVALUATED',
      isSatisfied: verification.isSatisfied,
      verificationStatus: verification.verificationStatus || null,
      confidence: verification.confidence,
      timestamp: new Date().toISOString()
    });
    timeline.push({ event: 'VERIFY_COMPLETED', isSatisfied: verification.isSatisfied, timestamp: new Date().toISOString() });

    // Response synthesis
    const responsePayload = await jinResponseEngineInstance.generateResponse({
      userUtterance: rawGoal,
      conversationContext: sessionContext,
      decision,
      executionHistory: currentHistory,
      artifact: verification?.artifact,
      verification,
      sourceScope: SCOPE.LOCAL_ONLY,
      providerRouting: routing,
      provenance: {
        semanticModel: 'llama3.2:3b',
        planningEngine: 'local_direct_executor',
        executionTools: [step.tool].filter(Boolean),
        pool: 'LOCAL_OLLAMA',
        transport: 'DIRECT_OLLAMA'
      }
    }, options);

    // BUILD EVIDENCE CHAIN for LOCAL_ONLY
    const evidenceChain = evidenceChainBuilderInstance.buildChain({
      claim: rawGoal,
      goal: rawGoal,
      scope: SCOPE.LOCAL_ONLY,
      explorationResult,
      executionHistory: currentHistory,
      verification,
      decision
    });

    const summary = {
      goal: rawGoal,
      success: verification?.isSatisfied || false,
      confidence: verification?.confidence || 0.95,
      actionRequired: true,
      intent: decision.intent,
      sourceScope: SCOPE.LOCAL_ONLY,
      providerRouting: routing,
      attempts: 1,
      responseMessage: responsePayload.naturalVoiceSpeech,
      detailedDisplay: responsePayload.detailedTextDisplay,
      claims: responsePayload.claims,
      evidenceRefs: responsePayload.evidenceRefs,
      responseSource: responsePayload.responseSource,
      artifact: verification?.artifact || null,
      evidenceChain,
      provenance: {
        semanticModel: 'llama3.2:3b',
        planningEngine: 'local_direct_executor',
        executionTools: [step.tool].filter(Boolean),
        selectedPool: 'LOCAL_OLLAMA',
        modelInvocations: [{ model: 'llama3.2:3b', purpose: 'local_task_execution', transport: 'DIRECT_OLLAMA' }],
        transport: 'DIRECT_OLLAMA'
      },
      interpretationSource: decision.interpretationSource,
      transportUsed: 'DIRECT_OLLAMA',
      fallbackUsed: false,
      timeline,
      durationMs: Date.now() - startTime,
      telemetry: {
        totalStepsExecuted: 1,
        status: verification?.isSatisfied ? 'VERIFIED_COMPLETED' : 'PARTIAL_COMPLETED'
      }
    };

    this.sessionGoalHistory.push(summary);
    return summary;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXTERNAL_REQUIRED PATH — Full pipeline via Antigravity
  // ═══════════════════════════════════════════════════════════════════════════
  async _executeExternalRequired(rawGoal, decision, routing, sessionContext, options, startTime, timeline) {
    const gapAnalysis = KnowledgeGapDetector.analyzeGap(rawGoal, sessionContext);

    // PLAN stage (formal): hierarchical DAG plan via AgentPlanner
    timeline.push({
      event: 'PLAN_STARTED',
      planningEngine: 'hierarchical_dynamic_dag_planner',
      scope: SCOPE.EXTERNAL_REQUIRED,
      gap: gapAnalysis.hasGap ? gapAnalysis.gapDescription : null,
      timestamp: new Date().toISOString()
    });

    // Force Antigravity provider for external tasks
    const planOptions = {
      ...sessionContext,
      semanticDecision: { ...decision, providerDomain: PROVIDER.ANTIGRAVITY },
      gapAnalysis,
      forcedProvider: PROVIDER.ANTIGRAVITY
    };

    let currentPlan = await AgentPlanner.planGoal(rawGoal, planOptions);

    timeline.push({
      event: 'PLAN_COMPLETED',
      goalId: currentPlan.goalId,
      stepCount: currentPlan.steps.length,
      planStrategy: gapAnalysis.strategy,
      timestamp: new Date().toISOString()
    });

    // Set local execution engine
    currentPlan.selectedEngine = 'qwen3:8b';
    currentPlan.selectedPool = 'LOCAL_OLLAMA';
    currentPlan.sourceScope = SCOPE.EXTERNAL_REQUIRED;
    for (const step of currentPlan.steps) {
      step.providerDomain = PROVIDER.OLLAMA;
    }

    // Ensure web.search is included for external data queries
    const hasWebSearch = currentPlan.steps.some(s => s.tool === 'web.search');
    if (!hasWebSearch && routing.requiresRealTimeData) {
      currentPlan.steps.unshift({
        id: 'S_web',
        subgoal: 'Search web for latest information',
        action: 'EXECUTE_WEB_SEARCH',
        tool: 'web.search',
        specialistModel: currentPlan.selectedEngine,
        pool: currentPlan.selectedPool,
        params: { query: rawGoal },
        dependsOn: [],
        successCriteria: 'web.search_result_available',
        evidenceContract: 'web.search_evidence',
        providerDomain: PROVIDER.ANTIGRAVITY
      });
    }

    timeline.push({
      event: 'EXTERNAL_REQUIRED_ROUTING',
      provider: 'ANTIGRAVITY',
      engine: currentPlan.selectedEngine,
      pool: currentPlan.selectedPool,
      timestamp: new Date().toISOString()
    });

    // EXPLORE: formal stage — gather evidence before execution
    timeline.push({
      event: 'EXPLORE_STARTED',
      scope: SCOPE.EXTERNAL_REQUIRED,
      provider: 'ANTIGRAVITY',
      timestamp: new Date().toISOString()
    });
    const explorationResult = await exploreAgentInstance.explore(currentPlan, decision, sessionContext);
    this._pushExplorationTimeline(timeline, explorationResult);

    return await this._executePlanLoop(rawGoal, decision, routing, currentPlan, sessionContext, options, startTime, timeline, explorationResult);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HYBRID PATH — Full pipeline with both providers
  // ═══════════════════════════════════════════════════════════════════════════
  async _executeHybrid(rawGoal, decision, routing, sessionContext, options, startTime, timeline) {
    const gapAnalysis = KnowledgeGapDetector.analyzeGap(rawGoal, sessionContext);

    // PLAN stage (formal): hierarchical DAG plan via AgentPlanner
    timeline.push({
      event: 'PLAN_STARTED',
      planningEngine: 'hierarchical_dynamic_dag_planner',
      scope: SCOPE.HYBRID,
      gap: gapAnalysis.hasGap ? gapAnalysis.gapDescription : null,
      timestamp: new Date().toISOString()
    });

    let currentPlan = await AgentPlanner.planGoal(rawGoal, {
      ...sessionContext,
      semanticDecision: { ...decision, providerDomain: PROVIDER.ANTIGRAVITY },
      gapAnalysis
    });

    timeline.push({
      event: 'PLAN_COMPLETED',
      goalId: currentPlan.goalId,
      stepCount: currentPlan.steps.length,
      planStrategy: gapAnalysis.strategy,
      timestamp: new Date().toISOString()
    });

    currentPlan.sourceScope = SCOPE.HYBRID;

    // Assign provider domain per step based on tool type
    for (const step of currentPlan.steps) {
      if (step.tool === 'device.inspect' || step.tool === 'sandbox.execute' || step.tool === 'doc.analyze') {
        step.providerDomain = PROVIDER.OLLAMA;
      } else if (step.tool === 'web.search' || step.tool === 'web.fetch') {
        step.providerDomain = PROVIDER.ANTIGRAVITY;
      } else {
        step.providerDomain = PROVIDER.ANTIGRAVITY;
      }
    }

    timeline.push({
      event: 'HYBRID_ROUTING',
      stepDomains: currentPlan.steps.map(s => ({ step: s.id, tool: s.tool, provider: s.providerDomain })),
      timestamp: new Date().toISOString()
    });

    // EXPLORE: formal stage — gather evidence before execution
    timeline.push({
      event: 'EXPLORE_STARTED',
      scope: SCOPE.HYBRID,
      providers: [PROVIDER.OLLAMA, PROVIDER.ANTIGRAVITY],
      timestamp: new Date().toISOString()
    });
    const explorationResult = await exploreAgentInstance.explore(currentPlan, decision, sessionContext);
    this._pushExplorationTimeline(timeline, explorationResult);

    return await this._executePlanLoop(rawGoal, decision, routing, currentPlan, sessionContext, options, startTime, timeline, explorationResult);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHARED: Plan-Act-Observe-Verify Loop (EXTERNAL_REQUIRED + HYBRID)
  // ═══════════════════════════════════════════════════════════════════════════
  async _executePlanLoop(rawGoal, decision, routing, currentPlan, sessionContext, options, startTime, timeline, explorationResult = null) {
    const allStepIds = currentPlan.steps.map(s => s.id || s.stepId);

    // Save initial active state with full step manifest
    activeMemoryCoreInstance.snapshotActiveState({
      taskId: currentPlan.goalId,
      goal: rawGoal,
      currentStep: 1,
      activeTools: currentPlan.steps.map(s => s.tool).filter(Boolean),
      selectedPool: currentPlan.selectedPool,
      selectedModel: currentPlan.selectedEngine,
      completedSteps: [],
      pendingSteps: allStepIds,
      planSteps: currentPlan.steps.map(s => ({ id: s.id || s.stepId, tool: s.tool, subgoal: s.subgoal || s.action })),
      status: 'IN_PROGRESS'
    });

    // BUILD stage (formal)
    timeline.push({
      event: 'BUILD_STARTED',
      planStepCount: currentPlan.steps.length,
      baseAttempts: JIN_OPERATING_DOCTRINE.GOVERNANCE.MAX_REPLAN_ATTEMPTS,
      timestamp: new Date().toISOString()
    });

    let attempt = 0;
    let finalVerification = null;
    const fullExecutionHistory = [];
    const executionToolsUsed = [];
    const modelInvocations = [];

    modelInvocations.push({
      model: currentPlan.selectedEngine || 'gemini-3.6-flash-high',
      pool: currentPlan.selectedPool || 'POOL_1',
      purpose: 'hierarchical_planning',
      sourceScope: routing.scope,
      transport: decision.transportUsed || options.certificationTransport || 'LOCAL_ROUTER_PROXY'
    });

    while (attempt < JIN_OPERATING_DOCTRINE.GOVERNANCE.MAX_REPLAN_ATTEMPTS) {
      attempt++;
      const currentHistory = [];

      for (const step of currentPlan.steps) {
        const depsMet = (step.dependsOn || []).every(depId =>
          currentHistory.some(h => (h.step.id === depId || h.step.stepId === depId) && h.observation?.valid)
        );

        if (!depsMet) {
          currentHistory.push({
            step,
            stepResult: { success: false, error: 'DEPENDENCY_NOT_MET' },
            observation: { valid: false, status: 'BLOCKED_DEPENDENCY', error: 'Dependencies not satisfied' }
          });
          break;
        }

        timeline.push({
          event: 'ACTION_EXECUTED',
          stepId: step.id,
          subgoal: step.subgoal || step.action,
          tool: step.tool,
          provider: step.providerDomain || 'ANTIGRAVITY',
          timestamp: new Date().toISOString()
        });

        const stepResult = await agentExecutorInstance.executeStep(step, {
          priorHistory: currentHistory,
          sessionContext,
          options: { ...options, forceProvider: step.providerDomain },
          exploration: explorationResult
        });

        const observation = AgentObserver.observe(step, stepResult);

        if (step.tool) {
          executionToolsUsed.push(step.tool);
        }

        currentHistory.push({
          step,
          stepResult,
          observation,
          timestamp: new Date().toISOString()
        });

        // Update snapshot after each step so recovery knows how far we got
        const completedSoFar = currentHistory
          .filter(h => h.observation?.valid)
          .map(h => h.step.id || h.step.stepId);
        const remaining = allStepIds.filter(id => !completedSoFar.includes(id));
        activeMemoryCoreInstance.snapshotActiveState({
          taskId: currentPlan.goalId,
          goal: rawGoal,
          currentStep: completedSoFar.length + 1,
          activeTools: currentPlan.steps.map(s => s.tool).filter(Boolean),
          selectedPool: currentPlan.selectedPool,
          selectedModel: currentPlan.selectedEngine,
          completedSteps: completedSoFar,
          pendingSteps: remaining,
          planSteps: currentPlan.steps.map(s => ({ id: s.id || s.stepId, tool: s.tool, subgoal: s.subgoal || s.action })),
          status: remaining.length === 0 ? 'COMPLETED' : 'IN_PROGRESS'
        });

        if (!observation.valid) {
          timeline.push({
            event: 'ACTION_FAILED',
            stepId: step.id,
            error: observation.error || 'Execution validation failed',
            timestamp: new Date().toISOString()
          });
          break;
        }
      }

      fullExecutionHistory.push({ attempt, plan: currentPlan, currentHistory });

      timeline.push({ event: 'VERIFY_STARTED', provider: 'ANTIGRAVITY', timestamp: new Date().toISOString() });
      const verification = AgentVerifier.verifyGoalCompletion(currentPlan, currentHistory);
      finalVerification = verification;

      timeline.push({
        event: 'VERIFICATION_EVALUATED',
        isSatisfied: verification.isSatisfied,
        verificationStatus: verification.verificationStatus || null,
        confidence: verification.confidence,
        timestamp: new Date().toISOString()
      });
      timeline.push({ event: 'VERIFY_COMPLETED', isSatisfied: verification.isSatisfied, timestamp: new Date().toISOString() });

      if (verification.isSatisfied) {
        for (const h of currentHistory) {
          if (h.step.tool === 'web.fetch' || h.step.tool === 'web.search') {
            const res = h.stepResult?.result;
            if (res && res.text) {
              activeMemoryCoreInstance.store({
                key: `verified_${Date.now()}`,
                content: res.text.slice(0, 500),
                category: 'RESEARCH_DATA',
                priority: 'MEDIUM',
                source: { provenance: 'AUTONOMOUS_LIVE_RESEARCH', url: res.url || res.query }
              });
            }
          }
        }
        break;
      }

      if (verification.requiresReplan && attempt < JIN_OPERATING_DOCTRINE.GOVERNANCE.MAX_REPLAN_ATTEMPTS) {
        timeline.push({
          event: 'REPLAN_TRIGGERED',
          attempt,
          reason: verification.failureReason,
          timestamp: new Date().toISOString()
        });

        const replanResult = await replanEngineInstance.generateReplan({
          originalGoal: rawGoal,
          failedStep: verification.failedStep,
          observedFailure: { reason: verification.failureReason },
          executionHistory: currentHistory,
          attempt
        });

        if (replanResult && replanResult.replacementPlan) {
          currentPlan = replanResult.replacementPlan;
        }
      }
    }

    const durationMs = Date.now() - startTime;

    routingOptimizerInstance.recordTaskOutcome({
      engine: currentPlan.selectedEngine || 'gemini-3.6-flash-high',
      taskCategory: currentPlan.category,
      latencyMs: durationMs,
      success: finalVerification?.isSatisfied || false,
      verified: finalVerification?.isSatisfied || false
    });

    const responsePayload = await jinResponseEngineInstance.generateResponse({
      userUtterance: rawGoal,
      conversationContext: sessionContext,
      decision,
      executionHistory: fullExecutionHistory[0]?.currentHistory || [],
      artifact: finalVerification?.artifact,
      verification: finalVerification,
      sourceScope: routing.scope,
      providerRouting: routing,
      provenance: {
        semanticModel: currentPlan.selectedEngine || 'gemini-3.6-flash-high',
        planningEngine: 'hierarchical_dynamic_dag_planner',
        executionTools: [...new Set(executionToolsUsed)],
        pool: currentPlan.selectedPool || 'POOL_1',
        sourceScope: routing.scope,
        transport: decision.transportUsed || options.certificationTransport || 'LOCAL_ROUTER_PROXY'
      }
    }, options);

    // BUILD EVIDENCE CHAIN
    const evidenceChain = evidenceChainBuilderInstance.buildChain({
      claim: rawGoal,
      goal: rawGoal,
      scope: routing.scope,
      explorationResult,
      executionHistory: fullExecutionHistory[0]?.currentHistory || [],
      verification: finalVerification,
      decision
    });

    timeline.push({ event: 'EVIDENCE_CHAIN_BUILT', chainId: evidenceChain.chainId, findingsCount: evidenceChain.findings.length, timestamp: new Date().toISOString() });
    timeline.push({ event: 'TASK_COMPLETED', success: finalVerification?.isSatisfied || false, timestamp: new Date().toISOString() });

    const summary = {
      goal: rawGoal,
      success: finalVerification?.isSatisfied || false,
      confidence: finalVerification?.confidence || 0.95,
      actionRequired: true,
      intent: decision.intent,
      sourceScope: routing.scope,
      providerRouting: routing,
      attempts: attempt,
      responseMessage: responsePayload.naturalVoiceSpeech,
      detailedDisplay: responsePayload.detailedTextDisplay,
      claims: responsePayload.claims,
      evidenceRefs: responsePayload.evidenceRefs,
      responseSource: responsePayload.responseSource,
      artifact: finalVerification?.artifact || null,
      evidenceChain,
      provenance: {
        semanticModel: currentPlan.selectedEngine || 'gemini-3.6-flash-high',
        planningEngine: 'hierarchical_dynamic_dag_planner',
        executionTools: [...new Set(executionToolsUsed)],
        selectedPool: currentPlan.selectedPool || 'POOL_1',
        modelInvocations,
        sourceScope: routing.scope,
        transport: decision.transportUsed || options.certificationTransport || 'LOCAL_ROUTER_PROXY'
      },
      interpretationSource: decision.interpretationSource,
      transportUsed: decision.transportUsed || options.certificationTransport || 'LOCAL_ROUTER_PROXY',
      fallbackUsed: decision.fallbackUsed,
      timeline,
      durationMs,
      telemetry: {
        totalStepsExecuted: fullExecutionHistory.reduce((acc, h) => acc + h.currentHistory.length, 0),
        status: finalVerification?.isSatisfied ? 'VERIFIED_COMPLETED' : 'PARTIAL_COMPLETED'
      }
    };

    this.sessionGoalHistory.push(summary);
    return summary;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESPONSE NORMALIZATION GATE (TAHAP 3B-2C)
  // Encapsulates every user-facing text field so no role label or
  // double-punctuation artifact can escape the runtime, regardless of the
  // execution path that produced the summary.
  // ═══════════════════════════════════════════════════════════════════════════
  _normalizeSummary(summary) {
    if (!summary || typeof summary !== 'object') return summary;
    const out = { ...summary };
    if (typeof out.responseMessage === 'string') out.responseMessage = normalizeModelResponse(out.responseMessage);
    if (typeof out.detailedDisplay === 'string') out.detailedDisplay = normalizeModelResponse(out.detailedDisplay);
    if (Array.isArray(out.claims)) out.claims = out.claims.map(c => normalizeModelResponse(c));
    return out;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPLORATION TIMELINE (TAHAP 3B-2B-2)
  // Records EXPLORE_SOURCE_DISCOVERED per discovered path/source and a final
  // EXPLORE_COMPLETED snapshot onto the shared timeline.
  // ═══════════════════════════════════════════════════════════════════════════
  _pushExplorationTimeline(timeline, explorationResult) {
    if (!explorationResult || typeof explorationResult !== 'object') return;
    const now = () => new Date().toISOString();

    const discovered = [
      ...(explorationResult.discoveryPaths || []).map(p => ({
        sourceId: p.sourceId,
        provider: p.provider,
        type: p.type,
        url: p.url || null,
        title: p.title || null,
        status: p.status || 'PLANNED'
      })),
      ...(explorationResult.sources || []).slice(0, 4).map(s => ({
        sourceId: s.sourceId || s.id,
        provider: s.provider,
        type: s.type,
        url: s.url || null,
        title: s.title || s.description || null,
        status: s.status || (s.retrievedAt ? 'RETRIEVED' : s.reliability || 'PENDING')
      }))
    ];

    for (const d of discovered.slice(0, 8)) {
      timeline.push({ event: 'EXPLORE_SOURCE_DISCOVERED', ...d, timestamp: now() });
    }

    timeline.push({
      event: 'EXPLORE_COMPLETED',
      explored: Boolean(explorationResult.explored),
      sourceCount: (explorationResult.sources || []).length,
      findingCount: (explorationResult.findings || explorationResult.evidence || []).length,
      discoveryPathCount: (explorationResult.discoveryPaths || []).length,
      knowledgeGapCount: (explorationResult.knowledgeGaps || []).length,
      limitationCount: (explorationResult.limitations || []).length,
      confidence: explorationResult.confidence ?? 0,
      providerUsed: explorationResult.providerUsed || [],
      timestamp: now()
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OLLAMA DIRECT CALL HELPER
  // ═══════════════════════════════════════════════════════════════════════════
  _isEmptyResult(result) {
    try {
      const probe = result?.text ?? result?.summary ?? result?.current ?? result?.stdout ?? result?.content ?? result?.data;
      if (probe && String(probe).trim()) return false;
      const keys = Object.keys(result || {}).filter(k => !['source', 'service', 'scope', 'durationMs', 'artifactId'].includes(k));
      return keys.length === 0 || keys.every(k => result[k] == null || String(result[k]).trim() === '');
    } catch {
      return true;
    }
  }

  async _callOllamaDirect(userGoal, decision, toolResult, sessionContext) {
    const messages = [
      {
        role: 'system',
        content: `You are JIN, a local AI assistant running on Ollama. You have access to local device data. Answer based ONLY on the provided context and local data. Never fabricate internet data, prices, weather, or real-time information. If you don't have the data, say so clearly. Respond in the same language as the user.`
      },
      {
        role: 'user',
        content: userGoal
      }
    ];

    // Add tool result context if available
    if (toolResult?.result?.text) {
      messages.push({
        role: 'system',
        content: `Local data available:\n${toolResult.result.text}`
      });
    }

    try {
      const response = await ollamaProviderInstance.sendChat({
        messages,
        model: 'llama3.2:3b',
        temperature: 0.3
      });
      return normalizeModelResponse(response) || 'Maaf, saya tidak dapat memberikan jawaban saat ini.';
    } catch (err) {
      return `Error communicating with local Ollama: ${err.message}`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GOAL PERSISTENCE: Resume interrupted execution from persisted state
  // Implements TEST 11.1 — Goal Persistence & Task Resumption
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Restores a previously interrupted goal from disk and resumes execution
   * starting from the first uncompleted step. Completed steps are skipped.
   */
  async resumeGoal(taskId = null, sessionContext = {}, options = {}) {
    // Step 1: Restore state from disk
    const savedState = activeMemoryCoreInstance.restoreActiveState();
    if (!savedState) {
      return { success: false, error: 'NO_SAVED_STATE', resumeDecision: 'NOTHING_TO_RESUME' };
    }

    // Step 2: Verify taskId matches if specified
    if (taskId && savedState.taskId !== taskId) {
      return {
        success: false,
        error: 'TASK_ID_MISMATCH',
        resumeDecision: 'ABORT',
        savedTaskId: savedState.taskId,
        requestedTaskId: taskId
      };
    }

    // Step 3: If already completed, nothing to resume
    if (savedState.status === 'COMPLETED') {
      return {
        success: true,
        resumeDecision: 'ALREADY_COMPLETED',
        taskId: savedState.taskId,
        goal: savedState.goal,
        skippedSteps: savedState.completedSteps || [],
        resumedFromStepId: null
      };
    }

    // Step 4: Determine resume point
    const completedStepIds = new Set(savedState.completedSteps || []);
    const allPlanSteps = savedState.planSteps || [];
    const skippedSteps = allPlanSteps.filter(s => completedStepIds.has(s.id));
    const remainingSteps = allPlanSteps.filter(s => !completedStepIds.has(s.id));
    const resumeFromStep = remainingSteps[0] || null;

    // Step 5: Idempotency guard — if already resumed in this session, return same result
    const alreadyResumedInSession = this.sessionGoalHistory.some(h => h.goal === savedState.goal && h._resumedFrom);
    if (alreadyResumedInSession) {
      return {
        success: true,
        resumeDecision: 'IDEMPOTENT_SKIP',
        taskId: savedState.taskId,
        goal: savedState.goal,
        skippedSteps: skippedSteps.map(s => s.id),
        resumedFromStepId: resumeFromStep?.id || null
      };
    }

    const result = {
      success: true,
      resumeDecision: 'RESUMED',
      taskId: savedState.taskId,
      goal: savedState.goal,
      skippedSteps: skippedSteps.map(s => s.id),
      resumedFromStepId: resumeFromStep?.id || null,
      remainingStepIds: remainingSteps.map(s => s.id),
      restoredAt: new Date().toISOString(),
      _resumedFrom: savedState.taskId
    };

    // Record in session history for idempotency tracking
    this.sessionGoalHistory.push(result);

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFESSIONAL WORK EXECUTION PIPELINE (FASE 0 + FASE 1)
  // IntelligenceOrchestrator → WorkSession → WorkExecutor
  // ═══════════════════════════════════════════════════════════════════════════

  async _executeWork(rawGoal, decision, routing, sessionContext, options, startTime, timeline) {
    const streamCallback = options?.streamCallback || null;

    timeline.push({
      event: 'WORK_EXECUTION_STARTED',
      goal: rawGoal,
      timestamp: new Date().toISOString()
    });

    if (streamCallback) streamCallback('progress', { step: 'ORCHESTRATE', message: 'Menganalisis domain & merencanakan task...' });

    // 1. Create orchestrator (FASE 1 brain)
    const orchestrator = this._createWorkOrchestrator();

    // 2. Orchestrate: classify domain → plan tasks → route
    const orchestration = await orchestrator.orchestrate(rawGoal, {
      intent: decision.intent,
      complexity: decision.complexityLevel,
      domain: sessionContext.domain,
    });

    timeline.push({
      event: 'ORCHESTRATION_COMPLETED',
      domain: orchestration.domain,
      taskCount: orchestration.tasks.length,
      routing: orchestration.routing,
      timestamp: new Date().toISOString()
    });

    if (streamCallback) streamCallback('progress', { step: 'PLAN', message: `Domain: ${orchestration.domain} | ${orchestration.tasks.length} tasks direncanakan`, domain: orchestration.domain, taskCount: orchestration.tasks.length });

    // 3. Create WorkSession + Executor (FASE 0 core)
    const session = WorkSession.create(orchestration);
    const artifactStream = new ArtifactStream(session.id);
    const canvas = new ConversationCanvas(session.id, { streamingDelay: 30, charSpeed: 3 });

    // 4. Subscribe to canvas streaming events
    if (streamCallback) {
      canvas.on('artifact_flying', (event, artifact) => {
        streamCallback('artifact_flying', {
          taskId: artifact.taskId,
          domain: artifact.domain,
          type: artifact.type,
          order: artifact.order,
        });
      });

      canvas.on('artifact_streaming', (event, artifact) => {
        streamCallback('artifact_streaming', {
          taskId: artifact.taskId,
          domain: artifact.domain,
          type: artifact.type,
          order: artifact.order,
          progress: artifact.progress,
          partialContent: artifact.partialContent,
        });
      });

      canvas.on('artifact_landed', (event, artifact) => {
        streamCallback('artifact_landed', {
          taskId: artifact.taskId,
          domain: artifact.domain,
          type: artifact.type,
          order: artifact.order,
          contentLength: artifact.content?.length || 0,
        });
      });
    }

    const executor = new WorkExecutor(session, { artifactStream, canvas });

    // 5. Register domain services from orchestrator's router
    this._registerWorkDomains(executor, orchestrator.domainRouter);

    // 6. Execute with streaming
    if (streamCallback) streamCallback('progress', { step: 'EXECUTE', message: 'Memulai eksekusi task...' });

    const result = await executor.execute();

    timeline.push({
      event: 'WORK_EXECUTION_COMPLETED',
      sessionId: session.id,
      status: result.status,
      totalTasks: result.totalTasks,
      completedTasks: result.completedTasks,
      timestamp: new Date().toISOString()
    });

    return {
      goal: rawGoal,
      success: result.status === 'COMPLETED',
      actionRequired: true,
      intent: decision.intent,
      workflowType: 'PROFESSIONAL_WORK',
      workResult: result,
      sessionId: session.id,
      artifacts: artifactStream.getAll(),
      canvas: canvas.getAll(),
      responseMessage: this._buildWorkResponse(result),
      detailedDisplay: this._buildWorkDisplay(result),
      timeline,
      durationMs: Date.now() - startTime
    };
  }

  /**
   * Create work orchestrator with LLM client and domain services
   */
  _createWorkOrchestrator() {
    const llmClient = ollamaProviderInstance;
    const taskPlanner = new TaskPlanner({ llmClient, model: 'qwen3:8b' });
    const domainRouter = new DomainRouter();

    // Register FASE 2 domain services
    const researchService = new ResearchService({
      tavilyApiKey: process.env.TAVILY_API_KEY,
      llmClient,
      llmModel: 'qwen3:8b',
    });
    domainRouter.register('RESEARCH', researchService);

    const documentService = new DocumentService({
      llmClient,
      llmModel: 'qwen3:8b',
    });
    domainRouter.register('DOCUMENT', documentService);

    const contentService = new ContentService({
      llmClient,
      llmModel: 'qwen3:8b',
    });
    domainRouter.register('CONTENT', contentService);

    const pptService = new PPTService({
      llmClient,
      llmModel: 'qwen3:8b',
    });
    domainRouter.register('CREATIVE', pptService);

    const dataService = new DataService({
      llmClient,
      llmModel: 'qwen3:8b',
    });
    domainRouter.register('DATA', dataService);

    const automationService = new AutomationService({
      llmClient,
      llmModel: 'qwen3:8b',
    });
    domainRouter.register('AUTOMATION', automationService);

    const voiceService = new VoiceService({
      llmClient,
      llmModel: 'qwen3:8b',
    });
    domainRouter.register('VOICE', voiceService);

    return new IntelligenceOrchestrator({ domainRouter, taskPlanner, llmClient });
  }

  /**
   * Register domain services on executor from domain router
   */
  _registerWorkDomains(executor, domainRouter) {
    // Generic fallback for domains without real implementations
    const genericService = {
      generate: async (task, context) => ({
        type: 'TEXT',
        content: `[${task.type}] ${task.description}`,
        metadata: { taskId: task.id, domain: context.session.domain },
      }),
      verify: async (artifact) => ({ valid: true }),
      display: async (artifact, context) => {},
      commit: async (artifact, context) => {},
    };

    // Register real services from domain router
    const registered = domainRouter.getRegisteredDomains();
    for (const domain of registered) {
      const service = domainRouter.getDomain(domain);
      executor.registerDomain(domain, service);
    }

    // Register generic fallback for unregistered domains
    const allDomains = ['GENERAL', 'DOCUMENT', 'CONTENT', 'DATA', 'CREATIVE', 'DESIGN', 'AUTOMATION'];
    for (const domain of allDomains) {
      if (!executor.domainServices.has(domain)) {
        executor.registerDomain(domain, genericService);
      }
    }
  }

  /**
   * Build response message from work result
   */
  _buildWorkResponse(result) {
    if (result.status === 'COMPLETED') {
      return `Work completed: ${result.completedTasks}/${result.totalTasks} tasks finished successfully.`;
    }
    if (result.status === 'FAILED') {
      return `Work failed: ${result.failedTasks}/${result.totalTasks} tasks failed.`;
    }
    return `Work ${result.status}: ${result.completedTasks}/${result.totalTasks} tasks done.`;
  }

  /**
   * Build detailed display from work result
   */
  _buildWorkDisplay(result) {
    const lines = [
      `═══ WORK RESULT ═══`,
      `Status: ${result.status}`,
      `Tasks: ${result.completedTasks}/${result.totalTasks} completed`,
      `Duration: ${result.durationMs}ms`,
    ];

    for (const task of result.tasks) {
      const icon = task.status === 'COMMITTED' ? '✓' : task.status === 'FAILED_TERMINAL' ? '✗' : '○';
      lines.push(`  ${icon} ${task.id}: ${task.type} [${task.status}]`);
    }

    return lines.join('\n');
  }
}

export const agentRuntimeInstance = new AgentRuntime();
export default agentRuntimeInstance;
