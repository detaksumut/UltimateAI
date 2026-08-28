/**
 * KnowledgeGapDetector.mjs
 * Pillar 2: Real-Time Intelligence & Autonomous Knowledge Gap Detection.
 * 
 * Flow:
 *  USER GOAL ➔ Check Active Memory (Drive F) ➔ Identify Knowledge Gaps ➔ Formulate Research Strategy
 *  ➔ Execute web.fetch / web.search ➔ Evidence Verification ➔ Pipe Verified Findings into Active Memory Core.
 */

import { activeMemoryCoreInstance } from '../memory/ActiveMemoryCore.mjs';

export class KnowledgeGapDetector {
  /**
   * Compares user goal against Drive F Active Memory to identify knowledge gaps
   * @param {string} goal - User raw or semantic goal
   * @param {Object} context - Conversational context & entities
   * @returns {Object} gapAnalysis - { hasGap, gapDescription, strategy, relevantMemoryFound, recommendedTools }
   */
  static analyzeGap(goal = '', context = {}) {
    const raw = goal.trim();
    if (!raw) {
      return { hasGap: false, gapDescription: 'Empty goal', strategy: 'NONE', recommendedTools: [] };
    }

    // 1. Search Active Memory on Drive F:
    const memoryResults = activeMemoryCoreInstance.query({
      queryText: raw,
      limit: 3,
      minConfidence: 0.7
    });

    const isExplicitUrl = /https?:\/\/[^\s]+/i.test(raw);
    const requiresFreshness = /terbaru|hari ini|saat ini|terkini|berita|current|realtime|update|live/i.test(raw);
    const requiresComputation = /hitung|kalkulasi|rata-rata|persentase|growth|transform|eksekusi/i.test(raw);

    // If explicit URL provided ➔ Live URL Fetch strategy
    if (isExplicitUrl) {
      const url = raw.match(/https?:\/\/[^\s]+/i)[0];
      return {
        hasGap: true,
        gapDescription: `External live URL inspection required: ${url}`,
        strategy: 'DIRECT_URL_INSPECTION',
        targetUrl: url,
        relevantMemoryFound: memoryResults,
        recommendedTools: ['web.fetch']
      };
    }

    // If fresh external events requested or no relevant memory found
    if (requiresFreshness || memoryResults.length === 0) {
      return {
        hasGap: true,
        gapDescription: requiresFreshness
          ? 'Goal explicitly requires real-time/fresh external telemetry not present in memory'
          : 'No sufficient verified factual knowledge found in Drive F Active Memory',
        strategy: 'LIVE_WEB_RESEARCH',
        relevantMemoryFound: memoryResults,
        recommendedTools: ['web.search']
      };
    }

    // Knowledge is already present in Drive F Active Memory
    return {
      hasGap: false,
      gapDescription: 'Sufficient grounded facts retrieved from Drive F Active Memory',
      strategy: 'LOCAL_ACTIVE_MEMORY_RECALL',
      relevantMemoryFound: memoryResults,
      recommendedTools: []
    };
  }

  /**
   * Ingests verified research finding into Drive F Active Memory Core with full provenance
   */
  static ingestVerifiedFinding({
    key,
    findingText,
    sourceUrl = null,
    sourceTool = 'web.search',
    confidence = 0.95,
    category = 'RESEARCH_DATA',
    priority = 'MEDIUM'
  }) {
    if (!findingText || !findingText.trim()) return null;

    const source = {
      provenance: 'LIVE_INTELLIGENCE_RESEARCH',
      sourceTool,
      sourceUrl,
      ingestedAt: new Date().toISOString()
    };

    return activeMemoryCoreInstance.store({
      key: key || 'research_finding',
      content: findingText.trim(),
      category,
      priority,
      source,
      confidence
    });
  }
}

export default KnowledgeGapDetector;
