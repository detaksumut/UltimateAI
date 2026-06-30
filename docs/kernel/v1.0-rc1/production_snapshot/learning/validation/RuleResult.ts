// src/production/learning/validation/RuleResult.ts

import { RuleSeverity } from "./RuleSeverity";

/**
 * The output of a single ValidationRule execution.
 * Rules are pure functions that evaluate a Candidate and return this result.
 */
export interface RuleResult {
  readonly ruleName: string;
  readonly ruleVersion: string;
  readonly passed: boolean;
  readonly severity: RuleSeverity;
  readonly reason: string;
}
