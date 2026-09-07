/**
 * ExploreAgent.mjs
 * TAHAP 3B-2B-2: Formal EXPLORE Agent as first-class pipeline stage.
 *
 * Positioned between PLAN and BUILD in the agent pipeline:
 *   GENERAL → PLAN → EXPLORE → BUILD → VERIFY → JIN RESPONSE
 *
 * EXPLORE gathers evidence from INTERNAL (Ollama / Active Memory) and
 * EXTERNAL (Antigravity) sources BEFORE execution. It never fabricates
 * internet evidence: external web research is declared as discovery paths
 * (PLANNED) at EXPLORE time and only becomes real REVERSED/retrieved sources
 * once BUILD actually fetches them.
 *
 * Canonical Output Contract:
 * {
 *   explored: true,
 *   scope,
 *   exploredAt,
 *   discoveryPaths: [{ sourceId, type, provider, url, title, status, retrievedAt, sourceStepId }],
 *   sources: [{ sourceId, type, provider, url, title, retrievedAt, reliability }],
 *   findings: [{ findingId, claim, evidenceRefs, confidence, method, provider, type }],
 *   knowledgeGaps: [{ gap, reason, severity }],
 *   limitations: [string],
 *   alternativeViews: [{ provider, view, severity }],
 *   providerUsed: [],
 *   confidence,
 *   // legacy compatibility fields (derived views) kept for existing consumers:
 *   evidence: [], unresolvedQuestions: [], contradictions: [], freshness: {}
 * }
 */

import { SCOPE, PROVIDER } from '../routing/ProviderIntelligenceRouter.mjs';
import { ollamaProviderInstance } from '../providers/OllamaProvider.mjs';
import { activeMemoryCoreInstance } from '../memory/ActiveMemoryCore.mjs';
import { KnowledgeGapDetector } from './KnowledgeGapDetector.mjs';
import { normalizeModelResponse } from './ResponseNormalizer.mjs';

const STRUCTURED_LOCAL_TOOLS = ['device.inspect', 'sandbox.execute', 'doc.analyze', 'formal.solve', 'memory.vault'];
const EXTERNAL_UNVERIFIED_MESSAGE = 'External verification unavailable.';

export class ExploreAgent {
  constructor() {
    this.stats = { totalExplores: 0, internalExplores: 0, externalExplores: 0, hybridExplores: 0 };
  }

