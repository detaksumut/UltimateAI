// src/production/learning/promotion/PromotionDecision.ts

/**
 * Represents the final decision made by the KnowledgePromoter.
 */
export enum PromotionDecision {
  /** Successfully transformed into new active knowledge */
  PROMOTED = "PROMOTED",
  
  /** Valid but conceptually identical to existing knowledge; ignored */
  SKIPPED = "SKIPPED",
  
  /** Superseded older active knowledge with this new version */
  REPLACED = "REPLACED",
  
  /** Sent directly to the archive without becoming active */
  ARCHIVED = "ARCHIVED"
}
