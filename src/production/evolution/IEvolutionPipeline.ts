// src/production/evolution/IEvolutionPipeline.ts

import { LearnedKnowledge } from "../learning/promotion/LearnedKnowledge";
import { EvolutionContext } from "./EvolutionContext";
import { EvolutionPipelineResult } from "./EvolutionPipelineResult";

/**
 * Principle 18 & 19 (extended to Evolution Runtime).
 * Orchestrates the lifecycle of new knowledge merging into the existing repository.
 */
export interface IEvolutionPipeline {
  /**
   * The entry point for the Evolution Runtime.
   * Takes a newly promoted LearnedKnowledge and orchestrates its integration.
   */
  evolve(newKnowledge: LearnedKnowledge, context: EvolutionContext): Promise<EvolutionPipelineResult>;
}
