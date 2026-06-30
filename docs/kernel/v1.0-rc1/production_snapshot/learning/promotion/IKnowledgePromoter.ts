// src/production/learning/promotion/IKnowledgePromoter.ts

import { KnowledgeCandidate } from "../synthesis/KnowledgeCandidate";
import { ValidationReport } from "../validation/ValidationReport";
import { PromotionPolicy } from "./PromotionPolicy";
import { PromotionResult } from "./PromotionResult";

/**
 * The boundary that transforms a validated AI hypothesis into a formal, versioned Knowledge artifact.
 * Strictly adheres to the provided PromotionPolicy.
 */
export interface IKnowledgePromoter {
  /**
   * Promotes a candidate based on its validation report and the active policy.
   * Throws an error if the report is FAILED.
   * 
   * @param candidate The original candidate
   * @param report The immutable validation report
   * @param policy The organizational policy dictating promotion rules
   * @returns A detailed PromotionResult wrapping the LearnedKnowledge
   */
  promote(
    candidate: KnowledgeCandidate, 
    report: ValidationReport, 
    policy: PromotionPolicy
  ): Promise<PromotionResult>;
}
