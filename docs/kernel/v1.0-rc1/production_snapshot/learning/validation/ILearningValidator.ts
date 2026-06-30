// src/production/learning/validation/ILearningValidator.ts

import { KnowledgeCandidate } from "../synthesis/KnowledgeCandidate";
import { ValidationContext } from "./ValidationContext";
import { ValidationReport } from "./ValidationReport";

/**
 * The Orchestrator for the Validation Rule Engine.
 * Takes a candidate and runs it through all registered rules (sequentially or in parallel).
 */
export interface ILearningValidator {
  /**
   * Validates a candidate, returning a comprehensive report.
   * Does NOT modify the candidate itself.
   */
  validate(candidate: KnowledgeCandidate, context: ValidationContext): Promise<ValidationReport>;
}
