/**
 * EvidenceChain.mjs
 * TAHAP 3B-5: Structured Evidence & Claim Chain for UltimateAI.
 *
 * Every audit result must have a traceable chain:
 *   CLAIM → EVIDENCE → SOURCE → VERIFICATION → COMPARISON → EXPLANATION → CONCLUSION
 *
 * This module provides:
 *  - EvidenceChainBuilder: constructs chains from exploration + execution results
 *  - EvidenceChainValidator: validates chain completeness
 *  - Structured output for nested clarification modals
 */

import { SCOPE } from '../routing/ProviderIntelligenceRouter.mjs';
import normalizeModelResponse from './ResponseNormalizer.mjs';

export const VERIFICATION_STATUS = {
  VERIFIED: 'VERIFIED',
  PARTIALLY_VERIFIED: 'PARTIALLY_VERIFIED',
  UNVERIFIED: 'UNVERIFIED',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
  FAILED: 'FAILED',
  DISPUTED: 'DISPUTED',
  UNKNOWN: 'UNKNOWN'
};

export const SOURCE_TYPE = {
  LOCAL_FILE: 'LOCAL_FILE',
  SYSTEM_RUNTIME: 'SYSTEM_RUNTIME',
  INTERNET: 'INTERNET',
  DATABASE: 'DATABASE',
  USER_PROVIDED: 'USER_PROVIDED',
  MODEL_INFERENCE: 'MODEL_INFERENCE',
  LOCAL_OLLAMA: 'LOCAL_OLLAMA',
  ANTIGRAVITY: 'ANTIGRAVITY',
  CACHED: 'CACHED'
};

export const EVIDENCE_METHOD = {
  DIRECT_INSPECTION: 'Direct inspection',
  FILE_ANALYSIS: 'File analysis',
  API_VERIFICATION: 'API verification',
  MULTI_SOURCE_COMPARISON: 'Multi-source comparison',
  STATISTICAL_ANALYSIS: 'Statistical analysis',
  MODEL_INFERENCE: 'Model inference',
  WEB_RESEARCH: 'Web research',
  DEVICE_OBSERVATION: 'Device observation',
  MEMORY_RECALL: 'Memory recall'
};