  /**
   * Main exploration entry point (formal EXPLORE stage).
   * @param {Object} plan - Execution plan from AgentPlanner (or minimal LOCAL_ONLY plan)
   * @param {Object} decision - Semantic decision with sourceScope
   * @param {Object} sessionContext - Conversation context
   * @returns {Promise<Object>} ExplorationResult (canonical contract + legacy views)
   */
  async explore(plan, decision, sessionContext = {}) {
    const ctx = sessionContext || {};
    const scope = (decision && decision.sourceScope) || (plan && plan.sourceScope) || SCOPE.LOCAL_ONLY;
    const goal = (plan && plan.goal) || '';
    const skipLiveProbe = Boolean(ctx.skipLiveProbe);
    const explorationMode = ctx.explorationMode || 'STANDARD';

    const evidence = [];
    const sources = [];
    const providerUsed = [];
    const exploreOptions = { skipLiveProbe, explorationMode };
    let confidence = 0;
    let externalActivity = false;
    let externalAvailability = false;

    this.stats.totalExplores++;
    if (scope === SCOPE.LOCAL_ONLY) this.stats.internalExplores++;
    else if (scope === SCOPE.EXTERNAL_REQUIRED) this.stats.externalExplores++;
    else this.stats.hybridExplores++;

    // 1. INTERNAL EXPLORE — local context (Ollama LLM analysis or deterministic light mode)
    if (scope === SCOPE.LOCAL_ONLY || scope === SCOPE.HYBRID) {
      const internalResult = await this._exploreInternal(goal, plan, exploreOptions);
      evidence.push(...internalResult.evidence);
      sources.push(...internalResult.sources);
      if (internalResult.providerUsed) providerUsed.push(internalResult.providerUsed);
      confidence = Math.max(confidence, internalResult.confidence);
    }

    // 2. EXTERNAL EXPLORE — plan internet evidence collection (Antigravity). Never fabricated.
    if (scope === SCOPE.EXTERNAL_REQUIRED || scope === SCOPE.HYBRID) {
      externalActivity = true;
      const externalResult = await this._exploreExternal(goal, plan, exploreOptions);
      externalAvailability = externalResult.availability;
      evidence.push(...externalResult.evidence);
      sources.push(...externalResult.sources);
      if (externalResult.providerUsed) providerUsed.push(externalResult.providerUsed);
      confidence = Math.max(confidence, externalResult.confidence);
    }

    // 3. Check Active Memory for cached evidence (skip if internal already recalled it)
    if (!evidence.some(e => e.type === 'CACHED_EVIDENCE')) {
      const memoryEvidence = this._checkMemory(goal, ctx);
      evidence.push(...memoryEvidence.evidence);
      sources.push(...memoryEvidence.sources);
    }

    // 4. Detect contradictions
    const contradictions = this._detectContradictions(evidence);

    // 5. Identify unresolved questions
    const unresolvedQuestions = this._identifyUnresolvedQuestions(goal, evidence, scope);

    // 6. Assess freshness
    const freshness = this._assessFreshness(evidence, scope);

    // 7. Calculate final confidence
    const finalConfidence = this._calculateConfidence(evidence, sources, contradictions, scope);

    // ── Canonical contract derivation ──────────────────────────────────────
    const discoveryPaths = this._buildDiscoveryPaths(plan, { skipLiveProbe, externalAvailability });
    this._enrichSources(sources);
    const findings = this._deriveFindings(evidence);
    const knowledgeGaps = this._deriveKnowledgeGaps(unresolvedQuestions, externalActivity, externalAvailability, scope);
    const limitations = this._deriveLimitations(evidence, sources, externalActivity, externalAvailability, scope);
    const alternativeViews = this._deriveAlternativeViews(contradictions, evidence);

    return {
      // Canonical contract
      explored: true,
      scope,
      exploredAt: new Date().toISOString(),
      discoveryPaths,
      sources,
      findings,
      knowledgeGaps,
      limitations,
      alternativeViews,
      providerUsed,
      confidence: finalConfidence,
      freshness,
      // Legacy compatibility views
      evidence,
      unresolvedQuestions,
      contradictions
    };
  }

