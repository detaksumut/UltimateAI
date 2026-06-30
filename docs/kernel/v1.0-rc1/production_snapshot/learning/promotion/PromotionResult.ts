// src/production/learning/promotion/PromotionResult.ts

import { LearnedKnowledge } from "./LearnedKnowledge";
import { CandidateStatus } from "../synthesis/CandidateStatus";
import { PromotionDecision } from "./PromotionDecision";

/**
 * The output of the IKnowledgePromoter.
 * Captures not just the knowledge, but the routing and versioning decisions.
 */
export interface PromotionResult {
  /** The finalized, immutable knowledge artifact (if promoted/replaced) */
  readonly knowledge?: LearnedKnowledge;
  
  /** The formal decision made by the policy engine */
  readonly decision: PromotionDecision;
  
  /** The new status of the original candidate (usually PROMOTED) */
  readonly finalCandidateStatus: CandidateStatus;
  
  /** Which repository this should be routed to, determined by policy */
  readonly repositoryTarget?: string;
  
  /** Any non-fatal warnings generated during promotion */
  readonly warnings: readonly string[];
}
