// src/production/learning/synthesis/CandidateStatus.ts

/**
 * The lifecycle state of a KnowledgeCandidate.
 * Ensures that candidates are traceable from creation through validation to promotion.
 */
export enum CandidateStatus {
  /** Freshly synthesized, awaiting validation */
  DRAFT = "DRAFT",
  
  /** Currently being evaluated by the LearningValidator */
  UNDER_VALIDATION = "UNDER_VALIDATION",
  
  /** Passed validation, awaiting promotion to LearnedKnowledge */
  VALIDATED = "VALIDATED",
  
  /** Failed validation due to an ERROR-level rule violation */
  REJECTED = "REJECTED",
  
  /** Promoted to active LearnedKnowledge */
  PROMOTED = "PROMOTED",
  
  /** Replaced or deprecated by a newer candidate/knowledge */
  SUPERSEDED = "SUPERSEDED"
}
