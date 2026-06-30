// src/production/learning/pattern/PatternConfidence.ts

/**
 * Value object representing the AI's confidence in a discovered pattern.
 * Provides a structured format for rule engines to evaluate downstream.
 */
export interface PatternConfidence {
  /** Numerical score (e.g., 0.0 to 1.0) */
  readonly score: number;
  
  /** AI's rationale for this confidence level */
  readonly reason: string;
  
  /** The formula or metric used to calculate this score (e.g., "FREQUENCY_AND_WEIGHT_AGGREGATION") */
  readonly calculation: string;
}
