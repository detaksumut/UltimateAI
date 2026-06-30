// src/production/evolution/IEvolutionPromoter.ts

import { EvolutionHypothesis } from "./EvolutionHypothesis";
import { EvolutionValidationReport } from "./IEvolutionValidator";
import { EvolutionContext } from "./EvolutionContext";
import { EvolutionResult } from "./EvolutionResult";

/**
 * Stage 4 (8G-4): Executes a validated evolution hypothesis.
 * Principle 21: Evolution Creates, Never Mutates.
 * Generates status updates and potentially mints new knowledge versions, without mutating payloads.
 */
export interface IEvolutionPromoter {
  /**
   * Translates a validated hypothesis into formal StatusUpdates and GraphUpdates.
   */
  promote(
    hypothesis: EvolutionHypothesis, 
    report: EvolutionValidationReport, 
    context: EvolutionContext
  ): Promise<EvolutionResult>;
}
