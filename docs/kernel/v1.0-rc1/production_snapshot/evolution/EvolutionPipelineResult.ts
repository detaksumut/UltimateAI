// src/production/evolution/EvolutionPipelineResult.ts

/**
 * The final observability payload returned by the EvolutionPipeline.
 */
export interface EvolutionPipelineResult {
  readonly pipelineId: string;
  
  // Metrics
  readonly discovered: number;
  readonly analyzed: number;
  readonly validated: number;
  
  // Outcome Metrics
  readonly created: number;
  readonly superseded: number;
  readonly archived: number;
  readonly graphUpdates: number;
  
  readonly executionTimeMs: number;
  readonly warnings: readonly string[];
}
