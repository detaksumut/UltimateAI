// src/production/learning/pipeline/LearningPipelineContext.ts

/**
 * Context passed along the Learning Pipeline for tracing and configuration.
 */
export interface LearningPipelineContext {
  readonly pipelineId: string;
  readonly startedAt: number;
  readonly runtimeVersion: string;
  
  /** Generic configurations that stages might need */
  readonly configuration: Record<string, any>;
  
  // Future: could include the active PromotionPolicy or ValidationPolicy if passed top-down
}
