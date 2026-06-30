// src/production/learning/promotion/KnowledgeStatus.ts

/**
 * Defines the operational state of a LearnedKnowledge artifact.
 */
export enum KnowledgeStatus {
  /** Actively used by Reasoners and Planners */
  ACTIVE = "ACTIVE",
  
  /** Temporarily disabled but not permanently retired */
  DISABLED = "DISABLED",
  
  /** Retired in favor of a newer version (Superseded) */
  SUPERSEDED = "SUPERSEDED",
  
  /** No longer relevant or permanently retired */
  ARCHIVED = "ARCHIVED"
}
