// src/production/knowledge/projection/ProjectionContext.ts

/**
 * Context provided to a Knowledge Projector.
 * Avoids passing an ever-growing list of parameters to the projector.
 */
export interface ProjectionContext {
  /** The global trace identifier */
  readonly correlationId: string;
  
  /** 
   * The ID of the artifact that preceded the current one, if any.
   * Useful for establishing DERIVED_FROM or SUPERSEDES edges.
   */
  readonly parentArtifactId?: string;
  
  /** The stage of the pipeline where this projection is occurring */
  readonly pipelineStage?: string;
}
