import { PipelinePolicy } from "./pipeline/PipelinePolicy";
import { PipelineResult } from "./pipeline/PipelineResult";

/**
 * Orchestrator for the Intelligence Engines.
 * Ensures the pipeline executes in a strict, single-direction flow,
 * managing the Quality Loop (Validation -> Critic -> Reflection -> Repair).
 * 
 * Engines do not call each other; the Pipeline coordinates them.
 */
export interface IntelligencePipeline {
  /**
   * Executes the full End-to-End intelligence pipeline for a given request.
   * This is the single entry point for the Intelligence Layer.
   */
  execute(
    userRequest: string,
    policy?: PipelinePolicy
  ): Promise<PipelineResult>;
}