class EvidenceChainBuilder {
  /**
   * Build a complete evidence chain from exploration + execution results.
   * @param {Object} params
   * @returns {Object} EvidenceChain
   */
  buildChain({
    claim,
    goal,
    scope,
    explorationResult,
    executionHistory,
    verification,
    decision
  }) {
    const chainId = `CHAIN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // 1. Build findings from evidence
    const findings = this._buildFindings(explorationResult, executionHistory);

    // 2. Build source records
    const sourceRecords = this._buildSources(explorationResult, executionHistory);

    // 3. Build verification record
    const verificationRecord = this._buildVerification(verification, findings);

    // 4. Build comparison (alternative views)
    const comparison = this._buildComparison(findings, sourceRecords, scope);

    // Merge exploration alternative views (contradictions / low-confidence notes)
    if (Array.isArray(explorationResult?.alternativeViews)) {
      for (const view of explorationResult.alternativeViews) {
        if (view && view.view) {
          comparison.alternatives.push({
            provider: view.provider || 'ALTERNATIVE_VIEW',
            view: view.view,
            severity: view.severity,
            findingCount: 0
          });
        }
      }
      if (comparison.alternatives.length > 0) comparison.hasMultipleSources = true;
    }

    // 5. Build explanation
    const explanation = this._buildExplanation(findings, sourceRecords, scope, decision);

    // 6. Build conclusion
    const conclusion = this._buildConclusion(findings, verificationRecord, comparison);

    return {
      chainId,
      claim: claim || goal,
      goal,
      scope,
      verificationStatus: verificationRecord.status,
      confidence: verificationRecord.confidence,
      findings,
      sources: sourceRecords,
      verification: verificationRecord,
      comparison,
      explanation,
      conclusion,
      limitations: this._mergeLimitations(findings, sourceRecords, scope, explorationResult),
      alternativeViews: comparison.alternatives,
      exploration: {
        explored: Boolean(explorationResult?.explored),
        sourceCount: Array.isArray(explorationResult?.sources) ? explorationResult.sources.length : 0,
        findingCount: (explorationResult?.findings || explorationResult?.evidence || []).length,
        knowledgeGapCount: (explorationResult?.knowledgeGaps || []).length,
        limitationCount: (explorationResult?.limitations || []).length,
        discoveryPathCount: (explorationResult?.discoveryPaths || []).length,
        providerUsed: explorationResult?.providerUsed || []
      },
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Merge exploration-stage gaps/limitations into the chain limitations list.
   */
  _mergeLimitations(findings, sourceRecords, scope, explorationResult) {
    const limitations = this._findLimitations(findings, sourceRecords, scope);

    if (Array.isArray(explorationResult?.knowledgeGaps)) {
      for (const gap of explorationResult.knowledgeGaps) {
        const text = typeof gap === 'string' ? gap : gap?.gap;
        if (text) limitations.push(`[GAP ${gap?.severity || 'MEDIUM'}] ${text}`);
      }
    }

    if (Array.isArray(explorationResult?.limitations)) {
      for (const lim of explorationResult.limitations) {
        if (lim && !limitations.includes(lim)) limitations.push(lim);
      }
    }

    return limitations;
  }

  /**
   * Build findings from exploration evidence and execution results.
   * Prefers the canonical ExploreAgent findings contract when present,
   * falling back to the legacy flattened `evidence` array.
   */
  _buildFindings(explorationResult, executionHistory) {
    const findings = [];
    let findingIndex = 0;

    // Normalize exploration items (canonical findings contract OR legacy evidence)
    const explorationItems = (explorationResult?.findings && Array.isArray(explorationResult.findings) && explorationResult.findings.length > 0)
      ? explorationResult.findings.map(f => ({
          id: f.findingId || `FIND-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: f.type || 'EXPLORATION',
          description: f.claim,
          provider: f.provider,
          confidence: f.confidence,
          method: f.method,
          collectedAt: explorationResult.exploredAt || new Date().toISOString(),
          source: f.provider || 'EXPLORE'
        }))
      : (explorationResult?.evidence || []);

    for (const ev of explorationItems) {
      findingIndex++;
      const description = normalizeModelResponse(ev.description);
      const evidenceItem = {
        id: `EVIDENCE-${String(findingIndex).padStart(3, '0')}`,
        description,
        source: ev.source,
        provider: ev.provider,
        timestamp: ev.collectedAt
      };
      findings.push({
        id: `FINDING-${String(findingIndex).padStart(3, '0')}`,
        claim: description,
        type: ev.type,
        provider: ev.provider,
        confidence: ev.confidence,
        method: ev.method || this._inferMethod(ev),
        sourceType: this._inferSourceType(ev),
        collectedAt: ev.collectedAt,
        evidenceItems: [evidenceItem],
        evidenceRefs: [evidenceItem.id]
      });
    }

    // From execution history (tool results)
    if (executionHistory) {
      for (const h of executionHistory) {
        if (h.stepResult?.result) {
          findingIndex++;
          const result = h.stepResult.result;
          const title = normalizeModelResponse(result.title || h.step?.tool);
          const text = normalizeModelResponse(result.text || title);
          const evidenceItem = {
            id: `EVIDENCE-${String(findingIndex).padStart(3, '0')}`,
            description: normalizeModelResponse(result.text?.slice(0, 300)) || title || 'Tool output',
            source: h.step?.tool || 'UNKNOWN',
            provider: h.step?.providerDomain || 'UNKNOWN',
            timestamp: h.timestamp || new Date().toISOString()
          };
          findings.push({
            id: `FINDING-${String(findingIndex).padStart(3, '0')}`,
            claim: text || title || `Tool execution: ${h.step?.tool}`,
            type: 'TOOL_RESULT',
            provider: h.step?.providerDomain || 'UNKNOWN',
            confidence: h.observation?.valid ? 0.85 : 0.3,
            method: this._inferMethodFromTool(h.step?.tool),
            sourceType: this._inferSourceTypeFromTool(h.step?.tool),
            collectedAt: h.timestamp || new Date().toISOString(),
            evidenceItems: [evidenceItem],
            evidenceRefs: [evidenceItem.id]
          });
        }
      }
    }

    return findings;
  }

  /**
   * Build source records from exploration and execution.
   */
  _buildSources(explorationResult, executionHistory) {
    const sourceMap = new Map();

    // From exploration sources
    if (explorationResult?.sources) {
      for (const src of explorationResult.sources) {
        sourceMap.set(src.id, {
          id: src.id,
          type: src.type,
          provider: src.provider,
          description: src.description,
          timestamp: src.timestamp,
          reliability: this._assessReliability(src)
        });
      }
    }

    // From execution history
    if (executionHistory) {
      for (const h of executionHistory) {
        if (h.step?.tool) {
          const srcId = `src_exec_${h.step.id}`;
          if (!sourceMap.has(srcId)) {
            sourceMap.set(srcId, {
              id: srcId,
              type: this._inferSourceTypeFromTool(h.step.tool),
              provider: h.step.providerDomain || 'UNKNOWN',
              description: `Tool: ${h.step.tool} (${h.step.action || 'execute'})`,
              timestamp: h.timestamp || new Date().toISOString(),
              reliability: h.observation?.valid ? 'HIGH' : 'LOW'
            });
          }
        }
      }
    }

    return Array.from(sourceMap.values());
  }

  /**
   * Build verification record.
   */
  _buildVerification(verification, findings) {
    const verifiedFindings = findings.filter(f => f.confidence >= 0.7);
    const unverifiedFindings = findings.filter(f => f.confidence < 0.7);

    let status;
    // Authoritative pipeline status wins: when the orchestrator explicitly reports
    // an unsatisfied goal (e.g. failed image/document generation), do NOT let
    // partial per-step findings re-derive a misleading VERIFIED status.
    if (verification?.isSatisfied === false &&
        verification?.verificationStatus &&
        verification.verificationStatus !== VERIFICATION_STATUS.UNKNOWN) {
      status = verification.verificationStatus;
    } else if (findings.length === 0) {
      // No evidence collected → prefer a more specific status from AgentVerifier
      // (e.g. INSUFFICIENT_EVIDENCE) rather than the generic UNKNOWN.
      status = (verification?.verificationStatus && verification.verificationStatus !== VERIFICATION_STATUS.UNKNOWN)
        ? verification.verificationStatus
        : VERIFICATION_STATUS.INSUFFICIENT_EVIDENCE;
    } else if (verifiedFindings.length > 0 && unverifiedFindings.length > 0) {
      status = VERIFICATION_STATUS.PARTIALLY_VERIFIED;
    } else if (unverifiedFindings.length === 0) {
      status = VERIFICATION_STATUS.VERIFIED;
    } else {
      status = VERIFICATION_STATUS.UNVERIFIED;
    }

    return {
      status,
      confidence: verification?.confidence || (findings.length > 0 ? verifiedFindings.length / findings.length : 0),
      verifiedCount: verifiedFindings.length,
      unverifiedCount: unverifiedFindings.length,
      totalFindings: findings.length,
      verifiedAt: new Date().toISOString()
    };
  }

  /**
   * Build comparison with alternative views.
   */
  _buildComparison(findings, sources, scope) {
    const alternatives = [];

    // Group findings by provider
    const byProvider = {};
    for (const f of findings) {
      const p = f.provider || 'UNKNOWN';
      if (!byProvider[p]) byProvider[p] = [];
      byProvider[p].push(f);
    }

    // If multiple providers have findings, note the comparison
    const providers = Object.keys(byProvider);
    if (providers.length > 1) {
      for (const p of providers) {
        alternatives.push({
          provider: p,
          findingCount: byProvider[p].length,
          avgConfidence: byProvider[p].reduce((s, f) => s + f.confidence, 0) / byProvider[p].length,
          sampleClaim: byProvider[p][0]?.claim?.slice(0, 200)
        });
      }
    }

    return {
      providerCount: providers.length,
      alternatives,
      hasMultipleSources: providers.length > 1,
      scope
    };
  }

  /**
   * Build explanation of methodology.
   */
  _buildExplanation(findings, sources, scope, decision) {
    const methods = [...new Set(findings.map(f => f.method))];
    const providers = [...new Set(findings.map(f => f.provider))];

    return {
      methods,
      providers,
      scope,
      intent: decision?.intent,
      sourceScope: decision?.sourceScope,
      toolsUsed: findings.map(f => f.type).filter(Boolean),
      explanation: `Evidence collected via ${methods.join(', ')} from ${providers.join(', ')} sources. Scope: ${scope}.`
    };
  }

  /**
   * Build final conclusion.
   */
  _buildConclusion(findings, verification, comparison) {
    const highConfidence = findings.filter(f => f.confidence >= 0.7);
    const hasExternalEvidence = findings.some(f => f.provider === 'ANTIGRAVITY');
    const inconclusive = verification.status === VERIFICATION_STATUS.UNKNOWN
      || verification.status === VERIFICATION_STATUS.INSUFFICIENT_EVIDENCE;

    return {
      canConclude: !inconclusive && findings.length > 0,
      conclusionType: verification.status,
      confidence: verification.confidence,
      supportingFindings: highConfidence.length,
      totalFindings: findings.length,
      hasExternalValidation: hasExternalEvidence,
      hasMultipleSources: comparison.hasMultipleSources,
      summary: verification.status === VERIFICATION_STATUS.VERIFIED
        ? `Kesimpulan diverifikasi berdasarkan ${highConfidence.length} bukti dari ${comparison.providerCount} sumber.`
        : verification.status === VERIFICATION_STATUS.PARTIALLY_VERIFIED
        ? `Sebagian bukti terverifikasi (${highConfidence.length}/${findings.length}). Perlu verifikasi tambahan.`
        : verification.status === VERIFICATION_STATUS.INSUFFICIENT_EVIDENCE
        ? 'Tidak cukup bukti yang dapat diverifikasi untuk membuat kesimpulan yang dapat dipertanggungjawabkan.'
        : 'Belum cukup bukti untuk membuat kesimpulan yang dapat dipertanggungjawabkan.'
    };
  }

  /**
   * Find limitations of the evidence chain.
   */
  _findLimitations(findings, sources, scope) {
    const limitations = [];

    if (findings.length === 0) {
      limitations.push('Tidak ada bukti yang dikumpulkan.');
    }

    const lowConf = findings.filter(f => f.confidence < 0.5);
    if (lowConf.length > 0) {
      limitations.push(`${lowConf.length} bukti memiliki confidence rendah (< 50%).`);
    }

    if (scope === SCOPE.EXTERNAL_REQUIRED && !findings.some(f => f.provider === 'ANTIGRAVITY')) {
      limitations.push('Data eksternal/internet belum dikumpulkan. Kesimpulan hanya berdasarkan data lokal.');
    }

    const singleSource = sources.length <= 1;
    if (singleSource && findings.length > 0) {
      limitations.push('Hanya satu sumber data. Perlu validasi lintas sumber.');
    }

    return limitations;
  }

  _inferMethod(ev) {
    if (ev.type === 'LOCAL_ANALYSIS' || ev.type === 'CACHED_EVIDENCE') return EVIDENCE_METHOD.MODEL_INFERENCE;
    if (ev.type === 'EXTERNAL_PLANNED' || ev.type === 'EXTERNAL_NEEDED') return EVIDENCE_METHOD.WEB_RESEARCH;
    if (ev.type === 'TOOL_RESULT') return EVIDENCE_METHOD.DIRECT_INSPECTION;
    return EVIDENCE_METHOD.MODEL_INFERENCE;
  }

  _inferMethodFromTool(tool) {
    if (tool === 'web.search' || tool === 'web.fetch') return EVIDENCE_METHOD.WEB_RESEARCH;
    if (tool === 'device.inspect') return EVIDENCE_METHOD.DEVICE_OBSERVATION;
    if (tool === 'doc.analyze') return EVIDENCE_METHOD.FILE_ANALYSIS;
    if (tool === 'sandbox.execute') return EVIDENCE_METHOD.STATISTICAL_ANALYSIS;
    return EVIDENCE_METHOD.DIRECT_INSPECTION;
  }

  _inferSourceType(ev) {
    if (ev.provider === 'OLLAMA') return SOURCE_TYPE.LOCAL_OLLAMA;
    if (ev.provider === 'ANTIGRAVITY') return SOURCE_TYPE.ANTIGRAVITY;
    if (ev.type === 'CACHED_EVIDENCE') return SOURCE_TYPE.CACHED;
    return SOURCE_TYPE.MODEL_INFERENCE;
  }

  _inferSourceTypeFromTool(tool) {
    if (tool === 'web.search' || tool === 'web.fetch') return SOURCE_TYPE.INTERNET;
    if (tool === 'device.inspect') return SOURCE_TYPE.SYSTEM_RUNTIME;
    if (tool === 'doc.analyze') return SOURCE_TYPE.LOCAL_FILE;
    return SOURCE_TYPE.MODEL_INFERENCE;
  }

  _assessReliability(src) {
    if (src.type === 'LOCAL_OLLAMA') return 'HIGH';
    if (src.type === 'EXTERNAL_PLANNED') return 'MEDIUM';
    if (src.type === 'LOCAL_MEMORY') return 'MEDIUM';
    return 'MEDIUM';
  }
}

export const evidenceChainBuilderInstance = new EvidenceChainBuilder();
export default evidenceChainBuilderInstance;
