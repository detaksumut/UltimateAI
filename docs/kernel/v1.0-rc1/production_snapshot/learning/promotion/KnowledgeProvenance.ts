// src/production/learning/promotion/KnowledgeProvenance.ts

import { KnowledgeOrigin } from "./KnowledgeOrigin";

/**
 * Encapsulates the complete origin story of a piece of LearnedKnowledge.
 * Enables full auditability without bloating the Knowledge artifact itself.
 */
export interface KnowledgeProvenance {
  /** The original hypothesis candidate this knowledge evolved from */
  readonly candidateId: string;
  
  /** The specific validation report that authorized this promotion */
  readonly validationReportId: string;
  
  /** The policy version active at the time of promotion */
  readonly promotionPolicyVersion: string;
  
  /** Where this knowledge originated from (Runtime, Manual, etc.) */
  readonly origin: KnowledgeOrigin;
}
