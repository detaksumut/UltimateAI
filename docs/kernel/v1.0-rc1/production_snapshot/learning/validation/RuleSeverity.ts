// src/production/learning/validation/RuleSeverity.ts

/**
 * Defines the consequence of a rule failing during validation.
 */
export enum RuleSeverity {
  /** The candidate is slightly flawed but can still proceed, or just an observation */
  INFO = "INFO",
  
  /** The candidate has issues that should be noted, but it is not fatal */
  WARNING = "WARNING",
  
  /** The candidate violated a core policy and MUST be rejected */
  ERROR = "ERROR"
}
