// src/production/intelligence/pipeline/PipelinePolicy.ts

import { DecisionPolicy } from "../reflection/DecisionPolicy";

/**
 * Configuration for how the Intelligence Pipeline behaves.
 */
export interface PipelinePolicy {
  /** Maximum iterations of the Quality Loop (Critic -> Reflection -> Repair). Prevents infinite loops. */
  readonly maxIterations: number;
  
  /** The overall quality score (0.0 to 1.0) that short-circuits the loop to READY. */
  readonly qualityThreshold: number;
  
  /** Minimum score improvement required between iterations to prevent thrashing. */
  readonly minImprovement: number;
  
  /** The policy determining how conservative the Reflection Engine is. */
  readonly decisionPolicy: DecisionPolicy;
  
  /** If true, the final Execution MUST pass Validation before being deemed ready. */
  readonly validationRequired: boolean;
}

export const DEFAULT_PIPELINE_POLICY: PipelinePolicy = {
  maxIterations: 3,
  qualityThreshold: 0.9,
  minImprovement: 0.01,
  decisionPolicy: DecisionPolicy.BALANCED,
  validationRequired: true
};
