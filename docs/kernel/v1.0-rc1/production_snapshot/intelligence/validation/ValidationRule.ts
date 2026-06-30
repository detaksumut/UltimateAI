// src/production/intelligence/validation/ValidationRule.ts

import { ValidationContext } from "./ValidationContext";
import { ValidationFinding } from "./ValidationFinding";

/**
 * Metadata identifying a specific validation rule.
 */
export interface ValidationRuleMetadata {
  readonly ruleId: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
}

/**
 * Interface that all individual execution validators must implement.
 * Each rule operates independently and does not know about other rules.
 */
export interface ValidationRule {
  /** The identity and description of this rule */
  readonly metadata: ValidationRuleMetadata;
  
  /**
   * Executes the rule against the provided context.
   * Returns an array of findings (which may be empty if perfectly valid).
   */
  validate(context: ValidationContext): ValidationFinding[];
}
