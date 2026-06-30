// src/production/learning/pattern/PatternType.ts

/**
 * Semantically classifies the discovered pattern.
 * Allows Reasoners and Optimizers to filter knowledge by utility.
 */
export enum PatternType {
  SUCCESS = "SUCCESS",
  FAILURE = "FAILURE",
  OPTIMIZATION = "OPTIMIZATION",
  WARNING = "WARNING",
  UNKNOWN = "UNKNOWN"
}
