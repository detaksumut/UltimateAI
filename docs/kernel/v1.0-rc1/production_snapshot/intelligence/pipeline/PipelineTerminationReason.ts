// src/production/intelligence/pipeline/PipelineTerminationReason.ts

/**
 * Explains exactly why the pipeline stopped iterating.
 */
export enum PipelineTerminationReason {
  /** The pipeline ran successfully to completion. */
  SUCCESS = "SUCCESS",
  
  /** The DAG's quality score exceeded the requested threshold early. */
  QUALITY_THRESHOLD_REACHED = "QUALITY_THRESHOLD_REACHED",
  
  /** Loop reached the maxIterations limit set by the policy. */
  MAX_ITERATIONS = "MAX_ITERATIONS",
  
  /** The score did not improve by the minImprovement margin across iterations. */
  NO_IMPROVEMENT = "NO_IMPROVEMENT",
  
  /** The DAG failed structural validation and the error was not repairable. */
  VALIDATION_FAILED = "VALIDATION_FAILED",
  
  /** A critical engine failure occurred during the pipeline run. */
  FATAL_ERROR = "FATAL_ERROR"
}
