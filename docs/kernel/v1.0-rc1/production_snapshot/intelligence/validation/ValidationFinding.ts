// src/production/intelligence/validation/ValidationFinding.ts

/**
 * Severity level of a validation finding.
 */
export enum ValidationSeverity {
  ERROR = "error",
  WARNING = "warning",
  INFO = "info",
}

/**
 * Represents a single observation made by a ValidationRule.
 */
export interface ValidationFinding {
  /** The severity of the finding */
  readonly severity: ValidationSeverity;
  
  /** Human-readable message describing the finding */
  readonly message: string;
  
  /** The ID of the rule that generated this finding */
  readonly ruleId: string;
  
  /** Optional reference to the specific element (e.g., Task ID or Job ID) */
  readonly targetId?: string;
}
