// src/production/intelligence/IntelligenceDecision.ts

/**
 * The standard output format for any Intelligence Engine.
 * It encapsulates the decision made, confidence, and reasoning,
 * ensuring engines exchange information through a common contract.
 */
export interface IntelligenceDecision<T = unknown> {
  /** The specific engine that generated this decision */
  readonly sourceEngine: string;
  
  /** The concrete payload/result of the decision */
  readonly payload: T;
  
  /** Confidence score of the decision (0.0 to 1.0) */
  readonly confidence: number;
  
  /** Human-readable explanation of why this decision was made */
  readonly rationale: string;
  
  /** Warnings or constraints attached to this decision */
  readonly warnings?: readonly string[];
}
