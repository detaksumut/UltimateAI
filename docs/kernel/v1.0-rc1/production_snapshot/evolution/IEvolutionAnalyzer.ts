// src/production/evolution/IEvolutionAnalyzer.ts

import { EvolutionContext } from "./EvolutionContext";
import { EvolutionHypothesis } from "./EvolutionHypothesis";

/**
 * Stage 2 (8G-2): The AI-driven engine that compares new knowledge against existing knowledge
 * and proposes an evolution action (Reinforce, Replace, Merge, etc.).
 */
export interface IEvolutionAnalyzer {
  analyze(context: EvolutionContext): Promise<readonly EvolutionHypothesis[]>;
}
