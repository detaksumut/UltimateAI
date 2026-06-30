// src/production/learning/validation/ValidationPolicy.ts

/**
 * The configuration parameters for the Validation Engine.
 * Rules read these thresholds rather than hardcoding numbers.
 */
export interface ValidationPolicy {
  readonly minimumConfidenceScore: number;
  readonly minimumCoverageCount: number;
  
  /** Maximum acceptable ratio of contradicting evidence vs supporting evidence (e.g., 0.2 means max 20% contradiction) */
  readonly maximumContradictionRatio: number;
  
  /** Maximum age (in milliseconds) of the most recent experience before the pattern is considered stale */
  readonly maximumExperienceAgeMs: number;
}
