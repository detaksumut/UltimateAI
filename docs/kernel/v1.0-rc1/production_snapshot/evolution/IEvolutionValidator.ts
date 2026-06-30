// src/production/evolution/IEvolutionValidator.ts

import { EvolutionContext } from "./EvolutionContext";
import { EvolutionHypothesis } from "./EvolutionHypothesis";

export interface EvolutionValidationReport {
  readonly hypothesisId: string;
  readonly passed: boolean;
  readonly warnings: readonly string[];
}

/**
 * Stage 3 (8G-3): Deterministically validates the AI's proposed EvolutionHypothesis
 * against hardcoded organizational rules (e.g. patch cannot overwrite a major).
 */
export interface IEvolutionValidator {
  validate(hypothesis: EvolutionHypothesis, context: EvolutionContext): Promise<EvolutionValidationReport>;
}
