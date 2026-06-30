// src/production/learning/promotion/strategies/ConflictResolutionStrategy.ts

/**
 * Dictates how to handle a validated candidate that conflicts with existing knowledge.
 */
export enum ConflictResolutionStrategy {
  /** Replace the existing knowledge only if the new candidate is STRONGER */
  REPLACE_IF_STRONGER = "REPLACE_IF_STRONGER",
  
  /** Ignore the candidate if it is equal or weaker than existing knowledge */
  SKIP_IF_EQUAL_OR_WEAKER = "SKIP_IF_EQUAL_OR_WEAKER",
  
  /** Allow both to co-exist (relies on Reasoners to deduplicate during execution) */
  KEEP_BOTH = "KEEP_BOTH"
}
