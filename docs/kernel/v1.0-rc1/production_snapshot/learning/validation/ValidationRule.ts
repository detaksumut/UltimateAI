// src/production/learning/validation/ValidationRule.ts

import { KnowledgeCandidate } from "../synthesis/KnowledgeCandidate";
import { ValidationContext } from "./ValidationContext";
import { RuleResult } from "./RuleResult";
import { RuleCategory } from "./RuleCategory";

/**
 * Contract for a single rule inside the Rule Engine.
 * Must be a pure function that does not mutate the Candidate.
 */
export interface ValidationRule {
  readonly category: RuleCategory;
  readonly name: string;
  readonly version: string;
  
  /**
   * Evaluates the candidate against this specific rule.
   * @param candidate The immutable candidate to evaluate
   * @param context The deterministic execution context and policies
   */
  evaluate(candidate: KnowledgeCandidate, context: ValidationContext): Promise<RuleResult>;
}