  /**
   * INTERNAL EXPLORE: Gather local context.
   * Deterministic (memory recall / gap analysis) when in LIGHT mode, when a
   * structured local tool exists, or when live probing is skipped. Otherwise
   * uses Ollama LLM analysis for richer HYBRID context.
   */
  async _exploreInternal(goal, plan, options = {}) {
    const evidence = [];
    const sources = [];
    let confidence = 0;

    const structuredTool = (plan && plan.steps || []).map(s => s.tool)
      .find(t => STRUCTURED_LOCAL_TOOLS.includes(t));
    const useLightInference = options.skipLiveProbe || options.explorationMode === 'LIGHT' || Boolean(structuredTool);

    if (useLightInference) {
      // Deterministic local exploration — no network, no LLM latency
      const gap = KnowledgeGapDetector.analyzeGap(goal || '', {});
      const memories = Array.isArray(gap.relevantMemoryFound) ? gap.relevantMemoryFound : [];
      for (const mem of memories.slice(0, 5)) {
        evidence.push({
          id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: 'CACHED_EVIDENCE',
          description: (mem.content || mem.text || 'Cached local finding').slice(0, 300),
          source: 'DRIVE_F_ACTIVE_MEMORY',
          provider: 'LOCAL_MEMORY',
          confidence: mem.confidence || 0.7,
          category: mem.category || 'LOCAL_DATA',
          collectedAt: mem.storedAt || new Date().toISOString()
        });
      }
      if (memories.length > 0) {
        sources.push({
          id: `src_mem_${Date.now()}`,
          sourceId: `src_mem_${Date.now()}`,
          type: 'LOCAL_MEMORY',
          provider: 'LOCAL_MEMORY',
          description: `Found ${memories.length} cached local item(s) in Active Memory`,
          title: `Active Memory recall (${memories.length})`,
          url: null,
          retrievedAt: new Date().toISOString(),
          reliability: 'MEDIUM',
          timestamp: new Date().toISOString()
        });
      }
      if (evidence.length === 0 && !structuredTool) {
        evidence.push({
          id: `int_light_${Date.now()}`,
          type: 'LOCAL_ANALYSIS',
          description: `Local reasoning base ready for: ${goal || 'local task'}`,
          source: 'LOCAL_REASONING',
          provider: PROVIDER.OLLAMA,
          confidence: 0.6,
          collectedAt: new Date().toISOString()
        });
      }
      confidence = evidence.length > 0 ? 0.6 : 0;
      return { evidence, sources, providerUsed: PROVIDER.OLLAMA, confidence };
    }

    // Full Ollama LLM analysis (HYBRID deep context / non-structured local tasks)
    try {
      const messages = [
        {
          role: 'system',
          content: `You are an internal intelligence analyst. Analyze the following goal and identify what local data, files, system information, or device context would be needed to answer it. Return a JSON array of evidence items with fields: type, description, source. Only return LOCAL data sources, never internet.`
        },
        { role: 'user', content: `Goal: ${goal}\n\nAvailable tools: ${plan?.steps?.map(s => s.tool).join(', ') || 'none'}` }
      ];

      const response = await ollamaProviderInstance.sendChat({
        messages,
        model: 'llama3.2:3b',
        temperature: 0.2
      });

      if (response) {
        const analysis = this._parseOllamaResponse(response);
        if (analysis.length > 0) {
          evidence.push(...analysis.map(item => ({
            id: `int_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: item.type || 'LOCAL_ANALYSIS',
            description: item.description || item,
            source: item.source || 'OLLAMA_LOCAL_REASONING',
            provider: PROVIDER.OLLAMA,
            confidence: 0.8,
            collectedAt: new Date().toISOString()
          })));

          sources.push({
            id: `src_int_${Date.now()}`,
            sourceId: `src_int_${Date.now()}`,
            type: 'LOCAL_OLLAMA',
            provider: PROVIDER.OLLAMA,
            description: 'Internal Ollama analysis',
            title: 'Ollama local analysis',
            url: null,
            retrievedAt: new Date().toISOString(),
            reliability: 'HIGH',
            timestamp: new Date().toISOString()
          });

          confidence = 0.8;
        }
      }
    } catch (err) {
      evidence.push({
        id: `int_fallback_${Date.now()}`,
        type: 'INTERNAL_UNAVAILABLE',
        description: `Ollama internal exploration failed: ${err.message}`,
        source: 'OLLAMA_ERROR',
        provider: PROVIDER.OLLAMA,
        confidence: 0,
        collectedAt: new Date().toISOString()
      });
    }

    return { evidence, sources, providerUsed: PROVIDER.OLLAMA, confidence };
  }

  /**
   * EXTERNAL EXPLORE: Plan & gate internet evidence collection via Antigravity.
   * Antigravity availability is probed (unless live probing is skipped).
   * When unavailable, NO internet source is claimed and the limitation is
   * recorded — Ollama/locals never fabricate live external data.
   */
  async _exploreExternal(goal, plan, options = {}) {
    const evidence = [];
    const sources = [];
    let confidence = 0;

    let availability = false;
    if (!options.skipLiveProbe) {
      availability = await this._probeAntigravityAvailability();
    }
    const externalUnavailable = options.skipLiveProbe || !availability;

    const webSteps = (plan && plan.steps || []).filter(s =>
      s.tool === 'web.search' || s.tool === 'web.fetch'
    );

    if (webSteps.length > 0) {
      evidence.push({
        id: `ext_plan_${Date.now()}`,
        type: 'EXTERNAL_PLANNED',
        description: `Planned: ${webSteps.length} web evidence collection step(s) for: ${goal}`,
        source: 'AGENT_PLANNER',
        provider: PROVIDER.ANTIGRAVITY,
        confidence: 0.7,
        plannedSteps: webSteps.map(s => ({ id: s.id, tool: s.tool, action: s.action })),
        collectedAt: new Date().toISOString()
      });

      sources.push({
        id: `src_ext_${Date.now()}`,
        sourceId: `src_ext_${Date.now()}`,
        type: 'EXTERNAL_PLANNED',
        provider: PROVIDER.ANTIGRAVITY,
        description: `Web evidence collection planned: ${webSteps.length} step(s)`,
        title: null,
        url: null,
        retrievedAt: null,
        reliability: 'PENDING',
        timestamp: new Date().toISOString()
      });

      if (externalUnavailable) {
        evidence.push({
          id: `ext_unavailable_${Date.now()}`,
          type: 'EXTERNAL_UNAVAILABLE',
          description: `${EXTERNAL_UNVERIFIED_MESSAGE} No internet source is claimed during EXPLORE.`,
          source: 'ANTIGRAVITY_UNAVAILABLE',
          provider: PROVIDER.ANTIGRAVITY,
          confidence: 0,
          collectedAt: new Date().toISOString()
        });
      } else {
        evidence.push({
          id: `ext_ready_${Date.now()}`,
          type: 'EXTERNAL_GATEWAY_READY',
          description: 'Antigravity gateway confirmed available. Proses BUILD akan mengambil bukti internet yang sesungguhnya.',
          source: 'ANTIGRAVITY_PROBE',
          provider: PROVIDER.ANTIGRAVITY,
          confidence: 0.9,
          collectedAt: new Date().toISOString()
        });
      }

      confidence = externalUnavailable ? 0.3 : 0.7;
    } else {
      evidence.push({
        id: `ext_needs_${Date.now()}`,
        type: 'EXTERNAL_NEEDED',
        description: `External evidence may be needed for: ${goal} but no web collection steps planned`,
        source: 'EXPLORE_AGENT',
        provider: PROVIDER.ANTIGRAVITY,
        confidence: 0.3,
        collectedAt: new Date().toISOString()
      });
      confidence = 0.3;
    }

    return {
      evidence,
      sources,
      providerUsed: PROVIDER.ANTIGRAVITY,
      confidence,
      availability,
      limitation: externalUnavailable ? EXTERNAL_UNVERIFIED_MESSAGE : null
    };
  }

  /**
   * Probe whether the local router / health gateway is reachable.
   * Returns false on any failure (treated as verification-unavailable).
   */
  async _probeAntigravityAvailability() {
    try {
      const res = await fetch('http://127.0.0.1:20200/health', {
        signal: AbortSignal.timeout(1200)
      });
      if (!res.ok) return false;
      const data = await res.json();
      return data?.status === 'HEALTHY' || data?.ok === true || data?.gateway === 'ONLINE';
    } catch (err) {
      return false;
    }
  }

  /**
   * Build the discovery-path map for planned web research (GOOGLE-style
   * specialized search / direct URL inspection). These are PLANNED paths —
   * never claimed as retrieved at EXPLORE time.
   */
  _buildDiscoveryPaths(plan, { skipLiveProbe = false, externalAvailability = false }) {
    const paths = [];
    const webSteps = (plan && plan.steps || []).filter(s =>
      s.tool === 'web.search' || s.tool === 'web.fetch'
    );

    for (const step of webSteps) {
      const query = step.params?.query || step.query || step.subgoal || step.action;
      const url = step.params?.url || step.url || step.targetUrl || null;
      paths.push({
        sourceId: `dsrc_${step.id || `step_${Date.now()}`}`,
        type: step.tool === 'web.search' ? 'SPECIALIZED_WEB_SEARCH' : 'DIRECT_URL_INSPECTION',
        provider: PROVIDER.ANTIGRAVITY,
        url: url || null,
        title: query ? `Web research: ${query}` : (step.subgoal || step.action || step.tool),
        status: (skipLiveProbe || !externalAvailability) ? 'PENDING_LIVE_UNAVAILABLE' : 'PLANNED',
        retrievedAt: null,
        sourceStepId: step.id
      });
    }

    return paths;
  }

  /**
   * Enrich every source with the canonical contract fields while keeping the
   * legacy shape (id/description/timestamp) intact for existing consumers.
   */
  _enrichSources(sources) {
    for (const s of sources) {
      s.sourceId = s.sourceId || s.id;
      s.url = s.url || null;
      s.title = s.title || s.description || null;
      s.retrievedAt = (s.retrievedAt !== undefined) ? s.retrievedAt : (s.timestamp || null);
      s.reliability = s.reliability || this._assessReliability(s);
    }
  }

  /**
   * Derive canonical findings from the collected (legacy) evidence items.
   */
  _deriveFindings(evidence) {
    return (evidence || []).map(ev => ({
      findingId: ev.id,
      claim: String(ev.description || '').slice(0, 400),
      evidenceRefs: [ev.id],
      confidence: ev.confidence || 0,
      method: this._inferMethod(ev),
      provider: ev.provider,
      type: ev.type
    }));
  }

  /**
   * Derive knowledge gaps from unresolved questions + any unverifiable
   * external requirement.
   */
  _deriveKnowledgeGaps(unresolvedQuestions, externalActivity, externalAvailability, scope) {
    const gaps = (unresolvedQuestions || []).map(u => ({
      gap: u.question,
      reason: u.reason,
      severity: u.severity
    }));

    if (externalActivity && (scope === SCOPE.EXTERNAL_REQUIRED || scope === SCOPE.HYBRID) && !externalAvailability) {
      gaps.unshift({
        gap: EXTERNAL_UNVERIFIED_MESSAGE,
        reason: 'ANTIGRAVITY_UNAVAILABLE',
        severity: 'HIGH'
      });
    }

    return gaps;
  }

  /**
   * Derive human-readable limitations, including the no-fabrication guard.
   */
  _deriveLimitations(evidence, sources, externalActivity, externalAvailability, scope) {
    const limitations = [];

    if (evidence.length === 0) {
      limitations.push('Tidak ada bukti yang dikumpulkan pada tahap EXPLORE.');
    }

    if (externalActivity && (scope === SCOPE.EXTERNAL_REQUIRED || scope === SCOPE.HYBRID) && !externalAvailability) {
      limitations.push(`${EXTERNAL_UNVERIFIED_MESSAGE} Tidak ada sumber internet yang diklaim tanpa verifikasi.`);
    }

    const lowConf = (evidence || []).filter(e => (e.confidence || 0) < 0.5);
    if (lowConf.length > 0 && lowConf.every(e => e.type !== 'EXTERNAL_PLANNED')) {
      limitations.push(`${lowConf.length} bukti memiliki confidence rendah (< 50%).`);
    }

    const realSources = (sources || []).filter(s => s.provider !== PROVIDER.ANTIGRAVITY || s.retrievedAt);
    if (realSources.length <= 1 && evidence.length > 0) {
      limitations.push('Hanya satu sumber data terverifikasi pada EXPLORE. Validasi lintas sumber dilakukan pada BUILD.');
    }

    return limitations;
  }

  /**
   * Derive alternative views from contradictions + low-confidence evidence.
   */
  _deriveAlternativeViews(contradictions, evidence) {
    const views = (contradictions || []).map(c => ({
      provider: 'CONTRADICTION',
      view: c.description,
      severity: c.severity,
      evidenceA: c.evidenceA,
      evidenceB: c.evidenceB
    }));

    const lowConf = (evidence || []).filter(e => (e.confidence || 0) < 0.5);
    if (lowConf.length > 0) {
      views.push({
        provider: 'UNCERTAIN',
        view: `${lowConf.length} bukti memiliki confidence rendah dan memerlukan konfirmasi tambahan.`,
        severity: 'MEDIUM'
      });
    }

    return views;
  }

  /**
   * Check Drive F Active Memory for cached evidence
   */
  _checkMemory(goal, sessionContext) {
    const evidence = [];
    const sources = [];

    try {
      const memories = activeMemoryCoreInstance.query({
        queryText: goal,
        limit: 5,
        minConfidence: 0.6
      });

      if (memories && memories.length > 0) {
        for (const mem of memories) {
          evidence.push({
            id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: 'CACHED_EVIDENCE',
            description: (mem.content || mem.text || 'Cached research finding').slice(0, 300),
            source: 'DRIVE_F_ACTIVE_MEMORY',
            provider: 'LOCAL_MEMORY',
            confidence: mem.confidence || 0.7,
            category: mem.category || 'RESEARCH_DATA',
            collectedAt: mem.storedAt || new Date().toISOString()
          });
        }

        sources.push({
          id: `src_mem_${Date.now()}`,
          sourceId: `src_mem_${Date.now()}`,
          type: 'LOCAL_MEMORY',
          provider: 'LOCAL_MEMORY',
          description: `Found ${memories.length} cached evidence item(s) in Drive F`,
          title: `Active Memory recall (${memories.length})`,
          url: null,
          retrievedAt: new Date().toISOString(),
          reliability: 'MEDIUM',
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      // Memory query failed — continue without cached evidence
    }

    return { evidence, sources };
  }

  /**
   * Detect contradictions between evidence items
   */
  _detectContradictions(evidence) {
    const contradictions = [];

    for (let i = 0; i < evidence.length; i++) {
      for (let j = i + 1; j < evidence.length; j++) {
        const a = evidence[i];
        const b = evidence[j];

        if (a.provider !== b.provider && a.type !== 'EXTERNAL_PLANNED' && b.type !== 'EXTERNAL_PLANNED') {
          if (a.description && b.description) {
            const aWords = new Set(a.description.toLowerCase().split(/\s+/));
            const bWords = new Set(b.description.toLowerCase().split(/\s+/));
            const overlap = [...aWords].filter(w => bWords.has(w) && w.length > 3);

            if (overlap.length > 3) {
              contradictions.push({
                id: `contradiction_${Date.now()}_${i}_${j}`,
                evidenceA: a.id,
                evidenceB: b.id,
                description: `Potential contradiction between ${a.provider} and ${b.provider} evidence on overlapping topic`,
                overlapWords: overlap.slice(0, 5),
                severity: 'REVIEW_NEEDED',
                detectedAt: new Date().toISOString()
              });
            }
          }
        }
      }
    }

    return contradictions;
  }

  /**
   * Identify what questions remain unresolved after exploration
   */
  _identifyUnresolvedQuestions(goal, evidence, scope) {
    const unresolved = [];

    if (evidence.length === 0) {
      unresolved.push({
        question: `No evidence found for: ${goal}`,
        reason: 'NO_EVIDENCE_COLLECTED',
        severity: 'HIGH'
      });
    }

    if (scope === SCOPE.EXTERNAL_REQUIRED || scope === SCOPE.HYBRID) {
      const hasExternalEvidence = evidence.some(e => e.provider === PROVIDER.ANTIGRAVITY);
      if (!hasExternalEvidence) {
        unresolved.push({
          question: 'External/internet evidence required but not yet collected',
          reason: 'NO_EXTERNAL_EVIDENCE',
          severity: 'HIGH'
        });
      }
    }

    const lowConfidence = evidence.filter(e => e.confidence < 0.5);
    if (lowConfidence.length > 0) {
      unresolved.push({
        question: `${lowConfidence.length} evidence item(s) have low confidence (< 50%)`,
        reason: 'LOW_CONFIDENCE_EVIDENCE',
        severity: 'MEDIUM'
      });
    }

    return unresolved;
  }

  /**
   * Assess freshness of collected evidence
   */
  _assessFreshness(evidence, scope) {
    const now = Date.now();
    let newestTimestamp = 0;
    let oldestTimestamp = now;
    let freshCount = 0;
    let staleCount = 0;

    for (const e of evidence) {
      const ts = new Date(e.collectedAt).getTime();
      if (ts > newestTimestamp) newestTimestamp = ts;
      if (ts < oldestTimestamp) oldestTimestamp = ts;

      const ageHours = (now - ts) / (1000 * 60 * 60);
      if (ageHours < 1) freshCount++;
      else if (ageHours > 24) staleCount++;
    }

    return {
      scope,
      totalItems: evidence.length,
      freshItems: freshCount,
      staleItems: staleCount,
      ageRange: evidence.length > 0
        ? `${Math.round((now - oldestTimestamp) / (1000 * 60 * 60))}h - ${Math.round((now - newestTimestamp) / (1000 * 60 * 60))}h`
        : 'N/A',
      assessedAt: new Date().toISOString()
    };
  }

  /**
   * Calculate final exploration confidence
   */
  _calculateConfidence(evidence, sources, contradictions, scope) {
    if (evidence.length === 0) return 0;

    const avgConfidence = evidence.reduce((sum, e) => sum + (e.confidence || 0), 0) / evidence.length;
    const contradictionPenalty = contradictions.length * 0.1;
    const sourceBonus = Math.min(sources.length * 0.05, 0.15);
    const scopeBonus = scope === SCOPE.LOCAL_ONLY ? 0.1 : 0;

    return Math.min(0.99, Math.max(0.1, avgConfidence - contradictionPenalty + sourceBonus + scopeBonus));
  }

  /**
   * Infer evidence-collection method for a canonical finding.
   */
  _inferMethod(ev) {
    if (ev.type === 'LOCAL_ANALYSIS' || ev.type === 'CACHED_EVIDENCE') return 'MODEL_INFERENCE';
    if (ev.type === 'EXTERNAL_PLANNED' || ev.type === 'EXTERNAL_NEEDED' || ev.type === 'EXTERNAL_UNAVAILABLE' || ev.type === 'EXTERNAL_GATEWAY_READY') return 'WEB_RESEARCH';
    if (ev.type === 'TOOL_RESULT') return 'DIRECT_INSPECTION';
    return 'MODEL_INFERENCE';
  }

  _assessReliability(src) {
    if (src.type === 'LOCAL_OLLAMA') return 'HIGH';
    if (src.type === 'EXTERNAL_PLANNED') return 'PENDING';
    if (src.type === 'LOCAL_MEMORY') return 'MEDIUM';
    return 'MEDIUM';
  }

  /**
   * Parse Ollama response into structured evidence items
   */
  _parseOllamaResponse(response) {
    if (!response || typeof response !== 'string') return [];

    const items = [];

    const lines = response.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const cleaned = normalizeModelResponse(line.replace(/^[\d\-\*\•]+\s*/, '').trim());
      if (cleaned.length > 10) {
        items.push({
          type: 'LOCAL_ANALYSIS',
          description: cleaned.slice(0, 300),
          source: 'OLLAMA_LOCAL_REASONING'
        });
      }
    }

    if (items.length === 0 && response.length > 10) {
      items.push({
        type: 'LOCAL_ANALYSIS',
        description: normalizeModelResponse(response).slice(0, 500),
        source: 'OLLAMA_LOCAL_REASONING'
      });
    }

    return items.slice(0, 10);
  }

  getStats() {
    return { ...this.stats };
  }
}

export const exploreAgentInstance = new ExploreAgent();
export default exploreAgentInstance;