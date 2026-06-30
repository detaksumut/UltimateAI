// src/production/learning/validation/RuleCategory.ts

/**
 * Categorization of validation rules for observability and grouping.
 */
export enum RuleCategory {
  /** Validates the metrics and composition of the candidate (e.g., Confidence, Coverage) */
  STRUCTURAL = "STRUCTURAL",
  
  /** Validates the strength and quantity of the underlying evidence */
  EVIDENCE = "EVIDENCE",
  
  /** Validates the semantic meaning and consistency of the hypothesis */
  SEMANTIC = "SEMANTIC",
  
  /** Enforces organizational or system-wide constraints */
  POLICY = "POLICY"
}
