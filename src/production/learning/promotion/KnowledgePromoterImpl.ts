// src/production/learning/promotion/KnowledgePromoterImpl.ts

import { IKnowledgePromoter } from "./IKnowledgePromoter";
import { KnowledgeCandidate } from "../synthesis/KnowledgeCandidate";
import { ValidationReport } from "../validation/ValidationReport";
import { PromotionPolicy } from "./PromotionPolicy";
import { PromotionResult } from "./PromotionResult";
import { PromotionDecision } from "./PromotionDecision";
import { CandidateStatus } from "../synthesis/CandidateStatus";
import { LearnedKnowledge } from "./LearnedKnowledge";
import { KnowledgeStatus } from "./KnowledgeStatus";
import { KnowledgeOrigin } from "./KnowledgeOrigin";

/**
 * Concrete KnowledgePromoter for Milestone 8.
 * Promotes validated candidates into formalized, immutable LearnedKnowledge artifacts.
 */
export class KnowledgePromoterImpl implements IKnowledgePromoter {
  async promote(
    candidate: KnowledgeCandidate, 
    report: ValidationReport, 
    policy: PromotionPolicy
  ): Promise<PromotionResult> {
    const warnings: string[] = [];

    if (!report.passed) {
      return {
        decision: PromotionDecision.REJECTED,
        finalCandidateStatus: CandidateStatus.REJECTED,
        warnings: Object.freeze(["Candidate rejected due to failed validation report."])
      };
    }

    try {
      const knowledgeId = `knw-${candidate.id.replace('cand-', '')}`;
      const learnedKnowledge: LearnedKnowledge = {
        identity: {
          id: knowledgeId,
          type: "LEARNED_KNOWLEDGE",
          version: "1.0.0",
          createdAt: Date.now()
        },
        trace: {
          traceId: candidate.context.correlationId || `trace-${Date.now()}`,
          requestId: candidate.id
        },
        title: candidate.hypothesis.summary,
        summary: candidate.hypothesis.hypothesis,
        tags: Object.freeze(["autonomous", "milestone-8", candidate.synthesisMetadata.scope.toLowerCase()]),
        knowledgeId,
        version: 1,
        provenance: {
          candidateId: candidate.id,
          validationReportId: `rep-${candidate.id}`,
          promotionPolicyVersion: "1.0.0",
          origin: KnowledgeOrigin.LEARNING_RUNTIME
        },
        status: KnowledgeStatus.ACTIVE,
        content: {
          hypothesis: candidate.hypothesis.hypothesis,
          assumptions: candidate.hypothesis.assumptions,
          limitations: candidate.hypothesis.limitations,
          supportingEvidence: candidate.hypothesis.supportingEvidence,
          strength: candidate.hypothesis.strength
        }
      };

      return {
        knowledge: learnedKnowledge,
        decision: PromotionDecision.PROMOTED,
        finalCandidateStatus: CandidateStatus.PROMOTED,
        repositoryTarget: policy.targetRepository || "DEFAULT",
        warnings: Object.freeze(warnings)
      };
    } catch (err: any) {
      return {
        decision: PromotionDecision.REJECTED,
        finalCandidateStatus: CandidateStatus.REJECTED,
        warnings: Object.freeze([`Promotion error: ${err.message}`])
      };
    }
  }
}
