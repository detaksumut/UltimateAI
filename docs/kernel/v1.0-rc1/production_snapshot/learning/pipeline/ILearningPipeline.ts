// src/production/learning/pipeline/ILearningPipeline.ts

import { ReconstructionResult } from "../../knowledge/reconstruction/ReconstructionResult";
import { LearningPipelineResult } from "./LearningPipelineResult";
import { LearningPipelineContext } from "./LearningPipelineContext";

/**
 * Principle 18: Stages Are Replaceable.
 * Principle 19: Pipeline Coordinates, Stages Decide.
 * 
 * Orchestrates the flow of data through all stages of the Learning Runtime.
 */
export interface ILearningPipeline {
  /**
   * The single entry point for the Learning Runtime.
   * Processes a reconstructed historical state into formalized LearnedKnowledge.
   */
  process(
    reconstruction: ReconstructionResult, 
    context: LearningPipelineContext
  ): Promise<LearningPipelineResult>;
}
