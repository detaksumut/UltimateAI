// src/production/evolution/EvolutionHypothesis.ts

import { EvolutionDecision } from "./EvolutionDecision";
import { HypothesisStrength } from "../synthesis/HypothesisStrength";

/**
 * The AI's proposed interpretation of how the new knowledge interacts with existing knowledge.
 */
export interface EvolutionHypothesis {
  readonly id: string;
  readonly newKnowledgeId: string;
  readonly existingKnowledgeIds: readonly string[];
  
  readonly proposedDecision: EvolutionDecision;
  readonly reasoning: string;
  
  readonly confidence: HypothesisStrength;
  readonly limitations: readonly string[];
  readonly alternatives: readonly EvolutionDecision[];
}
