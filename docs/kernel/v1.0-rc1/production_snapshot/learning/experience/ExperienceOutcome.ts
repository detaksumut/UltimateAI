// src/production/learning/experience/ExperienceOutcome.ts

/**
 * Objective classification of a historical event's result.
 * Essential for the Pattern Analyzer to perform clustering.
 */
export enum ExperienceOutcome {
  SUCCESS = "SUCCESS",
  PARTIAL_SUCCESS = "PARTIAL_SUCCESS",
  FAILURE = "FAILURE",
  CANCELLED = "CANCELLED",
  INTERRUPTED = "INTERRUPTED",
  UNKNOWN = "UNKNOWN"
}
