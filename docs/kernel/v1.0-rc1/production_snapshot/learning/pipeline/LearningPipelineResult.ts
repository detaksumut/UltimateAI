// src/production/learning/pipeline/LearningPipelineResult.ts

/**
 * The final observability payload returned by the LearningPipeline.
 */
export interface LearningPipelineResult {
  readonly pipelineId: string;
  
  // Metrics
  readonly experienceCount: number;
  readonly patternCount: number;
  readonly candidateCount: number;
  readonly validatedCount: number;
  readonly promotedCount: number;
  readonly archivedCount: number;
  
  readonly executionTimeMs: number;
  readonly warnings: readonly string[];
}
